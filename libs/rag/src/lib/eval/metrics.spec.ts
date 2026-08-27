import {
  abstentionRate,
  citationCoverage,
  falseAbstentionRate,
  recallAtK,
} from './metrics.js';

describe('eval metrics', () => {
  const questions = [
    {
      id: 'q1',
      query: 'handball',
      answerable: true,
      expectedLawNumbers: ['12'],
      expectedSubstrings: ['handball'],
    },
    {
      id: 'q2',
      query: 'who won',
      answerable: false,
    },
  ];

  it('reports recall, citation coverage, abstention and false abstention', () => {
    expect(
      recallAtK(
        questions,
        {
          q1: [
            {
              lawNumber: '12',
              sourceText: 'A player is penalised for handball',
            },
          ],
        },
        5,
      ),
    ).toBe(1);
    expect(
      citationCoverage([
        { kind: 'answer', cited: true },
        { kind: 'insufficient_evidence', cited: false },
      ]),
    ).toBe(1);
    expect(
      abstentionRate(questions, {
        q2: { kind: 'insufficient_evidence', cited: false },
      }),
    ).toBe(1);
    expect(
      falseAbstentionRate(questions, {
        q1: { kind: 'answer', cited: true },
      }),
    ).toBe(0);
  });
});
