import { Injectable } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { DraftGenerationInput, DraftGenerator } from './draft-generator.port';

@Injectable()
export class MockDraftGeneratorService implements DraftGenerator {
  generate(input: DraftGenerationInput): Promise<string> {
    const source = input.sourceText.trim();
    const hashtag = input.references.some((reference) =>
      reference.text.includes('#'),
    )
      ? ' #Postflow'
      : '';
    const content =
      input.platform === Platform.FACEBOOK
        ? `${source}${hashtag}`
        : this.truncate(`${source}${hashtag}`, 280);
    return Promise.resolve(content);
  }

  private truncate(value: string, limit: number): string {
    if ([...value].length <= limit) return value;
    return `${[...value].slice(0, limit - 3).join('')}...`;
  }
}
