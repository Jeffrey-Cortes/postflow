import { Platform } from '@prisma/client';
import { MockDraftGeneratorService } from './mock-draft-generator.service';

describe('MockDraftGeneratorService', () => {
  it('keeps X content within its configured limit', async () => {
    const service = new MockDraftGeneratorService();
    const result = await service.generate({
      platform: Platform.X,
      sourceText: 'evento '.repeat(100),
      references: [],
      availableImageFileIds: [],
    });
    expect([...result.content]).toHaveLength(280);
  });
});
