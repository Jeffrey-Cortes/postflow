import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DraftStatus, Platform, Prisma, RequestStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { HistoryService } from '../history/history.service';
import { DraftValidationService } from '../validation/draft-validation.service';
import { DRAFT_GENERATOR } from './draft-generator.port';
import type { DraftGenerator } from './draft-generator.port';

@Injectable()
export class DraftGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly historyService: HistoryService,
    private readonly validationService: DraftValidationService,
    @Inject(DRAFT_GENERATOR) private readonly draftGenerator: DraftGenerator,
  ) {}

  async generateForRequest(
    publicationRequestId: string,
    platforms: Platform[] = [Platform.FACEBOOK, Platform.X],
  ): Promise<void> {
    const request = await this.prisma.publicationRequest.findUnique({
      where: { id: publicationRequestId },
      include: {
        receivedMessages: { orderBy: { receivedAt: 'asc' } },
        assets: { where: { kind: 'IMAGE', telegramFileId: { not: null } } },
      },
    });
    if (!request) throw new NotFoundException('Publication request not found');
    const sourceText =
      request.receivedMessages
        .map((message) => message.text ?? message.caption)
        .filter((text): text is string => Boolean(text?.trim()))
        .join('\n')
        .trim() ||
      request.sourceSummary ||
      '';
    if (!sourceText)
      throw new NotFoundException('Publication request has no text source');

    await Promise.all(
      platforms.map(async (platform) => {
        const references = await this.historyService.findRelevantExamples(
          request.organizationId,
          platform,
          sourceText,
        );
        const generated = await this.draftGenerator.generate({
          platform,
          sourceText,
          references,
          availableImageFileIds: request.assets.flatMap((asset) =>
            asset.telegramFileId ? [asset.telegramFileId] : [],
          ),
        });
        const validation = this.validationService.validate(
          platform,
          generated.content,
          sourceText,
        );
        await this.persistGeneratedDraft({
          publicationRequestId,
          platform,
          validation,
          content: generated.content,
          generationContext: {
            generator: this.draftGenerator.constructor.name,
            referenceIds: references.map((reference) => reference.id),
            selectedImageFileIds: generated.selectedImageFileIds,
            selectionReason: generated.selectionReason,
          },
        });
      }),
    );
  }

  private async persistGeneratedDraft(input: {
    publicationRequestId: string;
    platform: Platform;
    validation: ReturnType<DraftValidationService['validate']>;
    content: string;
    generationContext: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Updating the parent acquires a row lock in PostgreSQL. That serializes
      // version allocation for concurrent regeneration requests.
      await tx.publicationRequest.update({
        where: { id: input.publicationRequestId },
        data: { status: RequestStatus.PENDING_REVIEW },
      });
      const latest = await tx.draft.findFirst({
        where: {
          publicationRequestId: input.publicationRequestId,
          platform: input.platform,
        },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      await tx.draft.updateMany({
        where: {
          publicationRequestId: input.publicationRequestId,
          platform: input.platform,
          status: DraftStatus.PROPOSED,
        },
        data: { status: DraftStatus.SUPERSEDED },
      });
      await tx.draft.create({
        data: {
          publicationRequestId: input.publicationRequestId,
          platform: input.platform,
          version: (latest?.version ?? 0) + 1,
          status: input.validation.isValid
            ? DraftStatus.PROPOSED
            : DraftStatus.REJECTED,
          content: input.content,
          validationResult:
            input.validation as unknown as Prisma.InputJsonValue,
          generationContext: input.generationContext,
        },
      });
    });
  }
}
