import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import type { BackendConfig } from '@var-rag/config';

export function createJsonLogger(
  context: string,
  logLevel: BackendConfig['logLevel'],
): ConsoleLogger {
  const logLevels: LogLevel[] =
    logLevel === 'debug'
      ? ['debug', 'verbose', 'log', 'warn', 'error', 'fatal']
      : logLevel === 'info'
        ? ['log', 'warn', 'error', 'fatal']
        : logLevel === 'warn'
          ? ['warn', 'error', 'fatal']
          : ['error', 'fatal'];
  return new ConsoleLogger({ json: true, context, logLevels, colors: false });
}
