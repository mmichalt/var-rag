import type { Db } from '../db.js';
import { latestCorpusRevision } from './fingerprint.js';

export async function inspectDocument(db: Db, documentId: string) {
  const document = await db.sourceDocument.findUnique({
    where: { id: documentId },
    include: {
      family: true,
      chunkSets: { orderBy: { createdAt: 'desc' } },
    },
  });
  if (!document) {
    throw new Error(`Document ${documentId} not found`);
  }

  const byStatus = await db.sourceDocument.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  const chunkSets = await db.chunkSet.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  const missingEmbeddings = await db.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "Chunk" c
    INNER JOIN "ChunkSet" cs ON cs.id = c."chunkSetId"
    WHERE c.embedding IS NULL
      AND cs.status IN ('READY', 'ACTIVE', 'BUILDING')
  `;
  const corpus = await latestCorpusRevision(db);

  return {
    document: {
      id: document.id,
      family: document.family.name,
      status: document.status,
      edition: document.edition,
      version: document.version,
      extractionGatePassed: document.extractionGatePassed,
      duplicateFlagStatus: document.duplicateFlagStatus,
      activeChunkSetId: document.activeChunkSetId,
    },
    extractionReport: document.extractionReport,
    chunkSets: document.chunkSets.map((set) => ({
      id: set.id,
      status: set.status,
      chunkCount: set.chunkCount,
      expectedChunkCount: set.expectedChunkCount,
      embeddingModel: set.embeddingModel,
      embeddingDigest: set.embeddingDigest,
    })),
    corpus: {
      recordsByStatus: Object.fromEntries(
        byStatus.map((row) => [row.status, row._count._all]),
      ),
      chunkSetsByStatus: Object.fromEntries(
        chunkSets.map((row) => [row.status, row._count._all]),
      ),
      missingEmbeddings: Number(missingEmbeddings[0]?.count ?? 0),
      revision: corpus.revision,
      fingerprint: corpus.fingerprint,
    },
  };
}
