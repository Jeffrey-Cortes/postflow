import 'reflect-metadata';
import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  const databaseUrl = 'postgresql://postflow:postflow@localhost:5432/postflow';
  it('accepts local storage defaults', () => {
    expect(validateEnvironment({ DATABASE_URL: databaseUrl })).toMatchObject({
      PORT: 3000,
      STORAGE_DRIVER: 'local',
    });
  });
  it('requires a bucket when S3 storage is selected', () => {
    expect(() =>
      validateEnvironment({ DATABASE_URL: databaseUrl, STORAGE_DRIVER: 's3' }),
    ).toThrow('S3_BUCKET is required');
  });
});
