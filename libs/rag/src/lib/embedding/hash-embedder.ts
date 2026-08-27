import { createHash } from 'node:crypto';
import { HASH_EMBEDDER_DIGEST } from '../versions.js';
import { assertEmbeddingDimensions, type Embedder } from './embedder.js';

function hashVector(text: string, dimensions: number): number[] {
  const vec = new Array<number>(dimensions).fill(0);
  for (const token of text.toLowerCase().split(/\s+/).filter(Boolean)) {
    const digest = createHash('sha256').update(token).digest();
    const index = digest.readUInt32BE(0) % dimensions;
    const sign = digest[4] % 2 === 0 ? 1 : -1;
    vec[index] += sign;
  }
  const norm = Math.sqrt(vec.reduce((sum, n) => sum + n * n, 0)) || 1;
  return vec.map((n) => n / norm);
}

export class HashEmbedder implements Embedder {
  readonly digest = HASH_EMBEDDER_DIGEST;

  constructor(
    readonly model: string,
    readonly dimensions: number,
  ) {}

  embed(texts: string[]): Promise<number[][]> {
    return Promise.resolve(
      texts.map((text) => {
        const vector = hashVector(text, this.dimensions);
        assertEmbeddingDimensions(vector, this.dimensions);
        return vector;
      }),
    );
  }
}
