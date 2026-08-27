import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractPdf } from './extract.js';

const pdfPath = [
  resolve(process.cwd(), 'data/synthetic-lawbook-2025-26.pdf'),
  resolve(process.cwd(), '../../data/synthetic-lawbook-2025-26.pdf'),
].find((path) => existsSync(path));

describe('extractPdf', () => {
  (pdfPath ? it : it.skip)(
    'extracts law headings from the synthetic fixture',
    async () => {
      const bytes = readFileSync(pdfPath as string);
      const extracted = await extractPdf(bytes);
      expect(extracted.pages.length).toBe(7);
      expect(extracted.gatePassed).toBe(true);
      expect(extracted.report.detectedLaws).toEqual(
        expect.arrayContaining(['1', '11', '12', '14']),
      );
    },
  );
});
