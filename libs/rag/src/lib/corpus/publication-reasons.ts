export type PublishContext = {
  family: { rightsStatus: string };
  document: {
    extractionGatePassed: boolean;
    edition: string | null;
    effectiveFrom: Date | null;
    duplicateFlagStatus: string;
  };
  chunkSet: {
    status: string;
    chunkCount: number;
    expectedChunkCount: number;
    embeddingModel: string;
    embeddingDigest: string;
    embeddingDimensions: number;
    completeEmbeddings: boolean;
  } | null;
  forceExtractionGate: boolean;
  activeEmbedding: { model: string; digest: string; dimensions: number };
};

export function publicationReasons(ctx: PublishContext): string[] {
  const reasons: string[] = [];
  if (ctx.family.rightsStatus !== 'APPROVED') {
    reasons.push('RIGHTS_NOT_APPROVED');
  }
  if (!ctx.document.extractionGatePassed && !ctx.forceExtractionGate) {
    reasons.push('EXTRACTION_GATE_FAILED');
  }
  if (!ctx.document.edition) {
    reasons.push('MISSING_EDITION');
  }
  if (!ctx.document.effectiveFrom) {
    reasons.push('MISSING_EFFECTIVE_FROM');
  }
  if (ctx.document.duplicateFlagStatus !== 'NONE') {
    reasons.push('UNRESOLVED_DUPLICATE');
  }
  if (!ctx.chunkSet) {
    reasons.push('CHUNK_SET_NOT_READY');
    return reasons;
  }
  if (ctx.chunkSet.status !== 'READY' && ctx.chunkSet.status !== 'ACTIVE') {
    reasons.push('CHUNK_SET_NOT_READY');
  }
  if (ctx.chunkSet.chunkCount !== ctx.chunkSet.expectedChunkCount) {
    reasons.push('CHUNK_COUNT_MISMATCH');
  }
  if (!ctx.chunkSet.completeEmbeddings) {
    reasons.push('EMBEDDING_INCOMPLETE');
  }
  if (
    ctx.chunkSet.embeddingModel !== ctx.activeEmbedding.model ||
    ctx.chunkSet.embeddingDigest !== ctx.activeEmbedding.digest ||
    ctx.chunkSet.embeddingDimensions !== ctx.activeEmbedding.dimensions
  ) {
    reasons.push('EMBEDDING_MODEL_MISMATCH');
  }
  return reasons;
}
