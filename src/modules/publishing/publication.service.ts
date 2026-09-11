import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditEventType,
  DraftStatus,
  Platform,
  Prisma,
  PublicationStatus,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { SOCIAL_PUBLISHERS, SocialPublisher } from './social-publisher.port';

export interface PublicationAttemptResult {
  platform: Platform;
  status: PublicationStatus;
  url?: string;
  error?: string;
  simulated?: boolean;
}

@Injectable()
export class PublicationService {
  private readonly publisherByPlatform: Map<Platform, SocialPublisher>;
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SOCIAL_PUBLISHERS) publishers: SocialPublisher[],
  ) {
    this.publisherByPlatform = new Map(
      publishers.map((publisher) => [publisher.platform, publisher]),
    );
  }

  async publishApproved(
    publicationRequestId: string,
    platform: Platform,
  ): Promise<PublicationAttemptResult> {
    const draft = await this.prisma.draft.findFirst({
      where: { publicationRequestId, platform, status: DraftStatus.APPROVED },
      include: { publicationRequest: { select: { organizationId: true } } },
      orderBy: { version: 'desc' },
    });
    if (!draft)
      throw new NotFoundException('No approved draft found for publication');
    const idempotencyKey = this.createIdempotencyKey(
      publicationRequestId,
      platform,
      draft.id,
    );
    const publication = await this.getOrCreatePublication({
      publicationRequestId,
      draftId: draft.id,
      platform,
      idempotencyKey,
    });
    if (publication.status === PublicationStatus.PUBLISHED)
      return {
        platform,
        status: publication.status,
        url: publication.externalUrl ?? undefined,
      };
    const claimed = await this.prisma.publication.updateMany({
      where: {
        id: publication.id,
        status: { in: [PublicationStatus.PENDING, PublicationStatus.FAILED] },
      },
      data: { status: PublicationStatus.PUBLISHING, errorMessage: null },
    });
    if (claimed.count === 0)
      return {
        platform,
        status: publication.status,
        error: publication.errorMessage ?? undefined,
      };
    await this.audit(
      draft.publicationRequest.organizationId,
      publicationRequestId,
      AuditEventType.PUBLICATION_ATTEMPTED,
      { platform, publicationId: publication.id },
    );
    try {
      const publisher = this.publisherByPlatform.get(platform);
      if (!publisher)
        throw new Error(`No publisher configured for ${platform}`);
      const result = await publisher.publish({
        platform,
        content: draft.content,
        idempotencyKey: publication.idempotencyKey,
      });
      await this.prisma.publication.update({
        where: { id: publication.id },
        data: {
          status: PublicationStatus.PUBLISHED,
          externalPostId: result.externalPostId,
          externalUrl: result.externalUrl,
          publishedAt: new Date(),
        },
      });
      await this.audit(
        draft.publicationRequest.organizationId,
        publicationRequestId,
        AuditEventType.PUBLICATION_COMPLETED,
        {
          platform,
          publicationId: publication.id,
          externalPostId: result.externalPostId,
        },
      );
      return {
        platform,
        status: PublicationStatus.PUBLISHED,
        url: result.externalUrl,
        simulated: result.simulated,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown publication error';
      await this.prisma.publication.update({
        where: { id: publication.id },
        data: { status: PublicationStatus.FAILED, errorMessage: message },
      });
      await this.audit(
        draft.publicationRequest.organizationId,
        publicationRequestId,
        AuditEventType.PUBLICATION_FAILED,
        { platform, publicationId: publication.id, error: message },
      );
      return { platform, status: PublicationStatus.FAILED, error: message };
    }
  }

  private createIdempotencyKey(
    requestId: string,
    platform: Platform,
    draftId: string,
  ): string {
    return createHash('sha256')
      .update(`${requestId}:${platform}:${draftId}`)
      .digest('hex');
  }

  private async getOrCreatePublication(input: {
    publicationRequestId: string;
    draftId: string;
    platform: Platform;
    idempotencyKey: string;
  }) {
    const existing = await this.prisma.publication.findFirst({
      where: { draftId: input.draftId },
    });
    if (existing) return existing;
    try {
      return await this.prisma.publication.create({ data: input });
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) throw error;
      return this.prisma.publication.findFirstOrThrow({
        where: { draftId: input.draftId },
      });
    }
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private audit(
    organizationId: string,
    publicationRequestId: string,
    type: AuditEventType,
    payload: object,
  ): Promise<unknown> {
    return this.prisma.auditEvent.create({
      data: { organizationId, publicationRequestId, type, payload },
    });
  }
}
