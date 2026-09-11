import { Platform } from '@prisma/client';

export interface HistoricalPostReference {
  id: string;
  platform: Platform;
  text: string;
  score: number;
}

export interface HistoricalPostImportRow {
  platform: Platform;
  text: string;
  externalId?: string;
  publishedAt?: Date;
  imageUrls?: string[];
}
