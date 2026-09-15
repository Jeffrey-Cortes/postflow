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

  it('validates every part of an X thread independently', () => {
    const result = service.validateSegments(
      Platform.X,
      ['evento ' + 'a'.repeat(274), 'segunda parte'],
      'evento',
    );

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Parte 1: El borrador excede el límite de 280 caracteres de X.',
    );
    expect(result.segmentCharacterCounts).toEqual([281, 13]);
  });
});
