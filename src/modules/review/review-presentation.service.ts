import { Injectable, NotFoundException } from '@nestjs/common';
import { DraftStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface ReviewMedia {
  kind: 'IMAGE' | 'VIDEO';
  telegramFileId: string;
}

@Injectable()
export class ReviewPresentationService {
  constructor(private readonly prisma: PrismaService) {}
  async create(
    publicationRequestId: string,
  ): Promise<{ text: string; buttons: string[][]; media: ReviewMedia[] }> {
    const request = await this.prisma.publicationRequest.findUnique({
      where: { id: publicationRequestId },
      include: {
        drafts: {
          where: { status: DraftStatus.PROPOSED },
          orderBy: [{ platform: 'asc' }, { version: 'desc' }],
          include: { segments: { orderBy: { position: 'asc' } } },
        },
        assets: {
          where: {
            kind: { in: ['IMAGE', 'VIDEO'] },
            telegramFileId: { not: null },
          },
          select: { kind: true, telegramFileId: true },
        },
      },
    });
    if (!request) throw new NotFoundException('Publication request not found');
    const drafts = new Map(
      request.drafts.map((draft) => [draft.platform, draft]),
    );
    const manualMediaSelection = request.assets.some(
      (asset) => asset.kind === 'VIDEO',
    );
    const selectedImageIds = new Set(
      request.drafts.flatMap((draft) =>
        selectedImageFileIds(draft.generationContext),
      ),
    );
    const media = request.assets.flatMap((asset) => {
      if (!asset.telegramFileId) return [];
      if (manualMediaSelection || selectedImageIds.has(asset.telegramFileId)) {
        return [
          {
            kind: asset.kind,
            telegramFileId: asset.telegramFileId,
          } as ReviewMedia,
        ];
      }
      return [];
    });
    const text = [
      'Nueva publicación',
      '',
      'Material recibido:',
      request.sourceSummary ?? '(sin texto)',
      '',
      'FACEBOOK:',
      this.renderDraft(drafts.get('FACEBOOK')),
      '',
      'X:',
      this.renderDraft(drafts.get('X')),
      '',
      manualMediaSelection
        ? 'Se detectó video. Selecciona manualmente el material antes de publicar.'
        : media.length > 0
          ? 'La IA seleccionó el material que se enviará a continuación.'
          : 'No hay material visual seleccionado.',
    ].join('\n');
    const buttons = [
      ...this.buttonsFor('F', publicationRequestId, drafts.get('FACEBOOK')),
      ...this.buttonsFor('X', publicationRequestId, drafts.get('X')),
    ];
    return { text, buttons: [buttons], media };
  }

  private buttonsFor(
    platform: 'F' | 'X',
    publicationRequestId: string,
    draft: { id: string } | undefined,
  ): string[] {
    if (!draft) return [];
    return ['A', 'E', 'G', 'R'].map(
      (action) => `r|${action}|${platform}|${publicationRequestId}|${draft.id}`,
    );
  }

  private renderDraft(
    draft:
      | {
          content: string;
          segments?: Array<{ content: string; characterCount: number }>;
        }
      | undefined,
  ): string {
    if (!draft) return '(sin borrador)';
    const segments = draft.segments ?? [];
    if (segments.length <= 1) return segments[0]?.content ?? draft.content;
    return [
      `Hilo de ${segments.length} partes:`,
      ...segments.flatMap((segment, index) => [
        '',
        `${index + 1}/${segments.length} (${segment.characterCount}/280)`,
        segment.content,
      ]),
    ].join('\n');
  }
}

function selectedImageFileIds(context: unknown): string[] {
  if (!context || typeof context !== 'object') return [];
  const value = (context as { selectedImageFileIds?: unknown })
    .selectedImageFileIds;
  return Array.isArray(value)
    ? value.filter((fileId): fileId is string => typeof fileId === 'string')
    : [];
}
