import { CLUB_BENEFITS, type Membership, type Page } from '@kreators/shared';
import { longDate } from '../lib/date';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../components/Button';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { FIELD } from '../lib/ui';
import { ErrorLine } from '../components/ErrorLine';
import { CardHead } from '../components/CardHead';



const STATUS_COPY: Record<Membership['status'], { title: string; blurb: string; tint: string }> = {
  applied: { title: 'Application in review', blurb: 'A reviewer reads every application. You will hear back in your Inbox.', tint: 'var(--tint-yellow)' },
  approved: { title: 'You are in the Club', blurb: 'Club events and first-look opportunities are open to you.', tint: 'var(--tint-green)' },
  active: { title: 'You are in the Club', blurb: 'Club events and first-look opportunities are open to you.', tint: 'var(--tint-green)' },
  rejected: { title: 'Not this time', blurb: 'You can apply again when your work has moved on.', tint: 'var(--tint-red)' },
  suspended: { title: 'Membership paused', blurb: 'A reviewer paused your membership. Write to the team under Help if that is a surprise.', tint: 'var(--tint-red)' },
  expired: { title: 'Membership ended', blurb: 'Apply again to come back.', tint: 'var(--tint-brown)' },
};

export function Club() {
  const pg = usePage();
  const q = useAuthed(['club', pg.query], () => api.club(pg.query));
  const refresh = useRefreshAll();
  const [note, setNote] = useState('');
  const apply = useMutation({
    mutationFn: () => api.applyClub(note),
    onSuccess: () => {
      setNote('');
      refresh();
      q.refetch();
    },
  });
  const d = q.data;
  const mine = d?.mine ?? null;
  const canApply = !mine || mine.status === 'rejected' || mine.status === 'expired';

  return (
    <Screen>
      <AppCover
        back={{ to: '/apps', label: 'Apps' }}
        title="Club"
        lede={
          <>
            A curated membership. People get in on the quality of their work and how they show up, never on follower counts.
            {d ? ` ${d.members} ${d.members === 1 ? 'member' : 'members'} so far.` : ''}
          </>
        }
      />

      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft flex flex-wrap-reverse items-center justify-between gap-sm" role="alert">
          <p className="m-0 font-semibold min-w-0 flex-1 basis-[60%]">Could not load the Club.</p>
          <Button variant="outline" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      <section className="mt-lg" aria-labelledby="benefits-heading">
        <h2 id="benefits-heading" className="text-title2">
          What members get
        </h2>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {CLUB_BENEFITS.map((b) => (
            <li key={b.key} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-card-title">{b.name}</p>
              <p className="text-card-note text-ink-soft">{b.blurb}</p>
            </li>
          ))}
        </ul>
      </section>

      {d && (
        <section className="mt-lg" aria-labelledby="mine-heading">
          <h2 id="mine-heading" className="text-title2">
            Your membership
          </h2>
          {mine && (
            <div className="mt-sm rounded-card p-md" style={{ background: STATUS_COPY[mine.status].tint }}>
              <p className="m-0 text-card-title">{STATUS_COPY[mine.status].title}</p>
              <p className="mt-xs m-0 text-card-note">{STATUS_COPY[mine.status].blurb}</p>
              {mine.decisionNote && <p className="mt-xs m-0 text-card-note">Note from the reviewer: {mine.decisionNote}</p>}
              {mine.endsAt && (mine.status === 'approved' || mine.status === 'active') && <p className="mt-xs m-0 text-card-note">Runs until {longDate(mine.endsAt)}.</p>}
              {(mine.status === 'approved' || mine.status === 'active') && (
                <p className="mt-xs m-0 text-card-note">{mine.managerName ? `Your manager: ${mine.managerName}. Write to the team under Help to reach them.` : 'A manager on staff will be named for you soon.'}</p>
              )}
            </div>
          )}
          {canApply && (
            <form
              className="mt-sm flex flex-col gap-md rounded-card bg-card p-md shadow-toy-soft"
              onSubmit={(e) => {
                e.preventDefault();
                apply.mutate();
              }}
            >
              <label className="block">
                <span className="block text-subhead">Why the Club, and what you are working on</span>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={5} placeholder="Link to your best work if you like." className={FIELD} />
              </label>
              <p className="m-0 text-caption text-ink-soft">Reviewers see your profile, portfolio and this note. Never your journal or wellbeing.</p>
              <ErrorLine e={apply.isError ? apply.error : null} />
              <Button type="submit" size="lg" full disabled={apply.isPending}>
                {mine ? 'Apply again' : 'Apply to join'}
              </Button>
            </form>
          )}
        </section>
      )}

      {d?.reviewer && <ReviewQueue queue={d.queue} staff={d.staff} page={d.page} onChange={() => q.refetch()} />}
    </Screen>
  );
}

function ReviewQueue({ queue, staff, page, onChange }: { queue: Membership[]; staff: { id: string; name: string }[]; page: Page; onChange: () => void }) {
  const [months, setMonths] = useState('12');
  const setManager = useMutation({ mutationFn: ({ id, managerId }: { id: string; managerId: string | null }) => api.setClubManager(id, managerId), onSuccess: onChange });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Membership['status'] }) => api.decideMembership(id, { status, note: notes[id] ?? '', months: Number(months) || 12 }),
    onSuccess: onChange,
  });
  const applied = queue.filter((m) => m.status === 'applied');
  const others = queue.filter((m) => m.status !== 'applied');
  const row = (m: Membership) => (
    <li key={m.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
      <CardHead
        tag={
          <span title={m.status} className="max-w-full truncate rounded-pill px-xs text-caption font-medium leading-[20px]" style={{ background: STATUS_COPY[m.status].tint }}>
            {m.status}
          </span>
        }
      >
        <p className="m-0 text-card-title">{m.userName}</p>
      </CardHead>
      <p className="text-card-note text-ink-soft">Applied {longDate(m.createdAt)}</p>
      {m.note && <p className="mt-xs m-0 whitespace-pre-wrap text-subhead">{m.note}</p>}
      <label className="mt-sm block">
        <span className="block text-caption">Note to them</span>
        <input value={notes[m.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [m.id]: e.target.value }))} maxLength={1000} className={FIELD} />
      </label>
      <div className="mt-sm flex flex-wrap gap-xs">
        {m.status === 'applied' && (
          <>
            <Button onClick={() => decide.mutate({ id: m.id, status: 'approved' })} disabled={decide.isPending}>
              Approve for {months} months
            </Button>
            <Button variant="outline" onClick={() => decide.mutate({ id: m.id, status: 'rejected' })} disabled={decide.isPending}>
              Reject
            </Button>
          </>
        )}
        {(m.status === 'approved' || m.status === 'active') && (
          <Button variant="outline" onClick={() => decide.mutate({ id: m.id, status: 'suspended' })} disabled={decide.isPending}>
            Suspend
          </Button>
        )}
        {m.status === 'suspended' && (
          <Button variant="outline" onClick={() => decide.mutate({ id: m.id, status: 'active' })} disabled={decide.isPending}>
            Reinstate
          </Button>
        )}
      </div>
      {(m.status === 'approved' || m.status === 'active') && (
        <label className="mt-sm block">
          <span className="block text-caption">Named manager</span>
          <select value={m.managerId ?? ''} onChange={(e) => setManager.mutate({ id: m.id, managerId: e.target.value || null })} disabled={setManager.isPending} className={FIELD}>
            <option value="">Nobody yet</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </li>
  );
  return (
    <section className="mt-lg" aria-labelledby="queue-heading">
      <h2 id="queue-heading" className="text-title2">
        Review queue
      </h2>
      <label className="mt-sm block">
        <span className="block text-subhead font-semibold">Approvals run for</span>
        <select value={months} onChange={(e) => setMonths(e.target.value)} className={FIELD}>
          {['3', '6', '12', '24'].map((m) => (
            <option key={m} value={m}>
              {m} months
            </option>
          ))}
        </select>
      </label>
      <ErrorLine e={decide.isError ? decide.error : null} />
      <ErrorLine e={setManager.isError ? setManager.error : null} />
      {applied.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">No new applications.</p>}
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">{applied.map(row)}</ul>
      {others.length > 0 && (
        <>
          <h3 className="mt-md text-headline">Members and past decisions</h3>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">{others.map(row)}</ul>
        </>
      )}
      <Pager page={page} label="memberships" />
    </section>
  );
}
