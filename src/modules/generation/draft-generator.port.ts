import { Platform } from '@prisma/client';
import { HistoricalPostReference } from '../history/historical-post.types';

export const DRAFT_GENERATOR = Symbol('DRAFT_GENERATOR');

export interface DraftGenerationInput {
  platform: Platform;
  sourceText: string;
  references: HistoricalPostReference[];
  availableImageFileIds: string[];
  mediaSelectionMode: 'AI_IMAGE_SELECTION' | 'MANUAL_VIDEO_SELECTION';
}

export interface BatchDraftGenerationInput {
  platforms: Platform[];
  sourceText: string;
  referencesByPlatform: Partial<Record<Platform, HistoricalPostReference[]>>;
  availableImageFileIds: string[];
  mediaSelectionMode: 'AI_IMAGE_SELECTION' | 'MANUAL_VIDEO_SELECTION';
}

export interface GeneratedDraft {
  content: string;
  segments: string[];
  selectedImageFileIds: string[];
  selectionReason: string;
}

export interface DraftGenerator {
  generate(input: DraftGenerationInput): Promise<GeneratedDraft>;
  generateBatch(
    input: BatchDraftGenerationInput,
  ): Promise<Partial<Record<Platform, GeneratedDraft>>>;
}
