import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalMediaStorageService } from './local-media-storage.service';
import { MEDIA_STORAGE } from './media-storage.port';
import { S3MediaStorageService } from './s3-media-storage.service';

@Module({
  providers: [
    LocalMediaStorageService,
    S3MediaStorageService,
    {
      provide: MEDIA_STORAGE,
      useFactory: (
        config: ConfigService,
        local: LocalMediaStorageService,
        s3: S3MediaStorageService,
      ) => (config.get<string>('STORAGE_DRIVER') === 's3' ? s3 : local),
      inject: [ConfigService, LocalMediaStorageService, S3MediaStorageService],
    },
  ],
  exports: [MEDIA_STORAGE],
})
export class StorageModule {}
