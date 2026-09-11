import { Module } from '@nestjs/common';
import { HistoryModule } from '../history/history.module';
import { ValidationModule } from '../validation/validation.module';
import { DraftGenerationService } from './draft-generation.service';
import { DRAFT_GENERATOR } from './draft-generator.port';
import { MockDraftGeneratorService } from './mock-draft-generator.service';

@Module({
  imports: [HistoryModule, ValidationModule],
  providers: [
    DraftGenerationService,
    MockDraftGeneratorService,
    { provide: DRAFT_GENERATOR, useExisting: MockDraftGeneratorService },
  ],
  exports: [DraftGenerationService],
})
export class GenerationModule {}
