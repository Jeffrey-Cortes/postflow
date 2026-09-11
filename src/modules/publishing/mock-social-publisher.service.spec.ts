import { Platform } from '@prisma/client';
import { MockFacebookPublisher } from './mock-social-publisher.service';

describe('MockFacebookPublisher', () => {
  it('returns the same external reference for the same idempotency key', async () => {
    const publisher = new MockFacebookPublisher();
    const input = {
      platform: Platform.FACEBOOK,
      content: 'contenido',
      idempotencyKey: 'stable-key',
    };
    await expect(publisher.publish(input)).resolves.toEqual(
      await publisher.publish(input),
    );
  });
});
