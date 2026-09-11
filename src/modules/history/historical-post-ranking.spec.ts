import { Platform } from '@prisma/client';
import { rankHistoricalPosts } from './historical-post-ranking';

describe('rankHistoricalPosts', () => {
  it('returns only relevant references in descending similarity order', () => {
    const result = rankHistoricalPosts(
      'cultural center opening',
      [
        {
          id: 'b',
          platform: Platform.FACEBOOK,
          text: 'sports activities agenda',
        },
        {
          id: 'a',
          platform: Platform.FACEBOOK,
          text: 'opening of the cultural center',
        },
      ],
      3,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'a', platform: Platform.FACEBOOK });
    expect(result[0]?.score).toBeGreaterThan(0);
  });
});
