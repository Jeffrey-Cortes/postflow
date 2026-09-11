import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { MediaStorage, StoreMediaInput } from './media-storage.port';

@Injectable()
export class LocalMediaStorageService implements MediaStorage {
  constructor(private readonly config: ConfigService) {}

  async store({ key, body }: StoreMediaInput): Promise<void> {
    const root = resolve(
      this.config.get<string>('LOCAL_STORAGE_PATH') ?? './storage',
    );
    const target = resolve(root, key);
    const targetRelative = relative(root, target);
    if (
      !key ||
      isAbsolute(key) ||
      targetRelative.startsWith('..') ||
      isAbsolute(targetRelative)
    ) {
      throw new Error('Storage key must resolve inside LOCAL_STORAGE_PATH');
    }
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, body);
    await rename(temporary, target);
  }
}
