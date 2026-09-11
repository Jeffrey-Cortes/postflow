import { Injectable } from '@nestjs/common';
import { Platform } from '@prisma/client';
import {
  DraftGenerationInput,
  DraftGenerator,
  GeneratedDraft,
} from './draft-generator.port';

@Injectable()
export class MockDraftGeneratorService implements DraftGenerator {
  generate(input: DraftGenerationInput): Promise<GeneratedDraft> {
    const content =
      input.platform === Platform.FACEBOOK
        ? input.sourceText.trim()
        : this.truncate(input.sourceText.trim(), 280);
    return Promise.resolve({
      content,
      selectedImageFileIds: input.availableImageFileIds.slice(0, 1),
      selectionReason: 'Mock selection: first available image.',
    });
  }
  private truncate(value: string, limit: number): string {
    return [...value].length <= limit
      ? value
      : `${[...value].slice(0, limit - 3).join('')}...`;
  }
}
