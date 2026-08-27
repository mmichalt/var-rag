-- Ask the Laws domain models. pgvector is already enabled.
-- vector(768) width is explicit: Prisma 7 drifts on a dimensionless vector.
-- searchVector is a generated column; Prisma cannot express the GIN index.

CREATE TYPE "RightsStatus" AS ENUM ('NOT_ASSESSED', 'APPROVED', 'REJECTED');
CREATE TYPE "UsageStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "DocumentStatus" AS ENUM ('STAGED', 'PUBLISHED', 'RETIRED');
CREATE TYPE "DuplicateFlagStatus" AS ENUM ('NONE', 'LIKELY_DUPLICATE');
CREATE TYPE "ChunkSetStatus" AS ENUM ('BUILDING', 'READY', 'ACTIVE', 'SUPERSEDED', 'FAILED');
CREATE TYPE "EvidenceLabel" AS ENUM ('OFFICIAL_LAW', 'OFFICIAL_DECISION', 'OFFICIAL_EXPLANATION');
CREATE TYPE "ActorTrust" AS ENUM ('UNAUTHENTICATED', 'AUTHENTICATED');
CREATE TYPE "AskOutcome" AS ENUM ('ANSWER', 'CLARIFICATION', 'INSUFFICIENT_EVIDENCE');

CREATE TABLE "SourceFamily" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "urlPattern" TEXT NOT NULL,
    "authorityLevel" TEXT NOT NULL,
    "rightsStatus" "RightsStatus" NOT NULL,
    "usageBasis" TEXT NOT NULL,
    "displayPolicy" TEXT NOT NULL,
    "maxExcerptChars" INTEGER NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "usageStatus" "UsageStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastIngestedAt" TIMESTAMP(3),
    CONSTRAINT "SourceFamily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SourceFamily_name_key" ON "SourceFamily"("name");

CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "edition" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "publishedDate" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "mediaType" TEXT NOT NULL,
    "contentSha256" TEXT NOT NULL,
    "normalizedTextSha256" TEXT,
    "duplicateFlagStatus" "DuplicateFlagStatus" NOT NULL DEFAULT 'NONE',
    "rawContent" BYTEA NOT NULL,
    "extractedText" TEXT,
    "extractionReport" JSONB,
    "extractionGatePassed" BOOLEAN NOT NULL DEFAULT false,
    "status" "DocumentStatus" NOT NULL DEFAULT 'STAGED',
    "version" INTEGER NOT NULL,
    "supersedesId" TEXT,
    "activeChunkSetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SourceDocument_supersedesId_key" ON "SourceDocument"("supersedesId");
CREATE UNIQUE INDEX "SourceDocument_activeChunkSetId_key" ON "SourceDocument"("activeChunkSetId");
CREATE UNIQUE INDEX "SourceDocument_familyId_contentSha256_key" ON "SourceDocument"("familyId", "contentSha256");
CREATE INDEX "SourceDocument_familyId_status_idx" ON "SourceDocument"("familyId", "status");
CREATE INDEX "SourceDocument_status_edition_idx" ON "SourceDocument"("status", "edition");

CREATE TABLE "ChunkSet" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkingVersion" TEXT NOT NULL,
    "normalizationVersion" TEXT NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "embeddingDigest" TEXT NOT NULL,
    "embeddingDimensions" INTEGER NOT NULL,
    "status" "ChunkSetStatus" NOT NULL,
    "expectedChunkCount" INTEGER NOT NULL,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    CONSTRAINT "ChunkSet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChunkSet_identity_building_ready_key"
    ON "ChunkSet"("documentId", "chunkingVersion", "normalizationVersion", "embeddingModel", "embeddingDigest")
    WHERE status IN ('BUILDING', 'READY');

CREATE TABLE "Chunk" (
    "id" TEXT NOT NULL,
    "chunkSetId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "sourceText" TEXT NOT NULL,
    "retrievalText" TEXT NOT NULL,
    "locator" JSONB NOT NULL,
    "evidenceLabel" "EvidenceLabel" NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "embedding" vector(768),
    CONSTRAINT "Chunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Chunk_chunkSetId_ordinal_key" ON "Chunk"("chunkSetId", "ordinal");
CREATE INDEX "Chunk_chunkSetId_idx" ON "Chunk"("chunkSetId");
CREATE INDEX "Chunk_documentId_idx" ON "Chunk"("documentId");

ALTER TABLE "Chunk"
    ADD COLUMN "searchVector" tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce("retrievalText", ''))) STORED;

CREATE INDEX "Chunk_searchVector_idx" ON "Chunk" USING GIN ("searchVector");

CREATE TABLE "CorpusRevision" (
    "revision" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "indexConfig" JSONB NOT NULL,
    CONSTRAINT "CorpusRevision_pkey" PRIMARY KEY ("revision")
);

CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "actorTrust" "ActorTrust" NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnswerLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "requestedFilters" JSONB NOT NULL,
    "resolvedEdition" TEXT,
    "resolutionReason" TEXT,
    "retrievalConfig" JSONB NOT NULL,
    "evidenceSnapshot" JSONB NOT NULL,
    "corpusRevision" INTEGER,
    "corpusFingerprint" TEXT,
    "llmModel" TEXT NOT NULL,
    "llmDigest" TEXT NOT NULL,
    "llmOptions" JSONB NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "embeddingDigest" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "retrievalVersion" TEXT NOT NULL,
    "chunkingVersion" TEXT NOT NULL,
    "outcome" "AskOutcome" NOT NULL,
    "policyRejections" JSONB NOT NULL,
    "timings" JSONB NOT NULL,
    CONSTRAINT "AnswerLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnswerLog_createdAt_idx" ON "AnswerLog"("createdAt");
CREATE INDEX "AnswerLog_requestId_idx" ON "AnswerLog"("requestId");

ALTER TABLE "SourceDocument"
    ADD CONSTRAINT "SourceDocument_familyId_fkey"
    FOREIGN KEY ("familyId") REFERENCES "SourceFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SourceDocument"
    ADD CONSTRAINT "SourceDocument_supersedesId_fkey"
    FOREIGN KEY ("supersedesId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChunkSet"
    ADD CONSTRAINT "ChunkSet_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SourceDocument"
    ADD CONSTRAINT "SourceDocument_activeChunkSetId_fkey"
    FOREIGN KEY ("activeChunkSetId") REFERENCES "ChunkSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Chunk"
    ADD CONSTRAINT "Chunk_chunkSetId_fkey"
    FOREIGN KEY ("chunkSetId") REFERENCES "ChunkSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Chunk"
    ADD CONSTRAINT "Chunk_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "SourceFamily" (
    "id",
    "name",
    "owner",
    "urlPattern",
    "authorityLevel",
    "rightsStatus",
    "usageBasis",
    "displayPolicy",
    "maxExcerptChars",
    "approvedBy",
    "approvedAt",
    "usageStatus"
) VALUES
(
    'family_ifab',
    'ifab',
    'The IFAB',
    'https://www.theifab.com/**',
    'official',
    'NOT_ASSESSED',
    'No approved usage basis. See docs/corpus.md. Acquisition is refused.',
    'Not displayable until rights are assessed.',
    400,
    NULL,
    NULL,
    'ACTIVE'
),
(
    'family_synthetic_lawbook',
    'synthetic-lawbook',
    'Football VAR Decision Explorer',
    'https://example.invalid/lawbook/**',
    'official',
    'APPROVED',
    'Self-owned original development corpus. See docs/corpus.md.',
    'Short excerpts with a link to the canonical fixture URL.',
    400,
    'system-seed',
    CURRENT_TIMESTAMP,
    'ACTIVE'
);
