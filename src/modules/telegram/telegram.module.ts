import { Module } from '@nestjs/common';
import { ReviewModule } from '../review/review.module';
import { GenerationModule } from '../generation/generation.module';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramIngestionService } from './telegram-ingestion.service';
import { TelegramBotApiService } from './telegram-bot-api.service';

@Module({
  imports: [ReviewModule, GenerationModule],
  controllers: [TelegramWebhookController],
  providers: [TelegramIngestionService, TelegramBotApiService],
})
export class TelegramModule {}
