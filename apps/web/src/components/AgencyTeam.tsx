import {
  AGENCY_DOC_STATUS_NAME,
  AGENCY_DOC_STATUS_TONE,
  CONTRACT_STATUS_NAME,
  CONTRACT_STATUS_TONE,
  DELIVERABLE_STAGE_META,
  DELIVERABLE_STAGE_TONE,
  INVOICE_STATUS_NAME,
  INVOICE_STATUS_TONE,
  TEAM_LEVEL_NAME,
  TEAM_ROLE_META,
  TEAM_ROLES,
  TEAM_STATUS_NAME,
  TEAM_STATUS_TONE,
  TEAM_TAB_NAME,
  TEAM_TABS,
  money,
  pageQuery,
  parseTeamAccess,
  teamCap,
  teamDefaults,
  type PortalView,
  type TagTone,
  type TeamAccess,
  type TeamLevel,
  type TeamMember,
  type TeamRole,
  type TeamTab,
} from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, RotateCcw, Shuffle, UserMinus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { prettyDate, shortDay } from '../lib/date';
import { useAuthed } from '../lib/queries';
import { FIELD, FIELD_44 } from '../lib/ui';
import { Button } from './Button';
import { ConfirmDelete } from './ConfirmDelete';
import { ErrorLine } from './ErrorLine';
import { IconTag } from './FactTag';
import { FieldLabel } from './Field';
import { Fold } from './Fold';
import { Segmented } from './fx/Segmented';
import { Icon } from './Icon';
import { MoreMenu } from './MoreMenu';
import { Pager, usePage } from './Pager';
import { Section } from './Section';
import { Sheet } from './Sheet';
import { Busy, Skeleton } from './Skeleton';
import { StageBar } from './StageBar';
import { StatusTag } from './StatusTag';

const COPY = {
  lede: 'Who works with you, and what each one can open.',
  empty: 'Nobody yet. Invite a video editor, a videographer, a content creator or a client.',
  friend: 'We also send a friend request if you are not friends yet.',
  who: 'Email, @username or friend code',
  locked: 'Off, always for a client',
  fail: 'Could not load your team. Try again in a moment.',
} as const;

const ROLE_TONE: Record<TeamRole, TagTone> = { content_creator: 'warm', videographer: 'calm', editor: 'deep', client: 'info' };

/** The levels a tab can take for a role: Overview is never edit, and a client is at most view with Clients locked off. */
function levelsFor(role: TeamRole, tab: TeamTab): TeamLevel[] {
  const cap = teamCap(role, tab);
  return cap === 'off' ? ['off'] : cap === 'view' ? ['off', 'view'] : ['off', 'view', 'edit'];
}

/** Four rows, one per tab of the Agency screen, each Off / View / Edit. Clients for a client member is shown as locked. */
function AccessRows({ role, access, onChange, idPrefix }: { role: TeamRole; access: TeamAccess; onChange: (next: TeamAccess) => void; idPrefix: string }) {
  return (
    <ul className="grid list-none gap-xs p-0 m-0 md:grid-cols-2 md:gap-x-lg" aria-label="What they can open">
      {TEAM_TABS.map((tab) => {
        const levels = levelsFor(role, tab);
        return (
          <li key={tab} className="flex flex-wrap items-center justify-between gap-xs">
            <span id={`${idPrefix}-${tab}`} className="min-w-[96px] text-subhead font-semibold">
              {TEAM_TAB_NAME[tab]}
            </span>
            {levels.length === 1 ? (
              <span className="inline-flex min-h-[44px] items-center gap-xs text-subhead text-ink-soft">
                <Icon icon={Lock} size={16} />
                {COPY.locked}
              </span>
            ) : (
              <Segmented<TeamLevel>
                label={`${TEAM_TAB_NAME[tab]} access`}
                value={access[tab]}
                onChange={(v) => onChange(parseTeamAccess({ ...access, [tab]: v }, role))}
                options={levels.map((l) => ({ value: l, label: TEAM_LEVEL_NAME[l] }))}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The four roles as equal choices, two by two on a phone and in one row from the tablet up, so no name is ever cut. */
function RolePick({ value, onChange }: { value: TeamRole; onChange: (r: TeamRole) => void }) {
  return (
    <div role="group" aria-label="Role" className="grid grid-cols-2 gap-xs sm:grid-cols-4">
      {TEAM_ROLES.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={value === r}
          onClick={() => onChange(r)}
          className={`toy min-h-[36px] md:min-h-[44px] tap-pad rounded-pill border-2 px-sm py-0 md:py-xs text-subhead font-medium ${value === r ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
        >
          {TEAM_ROLE_META[r].name}
        </button>
      ))}
    </div>
  );
}

/** A round picture, or the first letter of the name when there is none. */
function Face({ name, url }: { name: string; url: string }) {
  const [broken, setBroken] = useState(false);
  if (url && url.startsWith('https://') && !broken)
    return <img src={url} alt="" width={44} height={44} loading="lazy" decoding="async" onError={() => setBroken(true)} className="size-[44px] shrink-0 rounded-pill bg-paper object-cover" />;
  return (
    <span aria-hidden="true" className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-headline text-ink-soft">
      {(name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

/** Pick a client for a client member, from the owner's own clients. */
function ClientPick({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const q = useAuthed(['agency', 'clients-all'], () => api.agency('csize=100'));
  const clients = q.data?.clients ?? [];
  return (
    <FieldLabel className="mt-sm" label="Which client are they?" hint={q.isSuccess && clients.length === 0 ? 'Add the client first, under Clients.' : undefined}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD_44}>
        <option value="">Pick a client</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </FieldLabel>
  );
}

/** Invite someone: who, their role, which client for a client, and what they can open (the role's defaults, changeable). */
function InviteSheet({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: (line: string) => void }) {
  const qc = useQueryClient();
  const [who, setWho] = useState('');
  const [role, setRole] = useState<TeamRole>('editor');
  const [clientId, setClientId] = useState('');
  const [access, setAccess] = useState<TeamAccess>(teamDefaults('editor'));
  const send = useMutation({
    mutationFn: () => api.agencyTeamInvite({ who: who.trim(), role, access, ...(role === 'client' ? { clientId } : {}) }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['agency', 'team'] });
      onSent(r.friendRequest === 'sent' ? 'Invite sent, with a friend request.' : r.friendRequest === 'friends' ? 'Invite sent. You are already friends.' : 'Invite sent.');
      setWho('');
      setRole('editor');
      setClientId('');
      setAccess(teamDefaults('editor'));
      onClose();
    },
  });
  const pickRole = (r: TeamRole) => {
    setRole(r);
    setAccess(teamDefaults(r));
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!send.isPending) send.mutate();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Invite a team member">
      <form onSubmit={submit}>
        <FieldLabel label={COPY.who} hint={COPY.friend}>
          <input value={who} onChange={(e) => setWho(e.target.value)} maxLength={200} autoComplete="off" autoCapitalize="none" spellCheck={false} className={FIELD} placeholder="name@example.com" />
        </FieldLabel>
        <p className="mt-sm m-0 text-subhead font-semibold">Role</p>
        <div className="mt-xs">
          <RolePick value={role} onChange={pickRole} />
        </div>
        <p className="mt-xs m-0 text-subhead text-ink-soft">{TEAM_ROLE_META[role].blurb}</p>
        {role === 'client' && <ClientPick value={clientId} onChange={setClientId} />}
        <p className="mt-md m-0 text-subhead font-semibold">What they can open</p>
        <div className="mt-xs">
          <AccessRows role={role} access={access} onChange={setAccess} idPrefix="invite" />
        </div>
        {send.isError && <ErrorLine e={send.error} className="mt-xs" />}
        <div className="mt-md">
          <Button type="submit" full disabled={send.isPending || !who.trim() || (role === 'client' && !clientId)}>
            {send.isPending ? 'Sending' : 'Send invite'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/** Change someone's role (and their client, for a client). Access goes back to the new role's defaults. */
function RoleSheet({ m, onClose }: { m: TeamMember | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [role, setRole] = useState<TeamRole>(m?.role ?? 'editor');
  const [clientId, setClientId] = useState(m?.client?.id ?? '');
  const save = useMutation({
    mutationFn: () => api.agencyTeamUpdate(m!.id, { role, ...(role === 'client' ? { clientId } : {}) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agency', 'team'] });
      onClose();
    },
  });
  return (
    <Sheet open={m !== null} onClose={onClose} title={`Change ${m?.person.name ?? 'their'} role`}>
      <RolePick value={role} onChange={setRole} />
      <p className="mt-xs m-0 text-subhead text-ink-soft">{TEAM_ROLE_META[role].blurb}</p>
      {role === 'client' && <ClientPick value={clientId} onChange={setClientId} />}
      <p className="mt-sm m-0 text-subhead text-ink-soft">What they can open goes back to this role's usual set. You can change it after.</p>
      {save.isError && <ErrorLine e={save.error} className="mt-xs" />}
      <div className="mt-md">
        <Button full onClick={() => save.mutate()} disabled={save.isPending || role === m?.role || (role === 'client' && !clientId)}>
          Save role
        </Button>
      </div>
    </Sheet>
  );
}

/** One member: who, their role and status, the four switches (saved at once), and More (change role, resend, remove). */
function MemberRow({ m, onRole, onSaid }: { m: TeamMember; onRole: (m: TeamMember) => void; onSaid: (line: string) => void }) {
  const qc = useQueryClient();
  const [access, setAccess] = useState<TeamAccess>(m.access);
  const [shown, setShown] = useState(m.access);
  // A fresh answer from the server (another tab, a role change) replaces what is on screen.
  if (shown !== m.access) {
    setShown(m.access);
    setAccess(m.access);
  }
  const save = useMutation({
    mutationFn: (next: TeamAccess) => api.agencyTeamUpdate(m.id, { access: next }),
    onError: () => setAccess(m.access),
    onSettled: () => qc.invalidateQueries({ queryKey: ['agency', 'team'] }),
  });
  const resend = useMutation({ mutationFn: () => api.agencyTeamResend(m.id), onSuccess: () => onSaid(`Sent ${m.person.name} the invite again.`), onError: (e) => onSaid(e instanceof Error ? e.message : 'That did not send.') });
  // Someone else's access closes, so it asks in a sheet with its own red yes, never a second tap (CLAUDE.md, Confirmations; the review of
  // 2026-11-14). The sheet is portalled, so the card's blur never frames it.
  const [asking, setAsking] = useState(false);
  const remove = useMutation({
    mutationFn: () => api.agencyTeamRemove(m.id),
    onSuccess: () => {
      setAsking(false);
      onSaid(m.status === 'invited' ? `Took back the invite to ${m.person.name}.` : `${m.person.name} is off your team.`);
      void qc.invalidateQueries({ queryKey: ['agency', 'team'] });
    },
  });
  const open = m.status !== 'removed';
  const since = m.status === 'active' && m.joinedAt ? `joined ${shortDay(m.joinedAt)}` : m.status === 'invited' ? `invited ${shortDay(m.invitedAt)}` : '';
  return (
    <li className="rounded-card bg-card p-md shadow-toy-soft">
      <div className="flex items-start gap-sm">
        <Face name={m.person.name} url={m.person.avatarUrl} />
        <div className="min-w-0 flex-1">
          {/* The name and the "…" on one row, centred on each other (the founder, 2026-11-06); the role and the state are tags under it. */}
          <div className="flex items-center justify-between gap-xs">
            <p className="m-0 min-w-0 flex-1 text-card-title">{m.person.name}</p>
            {open && (
              <MoreMenu
                label={`More for ${m.person.name}`}
                title={m.person.name}
                items={[
                  { key: 'role', label: 'Change role', icon: Shuffle, onSelect: () => onRole(m) },
                  ...(m.status === 'invited' ? [{ key: 'resend', label: 'Resend invite', icon: RotateCcw, onSelect: () => resend.mutate(), disabled: resend.isPending }] : []),
                  {
                    key: 'remove',
                    label: m.status === 'invited' ? 'Take back the invite' : 'Remove from the team',
                    icon: UserMinus,
                    destructive: true,
                    onSelect: () => {
                      remove.reset();
                      setAsking(true);
                    },
                    disabled: remove.isPending,
                  },
                ]}
              />
            )}
          </div>
          <p className="m-0 text-card-note text-ink-soft">{[m.person.handle ? `@${m.person.handle}` : '', m.client ? `for ${m.client.name}` : '', since].filter(Boolean).join(', ')}</p>
          <div className="mt-xs flex flex-wrap items-center gap-xs">
            <IconTag tone={ROLE_TONE[m.role]} icon={TEAM_ROLE_META[m.role].icon}>
              {TEAM_ROLE_META[m.role].name}
            </IconTag>
            <StatusTag tone={TEAM_STATUS_TONE[m.status]}>{TEAM_STATUS_NAME[m.status]}</StatusTag>
          </div>
        </div>
      </div>
      {open && (
        <div className="mt-sm">
          <AccessRows
            role={m.role}
            access={access}
            idPrefix={`m-${m.id}`}
            onChange={(next) => {
              setAccess(next);
              save.mutate(next);
            }}
          />
          {save.isError && <ErrorLine e={save.error} className="mt-xs" />}
        </div>
      )}
      <ConfirmDelete
        open={asking}
        title={m.status === 'invited' ? `Take back the invite to ${m.person.name}?` : `Remove ${m.person.name} from the team?`}
        body={m.status === 'invited' ? 'Their invite goes quietly, and they are not told. You can ask them again.' : 'Their access to your Agency ends at once, and they are told. You can ask them again.'}
        yes={m.status === 'invited' ? 'Yes, take it back' : `Yes, remove ${m.person.name}`}
        keep={m.status === 'invited' ? 'Keep the invite' : 'Keep them'}
        pending={remove.isPending}
        failed={remove.isError}
        error={remove.error instanceof Error ? remove.error.message : undefined}
        onYes={() => remove.mutate()}
        onClose={() => setAsking(false)}
      />
    </li>
  );
}

/**
 * The owner's Team tab: the people who work on this Agency and what each can open. The header's one solid button opens the invite
 * (`inviting`); the rest are outline or in More. Removed people wait in a closed "Past members" fold.
 */
export function AgencyTeam({ inviting, onInviting }: { inviting: boolean; onInviting: (open: boolean) => void }) {
  const pg = usePage('tm');
  const q = useAuthed(['agency', 'team', pg.page, pg.size], () => api.agencyTeam(pageQuery(pg.page, pg.size, 'tm')));
  const [role, setRole] = useState<TeamMember | null>(null);
  const [said, setSaid] = useState('');
  const d = q.data;
  const now = d?.members.filter((m) => m.status !== 'removed') ?? [];
  const past = d?.members.filter((m) => m.status === 'removed') ?? [];
  return (
    <Section id="team-heading" title="Team" lede={COPY.lede}>
      {said && (
        <p role="status" className="mb-sm m-0 text-subhead">
          {said}
        </p>
      )}
      {q.isError && (
        <p role="alert" className="m-0 text-subhead">
          {COPY.fail}
        </p>
      )}
      {q.isPending && (
        <Busy label="Loading your team" className="flex flex-col gap-xs">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-[160px] w-full" />
          ))}
        </Busy>
      )}
      {d && now.length === 0 && past.length === 0 && (
        <div className="rounded-card bg-card p-md shadow-toy-soft">
          <p className="m-0 text-callout">{COPY.empty}</p>
        </div>
      )}
      {now.length > 0 && (
        <ul className="flex list-none flex-col gap-sm p-0 m-0">
          {now.map((m) => (
            <MemberRow key={m.id} m={m} onRole={setRole} onSaid={setSaid} />
          ))}
        </ul>
      )}
      {past.length > 0 && (
        <Fold className="mt-sm" title="Past members" hint={String(past.length)}>
          <ul className="flex list-none flex-col gap-sm p-0 m-0">
            {past.map((m) => (
              <MemberRow key={m.id} m={m} onRole={setRole} onSaid={setSaid} />
            ))}
          </ul>
        </Fold>
      )}
      <Pager page={d?.page} prefix="tm" label="members" />
      <InviteSheet open={inviting} onClose={() => onInviting(false)} onSent={setSaid} />
      {role && <RoleSheet key={role.id} m={role} onClose={() => setRole(null)} />}
    </Section>
  );
}

// ---- the client member's own view (read only)

function ViewCard({ children }: { children: React.ReactNode }) {
  return <li className="rounded-tile bg-card p-sm shadow-toy-soft">{children}</li>;
}

/**
 * A client member's page inside the app: the same view the client link builds, cut to their tabs on the server, read only. Approving,
 * sending back and asking for a change stay at the client link.
 */
export function ClientMemberView({ teamId, agencyName }: { teamId: string; agencyName: string }) {
  const q = useAuthed(['myTeams', 'client-view', teamId], () => api.myTeamClientView(teamId));
  if (q.isError)
    return (
      <p role="alert" className="mt-md m-0 rounded-tile bg-card p-sm text-subhead">
        {q.error instanceof Error ? q.error.message : 'Could not load this. Try again in a moment.'}
      </p>
    );
  if (!q.data)
    return (
      <Busy label="Loading your page" className="mt-md flex flex-col gap-sm">
        <Skeleton className="h-[96px] w-full" />
        <Skeleton className="h-[160px] w-full" />
      </Busy>
    );
  const v = q.data.view as PortalView & { show?: PortalView['show'] };
  if (!v.show)
    return <p className="mt-md m-0 rounded-tile bg-card p-sm text-subhead">{`${agencyName} has a short form for you first. Open the link they sent you to fill it in.`}</p>;
  const a = q.data.access;
  const docs = [
    ...v.contracts.map((k) => ({ key: `k-${k.token}`, href: `/k/${k.token}`, title: k.title, tone: CONTRACT_STATUS_TONE[k.status], status: CONTRACT_STATUS_NAME[k.status], line: 'Agreement' })),
    ...v.invoices.map((i) => ({ key: `i-${i.token}`, href: `/i/${i.token}`, title: `Invoice ${i.number}`, tone: i.overdue ? ('bad' as TagTone) : INVOICE_STATUS_TONE[i.status], status: i.overdue ? 'Overdue' : INVOICE_STATUS_NAME[i.status], line: money(i.totalCents, i.currency) })),
    ...v.docs.map((d) => ({ key: `d-${d.token}`, href: `/d/${d.token}`, title: d.title, tone: AGENCY_DOC_STATUS_TONE[d.status], status: AGENCY_DOC_STATUS_NAME[d.status], line: 'Document' })),
  ];
  const pieces = [...v.waiting.map((w) => ({ id: w.id, title: w.title, stage: 'review' as const })), ...v.coming.map((c) => ({ id: c.id, title: c.title, stage: c.stage }))];
  return (
    <>
      {a.overview !== 'off' && (
        <Section id="client-stage-heading" title="Where it stands">
          <div className="rounded-card bg-card p-md shadow-toy-soft">
            <StageBar stage={v.stage} />
          </div>
          {v.waitingOn.length > 0 && (
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0" aria-label="Waiting on you">
              {v.waitingOn.map((w) => (
                <ViewCard key={w.key}>
                  <p className={`m-0 ${w.line ? 'text-card-title' : 'text-headline'}`}>{w.title}</p>
                  {w.line && <p className="m-0 text-card-note text-ink-soft">{w.line}</p>}
                </ViewCard>
              ))}
            </ul>
          )}
          {v.month && <p className="mt-sm m-0 text-subhead text-ink-soft">{v.month.planned > 0 ? `${v.month.published} of ${v.month.planned} live this month.` : `${v.month.published} live this month.`}</p>}
        </Section>
      )}
      {a.pipeline !== 'off' && (
        <Section id="client-pieces-heading" title="Your pieces" lede="To approve or ask for a change, use the link they sent you.">
          {pieces.length === 0 && v.published.length === 0 ? (
            <p className="m-0 rounded-tile bg-card p-sm text-subhead text-ink-soft">Nothing is being made right now.</p>
          ) : (
            <ul className="flex list-none flex-col gap-xs p-0 m-0">
              {pieces.map((p) => (
                <ViewCard key={p.id}>
                  <div className="flex items-start justify-between gap-sm">
                    <p className="m-0 min-w-0 text-headline">{p.title}</p>
                    <StatusTag tone={DELIVERABLE_STAGE_TONE[p.stage]}>{DELIVERABLE_STAGE_META[p.stage].name}</StatusTag>
                  </div>
                </ViewCard>
              ))}
              {v.published.map((p) => (
                <ViewCard key={p.id}>
                  <div className="flex items-start justify-between gap-sm">
                    <p className={`m-0 min-w-0 ${p.publishedAt ? 'text-card-title' : 'text-headline'}`}>{p.title}</p>
                    <StatusTag tone={DELIVERABLE_STAGE_TONE.published}>{DELIVERABLE_STAGE_META.published.name}</StatusTag>
                  </div>
                  {p.publishedAt && <p className="m-0 text-card-note text-ink-soft">{`Live ${prettyDate(p.publishedAt)}`}</p>}
                </ViewCard>
              ))}
            </ul>
          )}
        </Section>
      )}
      {a.paperwork !== 'off' && (
        <Section id="client-paper-heading" title="Your paperwork" lede="Each one opens with the password for your page.">
          {docs.length === 0 ? (
            <p className="m-0 rounded-tile bg-card p-sm text-subhead text-ink-soft">Nothing sent to you yet.</p>
          ) : (
            <ul className="flex list-none flex-col gap-xs p-0 m-0">
              {docs.map((d) => (
                <li key={d.key}>
                  <Link to={d.href} className="toy toy-soft flex min-h-[44px] items-center gap-sm rounded-tile bg-card p-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block text-card-title">{d.title}</span>
                      <span className="block text-card-note text-ink-soft">{d.line}</span>
                    </span>
                    <StatusTag tone={d.tone}>{d.status}</StatusTag>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </>
  );
}
