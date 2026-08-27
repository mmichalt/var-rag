import type { BackendConfig } from '@var-rag/config';
import { missingEmbeddingCount } from '../embedding/write.js';
import { publicationReasons } from './publication-reasons.js';
import { recordCorpusRevision } from './fingerprint.js';
import { writeAudit } from './audit.js';
import type { Db } from '../db.js';

export class PublishError extends Error {
  constructor(readonly reasons: string[]) {
    super(`Publication refused: ${reasons.join(', ')}`);
    this.name = 'PublishError';
  }
}

export async function publishDocument(
  db: Db,
  input: {
    documentId: string;
    forceExtractionGate?: boolean;
    config: Pick<BackendConfig, 'embeddingModel' | 'embeddingDimensions'>;
    embeddingDigest: string;
  },
) {
  const document = await db.sourceDocument.findUnique({
    where: { id: input.documentId },
    include: { family: true },
  });
  if (!document) {
    throw new PublishError(['DOCUMENT_NOT_FOUND']);
  }

  const chunkSet = await db.chunkSet.findFirst({
    where: {
      documentId: document.id,
      embeddingModel: input.config.embeddingModel,
      embeddingDigest: input.embeddingDigest,
      embeddingDimensions: input.config.embeddingDimensions,
      status: { in: ['READY', 'ACTIVE'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  const completeEmbeddings = chunkSet
    ? (await missingEmbeddingCount(db, chunkSet.id)) === 0
    : false;

  const reasons = publicationReasons({
    family: document.family,
    document,
    chunkSet: chunkSet ? { ...chunkSet, completeEmbeddings } : null,
    forceExtractionGate: Boolean(input.forceExtractionGate),
    activeEmbedding: {
      model: input.config.embeddingModel,
      digest: input.embeddingDigest,
      dimensions: input.config.embeddingDimensions,
    },
  });
  if (reasons.length > 0) {
    throw new PublishError(reasons);
  }
  if (!chunkSet) {
    throw new PublishError(['CHUNK_SET_NOT_READY']);
  }

  return db.$transaction(async (tx) => {
    const previousId = document.activeChunkSetId;
    if (previousId && previousId !== chunkSet.id) {
      await tx.chunkSet.update({
        where: { id: previousId },
        data: { status: 'SUPERSEDED' },
      });
    }
    await tx.chunkSet.update({
      where: { id: chunkSet.id },
      data: { status: 'ACTIVE', activatedAt: new Date() },
    });
    const published = await tx.sourceDocument.update({
      where: { id: document.id },
      data: {
        status: 'PUBLISHED',
        activeChunkSetId: chunkSet.id,
      },
    });
    const revision = await recordCorpusRevision(tx, 'publish', {
      embeddingModel: input.config.embeddingModel,
      embeddingDigest: input.embeddingDigest,
      embeddingDimensions: input.config.embeddingDimensions,
    });
    await writeAudit(tx, {
      action: 'publish',
      targetType: 'SourceDocument',
      targetId: document.id,
      before: { status: document.status, activeChunkSetId: previousId },
      after: {
        status: 'PUBLISHED',
        activeChunkSetId: chunkSet.id,
        forceExtractionGate: Boolean(input.forceExtractionGate),
      },
    });
    return { document: published, chunkSetId: chunkSet.id, revision };
  });
}

export async function activateChunkSet(
  db: Db,
  input: {
    chunkSetId: string;
    config: Pick<BackendConfig, 'embeddingModel' | 'embeddingDimensions'>;
    embeddingDigest: string;
  },
) {
  const chunkSet = await db.chunkSet.findUnique({
    where: { id: input.chunkSetId },
    include: { document: true },
  });
  if (!chunkSet || chunkSet.status !== 'READY') {
    throw new Error('Chunk set is not READY');
  }
  if (chunkSet.document.status !== 'PUBLISHED') {
    throw new Error('Document is not published');
  }

  return db.$transaction(async (tx) => {
    const previousId = chunkSet.document.activeChunkSetId;
    if (previousId && previousId !== chunkSet.id) {
      await tx.chunkSet.update({
        where: { id: previousId },
        data: { status: 'SUPERSEDED' },
      });
    }
    await tx.chunkSet.update({
      where: { id: chunkSet.id },
      data: { status: 'ACTIVE', activatedAt: new Date() },
    });
    await tx.sourceDocument.update({
      where: { id: chunkSet.documentId },
      data: { activeChunkSetId: chunkSet.id },
    });
    const revision = await recordCorpusRevision(tx, 'activate-chunk-set', {
      embeddingModel: input.config.embeddingModel,
      embeddingDigest: input.embeddingDigest,
      embeddingDimensions: input.config.embeddingDimensions,
    });
    await writeAudit(tx, {
      action: 'activate-chunk-set',
      targetType: 'ChunkSet',
      targetId: chunkSet.id,
      before: { activeChunkSetId: previousId },
      after: { activeChunkSetId: chunkSet.id },
    });
    return { revision, previousId };
  });
}

export async function rebuildPublishedChunkSets(
  db: Db,
  input: {
    embedder: import('../embedding/embedder.js').Embedder;
  },
) {
  const { buildChunkSet } = await import('./chunk-set.js');
  const published = await db.sourceDocument.findMany({
    where: { status: 'PUBLISHED' },
    include: { activeChunkSet: true },
  });
  const before = published.map((doc) => ({
    id: doc.id,
    chunkCount: doc.activeChunkSet?.chunkCount ?? 0,
  }));

  for (const doc of published) {
    const set = await buildChunkSet(db, {
      documentId: doc.id,
      embedder: input.embedder,
    });
    if (set.status === 'READY') {
      await activateChunkSet(db, {
        chunkSetId: set.id,
        config: {
          embeddingModel: input.embedder.model,
          embeddingDimensions: input.embedder.dimensions,
        },
        embeddingDigest: input.embedder.digest,
      });
    }
  }

  const afterDocs = await db.sourceDocument.findMany({
    where: { status: 'PUBLISHED' },
    include: { activeChunkSet: true },
  });
  const after = afterDocs.map((doc) => ({
    id: doc.id,
    chunkCount: doc.activeChunkSet?.chunkCount ?? 0,
  }));
  return { before, after };
}
