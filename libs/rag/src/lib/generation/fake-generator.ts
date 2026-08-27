import { FAKE_LLM_DIGEST } from '../versions.js';
import type {
  AnswerGenerator,
  GeneratedAnswer,
  GenerationInput,
} from './schema.js';

export class FakeAnswerGenerator implements AnswerGenerator {
  readonly digest = FAKE_LLM_DIGEST;

  constructor(readonly model: string) {}

  generate(input: GenerationInput): Promise<GeneratedAnswer> {
    if (input.evidence.length === 0) {
      return Promise.resolve({
        outcome: 'insufficient_evidence',
        answerUnits: [],
        clarificationQuestion: null,
        missingEvidence: ['no retrieved passages'],
      });
    }
    const first = input.evidence[0];
    const summary = first.sourceText.slice(
      0,
      Math.min(280, first.sourceText.length),
    );
    return Promise.resolve({
      outcome: 'answer',
      answerUnits: [
        {
          text: summary,
          type: 'summary',
          citations: ['E1'],
        },
      ],
      clarificationQuestion: null,
      missingEvidence: [],
    });
  }
}
