import { Platform } from '@prisma/client';
import { MockDraftGeneratorService } from './mock-draft-generator.service';

describe('MockDraftGeneratorService', () => {
  it('splits long X content into segments within its configured limit', async () => {
    const service = new MockDraftGeneratorService();
    const result = await service.generate({
      platform: Platform.X,
      sourceText: 'evento '.repeat(100),
      references: [],
      availableImageFileIds: [],
      mediaSelectionMode: 'AI_IMAGE_SELECTION',
    });
    expect(result.segments).toHaveLength(3);
    expect(result.segments.every((segment) => [...segment].length <= 280)).toBe(
      true,
    );
    expect(result.content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()).toBe(
      'evento '.repeat(100).trim(),
    );
  });

  it('generates both platforms together from shared source material', async () => {
    const service = new MockDraftGeneratorService();
    const drafts = await service.generateBatch({
      platforms: [Platform.FACEBOOK, Platform.X],
      sourceText: 'Evento institucional',
      referencesByPlatform: { FACEBOOK: [], X: [] },
      availableImageFileIds: [],
      mediaSelectionMode: 'AI_IMAGE_SELECTION',
    });

    expect(drafts.FACEBOOK?.content).toBe('Evento institucional');
    expect(drafts.X?.segments).toEqual(['Evento institucional']);
  });
});
