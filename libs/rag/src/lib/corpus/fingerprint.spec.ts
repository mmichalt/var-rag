import { computeCorpusFingerprint } from './fingerprint.js';
import { sha256Hex } from '../hashes.js';

describe('computeCorpusFingerprint', () => {
  it('hashes the selected published fields in id order', async () => {
    const docs = [
      {
        id: 'b',
        version: 2,
        activeChunkSetId: 'cs2',
        contentSha256: 'bbb',
      },
      {
        id: 'a',
        version: 1,
        activeChunkSetId: 'cs1',
        contentSha256: 'aaa',
      },
    ];
    const db = {
      sourceDocument: {
        findMany: async (args: { orderBy: { id: string } }) => {
          expect(args.orderBy).toEqual({ id: 'asc' });
          return [...docs].sort((left, right) =>
            left.id.localeCompare(right.id),
          );
        },
      },
    };
    const fingerprint = await computeCorpusFingerprint(
      db as unknown as Parameters<typeof computeCorpusFingerprint>[0],
    );
    expect(fingerprint).toBe(
      sha256Hex(
        JSON.stringify([
          {
            id: 'a',
            version: 1,
            activeChunkSetId: 'cs1',
            contentSha256: 'aaa',
          },
          {
            id: 'b',
            version: 2,
            activeChunkSetId: 'cs2',
            contentSha256: 'bbb',
          },
        ]),
      ),
    );
  });
});
