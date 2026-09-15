import { Platform } from '@prisma/client';
import { ReviewPresentationService } from './review-presentation.service';

describe('ReviewPresentationService', () => {
  it('binds every callback to the presented draft using Telegram-safe payloads', async () => {
    const requestId = 'c'.repeat(25);
    const draftId = 'd'.repeat(25);
    const prisma = {
      publicationRequest: {
        findUnique: jest.fn().mockResolvedValue({
          sourceSummary: 'Material',
          drafts: [
            {
              id: draftId,
              platform: Platform.FACEBOOK,
              content: 'Texto',
            },
          ],
          assets: [],
        }),
      },
    };
    const presentation = await new ReviewPresentationService(
      prisma as never,
    ).create(requestId);

    expect(presentation.buttons[0]).toHaveLength(4);
    expect(presentation.buttons[0]).toContain(`r|A|F|${requestId}|${draftId}`);
    expect(
      presentation.buttons[0].every(
        (button) => Buffer.byteLength(button) <= 64,
      ),
    ).toBe(true);
  });
});
