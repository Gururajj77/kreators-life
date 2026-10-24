import { HONORS, HONOR_BY_KEY, REWARD_BY_KEY, type AdminRedemption, type AdminUser } from '@kreators/shared';
import { useState } from 'react';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { adminApi } from '../lib/api';

const ADMIN_HONORS = HONORS.filter((h) => h.source === 'admin' && h.key !== 'pro');
const KEY_STORE = 'kreators.adminKey';

function readKey(): string {
  try {
    return sessionStorage.getItem(KEY_STORE) ?? '';
  } catch {
    return '';
  }
}

export function Admin() {
  const [key, setKey] = useState(readKey);
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [redemptions, setRedemptions] = useState<AdminRedemption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [honor, setHonor] = useState(ADMIN_HONORS[0]?.key ?? 'founder');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('100');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something failed.');
    } finally {
      setBusy(false);
    }
  };

  const load = () =>
    run(async () => {
      try {
        sessionStorage.setItem(KEY_STORE, key);
      } catch {
        // Private mode: the key just will not be remembered.
      }
      const [u, r] = await Promise.all([adminApi.users(key, q), adminApi.redemptions(key, 'reserved')]);
      setUsers(u.users);
      setRedemptions(r.redemptions);
      setLoaded(true);
    });

  const applyUser = (u: AdminUser) => {
    setSelected(u);
    setUsers((list) => list.map((x) => (x.id === u.id ? u : x)));
  };

  const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';

  return (
    <Screen tabs={false}>
      <header className="pt-lg">
        <h1 className="text-[32px]">Admin</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Give honors, pro status and points. Fulfil reservations. Needs the admin key.</p>
      </header>

      <form
        className="mt-md flex flex-col gap-sm rounded-card bg-card p-md shadow-toy-soft"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Admin key</span>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Find a person</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or id, empty for newest" className={field} />
        </label>
        <Button type="submit" disabled={!key || busy}>
          {loaded ? 'Reload' : 'Load'}
        </Button>
      </form>

      {error && (
        <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          {error}
        </p>
      )}

      {loaded && (
        <section className="mt-lg" aria-labelledby="people-heading">
          <h2 id="people-heading" className="text-[22px]">
            People
          </h2>
          {users.length === 0 ? (
            <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">No one matches.</p>
          ) : (
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {users.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(u)}
                    aria-pressed={selected?.id === u.id}
                    className={`toy w-full rounded-tile p-sm text-left ${selected?.id === u.id ? 'bg-ink text-white' : 'toy-soft bg-card'}`}
                  >
                    <span className="block truncate text-[16px] font-bold">
                      {u.displayName || 'Anonymous climber'}
                      {u.isPro ? ', pro' : ''}
                    </span>
                    <span className={`block text-[13px] font-semibold ${selected?.id === u.id ? 'text-white/80' : 'text-ink-soft'}`}>
                      {u.xp} xp, {u.points} points, streak {u.streak}, {u.honors.length} {u.honors.length === 1 ? 'honor' : 'honors'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {selected && (
        <section className="mt-lg rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="selected-heading">
          <h2 id="selected-heading" className="text-[22px]">
            {selected.displayName || 'Anonymous climber'}
          </h2>
          <p className="mt-xs m-0 break-all text-[13px] font-semibold text-ink-soft">
            {selected.id}, joined {new Date(selected.createdAt).toLocaleDateString()}
          </p>

          <Button
            variant={selected.isPro ? 'outline' : 'primary'}
            className="mt-md"
            disabled={busy}
            onClick={() => run(async () => applyUser((await adminApi.setPro(key, selected.id, !selected.isPro)).user))}
          >
            {selected.isPro ? 'Remove pro' : 'Make pro'}
          </Button>

          <h3 className="mt-lg text-[16px]">Honors</h3>
          {selected.honors.length > 0 && (
            <ul className="mt-xs flex list-none flex-wrap gap-xs p-0 m-0">
              {selected.honors.map((k) => (
                <li key={k} className="flex items-center gap-xs rounded-pill bg-paper px-sm py-xs text-[13px] font-bold">
                  <span>
                    {HONOR_BY_KEY[k]?.emoji} {HONOR_BY_KEY[k]?.name ?? k}
                  </span>
                  <button
                    type="button"
                    className="text-ink-soft underline underline-offset-4"
                    disabled={busy}
                    aria-label={`Revoke ${HONOR_BY_KEY[k]?.name ?? k}`}
                    onClick={() => run(async () => applyUser((await adminApi.revokeHonor(key, selected.id, k)).user))}
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-sm flex flex-col gap-sm"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                applyUser((await adminApi.grantHonor(key, selected.id, honor, note)).user);
                setNote('');
              });
            }}
          >
            <label className="block">
              <span className="block text-[14px] font-bold">Give an honor</span>
              <select value={honor} onChange={(e) => setHonor(e.target.value)} className={field}>
                {ADMIN_HONORS.map((h) => (
                  <option key={h.key} value={h.key}>
                    {h.emoji} {h.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[14px] font-bold">Why</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Optional note" className={field} />
            </label>
            <Button type="submit" variant="outline" disabled={busy}>
              Give honor
            </Button>
          </form>

          <h3 className="mt-lg text-[16px]">Points</h3>
          <form
            className="mt-xs flex flex-col gap-sm"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => applyUser((await adminApi.addPoints(key, selected.id, Number(amount), note)).user));
            }}
          >
            <label className="block">
              <span className="block text-[14px] font-bold">Amount, negative to take away</span>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} step={1} className={field} />
            </label>
            <Button type="submit" variant="outline" disabled={busy || !Number(amount)}>
              Add points
            </Button>
          </form>
        </section>
      )}

      {loaded && (
        <section className="mt-lg" aria-labelledby="reservations-heading">
          <h2 id="reservations-heading" className="text-[22px]">
            Open reservations
          </h2>
          {redemptions.length === 0 ? (
            <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Nothing waiting.</p>
          ) : (
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {redemptions.map((x) => (
                <li key={x.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                  <p className="m-0 text-[16px] font-bold">
                    {REWARD_BY_KEY[x.rewardKey]?.name ?? x.rewardKey} for {x.userName}
                  </p>
                  <p className="m-0 text-[13px] font-semibold text-ink-soft">
                    {x.points} points, {new Date(x.createdAt).toLocaleDateString()}
                  </p>
                  <div className="mt-sm flex gap-xs">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await adminApi.setRedemption(key, x.id, 'fulfilled');
                          setRedemptions((l) => l.filter((y) => y.id !== x.id));
                        })
                      }
                    >
                      Mark fulfilled
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await adminApi.setRedemption(key, x.id, 'cancelled');
                          setRedemptions((l) => l.filter((y) => y.id !== x.id));
                        })
                      }
                    >
                      Cancel and refund
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </Screen>
  );
}
