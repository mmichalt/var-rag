/**
 * Requires PostgreSQL and Redis. Skipped unless DATABASE_URL and REDIS_URL are set.
 */
import { loadBackendConfig } from '@var-rag/config';
import { configureHttpApp } from '../http';

describe('API readiness', () => {
  const enabled = Boolean(
    process.env.CI && process.env.DATABASE_URL && process.env.REDIS_URL,
  );

  (enabled ? it : it.skip)(
    'reports ready when PostgreSQL and Redis are available',
    async () => {
      const { NestFactory } = await import('@nestjs/core');
      const { AppModule } = await import('./app.module');
      const request = (await import('supertest')).default;

      const config = loadBackendConfig();
      const app = await NestFactory.create(AppModule, { logger: false });
      configureHttpApp(app, { ...config, swaggerEnabled: false });
      await app.init();
      try {
        const response = await request(app.getHttpServer()).get(
          '/api/v1/health/ready',
        );
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ok');
      } finally {
        await app.close();
      }
    },
  );
});
