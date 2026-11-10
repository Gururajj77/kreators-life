import { CAMPAIGN_STATUSES, CAMPAIGN_STATUS_META, type Campaign as CampaignT, type CampaignAssignment, type CampaignStatus, type Deliverable, type Organization } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../components/Button';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { FactTag } from '../components/FactTag';
import { RowCard } from '../components/RowCard';
import { Reveal } from '../components/fx/Reveal';
import { Sheet } from '../components/Sheet';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { Toggle } from '../components/Toggle';
import { api, errorText } from '../lib/api';
import { useAuthed, useMe } from '../lib/queries';
import { Pager, TEN_A_PAGE, usePage } from '../components/Pager';
import { MediaSection } from '../components/MediaSection';
import { FIELD } from '../lib/ui';
import { StatusTag } from '../components/StatusTag';
import type { TagTone } from '@kreators/shared';
import { shortDate, dateTime } from '../lib/date';
import { ErrorLine } from '../components/ErrorLine';
import { ToggleChevron } from '../components/ToggleMark';

const fmtDate = (d: string | null) => (d ? shortDate(d) : 'no date');
const fmtWhen = dateTime;


const STATUS_TONE: Record<CampaignStatus, TagTone> = {
  lead: 'neutral',
  brief: 'warn',
  scoping: 'warn',
  shortlist: 'warn',
  approved: 'good',
  production: 'info',
  review: 'info',
  delivered: 'good',
  reported: 'good',
  cancelled: 'bad',
};

function StatusPill({ status }: { status: CampaignStatus }) {
  return <StatusTag tone={STATUS_TONE[status]}>{CAMPAIGN_STATUS_META[status]}</StatusTag>;
}

// ---------------------------------------------------------------------------
// /army
// ---------------------------------------------------------------------------

export function Army() {
  const pg = usePage();
  const q = useAuthed(['army', pg.query], () => api.army(pg.query));
  const orgs = useAuthed(['orgs'], () => api.orgs());
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const answer = useMutation({ mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'declined' }) => api.answerAssignment(id, status), onSuccess: () => q.refetch() });
  const d = q.data;
  const myOrgs = orgs.data?.organizations ?? [];
  const offers = (d?.assignments ?? []).filter((a) => a.status === 'offered');

  return (
    <Screen>
      <AppCover back={{ to: '/apps', label: 'Apps' }} title="Army" lede="Brand campaigns from brief to delivery. Creators see a brief once the team assigns them to it." />

      {offers.length > 0 && (
        <section className="mt-lg" aria-labelledby="offers-heading">
          <h2 id="offers-heading" className="text-title2">
            Offers for you
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {offers.map((a) => (
              <li key={a.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 text-card-title">
                  {a.role} on a campaign{a.feeAmount > 0 ? `, ${a.currency} ${a.feeAmount}` : ''}
                </p>
                <p className="mt-xs m-0 text-card-note text-ink-soft">Accepting means you agree to the brief, usage rights and exclusivity terms shown on the campaign.</p>
                <div className="mt-sm flex flex-wrap gap-xs">
                  <Button onClick={() => answer.mutate({ id: a.id, status: 'accepted' })} disabled={answer.isPending}>
                    Accept
                  </Button>
                  <Button variant="outline" onClick={() => answer.mutate({ id: a.id, status: 'declined' })} disabled={answer.isPending}>
                    Decline
                  </Button>
                  <Link to={`/army/${a.campaignId}`} className="toy toy-soft inline-flex min-h-[40px] md:min-h-[48px] tap-pad items-center rounded-pill bg-card px-md font-semibold">
                    Read the brief
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          <ErrorLine e={answer.error} className="mt-xs" />
        </section>
      )}

      <section className="mt-lg" aria-labelledby="campaigns-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="campaigns-heading" className="text-title2">
            Campaigns
          </h2>
          {(myOrgs.length > 0 || d?.staff) && <Button onClick={() => setCreatingCampaign(true)}>New campaign</Button>}
        </div>
        {d && d.campaigns.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">Nothing here yet. Brands start a campaign; creators appear once the team assigns them.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {d?.campaigns.map((c, i) => (
            <Reveal as="li" key={c.id} index={i} className="flex">
              {/* The name and brand at the top left, the stage in the corner, the counts and the due day as tags at the foot, the arrow at the bottom right. */}
              <RowCard
                to={`/army/${c.id}`}
                title={c.name}
                sub={c.organizationName}
                corner={<StatusPill status={c.status} />}
                facts={[
                  <FactTag key="del" kind="category">{`${c.deliverableCount} deliverable${c.deliverableCount === 1 ? '' : 's'}`}</FactTag>,
                  <FactTag key="cr" kind="availability">{`${c.assignmentCount} creator${c.assignmentCount === 1 ? '' : 's'}`}</FactTag>,
                  <FactTag key="due" kind="when">{c.dueDate ? `Due ${fmtDate(c.dueDate)}` : 'No due day'}</FactTag>,
                ]}
              />
            </Reveal>
          ))}
        </ul>
        <Pager page={d?.page} label="campaigns" />
      </section>

      <section className="mt-lg" aria-labelledby="brands-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="brands-heading" className="text-title2">
            Brands
          </h2>
          <Button variant="outline" onClick={() => setCreatingOrg(true)}>
            New brand
          </Button>
        </div>
        <p className="mt-xs m-0 text-subhead text-ink-soft">A brand is a team that runs campaigns. Whoever creates it owns it and can ask teammates by email.</p>
        {orgs.data && myOrgs.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">You are not part of a brand yet.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {myOrgs.map((o) => (
            <li key={o.id}>
              <OrgCard org={o} />
            </li>
          ))}
        </ul>
      </section>

      <NewOrgSheet
        open={creatingOrg}
        onClose={() => setCreatingOrg(false)}
        onCreated={() => {
          setCreatingOrg(false);
          orgs.refetch();
        }}
      />
      <NewCampaignSheet
        open={creatingCampaign}
        orgs={myOrgs}
        staff={Boolean(d?.staff)}
        onClose={() => setCreatingCampaign(false)}
        onCreated={() => {
          setCreatingCampaign(false);
          q.refetch();
        }}
      />
    </Screen>
  );
}

function OrgCard({ org }: { org: Organization }) {
  const [open, setOpen] = useState(false);
  const members = useAuthed(['org-members', org.id], () => api.orgMembers(org.id), open);
  const [email, setEmail] = useState('');
  // An ask, not an add (2026-11-10): they join only with their own yes on their Profile tab.
  const [asked, setAsked] = useState('');
  // A double tap or two Enters before Ask shows it is busy asks once (the second would answer "asked already").
  const asking = useRef(false);
  const add = useMutation({
    mutationFn: () => api.addOrgMember(org.id, email),
    onSuccess: () => {
      setAsked(`Asked ${email.trim()}. They join when they say yes.`);
      setEmail('');
      members.refetch();
    },
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api.removeOrgMember(org.id, userId),
    onSuccess: () => {
      setRemoving(null);
      members.refetch();
    },
  });
  // Removing a teammate, or taking back an ask, asks first, with the person it is about.
  const [removing, setRemoving] = useState<{ userId: string; name: string; invited: boolean } | null>(null);
  const owner = org.myRole === 'owner';
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <button type="button" aria-expanded={open} aria-controls={`org-people-${org.id}`} onClick={() => setOpen((v) => !v)} className="toy toy-flat flex min-h-[44px] w-full items-center justify-between gap-sm rounded-tile text-left">
        <span className="min-w-0">
          <span className="block text-balance text-card-title [overflow-wrap:anywhere]">{org.name}</span>
          <span className="block text-card-note text-ink-soft">
            {org.type}, you are {org.myRole ?? 'a guest'}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-xs text-subhead text-ink-soft">
          {open ? 'Hide' : 'People'}
          <ToggleChevron open={open} />
        </span>
      </button>
      {open && (
        <div id={`org-people-${org.id}`} className="mt-sm">
          <ul className="flex list-none flex-col gap-xs p-0 m-0">
            {members.data?.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-sm rounded-tile bg-paper p-sm">
                <span className="min-w-0 flex-1">
                  <span className="block text-balance text-card-title [overflow-wrap:anywhere]">{m.name}</span>
                  <span className="block text-card-note text-ink-soft [overflow-wrap:anywhere]">
                    {m.role}
                    {m.email ? `, ${m.email}` : ''}
                  </span>
                </span>
                {owner && m.role !== 'owner' && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      remove.reset();
                      setRemoving({ userId: m.userId, name: m.name, invited: false });
                    }}
                    disabled={remove.isPending}
                    aria-label={`Remove ${m.name}`}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {/* Asks still waiting: listed apart, never as members, each with a way to take it back. */}
          {(members.data?.invited?.length ?? 0) > 0 && (
            <>
              <p className="mt-sm m-0 text-subhead font-semibold">Asked, waiting for a yes</p>
              <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                {members.data?.invited?.map((m) => (
                  <li key={m.userId} className="flex items-center gap-sm rounded-tile bg-paper p-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block text-balance text-card-title [overflow-wrap:anywhere]">{m.name}</span>
                      <span className="block text-card-note text-ink-soft [overflow-wrap:anywhere]">{m.email ? `Asked, ${m.email}` : 'Asked'}</span>
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        remove.reset();
                        setRemoving({ userId: m.userId, name: m.name, invited: true });
                      }}
                      disabled={remove.isPending}
                      aria-label={`Take back the ask to ${m.name}`}
                    >
                      Withdraw
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {owner && (
            <form
              className="mt-sm flex flex-wrap items-end gap-xs"
              onSubmit={(e) => {
                e.preventDefault();
                if (!email.trim() || asking.current) return;
                asking.current = true;
                add.mutate(undefined, { onSettled: () => void (asking.current = false) });
              }}
            >
              <label className="block min-w-0 flex-1">
                <span className="block text-subhead font-semibold">Ask a teammate by email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@brand.com" className={FIELD} />
              </label>
              <Button type="submit" disabled={add.isPending || !email.trim()}>
                Ask
              </Button>
            </form>
          )}
          <ErrorLine e={add.error} className="mt-xs" />
          {asked && !add.error && (
            <p role="status" className="mt-xs m-0 text-subhead">
              {asked}
            </p>
          )}
        </div>
      )}
      <ConfirmDelete
        open={removing !== null}
        title={removing?.invited ? 'Take back this ask?' : 'Remove this teammate?'}
        body={removing?.invited ? `${removing.name} is not asked to join ${org.name} any more. They are not told.` : `${removing?.name ?? ''} leaves ${org.name} and loses access to its campaigns. You can ask them again by email.`}
        pending={remove.isPending}
        failed={remove.isError}
        onYes={() => removing && remove.mutate(removing.userId)}
        onClose={() => setRemoving(null)}
        yes={removing?.invited ? 'Yes, take it back' : 'Yes, remove them'}
      />
    </div>
  );
}

function NewOrgSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<Organization['type']>('brand');
  const create = useMutation({
    mutationFn: () => api.createOrg({ name, type }),
    onSuccess: () => {
      setName('');
      onCreated();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="New brand">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <label className="block">
          <span className="block text-subhead font-semibold">Name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className={FIELD} />
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead">What kind of team is it?</legend>
          {/* Three short equal choices across the full width in equal parts (as PeriodFilter). */}
          <div className="mt-xs grid grid-cols-3 gap-xs">
            {(['brand', 'agency', 'partner'] as const).map((t) => (
              <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={`min-h-[36px] md:min-h-[44px] tap-pad min-w-0 rounded-pill border-2 px-sm text-subhead font-medium ${type === t ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                {t}
              </button>
            ))}
          </div>
        </fieldset>
        <ErrorLine e={create.error} />
        <Button type="submit" size="lg" full disabled={create.isPending || !name.trim()}>
          Create brand
        </Button>
      </form>
    </Sheet>
  );
}

function NewCampaignSheet({ open, orgs, staff, onClose, onCreated }: { open: boolean; orgs: Organization[]; staff: boolean; onClose: () => void; onCreated: () => void }) {
  const allOrgs = useAuthed(['orgs-all'], () => api.orgs(true), staff && open);
  const choices = staff && allOrgs.data ? allOrgs.data.organizations : orgs;
  const [organizationId, setOrganizationId] = useState('');
  const [name, setName] = useState('');
  const [brief, setBrief] = useState('');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [usage, setUsage] = useState('');
  const [exclusivity, setExclusivity] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const orgId = organizationId || choices[0]?.id || '';
  const create = useMutation({
    mutationFn: () =>
      api.createCampaign({
        organizationId: orgId,
        name,
        brief,
        budgetAmount: Number(budget) || 0,
        currency,
        startDate: startDate || null,
        dueDate: dueDate || null,
        usageRights: usage,
        exclusivityTerms: exclusivity,
        brandRestrictions: restrictions,
      }),
    onSuccess: () => {
      setName('');
      setBrief('');
      onCreated();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="New campaign">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && orgId) create.mutate();
        }}
      >
        <label className="block">
          <span className="block text-subhead font-semibold">Brand</span>
          <select value={orgId} onChange={(e) => setOrganizationId(e.target.value)} className={FIELD}>
            {choices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Brief</span>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} maxLength={5000} placeholder="What the brand wants made, for whom, and in what tone" className={FIELD} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">Budget</span>
            <input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Currency</span>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Start</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Due</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={FIELD} />
          </label>
        </div>
        <label className="block">
          <span className="block text-subhead font-semibold">Usage rights</span>
          <textarea value={usage} onChange={(e) => setUsage(e.target.value)} rows={2} maxLength={1000} placeholder="Where and for how long the brand may use the work" className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Exclusivity</span>
          <textarea value={exclusivity} onChange={(e) => setExclusivity(e.target.value)} rows={2} maxLength={1000} placeholder="Any period the creator must not work with competitors" className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Restrictions</span>
          <textarea value={restrictions} onChange={(e) => setRestrictions(e.target.value)} rows={2} maxLength={1000} placeholder="Things that must not appear" className={FIELD} />
        </label>
        <ErrorLine e={create.error} />
        <Button type="submit" size="lg" full disabled={create.isPending || !name.trim() || !orgId}>
          {staff ? 'Create brief' : 'Send to the team'}
        </Button>
      </form>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// /army/:id
// ---------------------------------------------------------------------------

export function Campaign() {
  const { id = '' } = useParams();
  const me = useMe();
  // What happened is a page at a time (prefix `ev`, ten by default).
  const evp = usePage('ev', TEN_A_PAGE);
  const q = useAuthed(['campaign', id, evp.query], () => api.campaign(id, evp.query));
  const d = q.data;
  const c = d?.campaign;
  const who = d?.who;
  const canManage = who === 'staff' || who === 'brand';
  const [addingDeliverable, setAddingDeliverable] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  const setStatus = useMutation({ mutationFn: (status: CampaignStatus) => api.updateCampaign(id, { status }), onSuccess: () => q.refetch() });
  // Cancelling the campaign asks first; the other steps move in one tap.
  const [cancelling, setCancelling] = useState(false);
  const publish = useMutation({ mutationFn: (on: boolean) => api.setCampaignPublic(id, on), onSuccess: (_r, on) => setIsPublic(on) });
  const answer = useMutation({ mutationFn: ({ aid, status }: { aid: string; status: 'accepted' | 'declined' | 'done' }) => api.answerAssignment(aid, status), onSuccess: () => q.refetch() });

  if (q.isError) {
    return (
      <Screen>
        <AppCover back={{ to: '/army', label: 'Army' }} title="Not yours, or gone" lede={errorText(q.error, 'That campaign is not yours or does not exist.')} />
      </Screen>
    );
  }
  if (!c || !d) return null;

  const statusChoices: CampaignStatus[] = who === 'staff' ? [...CAMPAIGN_STATUSES] : who === 'brand' ? (c.status === 'shortlist' ? ['approved', 'cancelled'] : ['cancelled']) : [];
  const myAssignments = d.assignments.filter((a) => a.creatorId === me.data?.user.id);

  return (
    <Screen>
      {/* Who it is for sits under the title, not above it: above, it lay on the clapperboard's lines (4.35:1 in light mode on a laptop). */}
      <AppCover
        back={{ to: '/army', label: 'Army' }}
        title={c.name}
        lede={
          <span className="inline-flex flex-wrap items-center justify-end gap-x-sm gap-y-xs">
            <span>
              {c.organizationName}, owned by {c.ownerName}
            </span>
            <StatusPill status={c.status} />
          </span>
        }
      />

      <section className="mt-lg" aria-label="Progress">
        <ol className="fill-row flex list-none flex-wrap gap-xs p-0 m-0">
          {CAMPAIGN_STATUSES.filter((s) => s !== 'cancelled').map((s, i) => {
            const idx = CAMPAIGN_STATUSES.indexOf(c.status);
            const done = i < idx && c.status !== 'cancelled';
            const current = s === c.status;
            return (
              <li key={s} aria-current={current ? 'step' : undefined} className={`rounded-pill px-xs text-center text-caption font-medium leading-[24px] ${current ? 'bg-ink text-on-ink' : done ? 'bg-r4 text-on-fill' : 'bg-card text-ink-soft shadow-toy-soft'}`}>
                {CAMPAIGN_STATUS_META[s]}
              </li>
            );
          })}
        </ol>
      </section>

      <MediaSection type="campaign" id={c.id} />

      <section className="mt-lg rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="brief-heading">
        <h2 id="brief-heading" className="text-title2">
          Brief
        </h2>
        <p className="mt-xs m-0 whitespace-pre-wrap text-prose">{c.brief || 'No brief written yet.'}</p>
        <dl className="mt-sm grid grid-cols-2 gap-xs m-0">
          <div>
            <dt className="text-caption text-ink-soft">Start</dt>
            <dd className="m-0 text-headline">{fmtDate(c.startDate)}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-soft">Due</dt>
            <dd className="m-0 text-headline">{fmtDate(c.dueDate)}</dd>
          </div>
          {who !== 'creator' && (
            <div>
              <dt className="text-caption text-ink-soft">Budget</dt>
              <dd className="m-0 text-headline">
                {c.currency} {c.budgetAmount}
              </dd>
            </div>
          )}
        </dl>
        {(c.usageRights || c.exclusivityTerms || c.brandRestrictions) && (
          <dl className="mt-sm flex flex-col gap-xs m-0">
            {c.usageRights && (
              <div>
                <dt className="text-caption text-ink-soft">Usage rights</dt>
                <dd className="m-0 text-subhead">{c.usageRights}</dd>
              </div>
            )}
            {c.exclusivityTerms && (
              <div>
                <dt className="text-caption text-ink-soft">Exclusivity</dt>
                <dd className="m-0 text-subhead">{c.exclusivityTerms}</dd>
              </div>
            )}
            {c.brandRestrictions && (
              <div>
                <dt className="text-caption text-ink-soft">Restrictions</dt>
                <dd className="m-0 text-subhead">{c.brandRestrictions}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      {canManage && (
        <section className="mt-lg" aria-labelledby="manage-heading">
          <h2 id="manage-heading" className="text-title2">
            Move it along
          </h2>
          {statusChoices.length > 0 && (
            <div className="mt-sm flex flex-wrap gap-xs">
              {statusChoices
                .filter((s) => s !== c.status)
                .map((s) => (
                  <Button
                    key={s}
                    variant={s === 'cancelled' ? 'ghost' : 'outline'}
                    onClick={() => {
                      if (s !== 'cancelled') return setStatus.mutate(s);
                      setStatus.reset();
                      setCancelling(true);
                    }}
                    disabled={setStatus.isPending}
                  >
                    {CAMPAIGN_STATUS_META[s]}
                  </Button>
                ))}
            </div>
          )}
          {who === 'brand' && <p className="mt-xs m-0 text-subhead text-ink-soft">You can approve the shortlist or cancel. The team moves the other steps.</p>}
          <ErrorLine e={setStatus.error} className="mt-sm" />
          <div className="mt-sm">
            <Toggle on={isPublic} onChange={(on) => publish.mutate(on)} label="Show on the public site" hint="Listed under Campaigns so creators can discover it. The brief itself stays private." disabled={publish.isPending} />
            <ErrorLine e={publish.error} />
          </div>
        </section>
      )}

      <section className="mt-lg" aria-labelledby="deliverables-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="deliverables-heading" className="text-title2">
            Deliverables
          </h2>
          {canManage && <Button onClick={() => setAddingDeliverable(true)}>Add</Button>}
        </div>
        {d.deliverables.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">Nothing to make yet.</p>}
        <ul className="mt-sm flex list-none flex-col gap-sm p-0 m-0">
          {d.deliverables.map((del) => (
            <li key={del.id}>
              <DeliverableCard deliverable={del} who={who ?? 'creator'} onChange={() => q.refetch()} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-lg" aria-labelledby="creators-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="creators-heading" className="text-title2">
            {who === 'creator' ? 'Your role' : 'Creators'}
          </h2>
          {who === 'staff' && <Button variant="outline" onClick={() => setAssigning(true)}>Assign</Button>}
        </div>
        {d.assignments.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">{who === 'staff' ? 'No one assigned yet.' : 'The team has not assigned anyone yet.'}</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {d.assignments.map((a) => (
            <li key={a.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-card-title">
                {a.creatorName}, {a.role}
              </p>
              <p className="m-0 text-card-note text-ink-soft">
                {a.status}
                {a.feeAmount > 0 && who !== 'brand' ? `, ${a.currency} ${a.feeAmount}` : ''}
                {a.termsAcceptedAt ? `, terms accepted ${fmtDate(a.termsAcceptedAt)}` : ''}
              </p>
              {a.status === 'offered' && myAssignments.some((m) => m.id === a.id) && (
                <div className="mt-sm flex gap-xs">
                  <Button onClick={() => answer.mutate({ aid: a.id, status: 'accepted' })} disabled={answer.isPending}>
                    Accept
                  </Button>
                  <Button variant="outline" onClick={() => answer.mutate({ aid: a.id, status: 'declined' })} disabled={answer.isPending}>
                    Decline
                  </Button>
                </div>
              )}
              {who === 'staff' && a.status === 'accepted' && (
                <Button variant="outline" className="mt-sm" onClick={() => answer.mutate({ aid: a.id, status: 'done' })} disabled={answer.isPending}>
                  Mark done
                </Button>
              )}
            </li>
          ))}
        </ul>
        <ErrorLine e={answer.error} className="mt-xs" />
      </section>

      <section className="mt-lg" aria-labelledby="log-heading">
        <h2 id="log-heading" className="text-title2">
          What happened
        </h2>
        {d.events.length === 0 && d.eventsPage.page === 1 && <p className="mt-sm m-0 text-subhead text-ink-soft">Quiet so far.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {d.events.map((e) => (
            <li key={e.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-card-title">
                {e.actorName}, {e.eventType}
              </p>
              <p className="m-0 text-card-note text-ink-soft">
                {e.note ? `${e.note}. ` : ''}
                {fmtWhen(e.createdAt)}
              </p>
            </li>
          ))}
        </ul>
        <Pager page={d.eventsPage} prefix="ev" label="what happened" only={TEN_A_PAGE} />
      </section>

      <ConfirmDelete
        open={cancelling}
        title="Cancel this campaign?"
        body={`"${c.name}". The brand's team is told it is off.${who === 'staff' ? '' : ' Only the team can move it on again.'}`}
        pending={setStatus.isPending}
        failed={setStatus.isError}
        onYes={() => setStatus.mutate('cancelled', { onSuccess: () => setCancelling(false) })}
        onClose={() => setCancelling(false)}
        yes="Yes, cancel it"
        keep="Keep the campaign"
      />
      <AddDeliverableSheet
        campaignId={id}
        open={addingDeliverable}
        onClose={() => setAddingDeliverable(false)}
        onAdded={() => {
          setAddingDeliverable(false);
          q.refetch();
        }}
      />
      <AssignSheet
        campaignId={id}
        open={assigning}
        onClose={() => setAssigning(false)}
        onAssigned={() => {
          setAssigning(false);
          q.refetch();
        }}
      />
    </Screen>
  );
}

function DeliverableCard({ deliverable: del, who, onChange }: { deliverable: Deliverable; who: 'staff' | 'brand' | 'creator'; onChange: () => void }) {
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [comment, setComment] = useState('');
  const upload = useMutation({
    mutationFn: () => api.uploadVersion(del.id, { url, note }),
    onSuccess: () => {
      setUrl('');
      setNote('');
      onChange();
    },
  });
  const review = useMutation({
    mutationFn: ({ versionId, status }: { versionId: string; status: 'approved' | 'changes' }) => api.reviewVersion(versionId, { status, comment }),
    onSuccess: () => {
      setComment('');
      onChange();
    },
  });
  const canUpload = (who === 'creator' || who === 'staff') && del.status !== 'approved';
  const canReview = who === 'brand' || who === 'staff';
  const tone: TagTone = del.status === 'approved' ? 'good' : del.status === 'changes' ? 'warm' : del.status === 'submitted' ? 'warn' : 'neutral';
  const statusLabel = { open: 'Waiting for work', submitted: 'Waiting for review', changes: 'Changes requested', approved: 'Approved' }[del.status];
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="m-0 text-balance text-card-title [overflow-wrap:anywhere]">{del.title}</p>
          <p className="m-0 text-card-note text-ink-soft">
            {[del.format, del.platform].filter(Boolean).join(', ') || 'any format'}
            {del.dueAt ? `, due ${fmtDate(del.dueAt)}` : ''}
          </p>
        </div>
        <StatusTag tone={tone}>
          {statusLabel}
        </StatusTag>
      </div>
      {del.finalUrl && (
        <a href={del.finalUrl} target="_blank" rel="noreferrer" className="toy toy-soft mt-sm inline-flex min-h-[36px] md:min-h-[44px] tap-pad items-center rounded-pill bg-paper px-md text-subhead font-semibold">
          Open the approved version
        </a>
      )}
      {del.versions.length > 0 && (
        <ol className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {del.versions.map((v) => (
            <li key={v.id} className="rounded-tile bg-paper p-sm">
              <p className="m-0 text-subhead font-semibold">
                Version {v.versionNumber} by {v.submittedByName}, {v.reviewStatus === 'pending' ? 'waiting' : v.reviewStatus}
              </p>
              <a href={v.url} target="_blank" rel="noreferrer" className="block break-all text-subhead underline underline-offset-4">
                {v.url}
              </a>
              {v.note && <p className="mt-xs m-0 text-subhead text-ink-soft">{v.note}</p>}
              {v.feedback.map((f) => (
                <p key={f.id} className="mt-xs m-0 text-subhead">
                  <span className="font-semibold">{f.authorName}:</span> {f.comment}
                </p>
              ))}
              {canReview && v.reviewStatus === 'pending' && (
                <div className="mt-sm">
                  <label className="block">
                    <span className="block text-caption">Comment</span>
                    <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={2000} className={FIELD} />
                  </label>
                  <div className="mt-xs flex gap-xs">
                    <Button onClick={() => review.mutate({ versionId: v.id, status: 'approved' })} disabled={review.isPending}>
                      Approve
                    </Button>
                    <Button variant="outline" onClick={() => review.mutate({ versionId: v.id, status: 'changes' })} disabled={review.isPending}>
                      Request changes
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {canUpload && (
        <form
          className="mt-sm flex flex-col gap-xs"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) upload.mutate();
          }}
        >
          <label className="block">
            <span className="block text-caption">Link to the work</span>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-caption">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="What changed, or what to look at" className={FIELD} />
          </label>
          <Button type="submit" variant="outline" disabled={upload.isPending || !url.trim()}>
            Upload a version
          </Button>
        </form>
      )}
      <ErrorLine e={upload.error ?? review.error} className="mt-xs" />
    </div>
  );
}

function AddDeliverableSheet({ campaignId, open, onClose, onAdded }: { campaignId: string; open: boolean; onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState('');
  const [platform, setPlatform] = useState('');
  const [dueAt, setDueAt] = useState('');
  const add = useMutation({
    mutationFn: () => api.addDeliverable(campaignId, { title, format, platform, dueAt: dueAt ? new Date(dueAt).toISOString() : undefined }),
    onSuccess: () => {
      setTitle('');
      onAdded();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Add a deliverable">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) add.mutate();
        }}
      >
        <label className="block">
          <span className="block text-subhead font-semibold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required placeholder="One 60 second video" className={FIELD} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">Format</span>
            <input value={format} onChange={(e) => setFormat(e.target.value)} maxLength={60} placeholder="Reel, post, story" className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Platform</span>
            <input value={platform} onChange={(e) => setPlatform(e.target.value)} maxLength={60} placeholder="Instagram" className={FIELD} />
          </label>
        </div>
        <label className="block">
          <span className="block text-subhead font-semibold">Due</span>
          <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={FIELD} />
        </label>
        <ErrorLine e={add.error} />
        <Button type="submit" size="lg" full disabled={add.isPending || !title.trim()}>
          Add
        </Button>
      </form>
    </Sheet>
  );
}

function AssignSheet({ campaignId, open, onClose, onAssigned }: { campaignId: string; open: boolean; onClose: () => void; onAssigned: () => void }) {
  const [creator, setCreator] = useState('');
  const [role, setRole] = useState('creator');
  const [fee, setFee] = useState('');
  const [currency, setCurrency] = useState('INR');
  const assign = useMutation({
    mutationFn: () => api.assignCreator(campaignId, { creator, role, feeAmount: Number(fee) || 0, currency }),
    onSuccess: () => {
      setCreator('');
      setFee('');
      onAssigned();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Assign a creator">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (creator.trim()) assign.mutate();
        }}
      >
        <label className="block">
          <span className="block text-subhead font-semibold">Creator</span>
          <input autoFocus value={creator} onChange={(e) => setCreator(e.target.value)} maxLength={120} required placeholder="Email, page name or id" className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Role</span>
          <input value={role} onChange={(e) => setRole(e.target.value)} maxLength={60} className={FIELD} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">Fee</span>
            <input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Currency</span>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={FIELD} />
          </label>
        </div>
        <p className="m-0 text-subhead text-ink-soft">They get an offer in their inbox and accept the terms before they see anything else.</p>
        <ErrorLine e={assign.error} />
        <Button type="submit" size="lg" full disabled={assign.isPending || !creator.trim()}>
          Send the offer
        </Button>
      </form>
    </Sheet>
  );
}

export type { CampaignAssignment, CampaignT };
