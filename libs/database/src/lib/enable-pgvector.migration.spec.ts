import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const pgvectorSql = readFileSync(
  resolve(
    here,
    '../../prisma/migrations/20260818190000_enable_pgvector/migration.sql',
  ),
  'utf8',
);

const lawsSql = readFileSync(
  resolve(
    here,
    '../../prisma/migrations/20260827120000_ask_the_laws/migration.sql',
  ),
  'utf8',
);

describe('pgvector migration', () => {
  it('enables the vector extension', () => {
    expect(pgvectorSql).toMatch(/CREATE EXTENSION IF NOT EXISTS\s+vector/i);
  });
});

describe('ask-the-laws migration', () => {
  it('declares vector(768) explicitly', () => {
    expect(lawsSql).toMatch(/vector\(768\)/);
  });

  it('creates a generated searchVector and a GIN index', () => {
    expect(lawsSql).toMatch(/GENERATED ALWAYS AS \(to_tsvector/i);
    expect(lawsSql).toMatch(/USING GIN \("searchVector"\)/);
  });

  it('seeds IFAB as NOT_ASSESSED and synthetic-lawbook as APPROVED', () => {
    expect(lawsSql).toMatch(/'ifab'[\s\S]*'NOT_ASSESSED'/);
    expect(lawsSql).toMatch(/'synthetic-lawbook'[\s\S]*'APPROVED'/);
  });
});
