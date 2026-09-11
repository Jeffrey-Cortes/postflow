import { plainToInstance, Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Matches,
  Min,
  validateSync,
} from 'class-validator';

enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}
enum StorageDriver {
  Local = 'local',
  S3 = 's3',
}

class EnvironmentVariables {
  @IsEnum(NodeEnvironment) NODE_ENV: NodeEnvironment =
    NodeEnvironment.Development;
  @Transform(({ value }) =>
    value === '' || value === undefined ? 3000 : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3000;
  @IsString() @Matches(/^postgres(?:ql)?:\/\/\S+$/) DATABASE_URL!: string;
  @IsString() LOG_LEVEL = 'log';
  @IsEnum(StorageDriver) STORAGE_DRIVER: StorageDriver = StorageDriver.Local;
  @IsString() LOCAL_STORAGE_PATH = './storage';
  @IsOptional() @IsString() AWS_REGION?: string;
  @IsOptional() @IsString() S3_BUCKET?: string;
  @IsOptional() @IsString() TELEGRAM_BOT_TOKEN?: string;
  @IsOptional() @IsString() TELEGRAM_WEBHOOK_SECRET?: string;
  @IsOptional() @IsString() OPENAI_API_KEY?: string;
  @IsOptional() @IsString() OPENAI_MODEL = 'gpt-5.6-luna';
  @Transform(({ value }) =>
    value === '' || value === undefined ? 10 * 1024 * 1024 : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024)
  MAX_TELEGRAM_FILE_SIZE_BYTES = 10 * 1024 * 1024;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const environment = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(environment, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration: ${errors.map((error) => Object.values(error.constraints ?? {}).join(', ')).join('; ')}`,
    );
  }
  if (
    environment.STORAGE_DRIVER === StorageDriver.S3 &&
    !environment.S3_BUCKET
  ) {
    throw new Error(
      'Invalid environment configuration: S3_BUCKET is required when STORAGE_DRIVER=s3',
    );
  }
  if (
    environment.STORAGE_DRIVER === StorageDriver.S3 &&
    !environment.AWS_REGION
  ) {
    throw new Error(
      'Invalid environment configuration: AWS_REGION is required when STORAGE_DRIVER=s3',
    );
  }
  if (environment.NODE_ENV === NodeEnvironment.Production) {
    const missing = [
      ['TELEGRAM_BOT_TOKEN', environment.TELEGRAM_BOT_TOKEN],
      ['TELEGRAM_WEBHOOK_SECRET', environment.TELEGRAM_WEBHOOK_SECRET],
    ]
      .filter(([, value]) => !value?.trim())
      .map(([name]) => name);
    if (missing.length > 0) {
      throw new Error(
        `Invalid environment configuration: ${missing.join(', ')} is required in production`,
      );
    }
  }
  return environment;
}
