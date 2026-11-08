import { Hono } from 'hono';
import {
  KPI_AUTO_BY_KEY,
  KPI_NAME_MAX,
  KPI_NOTE_MAX,
  KPI_UNITS,
  MAX_KPIS,
  PERIOD_KINDS,
  kpiStatus,
  periodFor,
  periodShift,
  type Kpi,
  type KpiAutoKey,
  type KpiReading,
  type KpisResponse,
  type Period,
  type PeriodKind,
} from '@kreators/shared';
import type { AppEnv } from '../env';
import { DATE_RE, dayFromDevice, newId, nowIso, num, oneOf, str } from '../db';
import { agencyMetric } from '../agencyStats';
import { settingsFor } from './agency';

/**
 * Business metrics in Reviews. Only for a person who switched them on; every route but the switch itself answers 403 until then.
 * A metric is typed in each period, or read from Agency. Owner only, in the export, gone with the account.
 */
export const kpis = new Hono<AppEnv>();

interface KpiRow { id: string; name: string; unit: Kpi['unit']; direction: Kpi['direction']; cadence: PeriodKind; target: number; source: string; created_at: string }
const toKpi = (r: KpiRow): Kpi => ({ id: r.id, name: r.name, unit: r.unit, direction: r.direction, cadence: r.cadence, target: r.target, source: r.source, createdAt: r.created_at });

/** Business metrics keep the week to the year (2026-11-07): a day is too short for a business number, so the daily review has none. */
const KPI_KINDS = PERIOD_KINDS.filter((k) => k !== 'day');
const kindOf = (v: string | undefined): PeriodKind => ((KPI_KINDS as readonly string[]).includes(v ?? '') ? (v as PeriodKind) : 'month');

async function enabledFor(db: D1Database, userId: string): Promise<boolean> {
  const r = await db.prepare('SELECT enabled FROM kpi_prefs WHERE user_id = ?').bind(userId).first<{ enabled: number }>();
  return r?.enabled === 1;
}
const off = (c: { json: (b: unknown, s: 403) => Response }) => c.json({ error: 'Business metrics are switched off. Turn them on in Reviews first.' }, 403);

kpis.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const kind = kindOf(c.req.query('kind'));
  const date = c.req.query('date');
  const period = periodFor(kind, date && DATE_RE.test(date) ? date : dayFromDevice(c.req.query('day')));
  const settings = await settingsFor(db, user.id);
  if (!(await enabledFor(db, user.id))) {
    const empty: KpisResponse = { enabled: false, period, currency: settings.currency, readings: [], elsewhere: 0 };
    return c.json(empty);
  }
  const rows = await db.prepare('SELECT * FROM kpis WHERE user_id = ? ORDER BY created_at').bind(user.id).all<KpiRow>();
  const mine = rows.results.filter((r) => r.cadence === kind);
  // The last six periods, oldest first, for the small line on each metric.
  const periods: Period[] = Array.from({ length: 6 }, (_, i) => periodShift(period, i - 5));
  const manual = mine.filter((r) => r.source === 'manual');
  const values = manual.length
    ? await db
        .prepare(`SELECT kpi_id, period_start, value, note FROM kpi_values WHERE kpi_id IN (${manual.map(() => '?').join(',')}) AND period_start >= ? AND period_start <= ?`)
        .bind(...manual.map((r) => r.id), periods[0]!.start, period.start)
        .all<{ kpi_id: string; period_start: string; value: number; note: string }>()
    : { results: [] as { kpi_id: string; period_start: string; value: number; note: string }[] };
  const cache = new Map<string, Promise<number | null>>();
  const auto = (key: string, p: Period) => {
    const k = `${key}:${p.start}`;
    if (!cache.has(k)) cache.set(k, agencyMetric(db, user.id, key as KpiAutoKey, p, settings.weeklyHours));
    return cache.get(k)!;
  };
  const readings: KpiReading[] = await Promise.all(
    mine.map(async (r): Promise<KpiReading> => {
      const kpi = toKpi(r);
      const at = async (p: Period): Promise<number | null> => {
        if (r.source === 'manual') return values.results.find((v) => v.kpi_id === r.id && v.period_start === p.start)?.value ?? null;
        return KPI_AUTO_BY_KEY[r.source] ? auto(r.source, p) : null;
      };
      const series = await Promise.all(periods.map(at));
      const value = series[5] ?? null;
      return { kpi, value, previous: series[4] ?? null, note: values.results.find((v) => v.kpi_id === r.id && v.period_start === period.start)?.note ?? '', status: kpiStatus(value, r.target, r.direction), series };
    }),
  );
  const body: KpisResponse = { enabled: true, period, currency: settings.currency, readings, elsewhere: rows.results.length - mine.length };
  return c.json(body);
});

kpis.put('/settings', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ enabled?: boolean }>().catch(() => ({}) as { enabled?: boolean });
  const enabled = body.enabled === true;
  await c.env.DB.prepare('INSERT INTO kpi_prefs (user_id, enabled, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at').bind(user.id, enabled ? 1 : 0, nowIso()).run();
  return c.json({ enabled });
});

function fieldsOf(body: Record<string, unknown>, prev?: KpiRow) {
  const source = typeof body.source === 'string' && (body.source === 'manual' || KPI_AUTO_BY_KEY[body.source]) ? body.source : (prev?.source ?? 'manual');
  const def = KPI_AUTO_BY_KEY[source];
  return {
    name: str(body.name, KPI_NAME_MAX, prev?.name ?? def?.name ?? ''),
    // A metric read from Agency has its unit and its good direction fixed by what it measures.
    unit: def ? def.unit : oneOf(body.unit, KPI_UNITS, prev?.unit ?? 'number'),
    direction: def ? def.direction : oneOf(body.direction, ['up', 'down'] as const, prev?.direction ?? 'up'),
    cadence: oneOf(body.cadence, KPI_KINDS, prev?.cadence ?? 'month'),
    target: 'target' in body ? (num(body.target, 0, 0, 1_000_000_000_00) ?? 0) : (prev?.target ?? 0),
    source,
  };
}

kpis.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (!(await enabledFor(db, user.id))) return off(c);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const f = fieldsOf(body);
  if (!f.name) return c.json({ error: 'what is it called?' }, 400);
  const n = await db.prepare('SELECT COUNT(*) AS n FROM kpis WHERE user_id = ?').bind(user.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= MAX_KPIS) return c.json({ error: `up to ${MAX_KPIS} metrics` }, 400);
  const id = newId();
  await db.prepare('INSERT INTO kpis (id, user_id, name, unit, direction, cadence, target, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, user.id, f.name, f.unit, f.direction, f.cadence, f.target, f.source, nowIso()).run();
  return c.json({ id }, 201);
});

kpis.patch('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (!(await enabledFor(db, user.id))) return off(c);
  const prev = await db.prepare('SELECT * FROM kpis WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first<KpiRow>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const f = fieldsOf(body, prev);
  if (!f.name) return c.json({ error: 'what is it called?' }, 400);
  await db.prepare('UPDATE kpis SET name = ?, unit = ?, direction = ?, cadence = ?, target = ?, source = ? WHERE id = ? AND user_id = ?').bind(f.name, f.unit, f.direction, f.cadence, f.target, f.source, prev.id, user.id).run();
  return c.json({ ok: true });
});

kpis.delete('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (!(await enabledFor(db, user.id))) return off(c);
  const own = await db.prepare('SELECT 1 AS x FROM kpis WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first();
  if (!own) return c.json({ error: 'not found' }, 404);
  await db.batch([db.prepare('DELETE FROM kpi_values WHERE kpi_id = ?').bind(c.req.param('id')), db.prepare('DELETE FROM kpis WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id)]);
  return c.json({ ok: true });
});

// A typed value for the period the date falls in. A period that has not started is refused; one that is done can still be corrected.
kpis.put('/:id/value', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  if (!(await enabledFor(db, user.id))) return off(c);
  const k = await db.prepare('SELECT * FROM kpis WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first<KpiRow>();
  if (!k) return c.json({ error: 'not found' }, 404);
  if (k.source !== 'manual') return c.json({ error: 'this one is read from Agency; there is nothing to type' }, 400);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const nowDay = dayFromDevice(c.req.query('day'));
  const date = typeof body.date === 'string' && DATE_RE.test(body.date) ? body.date : nowDay;
  const period = periodFor(k.cadence, date);
  if (period.start > nowDay) return c.json({ error: 'that period has not started' }, 400);
  if (body.value === null) {
    await db.prepare('DELETE FROM kpi_values WHERE kpi_id = ? AND period_start = ?').bind(k.id, period.start).run();
    return c.json({ ok: true });
  }
  const value = num(body.value, null, 0, 1_000_000_000_00);
  if (value === null) return c.json({ error: 'type a number' }, 400);
  await db
    .prepare('INSERT INTO kpi_values (kpi_id, period_start, value, note, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(kpi_id, period_start) DO UPDATE SET value = excluded.value, note = excluded.note, updated_at = excluded.updated_at')
    .bind(k.id, period.start, value, str(body.note, KPI_NOTE_MAX), nowIso())
    .run();
  return c.json({ ok: true });
});
