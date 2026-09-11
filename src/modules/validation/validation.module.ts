import { Module } from '@nestjs/common';
import { DraftValidationService } from './draft-validation.service';
@Module({
  providers: [DraftValidationService],
  exports: [DraftValidationService],
})
export class ValidationModule {}
