import { normalizeForCompare } from '../normalization/normalize.js';
import type {
  AnswerUnit,
  GeneratedAnswer,
  PresentedEvidence,
} from '../generation/schema.js';

export type PolicyRejection = {
  code: string;
  detail: string;
};

const VERDICT_PATTERNS = [
  /\bwas wrong\b/i,
  /\bwere wrong\b/i,
  /\bincorrect decision\b/i,
  /\breferee was incorrect\b/i,
  /\bshould have been (?:overturned|given|awarded)\b/i,
  /\bwrongly (?:given|awarded|denied|sent off)\b/i,
  /\bthe referee (?:erred|got it wrong)\b/i,
];

export function citationIndex(label: string): number | null {
  const match = /^E(\d+)$/.exec(label);
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}

function citedItems(
  unit: AnswerUnit,
  evidence: PresentedEvidence[],
): PresentedEvidence[] | null {
  const items: PresentedEvidence[] = [];
  for (const citation of unit.citations) {
    const index = citationIndex(citation);
    if (index === null || index < 1 || index > evidence.length) {
      return null;
    }
    items.push(evidence[index - 1]);
  }
  return items;
}

export function applyPolicy(
  generated: GeneratedAnswer | null,
  evidence: PresentedEvidence[],
): {
  outcome: GeneratedAnswer['outcome'];
  answerUnits: AnswerUnit[];
  clarificationQuestion: string | null;
  missingEvidence: string[];
  rejections: PolicyRejection[];
} {
  if (!generated) {
    return {
      outcome: 'insufficient_evidence',
      answerUnits: [],
      clarificationQuestion: null,
      missingEvidence: ['unparseable model output'],
      rejections: [{ code: 'SCHEMA_VIOLATION', detail: 'unparseable output' }],
    };
  }

  const rejections: PolicyRejection[] = [];
  const kept: AnswerUnit[] = [];

  for (const [i, unit] of generated.answerUnits.entries()) {
    if (unit.citations.length === 0) {
      rejections.push({
        code: 'EMPTY_CITATIONS',
        detail: `answerUnits[${i}] has no citations`,
      });
      continue;
    }
    const items = citedItems(unit, evidence);
    if (!items) {
      rejections.push({
        code: 'UNRESOLVED_CITATION',
        detail: `answerUnits[${i}] citations ${unit.citations.join(', ')}`,
      });
      continue;
    }
    const extractive = items.some((item) =>
      normalizeForCompare(item.sourceText).includes(
        normalizeForCompare(unit.text),
      ),
    );
    if (!extractive) {
      rejections.push({
        code:
          unit.type === 'quote' ? 'QUOTE_NOT_VERBATIM' : 'SUMMARY_NOT_GROUNDED',
        detail: `answerUnits[${i}] ${unit.type} is not a substring of cited sourceText`,
      });
      continue;
    }
    const overCap = items.find(
      (item) => unit.text.length > item.maxExcerptChars,
    );
    if (overCap) {
      rejections.push({
        code: 'EXCERPT_TOO_LONG',
        detail: `answerUnits[${i}] exceeds maxExcerptChars ${overCap.maxExcerptChars}`,
      });
      continue;
    }
    const hasOfficialFinding = items.some(
      (item) => item.evidenceLabel === 'OFFICIAL_DECISION',
    );
    if (
      !hasOfficialFinding &&
      VERDICT_PATTERNS.some((pattern) => pattern.test(unit.text))
    ) {
      rejections.push({
        code: 'VERDICT_WITHOUT_FINDING',
        detail: `answerUnits[${i}] uses verdict language without a cited official finding`,
      });
      continue;
    }
    kept.push(unit);
  }

  if (generated.outcome === 'clarification') {
    return {
      outcome: 'clarification',
      answerUnits: kept,
      clarificationQuestion: generated.clarificationQuestion,
      missingEvidence: generated.missingEvidence,
      rejections,
    };
  }

  if (generated.outcome === 'insufficient_evidence' || kept.length === 0) {
    return {
      outcome: 'insufficient_evidence',
      answerUnits: [],
      clarificationQuestion: null,
      missingEvidence:
        generated.missingEvidence.length > 0
          ? generated.missingEvidence
          : ['no policy-valid answer units'],
      rejections,
    };
  }

  return {
    outcome: 'answer',
    answerUnits: kept,
    clarificationQuestion: null,
    missingEvidence: [],
    rejections,
  };
}
