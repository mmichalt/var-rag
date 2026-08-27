export type EvalQuestion = {
  id: string;
  query: string;
  answerable: boolean;
  edition?: string;
  expectedLawNumbers?: string[];
  expectedSubstrings?: string[];
};

export type EvalRetrievalHit = {
  lawNumber: string | null;
  sourceText: string;
};

export type EvalAnswer = {
  kind: 'answer' | 'clarification' | 'insufficient_evidence';
  cited: boolean;
};

export function recallAtK(
  questions: EvalQuestion[],
  retrieved: Record<string, EvalRetrievalHit[]>,
  k: number,
): number {
  const answerable = questions.filter((q) => q.answerable);
  if (answerable.length === 0) {
    return 0;
  }
  let hits = 0;
  for (const question of answerable) {
    const top = (retrieved[question.id] ?? []).slice(0, k);
    const ok = top.some((hit) => {
      const lawOk =
        !question.expectedLawNumbers ||
        question.expectedLawNumbers.length === 0 ||
        (hit.lawNumber !== null &&
          question.expectedLawNumbers.includes(hit.lawNumber));
      const textOk =
        !question.expectedSubstrings ||
        question.expectedSubstrings.length === 0 ||
        question.expectedSubstrings.some((needle) =>
          hit.sourceText.toLowerCase().includes(needle.toLowerCase()),
        );
      return lawOk && textOk;
    });
    if (ok) {
      hits += 1;
    }
  }
  return hits / answerable.length;
}

export function citationCoverage(answers: EvalAnswer[]): number {
  const factual = answers.filter((answer) => answer.kind === 'answer');
  if (factual.length === 0) {
    return 1;
  }
  return factual.filter((answer) => answer.cited).length / factual.length;
}

export function abstentionRate(
  questions: EvalQuestion[],
  answers: Record<string, EvalAnswer>,
): number {
  const unanswerable = questions.filter((q) => !q.answerable);
  if (unanswerable.length === 0) {
    return 0;
  }
  const abstained = unanswerable.filter((q) => {
    const answer = answers[q.id];
    return (
      answer &&
      (answer.kind === 'insufficient_evidence' ||
        answer.kind === 'clarification')
    );
  });
  return abstained.length / unanswerable.length;
}

export function falseAbstentionRate(
  questions: EvalQuestion[],
  answers: Record<string, EvalAnswer>,
): number {
  const answerable = questions.filter((q) => q.answerable);
  if (answerable.length === 0) {
    return 0;
  }
  const falseAbstained = answerable.filter((q) => {
    const answer = answers[q.id];
    return (
      answer &&
      (answer.kind === 'insufficient_evidence' ||
        answer.kind === 'clarification')
    );
  });
  return falseAbstained.length / answerable.length;
}
