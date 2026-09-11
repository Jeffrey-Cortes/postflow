import { Injectable } from '@nestjs/common';
import { Platform } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { rankHistoricalPosts } from './historical-post-ranking';
import {
  HistoricalPostImportRow,
  HistoricalPostReference,
} from './historical-post.types';
import { parseHistoricalPostsCsv } from './historical-post-csv.parser';

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findRelevantExamples(
    organizationId: string,
    platform: Platform,
    sourceText: string,
    limit = 3,
  ): Promise<HistoricalPostReference[]> {
    const candidates = await this.prisma.historicalPost.findMany({
      where: { organizationId, platform },
      select: { id: true, platform: true, text: true },
      orderBy: { publishedAt: 'desc' },
      take: 250,
    });
    return rankHistoricalPosts(sourceText, candidates, limit);
  }

  async importRows(
    organizationId: string,
    rows: HistoricalPostImportRow[],
  ): Promise<number> {
    if (rows.length === 0) return 0;
    const result = await this.prisma.historicalPost.createMany({
      data: rows.map((row) => ({
        organizationId,
        platform: row.platform,
        text: row.text,
        externalId: row.externalId,
        publishedAt: row.publishedAt,
        imageUrls: row.imageUrls,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async importCsv(organizationId: string, csv: string): Promise<number> {
    return this.importRows(organizationId, parseHistoricalPostsCsv(csv));
  }
}
