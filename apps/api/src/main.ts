import { NestFactory } from '@nestjs/core';
import { loadBackendConfig } from '@var-rag/config';
import { AppModule } from './app/app.module';
import { configureHttpApp } from './http';
import { createJsonLogger } from './json-logger';

async function bootstrap(): Promise<void> {
  const config = loadBackendConfig();
  const app = await NestFactory.create(AppModule, {
    logger: createJsonLogger('api', config.logLevel),
  });
  configureHttpApp(app, config);
  await app.listen(config.apiPort);
}

bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(message);
  process.exitCode = 1;
});
