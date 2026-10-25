import type { UserRow } from './env';
import { audit } from './db';

/**
 * The founders' addresses. An account with one of these becomes an admin the moment it signs up or
 * signs in. More can be added with ADMIN_EMAILS (comma separated) without a deploy.
 * Until outgoing mail verifies addresses, whoever signs up with one of these first gets the role,
 * so the owners should sign up right after a deploy.
 */
export const ADMIN_EMAILS = ['brandingbum@gmail.com', 'madworkerme@gmail.com', 'jdotgururaj@gmail.com'] as const;

export function isBootstrapAdmin(env: { ADMIN_EMAILS?: string }, email: string | null | undefined): boolean {
  if (!email) return false;
  const extra = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return (ADMIN_EMAILS as readonly string[]).includes(email.toLowerCase()) || extra.includes(email.toLowerCase());
}

/** Gives the admin role to a founder's account that does not have it yet, and writes the audit line. */
export async function promoteBootstrapAdmin(db: D1Database, env: { ADMIN_EMAILS?: string }, user: UserRow): Promise<boolean> {
  if (user.role === 'admin' || !isBootstrapAdmin(env, user.email)) return false;
  await db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(user.id).run();
  await audit(db, null, 'user.role', 'user', user.id, user.role, 'admin (founder email)');
  return true;
}
