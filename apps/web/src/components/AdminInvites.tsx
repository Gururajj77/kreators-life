import { DEFAULT_PAGE_SIZE, formatCount, pageQuery, type Page, type PageSize } from '@kreators/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCopy } from '../lib/clipboard';
import { longDate } from '../lib/date';
import { adminInviteApi, INVITE_STATE_WORDS, WAITLIST_WORDS, type AdminInvite, type InviteState, type WaitlistRow, type WaitlistStatus } from '../lib/inviteApi';
import { FIELD_FILTER } from '../lib/ui';
import { Button } from './Button';
import { ConfirmDelete } from './ConfirmDelete';
import { DataTable } from './DataTable';
import { ErrorLine, errorText } from './ErrorLine';
import { FilterBar, FilterSelect } from './FilterSelect';
import { InviteQr, MakeInvitesForm } from './InviteParts';
import { MoreMenu } from './MoreMenu';
import { SectionHead } from './SectionHead';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';
import { TapTwice } from './TapTwice';
import { Toggle } from './Toggle';

type Ask = { page: number; size: PageSize };
const FIRST: Ask = { page: 1, size: DEFAULT_PAGE_SIZE };
const STATE_ITEMS: readonly { key: '' | InviteState; label: string }[] = [{ key: '', label: 'Every state' }, ...(Object.keys(INVITE_STATE_WORDS) as InviteState[]).map((k) => ({ key: k, label: INVITE_STATE_WORDS[k].name }))];
const STATUS_ITEMS: readonly { key: '' | WaitlistStatus; label: string }[] = [{ key: '', label: 'Every status' }, ...(Object.keys(WAITLIST_WORDS) as WaitlistStatus[]).map((k) => ({ key: k, label: WAITLIST_WORDS[k].name }))];
const who = (p: { name: string; handle: string | null } | null, none: string) =>
  p ? (
    <>
      <span className="block font-semibold">{p.name}</span>
      {p.handle && <span className="block text-caption text-ink-soft">@{p.handle}</span>}
    </>
  ) : (
    <span className="text-ink-soft">{none}</span>
  );

/** The Invite only switch. Off opens the door to everyone, so it asks first; on is one tap. */
function Gate({ adminKey }: { adminKey: string }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let live = true;
    adminInviteApi
      .settings(adminKey)
      .then((r) => live && setOn(r.inviteOnly))
      .catch((e: unknown) => live && setError(e));
    return () => {
      live = false;
    };
  }, [adminKey]);
  const save = async (next: boolean) => {
    setBusy(true);
    setError(null);
    try {
      setOn((await adminInviteApi.setSettings(adminKey, next)).inviteOnly);
      setAsking(false);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-sm">
      {on !== null && (
        <Toggle
          on={on}
          disabled={busy}
          label="Invite only"
          hint={on ? 'On. A new account needs an invite code or a yes from the waitlist.' : 'Off. Anyone can make an account.'}
          onChange={(next) => (next ? void save(true) : setAsking(true))}
        />
      )}
      <ErrorLine e={asking ? null : error} className="mt-xs" />
      <ConfirmDelete
        open={asking}
        title="Let anyone join?"
        body="Anyone can make an account without a code until you switch it back on. Codes already made still work."
        yes="Yes, let anyone join"
        keep="Keep invite only"
        pending={busy}
        failed={Boolean(error)}
        error={error ? errorText(error) : undefined}
        onYes={() => void save(false)}
        onClose={() => setAsking(false)}
      />
    </div>
  );
}

/** A code made or approved, shown in place with its two copies, and whether it was emailed. */
function Shown({ code, link, note }: { code: string; link: string; note: string }) {
  const { copy, said } = useCopy();
  return (
    <div role="status" className="mt-sm flex flex-wrap items-center justify-between gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
      <span className="min-w-0 flex-[1_1_14rem]">
        <span className="block font-mono text-headline tracking-widest">{code}</span>
        <span className="block text-card-note text-ink-soft">{said && said !== 'Copied' ? said : note}</span>
      </span>
      <span className="flex gap-xs">
        <Button size="sm" variant="outline" onClick={() => void copy(link)}>
          Copy link
        </Button>
        <Button size="sm" variant="outline" onClick={() => void copy(code)}>
          Copy code
        </Button>
      </span>
    </div>
  );
}

function Waitlist({ adminKey }: { adminKey: string }) {
  const [rows, setRows] = useState<WaitlistRow[] | null>(null);
  const [page, setPage] = useState<Page | undefined>(undefined);
  const [ask, setAsk] = useState<Ask>(FIRST);
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState('');
  const [status, setStatus] = useState<'' | WaitlistStatus>('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [approved, setApproved] = useState<{ code: string; link: string; note: string } | null>(null);
  const [removing, setRemoving] = useState<WaitlistRow | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await adminInviteApi.waitlist(adminKey, { status, q: asked }, pageQuery(ask.page, ask.size));
      setRows(r.items);
      setPage(r.page);
    } catch (e) {
      setError(e);
    }
  }, [adminKey, status, asked, ask]);
  useEffect(() => {
    void load();
  }, [load]);
  const act = async (row: WaitlistRow, fn: () => Promise<void>) => {
    setBusy(row.id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setBusy('');
    }
  };
  return (
    <section className="mt-lg" aria-labelledby="waitlist-heading">
      <SectionHead id="waitlist-heading" title="Waitlist" lede="Approve someone and they get a code of their own, by email when mail is set up." />
      <form
        className="mt-sm flex gap-xs"
        onSubmit={(e) => {
          e.preventDefault();
          setAsked(q.trim());
          setAsk((a) => ({ ...a, page: 1 }));
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a name or email" aria-label="Search the waitlist" className={`min-w-0 flex-1 ${FIELD_FILTER}`} />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      <div className="mt-sm">
        <FilterBar count={1} label="Filter the waitlist">
          <FilterSelect
            label="Status"
            value={status}
            items={STATUS_ITEMS}
            onChange={(k) => {
              setStatus(k);
              setAsk((a) => ({ ...a, page: 1 }));
            }}
          />
        </FilterBar>
      </div>
      {approved && <Shown code={approved.code} link={approved.link} note={approved.note} />}
      <ErrorLine e={removing ? null : error} className="mt-sm" />
      <div className="mt-sm">
        <DataTable<WaitlistRow>
          rows={rows ?? []}
          page={page}
          onPage={(p, size) => setAsk({ page: p, size })}
          rowKey={(r) => r.id}
          label="Waitlist"
          search={false}
          busy={Boolean(busy)}
          empty={rows === null ? 'Reading the waitlist' : 'Nobody is waiting.'}
          columns={[
            { key: 'name', label: 'Who', get: (r) => r.name, render: (r) => (<><span className="block font-semibold">{r.name}</span><span className="block text-caption text-ink-soft [overflow-wrap:anywhere]">{r.email}</span></>), wrap: true },
            { key: 'note', label: 'What brings them', get: (r) => r.note, wrap: true, wide: true },
            { key: 'status', label: 'Status', get: (r) => WAITLIST_WORDS[r.status].name, render: (r) => <StatusTag tone={WAITLIST_WORDS[r.status].tone}>{WAITLIST_WORDS[r.status].name}</StatusTag> },
            { key: 'when', label: 'Asked', get: (r) => r.createdAt, render: (r) => longDate(r.createdAt) },
          ]}
          actions={(r) => (
            <span className="flex items-center gap-xs">
              {r.status === 'waiting' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      void act(r, async () => {
                        const a = await adminInviteApi.approve(adminKey, r.id);
                        setApproved({ code: a.code, link: a.link, note: a.emailed ? `Emailed to ${r.email}.` : 'Not emailed: mail is not set up yet. Copy the link and send it yourself.' });
                      })
                    }
                  >
                    Approve
                  </Button>
                  <TapTwice size="sm" rest="Decline" ask="Tap again to decline" name={r.name} disabled={Boolean(busy)} onYes={() => void act(r, () => adminInviteApi.decline(adminKey, r.id).then(() => undefined))} />
                </>
              )}
              {r.status === 'invited' && r.code && r.link && (
                <Button size="sm" variant="outline" onClick={() => setApproved({ code: r.code ?? '', link: r.link ?? '', note: `${r.name}’s code.` })}>
                  Show code
                </Button>
              )}
              <MoreMenu label={`More about ${r.name}`} items={[{ key: 'remove', label: 'Remove from the list', destructive: true, onSelect: () => setRemoving(r) }]} />
            </span>
          )}
        />
      </div>
      <ConfirmDelete
        open={Boolean(removing)}
        title="Remove from the waitlist?"
        body="Their name, email and note go. A code already sent still works."
        yes="Yes, remove them"
        keep="Keep them"
        pending={Boolean(busy)}
        failed={Boolean(error)}
        error={error ? errorText(error) : undefined}
        onClose={() => setRemoving(null)}
        onYes={() => {
          if (!removing) return;
          const r = removing;
          void act(r, async () => {
            await adminInviteApi.remove(adminKey, r.id);
            setRemoving(null);
          });
        }}
      />
    </section>
  );
}

function Codes({ adminKey }: { adminKey: string }) {
  const [rows, setRows] = useState<AdminInvite[] | null>(null);
  const [page, setPage] = useState<Page | undefined>(undefined);
  const [ask, setAsk] = useState<Ask>(FIRST);
  const [q, setQ] = useState('');
  const [asked, setAsked] = useState('');
  const [state, setState] = useState<'' | InviteState>('');
  const [maker, setMaker] = useState<{ id: string; name: string } | null>(null);
  const [making, setMaking] = useState(false);
  const [made, setMade] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [revoking, setRevoking] = useState<AdminInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const [qrOf, setQrOf] = useState<AdminInvite | null>(null);
  const { copy, said } = useCopy();
  const sending = useRef(false);
  const load = useCallback(async () => {
    try {
      const r = await adminInviteApi.list(adminKey, { state, maker: maker?.id ?? '', q: asked }, pageQuery(ask.page, ask.size));
      setRows(r.items);
      setPage(r.page);
    } catch (e) {
      setError(e);
    }
  }, [adminKey, state, maker, asked, ask]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="mt-lg" aria-labelledby="codes-heading">
      <SectionHead
        id="codes-heading"
        title="Invite codes"
        lede="Each code makes one account, once. Its maker is credited."
        action={<Button onClick={() => (setMade(''), setMaking(true))}>Make codes</Button>}
      />
      {made && (
        <p role="status" className="mt-sm m-0 text-subhead font-semibold">
          {made}
        </p>
      )}
      {said && (
        <p role="status" className="mt-xs m-0 text-caption text-ink-soft">
          {said}
        </p>
      )}
      <form
        className="mt-sm flex gap-xs"
        onSubmit={(e) => {
          e.preventDefault();
          setAsked(q.trim());
          setAsk((a) => ({ ...a, page: 1 }));
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a code or label" aria-label="Search codes" className={`min-w-0 flex-1 ${FIELD_FILTER}`} />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>
      <div className="mt-sm">
        <FilterBar count={1} label="Filter the codes">
          <FilterSelect
            label="State"
            value={state}
            items={STATE_ITEMS}
            onChange={(k) => {
              setState(k);
              setAsk((a) => ({ ...a, page: 1 }));
            }}
          />
        </FilterBar>
      </div>
      {maker && (
        <p className="mt-xs m-0 flex flex-wrap items-center justify-between gap-xs text-subhead text-ink-soft">
          <span>Only codes {maker.name} made.</span>
          <Button size="sm" variant="outline" onClick={() => (setMaker(null), setAsk((a) => ({ ...a, page: 1 })))}>
            Show everyone’s
          </Button>
        </p>
      )}
      <ErrorLine e={making || revoking ? null : error} className="mt-sm" />
      <div className="mt-sm">
        <DataTable<AdminInvite>
          rows={rows ?? []}
          page={page}
          onPage={(p, size) => setAsk({ page: p, size })}
          rowKey={(r) => r.id}
          label="Invite codes"
          search={false}
          busy={busy}
          empty={rows === null ? 'Reading the codes' : 'No codes yet. Make some above.'}
          columns={[
            { key: 'code', label: 'Code', get: (r) => r.code, render: (r) => (<><span className="block font-mono font-semibold tracking-widest">{r.code}</span>{r.label && <span className="block text-caption text-ink-soft">{r.label}</span>}</>) },
            { key: 'state', label: 'State', get: (r) => INVITE_STATE_WORDS[r.state].name, render: (r) => <StatusTag tone={INVITE_STATE_WORDS[r.state].tone}>{INVITE_STATE_WORDS[r.state].name}</StatusTag> },
            { key: 'maker', label: 'Made by', get: (r) => r.maker?.name ?? '', render: (r) => who(r.maker, 'The admin key'), wrap: true },
            { key: 'used', label: 'Used by', get: (r) => r.usedBy?.name ?? '', render: (r) => (<>{who(r.usedBy, r.state === 'used' ? 'A deleted member' : 'Nobody yet')}{r.usedAt && <span className="block text-caption text-ink-soft">{longDate(r.usedAt)}</span>}</>), wrap: true },
            { key: 'when', label: 'Made', get: (r) => r.createdAt, render: (r) => (<><span className="block">{longDate(r.createdAt)}</span><span className="block text-caption text-ink-soft">{r.expiresAt ? `Until ${longDate(r.expiresAt)}` : 'Never ends'}</span></>), wide: true },
          ]}
          actions={(r) =>
            r.state === 'open' ? (
              <span className="flex items-center gap-xs">
                <Button size="sm" variant="outline" onClick={() => void copy(r.link)}>
                  Copy link
                </Button>
                <MoreMenu
                  label={`More about code ${r.code}`}
                  items={[
                    { key: 'code', label: 'Copy code', onSelect: () => void copy(r.code) },
                    { key: 'qr', label: 'Show QR code', onSelect: () => setQrOf(r) },
                    ...(r.maker ? [{ key: 'maker', label: `Only codes ${r.maker.name} made`, onSelect: () => (setMaker({ id: r.maker?.id ?? '', name: r.maker?.name ?? '' }), setAsk((a) => ({ ...a, page: 1 }))) }] : []),
                    { key: 'revoke', label: 'Take it back', destructive: true, onSelect: () => (setError(null), setRevoking(r)) },
                  ]}
                />
              </span>
            ) : r.maker ? (
              <MoreMenu label={`More about code ${r.code}`} items={[{ key: 'maker', label: `Only codes ${r.maker.name} made`, onSelect: () => (setMaker({ id: r.maker?.id ?? '', name: r.maker?.name ?? '' }), setAsk((a) => ({ ...a, page: 1 }))) }]} />
            ) : null
          }
        />
      </div>

      <Sheet open={making} onClose={() => setMaking(false)} title="Make invite codes">
        <div className="pb-xl">
          <MakeInvitesForm
            solid
            onMake={async (body) => {
              const r = await adminInviteApi.make(adminKey, body);
              setMaking(false);
              setMade(r.items.length === 1 ? `Made ${r.items[0]?.code ?? 'a code'}. Copy its link in the list.` : `Made ${formatCount(r.items.length)} codes. Copy their links in the list.`);
              setAsk((a) => ({ ...a, page: 1 }));
              await load();
            }}
          />
        </div>
      </Sheet>

      <Sheet open={Boolean(qrOf)} onClose={() => setQrOf(null)} title={qrOf ? `Code ${qrOf.code}` : 'QR code'}>
        {qrOf && (
          <div className="flex flex-col items-center gap-sm pb-xl">
            <InviteQr link={qrOf.link} code={qrOf.code} />
            <p className="m-0 text-center text-caption text-ink-soft">A scan opens the invite. It makes one account.</p>
          </div>
        )}
      </Sheet>

      <ConfirmDelete
        open={Boolean(revoking)}
        title="Take this code back?"
        body="It stops working at once. Nobody has used it yet."
        yes="Yes, take it back"
        keep="Keep it"
        pending={busy}
        failed={Boolean(error)}
        error={error ? errorText(error) : undefined}
        onClose={() => setRevoking(null)}
        onYes={() => {
          if (!revoking || sending.current) return;
          sending.current = true;
          setBusy(true);
          adminInviteApi
            .revoke(adminKey, revoking.id)
            .then(async () => {
              setRevoking(null);
              await load();
            })
            .catch((e: unknown) => setError(e))
            .finally(() => {
              sending.current = false;
              setBusy(false);
            });
        }}
      />
    </section>
  );
}

/**
 * Admin, Invites (2026-11-10): the Invite only switch, the waitlist and every invite code. Joining is by invite while the switch is on; a
 * code makes one account, once, and that account is credited to whoever made the code. Every change here is audited on the server.
 */
export function AdminInvites({ adminKey }: { adminKey: string }) {
  return (
    <section className="mt-md" aria-labelledby="invites-heading">
      <SectionHead id="invites-heading" title="Invites" lede="Who can make an account, and how. Staff and Inviters make codes on their Profile tab." />
      <Gate adminKey={adminKey} />
      <Waitlist adminKey={adminKey} />
      <Codes adminKey={adminKey} />
    </section>
  );
}
