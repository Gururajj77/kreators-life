import {
  AGENCY_AUTHOR_NAME,
  AGENCY_CHANNELS,
  AGENCY_MAX_MINUTES,
  AGENCY_NOTE_MAX,
  AGENCY_NOTES_MAX,
  AGENCY_TITLE_MAX,
  DELIVERABLE_KINDS,
  DELIVERABLE_KIND_NAME,
  DELIVERABLE_STAGES,
  DELIVERABLE_STAGE_META,
  NOTE_KIND_NAME,
  changesLabel,
  type AgencyClient,
  type AgencyDeliverable,
  type AgencyNote,
  type DeliverableKind,
  type DeliverableStage,
  type TagTone,
  typedCents,
} from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { prettyDate, todayLocal } from '../lib/date';
import { useAuthed } from '../lib/queries';
import { Button } from './Button';
import { Inert } from './Inert';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';
import { CardHead } from './CardHead';
import { useAgencyCan } from '../lib/agencyWorkspace';
import { Toggle } from './Toggle';
import { FIELD } from '../lib/ui';
import { FieldLabel } from './Field';


const COPY = {
  addTitle: 'Add a deliverable',
  editTitle: 'Deliverable',
  pickClient: 'Pick a client first.',
  linkHint: 'A link to the work, starting with https.',
  feeHint: 'What you charge for this one, if it has its own fee. Type whole units, like 4000.',
  notesHint: 'Only you see this. It is the brief and your reminders.',
  threadLede: 'Notes go back and forth here. Tick "Share with the client" to show one at their link.',
  timeLede: 'Type minutes, or hours and minutes like 1:30.',
  removeAsk: 'This removes the deliverable and its notes. It cannot be undone.',
  armyLede: 'This one answers a deliverable in an Army campaign.',
  changesLede: 'Each change the client asks for uses one and sends the piece back to making.',
  changesMore: ['With none left, the client can only ask for a paid change, which arrives here as a note.', 'A new month starts with a fresh count.'],
} as const;

const ARMY_TAG: Record<string, { tone: TagTone; name: string }> = {
  open: { tone: 'neutral', name: 'Open in Army' },
  submitted: { tone: 'info', name: 'Sent to the brand' },
  approved: { tone: 'good', name: 'Brand approved' },
  changes: { tone: 'warn', name: 'Brand asked for changes' },
};
const AUTHOR_TONE: Record<AgencyNote['author'], TagTone> = { me: 'neutral', client: 'info', brand: 'warn', team: 'calm' };

const toMajor = (cents: number): string => (cents === 0 ? '' : cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));
/** A typed amount in cents (`typedCents`: "30,000" and "₹30,000" read as 30000); NaN for junk or a minus, so the form can say so. Blank is 0. */
const toCents = (v: string): number => {
  const c = typedCents(v);
  return Number.isInteger(c) && c >= 0 ? c : Number.NaN;
};
/** "90" is minutes, "1:30" and "1h30" are an hour and a half, "1.5h" is the same. */
export function parseMinutes(v: string): number {
  const t = v.trim().toLowerCase();
  if (!t) return 0;
  const colon = /^(\d+):(\d{1,2})$/.exec(t) ?? /^(\d+)h\s*(\d{1,2})m?$/.exec(t);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  const hours = /^(\d+(?:\.\d+)?)\s*h$/.exec(t);
  if (hours) return Math.round(Number(hours[1]) * 60);
  const n = Math.round(Number(t.replace(/m$/, '')));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** One deliverable: its details, stage, notes thread, time, and the Army send and sync when it is linked. `item` null with `clientId` adds one. */
export function DeliverableSheet({ open, item, clientId, clients, onClose }: { open: boolean; item: AgencyDeliverable | null; clientId?: string; clients: AgencyClient[]; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={item ? COPY.editTitle : COPY.addTitle}>
      <Form item={item} clientId={clientId} clients={clients} onClose={onClose} />
    </Sheet>
  );
}

function Form({ item, clientId, clients, onClose }: { item: AgencyDeliverable | null; clientId?: string; clients: AgencyClient[]; onClose: () => void }) {
  const qc = useQueryClient();
  // On someone else's Agency (a team member): view only without Pipeline edit, the fee only with Paperwork edit, and never the owner's
  // private notes, Army, time or removing a piece.
  const { access, can } = useAgencyCan();
  const member = Boolean(access);
  const edit = can('pipeline', 'edit');
  const showFee = can('paperwork', 'edit');
  const [client, setClient] = useState(item?.clientId ?? clientId ?? (clients.length === 1 ? (clients[0]?.id ?? '') : ''));
  const [title, setTitle] = useState(item?.title ?? '');
  const [kind, setKind] = useState<DeliverableKind>(item?.kind ?? 'video');
  const [platform, setPlatform] = useState(item?.platform ?? '');
  const [stage, setStage] = useState<DeliverableStage>(item?.stage ?? 'idea');
  const [due, setDue] = useState(item?.dueDate ?? '');
  const [publish, setPublish] = useState(item?.publishDate ?? '');
  const [link, setLink] = useState(item?.link ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [fee, setFee] = useState(toMajor(item?.feeCents ?? 0));
  const [confirm, setConfirm] = useState(false);
  const listId = useId();
  const badFee = Number.isNaN(toCents(fee));

  // The stage moves from outside too (the brand's answer in Army, a drag on the board), so the form follows it.
  useEffect(() => {
    if (item) setStage(item.stage);
  }, [item?.stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = clients.find((c) => c.id === client);
  const channelOptions = Array.from(new Set([...(chosen?.channels ?? []), ...AGENCY_CHANNELS]));
  const invalidate = () => qc.invalidateQueries({ queryKey: ['agency'] });

  const save = useMutation({
    mutationFn: async () => {
      const body = { title: title.trim(), kind, platform: platform.trim(), stage, dueDate: due || null, publishDate: publish || null, link: link.trim(), ...(member ? {} : { notes }), ...(showFee ? { feeCents: toCents(fee) } : {}) };
      if (item) await api.agencyItemUpdate(item.id, body);
      else await api.agencyItemAdd({ ...body, clientId: client });
    },
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.agencyItemRemove(item!.id),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  return (
    <div>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (edit && title.trim() && client && !badFee) save.mutate();
        }}
      >
        <fieldset disabled={!edit} className="m-0 min-w-0 border-0 p-0">
        {!item && !clientId && (
          <FieldLabel className="mt-sm" label="Client">
            <select value={client} onChange={(e) => setClient(e.target.value)} required className={FIELD}>
              <option value="">{COPY.pickClient}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FieldLabel>
        )}
        {item && <p className="m-0 text-subhead text-ink-soft">For {item.clientName}</p>}
        <FieldLabel className="mt-sm" label="What is it called?">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={AGENCY_TITLE_MAX} required className={FIELD} />
        </FieldLabel>
        <div className="grid gap-sm md:grid-cols-2">
          <FieldLabel className="mt-sm" label="Kind">
            <select value={kind} onChange={(e) => setKind(e.target.value as DeliverableKind)} className={FIELD}>
              {DELIVERABLE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {DELIVERABLE_KIND_NAME[k]}
                </option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel className="mt-sm" label="Channel">
            <input list={listId} value={platform} onChange={(e) => setPlatform(e.target.value)} maxLength={30} className={FIELD} />
            <datalist id={listId}>
              {channelOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </FieldLabel>
        </div>
        <FieldLabel className="mt-sm" label="Stage">
          <select value={stage} onChange={(e) => setStage(e.target.value as DeliverableStage)} className={FIELD}>
            {DELIVERABLE_STAGES.map((s) => (
              <option key={s} value={s}>
                {DELIVERABLE_STAGE_META[s].name}, {DELIVERABLE_STAGE_META[s].blurb}
              </option>
            ))}
          </select>
        </FieldLabel>
        <div className="grid gap-sm md:grid-cols-2">
          <FieldLabel className="mt-sm" label="Due on">
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={FIELD} />
          </FieldLabel>
          <FieldLabel className="mt-sm" label="Goes live on">
            <input type="date" value={publish} onChange={(e) => setPublish(e.target.value)} className={FIELD} />
          </FieldLabel>
        </div>
        <FieldLabel className="mt-sm" label="Link" hint={COPY.linkHint}>
          <input type="url" value={link} onChange={(e) => setLink(e.target.value)} maxLength={500} placeholder="https://" className={FIELD} />
        </FieldLabel>
        {showFee && (
          <FieldLabel className="mt-sm" label="Fee" hint={COPY.feeHint}>
            <input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} aria-invalid={badFee || undefined} className={FIELD} />
            {badFee && <p role="alert" className="mt-xs m-0 text-subhead">Type the amount as a number, like 4000 or 4,000.50.</p>}
          </FieldLabel>
        )}
        {!member && (
          <FieldLabel className="mt-sm" label="Notes, only for you" hint={COPY.notesHint}>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={AGENCY_NOTES_MAX} className={FIELD} />
          </FieldLabel>
        )}
        </fieldset>
        {save.isError && (
          <p role="alert" className="mt-sm m-0 text-subhead">
            {(save.error as Error).message || 'That did not save.'}
          </p>
        )}
        {edit && (
        <div className="mt-md flex flex-wrap items-center gap-xs">
          <Button type="submit" disabled={save.isPending || !title.trim() || !client || badFee}>
            {save.isPending ? 'Saving' : item ? 'Save changes' : 'Add it'}
          </Button>
          {item && !member &&
            (confirm ? (
              <>
                <Button variant="outline" onClick={() => remove.mutate()} disabled={remove.isPending}>
                  Yes, remove it
                </Button>
                <Button variant="ghost" onClick={() => setConfirm(false)}>
                  Keep it
                </Button>
                <p className="m-0 basis-full text-subhead text-ink-soft">{COPY.removeAsk}</p>
              </>
            ) : (
              <Button variant="outline" onClick={() => setConfirm(true)}>
                Remove
              </Button>
            ))}
        </div>
        )}
      </form>

      {item && !member && <Army item={item} link={link} onDone={invalidate} />}
      {item && <Changes item={item} onDone={invalidate} edit={edit} />}
      {item && <Thread itemId={item.id} onDone={invalidate} />}
      {item && !member && <TimeLog item={item} onDone={invalidate} />}
    </div>
  );
}

/** The Army link: the brand's status, send a version, take its answer back. */
function Army({ item, link, onDone }: { item: AgencyDeliverable; link: string; onDone: () => void }) {
  const [said, setSaid] = useState('');
  const send = useMutation({
    mutationFn: () => api.agencyArmySend(item.id, link.trim() ? { url: link.trim() } : {}),
    onSuccess: () => {
      setSaid('Sent to the brand. It is in review now.');
      onDone();
    },
  });
  const sync = useMutation({
    mutationFn: () => api.agencyArmySync(item.id),
    onSuccess: (r) => {
      setSaid(r.moved === 'approved' ? 'The brand approved it. It moved to Approved.' : r.moved === 'making' ? 'The brand asked for changes. It moved back to Making, and the words are in the notes.' : 'Nothing new from the brand yet.');
      onDone();
    },
  });
  if (!item.armyDeliverableId) return null;
  const tag = item.army ? (ARMY_TAG[item.army.status] ?? { tone: 'neutral' as TagTone, name: item.army.status }) : null;
  const err = (send.error ?? sync.error) as Error | null;
  return (
    <section className="mt-md rounded-tile bg-paper p-sm" aria-label="Army">
      <CardHead tag={tag && <StatusTag fit tone={tag.tone}>{tag.name}</StatusTag>}>
        <h3 className="m-0 text-headline">Army</h3>
      </CardHead>
      <p className="mt-xs m-0 text-subhead text-ink-soft">{COPY.armyLede}</p>
      {item.army?.feedback && (
        <p className="mt-xs m-0 whitespace-pre-wrap rounded-tile bg-card p-sm text-subhead">
          <Inert text={item.army.feedback} />
        </p>
      )}
      <div className="mt-xs flex flex-wrap gap-xs">
        <Button variant="outline" size="sm" onClick={() => send.mutate()} disabled={send.isPending || (!link.trim() && !item.link)}>
          Send this version to Army
        </Button>
        <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
          Take the brand&apos;s answer
        </Button>
      </div>
      {said && (
        <p role="status" className="mt-xs m-0 text-subhead">
          {said}
        </p>
      )}
      {err && (
        <p role="alert" className="mt-xs m-0 text-subhead">
          {err.message}
        </p>
      )}
    </section>
  );
}

/** Changes included in a piece: how many the client has used, and a way to give one more (or take one back). */
function Changes({ item, onDone, edit = true }: { item: AgencyDeliverable; onDone: () => void; edit?: boolean }) {
  const [said, setSaid] = useState('');
  const change = useMutation({
    mutationFn: (n: number) => api.agencyItemChanges(item.id, n),
    onSuccess: (r) => {
      setSaid(`Changes included are now ${r.allowed}.`);
      onDone();
    },
  });
  const left = Math.max(0, item.revisionsAllowed - item.revisions);
  return (
    <section className="mt-md rounded-tile bg-paper p-sm" aria-labelledby={`changes-${item.id}`}>
      <h3 id={`changes-${item.id}`} className="m-0 text-headline">
        Changes
      </h3>
      <p className="mt-xs m-0 text-subhead font-semibold">{`${changesLabel(item.revisions, item.revisionsAllowed)}${left === 0 ? '. None left' : ''}`}</p>
      <p className="mt-xs m-0 text-subhead text-ink-soft">{COPY.changesLede}</p>
      <ul className="mt-xs m-0 flex list-disc flex-col gap-xs pl-md text-caption text-ink-soft">
        {COPY.changesMore.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {edit && (
        <div className="mt-xs flex flex-wrap gap-xs">
          <Button variant="outline" size="sm" onClick={() => change.mutate(1)} disabled={change.isPending}>
            Add a change
          </Button>
          <Button variant="outline" size="sm" onClick={() => change.mutate(-1)} disabled={change.isPending || item.revisionsAllowed <= item.revisions}>
            Take one back
          </Button>
        </div>
      )}
      {said && (
        <p role="status" className="mt-xs m-0 text-subhead">
          {said}
        </p>
      )}
      {change.isError && (
        <p role="alert" className="mt-xs m-0 text-subhead">
          That did not save. Try again.
        </p>
      )}
    </section>
  );
}

/** The thread on a deliverable: yours, the client's and the brand's. */
function Thread({ itemId, onDone }: { itemId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const q = useAuthed(['agency', 'notes', itemId], () => api.agencyNotes(itemId));
  const [text, setText] = useState('');
  const [shared, setShared] = useState(false);
  const [forTeam, setForTeam] = useState(false);
  const { access, can } = useAgencyCan();
  const member = Boolean(access);
  // The owner may share a note with their team when they have one; a member's notes are always team notes.
  const teamQ = useAuthed(['agency', 'team', 'any'], () => api.agencyTeam('tmsize=10'), !member);
  const hasTeam = (teamQ.data?.members ?? []).some((m) => m.status === 'active');
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['agency', 'notes', itemId] });
    onDone();
  };
  const add = useMutation({
    mutationFn: () => api.agencyNoteAdd(itemId, text.trim(), !member && !forTeam && shared, !member && forTeam),
    onSuccess: () => {
      setText('');
      refresh();
    },
  });
  const del = useMutation({ mutationFn: (id: string) => api.agencyNoteRemove(id), onSuccess: refresh });
  const notes = q.data?.notes ?? [];
  return (
    <section className="mt-md" aria-labelledby={`thread-${itemId}`}>
      <h3 id={`thread-${itemId}`} className="m-0 text-headline">
        Notes
      </h3>
      <p className="mt-xs m-0 text-subhead text-ink-soft">{COPY.threadLede}</p>
      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
        {notes.map((n) => (
          <li key={n.id} className="rounded-tile bg-paper p-sm">
            <div className="flex flex-wrap items-center gap-xs">
              <StatusTag tone={AUTHOR_TONE[n.author]}>{n.author === 'team' && n.authorName ? (n.mine ? 'You, team note' : n.authorName) : n.author === 'client' && n.clientTeam ? "Client's team" : AGENCY_AUTHOR_NAME[n.author]}</StatusTag>
              {n.kind !== 'note' && <StatusTag tone={n.kind === 'change' ? 'warn' : n.kind === 'paid_change' ? 'bad' : 'neutral'}>{NOTE_KIND_NAME[n.kind]}</StatusTag>}
              {n.author === 'me' && <span className="text-caption text-ink-soft">{n.shared ? 'Shared with the client' : 'Private'}</span>}
              <span className="text-caption text-ink-mute">{prettyDate(n.createdAt.slice(0, 10))}</span>
              {(member ? n.author === 'team' && n.mine && can('pipeline', 'edit') : n.author === 'me' || n.author === 'team') && (
                <button type="button" onClick={() => del.mutate(n.id)} className="ml-auto min-h-[44px] px-xs text-caption text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                  Remove
                </button>
              )}
            </div>
            <p className="mt-xs m-0 whitespace-pre-wrap text-subhead">
              <Inert text={n.body} />
            </p>
          </li>
        ))}
        {notes.length === 0 && !q.isPending && <li className="text-subhead text-ink-mute">No notes yet.</li>}
      </ul>
      {(!member || can('pipeline', 'edit')) && (
      <form
        className="mt-xs"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (text.trim()) add.mutate();
        }}
      >
        <label className="block text-subhead font-semibold">
          Write a note
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={AGENCY_NOTE_MAX} className={FIELD} />
        </label>
        {!member && !forTeam && <Toggle compact on={shared} onChange={setShared} label="Share with the client" />}
        {!member && hasTeam && <Toggle compact on={forTeam} onChange={setForTeam} label="Share with your team" />}
        {member && <p className="mt-xs m-0 text-caption text-ink-soft">Your team sees this note. The client never does.</p>}
        {add.isError && (
          <p role="alert" className="m-0 text-subhead">
            That did not save. Try again.
          </p>
        )}
        <div className="mt-xs">
          <Button type="submit" size="sm" disabled={add.isPending || !text.trim()}>
            Add the note
          </Button>
        </div>
      </form>
      )}
    </section>
  );
}

/** A quick way to log time against this deliverable. */
function TimeLog({ item, onDone }: { item: AgencyDeliverable; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(todayLocal());
  const [billable, setBillable] = useState(true);
  const [note, setNote] = useState('');
  const [said, setSaid] = useState('');
  const minutes = parseMinutes(amount);
  const log = useMutation({
    mutationFn: () => api.agencyTimeAdd({ clientId: item.clientId, itemId: item.id, day, minutes, billable, note: note.trim() }),
    onSuccess: () => {
      setSaid(`Logged ${minutes} minutes.`);
      setAmount('');
      setNote('');
      onDone();
    },
  });
  return (
    <section className="mt-md" aria-labelledby={`time-${item.id}`}>
      <h3 id={`time-${item.id}`} className="m-0 text-headline">
        Time
      </h3>
      <p className="mt-xs m-0 text-subhead text-ink-soft">{COPY.timeLede}</p>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setSaid('');
          if (minutes > 0 && minutes <= AGENCY_MAX_MINUTES) log.mutate();
        }}
      >
        <div className="grid gap-sm md:grid-cols-2">
          <FieldLabel className="mt-sm" label="How long?">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="text" placeholder="1:30" className={FIELD} />
          </FieldLabel>
          <FieldLabel className="mt-sm" label="Day">
            <input type="date" value={day} max={todayLocal()} onChange={(e) => setDay(e.target.value)} className={FIELD} />
          </FieldLabel>
        </div>
        <FieldLabel className="mt-sm" label="What was it?">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className={FIELD} />
        </FieldLabel>
        <Toggle compact on={billable} onChange={setBillable} label="Counts as billable" />
        {log.isError && (
          <p role="alert" className="m-0 text-subhead">
            That did not save. Try again.
          </p>
        )}
        {said && (
          <p role="status" className="m-0 text-subhead">
            {said}
          </p>
        )}
        <div className="mt-xs">
          <Button type="submit" size="sm" disabled={log.isPending || minutes < 1 || minutes > AGENCY_MAX_MINUTES}>
            Log the time
          </Button>
        </div>
      </form>
    </section>
  );
}
