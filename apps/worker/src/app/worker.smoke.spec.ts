describe('worker smoke', () => {
  const enabled = Boolean(
    process.env.CI && process.env.DATABASE_URL && process.env.REDIS_URL,
  );

  (enabled ? it : it.skip)(
    'starts an application context and shuts down cleanly',
    async () => {
      const { NestFactory } = await import('@nestjs/core');
      const { WorkerModule } = await import('./worker.module');
      const app = await NestFactory.createApplicationContext(WorkerModule, {
        logger: false,
      });
      await app.close();
    },
  );
});
