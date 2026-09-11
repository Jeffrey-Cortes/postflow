import { Body, Controller, Headers, Post } from '@nestjs/common';
import { TelegramIngestionService } from './telegram-ingestion.service';
import type { TelegramUpdate } from './telegram.types';

@Controller('webhooks/telegram')
export class TelegramWebhookController {
  constructor(
    private readonly telegramIngestionService: TelegramIngestionService,
  ) {}
  @Post()
  receive(
    @Body() update: TelegramUpdate,
    @Headers('x-telegram-bot-api-secret-token') secret?: string,
  ) {
    return this.telegramIngestionService.receive(update, secret);
  }
}
