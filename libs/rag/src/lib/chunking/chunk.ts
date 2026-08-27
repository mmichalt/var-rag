import type { ChunkLocator } from '../locator.js';
import { ChunkLocatorSchema } from '../locator.js';
import { tokenCount } from '../hashes.js';
import {
  CHUNKING_VERSION,
  MAX_CHUNK_TOKENS,
  TARGET_CHUNK_TOKENS,
} from '../versions.js';
import { detectLawNumber } from '../extraction/report.js';

export type PreparedChunk = {
  ordinal: number;
  sourceText: string;
  retrievalText: string;
  locator: ChunkLocator;
  tokenCount: number;
};

const LAW_HEADING =
  /^(?:LAW\s+(\d+[A-Z]?)\s*[–—-]\s*(.+)|LAW\s+(\d+[A-Z]?)\s+(.+))$/i;
const MAX_SECTION_HEADING_CHARS = 64;
const DANGLING_WRAP =
  /(?:\b(?:a|an|the|of|to|for|with|from|by|at|in|on|or|and))$/i;

function isSectionHeading(line: string): boolean {
  const trimmed = line.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > MAX_SECTION_HEADING_CHARS ||
    trimmed.endsWith('.')
  ) {
    return false;
  }
  if (LAW_HEADING.test(trimmed)) {
    return false;
  }
  if (DANGLING_WRAP.test(trimmed)) {
    return false;
  }
  if (/\b(?:is|are|was|were|if|must|may|has|have)\b/i.test(trimmed)) {
    return false;
  }
  return /^[A-Z][A-Za-z0-9 ,''’–—-]+$/.test(trimmed);
}

function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function splitToTokenCap(text: string, cap: number): string[] {
  if (tokenCount(text) <= cap) {
    return [text];
  }
  const sentences = splitSentences(text);
  if (sentences.length <= 1) {
    const words = text.split(/\s+/);
    const pieces: string[] = [];
    for (let i = 0; i < words.length; i += cap) {
      pieces.push(words.slice(i, i + cap).join(' '));
    }
    return pieces;
  }
  const pieces: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (tokenCount(next) > cap && current) {
      pieces.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }
  if (current) {
    pieces.push(current);
  }
  return pieces.flatMap((piece) =>
    tokenCount(piece) > cap ? splitToTokenCap(piece, cap) : [piece],
  );
}

export function chunkPages(pages: string[]): PreparedChunk[] {
  let lawNumber: string | null = null;
  let lawTitle = '';
  const sectionPath: string[] = [];
  let paragraphOrdinal = 0;
  const prepared: Omit<PreparedChunk, 'ordinal'>[] = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const pageNumber = pageIndex + 1;
    const lines = pages[pageIndex].split('\n');
    let buffer: string[] = [];

    const flush = (): void => {
      const sourceText = buffer.join(' ').replace(/\s+/g, ' ').trim();
      buffer = [];
      if (!sourceText) {
        return;
      }
      paragraphOrdinal += 1;
      const headingPath = [
        lawNumber
          ? `Law ${lawNumber}${lawTitle ? ` – ${lawTitle}` : ''}`
          : null,
        ...sectionPath,
      ].filter((part): part is string => Boolean(part));
      const locator = ChunkLocatorSchema.parse({
        lawNumber,
        headingPath,
        pageStart: pageNumber,
        pageEnd: pageNumber,
        paragraphOrdinal,
      });
      for (const piece of splitToTokenCap(sourceText, MAX_CHUNK_TOKENS)) {
        const retrievalText =
          headingPath.length > 0
            ? `${headingPath.join(' > ')}\n\n${piece}`
            : piece;
        prepared.push({
          sourceText: piece,
          retrievalText,
          locator,
          tokenCount: tokenCount(piece),
        });
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        flush();
        continue;
      }
      const lawMatch = line.match(LAW_HEADING);
      if (lawMatch) {
        flush();
        lawNumber = lawMatch[1] ?? lawMatch[3] ?? detectLawNumber(line);
        lawTitle = (lawMatch[2] ?? lawMatch[4] ?? '').trim();
        sectionPath.length = 0;
        paragraphOrdinal = 0;
        continue;
      }
      if (isSectionHeading(line)) {
        flush();
        sectionPath.length = 0;
        sectionPath.push(line);
        continue;
      }
      buffer.push(line);
    }
    flush();
  }

  return prepared.map((chunk, index) => ({ ...chunk, ordinal: index }));
}

export function assertChunkerDeterministic(pages: string[]): void {
  const a = chunkPages(pages);
  const b = chunkPages(pages);
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`Chunker ${CHUNKING_VERSION} is not deterministic`);
  }
}

export { TARGET_CHUNK_TOKENS };
