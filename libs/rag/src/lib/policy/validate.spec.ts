import { applyPolicy } from './validate.js';
import type {
  GeneratedAnswer,
  PresentedEvidence,
} from '../generation/schema.js';

const evidence: PresentedEvidence[] = [
  {
    label: 'Official law',
    chunkId: 'c1',
    sourceText:
      'A player is penalised for handball if they deliberately touch the ball with their hand or arm.',
    evidenceLabel: 'OFFICIAL_LAW',
    maxExcerptChars: 400,
  },
];

const schemaOk = (
  overrides: Partial<GeneratedAnswer> &
    Pick<GeneratedAnswer, 'answerUnits' | 'outcome'>,
): GeneratedAnswer => ({
  clarificationQuestion: null,
  missingEvidence: [],
  ...overrides,
});

describe('applyPolicy', () => {
  it('rejects an answer unit with empty citations', () => {
    const result = applyPolicy(
      schemaOk({
        outcome: 'answer',
        answerUnits: [
          { text: 'Handball is an offence.', type: 'summary', citations: [] },
        ],
      }),
      evidence,
    );
    expect(result.outcome).toBe('insufficient_evidence');
    expect(result.rejections.map((r) => r.code)).toContain('EMPTY_CITATIONS');
  });

  it('rejects a citation that does not resolve', () => {
    const result = applyPolicy(
      schemaOk({
        outcome: 'answer',
        answerUnits: [
          {
            text: 'Handball is an offence.',
            type: 'summary',
            citations: ['E99'],
          },
        ],
      }),
      evidence,
    );
    expect(result.rejections.map((r) => r.code)).toContain(
      'UNRESOLVED_CITATION',
    );
  });

  it('rejects a quote that is not verbatim', () => {
    const result = applyPolicy(
      schemaOk({
        outcome: 'answer',
        answerUnits: [
          {
            text: 'Handball is always a red card.',
            type: 'quote',
            citations: ['E1'],
          },
        ],
      }),
      evidence,
    );
    expect(result.rejections.map((r) => r.code)).toContain(
      'QUOTE_NOT_VERBATIM',
    );
  });

  it('accepts a verbatim quote from sourceText', () => {
    const quote =
      'A player is penalised for handball if they deliberately touch the ball with their hand or arm.';
    const result = applyPolicy(
      schemaOk({
        outcome: 'answer',
        answerUnits: [{ text: quote, type: 'quote', citations: ['E1'] }],
      }),
      evidence,
    );
    expect(result.outcome).toBe('answer');
    expect(result.answerUnits).toHaveLength(1);
  });

  it('accepts an extractive summary from sourceText', () => {
    const result = applyPolicy(
      schemaOk({
        outcome: 'answer',
        answerUnits: [
          {
            text: 'A player is penalised for handball',
            type: 'summary',
            citations: ['E1'],
          },
        ],
      }),
      evidence,
    );
    expect(result.outcome).toBe('answer');
  });

  it('rejects a summary that is not supported by cited passages', () => {
    const result = applyPolicy(
      schemaOk({
        outcome: 'answer',
        answerUnits: [
          {
            text: 'Law 99 is the only law',
            type: 'summary',
            citations: ['E1'],
          },
        ],
      }),
      evidence,
    );
    expect(result.rejections.map((r) => r.code)).toContain(
      'SUMMARY_NOT_GROUNDED',
    );
    expect(result.outcome).toBe('insufficient_evidence');
  });

  it('rejects verdict language without an official finding', () => {
    const findingEvidence: PresentedEvidence[] = [
      {
        label: 'Official law',
        chunkId: 'c1',
        sourceText: 'The referee was wrong to give a penalty.',
        evidenceLabel: 'OFFICIAL_LAW',
        maxExcerptChars: 400,
      },
    ];
    const result = applyPolicy(
      schemaOk({
        outcome: 'answer',
        answerUnits: [
          {
            text: 'The referee was wrong to give a penalty.',
            type: 'summary',
            citations: ['E1'],
          },
        ],
      }),
      findingEvidence,
    );
    expect(result.rejections.map((r) => r.code)).toContain(
      'VERDICT_WITHOUT_FINDING',
    );
  });

  it('abstains on unparseable output', () => {
    const result = applyPolicy(null, evidence);
    expect(result.outcome).toBe('insufficient_evidence');
    expect(result.rejections.map((r) => r.code)).toContain('SCHEMA_VIOLATION');
  });
});
