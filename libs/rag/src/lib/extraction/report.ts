import {
  EXPECTED_LAW_NUMBERS,
  MAX_EMPTY_PAGE_RATIO,
  MIN_LAW_COVERAGE_RATIO,
  PAGE_CHAR_THRESHOLD,
} from '../versions.js';

export type ExtractionReport = {
  pageCount: number;
  extractedCharacterCount: number;
  minCharsPerPage: number;
  medianCharsPerPage: number;
  pagesBelowThreshold: number[];
  detectedLaws: string[];
  detectedHeadings: string[];
  expectedCoverageRatio: number;
  repeatedHeaderFooterLinesRemoved: string[];
  hyphenRepairs: number;
  ligatureRepairs: number;
  emptyPages: number[];
  readingOrderWarnings: string[];
};

export function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function detectLawNumber(text: string): string | null {
  const match = text.match(/\bLAW\s+(\d+[A-Z]?)\b/i);
  return match?.[1] ?? null;
}

export function detectHeadings(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        line.length < 80 &&
        !line.endsWith('.') &&
        /^[A-Z][A-Za-z0-9 ,''–—-]+$/.test(line),
    );
}

export function readingOrderWarnings(
  pages: string[],
  laws: string[],
): string[] {
  const warnings: string[] = [];
  const numeric = laws
    .map((n) => Number.parseInt(n, 10))
    .filter((n) => Number.isFinite(n));
  for (let i = 1; i < numeric.length; i++) {
    if (numeric[i] < numeric[i - 1]) {
      warnings.push(
        `Law numbers decrease from ${numeric[i - 1]} to ${numeric[i]}`,
      );
    }
  }
  for (let i = 0; i < pages.length; i++) {
    if (pages[i].length > 0 && pages[i].length < 20) {
      warnings.push(
        `Page ${i + 1} has very little text (${pages[i].length} chars)`,
      );
    }
  }
  return warnings;
}

export function buildExtractionReport(input: {
  pages: string[];
  hyphenRepairs: number;
  ligatureRepairs: number;
  repeatedHeaderFooterLinesRemoved: string[];
  expectedLaws?: readonly string[];
}): ExtractionReport {
  const expected = input.expectedLaws ?? EXPECTED_LAW_NUMBERS;
  const charCounts = input.pages.map((page) => page.length);
  const emptyPages = input.pages
    .map((page, i) => (page.trim().length === 0 ? i + 1 : 0))
    .filter((n) => n > 0);
  const pagesBelowThreshold = input.pages
    .map((page, i) => (page.length < PAGE_CHAR_THRESHOLD ? i + 1 : 0))
    .filter((n) => n > 0);
  const detectedLaws = [
    ...new Set(
      input.pages.map(detectLawNumber).filter((n): n is string => n !== null),
    ),
  ];
  const detectedHeadings = [...new Set(input.pages.flatMap(detectHeadings))];
  const expectedCoverageRatio =
    expected.length === 0
      ? 1
      : expected.filter((law) => detectedLaws.includes(law)).length /
        expected.length;

  return {
    pageCount: input.pages.length,
    extractedCharacterCount: charCounts.reduce((sum, n) => sum + n, 0),
    minCharsPerPage: charCounts.length === 0 ? 0 : Math.min(...charCounts),
    medianCharsPerPage: median(charCounts),
    pagesBelowThreshold,
    detectedLaws,
    detectedHeadings,
    expectedCoverageRatio,
    repeatedHeaderFooterLinesRemoved: input.repeatedHeaderFooterLinesRemoved,
    hyphenRepairs: input.hyphenRepairs,
    ligatureRepairs: input.ligatureRepairs,
    emptyPages,
    readingOrderWarnings: readingOrderWarnings(input.pages, detectedLaws),
  };
}

export function extractionGatePassed(report: ExtractionReport): boolean {
  if (report.pageCount < 1) {
    return false;
  }
  if (report.medianCharsPerPage < PAGE_CHAR_THRESHOLD) {
    return false;
  }
  if (report.emptyPages.length / report.pageCount > MAX_EMPTY_PAGE_RATIO) {
    return false;
  }
  return report.expectedCoverageRatio >= MIN_LAW_COVERAGE_RATIO;
}
