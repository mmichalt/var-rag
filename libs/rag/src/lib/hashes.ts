import { createHash } from 'node:crypto';

export function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export function tokenCount(text: string): number {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return tokens.length;
}
