/**
 * Security alerts, from the app's own log (app_logs) and audit trail (audit_logs). Run by the cron every fifteen minutes.
 * It looks at the last fifteen minutes and tells every admin, in the inbox, when something looks wrong:
 *   - 20 or more failed sign-ins,
 *   - 100 or more answers of 429 (a limit was hit),
 *   - 20 or more server errors (5xx),
 *   - a role or permission was changed.
 * Each alert is sent at most once an hour per admin: the inbox row's id carries the kind and the hour, and INSERT OR IGNORE does the rest.
 * The text holds counts only, never a person's name, address or a request.
 */
export const ALERT_WINDOW_MIN = 15;
export const ALERT_LEVELS = { failedSignins: 20, tooMany: 100, serverErrors: 20 } as const;

export interface AlertFacts {
  failedSignins: number;
  refusals: number;
  tooMany: number;
  serverErrors: number;
  roleChanges: number;
}

export async function alertFacts(db: D1Database, now = new Date()): Promise<AlertFacts> {
  const since = new Date(now.getTime() - ALERT_WINDOW_MIN * 60_000).toISOString();
  const logs = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 401 AND path = '/auth/signin' THEN 1 ELSE 0 END), 0) AS failed,
         COALESCE(SUM(CASE WHEN status = 403 THEN 1 ELSE 0 END), 0) AS refused,
         COALESCE(SUM(CASE WHEN status = 429 THEN 1 ELSE 0 END), 0) AS many,
         COALESCE(SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END), 0) AS errors
       FROM app_logs WHERE at >= ?`,
    )
    .bind(since)
    .first<{ failed: number; refused: number; many: number; errors: number }>();
  const audit = await db
    .prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE created_at >= ? AND action IN ('user.role', 'user.permissions')")
    .bind(since)
    .first<{ n: number }>();
  return { failedSignins: logs?.failed ?? 0, refusals: logs?.refused ?? 0, tooMany: logs?.many ?? 0, serverErrors: logs?.errors ?? 0, roleChanges: audit?.n ?? 0 };
}

/** Which alerts the facts call for: a kind (part of the inbox id), a title and a plain body. */
export function alertsFor(f: AlertFacts): { kind: string; title: string; body: string }[] {
  const out: { kind: string; title: string; body: string }[] = [];
  const mins = ALERT_WINDOW_MIN;
  if (f.failedSignins >= ALERT_LEVELS.failedSignins) out.push({ kind: 'signins', title: 'Many failed sign-ins', body: `${f.failedSignins} failed sign-ins in the last ${mins} minutes. Someone may be guessing passwords. Open the log and look at the Auth area.` });
  if (f.tooMany >= ALERT_LEVELS.tooMany) out.push({ kind: 'limits', title: 'Many requests were slowed down', body: `${f.tooMany} requests were told to wait in the last ${mins} minutes (${f.refusals} refused in all). Something may be hammering the app.` });
  if (f.serverErrors >= ALERT_LEVELS.serverErrors) out.push({ kind: 'errors', title: 'Many server errors', body: `${f.serverErrors} server errors in the last ${mins} minutes. Open the log, filter by errors, and look for one repeated line.` });
  if (f.roleChanges > 0) out.push({ kind: 'roles', title: 'A role or permission was changed', body: `${f.roleChanges} role or permission change${f.roleChanges === 1 ? '' : 's'} in the last ${mins} minutes. If you did not make ${f.roleChanges === 1 ? 'it' : 'them'}, open the log and the audit trail now.` });
  return out;
}

/** Look, and tell every admin once an hour per kind. Returns how many inbox rows were written. */
export async function securityAlerts(db: D1Database, now = new Date()): Promise<number> {
  const found = alertsFor(await alertFacts(db, now));
  if (found.length === 0) return 0;
  const admins = await db.prepare("SELECT id FROM users WHERE role = 'admin'").all<{ id: string }>();
  const hour = now.toISOString().slice(0, 13);
  const notes = found.flatMap((a) =>
    admins.results.map((admin) =>
      db
        .prepare("INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, 'team', ?, ?, '/internal/logs', NULL, ?)")
        .bind(`alert-${a.kind}-${hour}-${admin.id}`, admin.id, a.title, a.body, now.toISOString()),
    ),
  );
  // One round trip a fifty notes, not one each; the id makes each one once an hour. No import of db.ts here: the smoke test loads this file in Node.
  let written = 0;
  for (let i = 0; i < notes.length; i += 50) for (const done of await db.batch(notes.slice(i, i + 50))) written += done.meta.changes ?? 0;
  return written;
}
