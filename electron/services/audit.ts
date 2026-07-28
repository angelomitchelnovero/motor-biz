// Append-only audit log writer. Must be called inside the same DB transaction as the
// mutation it's recording — pass the `txDb` (the `db` inside the transaction closure).

import type Database from 'better-sqlite3';

export function record(
  db: Database.Database,
  userId: number | null,
  action: string,
  entityType: string,
  entityId: number | null,
  before: unknown | null,
  after: unknown | null,
): void {
  db.prepare(`
    INSERT INTO audit_log (user_id, action, entity_type, entity_id, before_json, after_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    action,
    entityType,
    entityId,
    before == null ? null : JSON.stringify(before),
    after == null ? null : JSON.stringify(after),
  );
}
