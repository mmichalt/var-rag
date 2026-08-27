import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationSql = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../prisma/migrations/20260818190000_enable_pgvector/migration.sql',
  ),
  'utf8',
);

describe('pgvector migration', () => {
  it('enables the vector extension', () => {
    expect(migrationSql).toMatch(/CREATE EXTENSION IF NOT EXISTS\s+vector/i);
  });
});
