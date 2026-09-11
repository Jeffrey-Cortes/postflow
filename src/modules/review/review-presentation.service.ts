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
    const buttons = ['FACEBOOK', 'X'].flatMap((platform) =>
      ['APPROVE', 'EDIT', 'REGENERATE', 'REJECT'].map(
        (action) => `review|${action}|${platform}|${publicationRequestId}`,
      ),
    );
    return { text, buttons: [buttons] };
  }
}
