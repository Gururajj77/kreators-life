import { parseDocStyle, type DocStyle } from '@kreators/shared';
import { parseEmailNote } from '@kreators/shared/agencyEmail';
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
/**
 * The cover note a person wrote for an email (`message`, with an optional `subject`): taken as plain text, trimmed, held to the same length the
 * shared notes keep to, and the subject made one line so it can never add a header. Nothing here is trusted as markup: the mail is plain text.
 */
export function coverFrom(body: Record<string, unknown>): { message: string; subject: string } | null {
  // The same reader a saved email note goes through, so what is sent and what is kept follow one rule.
  return parseEmailNote(body);
}

/** Where a client opens each kind of paper. */
const PAPER_PATH = { invoice: 'i', contract: 'k', doc: 'd' } as const;
export const paperPath = (kind: keyof typeof PAPER_PATH, token: string | null | undefined): string => (token ? `/${PAPER_PATH[kind]}/${token}` : '');

/**
 * A note can name more than the paper it was sent from (the first send names the agreement and the invoice), so every other paper of
 * this client whose link is in the words gets the same line in its own log. Read from the owner's own rows: only a paper's real token
 * counts, and a line never holds the words.
 */
export async function logOtherPapers(db: D1Database, userId: string, clientId: string | null | undefined, words: string | undefined, self: string, event: string, detail: string): Promise<void> {
  if (!clientId || !words || !/\/[ikd]\/[A-Za-z0-9]/.test(words)) return;
  const rows = await db
    .prepare(
      `SELECT 'invoice' AS kind, id, token FROM invoices WHERE user_id = ?1 AND agency_client_id = ?2 AND status != 'draft' AND token IS NOT NULL
       UNION ALL SELECT 'contract', id, token FROM agency_contracts WHERE user_id = ?1 AND client_id = ?2 AND status != 'draft' AND token IS NOT NULL
       UNION ALL SELECT 'doc', id, token FROM agency_docs WHERE user_id = ?1 AND client_id = ?2 AND status != 'draft' AND token IS NOT NULL`,
    )
    .bind(userId, clientId)
    .all<{ kind: keyof typeof PAPER_PATH; id: string; token: string }>();
  const others = rows.results.filter((r) => r.id !== self && words.includes(paperPath(r.kind, r.token))).slice(0, 48);
  if (others.length === 0) return;
  const now = nowIso();
  await db.batch(others.map((r) => db.prepare('INSERT INTO agency_doc_log (id, user_id, doc_type, doc_id, event, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId(), userId, r.kind, r.id, event, detail.slice(0, 200), now)));
}

export async function emailCopy(db: D1Database, env: Env, userId: string, msg: { to: string; subject: string; intro: string; text: string; link: string; replyTo?: string }): Promise<EmailedCopy> {
  // A note that already holds the paper's link (and the sender's address, in its sign-off) is not told them twice.
  const linkLines = msg.link && !msg.intro.includes(msg.link) ? `You can open and download it here:\n${msg.link}` : '';
  const askLine = msg.replyTo && !msg.intro.includes(msg.replyTo) ? `Questions? Write to ${msg.replyTo}.` : '';
  const body = [msg.intro, '', msg.text, '', linkLines, askLine].filter((l, i, all) => l !== '' || all[i - 1] !== '').join('\n').trim();
  const subject = msg.subject.slice(0, 200);
  // A paper's link opens that paper, so the outbox keeps the fact of the mail and not its words.
  await sendEmail(db, env, { userId, to: msg.to, subject, body, private: Boolean(msg.link) || /https?:\/\//.test(body) });
  const row = await db.prepare('SELECT status FROM email_outbox WHERE user_id = ? AND to_email = ? AND subject = ? ORDER BY created_at DESC LIMIT 1').bind(userId, msg.to, subject).first<{ status: string }>();
  const sent = row?.status === 'sent';
  const hasLink = Boolean(msg.link) || /https?:\/\//.test(msg.intro);
  return {
    sent,
    linkIncluded: hasLink,
    note: sent
      ? hasLink
        ? 'Sent. The text and the link are in their inbox.'
        : 'Sent without a link, because the site address is not set on this server.'
      : 'Email is not set up on this server, or the provider did not take it, so nothing went out. Copy the text and paste it into your own email.',
  };
}
