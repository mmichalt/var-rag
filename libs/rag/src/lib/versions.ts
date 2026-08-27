export const PROMPT_VERSION = 'laws-ask-v1';
export const POLICY_VERSION = 'laws-policy-v2';
export const RETRIEVAL_VERSION = 'hybrid-rrf-v2';
export const CHUNKING_VERSION = 'law-heading-v2';
export const NORMALIZATION_VERSION = 'dehyphen-ligature-v1';
export const RRF_K = 60;

export const PAGE_CHAR_THRESHOLD = 80;
export const MAX_EMPTY_PAGE_RATIO = 0.25;
export const MIN_LAW_COVERAGE_RATIO = 0.5;
export const TARGET_CHUNK_TOKENS = 200;
export const MAX_CHUNK_TOKENS = 400;

export const HASH_EMBEDDER_DIGEST = 'sha256:hash-embedder-v1';
export const FAKE_LLM_DIGEST = 'sha256:fake-generator-v1';

export const CLI_ACTOR = 'cli:operator';
export const CLI_ACTOR_TRUST = 'UNAUTHENTICATED' as const;

export const VISIBILITY_SQL = `d.status = 'PUBLISHED' AND c."chunkSetId" = d."activeChunkSetId" AND f."rightsStatus" = 'APPROVED' AND f."usageStatus" = 'ACTIVE'`;

export const VISIBLE_FAMILY = {
  rightsStatus: 'APPROVED',
  usageStatus: 'ACTIVE',
} as const;

export const EXPECTED_LAW_NUMBERS = [
  '1',
  '2',
  '5',
  '11',
  '12',
  '13',
  '14',
] as const;
