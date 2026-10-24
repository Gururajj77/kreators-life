import { Hono } from 'hono';
import type { KycProfile } from '@kreators/shared';
import type { AppEnv } from '../env';
import { nowIso, str } from '../db';
import { logEvent, track } from '../ops';

/** Payout details for a creator. Only the last digits are stored; the PAN is kept as a hash for matching. */
export const kyc = new Hono<AppEnv>();

export interface KycRow { user_id: string; status: KycProfile['status']; legal_name: string; pan_last4: string; pan_hash: string; bank_last4: string; ifsc: string; address: string; note: string; submitted_at: string | null; decided_at: string | null }
export const toKyc = (r: KycRow | null): KycProfile => ({ status: r?.status ?? 'none', legalName: r?.legal_name ?? '', panLast4: r?.pan_last4 ?? '', bankLast4: r?.bank_last4 ?? '', ifsc: r?.ifsc ?? '', address: r?.address ?? '', note: r?.note ?? '', submittedAt: r?.submitted_at ?? null, decidedAt: r?.decided_at ?? null });

async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

kyc.get('/', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM kyc_profiles WHERE user_id = ?').bind(c.get('user').id).first<KycRow>();
  return c.json({ kyc: toKyc(row) });
});

kyc.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const legalName = str(body.legalName, 120);
  const pan = str(body.pan, 20).toUpperCase().replace(/\s/g, '');
  const account = str(body.bankAccount, 34).replace(/\s/g, '');
  const ifsc = str(body.ifsc, 11).toUpperCase();
  const address = str(body.address, 300);
  if (!legalName || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return c.json({ error: 'your legal name and a valid PAN' }, 400);
  if (account.length < 6 || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return c.json({ error: 'a bank account number and a valid IFSC' }, 400);
  const prev = await db.prepare('SELECT status FROM kyc_profiles WHERE user_id = ?').bind(user.id).first<{ status: string }>();
  if (prev?.status === 'approved') return c.json({ error: 'already approved; write to support to change details' }, 400);
  await db
    .prepare("INSERT OR REPLACE INTO kyc_profiles (user_id, status, legal_name, pan_last4, pan_hash, bank_last4, ifsc, address, note, submitted_at, decided_at, decided_by) VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, '', ?, NULL, NULL)")
    .bind(user.id, legalName, pan.slice(-4), await sha(`pan:${pan}`), account.slice(-4), ifsc, address, nowIso())
    .run();
  await logEvent(db, 'kyc', user.id, 'kyc.submitted');
  await track(db, user.id, 'kyc_submitted');
  const row = await db.prepare('SELECT * FROM kyc_profiles WHERE user_id = ?').bind(user.id).first<KycRow>();
  return c.json({ kyc: toKyc(row) }, 201);
});
