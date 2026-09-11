import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`Postflow API listening on port ${port}`, 'Bootstrap');
}
void bootstrap().catch((error: unknown) => {
  Logger.error('Unable to start Postflow API', error, 'Bootstrap');
  process.exitCode = 1;
});
