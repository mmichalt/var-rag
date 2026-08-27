import type { Db } from '../db.js';

export async function pruneAnswerLogs(
  db: Db,
  retentionDays: number,
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await db.answerLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}
