import { Platform } from '@prisma/client';
import { parseReviewCallback } from './review.types';

describe('parseReviewCallback', () => {
  it('accepts only complete, platform-specific review actions', () => {
    expect(parseReviewCallback('review|APPROVE|FACEBOOK|request-1')).toEqual({
      action: 'APPROVE',
      platform: Platform.FACEBOOK,
      publicationRequestId: 'request-1',
    });
    expect(parseReviewCallback('review|PUBLISH|FACEBOOK|request-1')).toBeNull();
  });
});
