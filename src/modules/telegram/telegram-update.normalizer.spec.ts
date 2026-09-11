import { normalizeTelegramUpdate } from './telegram-update.normalizer';

describe('normalizeTelegramUpdate', () => {
  it('normalizes the largest photo and caption from an album message', () => {
    const result = normalizeTelegramUpdate({
      update_id: 10,
      message: {
        message_id: 11,
        date: 1_700_000_000,
        media_group_id: 'album-1',
        caption: 'Evento institucional',
        chat: { id: -1001 },
        from: { id: 55 },
        photo: [
          { file_id: 'small', width: 90, height: 90 },
          { file_id: 'large', file_size: 1200, width: 1280, height: 720 },
        ],
      },
    });
    expect(result).toMatchObject({
      updateId: '10',
      messageId: '11',
      chatId: '-1001',
      senderId: '55',
      mediaGroupId: 'album-1',
      caption: 'Evento institucional',
      assets: [{ kind: 'IMAGE', telegramFileId: 'large', sizeBytes: 1200 }],
    });
  });

  it('ignores updates without supported content or sender data', () => {
    expect(
      normalizeTelegramUpdate({
        update_id: 1,
        message: { message_id: 2, date: 1, chat: { id: 3 } },
      }),
    ).toBeNull();
  });
});
