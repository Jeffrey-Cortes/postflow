import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaStorage, StoreMediaInput } from './media-storage.port';

@Injectable()
export class S3MediaStorageService implements MediaStorage {
  private readonly client: S3Client;

  constructor(private readonly config: ConfigService) {
    this.client = new S3Client({
      region: this.config.get<string>('AWS_REGION'),
    });
  }

  async store({ key, body, contentType }: StoreMediaInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.getOrThrow<string>('S3_BUCKET'),
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }
}
