import {
  dehyphenate,
  detectRepeatedLines,
  normalizeForCompare,
  normalizePages,
  repairLigatures,
} from './normalize.js';

describe('normalization', () => {
  it('repairs ligatures', () => {
    const result = repairLigatures('oﬃcial ﬂag ﬁeld');
    expect(result.text).toBe('official flag field');
    expect(result.count).toBe(3);
  });

  it('joins hyphenated line breaks', () => {
    const result = dehyphenate('penal-\nised for handball');
    expect(result.text).toBe('penalised for handball');
    expect(result.count).toBe(1);
  });

  it('strips headers and footers that repeat on most pages', () => {
    const pages = [
      'Synthetic Lawbook 2025/26\nLaw 1 text here that is unique.\nPage 1 of 3',
      'Synthetic Lawbook 2025/26\nLaw 11 text here that is unique.\nPage 2 of 3',
      'Synthetic Lawbook 2025/26\nLaw 12 text here that is unique.\nPage 3 of 3',
    ];
    const repeated = detectRepeatedLines(pages);
    expect(repeated).toContain('Synthetic Lawbook 2025/26');
    const normalized = normalizePages(pages);
    expect(normalized.pages[0]).not.toMatch(/Synthetic Lawbook/);
    expect(normalized.pages[0]).toMatch(/Law 1 text/);
  });

  it('normalizes quotes by collapsing whitespace', () => {
    expect(normalizeForCompare('A  player\nis penalised')).toBe(
      'A player is penalised',
    );
  });
});
