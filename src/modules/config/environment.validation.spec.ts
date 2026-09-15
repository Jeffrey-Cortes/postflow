import 'reflect-metadata';
import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  const databaseUrl = 'postgresql://postflow:postflow@localhost:5432/postflow';
  it('accepts local storage defaults', () => {
    expect(validateEnvironment({ DATABASE_URL: databaseUrl })).toMatchObject({
      PORT: 3000,
      STORAGE_DRIVER: 'local',
      PUBLISHING_MODE: 'manual',
    });
  });
  it('requires a bucket when S3 storage is selected', () => {
    expect(() =>
      validateEnvironment({ DATABASE_URL: databaseUrl, STORAGE_DRIVER: 's3' }),
    ).toThrow('S3_BUCKET is required');
  });
  it('requires Telegram authentication in production', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: databaseUrl,
        NODE_ENV: 'production',
      }),
    ).toThrow('TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET is required');
  });
  it('rejects a media limit above 20 MiB', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: databaseUrl,
        MAX_TELEGRAM_FILE_SIZE_BYTES: String(20 * 1024 * 1024 + 1),
      }),
    ).toThrow('MAX_TELEGRAM_FILE_SIZE_BYTES');
  });
});
