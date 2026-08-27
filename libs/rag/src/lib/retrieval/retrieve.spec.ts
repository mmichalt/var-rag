import { VISIBILITY_SQL } from '../versions.js';
import { passesRelevanceCutoff } from './retrieve.js';

describe('passesRelevanceCutoff', () => {
  it('keeps a hit at or below the cosine-distance ceiling', () => {
    expect(passesRelevanceCutoff(0.7, 0.7)).toBe(true);
  });

  it('drops a hit above the cosine-distance ceiling', () => {
    expect(passesRelevanceCutoff(0.7015, 0.7)).toBe(false);
  });

  it('drops a hit with no cosine distance', () => {
    expect(passesRelevanceCutoff(null, 0.7)).toBe(false);
  });
});

describe('VISIBILITY_SQL', () => {
  it('requires an approved and active source family', () => {
    expect(VISIBILITY_SQL).toContain(`f."rightsStatus" = 'APPROVED'`);
    expect(VISIBILITY_SQL).toContain(`f."usageStatus" = 'ACTIVE'`);
  });
});
