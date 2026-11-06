import { bountyPayout, detectPlatform, SOCIAL_PLATFORM_META, type Bounty, type BountySubmission, LOCALE, formatCount } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { MediaSection } from '../components/MediaSection';
import { Button } from '../components/Button';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { ConfirmSpend } from '../components/ConfirmSpend';
import { api } from '../lib/api';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { Icon } from '../components/Icon';
import { Medal } from 'lucide-react';
import { FIELD } from '../lib/ui';
import { ErrorLine } from '../components/ErrorLine';
import { StatusTag } from '../components/StatusTag';
import type { TagTone } from '@kreators/shared';
import { shortDate, localDateTimeValue } from '../lib/date';
import { FactTag, IconTag } from '../components/FactTag';
import { RowCard } from '../components/RowCard';
import { Reveal } from '../components/fx/Reveal';
import { CardHead } from '../components/CardHead';
import { ToggleChevron } from '../components/ToggleMark';

type Rule = Pick<Bounty, 'ratePerThousand' | 'maxPayoutPoints' | 'minViews'>;

const day = shortDate;
const n = (v: number) => formatCount(v);



const STATUS_TONE: Record<BountySubmission['status'], TagTone> = {
  submitted: 'warn',
  verified: 'good',
  paid: 'good',
  rejected: 'bad',
  disputed: 'warn',
};
const STATUS_LABEL: Record<BountySubmission['status'], string> = {
  submitted: 'waiting for review',
  verified: 'verified, payout queued',
  paid: 'paid',
  rejected: 'rejected',
  disputed: 'disputed',
};

function StatusPill({ status }: { status: BountySubmission['status'] }) {
  return <StatusTag tone={STATUS_TONE[status]} fit>{STATUS_LABEL[status]}</StatusTag>;
}

function rateLine(b: Rule): string {
  if (b.ratePerThousand <= 0) return 'Fixed reward, set at review';
  return `${n(b.ratePerThousand)} pts per 1k views${b.maxPayoutPoints > 0 ? `, up to ${n(b.maxPayoutPoints)}` : ''}`;
}

function BountyCard({ b, index = 0 }: { b: Bounty; index?: number }) {
  // The medal and the title at the top left, the person's own state (or Open) in the corner of every card, the numbers as tags at
  // the foot and the arrow at the bottom right.
  return (
    <Reveal as="li" index={index} className="flex">
      <RowCard
        to={`/win/${b.id}`}
        lead={
          <span className="flex size-[44px] items-center justify-center rounded-pill bg-paper" aria-hidden="true">
            <Icon icon={Medal} size={22} />
          </span>
        }
        title={b.title}
        sub={`${b.brandName}, ${b.deliverable}${b.platform ? ` on ${b.platform}` : ''}`}
        corner={
          <>
            {b.featured && <IconTag tone="warn" icon="Star" fit>Featured</IconTag>}
            {b.mine ? <StatusPill status={b.mine.status} /> : <StatusTag tone="neutral">Open</StatusTag>}
          </>
        }
        facts={[
          <FactTag key="rate" kind="price">{rateLine(b)}</FactTag>,
          <FactTag key="from" kind="category">{`From ${n(b.minViews)} views`}</FactTag>,
          <FactTag key="closes" kind="when">{`Closes ${day(b.endsAt)}`}</FactTag>,
          <FactTag key="entries" kind="availability">{`${n(b.submissions)} ${b.submissions === 1 ? 'entry' : 'entries'}`}</FactTag>,
        ]}
      />
    </Reveal>
  );
}

/** Reviewer and finance controls for one submission. */
function ReviewBox({ s, rule, reviewer, finance, onDone }: { s: BountySubmission; rule: Rule | null; reviewer: boolean; finance: boolean; onDone: () => void }) {
  const [views, setViews] = useState(String(s.evidenceViews ?? s.latestViews));
  const [note, setNote] = useState(s.evidenceNote);
  const suggested = rule ? bountyPayout(Number(views) || 0, rule) : s.estimatedPoints;
  const [payout, setPayout] = useState(String(s.payoutPoints > 0 ? s.payoutPoints : suggested));
  const [touched, setTouched] = useState(false);
  const [paying, setPaying] = useState(false);
  const review = useMutation({ mutationFn: (body: Parameters<typeof api.reviewBounty>[1]) => api.reviewBounty(s.id, body), onSuccess: onDone });
  const live = touched ? payout : String(s.payoutPoints > 0 ? s.payoutPoints : suggested);
  return (
    <div className="mt-sm flex flex-col gap-sm rounded-tile bg-paper p-sm">
      <p className="m-0 text-subhead font-semibold">Review</p>
      {s.metrics.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {s.metrics
            .slice()
            .reverse()
            .slice(0, 6)
            .map((m) => (
              <li key={m.id} className="text-caption text-ink-soft">
                {new Date(m.fetchedAt).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}: {n(m.views)} views, {n(m.likes + m.comments + m.shares)} engagement, {m.source === 'auto' ? 'read from the platform' : m.source === 'staff' ? 'confirmed by staff' : 'reported by the creator'}
                {m.note ? `. ${m.note}` : ''}
              </li>
            ))}
        </ul>
      )}
      {reviewer && s.status !== 'paid' && (
        <>
          <div className="grid grid-cols-2 gap-xs">
            <label className="block">
              <span className="block text-caption">Confirmed views</span>
              <input type="number" min={0} value={views} onChange={(e) => setViews(e.target.value)} className={FIELD} />
            </label>
            <label className="block">
              <span className="block text-caption">Payout in points</span>
              <input
                type="number"
                min={0}
                value={live}
                onChange={(e) => {
                  setTouched(true);
                  setPayout(e.target.value);
                }}
                className={FIELD}
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-caption">Note to the creator</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className={FIELD} />
          </label>
          <div className="flex flex-wrap gap-xs">
            <Button variant="outline" onClick={() => review.mutate({ status: 'verified', evidenceViews: Number(views) || 0, evidenceNote: note, payoutPoints: Number(live) || 0 })} disabled={review.isPending}>
              Verify
            </Button>
            <Button variant="outline" onClick={() => review.mutate({ status: 'rejected', evidenceViews: Number(views) || 0, evidenceNote: note })} disabled={review.isPending}>
              Reject
            </Button>
          </div>
        </>
      )}
      {finance && s.status === 'verified' && (
        <div className="flex flex-wrap items-end gap-xs">
          <label className="block min-w-0 flex-1">
            <span className="block text-caption">Pay out</span>
            <input
              type="number"
              min={1}
              value={live}
              onChange={(e) => {
                setTouched(true);
                setPayout(e.target.value);
              }}
              className={FIELD}
            />
          </label>
          <Button variant="outline" onClick={() => setPaying(true)} disabled={review.isPending}>
            Pay {live} pts
          </Button>
          <ConfirmSpend
            open={paying}
            onClose={() => setPaying(false)}
            title={`Pay ${live} points?`}
            body={`${live} points go to ${s.userName} from the reward's pool. This cannot be undone.`}
            action={`Pay ${live} points`}
            busy={review.isPending}
            onConfirm={() => review.mutate({ status: 'paid', payoutPoints: Number(live) || 0 })}
          />
        </div>
      )}
      <ErrorLine e={review.isError ? review.error : null} />
    </div>
  );
}

function SubmissionRow({ s, rule, reviewer, finance, onDone, showPerson }: { s: BountySubmission; rule: Rule | null; reviewer: boolean; finance: boolean; onDone: () => void; showPerson: boolean }) {
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <CardHead tag={<StatusPill status={s.status} />}>
        <p className="m-0 text-card-title">{showPerson ? s.userName : s.bountyTitle}</p>
      </CardHead>
      <p className="m-0 text-card-note text-ink-soft">
        {SOCIAL_PLATFORM_META[s.platform].name}, {n(s.latestViews)} views, {n(s.latestEngagement)} engagement
        {s.evidenceViews !== null ? `, ${n(s.evidenceViews)} confirmed` : ''}
        {s.status === 'paid' ? `, paid ${n(s.payoutPoints)} pts` : s.estimatedPoints > 0 ? `, about ${n(s.estimatedPoints)} pts` : ''}
      </p>
      <a href={s.url} target="_blank" rel="noreferrer" className="mt-xs inline-flex min-h-[44px] items-center text-subhead font-semibold underline underline-offset-4">
        Open the post
      </a>
      {s.evidenceNote && <p className="m-0 text-card-note text-ink-soft">Reviewer: {s.evidenceNote}</p>}
      {s.disputeNote && <p className="m-0 text-card-note text-ink-soft">Dispute: {s.disputeNote}</p>}
      {(reviewer || finance) && <ReviewBox s={s} rule={rule} reviewer={reviewer} finance={finance} onDone={onDone} />}
    </li>
  );
}

export function Win() {
  const pg = usePage();
  const qpg = usePage('q');
  const q = useAuthed(['win', pg.query, qpg.query], () => api.win(pg.query, qpg.query));
  const [launching, setLaunching] = useState(false);
  const d = q.data;
  const ruleFor = (bountyId: string): Rule | null => d?.bounties.find((b) => b.id === bountyId) ?? null;
  const staff = Boolean(d && (d.reviewer || d.finance));

  return (
    <Screen>
      <AppCover
        back={{ to: '/apps', label: 'Apps' }}
        title="Win"
        lede="Content rewards. A brand funds a pool, you post a video about them, verified views turn into points."
        actions={d?.canCreate ? <Button onClick={() => setLaunching(true)}>Launch a reward</Button> : undefined}
      >
        {d && (
          <div className="rounded-card bg-ink p-md text-on-ink">
            <p className="m-0 text-subhead font-semibold opacity-70">Earned so far</p>
            <p className="m-0 text-large-title type-figure leading-none">
              {n(d.earned)} <span className="text-headline">points</span>
            </p>
          </div>
        )}
      </AppCover>

      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft flex flex-wrap-reverse items-center justify-between gap-sm" role="alert">
          <p className="m-0 font-semibold min-w-0 flex-1 basis-[60%]">Could not load rewards.</p>
          <Button variant="outline" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {d && (
        <>
          <section className="mt-lg" aria-labelledby="open-heading">
            <h2 id="open-heading" className="text-title2">
              Open rewards
            </h2>
            {d.bounties.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">No reward is open yet. A brand funds a pool of points, then you post and submit your link.</p>}
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.bounties.map((b, i) => (
                <BountyCard key={b.id} b={b} index={i} />
              ))}
            </ul>
            <Pager page={d.page} label="rewards" />
          </section>

          {d.mine.length > 0 && (
            <section className="mt-lg" aria-labelledby="mine-heading">
              <h2 id="mine-heading" className="text-title2">
                My submissions
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.mine.map((s, i) => (
                  <Reveal as="li" key={s.id} index={i} className="flex">
                    <RowCard
                      to={`/win/${s.bountyId}`}
                      title={s.bountyTitle}
                      corner={<StatusPill status={s.status} />}
                      facts={[
                        <FactTag key="where" kind="category">{SOCIAL_PLATFORM_META[s.platform].name}</FactTag>,
                        <FactTag key="views" kind="availability">{`${n(s.latestViews)} views`}</FactTag>,
                        <FactTag key="pts" kind="price">{s.status === 'paid' ? `Paid ${n(s.payoutPoints)} pts` : `About ${n(s.estimatedPoints)} pts`}</FactTag>,
                      ]}
                    />
                  </Reveal>
                ))}
              </ul>
            </section>
          )}

          {staff && (
            <section className="mt-lg" aria-labelledby="queue-heading">
              <h2 id="queue-heading" className="text-title2">
                Review queue
              </h2>
              <p className="mt-xs m-0 text-subhead text-ink-soft">Reviewers confirm the numbers. Finance pays. Nothing goes out on its own.</p>
              {d.queue.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">Nothing waiting.</p>}
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.queue.map((s) => (
                  <SubmissionRow key={s.id} s={s} rule={ruleFor(s.bountyId)} reviewer={d.reviewer} finance={d.finance} onDone={() => q.refetch()} showPerson />
                ))}
              </ul>
              <Pager page={d.queuePage} prefix="q" label="the review queue" />
            </section>
          )}
        </>
      )}

      <LaunchSheet open={launching} onClose={() => setLaunching(false)} />
    </Screen>
  );
}

function LaunchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const refresh = useRefreshAll();
  const [brandName, setBrandName] = useState('');
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [deliverable, setDeliverable] = useState('Short video');
  const [platform, setPlatform] = useState('Instagram');
  const [budgetPoints, setBudgetPoints] = useState('10000');
  const [ratePerThousand, setRate] = useState('50');
  const [maxPayoutPoints, setMax] = useState('2000');
  const [minViews, setMinViews] = useState('1000');
  const [endsAt, setEndsAt] = useState('');
  const [eligibility, setEligibility] = useState('');
  const [rewardRule, setRewardRule] = useState('');
  const create = useMutation({
    mutationFn: () =>
      api.createBounty({
        brandName,
        title,
        brief,
        deliverable,
        platform,
        budgetPoints: Number(budgetPoints) || 0,
        ratePerThousand: Number(ratePerThousand) || 0,
        maxPayoutPoints: Number(maxPayoutPoints) || 0,
        minViews: Number(minViews) || 0,
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
        eligibility,
        rewardRule,
      }),
    onSuccess: (r) => {
      refresh();
      onClose();
      nav(`/win/${r.id}`);
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Launch a content reward">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) create.mutate();
        }}
      >
        <label className="block">
          <span className="block text-subhead font-semibold">Brand</span>
          <input autoFocus value={brandName} onChange={(e) => setBrandName(e.target.value)} maxLength={80} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Brief</span>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={5000} rows={4} className={FIELD} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">Deliverable</span>
            <input value={deliverable} onChange={(e) => setDeliverable(e.target.value)} maxLength={80} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Platform</span>
            <input value={platform} onChange={(e) => setPlatform(e.target.value)} maxLength={60} placeholder="Any" className={FIELD} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">Pool in points</span>
            <input type="number" min={0} value={budgetPoints} onChange={(e) => setBudgetPoints(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Points per 1k views</span>
            <input type="number" min={0} value={ratePerThousand} onChange={(e) => setRate(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Cap per creator</span>
            <input type="number" min={0} value={maxPayoutPoints} onChange={(e) => setMax(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Views before paying</span>
            <input type="number" min={0} value={minViews} onChange={(e) => setMinViews(e.target.value)} className={FIELD} />
          </label>
        </div>
        <label className="block">
          <span className="block text-subhead font-semibold">Closes</span>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={FIELD} />
          <span className="mt-xs block text-caption text-ink-soft">Empty means thirty days from now.</span>
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Who can enter</span>
          <input value={eligibility} onChange={(e) => setEligibility(e.target.value)} maxLength={1000} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Rules and brand do-nots</span>
          <textarea value={rewardRule} onChange={(e) => setRewardRule(e.target.value)} maxLength={1000} rows={3} className={FIELD} />
        </label>
        <ErrorLine e={create.isError ? create.error : null} />
        <Button type="submit" size="lg" full disabled={create.isPending || !title.trim()}>
          Open the pool
        </Button>
      </form>
    </Sheet>
  );
}

/** Change a reward after launch. Every save bumps the version and tells everyone who already entered. */
function EditSheet({ b, open, onClose, onSaved }: { b: Bounty; open: boolean; onClose: () => void; onSaved: () => void }) {
  const local = (iso: string) => localDateTimeValue(new Date(iso));
  const [brandName, setBrandName] = useState(b.brandName);
  const [title, setTitle] = useState(b.title);
  const [brief, setBrief] = useState(b.brief);
  const [deliverable, setDeliverable] = useState(b.deliverable);
  const [platform, setPlatform] = useState(b.platform);
  const [budgetPoints, setBudgetPoints] = useState(String(b.budgetPoints));
  const [ratePerThousand, setRate] = useState(String(b.ratePerThousand));
  const [maxPayoutPoints, setMax] = useState(String(b.maxPayoutPoints));
  const [minViews, setMinViews] = useState(String(b.minViews));
  const [endsAt, setEndsAt] = useState(local(b.endsAt));
  const [eligibility, setEligibility] = useState(b.eligibility);
  const [rewardRule, setRewardRule] = useState(b.rewardRule);
  const [status, setStatus] = useState<'open' | 'closed'>(b.status === 'open' ? 'open' : 'closed');
  const save = useMutation({
    mutationFn: () =>
      api.editBounty(b.id, {
        brandName,
        title,
        brief,
        deliverable,
        platform,
        budgetPoints: Number(budgetPoints) || 0,
        ratePerThousand: Number(ratePerThousand) || 0,
        maxPayoutPoints: Number(maxPayoutPoints) || 0,
        minViews: Number(minViews) || 0,
        endsAt: endsAt ? new Date(endsAt).toISOString() : b.endsAt,
        eligibility,
        rewardRule,
        status,
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title={`Change this reward (version ${b.version})`}>
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) save.mutate();
        }}
      >
        <p className="m-0 text-subhead text-ink-soft">
          Saving bumps the version and sends a note to the {b.submissions} {b.submissions === 1 ? 'person' : 'people'} who entered. The pool cannot drop under what was paid.
        </p>
        <label className="block">
          <span className="block text-subhead font-semibold">Brand</span>
          <input value={brandName} onChange={(e) => setBrandName(e.target.value)} maxLength={80} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Brief</span>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={5000} rows={4} className={FIELD} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">Deliverable</span>
            <input value={deliverable} onChange={(e) => setDeliverable(e.target.value)} maxLength={80} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Platform</span>
            <input value={platform} onChange={(e) => setPlatform(e.target.value)} maxLength={60} placeholder="Any" className={FIELD} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">Pool in points</span>
            <input type="number" min={0} value={budgetPoints} onChange={(e) => setBudgetPoints(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Points per 1k views</span>
            <input type="number" min={0} value={ratePerThousand} onChange={(e) => setRate(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Cap per creator</span>
            <input type="number" min={0} value={maxPayoutPoints} onChange={(e) => setMax(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Views before paying</span>
            <input type="number" min={0} value={minViews} onChange={(e) => setMinViews(e.target.value)} className={FIELD} />
          </label>
        </div>
        <label className="block">
          <span className="block text-subhead font-semibold">Closes</span>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Who can enter</span>
          <input value={eligibility} onChange={(e) => setEligibility(e.target.value)} maxLength={1000} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Rules and brand do-nots</span>
          <textarea value={rewardRule} onChange={(e) => setRewardRule(e.target.value)} maxLength={1000} rows={3} className={FIELD} />
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead font-semibold">Status</legend>
          {/* Two equal choices across the full width in equal parts (as PeriodFilter). */}
          <div className="mt-xs grid grid-cols-2 gap-xs">
            {(['open', 'closed'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={status === v} onClick={() => setStatus(v)} className={`min-h-[44px] min-w-0 rounded-pill border-2 px-sm text-subhead font-medium ${status === v ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                {v}
              </button>
            ))}
          </div>
        </fieldset>
        <ErrorLine e={save.isError ? save.error : null} />
        <Button type="submit" size="lg" full disabled={save.isPending || !title.trim()}>
          Save as version {b.version + 1}
        </Button>
      </form>
    </Sheet>
  );
}

function MySubmission({ s, onDone }: { s: BountySubmission; onDone: () => void }) {
  const [reporting, setReporting] = useState(false);
  const [views, setViews] = useState(String(s.latestViews));
  const [likes, setLikes] = useState('');
  const [comments, setComments] = useState('');
  const [shares, setShares] = useState('');
  const [note, setNote] = useState('');
  const [disputeNote, setDisputeNote] = useState('');
  const [why, setWhy] = useState<string | null>(null);
  const refresh = useMutation({
    mutationFn: () => api.reportMetrics(s.id),
    onSuccess: (r) => {
      setWhy(r.why);
      onDone();
    },
  });
  const report = useMutation({
    mutationFn: () => api.reportMetrics(s.id, { views: Number(views) || 0, likes: Number(likes) || 0, comments: Number(comments) || 0, shares: Number(shares) || 0, note }),
    onSuccess: (r) => {
      setWhy(r.why);
      setReporting(false);
      onDone();
    },
  });
  const dispute = useMutation({ mutationFn: () => api.disputeBounty(s.id, disputeNote), onSuccess: onDone });
  const auto = SOCIAL_PLATFORM_META[s.platform].auto;
  return (
    <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
      <CardHead tag={<StatusPill status={s.status} />}>
        <p className="m-0 text-headline">Your entry</p>
      </CardHead>
      <a href={s.url} target="_blank" rel="noreferrer" className="mt-xs inline-flex min-h-[44px] items-center text-subhead font-semibold underline underline-offset-4">
        {SOCIAL_PLATFORM_META[s.platform].name} post
      </a>
      <div className="mt-sm grid grid-cols-3 gap-xs">
        {[
          ['views', n(s.latestViews)],
          ['engagement', n(s.latestEngagement)],
          [s.status === 'paid' ? 'paid' : 'estimate', `${n(s.status === 'paid' ? s.payoutPoints : s.estimatedPoints)} pts`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-tile bg-paper p-sm">
            <p className="m-0 text-title3 type-figure leading-none">{value}</p>
            <p className="mt-xs m-0 text-caption text-ink-soft">{label}</p>
          </div>
        ))}
      </div>
      {s.evidenceViews !== null && <p className="mt-sm m-0 text-subhead text-ink-soft">A reviewer confirmed {n(s.evidenceViews)} views.</p>}
      {s.evidenceNote && <p className="mt-xs m-0 text-subhead text-ink-soft">Reviewer: {s.evidenceNote}</p>}
      {why && (
        <p role="status" className="mt-sm m-0 text-subhead text-ink-soft">
          {why}
        </p>
      )}
      <ErrorLine e={refresh.isError ? refresh.error : report.isError ? report.error : dispute.isError ? dispute.error : null} />
      {s.status !== 'paid' && (
        <div className="mt-sm flex flex-wrap gap-xs">
          {auto && (
            <Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
              Refresh numbers
            </Button>
          )}
          <Button variant={auto ? 'ghost' : 'outline'} onClick={() => setReporting((v) => !v)} aria-expanded={reporting} aria-controls="win-report-numbers">
            Report numbers
            <ToggleChevron open={reporting} />
          </Button>
        </div>
      )}
      {reporting && (
        <form
          id="win-report-numbers"
          className="mt-sm flex flex-col gap-sm rounded-tile bg-paper p-sm"
          onSubmit={(e) => {
            e.preventDefault();
            report.mutate();
          }}
        >
          <p className="m-0 text-subhead text-ink-soft">Type what the platform shows. A reviewer checks it before anything pays, and you can report every six hours.</p>
          <div className="grid grid-cols-2 gap-xs">
            <label className="block">
              <span className="block text-caption">Views</span>
              <input type="number" min={0} value={views} onChange={(e) => setViews(e.target.value)} required className={FIELD} />
            </label>
            <label className="block">
              <span className="block text-caption">Likes</span>
              <input type="number" min={0} value={likes} onChange={(e) => setLikes(e.target.value)} className={FIELD} />
            </label>
            <label className="block">
              <span className="block text-caption">Comments</span>
              <input type="number" min={0} value={comments} onChange={(e) => setComments(e.target.value)} className={FIELD} />
            </label>
            <label className="block">
              <span className="block text-caption">Shares</span>
              <input type="number" min={0} value={shares} onChange={(e) => setShares(e.target.value)} className={FIELD} />
            </label>
          </div>
          <label className="block">
            <span className="block text-caption">Note, for example a link to a screenshot</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={FIELD} />
          </label>
          <Button type="submit" disabled={report.isPending}>
            Send numbers
          </Button>
        </form>
      )}
      {s.status === 'rejected' && (
        <form
          className="mt-sm flex flex-col gap-sm rounded-tile bg-paper p-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (disputeNote.trim()) dispute.mutate();
          }}
        >
          <label className="block">
            <span className="block text-subhead font-semibold">Disagree? Say why</span>
            <textarea value={disputeNote} onChange={(e) => setDisputeNote(e.target.value)} maxLength={1000} rows={3} className={FIELD} />
          </label>
          <Button variant="outline" type="submit" disabled={dispute.isPending || !disputeNote.trim()}>
            Open a dispute
          </Button>
        </form>
      )}
    </div>
  );
}

/** A live answer to "what could I earn?": type a view count (or tap one) and see the payout, with where it starts and where it stops growing. */
function EarnCalc({ b }: { b: Rule }) {
  const [views, setViews] = useState('10000');
  const v = Math.max(0, Math.floor(Number(views) || 0));
  const pay = bountyPayout(v, b);
  const capViews = b.maxPayoutPoints > 0 && b.ratePerThousand > 0 ? Math.ceil(b.maxPayoutPoints / b.ratePerThousand) * 1000 : null;
  return (
    <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft" role="group" aria-label="What could I earn?">
      <p className="m-0 text-subhead font-semibold">What could I earn?</p>
      <div className="mt-xs flex flex-wrap items-end gap-xs">
      <label className="block min-w-[200px] flex-1">
        <span className="block text-caption text-ink-soft">If my post gets this many views</span>
        <input type="number" min={0} inputMode="numeric" value={views} onChange={(e) => setViews(e.target.value)} className={FIELD} />
      </label>
      {/* Two by two on a phone, so the fourth count is never alone on its line; one row from `sm` up. */}
      <div className="grid w-full grid-cols-2 gap-xs sm:ml-auto sm:flex sm:w-auto sm:flex-wrap sm:justify-end" role="group" aria-label="Quick view counts">
        {[1000, 10000, 100000, 1000000].map((x) => (
          <button key={x} type="button" aria-pressed={v === x} onClick={() => setViews(String(x))} className={`toy min-h-[44px] rounded-pill border-2 px-sm text-subhead font-medium ${v === x ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
            {n(x)}
          </button>
        ))}
      </div>
      </div>
      <p className="mt-sm m-0 text-large-title type-figure leading-none" aria-live="polite">
        {n(pay)} pts
      </p>
      <p className="mt-xs m-0 text-subhead text-ink-soft">
        {v < b.minViews ? `Nothing is paid under ${n(b.minViews)} views. You need ${n(b.minViews - v)} more.` : capViews !== null && v >= capViews ? 'You have reached the most one post can earn here.' : 'Paid for each full 1,000 views, once a reviewer confirms the numbers.'}
      </p>
      <p className="mt-xs m-0 text-caption text-ink-soft">
        Starts at {n(b.minViews)} views{capViews !== null ? `. Stops growing at ${n(capViews)} views (${n(b.maxPayoutPoints)} pts).` : '. There is no cap per post.'} The pool must still have points left.
      </p>
    </div>
  );
}

export function Reward() {
  const { id = '' } = useParams();
  const pg = usePage();
  const q = useAuthed(['bounty', id, pg.query], () => api.bounty(id, pg.query));
  const win = useAuthed(['win'], api.win);
  const refreshAll = useRefreshAll();
  const [url, setUrl] = useState('');
  const [editing, setEditing] = useState(false);
  const submit = useMutation({
    mutationFn: () => api.submitBounty(id, url),
    onSuccess: () => {
      setUrl('');
      refreshAll();
      q.refetch();
    },
  });
  const reload = () => {
    q.refetch();
    win.refetch();
  };

  if (q.isError) {
    return (
      <Screen>
        <AppCover back={{ to: '/win', label: 'Win' }} title="That reward is gone" lede={q.error instanceof Error ? q.error.message : 'It may have closed.'} />
      </Screen>
    );
  }
  const d = q.data;
  if (!d) return null;
  const b = d.bounty;
  const open = b.status === 'open' && new Date(b.endsAt).getTime() > Date.now();
  const platform = url ? detectPlatform(url) : null;
  const reviewer = win.data?.reviewer ?? false;
  const finance = win.data?.finance ?? false;
  const left = b.budgetPoints > 0 ? Math.max(0, b.budgetPoints - b.paidPoints) : null;

  return (
    <Screen>
      <AppCover
        back={{ to: '/win', label: 'Win' }}
        title={b.title}
        lede={`${b.brandName}${b.featured ? ', featured' : ''}${!open ? `, ${b.status === 'paid' ? 'pool paid out' : 'closed'}` : `, closes ${day(b.endsAt)}`}${b.version > 1 ? `, version ${b.version}` : ''}`}
        actions={
          (reviewer || win.data?.canCreate) && b.status !== 'paid' ? (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Change this reward
            </Button>
          ) : undefined
        }
      />

      <MediaSection type="reward" id={b.id} />

      <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-label="The brief">
        <div className="grid grid-cols-2 gap-xs">
          {[
            ['deliverable', b.deliverable],
            ['platform', b.platform || 'Any'],
            ['pool', left === null ? 'Open' : `${n(left)} of ${n(b.budgetPoints)} pts left`],
            ['entries', String(b.submissions)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-tile bg-paper p-sm">
              <p className="m-0 text-headline">{value}</p>
              <p className="mt-xs m-0 text-caption text-ink-soft">{label}</p>
            </div>
          ))}
        </div>
        {b.brief && <p className="mt-sm m-0 whitespace-pre-wrap text-prose">{b.brief}</p>}
        {b.eligibility && (
          <p className="mt-sm m-0 text-subhead text-ink-soft">
            <span className="font-semibold text-ink">Who can enter: </span>
            {b.eligibility}
          </p>
        )}
        {b.rewardRule && (
          <p className="mt-xs m-0 text-subhead text-ink-soft">
            <span className="font-semibold text-ink">Rules: </span>
            {b.rewardRule}
          </p>
        )}
      </section>

      <section className="mt-lg" aria-labelledby="payout-heading">
        <h2 id="payout-heading" className="text-title2">
          How payout works
        </h2>
        <p className="mt-xs m-0 text-subhead text-ink-soft">
          {rateLine(b)}. Nothing is paid under {n(b.minViews)} views. A reviewer confirms the numbers, then finance pays from the pool.
        </p>
        {b.ratePerThousand > 0 && <EarnCalc b={b} />}
      </section>

      <section className="mt-lg" aria-labelledby="entry-heading">
        <h2 id="entry-heading" className="text-title2">
          {b.mine ? 'Your entry' : 'Enter'}
        </h2>
        {b.mine && <MySubmission s={b.mine} onDone={reload} />}
        {open && (
          <form
            className="mt-sm flex flex-col gap-sm rounded-card bg-card p-md shadow-toy-soft"
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) submit.mutate();
            }}
          >
            <label className="block">
              <span className="block text-subhead">{b.mine ? 'Replace the link to your post' : 'The public link to your post'}</span>
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder="https://" className={FIELD} />
            </label>
            {platform && (
              <p className="m-0 text-caption text-ink-soft">
                {SOCIAL_PLATFORM_META[platform].name}. {SOCIAL_PLATFORM_META[platform].auto ? 'Views are read automatically.' : 'You report the views; a reviewer confirms them.'}
              </p>
            )}
            <ErrorLine e={submit.isError ? submit.error : null} />
            <Button type="submit" full disabled={submit.isPending || !url.trim()}>
              {b.mine ? 'Update my entry' : 'Submit my video'}
            </Button>
          </form>
        )}
        {!open && !b.mine && <p className="mt-xs m-0 text-subhead text-ink-soft">Entries are closed.</p>}
      </section>

      {d.board.length > 0 && (
        <section className="mt-lg" aria-labelledby="board-heading">
          <h2 id="board-heading" className="text-title2">
            Most watched
          </h2>
          <ol className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.board.map((r, i) => (
              <li key={`${r.name}-${i}`} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <span className="flex size-[32px] shrink-0 items-center justify-center rounded-pill bg-paper text-subhead font-medium" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 text-balance text-headline [overflow-wrap:anywhere]">{r.name}</span>
                <span className="shrink-0 text-subhead font-semibold">{n(r.views)} views</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {editing && (
        <EditSheet
          b={b}
          open={editing}
          onClose={() => setEditing(false)}
          onSaved={() => {
            refreshAll();
            reload();
          }}
        />
      )}

      {(reviewer || finance) && d.submissions.length > 0 && (
        <section className="mt-lg" aria-labelledby="all-heading">
          <h2 id="all-heading" className="text-title2">
            All entries
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.submissions.map((s) => (
              <SubmissionRow key={s.id} s={s} rule={b} reviewer={reviewer} finance={finance} onDone={reload} showPerson />
            ))}
          </ul>
          <Pager page={d.page} label="entries" />
        </section>
      )}
    </Screen>
  );
}
