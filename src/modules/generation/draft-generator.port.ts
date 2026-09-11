import { Platform } from '@prisma/client';
import { HistoricalPostReference } from '../history/historical-post.types';

export const DRAFT_GENERATOR = Symbol('DRAFT_GENERATOR');

export interface DraftGenerationInput {
  platform: Platform;
  sourceText: string;
  references: HistoricalPostReference[];
}

export interface DraftGenerator {
  generate(input: DraftGenerationInput): Promise<string>;
}
