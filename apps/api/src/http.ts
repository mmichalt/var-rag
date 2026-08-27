import { randomUUID } from 'node:crypto';
import {
  Logger,
  ValidationPipe,
  VersioningType,
  type INestApplication,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { BackendConfig } from '@var-rag/config';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

const REQUEST_ID_HEADER = 'x-request-id';
const requestIdPattern = /^[\w.-]{8,128}$/;

export function resolveRequestId(incoming: unknown): string {
  if (typeof incoming === 'string' && requestIdPattern.test(incoming)) {
    return incoming;
  }
  return randomUUID();
}

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = resolveRequestId(req.header(REQUEST_ID_HEADER));
  req.headers[REQUEST_ID_HEADER] = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  const started = Date.now();
  res.on('finish', () => {
    Logger.log({
      msg: 'request',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - started,
      requestId,
    });
  });
  next();
}

export function configureHttpApp(
  app: INestApplication,
  config: BackendConfig,
): void {
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.use(helmet());
  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.use(requestContextMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();

  if (config.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Football VAR Decision Explorer API')
        .setDescription('HTTP API for the Football VAR Decision Explorer')
        .setVersion('1.0')
        .build(),
    );
    SwaggerModule.setup('docs', app, document, {
      useGlobalPrefix: true,
      jsonDocumentUrl: 'docs-json',
    });
  }
}
