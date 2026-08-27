export {
  PROMPT_VERSION,
  POLICY_VERSION,
  RETRIEVAL_VERSION,
  CHUNKING_VERSION,
  NORMALIZATION_VERSION,
  RRF_K,
  HASH_EMBEDDER_DIGEST,
  FAKE_LLM_DIGEST,
  CLI_ACTOR,
  CLI_ACTOR_TRUST,
  EXPECTED_LAW_NUMBERS,
} from './lib/versions.js';
export {
  ChunkLocatorSchema,
  parseLocator,
  type ChunkLocator,
} from './lib/locator.js';
export { sha256Hex, tokenCount } from './lib/hashes.js';
export {
  AcquisitionError,
  assertFamilyApproved,
} from './lib/acquisition/rights.js';
export { ingestDocument, type IngestInput } from './lib/acquisition/ingest.js';
export { extractPdf } from './lib/extraction/extract.js';
export {
  buildExtractionReport,
  extractionGatePassed,
  type ExtractionReport,
} from './lib/extraction/report.js';
export {
  normalizePages,
  normalizeForCompare,
} from './lib/normalization/normalize.js';
export { chunkPages } from './lib/chunking/chunk.js';
export type { Embedder } from './lib/embedding/embedder.js';
export { HashEmbedder } from './lib/embedding/hash-embedder.js';
export { OllamaEmbedder } from './lib/embedding/ollama-embedder.js';
export { resolveModelDigest, clearDigestCache } from './lib/ollama/digest.js';
export type {
  AnswerGenerator,
  GeneratedAnswer,
  GenerationInput,
  PresentedEvidence,
} from './lib/generation/schema.js';
export { FakeAnswerGenerator } from './lib/generation/fake-generator.js';
export { OllamaAnswerGenerator } from './lib/generation/ollama-generator.js';
export { applyPolicy } from './lib/policy/validate.js';
export {
  resolveEdition,
  seasonRange,
  type TemporalRequest,
} from './lib/retrieval/temporal.js';
export { rrfFuse } from './lib/retrieval/rrf.js';
export { retrieveHybrid } from './lib/retrieval/retrieve.js';
export { publicationReasons } from './lib/corpus/publication-reasons.js';
export { ingestAndPublish } from './lib/corpus/pipeline.js';
export { buildChunkSet } from './lib/corpus/chunk-set.js';
export {
  publishDocument,
  activateChunkSet,
  rebuildPublishedChunkSets,
  PublishError,
} from './lib/corpus/publish.js';
export { inspectDocument } from './lib/corpus/inspect.js';
export { retireDocument } from './lib/corpus/retire.js';
export {
  computeCorpusFingerprint,
  latestCorpusRevision,
} from './lib/corpus/fingerprint.js';
export { askLaws, type AskRequest, type AskResponse } from './lib/ask/ask.js';
export {
  loadEvidence,
  listLawEditions,
  type EvidenceRecord,
} from './lib/ask/evidence.js';
export { pruneAnswerLogs } from './lib/ask/prune.js';
export { capExcerpt, evidenceLabelText } from './lib/presentation.js';
export {
  recallAtK,
  citationCoverage,
  abstentionRate,
  falseAbstentionRate,
  type EvalQuestion,
} from './lib/eval/metrics.js';
