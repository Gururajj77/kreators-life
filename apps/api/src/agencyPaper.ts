import { parseDocStyle, type DocStyle } from '@kreators/shared';
import type { Env } from './env';
import { newId, nowIso } from './db';
import { sendEmail } from './ops';

/**
 * What Agency's paper (invoices, agreements and the other documents) shares: a logo that must be the person's own upload,
 * the private log of what was done with a document, a valid address to email, and sending a copy by email.
 */

/** A document's logo has to be a picture the same person uploaded; anything else is dropped, so one person cannot point at another's file. */
export async function ownLogo<T extends { style?: DocStyle }>(db: D1Database, userId: string, doc: T, keep = ''): Promise<T> {
  const style = doc.style ? parseDocStyle(doc.style) : null;
  // A logo the document already carried (copied from a house template, say) stays; a new one has to be the person's own upload.
  if (!style || !style.logo || style.logo === keep) return doc;
  const mine = await db.prepare('SELECT 1 AS x FROM media_files WHERE id = ? AND owner_id = ?').bind(style.logo, userId).first();
  return { ...doc, style: mine ? style : { ...style, logo: '' } };
}

/** One line in a document's private log. A line says what happened, never the document's words. */
export async function logDoc(db: D1Database, userId: string, type: 'invoice' | 'contract' | 'doc', id: string, event: string, detail = ''): Promise<void> {
  await db.prepare('INSERT INTO agency_doc_log (id, user_id, doc_type, doc_id, event, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId(), userId, type, id, event, detail.slice(0, 200), nowIso()).run();
}

/** An address that looks like one: one @, no spaces or list separators, a dot in the domain. */
export function emailProblem(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return 'type an email address';
  const e = v.trim();
  if (e.length > 120 || !/^[^\s@<>"',;()]+@[^\s@<>"',;()]+\.[^\s@<>"',;()]{2,}$/.test(e)) return 'that does not look like an email address';
  return null;
}
/** a***@acme.test: enough to recognise in a log, not enough to read. */
export function maskEmail(e: string): string {
  const [name = '', domain = ''] = e.split('@');
  return `${name.slice(0, 1)}***@${domain}`;
}

/** The public address of a page, from the site's configured address and never from the request's Host. Empty when it is not configured. */
export function publicUrl(env: Env, path: string): string {
  const base = (env.PUBLIC_URL ?? '').trim().replace(/\/+$/, '');
  return base ? `${base}${path}` : '';
}

export interface EmailedCopy {
  sent: boolean;
  /** A plain sentence for the person when nothing went out. */
  note: string;
  linkIncluded: boolean;
}

/**
 * Email the text version of a document with the client's link. It is ordinary mail (never marketing) and the outbox keeps it for the
 * team to see. Says plainly when email is not set up or the provider refused, so the person knows to paste the text themselves.
 */
export async function emailCopy(db: D1Database, env: Env, userId: string, msg: { to: string; subject: string; intro: string; text: string; link: string; replyTo?: string }): Promise<EmailedCopy> {
  const body = [msg.intro, '', msg.text, '', msg.link ? `Read it online: ${msg.link}` : '', msg.replyTo ? `Questions? Write to ${msg.replyTo}.` : ''].filter((l, i, all) => l !== '' || all[i - 1] !== '').join('\n').trim();
  const subject = msg.subject.slice(0, 200);
  await sendEmail(db, env, { userId, to: msg.to, subject, body });
  const row = await db.prepare('SELECT status FROM email_outbox WHERE user_id = ? AND to_email = ? AND subject = ? ORDER BY created_at DESC LIMIT 1').bind(userId, msg.to, subject).first<{ status: string }>();
  const sent = row?.status === 'sent';
  return {
    sent,
    linkIncluded: Boolean(msg.link),
    note: sent
      ? msg.link
        ? 'Sent. The text and the link are in their inbox.'
        : 'Sent without a link, because the site address is not set on this server.'
      : 'Email is not set up on this server, or the provider did not take it, so nothing went out. Copy the text and paste it into your own email.',
  };
}
