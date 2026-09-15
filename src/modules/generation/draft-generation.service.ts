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
        assets: {
          where: {
            kind: { in: ['IMAGE', 'VIDEO'] },
            telegramFileId: { not: null },
          },
        },
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
    const mediaSelectionMode = request.assets.some(
      (asset) => asset.kind === 'VIDEO',
    )
      ? 'MANUAL_VIDEO_SELECTION'
      : 'AI_IMAGE_SELECTION';

    const referencesByPlatform = Object.fromEntries(
      await Promise.all(
        platforms.map(async (platform) => [
          platform,
          await this.historyService.findRelevantExamples(
            request.organizationId,
            platform,
            sourceText,
          ),
        ]),
      ),
    ) as Partial<
      Record<
        Platform,
        Awaited<ReturnType<HistoryService['findRelevantExamples']>>
      >
    >;
    const generatedByPlatform = await this.draftGenerator.generateBatch({
      platforms,
      sourceText,
      referencesByPlatform,
      availableImageFileIds:
        mediaSelectionMode === 'AI_IMAGE_SELECTION'
          ? request.assets.flatMap((asset) =>
              asset.kind === 'IMAGE' && asset.telegramFileId
                ? [asset.telegramFileId]
                : [],
            )
          : [],
      mediaSelectionMode,
    });

    await Promise.all(
      platforms.map(async (platform) => {
        const references = referencesByPlatform[platform] ?? [];
        const generated = generatedByPlatform[platform];
        if (!generated)
          throw new Error(`Generator returned no ${platform} draft`);
        const validation = this.validationService.validateSegments(
          platform,
          generated.segments,
          sourceText,
        );
        await this.persistGeneratedDraft({
          publicationRequestId,
          platform,
          validation,
          content: generated.content,
          segments: generated.segments,
          generationContext: {
            generator: this.draftGenerator.constructor.name,
            referenceIds: references.map((reference) => reference.id),
            selectedImageFileIds: generated.selectedImageFileIds,
            selectionReason: generated.selectionReason,
            mediaSelectionMode,
          },
        });
      }),
    );
  }

  private async persistGeneratedDraft(input: {
    publicationRequestId: string;
    platform: Platform;
    validation: ReturnType<DraftValidationService['validateSegments']>;
    content: string;
    segments: string[];
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
          segments: {
            create: input.segments.map((content, index) => ({
              position: index + 1,
              content,
              characterCount: [...content].length,
            })),
          },
          validationResult:
            input.validation as unknown as Prisma.InputJsonValue,
          generationContext: input.generationContext,
        },
      });
    });
  }
}
