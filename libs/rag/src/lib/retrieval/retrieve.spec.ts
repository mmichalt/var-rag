import { VISIBILITY_SQL } from '../versions.js';
import { passesRelevanceCutoff } from './retrieve.js';

describe('passesRelevanceCutoff', () => {
  it('keeps a lexical hit even when cosine distance is high', () => {
    expect(
      passesRelevanceCutoff({ lexicalRank: 1, cosineDistance: 0.95 }, 0.7),
    ).toBe(true);
  });

  it('keeps a semantic-only hit at or below the distance ceiling', () => {
    expect(
      passesRelevanceCutoff({ lexicalRank: null, cosineDistance: 0.7 }, 0.7),
    ).toBe(true);
  });

  it('drops a semantic-only hit above the distance ceiling', () => {
    expect(
      passesRelevanceCutoff({ lexicalRank: null, cosineDistance: 0.74 }, 0.7),
    ).toBe(false);
  });

  it('drops a hit with neither lexical support nor a distance', () => {
    expect(
      passesRelevanceCutoff({ lexicalRank: null, cosineDistance: null }, 0.7),
    ).toBe(false);
  });
});

describe('VISIBILITY_SQL', () => {
  it('requires an approved and active source family', () => {
    expect(VISIBILITY_SQL).toContain(`f."rightsStatus" = 'APPROVED'`);
    expect(VISIBILITY_SQL).toContain(`f."usageStatus" = 'ACTIVE'`);
  });
});
