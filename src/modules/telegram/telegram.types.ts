export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramCallbackQuery {
  id: string;
  data?: string;
  from: { id: number | string };
  message?: { chat: { id: number | string } };
}

export interface TelegramMessage {
  message_id: number;
  date: number;
  media_group_id?: string;
  text?: string;
  caption?: string;
  chat: { id: number | string };
  from?: { id: number | string; first_name?: string; last_name?: string };
  photo?: TelegramPhoto[];
  document?: TelegramDocument;
}

export interface TelegramPhoto {
  file_id: string;
  file_size?: number;
  width: number;
  height: number;
}
export interface TelegramDocument {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface NormalizedTelegramMessage {
  updateId: string;
  messageId: string;
  chatId: string;
  senderId: string;
  mediaGroupId?: string;
  text?: string;
  caption?: string;
  receivedAt: Date;
  assets: Array<{
    kind: 'IMAGE' | 'DOCUMENT';
    telegramFileId: string;
    originalFilename?: string;
    mimeType?: string;
    sizeBytes?: number;
  }>;
}
