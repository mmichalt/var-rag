import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractText } from 'unpdf';
import { normalizePages } from '../normalization/normalize.js';
import {
  buildExtractionReport,
  extractionGatePassed,
  type ExtractionReport,
} from './report.js';

export type ExtractedDocument = {
  pages: string[];
  extractedText: string;
  report: ExtractionReport;
  gatePassed: boolean;
};

type PageExtract = { text: string[]; totalPages: number };

function unpdfRequireFrom(): string {
  const candidates = [
    join(process.cwd(), 'package.json'),
    join(process.cwd(), 'libs/rag/package.json'),
    join(process.cwd(), '../../libs/rag/package.json'),
  ];
  for (const candidate of candidates) {
    try {
      createRequire(candidate).resolve('unpdf');
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error('unpdf is not resolvable from the current working directory');
}

function extractPagesInChild(bytes: Uint8Array): PageExtract {
  const dir = mkdtempSync(join(tmpdir(), 'var-rag-pdf-'));
  const pdfPath = join(dir, 'doc.pdf');
  writeFileSync(pdfPath, bytes);
  try {
    const from = unpdfRequireFrom();
    const script = `
      const { createRequire } = require('node:module');
      const { readFileSync } = require('node:fs');
      const req = createRequire(${JSON.stringify(from)});
      const { extractText } = req('unpdf');
      (async () => {
        const bytes = new Uint8Array(readFileSync(process.argv[1]));
        const r = await extractText(bytes, { mergePages: false });
        process.stdout.write(JSON.stringify({
          totalPages: r.totalPages,
          text: Array.isArray(r.text) ? r.text : [r.text],
        }));
      })().catch((err) => { console.error(err); process.exit(1); });
    `;
    const result = spawnSync(process.execPath, ['-e', script, pdfPath], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    if (result.status !== 0) {
      throw new Error(
        `PDF extraction child process failed: ${result.stderr || result.stdout}`,
      );
    }
    return JSON.parse(result.stdout) as PageExtract;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function extractPages(bytes: Uint8Array): Promise<PageExtract> {
  // ponytail: Jest's VM cannot dynamic-import unpdf/pdfjs. Spawn real Node
  // under Jest; drop this branch if tests run outside that VM.
  if (process.env.JEST_WORKER_ID) {
    return extractPagesInChild(bytes);
  }
  const { text, totalPages } = await extractText(bytes, { mergePages: false });
  return { text: Array.isArray(text) ? text : [text], totalPages };
}

export async function extractPdf(
  bytes: Uint8Array,
  expectedLaws?: readonly string[],
): Promise<ExtractedDocument> {
  const extracted = await extractPages(bytes);
  const normalized = normalizePages(extracted.text);
  const report = buildExtractionReport({
    pages: normalized.pages,
    hyphenRepairs: normalized.hyphenRepairs,
    ligatureRepairs: normalized.ligatureRepairs,
    repeatedHeaderFooterLinesRemoved:
      normalized.repeatedHeaderFooterLinesRemoved,
    expectedLaws,
  });
  return {
    pages: normalized.pages,
    extractedText: normalized.pages.join('\n\f\n'),
    report,
    gatePassed: extractionGatePassed(report),
  };
}
