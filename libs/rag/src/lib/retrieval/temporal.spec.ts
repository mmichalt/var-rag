import { resolveEdition, type PublishedEdition } from './temporal.js';

const published: PublishedEdition[] = [
  {
    edition: '2025/26',
    effectiveFrom: new Date('2025-07-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-06-30T23:59:59.999Z'),
  },
  {
    edition: '2026/27',
    effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
    effectiveTo: null,
  },
];

describe('resolveEdition', () => {
  it('prefers an explicit edition', () => {
    const result = resolveEdition({ edition: '2025/26' }, published);
    expect(result).toEqual({
      ok: true,
      edition: '2025/26',
      reason: 'explicit_edition',
    });
  });

  it('maps asOfDate onto the covering edition', () => {
    const result = resolveEdition({ asOfDate: '2025-08-01' }, published);
    expect(result).toMatchObject({
      ok: true,
      edition: '2025/26',
      reason: 'as_of_date',
    });
  });

  it('maps a season onto the matching edition name', () => {
    const result = resolveEdition({ season: '2026/27' }, published);
    expect(result).toMatchObject({
      ok: true,
      edition: '2026/27',
      reason: 'season_mapping',
    });
  });

  it('defaults to the latest published edition by effectiveFrom', () => {
    const result = resolveEdition({}, published);
    expect(result).toMatchObject({
      ok: true,
      edition: '2026/27',
      reason: 'latest_published',
    });
  });

  it('clarifies when the date is before the earliest edition', () => {
    const result = resolveEdition({ asOfDate: '2024-01-01' }, published);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('ambiguous_edition');
      expect(result.question).toMatch(/earliest effective date/);
    }
  });

  it('clarifies mutually exclusive filters', () => {
    const result = resolveEdition(
      { edition: '2025/26', season: '2025/26' },
      published,
    );
    expect(result.ok).toBe(false);
  });
});
