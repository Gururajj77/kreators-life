import type { Cohort as CohortT, DiscountCheck, LearningItem, Program, ProgramInvite, ProgramVisibility } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState, Fragment } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { DiscountField } from '../components/DiscountField';
import { Fold } from '../components/Fold';
import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { MoreMenu } from '../components/MoreMenu';
import { SkeletonList } from '../components/Skeleton';
import { FieldLabel } from '../components/Field';
import { Segmented } from '../components/fx/Segmented';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { IconButton } from '../components/IconButton';
import { CloseButton } from '../components/CloseButton';
import { Check } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { ADMIN_GUIDE_PROGRAM, cohortAlwaysOpen, formatCount, money, PROGRAM_VISIBILITY_META } from '@kreators/shared';
import { useParamState } from '../lib/useParamState';
import { FIELD, FIELD_LINE } from '../lib/ui';
import { shortDate } from '../lib/date';
import { ErrorLine } from '../components/ErrorLine';
import { StatusTag } from '../components/StatusTag';
import { FactTag, IconTag } from '../components/FactTag';
import { RowCard } from '../components/RowCard';
import { ConfirmSpend } from '../components/ConfirmSpend';
import { ConfirmDelete } from '../components/ConfirmDelete';

const fmtDate = shortDate;
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const modeName = (m: Program['deliveryMode']) => ({ online: 'Online', in_person: 'In person', hybrid: 'Hybrid' })[m];
const KIND_OPTIONS = [
  { value: 'lesson', label: 'Lesson' },
  { value: 'video', label: 'Video' },
  { value: 'reading', label: 'Reading' },
] as const satisfies readonly { value: LearningItem['contentType']; label: string }[];
/** A cohort's dates in words: "Always open" for one that runs for years (the Admin guide's and Onboarding's), else "3 Nov to 30 Nov". */
const cohortWhen = (k: { startAt: string; endAt: string }) => {
  if (cohortAlwaysOpen(k.startAt, k.endAt)) return 'Always open';
  // The end's year when it is not this year, so "Self-paced, open all year" never reads as ending this 31 Dec.
  const endYear = k.endAt.slice(0, 4);
  return `${fmtDate(k.startAt)} to ${fmtDate(k.endAt)}${endYear !== String(new Date().getFullYear()) ? ` ${endYear}` : ''}`;
};
/** Whether a cohort's name already says it is always open ("Open all year"), so its row does not say it twice. */
const saysOpen = (k: { name: string; startAt: string; endAt: string }) => cohortAlwaysOpen(k.startAt, k.endAt) && /open all year|always open/i.test(k.name);
/** A cohort with room for everyone (Onboarding's) says nothing about seats. */
const OPEN_TO_ALL_SEATS = 100_000;
const priceText = (p: Program) => (p.pricePoints > 0 ? `${p.pricePoints} points` : p.priceCents > 0 ? money(p.priceCents, p.currency) : 'Free');
/** A row of a few equal choices spans the full width in equal parts (the founder, 2026-11-06); `grid!` beats the capsule's inline-flex. */
const SEG_FULL = 'grid! w-full grid-flow-col auto-cols-fr [&>button]:px-xs!';


/** The state changes a program's menu offers, in the words of each: the one it is in is left out. */
const STATE_ACTIONS: { to: ProgramVisibility; label: string }[] = [
  { to: 'public', label: 'Make it public' },
  { to: 'private', label: 'Make it private (invite only)' },
  { to: 'draft', label: 'Move it back to draft' },
  { to: 'archived', label: 'Archive' },
];

export function School() {
  const pg = usePage();
  // An admin can switch to every program from anyone in every state; the address keeps the choice so Back returns to it.
  const [view, setView] = useParamState('view', 'mine');
  const query = view === 'every' ? `${pg.query}&view=every` : pg.query;
  const q = useAuthed(['school', query], () => api.school(query));
  const [creating, setCreating] = useState(false);
  const d = q.data;
  const myIds = new Set(d?.myCohorts.map((k) => k.id) ?? []);

  return (
    <Screen>
      <PageHeader
        back={{ to: '/apps', label: 'Apps' }}
        title="School"
        lede="Cohorts with lessons, assignments, live sessions and a mentor’s feedback."
        aside={d?.staff ? <Button onClick={() => setCreating(true)}>New program</Button> : undefined}
      />

      {d && (d.myCohorts.length > 0 || d.managed.length > 0) && (
        <Section id="mine-heading" title="Your cohorts">
          <ul className="flex list-none flex-col gap-xs p-0 m-0">
            {[...d.myCohorts, ...d.managed.filter((k) => !myIds.has(k.id))].map((k) => (
              <li key={k.id} className="flex">
                {/* The program and cohort at the top left, never cut, the cohort's state in the corner, the dates and the person's part as
                    tags at the foot, the arrow at the bottom right. */}
                <RowCard
                  to={`/school/${k.id}`}
                  title={k.programName}
                  sub={k.name}
                  corner={<StatusTag tone={k.status === 'running' ? 'good' : k.status === 'upcoming' ? 'info' : 'neutral'}>{cap(k.status)}</StatusTag>}
                  facts={[
                    <FactTag key="when" kind="when">{cohortWhen(k)}</FactTag>,
                    d.managed.some((m) => m.id === k.id) ? <IconTag key="mgr" tone="deep" icon="Users">You manage it</IconTag> : null,
                  ]}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* The id stays "programs-heading" so a link to /school#programs-heading still lands here. */}
      <Section id="programs-heading" title="Programs">
        {d?.admin && (
          <Segmented
            label="Which programs"
            className={`mb-sm ${SEG_FULL}`}
            value={view === 'every' ? 'every' : 'mine'}
            onChange={(v) => {
              setView(v);
              pg.reset();
            }}
            options={[
              { value: 'mine', label: 'Open to me' },
              { value: 'every', label: 'Every program' },
            ]}
          />
        )}
        {q.isLoading && <SkeletonList count={3} lines={3} label="Loading programs" />}
        {q.isError && <ErrorLine e={q.error} />}
        {d && d.programs.length === 0 && <p className="m-0 text-subhead text-ink-soft">No programs are open yet. Each program lists its cohort dates here once the team sets them.</p>}
        {d?.admin && view === 'every' && d.programs.length > 0 && <p className="mb-sm mt-0 text-footnote text-ink-soft">Every program from anyone, in every state. As an admin you can change any of them.</p>}
        <ul className="flex list-none flex-col gap-sm p-0 m-0">
          {d?.programs.map((p) => (
            <li key={p.id}>
              {/* School's order is by state, then the order an admin set: a program moves among the ones in the same state that this
                  view shows. The server says which program is first or last of its state in the whole view, whatever the page. */}
              <ProgramCard
                program={p}
                myIds={myIds}
                onChange={() => q.refetch()}
                view={view === 'every' ? 'every' : 'mine'}
                canUp={!p.orderFirst}
                canDown={!p.orderLast}
              />
            </li>
          ))}
        </ul>
        <Pager page={d?.page} label="programs" />
      </Section>

      <NewProgramSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          q.refetch();
        }}
      />
    </Screen>
  );
}

function ProgramCard({ program: p, myIds, onChange, view, canUp, canDown }: { program: Program; myIds: Set<string>; onChange: () => void; view: 'mine' | 'every'; canUp: boolean; canDown: boolean }) {
  const staff = Boolean(p.canEdit);
  const manage = Boolean(p.canManage);
  const order = Boolean(p.canOrder);
  // The Admin guide is for admins only: its card says so, and its menu offers no invites and no way to make it public.
  const guide = p.id === ADMIN_GUIDE_PROGRAM;
  const [editing, setEditing] = useState(false);
  const move = useMutation({ mutationFn: (to: 'first' | 'up' | 'down') => api.moveProgram(p.id, to, view), onSuccess: () => onChange() });
  const vis = p.visibility;
  const meta = PROGRAM_VISIBILITY_META[vis];
  const [tool, setTool] = useState<'lesson' | 'assignment' | 'cohort' | null>(null);
  // A team discount code for this program. The server prices it again when someone enrols.
  const [discount, setDiscount] = useState<DiscountCheck | null>(null);
  const enroll = useMutation({ mutationFn: (cohortId: string) => api.enroll(cohortId, undefined, discount ? discount.code : undefined), onSuccess: () => onChange() });
  const setState = useMutation({ mutationFn: (to: ProgramVisibility) => api.setProgramVisibility(p.id, to), onSuccess: () => onChange() });
  const remove = useMutation({ mutationFn: () => api.deleteProgram(p.id), onSuccess: () => onChange() });
  // An archived program takes no one new, so it shows no Enrol (only its creator, managers and admins see it at all).
  const open = vis === 'archived' ? [] : p.cohorts.filter((k) => k.status === 'upcoming' || k.status === 'running');
  // A program priced in points asks once more before it spends them (ConfirmSpend), never in one tap.
  const [asking, setAsking] = useState<string | null>(null);
  // Taking a program off the public list, hiding a private one from the people invited, or archiving it asks first in a sheet with a
  // red yes (every removal asks, the founder 2026-11-06); so does deleting an archived one for good.
  const [moving, setMoving] = useState<ProgramVisibility | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [inviting, setInviting] = useState(false);
  // Private to public opens it wider, so it removes no one and needs no sheet.
  const changeTo = (to: ProgramVisibility) => (vis === 'public' || (vis === 'private' && to !== 'public') || to === 'archived' ? setMoving(to) : setState.mutate(to));
  const join = (cohortId: string) => (p.pricePoints > 0 ? setAsking(cohortId) : enroll.mutate(cohortId));
  const spend = discount ? discount.payPoints : p.pricePoints;
  return (
    // The name at the top left with the team's menu, how it runs, its price and its state as tags under the name, then
    // the words, the cohorts and the team's tools.
    <div className="fx-spot rounded-tile bg-card p-sm shadow-toy-soft">
      {/* The name and the team's "…" on one row, centred on each other (the founder, 2026-11-06); the state is a tag with the others. */}
      <div className="flex items-center justify-between gap-xs">
        <p className="m-0 min-w-0 flex-1 text-balance text-card-title">{p.name}</p>
        {(staff || manage) && (
          <MoreMenu
            label={`Manage ${p.name}`}
            items={[
              ...(staff ? [{ key: 'edit', label: 'Edit name and description', onSelect: () => setEditing(true) }] : []),
              ...(order
                ? [
                    { key: 'first', label: 'Show first', onSelect: () => move.mutate('first'), disabled: move.isPending || !canUp },
                    { key: 'up', label: 'Move up', onSelect: () => move.mutate('up'), disabled: move.isPending || !canUp },
                    { key: 'down', label: 'Move down', onSelect: () => move.mutate('down'), disabled: move.isPending || !canDown },
                  ]
                : []),
              ...(staff
                ? [
                    { key: 'lesson', label: 'Add lesson', onSelect: () => setTool('lesson') },
                    { key: 'assignment', label: 'Add assignment', onSelect: () => setTool('assignment') },
                    ...(vis === 'archived' ? [] : [{ key: 'cohort', label: 'Open a cohort', onSelect: () => setTool('cohort') }]),
                  ]
                : []),
              ...(manage && vis === 'private' && !guide ? [{ key: 'invite', label: 'Invite people', onSelect: () => setInviting(true) }] : []),
              ...(manage
                ? STATE_ACTIONS.filter((a) => a.to !== vis && !(guide && a.to === 'public')).map((a) => ({ key: `state-${a.to}`, label: a.label, onSelect: () => changeTo(a.to), disabled: setState.isPending }))
                : []),
              ...(manage && vis === 'archived' ? [{ key: 'delete', label: 'Delete for good', destructive: true, onSelect: () => setDeleting(true), disabled: remove.isPending }] : []),
            ]}
          />
        )}
      </div>
      {editing && <ProgramDetailsEditor program={p} onDone={() => setEditing(false)} onSaved={onChange} />}
      <div className="mt-xs flex">
        <span className="fill-row-all flex min-w-0 flex-wrap gap-xs">
          <FactTag kind={p.deliveryMode === 'online' ? 'online' : 'place'}>{modeName(p.deliveryMode)}</FactTag>
          <FactTag kind={p.pricePoints > 0 || p.priceCents > 0 ? 'price' : 'free'}>{priceText(p)}</FactTag>
          {p.createdByName !== undefined && !p.mine && <IconTag tone="calm" icon="UserRound">{p.createdByName ? `By ${p.createdByName}` : 'By the team'}</IconTag>}
          {/* A learner sees the state only when it is not the usual Public (an invited Private program, say). */}
          {(staff || manage || vis !== 'public') && <StatusTag tone={meta.tone}>{meta.name}</StatusTag>}
        </span>
      </div>
      {/* Who can see it, said to the people who run it; a learner only ever sees programs open to them. */}
      {(staff || manage) && <p className="mt-xs m-0 text-card-note text-ink-soft">{guide ? 'It also opens from Admin.' : meta.line}</p>}
      {p.description && !editing && <p className="prose-long mt-xs m-0 whitespace-pre-wrap text-card-prose">{p.description}</p>}
      {(p.outcomes || p.prerequisites) && (
        <Fold className="mt-xs" title="More about it">
          {p.outcomes && (
            <p className="m-0 text-subhead text-ink-soft">
              <span className="font-semibold">You leave with:</span> {p.outcomes}
            </p>
          )}
          {p.prerequisites && (
            <p className="mt-xs m-0 text-subhead text-ink-soft">
              <span className="font-semibold">Before you start:</span> {p.prerequisites}
            </p>
          )}
        </Fold>
      )}
      {open.length > 0 && p.pricePoints > 0 && vis === 'public' && <DiscountField className="mt-sm" area="program" itemId={p.id} value={discount?.code ?? ''} check={discount} onChange={(_c, check) => setDiscount(check)} />}
      {/* Each cohort's name (and its dates) is centred on its button, so a one-line name ("Open all year") sits level with Enrol. */}
      {open.length > 0 && (
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {open.map((k) => (
          <li key={k.id} className="flex flex-wrap items-center justify-between gap-sm rounded-tile bg-paper p-sm">
            <span className="min-w-0 flex-1">
              <span className="block text-balance text-headline">{k.name}</span>
              {/* The dates and the seats left, as one line; a cohort whose name already says it is open all year and has room for all
                  says nothing more. */}
              {(() => {
                const parts = [saysOpen(k) ? null : cohortWhen(k), k.capacity < OPEN_TO_ALL_SEATS ? `${formatCount(Math.max(0, k.capacity - k.enrolled))} of ${formatCount(k.capacity)} seats left` : null].filter(Boolean) as string[];
                return parts.length ? (
                  <span className="block text-footnote text-ink-soft">
                    {parts.map((t, i) => (
                      <Fragment key={i}>
                        {i > 0 ? ' ' : null}
                        <span className="inline-block">
                          {t}
                          {i < parts.length - 1 ? ',' : ''}
                        </span>
                      </Fragment>
                    ))}
                  </span>
                ) : null;
              })()}
            </span>
            {myIds.has(k.id) ? (
              <Link to={`/school/${k.id}`} className="toy toy-soft inline-flex min-h-[44px] shrink-0 items-center rounded-pill bg-card px-md text-subhead font-semibold">
                Open
              </Link>
            ) : (
              <Button variant="outline" onClick={() => join(k.id)} disabled={enroll.isPending || k.enrolled >= k.capacity}>
                {k.enrolled >= k.capacity ? 'Full' : 'Enrol'}
              </Button>
            )}
          </li>
        ))}
      </ul>
      )}
      {manage && vis === 'private' && !guide && <ProgramInvites program={p} open={inviting} onOpenChange={setInviting} />}
      {(enroll.error || setState.error || move.error) && (
        <div className="mt-xs">
          <ErrorLine e={enroll.error ?? setState.error ?? move.error} />
        </div>
      )}
      {open.length === 0 && (
        // No dates yet (or archived), said to whoever reads it; the team's tools are in the corner beside the state.
        <p className="mt-sm m-0 text-card-note text-ink-soft">
          {vis === 'archived' ? 'Archived: no one new can enrol. People already in keep their cohort.' : staff ? 'No cohort dates yet. Open one from the menu.' : 'No cohort dates are set yet. Come back after the team adds one.'}
        </p>
      )}
      <ConfirmDelete
        open={moving !== null}
        title={moving === 'archived' ? `Archive ${p.name}?` : vis === 'private' ? 'Hide this program from the people you invited?' : 'Take this program off the public list?'}
        body={
          moving === 'archived'
            ? 'It leaves School and takes no one new. People already in keep their cohort. You can bring it back later.'
            : `It becomes ${moving ? PROGRAM_VISIBILITY_META[moving].name.toLowerCase() : ''}. ${moving ? PROGRAM_VISIBILITY_META[moving].line : ''} Cohorts already running keep going.`
        }
        yes={moving === 'archived' ? 'Yes, archive it' : vis === 'private' ? 'Yes, hide it' : 'Yes, take it off'}
        keep="Keep it as it is"
        pending={setState.isPending}
        failed={setState.isError}
        onYes={() => {
          if (moving) setState.mutate(moving, { onSuccess: () => setMoving(null) });
        }}
        onClose={() => setMoving(null)}
      />
      <ConfirmDelete
        open={deleting}
        title={`Delete ${p.name} for good?`}
        body="This cannot be undone. Its cohorts, lessons, assignments, hand-ins and discussions all go with it."
        yes="Yes, delete it for good"
        keep="Keep it"
        pending={remove.isPending}
        failed={remove.isError}
        onYes={() => remove.mutate(undefined, { onSuccess: () => setDeleting(false) })}
        onClose={() => setDeleting(false)}
      />
      <ConfirmSpend
        open={asking !== null}
        onClose={() => setAsking(null)}
        title={`Enrol in ${p.name}?`}
        body={`This spends ${formatCount(spend)} points.`}
        action={`Yes, spend ${formatCount(spend)} points`}
        busy={enroll.isPending}
        onConfirm={() => {
          if (asking) enroll.mutate(asking);
          setAsking(null);
        }}
      />
      {staff && (
        <StaffSheet
          program={p}
          tool={tool}
          onClose={() => setTool(null)}
          onDone={() => {
            setTool(null);
            onChange();
          }}
        />
      )}
    </div>
  );
}

/**
 * A program's name and description, changed in place on its card (never a popup): the two fields, then Save and Cancel. Whoever may
 * add its lessons may change them; the server audits which parts changed.
 */
function ProgramDetailsEditor({ program: p, onDone, onSaved }: { program: Program; onDone: () => void; onSaved: () => void }) {
  const [name, setName] = useState(p.name);
  const [description, setDescription] = useState(p.description);
  const save = useMutation({
    mutationFn: () => api.updateProgram(p.id, { name: name.trim(), description: description.trim() }),
    onSuccess: () => {
      onSaved();
      onDone();
    },
  });
  const same = name.trim() === p.name && description.trim() === p.description;
  return (
    <form
      className="mt-sm flex flex-col gap-xs rounded-tile bg-paper p-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim() && !same) save.mutate();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDone();
      }}
    >
      <FieldLabel label="Name">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required className={FIELD} />
      </FieldLabel>
      <FieldLabel label="Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={5000} className={FIELD} />
      </FieldLabel>
      <ErrorLine e={save.error} />
      {/* Save takes the free width; Cancel sits at its right on the same line. */}
      <div className="flex items-center gap-xs">
        <Button type="submit" variant="outline" className="flex-1" disabled={save.isPending || !name.trim() || same}>
          Save
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * The people invited to a private program, inline in its card (never a popup): one field that takes an email, @username or friend code,
 * Invite, then the list with Remove, which asks first. Its creator or an admin only.
 */
function ProgramInvites({ program: p, open, onOpenChange }: { program: Program; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [who, setWho] = useState('');
  const [said, setSaid] = useState('');
  const [removing, setRemoving] = useState<ProgramInvite | null>(null);
  const list = useAuthed(['school', 'invites', p.id], () => api.programInvites(p.id, 'invpage=1&invsize=100'), open);
  const invite = useMutation({
    mutationFn: () => api.inviteToProgram(p.id, who.trim()),
    onSuccess: (r) => {
      setWho('');
      setSaid(`Invited ${r.invite.name}. They got a note in their inbox.`);
      list.refetch();
    },
  });
  const uninvite = useMutation({
    mutationFn: (userId: string) => api.uninviteFromProgram(p.id, userId),
    onSuccess: () => {
      setRemoving(null);
      list.refetch();
    },
  });
  const invites = list.data?.invites ?? [];
  return (
    <Fold className="mt-xs" title="Invite people" adds open={open} onOpenChange={onOpenChange}>
      <form
        className="flex flex-col gap-xs"
        onSubmit={(e) => {
          e.preventDefault();
          setSaid('');
          if (who.trim()) invite.mutate();
        }}
      >
        {/* The label, a quiet example, then the field with its tick and a cross that folds it at the right (the small-input card of the design rules). */}
        <div>
          <label htmlFor={`invite-${p.id}`} className="block text-subhead font-semibold">
            Email, @username or friend code
          </label>
          <p className="m-0 text-caption text-ink-soft">Like asha@example.com, @asha or their 8-character code.</p>
        </div>
        <div className="flex items-center gap-xs">
          <input
            id={`invite-${p.id}`}
            value={who}
            onChange={(e) => setWho(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onOpenChange(false);
              }
            }}
            maxLength={200}
            autoComplete="off"
            className={`${FIELD_LINE} min-w-0 flex-1`}
          />
          <IconButton
            icon={Check}
            label="Invite them"
            tip="br"
            onClick={() => {
              setSaid('');
              if (who.trim()) invite.mutate();
            }}
            disabled={invite.isPending || !who.trim()}
          />
          <CloseButton onClick={() => onOpenChange(false)} label="Close" />
        </div>
        <ErrorLine e={invite.error} />
        {said && (
          <p role="status" className="m-0 text-footnote text-ink-soft">
            {said}
          </p>
        )}
      </form>
      {list.isLoading && <SkeletonList count={2} lines={1} label="Loading invites" />}
      {list.data && invites.length === 0 && <p className="mt-sm m-0 text-card-note text-ink-soft">No one is invited yet. Only the people you invite can see it and enrol.</p>}
      {invites.length > 0 && (
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {invites.map((i) => (
            <li key={i.userId} className="flex flex-wrap-reverse items-center justify-between gap-sm rounded-tile bg-paper px-sm py-xs">
              <span className="min-w-0 flex-1">
                <span className="block text-headline">{i.name}</span>
                {i.handle && <span className="block text-footnote text-ink-soft">@{i.handle}</span>}
              </span>
              <Button variant="outline" size="sm" onClick={() => setRemoving(i)} disabled={uninvite.isPending}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {list.data?.page.more && <p className="mt-xs m-0 text-footnote text-ink-soft">Showing the newest 100.</p>}
      <ConfirmDelete
        open={removing !== null}
        title={removing ? `Remove ${removing.name}'s invite?` : 'Remove this invite?'}
        body="They can no longer see this program. If they already enrolled, they keep their seat."
        yes="Yes, remove the invite"
        keep="Keep it"
        pending={uninvite.isPending}
        failed={uninvite.isError}
        onYes={() => {
          if (removing) uninvite.mutate(removing.userId);
        }}
        onClose={() => setRemoving(null)}
      />
    </Fold>
  );
}

function StaffSheet({ program, tool, onClose, onDone }: { program: Program; tool: 'lesson' | 'assignment' | 'cohort' | null; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<LearningItem['contentType']>('lesson');
  const [body, setBody] = useState('');
  const [ref, setRef] = useState('');
  const [instructions, setInstructions] = useState('');
  const [rubric, setRubric] = useState('');
  const [dueDays, setDueDays] = useState('7');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [capacity, setCapacity] = useState('30');
  const reset = () => {
    setTitle('');
    setBody('');
    setRef('');
    setInstructions('');
    setRubric('');
  };
  const addLesson = useMutation({
    mutationFn: () => api.addLearningItem(program.id, { moduleTitle: title, contentType, body, contentRef: ref || undefined }),
    onSuccess: () => {
      reset();
      onDone();
    },
  });
  const addAssignment = useMutation({
    mutationFn: () => api.addAssignment(program.id, { title, instructions, rubric, dueDays: Number(dueDays) || 7 }),
    onSuccess: () => {
      reset();
      onDone();
    },
  });
  const openCohort = useMutation({
    mutationFn: () => api.openCohort(program.id, { name: title, startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString(), capacity: Number(capacity) || 30 }),
    onSuccess: () => {
      reset();
      onDone();
    },
  });
  const titles = { lesson: 'Add a lesson', assignment: 'Add an assignment', cohort: 'Open a cohort' } as const;
  const busy = addLesson.isPending || addAssignment.isPending || openCohort.isPending;
  return (
    <Sheet open={tool !== null} onClose={onClose} title={tool ? `${titles[tool]}: ${program.name}` : ''}>
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          if (tool === 'lesson') addLesson.mutate();
          if (tool === 'assignment') addAssignment.mutate();
          if (tool === 'cohort' && startAt && endAt) openCohort.mutate();
        }}
      >
        <FieldLabel label={tool === 'cohort' ? 'Cohort name' : 'Title'}>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} required className={FIELD} />
        </FieldLabel>
        {tool === 'lesson' && (
          <>
            <fieldset className="m-0 border-0 p-0">
              <legend className="text-subhead font-semibold">Kind</legend>
              <Segmented label="Kind" className={`mt-xs ${SEG_FULL}`} value={contentType} onChange={setContentType} options={KIND_OPTIONS} />
            </fieldset>
            <FieldLabel label="Link to a video or reading">
              <input type="url" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="https://" className={FIELD} />
            </FieldLabel>
            <FieldLabel label="Text">
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={20000} className={FIELD} />
            </FieldLabel>
          </>
        )}
        {tool === 'assignment' && (
          <>
            <FieldLabel label="Instructions">
              <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} maxLength={5000} className={FIELD} />
            </FieldLabel>
            <FieldLabel label="How it is judged">
              <textarea value={rubric} onChange={(e) => setRubric(e.target.value)} rows={3} maxLength={2000} className={FIELD} />
            </FieldLabel>
            <FieldLabel label="Days to hand it in">
              <input type="number" min={1} max={365} value={dueDays} onChange={(e) => setDueDays(e.target.value)} className={FIELD} />
            </FieldLabel>
          </>
        )}
        {tool === 'cohort' && (
          <>
            <div className="grid grid-cols-2 gap-xs">
              <FieldLabel label="Starts">
                <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required className={FIELD} />
              </FieldLabel>
              <FieldLabel label="Ends">
                <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required className={FIELD} />
              </FieldLabel>
            </div>
            <FieldLabel label="Seats">
              <input type="number" min={1} max={1000} value={capacity} onChange={(e) => setCapacity(e.target.value)} className={FIELD} />
            </FieldLabel>
            <p className="m-0 text-subhead text-ink-soft">You become its manager: you schedule sessions, give feedback and mark completion.</p>
          </>
        )}
        <ErrorLine e={addLesson.error ?? addAssignment.error ?? openCohort.error} />
        <Button type="submit" size="lg" full disabled={busy || !title.trim()}>
          {tool ? titles[tool] : 'Save'}
        </Button>
      </form>
    </Sheet>
  );
}

function NewProgramSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [mode, setMode] = useState<Program['deliveryMode']>('online');
  const [outcomes, setOutcomes] = useState('');
  const [prerequisites, setPrerequisites] = useState('');
  const [visibility, setVisibility] = useState<ProgramVisibility>('draft');
  const create = useMutation({
    mutationFn: () => api.createProgram({ name, description, pricePoints: Number(price) || 0, deliveryMode: mode, outcomes, prerequisites, visibility }),
    onSuccess: () => {
      setName('');
      setDescription('');
      onCreated();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="New program">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        {/* A quiet line under every field's label, or under none (the founder, 2026-11-06). */}
        <FieldLabel label="Name" hint="Shown on its card in School.">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required className={FIELD} />
        </FieldLabel>
        <FieldLabel label="Description" hint="A few lines on what it teaches.">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={5000} className={FIELD} />
        </FieldLabel>
        <FieldLabel label="Price in points" hint="Zero makes it free.">
          <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={FIELD} />
        </FieldLabel>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead font-semibold">How it runs</legend>
          <span className="block text-caption text-ink-soft">Where its cohorts meet.</span>
          <div className="mt-xs grid grid-cols-3 gap-xs">
            {(['online', 'in_person', 'hybrid'] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`min-h-[44px] min-w-0 rounded-pill border-2 px-xs text-subhead font-medium ${mode === m ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                {modeName(m)}
              </button>
            ))}
          </div>
        </fieldset>
        <FieldLabel label="What people leave with" hint="Shown under More about it.">
          <textarea value={outcomes} onChange={(e) => setOutcomes(e.target.value)} rows={2} maxLength={2000} className={FIELD} />
        </FieldLabel>
        <FieldLabel label="What they need before starting" hint="Also shown under More about it.">
          <textarea value={prerequisites} onChange={(e) => setPrerequisites(e.target.value)} rows={2} maxLength={1000} className={FIELD} />
        </FieldLabel>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead font-semibold">Who can see it</legend>
          <span className="block text-caption text-ink-soft">{PROGRAM_VISIBILITY_META[visibility].line}</span>
          <Segmented
            label="Who can see it"
            className={`mt-xs ${SEG_FULL}`}
            value={visibility}
            onChange={setVisibility}
            options={(['draft', 'private', 'public'] as const).map((v) => ({ value: v, label: PROGRAM_VISIBILITY_META[v].name }))}
          />
        </fieldset>
        <ErrorLine e={create.error} />
        <Button type="submit" size="lg" full disabled={create.isPending || !name.trim()}>
          Create program
        </Button>
      </form>
    </Sheet>
  );
}

export type { CohortT };
