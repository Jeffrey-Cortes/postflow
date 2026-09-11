import { Module } from '@nestjs/common';
import { ReviewModule } from '../review/review.module';
import { GenerationModule } from '../generation/generation.module';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { TelegramIngestionService } from './telegram-ingestion.service';
import { TelegramBotApiService } from './telegram-bot-api.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [ReviewModule, GenerationModule, StorageModule],
  controllers: [TelegramWebhookController],
  providers: [TelegramIngestionService, TelegramBotApiService],
})
export class TelegramModule {}
