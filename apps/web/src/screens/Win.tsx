import { bountyPayout, detectPlatform, SOCIAL_PLATFORM_META, type Bounty, type BountySubmission } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed, useRefreshAll } from '../lib/queries';

type Rule = Pick<Bounty, 'ratePerThousand' | 'maxPayoutPoints' | 'minViews'>;

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const n = (v: number) => v.toLocaleString();

function Back({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex min-h-[44px] items-center gap-xs font-bold text-ink-soft">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
      {label}
    </Link>
  );
}

function Err({ e }: { e: unknown }) {
  if (!e) return null;
  return (
    <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
      {e instanceof Error ? e.message : 'That did not work.'}
    </p>
  );
}

const STATUS_TINT: Record<BountySubmission['status'], string> = {
  submitted: 'var(--tint-yellow)',
  verified: 'var(--tint-green)',
  paid: 'var(--tint-green)',
  rejected: 'var(--tint-red)',
  disputed: 'var(--tint-orange)',
};
const STATUS_LABEL: Record<BountySubmission['status'], string> = {
  submitted: 'waiting for review',
  verified: 'verified, payout queued',
  paid: 'paid',
  rejected: 'rejected',
  disputed: 'disputed',
};

function StatusPill({ status }: { status: BountySubmission['status'] }) {
  return (
    <span className="rounded-pill px-xs text-[12px] font-extrabold leading-[20px]" style={{ background: STATUS_TINT[status] }}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function rateLine(b: Rule): string {
  if (b.ratePerThousand <= 0) return 'Fixed reward, set at review';
  return `${n(b.ratePerThousand)} pts per 1k views${b.maxPayoutPoints > 0 ? `, up to ${n(b.maxPayoutPoints)}` : ''}`;
}

function BountyCard({ b }: { b: Bounty }) {
  return (
    <li>
      <Link to={`/win/${b.id}`} className="toy toy-soft flex items-start gap-sm rounded-tile bg-card p-sm">
        <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-[22px]" aria-hidden="true">
          🥇
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-xs">
            <span className="text-[16px] font-bold">{b.title}</span>
            {b.featured && (
              <span className="rounded-pill bg-r3 px-xs text-[12px] font-extrabold leading-[20px] text-ink-fixed">Featured</span>
            )}
            {b.mine && <StatusPill status={b.mine.status} />}
          </span>
          <span className="block text-[14px] font-semibold text-ink-soft">
            {b.brandName}, {b.deliverable}
            {b.platform ? ` on ${b.platform}` : ''}
          </span>
          <span className="block text-[14px] font-semibold text-ink-soft">
            {rateLine(b)}. From {n(b.minViews)} views. Closes {day(b.endsAt)}. {b.submissions} {b.submissions === 1 ? 'entry' : 'entries'}.
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Reviewer and finance controls for one submission. */
function ReviewBox({ s, rule, reviewer, finance, onDone }: { s: BountySubmission; rule: Rule | null; reviewer: boolean; finance: boolean; onDone: () => void }) {
  const [views, setViews] = useState(String(s.evidenceViews ?? s.latestViews));
  const [note, setNote] = useState(s.evidenceNote);
  const suggested = rule ? bountyPayout(Number(views) || 0, rule) : s.estimatedPoints;
  const [payout, setPayout] = useState(String(s.payoutPoints > 0 ? s.payoutPoints : suggested));
  const [touched, setTouched] = useState(false);
  const review = useMutation({ mutationFn: (body: Parameters<typeof api.reviewBounty>[1]) => api.reviewBounty(s.id, body), onSuccess: onDone });
  const live = touched ? payout : String(s.payoutPoints > 0 ? s.payoutPoints : suggested);
  return (
    <div className="mt-sm flex flex-col gap-sm rounded-tile bg-paper p-sm">
      <p className="m-0 text-[14px] font-bold">Review</p>
      {s.metrics.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {s.metrics
            .slice()
            .reverse()
            .slice(0, 6)
            .map((m) => (
              <li key={m.id} className="text-[12px] font-bold text-ink-soft">
                {new Date(m.fetchedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}: {n(m.views)} views, {n(m.likes + m.comments + m.shares)} engagement, {m.source === 'auto' ? 'read from the platform' : m.source === 'staff' ? 'confirmed by staff' : 'reported by the creator'}
                {m.note ? `. ${m.note}` : ''}
              </li>
            ))}
        </ul>
      )}
      {reviewer && s.status !== 'paid' && (
        <>
          <div className="grid grid-cols-2 gap-xs">
            <label className="block">
              <span className="block text-[12px] font-bold">Confirmed views</span>
              <input type="number" min={0} value={views} onChange={(e) => setViews(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="block text-[12px] font-bold">Payout in points</span>
              <input
                type="number"
                min={0}
                value={live}
                onChange={(e) => {
                  setTouched(true);
                  setPayout(e.target.value);
                }}
                className={field}
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-[12px] font-bold">Note to the creator</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className={field} />
          </label>
          <div className="flex flex-wrap gap-xs">
            <Button onClick={() => review.mutate({ status: 'verified', evidenceViews: Number(views) || 0, evidenceNote: note, payoutPoints: Number(live) || 0 })} disabled={review.isPending}>
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
          <label className="block">
            <span className="block text-[12px] font-bold">Pay out</span>
            <input
              type="number"
              min={1}
              value={live}
              onChange={(e) => {
                setTouched(true);
                setPayout(e.target.value);
              }}
              className={field}
            />
          </label>
          <Button
            onClick={() => {
              if (window.confirm(`Pay ${live} points to ${s.userName}?`)) review.mutate({ status: 'paid', payoutPoints: Number(live) || 0 });
            }}
            disabled={review.isPending}
          >
            Pay {live} pts
          </Button>
        </div>
      )}
      <Err e={review.isError ? review.error : null} />
    </div>
  );
}

function SubmissionRow({ s, rule, reviewer, finance, onDone, showPerson }: { s: BountySubmission; rule: Rule | null; reviewer: boolean; finance: boolean; onDone: () => void; showPerson: boolean }) {
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 flex flex-wrap items-center gap-xs text-[16px] font-bold">
        {showPerson ? s.userName : s.bountyTitle}
        <StatusPill status={s.status} />
      </p>
      <p className="m-0 text-[14px] font-semibold text-ink-soft">
        {SOCIAL_PLATFORM_META[s.platform].name}, {n(s.latestViews)} views, {n(s.latestEngagement)} engagement
        {s.evidenceViews !== null ? `, ${n(s.evidenceViews)} confirmed` : ''}
        {s.status === 'paid' ? `, paid ${n(s.payoutPoints)} pts` : s.estimatedPoints > 0 ? `, about ${n(s.estimatedPoints)} pts` : ''}
      </p>
      <a href={s.url} target="_blank" rel="noreferrer" className="mt-xs inline-flex min-h-[44px] items-center text-[14px] font-bold underline underline-offset-4">
        Open the post
      </a>
      {s.evidenceNote && <p className="m-0 text-[14px] font-semibold text-ink-soft">Reviewer: {s.evidenceNote}</p>}
      {s.disputeNote && <p className="m-0 text-[14px] font-semibold text-ink-soft">Dispute: {s.disputeNote}</p>}
      {(reviewer || finance) && <ReviewBox s={s} rule={rule} reviewer={reviewer} finance={finance} onDone={onDone} />}
    </li>
  );
}

export function Win() {
  const q = useAuthed(['win'], api.win);
  const [launching, setLaunching] = useState(false);
  const d = q.data;
  const ruleFor = (bountyId: string): Rule | null => d?.bounties.find((b) => b.id === bountyId) ?? null;
  const staff = Boolean(d && (d.reviewer || d.finance));

  return (
    <Screen>
      <header className="pt-lg">
        <h1 className="text-[30px]">Win</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Content rewards. A brand funds a pool, you post a video about them, verified views turn into points.</p>
        {d && (
          <div className="mt-md rounded-card bg-ink p-md text-on-ink">
            <p className="m-0 text-[14px] font-bold opacity-70">Earned so far</p>
            <p className="m-0 font-display text-[36px] font-extrabold leading-none">
              {n(d.earned)} <span className="text-[18px]">points</span>
            </p>
          </div>
        )}
        {d?.canCreate && (
          <Button className="mt-md" onClick={() => setLaunching(true)}>
            Launch a reward
          </Button>
        )}
      </header>

      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 font-bold">Could not load rewards.</p>
          <Button variant="outline" className="mt-sm" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {d && (
        <>
          <section className="mt-lg" aria-labelledby="open-heading">
            <h2 id="open-heading" className="text-[24px]">
              Open rewards
            </h2>
            {d.bounties.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">No brand has opened a pool yet. Check back soon.</p>}
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.bounties.map((b) => (
                <BountyCard key={b.id} b={b} />
              ))}
            </ul>
          </section>

          {d.mine.length > 0 && (
            <section className="mt-lg" aria-labelledby="mine-heading">
              <h2 id="mine-heading" className="text-[24px]">
                My submissions
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.mine.map((s) => (
                  <li key={s.id}>
                    <Link to={`/win/${s.bountyId}`} className="toy toy-soft block rounded-tile bg-card p-sm">
                      <span className="flex flex-wrap items-center gap-xs text-[16px] font-bold">
                        {s.bountyTitle}
                        <StatusPill status={s.status} />
                      </span>
                      <span className="block text-[14px] font-semibold text-ink-soft">
                        {SOCIAL_PLATFORM_META[s.platform].name}, {n(s.latestViews)} views
                        {s.status === 'paid' ? `, paid ${n(s.payoutPoints)} pts` : `, about ${n(s.estimatedPoints)} pts at the current numbers`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {staff && (
            <section className="mt-lg" aria-labelledby="queue-heading">
              <h2 id="queue-heading" className="text-[24px]">
                Review queue
              </h2>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Reviewers confirm the numbers. Finance pays. Nothing goes out on its own.</p>
              {d.queue.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Nothing waiting.</p>}
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.queue.map((s) => (
                  <SubmissionRow key={s.id} s={s} rule={ruleFor(s.bountyId)} reviewer={d.reviewer} finance={d.finance} onDone={() => q.refetch()} showPerson />
                ))}
              </ul>
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
          <span className="block text-[14px] font-bold">Brand</span>
          <input autoFocus value={brandName} onChange={(e) => setBrandName(e.target.value)} maxLength={80} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Brief</span>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={5000} rows={4} className={field} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Deliverable</span>
            <input value={deliverable} onChange={(e) => setDeliverable(e.target.value)} maxLength={80} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Platform</span>
            <input value={platform} onChange={(e) => setPlatform(e.target.value)} maxLength={60} placeholder="Any" className={field} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Pool in points</span>
            <input type="number" min={0} value={budgetPoints} onChange={(e) => setBudgetPoints(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Points per 1k views</span>
            <input type="number" min={0} value={ratePerThousand} onChange={(e) => setRate(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Cap per creator</span>
            <input type="number" min={0} value={maxPayoutPoints} onChange={(e) => setMax(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Views before paying</span>
            <input type="number" min={0} value={minViews} onChange={(e) => setMinViews(e.target.value)} className={field} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[14px] font-bold">Closes</span>
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={field} />
          <span className="mt-xs block text-[12px] font-bold text-ink-soft">Empty means thirty days from now.</span>
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Who can enter</span>
          <input value={eligibility} onChange={(e) => setEligibility(e.target.value)} maxLength={1000} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Rules and brand do-nots</span>
          <textarea value={rewardRule} onChange={(e) => setRewardRule(e.target.value)} maxLength={1000} rows={3} className={field} />
        </label>
        <Err e={create.isError ? create.error : null} />
        <Button type="submit" size="lg" full disabled={create.isPending || !title.trim()}>
          Open the pool
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
      <p className="m-0 flex flex-wrap items-center gap-xs text-[16px] font-bold">
        Your entry
        <StatusPill status={s.status} />
      </p>
      <a href={s.url} target="_blank" rel="noreferrer" className="mt-xs inline-flex min-h-[44px] items-center text-[14px] font-bold underline underline-offset-4">
        {SOCIAL_PLATFORM_META[s.platform].name} post
      </a>
      <div className="mt-sm grid grid-cols-3 gap-xs">
        {[
          ['views', n(s.latestViews)],
          ['engagement', n(s.latestEngagement)],
          [s.status === 'paid' ? 'paid' : 'estimate', `${n(s.status === 'paid' ? s.payoutPoints : s.estimatedPoints)} pts`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-tile bg-paper p-sm">
            <p className="m-0 font-display text-[20px] font-extrabold leading-none">{value}</p>
            <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{label}</p>
          </div>
        ))}
      </div>
      {s.evidenceViews !== null && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">A reviewer confirmed {n(s.evidenceViews)} views.</p>}
      {s.evidenceNote && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Reviewer: {s.evidenceNote}</p>}
      {why && (
        <p role="status" className="mt-sm m-0 text-[14px] font-bold text-ink-soft">
          {why}
        </p>
      )}
      <Err e={refresh.isError ? refresh.error : report.isError ? report.error : dispute.isError ? dispute.error : null} />
      {s.status !== 'paid' && (
        <div className="mt-sm flex flex-wrap gap-xs">
          {auto && (
            <Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
              Refresh numbers
            </Button>
          )}
          <Button variant={auto ? 'ghost' : 'outline'} onClick={() => setReporting((v) => !v)}>
            Report numbers
          </Button>
        </div>
      )}
      {reporting && (
        <form
          className="mt-sm flex flex-col gap-sm rounded-tile bg-paper p-sm"
          onSubmit={(e) => {
            e.preventDefault();
            report.mutate();
          }}
        >
          <p className="m-0 text-[14px] font-semibold text-ink-soft">Type what the platform shows you. A reviewer confirms the numbers before anything is paid. You can report once every six hours.</p>
          <div className="grid grid-cols-2 gap-xs">
            <label className="block">
              <span className="block text-[12px] font-bold">Views</span>
              <input type="number" min={0} value={views} onChange={(e) => setViews(e.target.value)} required className={field} />
            </label>
            <label className="block">
              <span className="block text-[12px] font-bold">Likes</span>
              <input type="number" min={0} value={likes} onChange={(e) => setLikes(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="block text-[12px] font-bold">Comments</span>
              <input type="number" min={0} value={comments} onChange={(e) => setComments(e.target.value)} className={field} />
            </label>
            <label className="block">
              <span className="block text-[12px] font-bold">Shares</span>
              <input type="number" min={0} value={shares} onChange={(e) => setShares(e.target.value)} className={field} />
            </label>
          </div>
          <label className="block">
            <span className="block text-[12px] font-bold">Note, for example a link to a screenshot</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={field} />
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
            <span className="block text-[14px] font-bold">Disagree? Say why</span>
            <textarea value={disputeNote} onChange={(e) => setDisputeNote(e.target.value)} maxLength={1000} rows={3} className={field} />
          </label>
          <Button variant="outline" type="submit" disabled={dispute.isPending || !disputeNote.trim()}>
            Open a dispute
          </Button>
        </form>
      )}
    </div>
  );
}

export function Reward() {
  const { id = '' } = useParams();
  const q = useAuthed(['bounty', id], () => api.bounty(id));
  const win = useAuthed(['win'], api.win);
  const refreshAll = useRefreshAll();
  const [url, setUrl] = useState('');
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
        <header className="pt-lg">
          <Back to="/win" label="Win" />
          <h1 className="text-[30px]">That reward is gone</h1>
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{q.error instanceof Error ? q.error.message : 'It may have closed.'}</p>
        </header>
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
      <header className="pt-lg">
        <Back to="/win" label="Win" />
        <p className="m-0 text-[14px] font-bold text-ink-soft">
          {b.brandName}
          {b.featured ? ', featured' : ''}
          {!open ? `, ${b.status === 'paid' ? 'pool paid out' : 'closed'}` : `, closes ${day(b.endsAt)}`}
        </p>
        <h1 className="text-[30px]">{b.title}</h1>
      </header>

      <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-label="The brief">
        <div className="grid grid-cols-2 gap-xs">
          {[
            ['deliverable', b.deliverable],
            ['platform', b.platform || 'Any'],
            ['pool', left === null ? 'Open' : `${n(left)} of ${n(b.budgetPoints)} pts left`],
            ['entries', String(b.submissions)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-tile bg-paper p-sm">
              <p className="m-0 text-[16px] font-extrabold leading-tight">{value}</p>
              <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{label}</p>
            </div>
          ))}
        </div>
        {b.brief && <p className="mt-sm m-0 whitespace-pre-wrap text-[16px] font-semibold leading-relaxed">{b.brief}</p>}
        {b.eligibility && (
          <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">
            <span className="font-bold text-ink">Who can enter: </span>
            {b.eligibility}
          </p>
        )}
        {b.rewardRule && (
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
            <span className="font-bold text-ink">Rules: </span>
            {b.rewardRule}
          </p>
        )}
      </section>

      <section className="mt-lg" aria-labelledby="payout-heading">
        <h2 id="payout-heading" className="text-[24px]">
          How payout works
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          {rateLine(b)}. Nothing is paid under {n(b.minViews)} views. A reviewer confirms the numbers, then finance pays from the pool.
        </p>
        {b.ratePerThousand > 0 && (
          <ul className="mt-sm grid list-none grid-cols-3 gap-xs p-0 m-0">
            {[1000, 10000, 100000].map((v) => (
              <li key={v} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 font-display text-[20px] font-extrabold leading-none">{n(bountyPayout(v, b))} pts</p>
                <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">at {n(v)} views</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-lg" aria-labelledby="entry-heading">
        <h2 id="entry-heading" className="text-[24px]">
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
              <span className="block text-[14px] font-bold">{b.mine ? 'Replace the link to your post' : 'The public link to your post'}</span>
              <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder="https://" className={field} />
            </label>
            {platform && (
              <p className="m-0 text-[12px] font-bold text-ink-soft">
                {SOCIAL_PLATFORM_META[platform].name}. {SOCIAL_PLATFORM_META[platform].auto ? 'Views are read automatically.' : 'You report the views; a reviewer confirms them.'}
              </p>
            )}
            <Err e={submit.isError ? submit.error : null} />
            <Button type="submit" full disabled={submit.isPending || !url.trim()}>
              {b.mine ? 'Update my entry' : 'Submit my video'}
            </Button>
          </form>
        )}
        {!open && !b.mine && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Entries are closed.</p>}
      </section>

      {d.board.length > 0 && (
        <section className="mt-lg" aria-labelledby="board-heading">
          <h2 id="board-heading" className="text-[24px]">
            Most watched
          </h2>
          <ol className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.board.map((r, i) => (
              <li key={`${r.name}-${i}`} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <span className="flex size-[32px] shrink-0 items-center justify-center rounded-pill bg-paper font-display text-[14px] font-extrabold" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[16px] font-bold">{r.name}</span>
                <span className="shrink-0 text-[14px] font-extrabold">{n(r.views)} views</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {(reviewer || finance) && d.submissions.length > 0 && (
        <section className="mt-lg" aria-labelledby="all-heading">
          <h2 id="all-heading" className="text-[24px]">
            All entries
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.submissions.map((s) => (
              <SubmissionRow key={s.id} s={s} rule={b} reviewer={reviewer} finance={finance} onDone={reload} showPerson />
            ))}
          </ul>
        </section>
      )}
    </Screen>
  );
}
