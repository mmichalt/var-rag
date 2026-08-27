export type RankedId = { id: string; rank: number };

export type FusedHit = {
  id: string;
  fusionScore: number;
  semanticRank: number | null;
  lexicalRank: number | null;
};

export function rrfFuse(
  semantic: RankedId[],
  lexical: RankedId[],
  k: number,
): FusedHit[] {
  const scores = new Map<string, FusedHit>();
  const add = (
    list: RankedId[],
    field: 'semanticRank' | 'lexicalRank',
  ): void => {
    for (const item of list) {
      const current = scores.get(item.id) ?? {
        id: item.id,
        fusionScore: 0,
        semanticRank: null,
        lexicalRank: null,
      };
      current.fusionScore += 1 / (k + item.rank);
      current[field] = item.rank;
      scores.set(item.id, current);
    }
  };
  add(semantic, 'semanticRank');
  add(lexical, 'lexicalRank');
  return [...scores.values()].sort(
    (a, b) =>
      b.fusionScore - a.fusionScore ||
      (a.semanticRank ?? 999) - (b.semanticRank ?? 999) ||
      a.id.localeCompare(b.id),
  );
}
