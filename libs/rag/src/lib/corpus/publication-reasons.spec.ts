import { publicationReasons } from './publication-reasons.js';

const readySet = {
  status: 'READY',
  chunkCount: 4,
  expectedChunkCount: 4,
  embeddingModel: 'nomic-embed-text',
  embeddingDigest: 'sha256:abc',
  embeddingDimensions: 768,
  completeEmbeddings: true,
};

const active = {
  model: 'nomic-embed-text',
  digest: 'sha256:abc',
  dimensions: 768,
};

const document = {
  extractionGatePassed: true,
  edition: '2025/26',
  effectiveFrom: new Date('2025-07-01T00:00:00.000Z'),
  duplicateFlagStatus: 'NONE',
};

describe('publicationReasons', () => {
  it('returns no reasons when every precondition holds', () => {
    expect(
      publicationReasons({
        family: { rightsStatus: 'APPROVED' },
        document,
        chunkSet: readySet,
        forceExtractionGate: false,
        activeEmbedding: active,
      }),
    ).toEqual([]);
  });

  it.each([
    ['RIGHTS_NOT_APPROVED', { family: { rightsStatus: 'NOT_ASSESSED' } }],
    [
      'EXTRACTION_GATE_FAILED',
      { document: { ...document, extractionGatePassed: false } },
    ],
    ['MISSING_EDITION', { document: { ...document, edition: null } }],
    [
      'MISSING_EFFECTIVE_FROM',
      { document: { ...document, effectiveFrom: null } },
    ],
    [
      'UNRESOLVED_DUPLICATE',
      { document: { ...document, duplicateFlagStatus: 'LIKELY_DUPLICATE' } },
    ],
    ['CHUNK_SET_NOT_READY', { chunkSet: null }],
    ['CHUNK_COUNT_MISMATCH', { chunkSet: { ...readySet, chunkCount: 3 } }],
    [
      'EMBEDDING_INCOMPLETE',
      { chunkSet: { ...readySet, completeEmbeddings: false } },
    ],
    [
      'EMBEDDING_MODEL_MISMATCH',
      { chunkSet: { ...readySet, embeddingDigest: 'sha256:other' } },
    ],
  ] as const)('reports %s', (code, override) => {
    const reasons = publicationReasons({
      family: { rightsStatus: 'APPROVED' },
      document,
      chunkSet: readySet,
      forceExtractionGate: false,
      activeEmbedding: active,
      ...override,
    });
    expect(reasons).toContain(code);
  });

  it('allows forcing the extraction gate', () => {
    const reasons = publicationReasons({
      family: { rightsStatus: 'APPROVED' },
      document: { ...document, extractionGatePassed: false },
      chunkSet: readySet,
      forceExtractionGate: true,
      activeEmbedding: active,
    });
    expect(reasons).not.toContain('EXTRACTION_GATE_FAILED');
  });
});
