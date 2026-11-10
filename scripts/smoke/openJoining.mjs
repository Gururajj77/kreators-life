// Joining is by invite since migration 0125 (Admin, Invites): a new account needs a code while "Invite only" is on. The test scripts make
// their own accounts, so on the test server only (port 8788, loopback) they turn it off first with the test admin key, the way Admin's
// switch does. The API has no bypass for tests; this is the ordinary admin call. Anywhere else it does nothing and says so.
export async function openJoining(origin, key = process.env.SMOKE_ADMIN_KEY ?? 'smoke-admin-key') {
  let u;
  try {
    u = new URL(origin);
  } catch {
    return false;
  }
  if (u.port !== '8788' || !['127.0.0.1', 'localhost'].includes(u.hostname)) return false;
  const now = await fetch(`${u.origin}/api/public/join`).then((r) => r.json()).catch(() => null);
  if (now && now.inviteOnly === false) return true;
  const res = await fetch(`${u.origin}/api/admin/invites/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'X-Admin-Key': key },
    body: JSON.stringify({ inviteOnly: false }),
  }).catch(() => null);
  return Boolean(res?.ok);
}
