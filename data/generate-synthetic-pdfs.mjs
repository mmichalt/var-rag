#!/usr/bin/env node
/**
 * Writes the two self-owned synthetic lawbook PDFs used as the development corpus.
 * Run from repo root: node data/generate-synthetic-pdfs.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const book = JSON.parse(
  readFileSync(join(here, 'synthetic-lawbook.json'), 'utf8'),
);

function cloneLaws(editionKey) {
  const edition = book.editions[editionKey];
  if (edition.laws?.length) {
    return structuredClone(edition.laws);
  }
  const base = structuredClone(book.editions[edition.basedOn].laws);
  if (!edition.reword) {
    return base;
  }
  for (const law of base) {
    if (law.number !== edition.reword.lawNumber) {
      continue;
    }
    for (const section of law.sections) {
      if (section.heading === edition.reword.section) {
        section.paragraphs = edition.reword.paragraphs;
      }
    }
  }
  return base;
}

function wrapLine(text, max = 88) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

function pageLines(header, law, pageNumber, totalPages) {
  const lines = [header, '', `LAW ${law.number} – ${law.title}`, ''];
  for (const section of law.sections) {
    lines.push(section.heading);
    lines.push('');
    for (const paragraph of section.paragraphs) {
      lines.push(...wrapLine(paragraph));
      lines.push('');
    }
  }
  lines.push(`Page ${pageNumber} of ${totalPages}`);
  return lines;
}

function pdfEscape(text) {
  return text
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

function buildPdf(header, laws) {
  const pages = laws.map((law, index) =>
    pageLines(header, law, index + 1, laws.length),
  );

  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  const objects = {
    [fontId]: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  };

  const pageIds = [];
  let nextId = 4;

  for (const lines of pages) {
    const contentId = nextId++;
    const pageId = nextId++;
    pageIds.push(pageId);
    const ops = ['BT', '/F1 11 Tf', '14 TL', '72 720 Td'];
    for (const line of lines) {
      ops.push(`(${pdfEscape(line)}) Tj`, 'T*');
    }
    ops.push('ET');
    const stream = ops.join('\n');
    objects[contentId] =
      `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`;
    objects[pageId] =
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`;
  }

  objects[pagesId] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

  const maxId = nextId - 1;
  const chunks = ['%PDF-1.4\n'];
  const offsets = [0];
  for (let id = 1; id <= maxId; id++) {
    offsets[id] = Buffer.byteLength(chunks.join(''), 'utf8');
    chunks.push(`${id} 0 obj\n${objects[id]}\nendobj\n`);
  }

  const xrefOffset = Buffer.byteLength(chunks.join(''), 'utf8');
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) {
    xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  chunks.push(xref);
  chunks.push(
    `trailer\n<< /Size ${maxId + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );
  return Buffer.from(chunks.join(''), 'utf8');
}

const files = [
  {
    editionKey: '2025/26',
    filename: 'synthetic-lawbook-2025-26.pdf',
    header: 'Synthetic Lawbook 2025/26 — development fixture',
  },
  {
    editionKey: '2026/27',
    filename: 'synthetic-lawbook-2026-27.pdf',
    header: 'Synthetic Lawbook 2026/27 — development fixture',
  },
];

for (const file of files) {
  const laws = cloneLaws(file.editionKey);
  const pdf = buildPdf(file.header, laws);
  const path = join(here, file.filename);
  writeFileSync(path, pdf);
  console.log(`wrote ${path} (${pdf.length} bytes, ${laws.length} pages)`);
}
