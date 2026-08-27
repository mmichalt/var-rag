export function capExcerpt(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(0, maxChars);
}

export function evidenceLabelText(
  label: 'OFFICIAL_LAW' | 'OFFICIAL_DECISION' | 'OFFICIAL_EXPLANATION',
): string {
  switch (label) {
    case 'OFFICIAL_LAW':
      return 'Official law';
    case 'OFFICIAL_DECISION':
      return 'Official decision';
    case 'OFFICIAL_EXPLANATION':
      return 'Official explanation';
  }
}
