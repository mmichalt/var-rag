import { Prisma } from '@var-rag/database';
import type { Db } from '../db.js';
import { parseLocator } from '../locator.js';
import { VISIBILITY_SQL, VISIBLE_FAMILY } from '../versions.js';
import { capExcerpt, evidenceLabelText } from '../presentation.js';

export type EvidenceRecord = {
  chunkId: string;
  documentId: string;
  status: string;
  visible: boolean;
  retired: boolean;
  excerpt: string | null;
  label: string;
  sourceTitle: string;
  canonicalUrl: string;
  edition: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  locator: ReturnType<typeof parseLocator>;
};

export async function loadEvidence(
  db: Db,
  chunkId: string,
): Promise<
  | { status: 404 }
  | { status: 410; retired: true }
  | { status: 200; body: EvidenceRecord }
> {
  const rows = await db.$queryRaw<
    Array<{
      id: string;
      documentId: string;
      status: string;
      activeChunkSetId: string | null;
      chunkSetId: string;
      sourceText: string;
      evidenceLabel:
        | 'OFFICIAL_LAW'
        | 'OFFICIAL_DECISION'
        | 'OFFICIAL_EXPLANATION';
      locator: unknown;
      title: string;
      canonicalUrl: string;
      edition: string | null;
      effectiveFrom: Date | null;
      effectiveTo: Date | null;
      maxExcerptChars: number;
      visible: boolean;
    }>
  >(Prisma.sql`
    SELECT c.id, c."documentId", d.status, d."activeChunkSetId", c."chunkSetId",
           c."sourceText", c."evidenceLabel", c.locator, d.title, d."canonicalUrl",
           d.edition, d."effectiveFrom", d."effectiveTo", f."maxExcerptChars",
           (${Prisma.raw(VISIBILITY_SQL)}) AS visible
    FROM "Chunk" c
    INNER JOIN "SourceDocument" d ON d.id = c."documentId"
    INNER JOIN "SourceFamily" f ON f.id = d."familyId"
    WHERE c.id = ${chunkId}
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) {
    return { status: 404 };
  }
  if (!row.visible || row.status === 'RETIRED') {
    return { status: 410, retired: true };
  }
  return {
    status: 200,
    body: {
      chunkId: row.id,
      documentId: row.documentId,
      status: row.status,
      visible: true,
      retired: false,
      excerpt: capExcerpt(row.sourceText, row.maxExcerptChars),
      label: evidenceLabelText(row.evidenceLabel),
      sourceTitle: row.title,
      canonicalUrl: row.canonicalUrl,
      edition: row.edition,
      effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
      effectiveTo: row.effectiveTo?.toISOString() ?? null,
      locator: parseLocator(row.locator),
    },
  };
}

export async function listLawEditions(db: Db) {
  return db.sourceDocument.findMany({
    where: {
      status: 'PUBLISHED',
      edition: { not: null },
      effectiveFrom: { not: null },
      family: VISIBLE_FAMILY,
    },
    select: {
      edition: true,
      effectiveFrom: true,
      effectiveTo: true,
      title: true,
    },
    distinct: ['edition'],
    orderBy: { effectiveFrom: 'asc' },
  });
}
