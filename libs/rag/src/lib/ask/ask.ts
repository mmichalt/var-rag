import type { BackendConfig } from '@var-rag/config';
import type { Db } from '../db.js';
import type { Embedder } from '../embedding/embedder.js';
import type { AnswerGenerator } from '../generation/schema.js';
import { applyPolicy } from '../policy/validate.js';
import { retrieveHybrid } from '../retrieval/retrieve.js';
import {
  resolveEdition,
  type PublishedEdition,
  type TemporalRequest,
} from '../retrieval/temporal.js';
import {
  CHUNKING_VERSION,
  POLICY_VERSION,
  PROMPT_VERSION,
  RETRIEVAL_VERSION,
  VISIBLE_FAMILY,
} from '../versions.js';
import { latestCorpusRevision } from '../corpus/fingerprint.js';
import { capExcerpt, evidenceLabelText } from '../presentation.js';
import type { ChunkLocator } from '../locator.js';

export type AskRequest = TemporalRequest & {
  query: string;
  mode: 'laws';
  requestId: string;
};

export type EvidenceItem = {
  id: string;
  label: string;
  excerpt: string;
  sourceTitle: string;
  canonicalUrl: string;
  edition: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  locator: ChunkLocator;
  rank: number;
};

export type Diagnostics = {
  fusionScore: number;
  semanticRank: number | null;
  lexicalRank: number | null;
  cosineDistance: number | null;
  tsRank: number | null;
};

export type AskResponse =
  | {
      kind: 'answer';
      answer: {
        answerUnits: Array<{
          text: string;
          type: 'summary' | 'quote';
          citations: string[];
        }>;
        evidence: EvidenceItem[];
        resolvedEdition: string;
        resolutionReason: string;
      };
      diagnostics?: Diagnostics[];
    }
  | {
      kind: 'clarification';
      clarification: {
        question: string;
        reason: 'ambiguous_edition' | 'ambiguous_scope';
      };
    }
  | {
      kind: 'insufficient_evidence';
      insufficientEvidence: {
        explanation: string;
        missingEvidence: string[];
      };
    };

export type AskTimings = {
  temporalMs: number;
  queryEmbeddingMs: number;
  semanticMs: number;
  lexicalMs: number;
  fusionMs: number;
  retrievalMs: number;
  generationMs: number;
  policyMs: number;
  totalMs: number;
};

async function publishedEditions(db: Db): Promise<PublishedEdition[]> {
  const rows = await db.sourceDocument.findMany({
    where: {
      status: 'PUBLISHED',
      edition: { not: null },
      effectiveFrom: { not: null },
      family: VISIBLE_FAMILY,
    },
    select: { edition: true, effectiveFrom: true, effectiveTo: true },
    distinct: ['edition'],
    orderBy: { effectiveFrom: 'asc' },
  });
  return rows.map((row) => ({
    edition: row.edition as string,
    effectiveFrom: row.effectiveFrom as Date,
    effectiveTo: row.effectiveTo,
  }));
}

export async function askLaws(
  db: Db,
  input: {
    request: AskRequest;
    config: BackendConfig;
    embedder: Embedder;
    generator: AnswerGenerator;
  },
): Promise<{ response: AskResponse; timings: AskTimings }> {
  const started = Date.now();
  const timings: AskTimings = {
    temporalMs: 0,
    queryEmbeddingMs: 0,
    semanticMs: 0,
    lexicalMs: 0,
    fusionMs: 0,
    retrievalMs: 0,
    generationMs: 0,
    policyMs: 0,
    totalMs: 0,
  };

  const temporalStarted = Date.now();
  const editions = await publishedEditions(db);
  const temporal = resolveEdition(input.request, editions);
  timings.temporalMs = Date.now() - temporalStarted;

  const corpus = await latestCorpusRevision(db);
  const logBase = {
    requestId: input.request.requestId,
    query: input.request.query,
    mode: input.request.mode,
    requestedFilters: {
      edition: input.request.edition ?? null,
      asOfDate: input.request.asOfDate ?? null,
      season: input.request.season ?? null,
    },
    retrievalConfig: {
      semanticCandidateK: input.config.semanticCandidateK,
      lexicalCandidateK: input.config.lexicalCandidateK,
      retrievalTopK: input.config.retrievalTopK,
      retrievalMaxCosineDistance: input.config.retrievalMaxCosineDistance,
    },
    corpusRevision: corpus.revision,
    corpusFingerprint: corpus.fingerprint,
    llmModel: input.generator.model,
    llmDigest: input.generator.digest,
    llmOptions: {
      temperature: input.config.llmTemperature,
      seed: input.config.llmSeed,
      num_ctx: input.config.llmNumCtx,
    },
    embeddingModel: input.embedder.model,
    embeddingDigest: input.embedder.digest,
    promptVersion: PROMPT_VERSION,
    policyVersion: POLICY_VERSION,
    retrievalVersion: RETRIEVAL_VERSION,
    chunkingVersion: CHUNKING_VERSION,
  };

  const finish = async (
    response: AskResponse,
    extra: {
      resolvedEdition: string | null;
      resolutionReason: string | null;
      evidenceSnapshot: unknown;
      outcome: 'ANSWER' | 'CLARIFICATION' | 'INSUFFICIENT_EVIDENCE';
      policyRejections: unknown;
    },
  ) => {
    timings.totalMs = Date.now() - started;
    await db.answerLog.create({
      data: {
        ...logBase,
        resolvedEdition: extra.resolvedEdition,
        resolutionReason: extra.resolutionReason,
        evidenceSnapshot: extra.evidenceSnapshot as object,
        outcome: extra.outcome,
        policyRejections: extra.policyRejections as object,
        timings,
      },
    });
    return { response, timings };
  };

  if (!temporal.ok) {
    return finish(
      {
        kind: 'clarification',
        clarification: {
          question: temporal.question,
          reason: 'ambiguous_edition',
        },
      },
      {
        resolvedEdition: null,
        resolutionReason: temporal.reason,
        evidenceSnapshot: [],
        outcome: 'CLARIFICATION',
        policyRejections: [],
      },
    );
  }

  const retrievalStarted = Date.now();
  let queryEmbedding: number[];
  try {
    const embedStarted = Date.now();
    [queryEmbedding] = await input.embedder.embed([input.request.query]);
    timings.queryEmbeddingMs = Date.now() - embedStarted;
    logBase.embeddingDigest = input.embedder.digest;
  } catch (error) {
    return finish(
      {
        kind: 'insufficient_evidence',
        insufficientEvidence: {
          explanation:
            'The query could not be embedded, so no passages were retrieved.',
          missingEvidence: ['query embedding'],
        },
      },
      {
        resolvedEdition: temporal.edition,
        resolutionReason: temporal.reason,
        evidenceSnapshot: [],
        outcome: 'INSUFFICIENT_EVIDENCE',
        policyRejections: [
          {
            code: 'EMBEDDING_FAILED',
            detail: error instanceof Error ? error.message : 'embed failed',
          },
        ],
      },
    );
  }

  const retrieved = await retrieveHybrid(db, {
    query: input.request.query,
    queryEmbedding,
    filters: {
      edition: temporal.edition,
      embeddingModel: input.embedder.model,
      embeddingDigest: input.embedder.digest,
      embeddingDimensions: input.embedder.dimensions,
    },
    config: input.config,
  });
  timings.semanticMs = retrieved.semanticMs;
  timings.lexicalMs = retrieved.lexicalMs;
  timings.fusionMs = retrieved.fusionMs;
  timings.retrievalMs = Date.now() - retrievalStarted;

  const evidenceSnapshot = retrieved.chunks.map((chunk) => ({
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    documentVersion: chunk.documentVersion,
    chunkSetId: chunk.chunkSetId,
    rank: chunk.rank,
    fusionScore: chunk.fusionScore,
    semanticRank: chunk.semanticRank,
    lexicalRank: chunk.lexicalRank,
    locator: chunk.locator,
  }));

  if (retrieved.chunks.length === 0) {
    return finish(
      {
        kind: 'insufficient_evidence',
        insufficientEvidence: {
          explanation: `No published passages were retrieved for edition ${temporal.edition}.`,
          missingEvidence: ['retrieved passages'],
        },
      },
      {
        resolvedEdition: temporal.edition,
        resolutionReason: temporal.reason,
        evidenceSnapshot,
        outcome: 'INSUFFICIENT_EVIDENCE',
        policyRejections: [],
      },
    );
  }

  const presented = retrieved.chunks.map((chunk) => ({
    label: evidenceLabelText(chunk.evidenceLabel),
    chunkId: chunk.chunkId,
    sourceText: chunk.sourceText,
    evidenceLabel: chunk.evidenceLabel,
    maxExcerptChars: chunk.maxExcerptChars,
  }));

  const generationStarted = Date.now();
  let generated: Awaited<ReturnType<AnswerGenerator['generate']>> | null = null;
  try {
    generated = await input.generator.generate({
      query: input.request.query,
      edition: temporal.edition,
      evidence: presented,
    });
  } catch {
    generated = null;
  }
  timings.generationMs = Date.now() - generationStarted;
  logBase.llmDigest = input.generator.digest;

  const policyStarted = Date.now();
  const policy = applyPolicy(generated, presented);
  timings.policyMs = Date.now() - policyStarted;

  const evidenceItems: EvidenceItem[] = retrieved.chunks.map((chunk) => ({
    id: chunk.chunkId,
    label: evidenceLabelText(chunk.evidenceLabel),
    excerpt: capExcerpt(chunk.sourceText, chunk.maxExcerptChars),
    sourceTitle: chunk.title,
    canonicalUrl: chunk.canonicalUrl,
    edition: chunk.edition,
    effectiveFrom: chunk.effectiveFrom.toISOString(),
    effectiveTo: chunk.effectiveTo ? chunk.effectiveTo.toISOString() : null,
    locator: chunk.locator,
    rank: chunk.rank,
  }));

  const diagnostics: Diagnostics[] | undefined = input.config.diagnosticsEnabled
    ? retrieved.chunks.map((chunk) => ({
        fusionScore: chunk.fusionScore,
        semanticRank: chunk.semanticRank,
        lexicalRank: chunk.lexicalRank,
        cosineDistance: chunk.cosineDistance,
        tsRank: chunk.tsRank,
      }))
    : undefined;

  if (policy.outcome === 'clarification') {
    return finish(
      {
        kind: 'clarification',
        clarification: {
          question:
            policy.clarificationQuestion ?? 'Please clarify the question.',
          reason: 'ambiguous_scope',
        },
      },
      {
        resolvedEdition: temporal.edition,
        resolutionReason: temporal.reason,
        evidenceSnapshot,
        outcome: 'CLARIFICATION',
        policyRejections: policy.rejections,
      },
    );
  }

  if (policy.outcome !== 'answer' || policy.answerUnits.length === 0) {
    return finish(
      {
        kind: 'insufficient_evidence',
        insufficientEvidence: {
          explanation:
            'The approved corpus does not support a reliable cited answer for this question.',
          missingEvidence:
            policy.missingEvidence.length > 0
              ? policy.missingEvidence
              : ['policy-valid cited answer units'],
        },
      },
      {
        resolvedEdition: temporal.edition,
        resolutionReason: temporal.reason,
        evidenceSnapshot,
        outcome: 'INSUFFICIENT_EVIDENCE',
        policyRejections: policy.rejections,
      },
    );
  }

  return finish(
    {
      kind: 'answer',
      answer: {
        answerUnits: policy.answerUnits,
        evidence: evidenceItems,
        resolvedEdition: temporal.edition,
        resolutionReason: temporal.reason,
      },
      diagnostics,
    },
    {
      resolvedEdition: temporal.edition,
      resolutionReason: temporal.reason,
      evidenceSnapshot,
      outcome: 'ANSWER',
      policyRejections: policy.rejections,
    },
  );
}
