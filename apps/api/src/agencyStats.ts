import { periodDays, utilisationPct, type KpiAutoKey, type Period } from '@kreators/shared';

/**
 * The numbers Agency can give Reviews for one period, so nobody types what the app already knows. Whole numbers only:
 * a count, cents, minutes, or a whole percent. Null means nothing to measure yet (no pieces approved, say), not zero.
 * Days are the person's own, kept on each row when it was ticked, so a month follows their calendar and not UTC.
 */
export async function agencyMetric(db: D1Database, userId: string, key: KpiAutoKey, p: Period, weeklyHours: number): Promise<number | null> {
  const from = p.start;
  const to = p.end;
  switch (key) {
    case 'published': {
      const r = await db.prepare("SELECT COUNT(*) AS n FROM agency_items WHERE user_id = ? AND stage = 'published' AND published_day >= ? AND published_day <= ?").bind(userId, from, to).first<{ n: number }>();
      return r?.n ?? 0;
    }
    case 'first_pass': {
      const r = await db
        .prepare("SELECT COUNT(*) AS n, SUM(CASE WHEN revisions = 0 THEN 1 ELSE 0 END) AS clean FROM agency_items WHERE user_id = ? AND stage IN ('approved', 'published') AND approved_day >= ? AND approved_day <= ?")
        .bind(userId, from, to)
        .first<{ n: number; clean: number | null }>();
      return r && r.n > 0 ? Math.round(((r.clean ?? 0) * 100) / r.n) : null;
    }
    case 'on_time': {
      const r = await db
        .prepare("SELECT COUNT(*) AS n, SUM(CASE WHEN published_day <= COALESCE(publish_date, due_date) THEN 1 ELSE 0 END) AS ok FROM agency_items WHERE user_id = ? AND stage = 'published' AND published_day >= ? AND published_day <= ? AND COALESCE(publish_date, due_date) IS NOT NULL")
        .bind(userId, from, to)
        .first<{ n: number; ok: number | null }>();
      return r && r.n > 0 ? Math.round(((r.ok ?? 0) * 100) / r.n) : null;
    }
    case 'hours':
    case 'utilisation': {
      const r = await db.prepare('SELECT COALESCE(SUM(minutes), 0) AS m FROM agency_time WHERE user_id = ? AND billable = 1 AND day >= ? AND day <= ?').bind(userId, from, to).first<{ m: number }>();
      const minutes = r?.m ?? 0;
      return key === 'hours' ? minutes : utilisationPct(minutes, weeklyHours, periodDays(p).length);
    }
    case 'invoiced': {
      const r = await db.prepare("SELECT COALESCE(SUM(total_cents), 0) AS c FROM invoices WHERE user_id = ? AND status IN ('sent', 'paid') AND issue_date >= ? AND issue_date <= ?").bind(userId, from, to).first<{ c: number }>();
      return r?.c ?? 0;
    }
    case 'paid': {
      const r = await db.prepare("SELECT COALESCE(SUM(total_cents), 0) AS c FROM invoices WHERE user_id = ? AND status = 'paid' AND substr(paid_at, 1, 10) >= ? AND substr(paid_at, 1, 10) <= ?").bind(userId, from, to).first<{ c: number }>();
      return r?.c ?? 0;
    }
    case 'new_clients': {
      const r = await db.prepare('SELECT COUNT(*) AS n FROM agency_clients WHERE user_id = ? AND substr(created_at, 1, 10) >= ? AND substr(created_at, 1, 10) <= ?').bind(userId, from, to).first<{ n: number }>();
      return r?.n ?? 0;
    }
  }
}
