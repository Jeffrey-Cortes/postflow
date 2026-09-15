import { NormalizedTelegramMessage, TelegramUpdate } from './telegram.types';

export function normalizeTelegramUpdate(
  update: TelegramUpdate,
): NormalizedTelegramMessage | null {
  const message = update.message;
  if (
    !message?.from ||
    !message.chat ||
    !Number.isInteger(update.update_id) ||
    !Number.isInteger(message.message_id)
  )
    return null;
  const assets: NormalizedTelegramMessage['assets'] = [];
  const largestPhoto = message.photo?.at(-1);
  if (largestPhoto)
    assets.push({
      kind: 'IMAGE',
      telegramFileId: largestPhoto.file_id,
      sizeBytes: largestPhoto.file_size,
    });
  if (message.video)
    assets.push({
      kind: 'VIDEO',
      telegramFileId: message.video.file_id,
      originalFilename: message.video.file_name,
      mimeType: message.video.mime_type,
      sizeBytes: message.video.file_size,
    });
  if (message.document)
    assets.push({
      kind: message.document.mime_type?.toLowerCase().startsWith('video/')
        ? 'VIDEO'
        : 'DOCUMENT',
      telegramFileId: message.document.file_id,
      originalFilename: message.document.file_name,
      mimeType: message.document.mime_type,
      sizeBytes: message.document.file_size,
    });
  if (!message.text && !message.caption && assets.length === 0) return null;
  return {
    updateId: String(update.update_id),
    messageId: String(message.message_id),
    chatId: String(message.chat.id),
    senderId: String(message.from.id),
    mediaGroupId: message.media_group_id,
    text: message.text,
    caption: message.caption,
    receivedAt: new Date(message.date * 1000),
    assets,
  };
}
