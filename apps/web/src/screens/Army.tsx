import { CAMPAIGN_STATUSES, CAMPAIGN_STATUS_META, type Campaign as CampaignT, type CampaignAssignment, type CampaignStatus, type Deliverable, type Organization } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { Toggle } from '../components/Toggle';
import { api } from '../lib/api';
import { useAuthed, useMe } from '../lib/queries';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'no date');
const fmtWhen = (d: string) => new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function Err({ error, fallback = 'That did not work.' }: { error: unknown; fallback?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
      {errText(error, fallback)}
    </p>
  );
}

const STATUS_TINT: Record<CampaignStatus, string> = {
  lead: 'var(--tint-brown)',
  brief: 'var(--tint-orange)',
  scoping: 'var(--tint-orange)',
  shortlist: 'var(--tint-yellow)',
  approved: 'var(--tint-green)',
  production: 'var(--tint-purple)',
  review: 'var(--tint-purple)',
  delivered: 'var(--tint-green)',
  reported: 'var(--tint-green)',
  cancelled: 'var(--tint-red)',
};

function StatusPill({ status }: { status: CampaignStatus }) {
  return (
    <span className="rounded-pill px-xs text-[12px] font-extrabold leading-[20px]" style={{ background: STATUS_TINT[status] }}>
      {CAMPAIGN_STATUS_META[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// /army
// ---------------------------------------------------------------------------

export function Army() {
  const q = useAuthed(['army'], api.army);
  const orgs = useAuthed(['orgs'], () => api.orgs());
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const answer = useMutation({ mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'declined' }) => api.answerAssignment(id, status), onSuccess: () => q.refetch() });
  const d = q.data;
  const myOrgs = orgs.data?.organizations ?? [];
  const offers = (d?.assignments ?? []).filter((a) => a.status === 'offered');

  return (
    <Screen>
      <header className="pt-lg">
        <h1 className="text-[30px]">Army</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Brand campaigns from brief to delivery. Creators see a brief once the team assigns them to it.</p>
      </header>

      {offers.length > 0 && (
        <section className="mt-lg" aria-labelledby="offers-heading">
          <h2 id="offers-heading" className="text-[24px]">
            Offers for you
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {offers.map((a) => (
              <li key={a.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 text-[16px] font-bold">
                  {a.role} on a campaign{a.feeAmount > 0 ? `, ${a.currency} ${a.feeAmount}` : ''}
                </p>
                <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Accepting means you agree to the brief, usage rights and exclusivity terms shown on the campaign.</p>
                <div className="mt-sm flex flex-wrap gap-xs">
                  <Button onClick={() => answer.mutate({ id: a.id, status: 'accepted' })} disabled={answer.isPending}>
                    Accept
                  </Button>
                  <Button variant="outline" onClick={() => answer.mutate({ id: a.id, status: 'declined' })} disabled={answer.isPending}>
                    Decline
                  </Button>
                  <Link to={`/army/${a.campaignId}`} className="toy toy-soft inline-flex min-h-[48px] items-center rounded-pill bg-card px-md font-bold">
                    Read the brief
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-xs">
            <Err error={answer.error} />
          </div>
        </section>
      )}

      <section className="mt-lg" aria-labelledby="campaigns-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="campaigns-heading" className="text-[24px]">
            Campaigns
          </h2>
          {(myOrgs.length > 0 || d?.staff) && <Button onClick={() => setCreatingCampaign(true)}>New campaign</Button>}
        </div>
        {d && d.campaigns.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Nothing here yet. Brands start a campaign; creators appear once the team assigns them.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {d?.campaigns.map((c) => (
            <li key={c.id}>
              <Link to={`/army/${c.id}`} className="toy toy-soft block rounded-tile bg-card p-sm">
                <span className="flex items-start justify-between gap-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-bold">{c.name}</span>
                    <span className="block text-[14px] font-semibold text-ink-soft">{c.organizationName}</span>
                  </span>
                  <StatusPill status={c.status} />
                </span>
                <span className="mt-xs block text-[14px] font-semibold text-ink-soft">
                  {c.deliverableCount} deliverable{c.deliverableCount === 1 ? '' : 's'}, {c.assignmentCount} creator{c.assignmentCount === 1 ? '' : 's'}, due {fmtDate(c.dueDate)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-lg" aria-labelledby="brands-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="brands-heading" className="text-[24px]">
            Brands
          </h2>
          <Button variant="outline" onClick={() => setCreatingOrg(true)}>
            New brand
          </Button>
        </div>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">A brand is a team that runs campaigns. Whoever creates it owns it and can add teammates by email.</p>
        {orgs.data && myOrgs.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">You are not part of a brand yet.</p>}
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
  const add = useMutation({
    mutationFn: () => api.addOrgMember(org.id, email),
    onSuccess: () => {
      setEmail('');
      members.refetch();
    },
  });
  const remove = useMutation({ mutationFn: (userId: string) => api.removeOrgMember(org.id, userId), onSuccess: () => members.refetch() });
  const owner = org.myRole === 'owner';
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="toy toy-flat flex min-h-[44px] w-full items-center justify-between gap-sm rounded-tile text-left">
        <span className="min-w-0">
          <span className="block truncate text-[16px] font-bold">{org.name}</span>
          <span className="block text-[14px] font-semibold text-ink-soft">
            {org.type}, you are {org.myRole ?? 'a guest'}
          </span>
        </span>
        <span className="text-[14px] font-bold text-ink-soft">{open ? 'Hide' : 'People'}</span>
      </button>
      {open && (
        <div className="mt-sm">
          <ul className="flex list-none flex-col gap-xs p-0 m-0">
            {members.data?.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-sm rounded-tile bg-paper p-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-bold">{m.name}</span>
                  <span className="block truncate text-[14px] font-semibold text-ink-soft">
                    {m.role}
                    {m.email ? `, ${m.email}` : ''}
                  </span>
                </span>
                {owner && m.role !== 'owner' && (
                  <Button variant="ghost" onClick={() => remove.mutate(m.userId)} disabled={remove.isPending}>
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {owner && (
            <form
              className="mt-sm flex flex-wrap items-end gap-xs"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) add.mutate();
              }}
            >
              <label className="block min-w-0 flex-1">
                <span className="block text-[14px] font-bold">Add a teammate by email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@brand.com" className={field} />
              </label>
              <Button type="submit" disabled={add.isPending || !email.trim()}>
                Add
              </Button>
            </form>
          )}
          <div className="mt-xs">
            <Err error={add.error ?? remove.error} />
          </div>
        </div>
      )}
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
          <span className="block text-[14px] font-bold">Name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className={field} />
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">What kind of team is it?</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {(['brand', 'agency', 'partner'] as const).map((t) => (
              <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={`min-h-[44px] rounded-pill border-2 px-sm text-[14px] font-bold ${type === t ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                {t}
              </button>
            ))}
          </div>
        </fieldset>
        <Err error={create.error} fallback="Could not create it." />
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
          <span className="block text-[14px] font-bold">Brand</span>
          <select value={orgId} onChange={(e) => setOrganizationId(e.target.value)} className={field}>
            {choices.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Brief</span>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} maxLength={5000} placeholder="What the brand wants made, for whom, and in what tone" className={field} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Budget</span>
            <input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Currency</span>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Start</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Due</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[14px] font-bold">Usage rights</span>
          <textarea value={usage} onChange={(e) => setUsage(e.target.value)} rows={2} maxLength={1000} placeholder="Where and for how long the brand may use the work" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Exclusivity</span>
          <textarea value={exclusivity} onChange={(e) => setExclusivity(e.target.value)} rows={2} maxLength={1000} placeholder="Any period the creator must not work with competitors" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Restrictions</span>
          <textarea value={restrictions} onChange={(e) => setRestrictions(e.target.value)} rows={2} maxLength={1000} placeholder="Things that must not appear" className={field} />
        </label>
        <Err error={create.error} fallback="Could not create it." />
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
  const q = useAuthed(['campaign', id], () => api.campaign(id));
  const d = q.data;
  const c = d?.campaign;
  const who = d?.who;
  const canManage = who === 'staff' || who === 'brand';
  const [addingDeliverable, setAddingDeliverable] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  const setStatus = useMutation({ mutationFn: (status: CampaignStatus) => api.updateCampaign(id, { status }), onSuccess: () => q.refetch() });
  const publish = useMutation({ mutationFn: (on: boolean) => api.setCampaignPublic(id, on), onSuccess: (_r, on) => setIsPublic(on) });
  const answer = useMutation({ mutationFn: ({ aid, status }: { aid: string; status: 'accepted' | 'declined' | 'done' }) => api.answerAssignment(aid, status), onSuccess: () => q.refetch() });

  if (q.isError) {
    return (
      <Screen>
        <header className="pt-lg">
          <BackLink to="/army">Army</BackLink>
        </header>
        <p className="mt-md font-bold">{errText(q.error, 'That campaign is not yours or does not exist.')}</p>
      </Screen>
    );
  }
  if (!c || !d) return null;

  const statusChoices: CampaignStatus[] = who === 'staff' ? [...CAMPAIGN_STATUSES] : who === 'brand' ? (c.status === 'shortlist' ? ['approved', 'cancelled'] : ['cancelled']) : [];
  const myAssignments = d.assignments.filter((a) => a.creatorId === me.data?.user.id);

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/army">Army</BackLink>
        <p className="m-0 text-[14px] font-bold text-ink-soft">
          {c.organizationName}, owned by {c.ownerName}
        </p>
        <h1 className="text-[30px]">{c.name}</h1>
        <div className="mt-xs">
          <StatusPill status={c.status} />
        </div>
      </header>

      <section className="mt-lg" aria-label="Progress">
        <ol className="flex list-none flex-wrap gap-xs p-0 m-0">
          {CAMPAIGN_STATUSES.filter((s) => s !== 'cancelled').map((s, i) => {
            const idx = CAMPAIGN_STATUSES.indexOf(c.status);
            const done = i < idx && c.status !== 'cancelled';
            const current = s === c.status;
            return (
              <li key={s} aria-current={current ? 'step' : undefined} className={`rounded-pill px-xs text-[12px] font-extrabold leading-[24px] ${current ? 'bg-ink text-on-ink' : done ? 'bg-r4 text-on-fill' : 'bg-card text-ink-soft shadow-toy-soft'}`}>
                {CAMPAIGN_STATUS_META[s]}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-lg rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="brief-heading">
        <h2 id="brief-heading" className="text-[24px]">
          Brief
        </h2>
        <p className="mt-xs m-0 whitespace-pre-wrap text-[16px] font-semibold">{c.brief || 'No brief written yet.'}</p>
        <dl className="mt-sm grid grid-cols-2 gap-xs m-0">
          <div>
            <dt className="text-[12px] font-bold text-ink-soft">Start</dt>
            <dd className="m-0 text-[16px] font-bold">{fmtDate(c.startDate)}</dd>
          </div>
          <div>
            <dt className="text-[12px] font-bold text-ink-soft">Due</dt>
            <dd className="m-0 text-[16px] font-bold">{fmtDate(c.dueDate)}</dd>
          </div>
          {who !== 'creator' && (
            <div>
              <dt className="text-[12px] font-bold text-ink-soft">Budget</dt>
              <dd className="m-0 text-[16px] font-bold">
                {c.currency} {c.budgetAmount}
              </dd>
            </div>
          )}
        </dl>
        {(c.usageRights || c.exclusivityTerms || c.brandRestrictions) && (
          <dl className="mt-sm flex flex-col gap-xs m-0">
            {c.usageRights && (
              <div>
                <dt className="text-[12px] font-bold text-ink-soft">Usage rights</dt>
                <dd className="m-0 text-[14px] font-semibold">{c.usageRights}</dd>
              </div>
            )}
            {c.exclusivityTerms && (
              <div>
                <dt className="text-[12px] font-bold text-ink-soft">Exclusivity</dt>
                <dd className="m-0 text-[14px] font-semibold">{c.exclusivityTerms}</dd>
              </div>
            )}
            {c.brandRestrictions && (
              <div>
                <dt className="text-[12px] font-bold text-ink-soft">Restrictions</dt>
                <dd className="m-0 text-[14px] font-semibold">{c.brandRestrictions}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      {canManage && (
        <section className="mt-lg" aria-labelledby="manage-heading">
          <h2 id="manage-heading" className="text-[24px]">
            Move it along
          </h2>
          {statusChoices.length > 0 && (
            <div className="mt-sm flex flex-wrap gap-xs">
              {statusChoices
                .filter((s) => s !== c.status)
                .map((s) => (
                  <Button key={s} variant={s === 'cancelled' ? 'ghost' : 'outline'} onClick={() => setStatus.mutate(s)} disabled={setStatus.isPending}>
                    {CAMPAIGN_STATUS_META[s]}
                  </Button>
                ))}
            </div>
          )}
          {who === 'brand' && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">You can approve the shortlist or cancel. The team moves the other steps.</p>}
          <div className="mt-sm">
            <Err error={setStatus.error} />
          </div>
          <div className="mt-sm">
            <Toggle on={isPublic} onChange={(on) => publish.mutate(on)} label="Show on the public site" hint="Listed under Campaigns so creators can discover it. The brief itself stays private." disabled={publish.isPending} />
            <Err error={publish.error} />
          </div>
        </section>
      )}

      <section className="mt-lg" aria-labelledby="deliverables-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="deliverables-heading" className="text-[24px]">
            Deliverables
          </h2>
          {canManage && <Button onClick={() => setAddingDeliverable(true)}>Add</Button>}
        </div>
        {d.deliverables.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Nothing to make yet.</p>}
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
          <h2 id="creators-heading" className="text-[24px]">
            {who === 'creator' ? 'Your role' : 'Creators'}
          </h2>
          {who === 'staff' && <Button onClick={() => setAssigning(true)}>Assign</Button>}
        </div>
        {d.assignments.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">{who === 'staff' ? 'No one assigned yet.' : 'The team has not assigned anyone yet.'}</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {d.assignments.map((a) => (
            <li key={a.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-[16px] font-bold">
                {a.creatorName}, {a.role}
              </p>
              <p className="m-0 text-[14px] font-semibold text-ink-soft">
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
        <div className="mt-xs">
          <Err error={answer.error} />
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="log-heading">
        <h2 id="log-heading" className="text-[24px]">
          What happened
        </h2>
        {d.events.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Quiet so far.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {d.events.map((e) => (
            <li key={e.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-[14px] font-bold">
                {e.actorName}, {e.eventType}
              </p>
              <p className="m-0 text-[14px] font-semibold text-ink-soft">
                {e.note ? `${e.note}. ` : ''}
                {fmtWhen(e.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </section>

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
  const tint = del.status === 'approved' ? 'var(--tint-green)' : del.status === 'changes' ? 'var(--tint-orange)' : del.status === 'submitted' ? 'var(--tint-yellow)' : 'var(--tint-brown)';
  const statusLabel = { open: 'Waiting for work', submitted: 'Waiting for review', changes: 'Changes requested', approved: 'Approved' }[del.status];
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="m-0 truncate text-[16px] font-bold">{del.title}</p>
          <p className="m-0 text-[14px] font-semibold text-ink-soft">
            {[del.format, del.platform].filter(Boolean).join(', ') || 'any format'}
            {del.dueAt ? `, due ${fmtDate(del.dueAt)}` : ''}
          </p>
        </div>
        <span className="shrink-0 rounded-pill px-xs text-[12px] font-extrabold leading-[20px]" style={{ background: tint }}>
          {statusLabel}
        </span>
      </div>
      {del.finalUrl && (
        <a href={del.finalUrl} target="_blank" rel="noreferrer" className="toy toy-soft mt-sm inline-flex min-h-[44px] items-center rounded-pill bg-paper px-md text-[14px] font-bold">
          Open the approved version
        </a>
      )}
      {del.versions.length > 0 && (
        <ol className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {del.versions.map((v) => (
            <li key={v.id} className="rounded-tile bg-paper p-sm">
              <p className="m-0 text-[14px] font-bold">
                Version {v.versionNumber} by {v.submittedByName}, {v.reviewStatus === 'pending' ? 'waiting' : v.reviewStatus}
              </p>
              <a href={v.url} target="_blank" rel="noreferrer" className="block break-all text-[14px] font-semibold underline underline-offset-4">
                {v.url}
              </a>
              {v.note && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{v.note}</p>}
              {v.feedback.map((f) => (
                <p key={f.id} className="mt-xs m-0 text-[14px] font-semibold">
                  <span className="font-bold">{f.authorName}:</span> {f.comment}
                </p>
              ))}
              {canReview && v.reviewStatus === 'pending' && (
                <div className="mt-sm">
                  <label className="block">
                    <span className="block text-[12px] font-bold">Comment</span>
                    <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={2000} className={field} />
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
            <span className="block text-[12px] font-bold">Link to the work</span>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={field} />
          </label>
          <label className="block">
            <span className="block text-[12px] font-bold">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="What changed, or what to look at" className={field} />
          </label>
          <Button type="submit" variant="outline" disabled={upload.isPending || !url.trim()}>
            Upload a version
          </Button>
        </form>
      )}
      <div className="mt-xs">
        <Err error={upload.error ?? review.error} />
      </div>
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
          <span className="block text-[14px] font-bold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required placeholder="One 60 second video" className={field} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Format</span>
            <input value={format} onChange={(e) => setFormat(e.target.value)} maxLength={60} placeholder="Reel, post, story" className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Platform</span>
            <input value={platform} onChange={(e) => setPlatform(e.target.value)} maxLength={60} placeholder="Instagram" className={field} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[14px] font-bold">Due</span>
          <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={field} />
        </label>
        <Err error={add.error} fallback="Could not add it." />
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
          <span className="block text-[14px] font-bold">Creator</span>
          <input autoFocus value={creator} onChange={(e) => setCreator(e.target.value)} maxLength={120} required placeholder="Email, page name or id" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Role</span>
          <input value={role} onChange={(e) => setRole(e.target.value)} maxLength={60} className={field} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Fee</span>
            <input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Currency</span>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={field} />
          </label>
        </div>
        <p className="m-0 text-[14px] font-semibold text-ink-soft">They get an offer in their inbox and accept the terms before they see anything else.</p>
        <Err error={assign.error} fallback="Could not assign them." />
        <Button type="submit" size="lg" full disabled={assign.isPending || !creator.trim()}>
          Send the offer
        </Button>
      </form>
    </Sheet>
  );
}

export type { CampaignAssignment, CampaignT };
