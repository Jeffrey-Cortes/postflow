import {
  DraftStatus,
  Platform,
  PublicationStatus,
  RequestStatus,
} from '@prisma/client';
import { ReviewService } from './review.service';

describe('ReviewService', () => {
  const publicationRequestId = 'request-1';
  const userId = 'user-1';

  function createService(request: unknown, publicationResult?: unknown) {
    const prisma = {
      draft: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'draft-1', status: DraftStatus.PROPOSED }),
        update: jest.fn(),
      },
      approval: { create: jest.fn() },
      publicationRequest: {
        findUnique: jest.fn().mockResolvedValue(request),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const publicationService = {
      publishApproved: jest.fn().mockResolvedValue(
        publicationResult ?? {
          status: PublicationStatus.PUBLISHED,
          url: 'https://mock.facebook.local/posts/1',
          simulated: true,
        },
      ),
    };
    return {
      prisma,
      publicationService,
      service: new ReviewService(
        prisma as never,
        {} as never,
        {} as never,
        publicationService as never,
      ),
    };
  }

  it('marks a request as rejected when every draft is rejected', async () => {
    const { service, prisma } = createService({
      drafts: [
        { id: 'draft-1', status: DraftStatus.REJECTED },
        { id: 'draft-2', status: DraftStatus.REJECTED },
      ],
      publications: [],
    });

    await expect(
      service.applyCallback(userId, {
        action: 'REJECT',
        platform: Platform.FACEBOOK,
        publicationRequestId,
        draftId: 'draft-1',
      }),
    ).resolves.toBe('FACEBOOK rechazado.');

    expect(prisma.publicationRequest.update).toHaveBeenCalledWith({
      where: { id: publicationRequestId },
      data: { status: RequestStatus.REJECTED },
    });
  });

  it('marks a request as completed after every approved draft is published', async () => {
    const { service, prisma, publicationService } = createService({
      drafts: [
        { id: 'draft-1', status: DraftStatus.APPROVED },
        { id: 'draft-2', status: DraftStatus.REJECTED },
      ],
      publications: [
        { draftId: 'draft-1', status: PublicationStatus.PUBLISHED },
      ],
    });

    await expect(
      service.applyCallback(userId, {
        action: 'APPROVE',
        platform: Platform.FACEBOOK,
        publicationRequestId,
        draftId: 'draft-1',
      }),
    ).resolves.toContain('FACEBOOK publicaci\u00f3n simulada:');

    expect(publicationService.publishApproved).toHaveBeenCalledWith(
      publicationRequestId,
      Platform.FACEBOOK,
    );
    expect(prisma.publicationRequest.update).toHaveBeenCalledWith({
      where: { id: publicationRequestId },
      data: { status: RequestStatus.COMPLETED },
    });
  });
});
