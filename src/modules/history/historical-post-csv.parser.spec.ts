import { Platform } from '@prisma/client';
import { parseHistoricalPostsCsv } from './historical-post-csv.parser';

describe('parseHistoricalPostsCsv', () => {
  it('parses quoted content and platform aliases', () => {
    const rows = parseHistoricalPostsCsv(
      'platform,text,externalId,imageUrls\nTwitter,"Evento, con información",x1,https://a.test/a.jpg|https://a.test/b.jpg',
    );
    expect(rows).toEqual([
      {
        platform: Platform.X,
        text: 'Evento, con información',
        externalId: 'x1',
        publishedAt: undefined,
        imageUrls: ['https://a.test/a.jpg', 'https://a.test/b.jpg'],
      },
    ]);
  });
});
