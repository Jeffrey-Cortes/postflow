import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './modules/config/environment.validation';
import { PrismaModule } from './modules/database/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { HistoryModule } from './modules/history/history.module';
import { GenerationModule } from './modules/generation/generation.module';
import { ValidationModule } from './modules/validation/validation.module';
import { ReviewModule } from './modules/review/review.module';
import { PublishingModule } from './modules/publishing/publishing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    HealthModule,
    TelegramModule,
    HistoryModule,
    GenerationModule,
    ValidationModule,
    ReviewModule,
    PublishingModule,
  ],
})
export class AppModule {}
