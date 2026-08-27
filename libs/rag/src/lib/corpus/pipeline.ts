import type { BackendConfig } from '@var-rag/config';
import type { Db } from '../db.js';
import type { Embedder } from '../embedding/embedder.js';
import { ingestDocument, type IngestInput } from '../acquisition/ingest.js';
import { buildChunkSet } from './chunk-set.js';
import { publishDocument } from './publish.js';

export async function ingestAndPublish(
  db: Db,
  input: {
    ingest: IngestInput;
    embedder: Embedder;
    config: Pick<BackendConfig, 'embeddingModel' | 'embeddingDimensions'>;
    forceExtractionGate?: boolean;
  },
) {
  const ingested = await ingestDocument(db, input.ingest);
  const chunkSet = await buildChunkSet(db, {
    documentId: ingested.document.id,
    embedder: input.embedder,
    pages: ingested.pages,
  });
  const published = await publishDocument(db, {
    documentId: ingested.document.id,
    forceExtractionGate: input.forceExtractionGate,
    config: input.config,
    embeddingDigest: input.embedder.digest,
  });
  return { ingested, chunkSet, published };
}
