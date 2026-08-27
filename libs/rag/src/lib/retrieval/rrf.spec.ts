import { rrfFuse } from './rrf.js';

describe('rrfFuse', () => {
  it('ranks an item that appears in both lists above a single-list item', () => {
    const fused = rrfFuse(
      [
        { id: 'a', rank: 1 },
        { id: 'b', rank: 2 },
      ],
      [
        { id: 'c', rank: 1 },
        { id: 'a', rank: 2 },
      ],
      60,
    );
    expect(fused[0].id).toBe('a');
    expect(fused[0].semanticRank).toBe(1);
    expect(fused[0].lexicalRank).toBe(2);
    expect(fused.map((hit) => hit.id).sort()).toEqual(['a', 'b', 'c']);
  });
});
