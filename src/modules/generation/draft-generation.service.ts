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
        const latest = await this.prisma.draft.findFirst({
          where: { publicationRequestId, platform },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        await this.prisma.draft.create({
          data: {
            publicationRequestId,
            platform,
            version: (latest?.version ?? 0) + 1,
            status: validation.isValid
              ? DraftStatus.PROPOSED
              : DraftStatus.REJECTED,
            content: generated.content,
            validationResult: validation as unknown as Prisma.InputJsonValue,
            generationContext: {
              generator: 'mock',
              referenceIds: references.map((reference) => reference.id),
              selectedImageFileIds: generated.selectedImageFileIds,
              selectionReason: generated.selectionReason,
            },
          },
        });
      }),
    );
    await this.prisma.publicationRequest.update({
      where: { id: publicationRequestId },
      data: { status: RequestStatus.PENDING_REVIEW },
    });
  }
}
