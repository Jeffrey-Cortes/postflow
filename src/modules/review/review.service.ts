import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ApprovalDecision,
  DraftStatus,
  Prisma,
  PublicationStatus,
  RequestStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { DraftGenerationService } from '../generation/draft-generation.service';
import { PublicationService } from '../publishing/publication.service';
import { DraftValidationService } from '../validation/draft-validation.service';
import { ReviewCallback } from './review.types';

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly generationService: DraftGenerationService,
    private readonly validationService: DraftValidationService,
    private readonly publicationService: PublicationService,
  ) {}

  async applyCallback(
    userId: string,
    callback: ReviewCallback,
  ): Promise<string> {
    const draft = await this.findDraftForAction(userId, callback);
    if (draft.status !== DraftStatus.PROPOSED) {
      return 'Esta acción ya fue procesada o el borrador fue reemplazado.';
    }
    if (callback.action === 'APPROVE' || callback.action === 'REJECT') {
      const decision =
        callback.action === 'APPROVE'
          ? ApprovalDecision.APPROVED
          : ApprovalDecision.REJECTED;
      const transitioned = await this.prisma.$transaction(async (tx) => {
        const result = await tx.draft.updateMany({
          where: { id: draft.id, status: DraftStatus.PROPOSED },
          data: {
            status:
              decision === ApprovalDecision.APPROVED
                ? DraftStatus.APPROVED
                : DraftStatus.REJECTED,
          },
        });
        if (result.count === 0) return false;
        await tx.approval.create({
          data: {
            publicationRequestId: callback.publicationRequestId,
            draftId: draft.id,
            userId,
            platform: callback.platform,
            decision,
          },
        });
        return true;
      });
      if (!transitioned)
        return 'Esta acción ya fue procesada o el borrador fue reemplazado.';
      if (decision === ApprovalDecision.REJECTED) {
        await this.synchronizeRequestStatus(callback.publicationRequestId);
        return `${callback.platform} rechazado.`;
      }
      const result = await this.publicationService.publishApproved(
        callback.publicationRequestId,
        callback.platform,
      );
      await this.synchronizeRequestStatus(callback.publicationRequestId);
      return result.status === 'PUBLISHED'
        ? `${callback.platform} ${result.simulated ? 'publicaci\u00f3n simulada' : 'publicado'}: ${result.url}`
        : `${callback.platform} aprobado, pero la publicaci\u00f3n fall\u00f3: ${result.error}`;
    }
    if (callback.action === 'REGENERATE') {
      const claimed = await this.prisma.draft.updateMany({
        where: { id: draft.id, status: DraftStatus.PROPOSED },
        data: { status: DraftStatus.SUPERSEDED },
      });
      if (claimed.count === 0)
        return 'Esta acción ya fue procesada o el borrador fue reemplazado.';
      await this.generationService.generateForRequest(
        callback.publicationRequestId,
        [callback.platform],
      );
      return `Nuevo borrador de ${callback.platform} generado para revisi\u00f3n.`;
    }
    const opened = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.draft.updateMany({
        where: { id: draft.id, status: DraftStatus.PROPOSED },
        data: { status: DraftStatus.SUPERSEDED },
      });
      if (claimed.count === 0) return false;
      await tx.reviewSession.updateMany({
        where: { userId, completedAt: null },
        data: { completedAt: new Date() },
      });
      await tx.reviewSession.create({
        data: {
          publicationRequestId: callback.publicationRequestId,
          userId,
          platform: callback.platform,
          action: 'EDIT',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
      return true;
    });
    if (!opened)
      return 'Esta acción ya fue procesada o el borrador fue reemplazado.';
    return `Env\u00eda el nuevo texto para ${callback.platform} dentro de 15 minutos.`;
  }

  async consumePendingEdit(
    userId: string,
    content: string,
  ): Promise<string | null> {
    const session = await this.prisma.reviewSession.findFirst({
      where: {
        userId,
        action: 'EDIT',
        completedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        publicationRequest: {
          include: { receivedMessages: { orderBy: { receivedAt: 'asc' } } },
        },
      },
    });
    if (!session) return null;
    const sourceText =
      session.publicationRequest.receivedMessages
        .map((message) => message.text ?? message.caption)
        .filter((text): text is string => Boolean(text?.trim()))
        .join('\n') ||
      session.publicationRequest.sourceSummary ||
      '';
    const validation = this.validationService.validate(
      session.platform,
      content,
      sourceText,
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.publicationRequest.update({
        where: { id: session.publicationRequestId },
        data: { status: RequestStatus.PENDING_REVIEW },
      });
      const latest = await tx.draft.findFirst({
        where: {
          publicationRequestId: session.publicationRequestId,
          platform: session.platform,
        },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      await tx.draft.create({
        data: {
          publicationRequestId: session.publicationRequestId,
          platform: session.platform,
          version: (latest?.version ?? 0) + 1,
          status: validation.isValid
            ? DraftStatus.PROPOSED
            : DraftStatus.REJECTED,
          content,
          validationResult: validation as unknown as Prisma.InputJsonValue,
          generationContext: { generator: 'human-edit' },
        },
      });
      await tx.reviewSession.update({
        where: { id: session.id },
        data: { completedAt: new Date() },
      });
    });
    return validation.isValid
      ? `Edici\u00f3n de ${session.platform} guardada para revisi\u00f3n.`
      : `La edici\u00f3n de ${session.platform} fue rechazada por validaci\u00f3n.`;
  }

  private async findDraftForAction(userId: string, callback: ReviewCallback) {
    const draft = await this.prisma.draft.findFirst({
      where: {
        id: callback.draftId,
        publicationRequestId: callback.publicationRequestId,
        platform: callback.platform,
        publicationRequest: { requestedById: userId },
      },
      orderBy: { version: 'desc' },
    });
    if (!draft)
      throw new NotFoundException(
        'No active draft was found for this review action',
      );
    return draft;
  }

  private async synchronizeRequestStatus(
    publicationRequestId: string,
  ): Promise<void> {
    const request = await this.prisma.publicationRequest.findUnique({
      where: { id: publicationRequestId },
      select: {
        drafts: { select: { id: true, status: true } },
        publications: { select: { draftId: true, status: true } },
      },
    });
    if (!request || request.drafts.length === 0) return;

    const status = this.requestStatus(request.drafts, request.publications);
    await this.prisma.publicationRequest.update({
      where: { id: publicationRequestId },
      data: { status },
    });
  }

  private requestStatus(
    drafts: Array<{ id: string; status: DraftStatus }>,
    publications: Array<{ draftId: string; status: PublicationStatus }>,
  ): RequestStatus {
    if (publications.some(({ status }) => status === PublicationStatus.FAILED))
      return RequestStatus.FAILED;
    if (drafts.some(({ status }) => status === DraftStatus.PROPOSED))
      return RequestStatus.PENDING_REVIEW;
    if (drafts.every(({ status }) => status === DraftStatus.REJECTED))
      return RequestStatus.REJECTED;

    const approvedDraftIds = new Set(
      drafts
        .filter(({ status }) => status === DraftStatus.APPROVED)
        .map(({ id }) => id),
    );
    const publishedDraftIds = new Set(
      publications
        .filter(({ status }) => status === PublicationStatus.PUBLISHED)
        .map(({ draftId }) => draftId),
    );
    if (
      [...approvedDraftIds].every((draftId) => publishedDraftIds.has(draftId))
    ) {
      return RequestStatus.COMPLETED;
    }
    return RequestStatus.PENDING_REVIEW;
  }
}
