import { Injectable } from '@nestjs/common';
import { Platform } from '@prisma/client';

export interface DraftValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  characterCount: number;
}

export interface DraftSegmentsValidationResult extends DraftValidationResult {
  segmentCharacterCounts: number[];
}

@Injectable()
export class DraftValidationService {
  validate(
    platform: Platform,
    content: string,
    sourceText: string,
  ): DraftValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const characterCount = [...content].length;
    if (!content.trim()) errors.push('El borrador no puede estar vacío.');
    if (platform === Platform.X && characterCount > 280)
      errors.push('El borrador excede el límite de 280 caracteres de X.');
    if (sourceText.trim() && !this.containsSourceFragment(content, sourceText))
      warnings.push(
        'El borrador no conserva texto identificable del material fuente; requiere revisión humana.',
      );
    return { isValid: errors.length === 0, errors, warnings, characterCount };
  }

  validateSegments(
    platform: Platform,
    segments: string[],
    sourceText: string,
  ): DraftSegmentsValidationResult {
    const normalized = segments.map((segment) => segment.trim());
    const errors: string[] = [];
    if (normalized.length === 0)
      errors.push('El borrador no puede estar vacío.');
    if (platform === Platform.FACEBOOK && normalized.length !== 1)
      errors.push('Facebook debe contener un único texto.');
    if (platform === Platform.X && normalized.length > 5)
      errors.push('Un hilo de X no puede exceder cinco publicaciones.');
    const segmentCharacterCounts = normalized.map((segment, index) => {
      const result = this.validate(platform, segment, '');
      errors.push(
        ...result.errors.map((error) => `Parte ${index + 1}: ${error}`),
      );
      return result.characterCount;
    });
    const fullContent = normalized.join('\n\n');
    const warnings =
      sourceText.trim() && !this.containsSourceFragment(fullContent, sourceText)
        ? [
            'El borrador no conserva texto identificable del material fuente; requiere revisión humana.',
          ]
        : [];
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      characterCount: [...fullContent].length,
      segmentCharacterCounts,
    };
  }

  private containsSourceFragment(content: string, source: string): boolean {
    const sourceWords =
      source.toLocaleLowerCase('es-MX').match(/[\p{L}\p{N}]{5,}/gu) ?? [];
    const normalizedContent = content.toLocaleLowerCase('es-MX');
    return sourceWords.some((word) => normalizedContent.includes(word));
  }
}
