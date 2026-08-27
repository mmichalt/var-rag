import { assertFamilyApproved } from './rights.js';

describe('assertFamilyApproved', () => {
  it('allows an APPROVED family', () => {
    expect(() =>
      assertFamilyApproved({
        name: 'synthetic-lawbook',
        rightsStatus: 'APPROVED',
      }),
    ).not.toThrow();
  });

  it('refuses NOT_ASSESSED and REJECTED families', () => {
    expect(() =>
      assertFamilyApproved({ name: 'ifab', rightsStatus: 'NOT_ASSESSED' }),
    ).toThrow(/RIGHTS_NOT_APPROVED|not APPROVED/);
    expect(() =>
      assertFamilyApproved({ name: 'ifab', rightsStatus: 'REJECTED' }),
    ).toThrow(/not APPROVED/);
  });
});
