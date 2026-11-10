import { DEFAULT_PAGE_SIZE, TEAM_ROLES, TEAM_ROLE_META, formatCount, money, pageQuery, type Page, type PageSize, type TagTone, type TeamRole } from '@kreators/shared';
import { CONNECT_KIND_META, CONNECT_MODE_NAMES, CONNECT_REASON_MAX, CONNECT_STATE_NAMES, type ConnectKind, type ConnectMode, type ConnectPerson, type ConnectPlace, type ConnectState, type PersonConnections, type TeamConnection } from '@kreators/shared/connect';
import { useCallback, useEffect, useRef, useState } from 'react';
import { connectApi, type ConnectDoor } from '../lib/connectApi';
import { focusHeadingAfter } from '../lib/focusHeading';
import { useParamState } from '../lib/useParamState';
import { FIELD, SELECT_SM } from '../lib/ui';
import { longDate } from '../lib/date';
import { tie } from '../lib/text';
import { Button } from './Button';
import { ConfirmDelete } from './ConfirmDelete';
import { DataTable } from './DataTable';
import { ErrorLine, errorText } from './ErrorLine';
import { FieldLabel } from './Field';
import { PersonField } from './ConnectPersonField';
import { Segmented } from './fx/Segmented';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';
import { StickyAction } from './StickyAction';

const STATE_TONE: Record<ConnectState, TagTone> = { asked: 'warn', accepted: 'good', declined: 'neutral', ended: 'neutral' };
const priceOf = (p: ConnectPlace) => [p.pricePoints > 0 ? `${formatCount(p.pricePoints)} points` : '', p.priceCents > 0 ? money(p.priceCents, p.currency) : ''].filter(Boolean).join(' or ') || 'Free';
const endWord = (r: TeamConnection) => (r.state === 'asked' ? 'Withdraw' : 'End');
/** The kind in the list, short, so a row keeps room for the names and End on a laptop; the picker keeps the full names. */
const KIND_SHORT: Record<ConnectKind, string> = { coach: 'Life coach', friends: 'Friends', agency: 'Agency team', program: 'School program', product: 'Shop course', club: 'Club manager', cohort: 'Cohort manager', org: 'Brand team' };
/** A cohort reads as its program over the cohort, two lines like a person over their handle, so a narrow cell never breaks it mid-name. */
function PlaceCell({ r }: { r: TeamConnection }) {
  const cut = r.kind === 'cohort' ? r.place.lastIndexOf(', ') : -1;
  if (cut < 0) return <>{r.place}</>;
  return (
    <>
      <span className="block font-semibold">{tie(r.place.slice(0, cut))}</span>
      <span className="block text-caption text-ink-soft">{r.place.slice(cut + 2)}</span>
    </>
  );
}

/** The kinds whose second side is a place picked from a list, and what the picker is called. */
const PLACE_OF: Partial<Record<ConnectKind, { kind: 'program' | 'product' | 'cohort' | 'org'; label: string; none: string; hint: string }>> = {
  program: { kind: 'program', label: 'Private program', none: 'None is private yet.', hint: 'The invite shows the price. Nothing is bought for them.' },
  product: { kind: 'product', label: 'Private course', none: 'None is private yet.', hint: 'The invite shows the price. Nothing is bought for them.' },
  cohort: { kind: 'cohort', label: 'Cohort', none: 'No cohort you can change yet.', hint: 'The one it names runs it from now on.' },
  org: { kind: 'org', label: 'Brand', none: 'No brand yet.', hint: 'They join only if they say yes.' },
};

/**
 * Admin, Connect people (2026-11-09, the founder: "can u add ability to connect people in admin center?"): one place for every
 * connection the team makes. Pick the kind, the people (and the place a kind needs), how, and Send; each kind runs the app's own
 * action on the server (routes/adminConnect.ts). Under it, every connection the team made, with End or Withdraw. Since 2026-11-10 a staff
 * member reaches it too, from Manage (`door` null): the server answers which kinds are theirs, and the form and the list offer only those.
 */
export function AdminConnect({ door, titled = true }: { door: ConnectDoor; titled?: boolean }) {
  // The kinds this person may make, as the list's answer says; until it arrives the form waits on the first.
  const [kinds, setKinds] = useState<ConnectKind[]>([]);
  // A person from People's Connections sheet arrives as `with`: their name fills the first field and the list shows theirs.
  const [withId, setWithId] = useParamState('with', '');
  const [picked, setKind] = useState<ConnectKind | null>(null);
  const kind: ConnectKind = picked && kinds.includes(picked) ? picked : (kinds[0] ?? 'coach');
  const meta = CONNECT_KIND_META[kind];
  const placeOf = PLACE_OF[kind];
  const [first, setFirst] = useState(withId);
  const [second, setSecond] = useState('');
  const [firstP, setFirstP] = useState<ConnectPerson | null>(null);
  const [secondP, setSecondP] = useState<ConnectPerson | null>(null);
  const [mode, setMode] = useState<ConnectMode>('ask');
  const [reason, setReason] = useState('');
  const [role, setRole] = useState<TeamRole>('content_creator');
  const [places, setPlaces] = useState<ConnectPlace[]>([]);
  const [place, setPlace] = useState('');
  const [clients, setClients] = useState<ConnectPlace[]>([]);
  const [clientId, setClientId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState('');

  const [rows, setRows] = useState<TeamConnection[]>([]);
  const [page, setPage] = useState<Page | undefined>(undefined);
  const [ask, setAsk] = useState<{ page: number; size: PageSize }>({ page: 1, size: DEFAULT_PAGE_SIZE });
  const [listKind, setListKind] = useState('');
  const [listError, setListError] = useState<unknown>(null);
  const [ending, setEnding] = useState<TeamConnection | null>(null);
  const [endFailed, setEndFailed] = useState('');
  // A tap that lands before the button shows it is busy (a double tap, two Enters) goes out once.
  const sending = useRef(false);
  const firstRef = useRef<HTMLInputElement>(null);
  const secondRef = useRef<HTMLInputElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  // Where the keyboard goes once Send is no longer busy (it went quiet while it worked, so focus had nowhere to stay).
  const after = useRef<'send' | 'next' | null>(null);
  useEffect(() => {
    if (busy || !after.current) return;
    const el = after.current === 'send' ? sendRef.current : (meta.second ? secondRef : firstRef).current;
    after.current = null;
    el?.focus({ preventScroll: true });
    // The kind is read as it is now; only the end of a send moves the keyboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  useEffect(() => {
    if (!withId) return;
    setFirst(withId);
    // From the sheet under People the page kept its place, far down the list: bring the next field to the middle and put the keyboard there.
    requestAnimationFrame(() => {
      const el = (meta.second ? secondRef : firstRef).current;
      el?.scrollIntoView({ block: 'center' });
      el?.focus({ preventScroll: true });
    });
    // Only a new person from the sheet moves the keyboard, never a change of kind.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withId]);

  const load = useCallback(
    async (a = ask) => {
      try {
        const r = await connectApi.list(door, { kind: listKind, person: withId }, pageQuery(a.page, a.size));
        setRows(r.connections);
        setPage(r.page);
        setKinds(r.kinds);
        setListError(null);
      } catch (e) {
        setListError(e);
      }
    },
    [door, ask, listKind, withId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  // The places a kind names: private programs or courses, cohorts or brands, or the owner's clients for a client member.
  const placeKind = placeOf?.kind ?? null;
  useEffect(() => {
    let live = true;
    setPlace('');
    if (!placeKind || !kinds.length) return setPlaces([]);
    connectApi
      .places(door, placeKind)
      .then((r) => live && setPlaces(r.places))
      .catch(() => live && setPlaces([]));
    return () => {
      live = false;
    };
  }, [door, placeKind, kinds.length]);
  useEffect(() => {
    let live = true;
    setClientId('');
    if (kind !== 'agency' || role !== 'client' || !firstP) return setClients([]);
    connectApi
      .places(door, 'client', firstP.id)
      .then((r) => live && setClients(r.places))
      .catch(() => live && setClients([]));
    return () => {
      live = false;
    };
  }, [door, kind, role, firstP]);

  const pickKind = (k: ConnectKind) => {
    setKind(k);
    setMode(CONNECT_KIND_META[k].modes[0] ?? 'ask');
    setError(null);
    setDone('');
  };

  const ready =
    Boolean(firstP) &&
    (!meta.second || Boolean(secondP)) &&
    (!placeOf || Boolean(place)) &&
    (kind !== 'agency' || role !== 'client' || Boolean(clientId)) &&
    (mode !== 'direct' || reason.trim().length > 0);

  const send = async () => {
    if (!firstP || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    setDone('');
    try {
      await connectApi.connect(door, {
        kind,
        first: firstP.id,
        ...(meta.second && secondP ? { second: secondP.id } : {}),
        mode,
        ...(mode === 'direct' ? { reason: reason.trim() } : {}),
        ...(kind === 'agency' ? { role, ...(role === 'client' ? { clientId } : {}) } : {}),
        ...(placeOf ? { place } : {}),
      });
      // A person and a place are not a pair: an invite names where it is to.
      const where = places.find((p) => p.id === place)?.name;
      setDone(
        kind === 'cohort'
          ? `${firstP.name} runs ${where ?? 'the cohort'} now. Both managers were told.`
          : !meta.second
          ? `Invited ${firstP.name}${where ? ` to ${where}` : ''}. The invite is in their inbox.`
          : mode === 'direct'
            ? `Done: ${firstP.name} and ${secondP?.name ?? ''}. Both were told.`
            : `Asked: ${firstP.name} and ${secondP?.name ?? ''}. They answer in their inbox.`,
      );
      setSecond('');
      // A kind with one person (a program, a course, a cohort, a brand) empties that one, so the keyboard lands on an empty field and a
      // second Enter cannot send the same person again (2026-11-10, the break-it check).
      if (!meta.second) setFirst('');
      setReason('');
      // A cohort's manager changed: its line in the picker names the new one.
      if (placeKind === 'cohort') void connectApi.places(door, 'cohort').then((r) => setPlaces(r.places)).catch(() => undefined);
      // A new object each time, so the list reads again even when it was on page 1.
      setAsk((a) => ({ ...a, page: 1 }));
      // To the emptied field, ready for the next person.
      after.current = 'next';
    } catch (e) {
      setError(e);
      // Back to Send, which can be used again once it is no longer busy.
      after.current = 'send';
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="mt-md" aria-labelledby={titled ? 'connect-heading' : undefined} aria-label={titled ? undefined : 'Connect people'}>
      {/* Manage's own page carries the title on its cover, so there the section starts with the form. */}
      {titled && (
        <>
          <h2 id="connect-heading" className="text-title2">
            Connect people
          </h2>
          <p className="mt-xs m-0 text-subhead text-ink-soft">Each kind runs the app’s own steps. Anything that shares something with someone waits for their yes.</p>
        </>
      )}
      {page && !kinds.length && <p className="mt-sm m-0 text-subhead">None of your permissions makes connections yet. An admin can give you one under People.</p>}

      {kinds.length > 0 && (
      <form
        className={`${titled ? 'mt-sm ' : ''}grid gap-sm rounded-card bg-card p-md shadow-toy-soft`}
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !busy) void send();
        }}
      >
        <FieldLabel label="Kind of connection">
          <select value={kind} onChange={(e) => pickKind(e.target.value as ConnectKind)} className={FIELD}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {CONNECT_KIND_META[k].name}
              </option>
            ))}
          </select>
        </FieldLabel>
        <p className="m-0 text-subhead text-ink-soft">{meta.line}</p>

        <div className="grid gap-sm md:grid-cols-2">
          <PersonField door={door} label={meta.first} value={first} onChange={setFirst} onFound={setFirstP} inputRef={firstRef} />
          {meta.second && <PersonField door={door} label={meta.second} value={second} onChange={setSecond} onFound={setSecondP} inputRef={secondRef} />}
          {placeOf && (
            <FieldLabel label={placeOf.label} hint={places.length ? placeOf.hint : placeOf.none}>
              <select value={place} onChange={(e) => setPlace(e.target.value)} className={FIELD} disabled={!places.length}>
                <option value="">Pick one</option>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {kind === 'program' || kind === 'product' ? `${p.name}, ${priceOf(p)}` : p.name}
                  </option>
                ))}
              </select>
            </FieldLabel>
          )}
        </div>

        {kind === 'agency' && (
          <div className="grid gap-sm md:grid-cols-2">
            <FieldLabel label="Role on the team" hint="They start with no access. The owner gives it.">
              <select value={role} onChange={(e) => setRole(e.target.value as TeamRole)} className={FIELD}>
                {TEAM_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {TEAM_ROLE_META[r].name}
                  </option>
                ))}
              </select>
            </FieldLabel>
            {role === 'client' && (
              <FieldLabel label="Which client they are" hint={firstP ? (clients.length ? 'One of the owner’s clients.' : 'The owner has no clients yet.') : 'Find the owner first.'}>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={FIELD} disabled={!clients.length}>
                  <option value="">Pick one</option>
                  {clients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            )}
          </div>
        )}

        {meta.modes.length > 1 && (
          <div>
            <p className="m-0 text-subhead font-semibold" id="connect-how">
              How
            </p>
            <Segmented
              className="mt-xs"
              label="How"
              value={mode}
              onChange={setMode}
              options={meta.modes.map((m) => ({ value: m, label: m === 'ask' ? 'Ask them' : 'Link now' }))}
            />
          </div>
        )}
        {mode === 'direct' && (
          <FieldLabel label="Why they are linked now" hint="Only the team sees this, in the audit log. Nobody is sent it.">
            <input value={reason} maxLength={CONNECT_REASON_MAX} onChange={(e) => setReason(e.target.value)} className={FIELD} />
          </FieldLabel>
        )}

        <ErrorLine e={error} />
        {done && (
          <p role="status" className="m-0 text-subhead font-semibold">
            {done}
          </p>
        )}
        <StickyAction label="Send this connection">
          <Button ref={sendRef} type="submit" disabled={busy || !ready} full>
            Send
          </Button>
        </StickyAction>
      </form>
      )}

      <div className="mt-lg flex flex-wrap items-center justify-between gap-sm">
        <h3 id="connect-list-heading" className="text-headline">
          Connections the team made
        </h3>
        <select
          value={listKind}
          onChange={(e) => {
            setListKind(e.target.value);
            setAsk((a) => ({ ...a, page: 1 }));
          }}
          aria-label="Kind"
          className={`ml-auto w-full sm:w-auto ${SELECT_SM}`}
        >
          <option value="">Every kind</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {CONNECT_KIND_META[k].name}
            </option>
          ))}
        </select>
      </div>
      {withId && (
        <p className="mt-xs m-0 flex flex-wrap items-center justify-between gap-xs text-subhead text-ink-soft">
          <span>Only {firstP?.id === withId ? firstP.name : 'one person'}’s connections.</span>
          <Button size="sm" variant="outline" onClick={() => setWithId('')}>
            Show everyone’s
          </Button>
        </p>
      )}
      <ErrorLine e={listError} className="mt-xs" />
      <div className="mt-sm">
        <DataTable<TeamConnection>
          rows={rows}
          page={page}
          onPage={(p, size) => {
            const a = { page: p, size };
            setAsk(a);
          }}
          rowKey={(r) => r.id}
          label="Connections the team made"
          empty={page ? 'None yet. Send one above.' : 'Reading the list'}
          columns={[
            // The kind is chosen by the select above, which asks the server, so the column carries no second filter.
            // Who and With may wrap, so End and Withdraw stay inside the card on a laptop (a 40-letter name pushed them out at 1024 and 1280).
            { key: 'kind', label: 'Kind', get: (r) => KIND_SHORT[r.kind] },
            { key: 'first', label: 'Who', get: (r) => r.first.name, render: (r) => (<><span className="block font-semibold">{r.first.name}</span>{r.first.handle && <span className="block text-caption text-ink-soft">@{r.first.handle}</span>}</>), wrap: true },
            { key: 'second', label: 'With', get: (r) => r.second?.name ?? r.place, render: (r) => (r.second ? (<><span className="block font-semibold">{r.second.name}</span>{r.place ? <span className="block text-caption text-ink-soft">{r.place}</span> : r.second.handle && <span className="block text-caption text-ink-soft">@{r.second.handle}</span>}</>) : <PlaceCell r={r} />), wrap: true },
            { key: 'mode', label: 'How', get: (r) => CONNECT_MODE_NAMES[r.mode], filter: true, wide: true },
            { key: 'state', label: 'State', get: (r) => CONNECT_STATE_NAMES[r.state], render: (r) => <StatusTag tone={STATE_TONE[r.state]}>{CONNECT_STATE_NAMES[r.state]}</StatusTag>, filter: true },
            // Who on the team made it sits under the day, so the card keeps room for End on a laptop.
            { key: 'when', label: 'When', get: (r) => r.createdAt, render: (r) => (<><span className="block">{longDate(r.createdAt)}</span><span className="block text-caption text-ink-soft">By {r.by}</span></>) },
          ]}
          actions={(r) =>
            r.canEnd ? (
              <Button size="sm" variant="outline" onClick={() => (setEndFailed(''), setEnding(r))}>
                {endWord(r)}
              </Button>
            ) : null
          }
        />
      </div>

      <ConfirmDelete
        open={Boolean(ending)}
        title={ending ? `${endWord(ending)} this connection?` : ''}
        body={
          ending?.kind === 'coach'
            ? 'The coach stops seeing what the student shared, and both are told. This cannot be undone.'
            : ending?.state === 'asked'
              ? 'The ask is taken back. Anything they already said yes to stays.'
              : ending?.kind === 'cohort'
                ? 'The cohort has no manager until you name one, and they are told.'
                : 'The manager is taken off, and both are told.'
        }
        yes={ending ? `Yes, ${endWord(ending).toLowerCase()} it` : 'Yes'}
        keep="Keep it"
        pending={busy}
        failed={Boolean(endFailed)}
        error={endFailed}
        onClose={() => setEnding(null)}
        onYes={() => {
          if (!ending || sending.current) return;
          sending.current = true;
          setBusy(true);
          connectApi
            .end(door, ending.id)
            .then(async () => {
              setEnding(null);
              // Its End button goes with it, so the keyboard moves to the heading of the list.
              focusHeadingAfter('connect-list-heading');
              await load();
            })
            .catch((e: unknown) => setEndFailed(errorText(e)))
            .finally(() => {
              sending.current = false;
              setBusy(false);
            });
        }}
      />
    </section>
  );
}

/** People, Connections: what the team may manage for one person, a friend count (never the list), and a way to connect them. */
export function PersonConnectionsSheet({ adminKey, personId, onClose, onConnect }: { adminKey: string; personId: string | null; onClose: () => void; onConnect: (id: string) => void }) {
  const [data, setData] = useState<PersonConnections | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    if (!personId) return;
    connectApi
      .ofPerson(adminKey, personId)
      .then((r) => live && setData(r))
      .catch((e: unknown) => live && setError(e));
    return () => {
      live = false;
    };
  }, [adminKey, personId]);
  return (
    <Sheet open={Boolean(personId)} onClose={onClose} title={data ? `${data.person.name}’s connections` : 'Connections'}>
      <div className="grid gap-md pb-xl">
        <ErrorLine e={error} />
        {!data && !error && (
          <p role="status" className="m-0 text-subhead text-ink-soft">
            Reading their connections
          </p>
        )}
        {data && (
          <>
            <p className="m-0 text-subhead text-ink-soft">
              {formatCount(data.friends)} {data.friends === 1 ? 'friend' : 'friends'}. Only the count shows here.
            </p>
            {data.items.length === 0 ? (
              <p className="m-0 text-subhead">Nothing the team can manage yet.</p>
            ) : (
              <ul className="m-0 grid list-none gap-xs p-0">
                {data.items.map((it, i) => (
                  <li key={`${it.kind}-${i}`} className="flex flex-wrap items-center justify-between gap-xs rounded-tile bg-paper p-sm">
                    <span className="min-w-0 flex-[1_1_14rem]">
                      <span className="block text-subhead font-semibold">{it.with}</span>
                      <span className="block text-caption text-ink-soft">
                        {it.label ?? CONNECT_KIND_META[it.kind].name}. {it.as}
                      </span>
                    </span>
                    <StatusTag tone={STATE_TONE[it.state]}>{CONNECT_STATE_NAMES[it.state]}</StatusTag>
                  </li>
                ))}
              </ul>
            )}
            <Button full onClick={() => onConnect(data.person.id)}>
              Connect to someone
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
