import type { Embedder } from '../embedding/embedder.js';
import { writeEmbedding, missingEmbeddingCount } from '../embedding/write.js';
import { chunkPages } from '../chunking/chunk.js';
import { CHUNKING_VERSION, NORMALIZATION_VERSION } from '../versions.js';
import { writeAudit } from './audit.js';
import type { Db } from '../db.js';

export type BuildChunkSetInput = {
  documentId: string;
  embedder: Embedder;
  pages?: string[];
};

export async function buildChunkSet(db: Db, input: BuildChunkSetInput) {
  const document = await db.sourceDocument.findUnique({
    where: { id: input.documentId },
  });
  if (!document) {
    throw new Error(`Document ${input.documentId} not found`);
  }
  const pages =
    input.pages ??
    (document.extractedText ? document.extractedText.split('\n\f\n') : []);
  const chunks = chunkPages(pages);

  const identity = {
    documentId: document.id,
    chunkingVersion: CHUNKING_VERSION,
    normalizationVersion: NORMALIZATION_VERSION,
    embeddingModel: input.embedder.model,
    embeddingDigest: input.embedder.digest,
  };

  const inProgress = await db.chunkSet.findFirst({
    where: {
      ...identity,
      status: { in: ['BUILDING', 'READY', 'ACTIVE'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  let chunkSetId: string;
  if (inProgress?.status === 'READY' || inProgress?.status === 'ACTIVE') {
    return inProgress;
  }

  if (inProgress?.status === 'BUILDING') {
    await db.chunk.deleteMany({ where: { chunkSetId: inProgress.id } });
    await db.chunkSet.update({
      where: { id: inProgress.id },
      data: {
        status: 'BUILDING',
        expectedChunkCount: chunks.length,
        chunkCount: 0,
        embeddingDimensions: input.embedder.dimensions,
      },
    });
    chunkSetId = inProgress.id;
  } else {
    const created = await db.chunkSet.create({
      data: {
        ...identity,
        embeddingDimensions: input.embedder.dimensions,
        status: 'BUILDING',
        expectedChunkCount: chunks.length,
      },
    });
    chunkSetId = created.id;
  }

  try {
    const embeddings = await input.embedder.embed(
      chunks.map((chunk) => chunk.retrievalText),
    );
    for (const [index, chunk] of chunks.entries()) {
      const created = await db.chunk.create({
        data: {
          chunkSetId,
          documentId: document.id,
          ordinal: chunk.ordinal,
          sourceText: chunk.sourceText,
          retrievalText: chunk.retrievalText,
          locator: chunk.locator,
          evidenceLabel: 'OFFICIAL_LAW',
          tokenCount: chunk.tokenCount,
        },
      });
      await writeEmbedding(db, created.id, embeddings[index]);
    }
    const missing = await missingEmbeddingCount(db, chunkSetId);
    if (missing > 0 || chunks.length !== embeddings.length) {
      throw new Error(`Embedding incomplete: ${missing} missing`);
    }
    const ready = await db.chunkSet.update({
      where: { id: chunkSetId },
      data: { status: 'READY', chunkCount: chunks.length },
    });
    await writeAudit(db, {
      action: 'build-chunk-set',
      targetType: 'ChunkSet',
      targetId: chunkSetId,
      after: { chunkCount: chunks.length, status: 'READY' },
    });
    return ready;
  } catch (error) {
    await db.chunkSet.update({
      where: { id: chunkSetId },
      data: { status: 'FAILED' },
    });
    throw error;
  }
}
