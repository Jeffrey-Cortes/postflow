import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TelegramInlineButton {
  text: string;
  callback_data: string;
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

  async answerCallback(callbackId: string, text: string): Promise<void> {
    await this.call('answerCallbackQuery', {
      callback_query_id: callbackId,
      text,
    });
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
  const [, action, platform] = callback.split('|');
  const labels: Record<string, string> = {
    APPROVE: 'Aprobar',
    EDIT: 'Editar',
    REGENERATE: 'Regenerar',
    REJECT: 'Rechazar',
  };
  return `${labels[action] ?? action} ${platform}`;
}
