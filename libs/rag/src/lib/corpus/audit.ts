import { CLI_ACTOR, CLI_ACTOR_TRUST } from '../versions.js';
import type { Db, Tx } from '../db.js';

export async function writeAudit(
  db: Db | Tx,
  event: {
    actor?: string;
    actorTrust?: typeof CLI_ACTOR_TRUST;
    action: string;
    targetType: string;
    targetId: string;
    before?: unknown;
    after?: unknown;
  },
) {
  return db.auditEvent.create({
    data: {
      actor: event.actor ?? CLI_ACTOR,
      actorTrust: event.actorTrust ?? CLI_ACTOR_TRUST,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      before: event.before === undefined ? undefined : (event.before as object),
      after: event.after === undefined ? undefined : (event.after as object),
    },
  });
}
