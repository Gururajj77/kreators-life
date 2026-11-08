/**
 * Security alerts, from the app's own log (app_logs) and audit trail (audit_logs). Run by the cron every fifteen minutes.
 * It looks at the last fifteen minutes and tells every admin, in the inbox, when something looks wrong:
 *   - 20 or more failed sign-ins,
 *   - 100 or more answers of 429 (a limit was hit),
 *   - 20 or more server errors (5xx),
 *   - a role or a permission changed.
 * Each alert is sent at most once an hour per admin: the inbox row's id carries the kind and the hour, and INSERT OR IGNORE does the rest.
 * A note that is new also goes out as one private email to that admin, so the mail follows the same once an hour (2026-11-07).
 * The text holds counts only, never a person's name, address, a request or a secret.
 */
// Alerts go to the team's own inbox tab (kind `team`). notes.ts imports only a type, so Node still loads this file without db.ts.
import { noteStmt } from './notes.ts';
import type { Turn } from './cronTick.ts';

/** What the alerts need to send mail. cron.ts hands it over, so this file imports nothing from ops.ts and still loads in Node for the smoke test. */
export interface AlertMailer {
  /** False while no mail provider is set up: the mail only waits in the outbox, and the inbox note says so. */
  ready: boolean;
  /** The site's own address (PUBLIC_URL), for the link to the log. No link without it, and never the Host of a request. */
  site?: string;
  send: (msg: { userId: string; to: string; subject: string; body: string; private: true }) => Promise<void>;
}

/** Said in the inbox note while mail is not set up, so nobody counts on an email that cannot come. */
export const ALERT_NO_MAIL = 'Mail is not set up on this server, so this inbox note is the only alert.';

/** The one email for an alert: the same counts as the inbox note, and no name, address, token or secret. */
export function alertMail(a: { title: string; body: string }, site = ''): { subject: string; body: string } {
  const home = site.trim().replace(/\/+$/, '');
  return {
    subject: `kreators.app security alert: ${a.title}`,
    body: `${a.body}\n\n${home ? `Open the log: ${home}/internal/logs\n\n` : ''}You get this because you are an admin of kreators.app. It holds counts only, and each kind of alert comes at most once an hour.`,
  };
}

export const ALERT_WINDOW_MIN = 15;
/** What the alerts may take from a tick when several go out: every note and a handful of mails. */
const ALERT_TRIPS = 10;
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
  if (f.roleChanges > 0) out.push({ kind: 'roles', title: 'A role or a permission changed', body: `${f.roleChanges} role or permission change${f.roleChanges === 1 ? '' : 's'} in the last ${mins} minutes. If you did not make ${f.roleChanges === 1 ? 'it' : 'them'}, open the log and the audit trail now.` });
  return out;
}

/** Look, and tell every admin once an hour per kind, in the inbox and by email. Returns how many inbox rows were written. */
export async function securityAlerts(db: D1Database, mailer: AlertMailer, now = new Date(), turn?: Turn): Promise<number> {
  const found = alertsFor(await alertFacts(db, now));
  if (found.length === 0) return 0;
  // In a cron tick the alerts go first in line. One mail is a call out and a line in the outbox; at the very most a tick mails a few, and every note is in by then.
  const share = turn ? await turn(ALERT_TRIPS) : null;
  const admins = await db.prepare("SELECT id, email FROM users WHERE role = 'admin'").all<{ id: string; email: string | null }>();
  const hour = now.toISOString().slice(0, 13);
  const body = (a: { body: string }) => (mailer.ready ? a.body : `${a.body} ${ALERT_NO_MAIL}`);
  const rows = found.flatMap((alert) =>
    admins.results.map((admin) => ({
      alert,
      admin,
      note: noteStmt(db, { id: `alert-${alert.kind}-${hour}-${admin.id}`, userId: admin.id, kind: 'team', title: alert.title, body: body(alert), link: '/internal/logs', at: now.toISOString() }, 'once'),
    })),
  );
  // One round trip a fifty notes, not one each; the id makes each one once an hour. No import of db.ts here: the smoke test loads this file in Node.
  const fresh: typeof rows = [];
  for (let i = 0; i < rows.length; i += 50) {
    const part = rows.slice(i, i + 50);
    (await db.batch(part.map((r) => r.note))).forEach((done, j) => {
      const row = part[j];
      if (row && (done.meta.changes ?? 0) > 0) fresh.push(row);
    });
  }
  // The notes are in, so a mail that fails loses nothing: it is tried once, and nothing here can stop the cron or the next admin's mail.
  for (const { alert, admin } of fresh) {
    if (!admin.email) continue;
    if (share) {
      if (share.left() < 2) {
        share.more();
        break;
      }
      share.outbound();
    }
    await mailer.send({ userId: admin.id, to: admin.email, private: true, ...alertMail(alert, mailer.site) }).catch(() => undefined);
  }
  return fresh.length;
}
