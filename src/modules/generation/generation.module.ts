import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HistoryModule } from '../history/history.module';
import { ValidationModule } from '../validation/validation.module';
import { DraftGenerationService } from './draft-generation.service';
import { DRAFT_GENERATOR } from './draft-generator.port';
import { MockDraftGeneratorService } from './mock-draft-generator.service';
import { OpenAiDraftGeneratorService } from './openai-draft-generator.service';

@Module({
  imports: [HistoryModule, ValidationModule],
  providers: [
    DraftGenerationService,
    MockDraftGeneratorService,
    OpenAiDraftGeneratorService,
    {
      provide: DRAFT_GENERATOR,
      useFactory: (
        config: ConfigService,
        mock: MockDraftGeneratorService,
        openai: OpenAiDraftGeneratorService,
      ) => (config.get<string>('OPENAI_API_KEY') ? openai : mock),
      inject: [
        ConfigService,
        MockDraftGeneratorService,
        OpenAiDraftGeneratorService,
      ],
    },
  ],
  exports: [DraftGenerationService],
})
export class GenerationModule {}
