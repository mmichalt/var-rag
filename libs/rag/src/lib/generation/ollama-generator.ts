import { resolveModelDigest } from '../ollama/digest.js';
import { buildAskPrompt } from './prompt.js';
import {
  GENERATION_JSON_SCHEMA,
  GeneratedAnswerSchema,
  type AnswerGenerator,
  type GeneratedAnswer,
  type GenerationInput,
} from './schema.js';

export class OllamaAnswerGenerator implements AnswerGenerator {
  digest = '';

  constructor(
    private readonly baseUrl: string,
    readonly model: string,
    private readonly options: {
      temperature: number;
      seed: number;
      numCtx: number;
    },
  ) {}

  async generate(input: GenerationInput): Promise<GeneratedAnswer> {
    if (!this.digest) {
      this.digest = await resolveModelDigest(this.baseUrl, this.model);
    }
    const prompt = buildAskPrompt(input);
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: GENERATION_JSON_SCHEMA,
        options: {
          temperature: this.options.temperature,
          seed: this.options.seed,
          num_ctx: this.options.numCtx,
        },
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`Ollama chat failed: ${response.status}`);
    }
    const body = (await response.json()) as {
      message?: { content?: string };
    };
    const raw = body.message?.content ?? '';
    try {
      return GeneratedAnswerSchema.parse(JSON.parse(raw));
    } catch {
      return {
        outcome: 'insufficient_evidence',
        answerUnits: [],
        clarificationQuestion: null,
        missingEvidence: ['unparseable model output'],
      };
    }
  }
}
