const LIGATURES: ReadonlyArray<readonly [string, string]> = [
  ['\uFB00', 'ff'],
  ['\uFB01', 'fi'],
  ['\uFB02', 'fl'],
  ['\uFB03', 'ffi'],
  ['\uFB04', 'ffl'],
  ['\uFB05', 'st'],
  ['\uFB06', 'st'],
];

export function repairLigatures(text: string): { text: string; count: number } {
  let count = 0;
  let next = text;
  for (const [from, to] of LIGATURES) {
    const matches = next.split(from).length - 1;
    if (matches > 0) {
      count += matches;
      next = next.split(from).join(to);
    }
  }
  return { text: next, count };
}

export function dehyphenate(text: string): { text: string; count: number } {
  const re = /(\w)-\n(\s*)(\w)/g;
  let count = 0;
  const next = text.replace(
    re,
    (_all, a: string, _space: string, b: string) => {
      count += 1;
      return `${a}${b}`;
    },
  );
  return { text: next, count };
}

export function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function lineKey(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

export function detectRepeatedLines(pages: string[]): string[] {
  if (pages.length < 2) {
    return [];
  }
  const counts = new Map<string, number>();
  for (const page of pages) {
    const lines = page
      .split('\n')
      .map(lineKey)
      .filter((line) => line.length > 0);
    const candidates = new Set<string>([
      ...lines.slice(0, 3),
      ...lines.slice(-3),
    ]);
    for (const line of candidates) {
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
  }
  const threshold = Math.ceil(pages.length * 0.5);
  return [...counts.entries()]
    .filter(([, n]) => n >= threshold)
    .map(([line]) => line);
}

export function stripRepeatedLines(
  page: string,
  repeated: ReadonlySet<string>,
): string {
  return page
    .split('\n')
    .filter((line) => !repeated.has(lineKey(line)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizePages(pages: string[]): {
  pages: string[];
  hyphenRepairs: number;
  ligatureRepairs: number;
  repeatedHeaderFooterLinesRemoved: string[];
} {
  let hyphenRepairs = 0;
  let ligatureRepairs = 0;
  const ligatured = pages.map((page) => {
    const lig = repairLigatures(page);
    ligatureRepairs += lig.count;
    const hyp = dehyphenate(lig.text);
    hyphenRepairs += hyp.count;
    return hyp.text;
  });
  const repeated = detectRepeatedLines(ligatured);
  const repeatedSet = new Set(repeated);
  return {
    pages: ligatured.map((page) => stripRepeatedLines(page, repeatedSet)),
    hyphenRepairs,
    ligatureRepairs,
    repeatedHeaderFooterLinesRemoved: repeated,
  };
}
