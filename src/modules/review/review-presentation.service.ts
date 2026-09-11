import { Injectable, NotFoundException } from '@nestjs/common';
import { DraftStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReviewPresentationService {
  constructor(private readonly prisma: PrismaService) {}
  async create(
    publicationRequestId: string,
  ): Promise<{ text: string; buttons: string[][] }> {
    const request = await this.prisma.publicationRequest.findUnique({
      where: { id: publicationRequestId },
      include: {
        drafts: {
          where: { status: DraftStatus.PROPOSED },
          orderBy: [{ platform: 'asc' }, { version: 'desc' }],
        },
      },
    });
    if (!request) throw new NotFoundException('Publication request not found');
    const drafts = new Map(
      request.drafts.map((draft) => [draft.platform, draft]),
    );
    const text = [
      'Nueva publicación',
      '',
      'Material recibido:',
      request.sourceSummary ?? '(sin texto)',
      '',
      'FACEBOOK:',
      drafts.get('FACEBOOK')?.content ?? '(sin borrador)',
      '',
      'X:',
      drafts.get('X')?.content ?? '(sin borrador)',
    ].join('\n');
    const buttons = [
      ...this.buttonsFor('F', publicationRequestId, drafts.get('FACEBOOK')),
      ...this.buttonsFor('X', publicationRequestId, drafts.get('X')),
    ];
    return { text, buttons: [buttons] };
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
}
