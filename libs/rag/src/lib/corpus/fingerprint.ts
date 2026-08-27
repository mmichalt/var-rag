import { sha256Hex } from '../hashes.js';
import type { Db, Tx } from '../db.js';

export async function computeCorpusFingerprint(db: Db | Tx): Promise<string> {
  const docs = await db.sourceDocument.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      id: true,
      version: true,
      activeChunkSetId: true,
      contentSha256: true,
    },
    orderBy: { id: 'asc' },
  });
  return sha256Hex(JSON.stringify(docs));
}

export async function recordCorpusRevision(
  db: Db | Tx,
  reason: string,
  indexConfig: Record<string, unknown>,
) {
  const fingerprint = await computeCorpusFingerprint(db);
  return db.corpusRevision.create({
    data: { reason, fingerprint, indexConfig: indexConfig as object },
  });
}

export async function latestCorpusRevision(db: Db): Promise<{
  revision: number | null;
  fingerprint: string;
}> {
  const latest = await db.corpusRevision.findFirst({
    orderBy: { revision: 'desc' },
  });
  return {
    revision: latest?.revision ?? null,
    fingerprint: latest?.fingerprint ?? (await computeCorpusFingerprint(db)),
  };
}
