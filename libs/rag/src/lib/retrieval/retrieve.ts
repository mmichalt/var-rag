import { Prisma } from '@var-rag/database';
import type { BackendConfig } from '@var-rag/config';
import type { Db } from '../db.js';
import type { ChunkLocator } from '../locator.js';
import { parseLocator } from '../locator.js';
import { vectorLiteral } from '../embedding/write.js';
import { RRF_K, VISIBILITY_SQL } from '../versions.js';
import { rrfFuse } from './rrf.js';

export function passesRelevanceCutoff(
  chunk: {
    lexicalRank: number | null;
    cosineDistance: number | null;
  },
  maxCosineDistance: number,
): boolean {
  if (chunk.lexicalRank !== null) {
    return true;
  }
  return (
    chunk.cosineDistance !== null && chunk.cosineDistance <= maxCosineDistance
  );
}

export type RetrievalFilters = {
  edition: string;
  embeddingModel: string;
  embeddingDigest: string;
  embeddingDimensions: number;
};

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  documentVersion: number;
  chunkSetId: string;
  sourceText: string;
  evidenceLabel: 'OFFICIAL_LAW' | 'OFFICIAL_DECISION' | 'OFFICIAL_EXPLANATION';
  locator: ChunkLocator;
  title: string;
  canonicalUrl: string;
  edition: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  maxExcerptChars: number;
  rank: number;
  fusionScore: number;
  semanticRank: number | null;
  lexicalRank: number | null;
  cosineDistance: number | null;
  tsRank: number | null;
};

type SemanticRow = {
  id: string;
  distance: number;
};

type LexicalRow = {
  id: string;
  rank: number;
};

export async function semanticCandidates(
  db: Db,
  queryVec: number[],
  filters: RetrievalFilters,
  k: number,
): Promise<SemanticRow[]> {
  const literal = vectorLiteral(queryVec);
  return db.$queryRaw<SemanticRow[]>(Prisma.sql`
    SELECT c.id, (c.embedding <=> ${literal}::vector(768)) AS distance
    FROM "Chunk" c
    INNER JOIN "SourceDocument" d ON d.id = c."documentId"
    INNER JOIN "ChunkSet" cs ON cs.id = c."chunkSetId"
    INNER JOIN "SourceFamily" f ON f.id = d."familyId"
    WHERE ${Prisma.raw(VISIBILITY_SQL)}
      AND d.edition = ${filters.edition}
      AND cs."embeddingModel" = ${filters.embeddingModel}
      AND cs."embeddingDigest" = ${filters.embeddingDigest}
      AND cs."embeddingDimensions" = ${filters.embeddingDimensions}
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${literal}::vector(768)
    LIMIT ${k}
  `);
}

export async function lexicalCandidates(
  db: Db,
  query: string,
  filters: RetrievalFilters,
  k: number,
): Promise<LexicalRow[]> {
  try {
    return await db.$queryRaw<LexicalRow[]>(Prisma.sql`
      SELECT c.id,
        ts_rank_cd(c."searchVector", websearch_to_tsquery('english', ${query})) AS rank
      FROM "Chunk" c
      INNER JOIN "SourceDocument" d ON d.id = c."documentId"
      INNER JOIN "ChunkSet" cs ON cs.id = c."chunkSetId"
      INNER JOIN "SourceFamily" f ON f.id = d."familyId"
      WHERE ${Prisma.raw(VISIBILITY_SQL)}
        AND d.edition = ${filters.edition}
        AND cs."embeddingModel" = ${filters.embeddingModel}
        AND cs."embeddingDigest" = ${filters.embeddingDigest}
        AND cs."embeddingDimensions" = ${filters.embeddingDimensions}
        AND c."searchVector" @@ websearch_to_tsquery('english', ${query})
      ORDER BY ts_rank_cd(c."searchVector", websearch_to_tsquery('english', ${query})) DESC
      LIMIT ${k}
    `);
  } catch {
    return [];
  }
}

type HydratedRow = {
  id: string;
  documentId: string;
  version: number;
  chunkSetId: string;
  sourceText: string;
  evidenceLabel: RetrievedChunk['evidenceLabel'];
  locator: unknown;
  title: string;
  canonicalUrl: string;
  edition: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  maxExcerptChars: number;
};

export async function retrieveHybrid(
  db: Db,
  input: {
    query: string;
    queryEmbedding: number[];
    filters: RetrievalFilters;
    config: Pick<
      BackendConfig,
      | 'semanticCandidateK'
      | 'lexicalCandidateK'
      | 'retrievalTopK'
      | 'retrievalMaxCosineDistance'
    >;
  },
): Promise<{
  chunks: RetrievedChunk[];
  semanticMs: number;
  lexicalMs: number;
  fusionMs: number;
}> {
  const semanticStarted = Date.now();
  const semantic = await semanticCandidates(
    db,
    input.queryEmbedding,
    input.filters,
    input.config.semanticCandidateK,
  );
  const semanticMs = Date.now() - semanticStarted;

  const lexicalStarted = Date.now();
  const lexical = await lexicalCandidates(
    db,
    input.query,
    input.filters,
    input.config.lexicalCandidateK,
  );
  const lexicalMs = Date.now() - lexicalStarted;

  const fusionStarted = Date.now();
  const semanticDistance = new Map(
    semantic.map((row) => [row.id, row.distance]),
  );
  const fused = rrfFuse(
    semantic.map((row, index) => ({ id: row.id, rank: index + 1 })),
    lexical.map((row, index) => ({ id: row.id, rank: index + 1 })),
    RRF_K,
  )
    .filter((hit) =>
      passesRelevanceCutoff(
        {
          lexicalRank: hit.lexicalRank,
          cosineDistance: semanticDistance.get(hit.id) ?? null,
        },
        input.config.retrievalMaxCosineDistance,
      ),
    )
    .slice(0, input.config.retrievalTopK);
  const fusionMs = Date.now() - fusionStarted;

  if (fused.length === 0) {
    return { chunks: [], semanticMs, lexicalMs, fusionMs };
  }

  const ids = fused.map((hit) => hit.id);
  const hydrated = await db.$queryRaw<HydratedRow[]>(Prisma.sql`
    SELECT c.id, c."documentId", d.version, c."chunkSetId", c."sourceText",
           c."evidenceLabel", c.locator, d.title, d."canonicalUrl", d.edition,
           d."effectiveFrom", d."effectiveTo", f."maxExcerptChars"
    FROM "Chunk" c
    INNER JOIN "SourceDocument" d ON d.id = c."documentId"
    INNER JOIN "SourceFamily" f ON f.id = d."familyId"
    WHERE ${Prisma.raw(VISIBILITY_SQL)}
      AND c.id IN (${Prisma.join(ids)})
  `);
  const byId = new Map(hydrated.map((row) => [row.id, row]));
  const lexicalRankScore = new Map(lexical.map((row) => [row.id, row.rank]));

  const chunks: RetrievedChunk[] = [];
  for (const [index, hit] of fused.entries()) {
    const row = byId.get(hit.id);
    if (!row) {
      continue;
    }
    chunks.push({
      chunkId: row.id,
      documentId: row.documentId,
      documentVersion: row.version,
      chunkSetId: row.chunkSetId,
      sourceText: row.sourceText,
      evidenceLabel: row.evidenceLabel,
      locator: parseLocator(row.locator),
      title: row.title,
      canonicalUrl: row.canonicalUrl,
      edition: row.edition,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      maxExcerptChars: row.maxExcerptChars,
      rank: index + 1,
      fusionScore: hit.fusionScore,
      semanticRank: hit.semanticRank,
      lexicalRank: hit.lexicalRank,
      cosineDistance: semanticDistance.get(hit.id) ?? null,
      tsRank: lexicalRankScore.get(hit.id) ?? null,
    });
  }
  return { chunks, semanticMs, lexicalMs, fusionMs };
}
