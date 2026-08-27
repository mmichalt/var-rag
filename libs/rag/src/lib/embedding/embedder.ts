export type Embedder = {
  readonly model: string;
  readonly digest: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
};

export function assertEmbeddingDimensions(
  vector: number[],
  expected: number,
): void {
  if (vector.length !== expected) {
    throw new Error(
      `Embedding length ${vector.length} does not match EMBEDDING_DIMENSIONS=${expected}`,
    );
  }
}
