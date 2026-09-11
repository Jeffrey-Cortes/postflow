import { Platform } from '@prisma/client';
import { DraftValidationService } from './draft-validation.service';

describe('DraftValidationService', () => {
  const service = new DraftValidationService();
  it('rejects X drafts that exceed the character limit', () => {
    expect(
      service.validate(Platform.X, `evento ${'a'.repeat(280)}`, 'evento')
        .errors,
    ).toContain('El borrador excede el límite de 280 caracteres de X.');
  });
});
