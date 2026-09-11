import { Injectable } from '@nestjs/common';
import { Platform } from '@prisma/client';

export interface DraftValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  characterCount: number;
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

  private containsSourceFragment(content: string, source: string): boolean {
    const sourceWords =
      source.toLocaleLowerCase('es-MX').match(/[\p{L}\p{N}]{5,}/gu) ?? [];
    const normalizedContent = content.toLocaleLowerCase('es-MX');
    return sourceWords.some((word) => normalizedContent.includes(word));
  }
}
