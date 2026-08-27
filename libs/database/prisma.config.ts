import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

const here = dirname(fileURLToPath(import.meta.url));
for (const path of [
  resolve(process.cwd(), '.env'),
  resolve(here, '../../.env'),
]) {
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
