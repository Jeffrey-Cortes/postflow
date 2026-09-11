import { Module } from '@nestjs/common';
import { GenerationModule } from '../generation/generation.module';
import { ValidationModule } from '../validation/validation.module';
import { PublishingModule } from '../publishing/publishing.module';
import { ReviewPresentationService } from './review-presentation.service';
import { ReviewService } from './review.service';
@Module({
  imports: [GenerationModule, ValidationModule, PublishingModule],
  providers: [ReviewService, ReviewPresentationService],
  exports: [ReviewService, ReviewPresentationService],
})
export class ReviewModule {}
