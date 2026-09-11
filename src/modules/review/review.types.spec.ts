import { Platform } from '@prisma/client';
import { parseReviewCallback } from './review.types';

describe('parseReviewCallback', () => {
  it('accepts only complete, platform-specific review actions', () => {
    expect(parseReviewCallback('r|A|F|request-1|draft-1')).toEqual({
      action: 'APPROVE',
      platform: Platform.FACEBOOK,
      publicationRequestId: 'request-1',
      draftId: 'draft-1',
    });
    expect(parseReviewCallback('r|P|F|request-1|draft-1')).toBeNull();
  });
});
