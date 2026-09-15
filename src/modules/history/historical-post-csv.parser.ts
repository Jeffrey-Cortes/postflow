import { BadRequestException } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { HistoricalPostImportRow } from './historical-post.types';

export function parseHistoricalPostsCsv(
  csv: string,
): HistoricalPostImportRow[] {
  const records = parseCsv(csv);
  if (records.length < 2) return [];
  const headers = records[0].map((header) =>
    header
      .replace(/^\uFEFF/u, '')
      .trim()
      .toLowerCase(),
  );
  const platformIndex = headers.indexOf('platform');
  const textIndex = headers.indexOf('text');
  if (platformIndex < 0 || textIndex < 0)
    throw new BadRequestException('CSV must contain platform and text columns');
  return records
    .slice(1)
    .filter((record) => record.some((value) => value.trim()))
    .map((record, index) => {
      const platform = toPlatform(record[platformIndex]);
      const text = record[textIndex]?.trim();
      if (!text)
        throw new BadRequestException(`CSV row ${index + 2} has no text`);
      const publishedAt = valueAt(record, headers, 'publishedat');
      return {
        platform,
        text,
        externalId: valueAt(record, headers, 'externalid'),
        publishedAt: publishedAt
          ? parseDate(publishedAt, index + 2)
          : undefined,
        imageUrls: valueAt(record, headers, 'imageurls')
          ?.split('|')
          .map((url) => url.trim())
          .filter(Boolean),
      };
    });
}

function valueAt(
  record: string[],
  headers: string[],
  name: string,
): string | undefined {
  const index = headers.indexOf(name);
  return index < 0 ? undefined : record[index]?.trim() || undefined;
}

function toPlatform(value: string | undefined): Platform {
  switch (value?.trim().toUpperCase()) {
    case 'FACEBOOK':
      return Platform.FACEBOOK;
    case 'X':
    case 'TWITTER':
      return Platform.X;
    default:
      throw new BadRequestException(
        `Unsupported platform: ${value ?? '(empty)'}`,
      );
  }
}

function parseDate(value: string, row: number): Date {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf()))
    throw new BadRequestException(`CSV row ${row} has an invalid publishedAt`);
  return date;
}

function parseCsv(value: string): string[][] {
  const records: string[][] = [[]];
  let field = '';
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      records.at(-1)!.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && value[index + 1] === '\n') index += 1;
      records.at(-1)!.push(field);
      field = '';
      records.push([]);
    } else field += character;
  }
  if (quoted)
    throw new BadRequestException('CSV contains an unclosed quoted field');
  records.at(-1)!.push(field);
  return records;
}
