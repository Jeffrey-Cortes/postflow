import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../modules/database/prisma.service';
import { HistoryService } from '../modules/history/history.service';

async function run() {
  const [slug, filePath] = process.argv.slice(2);
  if (!slug || !filePath) {
    throw new Error(
      'Usage: pnpm import:history <organization-slug> <csv-path>',
    );
  }
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const organization = await app
      .get(PrismaService)
      .organization.findUnique({ where: { slug }, select: { id: true } });
    if (!organization) throw new Error(`Organization not found: ${slug}`);
    const count = await app
      .get(HistoryService)
      .importCsv(organization.id, await readFile(filePath, 'utf8'));
    console.log(`Imported ${count} historical posts.`);
  } finally {
    await app.close();
  }
}
void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
