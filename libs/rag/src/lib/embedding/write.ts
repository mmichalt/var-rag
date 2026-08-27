import { Prisma } from '@var-rag/database';
import type { Db } from '../db.js';

export function vectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}

export async function writeEmbedding(
  db: Db,
  chunkId: string,
  vector: number[],
): Promise<void> {
  const literal = vectorLiteral(vector);
  await db.$executeRaw(
    Prisma.sql`UPDATE "Chunk" SET embedding = ${literal}::vector(768) WHERE id = ${chunkId}`,
  );
}

export async function missingEmbeddingCount(
  db: Db,
  chunkSetId: string,
): Promise<number> {
  const rows = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "Chunk"
    WHERE "chunkSetId" = ${chunkSetId}
      AND embedding IS NULL
  `;
  return Number(rows[0]?.count ?? 0);
}
