import { assertEmbeddingDimensions, type Embedder } from './embedder.js';
import { resolveModelDigest } from '../ollama/digest.js';

export class OllamaEmbedder implements Embedder {
  digest = '';

  constructor(
    private readonly baseUrl: string,
    readonly model: string,
    readonly dimensions: number,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.digest) {
      this.digest = await resolveModelDigest(this.baseUrl, this.model);
    }
    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!response.ok) {
      throw new Error(`Ollama embed failed: ${response.status}`);
    }
    const body = (await response.json()) as { embeddings?: number[][] };
    const embeddings = body.embeddings ?? [];
    if (embeddings.length !== texts.length) {
      throw new Error(
        `Ollama returned ${embeddings.length} embeddings for ${texts.length} inputs`,
      );
    }
    for (const vector of embeddings) {
      assertEmbeddingDimensions(vector, this.dimensions);
    }
    return embeddings;
  }
}
