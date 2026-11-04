import { OPPORTUNITY_TYPES, SKILLS, type Application, type ApplicationStatus, type Opportunity as OpportunityT } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { MediaSection } from '../components/MediaSection';
import { Button } from '../components/Button';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api, errorText } from '../lib/api';
import { todayLocal, shortDate } from '../lib/date';
import { useAuthed, useMe } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { FIELD } from '../lib/ui';
import { Fold } from '../components/Fold';
import { StatusTag } from '../components/StatusTag';
import type { TagTone } from '@kreators/shared';
import { ErrorLine } from '../components/ErrorLine';
import { FactTag, IconTag } from '../components/FactTag';
import { useSeedOnce } from '../lib/useSeed';

const fmtDate = (d: string | null) => (d ? shortDate(d) : null);
const typeName = (t: string) => t.replace('_', ' ');
const locationText = (o: OpportunityT) => (o.locationMode === 'remote' ? 'Remote' : o.locationText || (o.locationMode === 'on_site' ? 'On site' : 'Hybrid'));
const payText = (o: OpportunityT) => {
  if (o.compensationMin === null && o.compensationMax === null) return null;
  if (o.compensationMin !== null && o.compensationMax !== null) return `${o.currency} ${o.compensationMin} to ${o.compensationMax}`;
  return `${o.currency} ${o.compensationMin ?? o.compensationMax}`;
};

const STATUS_TONE: Record<ApplicationStatus, TagTone> = {
  draft: 'neutral',
  submitted: 'warn',
  reviewing: 'warn',
  shortlisted: 'info',
  selected: 'good',
  rejected: 'bad',
  withdrawn: 'neutral',
  completed: 'good',
};


function StatusPill({ status }: { status: ApplicationStatus }) {
  return <StatusTag tone={STATUS_TONE[status]}>{status}</StatusTag>;
}

function Facts({ o }: { o: OpportunityT }) {
  const facts = [typeName(o.opportunityType), locationText(o), payText(o), o.deadline ? `apply by ${fmtDate(o.deadline)}` : null].filter(Boolean);
  return <span className="block text-[14px] font-semibold text-ink-soft">{facts.join(', ')}</span>;
}

function Chips({ items, end = false }: { items: string[]; end?: boolean }) {
  if (items.length === 0) return null;
  return (
    <span className={`mt-xs flex flex-wrap gap-xs ${end ? 'justify-end' : ''}`}>
      {items.map((s) => (
        <FactTag key={s} kind="category">
          {s}
        </FactTag>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// /work
// ---------------------------------------------------------------------------

export function Work() {
  const pg = usePage();
  const dpg = usePage('d');
  const q = useAuthed(['work', pg.query, dpg.query], () => api.work(pg.query, dpg.query));
  const [posting, setPosting] = useState(false);
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: OpportunityT['status'] }) => api.setOpportunity(id, status), onSuccess: () => q.refetch() });
  const d = q.data;

  return (
    <Screen>
      <AppCover back={{ to: '/apps', label: 'Apps' }} title="Work" lede="Opportunities from brands and the team. Apply once, then follow it here." />

      <section className="mt-lg" aria-labelledby="open-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="open-heading" className="text-[24px]">
            Open now
          </h2>
          {d?.canPost && <Button onClick={() => setPosting(true)}>Post one</Button>}
        </div>
        {d && d.opportunities.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Nothing is open right now. Brands post paid work here, and you apply to what fits.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {d?.opportunities.map((o) => (
            <li key={o.id}>
              <Link to={`/work/${o.id}`} className="toy toy-soft block rounded-tile bg-card p-sm">
                <span className="flex items-start justify-between gap-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-bold">{o.title}</span>
                    <span className="block text-[14px] font-semibold text-ink-soft">{o.organizationName}</span>
                  </span>
                  <span className="flex shrink-0 gap-xs">
                    {o.clubOnly && <IconTag tone="deep" icon="Lock">Club only</IconTag>}
                    {o.myApplication && <StatusTag tone="good">Applied</StatusTag>}
                  </span>
                </span>
                <Facts o={o} />
                <Chips items={o.skillsRequired} />
              </Link>
            </li>
          ))}
        </ul>
        <Pager page={d?.page} label="opportunities" />
      </section>

      {d && d.applications.length > 0 && (
        <section className="mt-lg" aria-labelledby="mine-heading">
          <h2 id="mine-heading" className="text-[24px]">
            Your applications
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.applications.map((a) => (
              <li key={a.id}>
                <Link to={`/work/${a.opportunityId}`} className="toy toy-soft flex items-center justify-between gap-sm rounded-tile bg-card p-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-bold">{a.opportunityTitle}</span>
                    <span className="block text-[14px] font-semibold text-ink-soft">Sent {fmtDate(a.submittedAt)}</span>
                  </span>
                  <StatusPill status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d && d.drafts.length > 0 && (
        <section className="mt-lg" aria-labelledby="drafts-heading">
          <h2 id="drafts-heading" className="text-[24px]">
            Your listings
          </h2>
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Drafts and closed listings. Publish one to put it in front of everyone.</p>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.drafts.map((o) => (
              <li key={o.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <Link to={`/work/${o.id}`} className="block min-h-[44px] text-[16px] font-bold underline-offset-4 hover:underline">
                  {o.title}
                </Link>
                <p className="m-0 text-[14px] font-semibold text-ink-soft">
                  {o.status}, {o.applications} application{o.applications === 1 ? '' : 's'}
                  {o.clubOnly ? ', Club only' : ''}
                </p>
                <div className="mt-sm flex gap-xs">
                  {o.status !== 'published' && (
                    <Button onClick={() => setStatus.mutate({ id: o.id, status: 'published' })} disabled={setStatus.isPending}>
                      Publish
                    </Button>
                  )}
                  {o.status !== 'closed' && (
                    <Button variant="outline" onClick={() => setStatus.mutate({ id: o.id, status: 'closed' })} disabled={setStatus.isPending}>
                      Close
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Pager page={d?.draftPage} prefix="d" label="your listings" />
          <div className="mt-xs">
            <ErrorLine e={setStatus.error} />
          </div>
        </section>
      )}

      <PostSheet
        open={posting}
        onClose={() => setPosting(false)}
        onPosted={() => {
          setPosting(false);
          q.refetch();
        }}
      />
    </Screen>
  );
}

function PostSheet({ open, onClose, onPosted }: { open: boolean; onClose: () => void; onPosted: () => void }) {
  const orgs = useAuthed(['orgs'], () => api.orgs(), open);
  const [organizationId, setOrganizationId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<OpportunityT['opportunityType']>('gig');
  const [skills, setSkills] = useState<string[]>([]);
  const [locationMode, setLocationMode] = useState<OpportunityT['locationMode']>('remote');
  // An on-site or hybrid post starts in the poster's own city, from Profile.
  const me = useMe();
  const [locationText, setLocationText] = useState(me.data?.user.city ?? '');
  useSeedOnce(me.data?.user, (u) => setLocationText((t) => t || u.city));
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [deliverables, setDeliverables] = useState('');
  const [deadline, setDeadline] = useState('');
  const [eligibility, setEligibility] = useState('');
  const [clubOnly, setClubOnly] = useState(false);
  const create = useMutation({
    mutationFn: () =>
      api.createOpportunity({
        organizationId: organizationId || null,
        title,
        description,
        opportunityType: type,
        skillsRequired: skills,
        locationMode,
        locationText,
        compensationMin: min ? Number(min) : null,
        compensationMax: max ? Number(max) : null,
        currency,
        deliverables,
        deadline: deadline || null,
        eligibility,
        clubOnly,
      }),
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setSkills([]);
      onPosted();
    },
  });
  const toggleSkill = (s: string) => setSkills((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));
  return (
    <Sheet open={open} onClose={onClose} title="Post an opportunity">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) create.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">From</span>
          <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} className={FIELD}>
            <option value="">The team</option>
            {orgs.data?.organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={5000} className={FIELD} />
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Type</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {OPPORTUNITY_TYPES.map((t) => (
              <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={`min-h-[44px] rounded-pill border-2 px-sm text-[14px] font-bold ${type === t ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                {typeName(t)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Skills</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {SKILLS.map((s) => (
              <button key={s} type="button" aria-pressed={skills.includes(s)} onClick={() => toggleSkill(s)} className={`min-h-[44px] rounded-pill border-2 px-sm text-[14px] font-bold ${skills.includes(s) ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                {s}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Where</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {(['remote', 'on_site', 'hybrid'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={locationMode === m} onClick={() => setLocationMode(m)} className={`min-h-[44px] rounded-pill border-2 px-sm text-[14px] font-bold ${locationMode === m ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                {typeName(m)}
              </button>
            ))}
          </div>
          {locationMode !== 'remote' && <input value={locationText} onChange={(e) => setLocationText(e.target.value)} maxLength={120} placeholder="City" className={FIELD} aria-label="City" />}
        </fieldset>
        <div className="grid grid-cols-3 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Pay from</span>
            <input type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">To</span>
            <input type="number" min={0} value={max} onChange={(e) => setMax(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Currency</span>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={FIELD} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[14px] font-bold">Deliverables</span>
          <textarea value={deliverables} onChange={(e) => setDeliverables(e.target.value)} rows={2} maxLength={2000} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Apply by</span>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Who can apply</span>
          <textarea value={eligibility} onChange={(e) => setEligibility(e.target.value)} rows={2} maxLength={1000} className={FIELD} />
        </label>
        <label className="toy flex min-h-[48px] cursor-pointer items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
          <input type="checkbox" checked={clubOnly} onChange={(e) => setClubOnly(e.target.checked)} className="size-[20px] accent-ink" />
          <span>
            <span className="block text-[16px] font-bold">Club only</span>
            <span className="block text-[14px] font-semibold text-ink-soft">Only Club members see it and can apply. Their first look.</span>
          </span>
        </label>
        <ErrorLine e={create.error} />
        <Button type="submit" size="lg" full disabled={create.isPending || !title.trim()}>
          Save as draft
        </Button>
        <p className="m-0 text-center text-[14px] font-semibold text-ink-soft">Publish it from Your listings when it is ready.</p>
      </form>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// /work/:id
// ---------------------------------------------------------------------------

export function Opportunity() {
  const { id = '' } = useParams();
  const pg = usePage();
  const q = useAuthed(['opportunity', id, pg.query], () => api.opportunity(id, pg.query));
  const [coverNote, setCoverNote] = useState('');
  const [note, setNote] = useState('');
  const apply = useMutation({ mutationFn: () => api.apply(id, coverNote), onSuccess: () => q.refetch() });
  const setApp = useMutation({ mutationFn: ({ aid, status }: { aid: string; status: ApplicationStatus }) => api.setApplication(aid, { status, note }), onSuccess: () => q.refetch() });
  const setStatus = useMutation({ mutationFn: (status: OpportunityT['status']) => api.setOpportunity(id, status), onSuccess: () => q.refetch() });
  const setClubFlag = useMutation({ mutationFn: (clubOnly: boolean) => api.setOpportunity(id, q.data?.opportunity.status ?? 'draft', clubOnly), onSuccess: () => q.refetch() });

  if (q.isError) {
    return (
      <Screen>
        <AppCover back={{ to: '/work', label: 'Work' }} title="Not open, or gone" lede={errorText(q.error, 'That opportunity is not open or does not exist.')} />
      </Screen>
    );
  }
  const d = q.data;
  if (!d) return null;
  const o = d.opportunity;
  const mine = o.myApplication;
  const closed = o.status !== 'published' || (o.deadline !== null && o.deadline < todayLocal());

  return (
    <Screen>
      <AppCover
        back={{ to: '/work', label: 'Work' }}
        eyebrow={`${o.organizationName}, ${typeName(o.opportunityType)}${o.clubOnly ? ', Club only' : ''}`}
        title={o.title}
        lede={
          <>
            <Facts o={o} />
            <Chips items={o.skillsRequired} end />
          </>
        }
      />

      <MediaSection type="opportunity" id={o.id} />

      <section className="mt-lg rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="about-heading">
        <h2 id="about-heading" className="text-[24px]">
          About
        </h2>
        <p className="mt-xs m-0 whitespace-pre-wrap text-[16px] font-semibold">{o.description || 'No description yet.'}</p>
        {o.deliverables && (
          <>
            <h3 className="mt-sm text-[16px]">What you deliver</h3>
            <p className="m-0 whitespace-pre-wrap text-[14px] font-semibold">{o.deliverables}</p>
          </>
        )}
        {o.eligibility && (
          <>
            <h3 className="mt-sm text-[16px]">Who can apply</h3>
            <p className="m-0 whitespace-pre-wrap text-[14px] font-semibold">{o.eligibility}</p>
          </>
        )}
      </section>

      {!d.owner && (
        <section className="mt-lg" aria-labelledby="apply-heading">
          <h2 id="apply-heading" className="text-[24px]">
            {mine ? 'Your application' : 'Apply'}
          </h2>
          {mine ? (
            <div className="mt-sm rounded-tile bg-card p-sm shadow-toy-soft">
              <div className="flex items-center justify-between gap-sm">
                <p className="m-0 text-[16px] font-bold">Sent {fmtDate(mine.submittedAt)}</p>
                <StatusPill status={mine.status} />
              </div>
              {mine.coverNote && <p className="mt-xs m-0 whitespace-pre-wrap text-[14px] font-semibold text-ink-soft">{mine.coverNote}</p>}
              {!['withdrawn', 'rejected', 'completed', 'selected'].includes(mine.status) && (
                <Button variant="ghost" className="mt-sm" onClick={() => setApp.mutate({ aid: mine.id, status: 'withdrawn' })} disabled={setApp.isPending}>
                  Withdraw
                </Button>
              )}
              <ErrorLine e={setApp.error} />
            </div>
          ) : closed ? (
            <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Applications are closed.</p>
          ) : (
            <form
              className="mt-sm flex flex-col gap-md rounded-card bg-card p-md shadow-toy-soft"
              onSubmit={(e) => {
                e.preventDefault();
                apply.mutate();
              }}
            >
              <label className="block">
                <span className="block text-[14px] font-bold">A short note</span>
                <textarea value={coverNote} onChange={(e) => setCoverNote(e.target.value)} rows={4} maxLength={2000} placeholder="Why you, in a few lines" className={FIELD} />
              </label>
              <p className="m-0 text-[14px] font-semibold text-ink-soft">Your public portfolio and skills go with it. One application per person.</p>
              <ErrorLine e={apply.error} />
              <Button type="submit" size="lg" full disabled={apply.isPending}>
                Send application
              </Button>
            </form>
          )}
        </section>
      )}

      {d.owner && (
        <>
          <section className="mt-lg" aria-labelledby="listing-heading">
            <h2 id="listing-heading" className="text-[24px]">
              Your listing
            </h2>
            <div className="mt-sm flex flex-wrap gap-xs">
              {o.status !== 'published' && (
                <Button onClick={() => setStatus.mutate('published')} disabled={setStatus.isPending}>
                  Publish
                </Button>
              )}
              {o.status !== 'closed' && (
                <Button variant="outline" onClick={() => setStatus.mutate('closed')} disabled={setStatus.isPending}>
                  Close
                </Button>
              )}
              {o.status === 'closed' && (
                <Button variant="outline" onClick={() => setStatus.mutate('draft')} disabled={setStatus.isPending}>
                  Back to draft
                </Button>
              )}
            </div>
            <label className="toy mt-sm flex min-h-[48px] cursor-pointer items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
              <input type="checkbox" checked={o.clubOnly} onChange={(e) => setClubFlag.mutate(e.target.checked)} disabled={setClubFlag.isPending} className="size-[20px] accent-ink" />
              <span>
                <span className="block text-[16px] font-bold">Club only</span>
                <span className="block text-[14px] font-semibold text-ink-soft">Only Club members see it and can apply.</span>
              </span>
            </label>
            <ErrorLine e={setStatus.error} />
          </section>
          <section className="mt-lg" aria-labelledby="applicants-heading">
            <h2 id="applicants-heading" className="text-[24px]">
              Applicants, {d.applications.length}
            </h2>
            {d.applications.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">No one has applied yet.</p>}
            <label className="mt-sm block">
              <span className="block text-[14px] font-bold">Note to send with a decision</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional" className={FIELD} />
            </label>
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.applications.map((a) => (
                <li key={a.id}>
                  <ApplicantCard a={a} onDecide={(status) => setApp.mutate({ aid: a.id, status })} busy={setApp.isPending} />
                </li>
              ))}
            </ul>
            <Pager page={d.page} label="applicants" />
            <div className="mt-xs">
              <ErrorLine e={setApp.error} />
            </div>
          </section>
        </>
      )}
    </Screen>
  );
}

function ApplicantCard({ a, onDecide, busy }: { a: Application; onDecide: (status: ApplicationStatus) => void; busy: boolean }) {
  const decisions: ApplicationStatus[] = ['reviewing', 'shortlisted', 'selected', 'rejected'];
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="flex items-center justify-between gap-sm">
        <p className="m-0 text-[16px] font-bold">
          {a.creatorHandle ? (
            <Link to={`/u/${a.creatorHandle}`} className="underline-offset-4 hover:underline">
              {a.creatorName}
            </Link>
          ) : (
            a.creatorName
          )}
        </p>
        <StatusPill status={a.status} />
      </div>
      <p className="m-0 text-[14px] font-semibold text-ink-soft">Applied {fmtDate(a.submittedAt)}</p>
      {a.coverNote && <p className="mt-xs m-0 whitespace-pre-wrap text-[14px] font-semibold">{a.coverNote}</p>}
      {a.portfolioSnapshot && (
        <Fold className="mt-xs" title="Skills and portfolio at the time">
          <p className="m-0 whitespace-pre-wrap break-all text-[14px] font-semibold text-ink-soft">{a.portfolioSnapshot}</p>
        </Fold>
      )}
      {!['withdrawn', 'completed'].includes(a.status) && (
        <div className="mt-sm flex flex-wrap gap-xs">
          {decisions
            .filter((s) => s !== a.status)
            .map((s) => (
              <Button key={s} variant={s === 'selected' ? 'primary' : s === 'rejected' ? 'ghost' : 'outline'} onClick={() => onDecide(s)} disabled={busy}>
                {s}
              </Button>
            ))}
        </div>
      )}
    </div>
  );
}

