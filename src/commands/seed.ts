import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { BootstrapService } from '../modules/bootstrap/bootstrap.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const result = await app.get(BootstrapService).seedInitialUser();
    console.log(
      `Seed complete: organization=${result.organizationId} user=${result.userId}`,
    );
  } finally {
    await app.close();
  }
}
void run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
