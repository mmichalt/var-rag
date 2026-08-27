import { buildExtractionReport, extractionGatePassed } from './report.js';
import { PAGE_CHAR_THRESHOLD } from '../versions.js';

describe('extraction report', () => {
  it('fails the gate when median page length is below the threshold', () => {
    const report = buildExtractionReport({
      pages: ['short', 'tiny', 'no'],
      hyphenRepairs: 0,
      ligatureRepairs: 0,
      repeatedHeaderFooterLinesRemoved: [],
    });
    expect(report.medianCharsPerPage).toBeLessThan(PAGE_CHAR_THRESHOLD);
    expect(extractionGatePassed(report)).toBe(false);
  });

  it('passes when laws are covered and pages have enough text', () => {
    const body = 'x'.repeat(200);
    const pages = [
      `LAW 1 The Field\n${body}`,
      `LAW 2 The Ball\n${body}`,
      `LAW 5 The Referee\n${body}`,
      `LAW 11 Offside\n${body}`,
      `LAW 12 Fouls\n${body}`,
      `LAW 13 Free Kicks\n${body}`,
      `LAW 14 Penalty\n${body}`,
    ];
    const report = buildExtractionReport({
      pages,
      hyphenRepairs: 0,
      ligatureRepairs: 0,
      repeatedHeaderFooterLinesRemoved: [],
    });
    expect(report.expectedCoverageRatio).toBe(1);
    expect(extractionGatePassed(report)).toBe(true);
  });
});
