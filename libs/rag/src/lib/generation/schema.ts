import { z } from 'zod';

export const GeneratedAnswerSchema = z.object({
  outcome: z.enum(['answer', 'clarification', 'insufficient_evidence']),
  answerUnits: z.array(
    z.object({
      text: z.string(),
      type: z.enum(['summary', 'quote']),
      citations: z.array(z.string()),
    }),
  ),
  clarificationQuestion: z.string().nullable(),
  missingEvidence: z.array(z.string()),
});

export type GeneratedAnswer = z.infer<typeof GeneratedAnswerSchema>;

export type AnswerUnit = GeneratedAnswer['answerUnits'][number];

export const GENERATION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    outcome: {
      type: 'string',
      enum: ['answer', 'clarification', 'insufficient_evidence'],
    },
    answerUnits: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
          type: { type: 'string', enum: ['summary', 'quote'] },
          citations: { type: 'array', items: { type: 'string' } },
        },
        required: ['text', 'type', 'citations'],
      },
    },
    clarificationQuestion: { type: ['string', 'null'] },
    missingEvidence: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'outcome',
    'answerUnits',
    'clarificationQuestion',
    'missingEvidence',
  ],
} as const;

export type PresentedEvidence = {
  label: string;
  chunkId: string;
  sourceText: string;
  evidenceLabel: 'OFFICIAL_LAW' | 'OFFICIAL_DECISION' | 'OFFICIAL_EXPLANATION';
  maxExcerptChars: number;
};

export type GenerationInput = {
  query: string;
  edition: string;
  evidence: PresentedEvidence[];
};

export type AnswerGenerator = {
  readonly model: string;
  readonly digest: string;
  generate(input: GenerationInput): Promise<GeneratedAnswer>;
};
