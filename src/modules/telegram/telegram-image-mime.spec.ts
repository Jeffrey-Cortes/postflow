import { resolveImageMimeType } from './telegram-image-mime';

describe('resolveImageMimeType', () => {
  it('detects JPEG bytes when Telegram returns a generic MIME type', () => {
    expect(
      resolveImageMimeType(
        new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
        'application/octet-stream',
      ),
    ).toBe('image/jpeg');
  });

  it('does not classify unknown bytes as an image', () => {
    expect(
      resolveImageMimeType(
        new Uint8Array([0x01, 0x02, 0x03]),
        'application/octet-stream',
      ),
    ).toBeUndefined();
  });
});
