import { Injectable } from '@nestjs/common';
import { Platform } from '@prisma/client';
import {
  DraftGenerationInput,
  DraftGenerator,
  BatchDraftGenerationInput,
  GeneratedDraft,
} from './draft-generator.port';

@Injectable()
export class MockDraftGeneratorService implements DraftGenerator {
  generate(input: DraftGenerationInput): Promise<GeneratedDraft> {
    const segments =
      input.platform === Platform.FACEBOOK
        ? [input.sourceText.trim()]
        : this.splitIntoSegments(input.sourceText.trim());
    return Promise.resolve({
      content: segments.join('\n\n'),
      segments,
      selectedImageFileIds:
        input.mediaSelectionMode === 'AI_IMAGE_SELECTION'
          ? input.availableImageFileIds.slice(0, 1)
          : [],
      selectionReason:
        input.mediaSelectionMode === 'MANUAL_VIDEO_SELECTION'
          ? 'A video is present, so media selection requires human review.'
          : 'Mock selection: first available image.',
    });
  }

  async generateBatch(
    input: BatchDraftGenerationInput,
  ): Promise<Partial<Record<Platform, GeneratedDraft>>> {
    const generated = await Promise.all(
      input.platforms.map(async (platform) => [
        platform,
        await this.generate({
          platform,
          sourceText: input.sourceText,
          references: input.referencesByPlatform[platform] ?? [],
          availableImageFileIds: input.availableImageFileIds,
          mediaSelectionMode: input.mediaSelectionMode,
        }),
      ]),
    );
    return Object.fromEntries(generated) as Partial<
      Record<Platform, GeneratedDraft>
    >;
  }
  private splitIntoSegments(value: string, limit = 280): string[] {
    if ([...value].length <= limit) return [value];
    const words = value.split(/\s+/u).filter(Boolean);
    const segments: string[] = [];
    let segment = '';
    for (const word of words) {
      const candidate = segment ? `${segment} ${word}` : word;
      if ([...candidate].length <= limit) {
        segment = candidate;
        continue;
      }
      if (segment) segments.push(segment);
      segment = this.splitLongWord(word, limit, segments);
    }
    if (segment) segments.push(segment);
    return segments;
  }

  private splitLongWord(
    word: string,
    limit: number,
    segments: string[],
  ): string {
    const characters = [...word];
    while (characters.length > limit) {
      segments.push(characters.splice(0, limit).join(''));
    }
    return characters.join('');
  }
}
