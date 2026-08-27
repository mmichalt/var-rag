import { recordCorpusRevision } from './fingerprint.js';
import { writeAudit } from './audit.js';
import type { Db } from '../db.js';

export async function retireDocument(
  db: Db,
  input: { documentId: string; reason: string },
) {
  const document = await db.sourceDocument.findUnique({
    where: { id: input.documentId },
  });
  if (!document) {
    throw new Error(`Document ${input.documentId} not found`);
  }

  return db.$transaction(async (tx) => {
    const retired = await tx.sourceDocument.update({
      where: { id: document.id },
      data: { status: 'RETIRED', activeChunkSetId: null },
    });
    if (document.activeChunkSetId) {
      await tx.chunkSet.update({
        where: { id: document.activeChunkSetId },
        data: { status: 'SUPERSEDED' },
      });
    }
    const revision = await recordCorpusRevision(tx, 'retire', {
      reason: input.reason,
    });
    await writeAudit(tx, {
      action: 'retire',
      targetType: 'SourceDocument',
      targetId: document.id,
      before: { status: document.status },
      after: { status: 'RETIRED', reason: input.reason },
    });
    return { document: retired, revision };
  });
}
