import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { ReviewService } from '../review/review.service';
import { ReviewPresentationService } from '../review/review-presentation.service';
import { parseReviewCallback } from '../review/review.types';
import { DraftGenerationService } from '../generation/draft-generation.service';
import { TelegramBotApiService } from './telegram-bot-api.service';
import { normalizeTelegramUpdate } from './telegram-update.normalizer';
import { NormalizedTelegramMessage, TelegramUpdate } from './telegram.types';

export interface TelegramIngestionResult {
  accepted: boolean;
  duplicate?: boolean;
  ignored?: boolean;
  publicationRequestId?: string;
  message?: string;
}

@Injectable()
export class TelegramIngestionService {
  private readonly logger = new Logger(TelegramIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly reviewService: ReviewService,
    private readonly reviewPresentationService: ReviewPresentationService,
    private readonly generationService: DraftGenerationService,
    private readonly telegramBotApiService: TelegramBotApiService,
  ) {}

  async receive(
    update: TelegramUpdate,
    webhookSecret?: string,
  ): Promise<TelegramIngestionResult> {
    this.assertWebhookSecret(webhookSecret);
    if (update.callback_query) return this.processReviewCallback(update);
    const message = normalizeTelegramUpdate(update);
    if (!message) return { accepted: true, ignored: true };

    const duplicate = await this.prisma.receivedMessage.findUnique({
      where: { telegramUpdateId: message.updateId },
      select: { publicationRequestId: true },
    });
    if (duplicate) {
      return {
        accepted: true,
        duplicate: true,
        publicationRequestId: duplicate.publicationRequestId ?? undefined,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { telegramUserId: message.senderId },
      select: { id: true, organizationId: true, isActive: true },
    });
    if (!user?.isActive) {
      this.logger.warn(
        `Ignoring update ${message.updateId} from an unauthorized Telegram user`,
      );
      return { accepted: false, ignored: true };
    }

    if (message.text?.trim() === '/finalizar') {
      return this.finalizeAlbum(message.chatId, user.id);
    }

    const edited = await this.reviewService.consumePendingEdit(
      user.id,
      message.text ?? message.caption ?? '',
    );
    if (edited) return { accepted: true, ignored: true, message: edited };

    let publicationRequestId: string;
    try {
      publicationRequestId = message.mediaGroupId
        ? await this.persistAlbumMessage(message, update, user)
        : await this.persistSingleMessage(message, update, user);
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;
      const persistedMessage = await this.prisma.receivedMessage.findUnique({
        where: { telegramUpdateId: message.updateId },
        select: { publicationRequestId: true },
      });
      if (persistedMessage?.publicationRequestId) {
        return {
          accepted: true,
          duplicate: true,
          publicationRequestId: persistedMessage.publicationRequestId,
        };
      }
      if (message.mediaGroupId) return this.receive(update, webhookSecret);
      throw error;
    }

    if (!message.mediaGroupId) {
      await this.generateAndSendProposal(publicationRequestId, message.chatId);
    }
    return { accepted: true, publicationRequestId };
  }

  private async processReviewCallback(
    update: TelegramUpdate,
  ): Promise<TelegramIngestionResult> {
    const callback = parseReviewCallback(update.callback_query?.data);
    if (!callback) return { accepted: true, ignored: true };
    const user = await this.prisma.user.findUnique({
      where: { telegramUserId: String(update.callback_query?.from.id) },
      select: { id: true, isActive: true },
    });
    if (!user?.isActive) return { accepted: false, ignored: true };
    const message = await this.reviewService.applyCallback(user.id, callback);
    await this.telegramBotApiService.answerCallback(
      update.callback_query!.id,
      message,
    );
    const chatId = update.callback_query?.message?.chat.id;
    if (chatId !== undefined) {
      await this.telegramBotApiService.sendText(String(chatId), message);
    }
    return {
      accepted: true,
      message,
      publicationRequestId: callback.publicationRequestId,
    };
  }

  private async finalizeAlbum(
    chatId: string,
    userId: string,
  ): Promise<TelegramIngestionResult> {
    const request = await this.prisma.publicationRequest.findFirst({
      where: {
        telegramChatId: chatId,
        requestedById: userId,
        status: 'RECEIVING',
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    if (!request) {
      return {
        accepted: true,
        ignored: true,
        message: 'No hay un álbum pendiente para finalizar.',
      };
    }
    await this.generateAndSendProposal(request.id, chatId);
    return {
      accepted: true,
      publicationRequestId: request.id,
      message: 'Álbum recibido y enviado a revisión.',
    };
  }

  private async generateAndSendProposal(
    publicationRequestId: string,
    chatId: string,
  ): Promise<void> {
    await this.generationService.generateForRequest(publicationRequestId);
    const proposal =
      await this.reviewPresentationService.create(publicationRequestId);
    await this.telegramBotApiService.sendProposal(
      chatId,
      proposal.text,
      proposal.buttons,
    );
  }

  private assertWebhookSecret(receivedSecret?: string): void {
    const expectedSecret = this.configService.get<string>(
      'TELEGRAM_WEBHOOK_SECRET',
    );
    if (!expectedSecret) return;
    const received = Buffer.from(receivedSecret ?? '');
    const expected = Buffer.from(expectedSecret);
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new UnauthorizedException('Invalid Telegram webhook secret');
    }
  }

  private async persistSingleMessage(
    message: NormalizedTelegramMessage,
    update: TelegramUpdate,
    user: { id: string; organizationId: string },
  ): Promise<string> {
    const request = await this.prisma.publicationRequest.create({
      data: {
        organizationId: user.organizationId,
        requestedById: user.id,
        telegramChatId: message.chatId,
        sourceSummary: message.text ?? message.caption,
        receivedMessages: { create: this.receivedMessageData(message, update) },
      },
    });
    await this.createAssetsForMessage(
      request.id,
      message.updateId,
      message.assets,
    );
    return request.id;
  }

  private async persistAlbumMessage(
    message: NormalizedTelegramMessage,
    update: TelegramUpdate,
    user: { id: string; organizationId: string },
  ): Promise<string> {
    const group = await this.prisma.telegramMediaGroup.findUnique({
      where: {
        telegramChatId_mediaGroupId: {
          telegramChatId: message.chatId,
          mediaGroupId: message.mediaGroupId!,
        },
      },
      select: { publicationRequestId: true },
    });
    if (group) {
      await this.prisma.receivedMessage.create({
        data: {
          ...this.receivedMessageData(message, update),
          publicationRequestId: group.publicationRequestId,
        },
      });
      await this.createAssetsForMessage(
        group.publicationRequestId,
        message.updateId,
        message.assets,
      );
      await this.prisma.telegramMediaGroup.update({
        where: {
          telegramChatId_mediaGroupId: {
            telegramChatId: message.chatId,
            mediaGroupId: message.mediaGroupId!,
          },
        },
        data: { lastReceivedAt: message.receivedAt },
      });
      return group.publicationRequestId;
    }

    const request = await this.prisma.publicationRequest.create({
      data: {
        organizationId: user.organizationId,
        requestedById: user.id,
        telegramChatId: message.chatId,
        sourceSummary: message.text ?? message.caption,
        telegramMediaGroup: {
          create: {
            telegramChatId: message.chatId,
            mediaGroupId: message.mediaGroupId!,
            firstReceivedAt: message.receivedAt,
            lastReceivedAt: message.receivedAt,
          },
        },
        receivedMessages: { create: this.receivedMessageData(message, update) },
      },
    });
    await this.createAssetsForMessage(
      request.id,
      message.updateId,
      message.assets,
    );
    return request.id;
  }

  private receivedMessageData(
    message: NormalizedTelegramMessage,
    update: TelegramUpdate,
  ): Prisma.ReceivedMessageCreateWithoutPublicationRequestInput {
    return {
      telegramChatId: message.chatId,
      telegramMessageId: message.messageId,
      telegramUpdateId: message.updateId,
      mediaGroupId: message.mediaGroupId,
      text: message.text,
      caption: message.caption,
      receivedAt: message.receivedAt,
      rawPayload: update as unknown as Prisma.InputJsonValue,
    };
  }

  private async createAssetsForMessage(
    publicationRequestId: string,
    telegramUpdateId: string,
    assets: NormalizedTelegramMessage['assets'],
  ): Promise<void> {
    if (assets.length === 0) return;
    const receivedMessage = await this.prisma.receivedMessage.findUniqueOrThrow(
      { where: { telegramUpdateId }, select: { id: true } },
    );
    await this.prisma.asset.createMany({
      data: assets.map((asset) => ({
        ...asset,
        publicationRequestId,
        receivedMessageId: receivedMessage.id,
      })),
    });
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
