import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ReviewMedia } from '../review/review-presentation.service';

export interface TelegramInlineButton {
  text: string;
  callback_data: string;
}

export interface DownloadedTelegramFile {
  body: Uint8Array;
  contentType?: string;
}

@Injectable()
export class TelegramBotApiService {
  private readonly logger = new Logger(TelegramBotApiService.name);
  constructor(private readonly configService: ConfigService) {}

  async sendProposal(
    chatId: string,
    text: string,
    callbacks: string[][],
  ): Promise<void> {
    const inlineKeyboard = callbacks.map((row) =>
      row.map((callback) => ({
        text: labelFor(callback),
        callback_data: callback,
      })),
    );
    await this.call('sendMessage', {
      chat_id: chatId,
      text,
      reply_markup: { inline_keyboard: inlineKeyboard },
    });
  }

  async sendText(chatId: string, text: string): Promise<void> {
    await this.call('sendMessage', { chat_id: chatId, text });
  }

  async sendMedia(chatId: string, media: ReviewMedia): Promise<void> {
    await this.call(media.kind === 'VIDEO' ? 'sendVideo' : 'sendPhoto', {
      chat_id: chatId,
      [media.kind === 'VIDEO' ? 'video' : 'photo']: media.telegramFileId,
    });
  }

  async answerCallback(callbackId: string, text: string): Promise<void> {
    await this.call('answerCallbackQuery', {
      callback_query_id: callbackId,
      text,
    });
  }

  async downloadFile(
    fileId: string,
    maxBytes: number,
  ): Promise<DownloadedTelegramFile> {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token)
      throw new Error('TELEGRAM_BOT_TOKEN is required to download files');
    const metadataResponse = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    const metadata = (await metadataResponse.json()) as {
      ok?: boolean;
      result?: { file_path?: string };
    };
    if (!metadata.ok || !metadata.result?.file_path)
      throw new Error('Telegram did not provide a file path');
    const fileResponse = await fetch(
      `https://api.telegram.org/file/bot${token}/${metadata.result.file_path}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    if (!fileResponse.ok)
      throw new Error(
        `Telegram file download failed with HTTP ${fileResponse.status}`,
      );
    const contentLength = Number(fileResponse.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new Error(`Telegram file exceeds the ${maxBytes}-byte limit`);
    }
    const body = new Uint8Array(await fileResponse.arrayBuffer());
    if (body.byteLength > maxBytes) {
      throw new Error(`Telegram file exceeds the ${maxBytes}-byte limit`);
    }
    return {
      body,
      contentType: fileResponse.headers.get('content-type') ?? undefined,
    };
  }

  private async call(method: string, body: object): Promise<void> {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.log(`Mock Telegram ${method}: ${JSON.stringify(body)}`);
      return;
    }
    const response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok)
      throw new Error(`Telegram ${method} failed with HTTP ${response.status}`);
  }
}

function labelFor(callback: string): string {
  const [, actionCode, platformCode] = callback.split('|');
  const actionMap = {
    A: 'APPROVE',
    E: 'EDIT',
    G: 'REGENERATE',
    R: 'REJECT',
  } as const;
  const action = actionMap[actionCode as keyof typeof actionMap];
  const platform = ({ F: 'FACEBOOK', X: 'X' } as const)[
    platformCode as 'F' | 'X'
  ];
  const labels: Record<string, string> = {
    APPROVE: 'Aprobar',
    EDIT: 'Editar',
    REGENERATE: 'Regenerar',
    REJECT: 'Rechazar',
  };
  return `${labels[action] ?? actionCode} ${platform ?? platformCode}`;
}
