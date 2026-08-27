import { NestFactory } from '@nestjs/core';
import { loadBackendConfig } from '@var-rag/config';
import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { WorkerModule } from './app/worker.module';

function createJsonLogger(
  logLevel: ReturnType<typeof loadBackendConfig>['logLevel'],
): ConsoleLogger {
  const logLevels: LogLevel[] =
    logLevel === 'debug'
      ? ['debug', 'verbose', 'log', 'warn', 'error', 'fatal']
      : logLevel === 'info'
        ? ['log', 'warn', 'error', 'fatal']
        : logLevel === 'warn'
          ? ['warn', 'error', 'fatal']
          : ['error', 'fatal'];
  return new ConsoleLogger({
    json: true,
    context: 'worker',
    logLevels,
    colors: false,
  });
}

async function bootstrap(): Promise<void> {
  const command = process.argv[2];
  if (command && !command.startsWith('-')) {
    const { runCli } = await import('./cli');
    await runCli(process.argv.slice(2));
    return;
  }
  const config = loadBackendConfig();
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: createJsonLogger(config.logLevel),
  });
  app.enableShutdownHooks();
}

bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(message);
  process.exitCode = 1;
});
