import { ATTENDEE_CLAIMS_PER_DAY, ATTENDEE_CODE_MAX, ATTENDEE_CODE_MIN, ATTENDEE_XP_DEFAULT, ATTENDEE_XP_MAX, attendeeXpLocked, attendeeXpProblem, codeProblem, normalizeCode, RELATIONSHIP_BY_KEY, type AttendeeCodeHost, type AttendeeCodeView } from '@kreators/shared';
import { useState, type ReactNode } from 'react';
import { useNow } from '../lib/useNow';
import { Button } from './Button';
import { useCelebrate } from './Celebration';
import { Nudge } from './Nudge';

/**
 * Attendee codes, drawn the same way in Party, Run and Circles. The host sets the guests’ xp before the event starts
 * and shows a code on the day (their own word, or a random one); the guests on the event’s list type it in once, inside
 * the event’s window, and get the xp. The rule lives in shared and on the server; this is only how it looks.
 */

const field = 'w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';

export interface CodeChange {
  xp?: number;
  code?: string;
  fresh?: boolean;
}

const say = (e: unknown) => (e instanceof Error ? e.message : 'That did not work. Try again.');
/** A time in the window, as the clock on the wall says it: "Sat 18:30". */
const clock = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });

function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="m-0 mt-xs rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
      {text}
    </p>
  );
}

/** What is wrong with the two create fields, if anything: the form waits until it is fixed. Empty xp means no code. */
export function attendeeProblem(xp: string, code: string): string | null {
  if (!xp.trim()) return null;
  return attendeeXpProblem(Number(xp)) ?? (code ? codeProblem(code) : null);
}

/** The two fields a create form adds: the guests’ xp (empty for none) and the host’s own code (empty for a random one). */
export function AttendeeFields({ xp, onXp, code, onCode, one = 'guest', many = 'guests', note }: { xp: string; onXp: (v: string) => void; code: string; onCode: (v: string) => void; one?: string; many?: string; note?: string }) {
  const problem = attendeeProblem(xp, code);
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="text-[14px] font-bold">Xp for each {one}, optional</legend>
      <p className="m-0 text-[12px] font-semibold text-ink-soft">
        Up to {ATTENDEE_XP_MAX}. It is fixed thirty minutes before the start, when the code opens. You show the code at the event, and only your {many} can use it, once each.
      </p>
      {note && <p className="m-0 mt-xs text-[12px] font-semibold text-ink-soft">{note}</p>}
      <div className="mt-xs grid grid-cols-2 gap-xs">
        <label className="block">
          <span className="block text-[12px] font-bold text-ink-soft">Xp</span>
          <input type="number" inputMode="numeric" min={1} max={ATTENDEE_XP_MAX} value={xp} onChange={(e) => onXp(e.target.value)} placeholder="None" className={`mt-xs ${field}`} />
        </label>
        <label className="block">
          <span className="block text-[12px] font-bold text-ink-soft">Your own code</span>
          <input value={code} onChange={(e) => onCode(normalizeCode(e.target.value))} minLength={ATTENDEE_CODE_MIN} maxLength={ATTENDEE_CODE_MAX} placeholder="Random" autoCapitalize="characters" className={`mt-xs ${field} uppercase placeholder:normal-case`} />
        </label>
      </div>
      <Problem text={problem} />
    </fieldset>
  );
}

/** What a create form sends: nothing when no xp was given. */
export const attendeeBody = (xp: string, code: string) => (Number(xp) > 0 ? { attendeeXp: Number(xp), ...(code ? { attendeeCode: code } : {}) } : {});

/**
 * The host’s card: the code to show at the event, the xp each guest gets, how many of the guests claimed it, and when
 * it works. The xp changes until the code opens, thirty minutes before the start; the code any time (a leaked code
 * gets replaced). With no code yet, the host sets the xp. The clock is the screen’s, so the card locks as it ticks.
 */
export function HostCodeCard({ value, startsAt, onSave, guests = 'guests', children }: { value: AttendeeCodeHost | null; startsAt: string; onSave: (change: CodeChange) => Promise<unknown>; guests?: string; children?: ReactNode }) {
  const now = useNow();
  const locked = attendeeXpLocked(startsAt, now);
  const [xp, setXp] = useState(String(value?.xp ?? ATTENDEE_XP_DEFAULT));
  const [own, setOwn] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const save = async (change: CodeChange) => {
    setBusy(true);
    setProblem(null);
    try {
      await onSave(change);
      setOwn('');
    } catch (e) {
      setProblem(say(e));
    } finally {
      setBusy(false);
    }
  };
  if (!value) {
    if (locked)
      return (
        <div className="rounded-card bg-card p-md shadow-toy-soft">
          <p className="m-0 text-[16px] font-extrabold">Attendee code</p>
          <p className="m-0 mt-xs text-[14px] font-semibold text-ink-soft">The xp is set up to thirty minutes before the start, and this event got none.</p>
        </div>
      );
    return (
      <div className="rounded-card bg-card p-md shadow-toy-soft">
        <p className="m-0 text-[16px] font-extrabold">Give your {guests} xp</p>
        <p className="m-0 mt-xs text-[14px] font-semibold text-ink-soft">
          Set it now, up to {ATTENDEE_XP_MAX}. It is fixed thirty minutes before the start, when the code opens. You show the code at the event, and only your {guests} can use it, once each.
        </p>
        <div className="mt-sm grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[12px] font-bold text-ink-soft">Xp each</span>
            <input type="number" inputMode="numeric" min={1} max={ATTENDEE_XP_MAX} value={xp} onChange={(e) => setXp(e.target.value)} className={`mt-xs ${field}`} />
          </label>
          <label className="block">
            <span className="block text-[12px] font-bold text-ink-soft">Your own code</span>
            <input value={own} onChange={(e) => setOwn(normalizeCode(e.target.value))} maxLength={ATTENDEE_CODE_MAX} placeholder="Random" autoCapitalize="characters" className={`mt-xs ${field} uppercase placeholder:normal-case`} />
          </label>
        </div>
        <Problem text={problem} />
        <Button className="mt-sm" full disabled={busy || !(Number(xp) >= 1)} onClick={() => void save({ xp: Number(xp), ...(own ? { code: own } : {}) })}>
          Make the code
        </Button>
      </div>
    );
  }
  return (
    <div className="rounded-card bg-card p-md shadow-toy-soft">
      <div className="flex items-center justify-between gap-sm">
        <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">Attendee code</p>
        <p className="m-0 shrink-0 rounded-pill bg-paper px-sm py-xs text-[14px] font-extrabold">+{value.xp} xp each</p>
      </div>
      {/* The code has the full width to itself, so a twelve-letter word fits on a phone without breaking. */}
      <p className="m-0 mt-xs font-display text-[28px] font-extrabold leading-tight tracking-wide [overflow-wrap:anywhere]">{value.code}</p>
      <p className="m-0 mt-sm text-[14px] font-bold">
        {value.claims} of {value.guests} {guests} claimed it
      </p>
      <p className="m-0 mt-xs text-[12px] font-semibold text-ink-soft">
        Show it at the event. It works from {clock(value.opensAt)} to {clock(value.closesAt)}.
      </p>
      {children}
      <div className="mt-sm grid grid-cols-[1fr_auto] gap-xs">
        <label className="block">
          <span className="sr-only">Xp each</span>
          <input type="number" inputMode="numeric" min={1} max={ATTENDEE_XP_MAX} value={xp} onChange={(e) => setXp(e.target.value)} disabled={locked || busy} aria-label="Xp each" className={field} />
        </label>
        <Button variant="outline" disabled={locked || busy || Number(xp) === value.xp || !(Number(xp) >= 1)} onClick={() => void save({ xp: Number(xp) })}>
          Set xp
        </Button>
      </div>
      {locked && <p className="m-0 mt-xs text-[12px] font-semibold text-ink-soft">The xp is fixed: the code is open.</p>}
      <div className="mt-xs grid grid-cols-[1fr_auto] gap-xs">
        <input value={own} onChange={(e) => setOwn(normalizeCode(e.target.value))} maxLength={ATTENDEE_CODE_MAX} placeholder="Your own code" aria-label="Your own code" autoCapitalize="characters" disabled={busy} className={`${field} uppercase placeholder:normal-case`} />
        <Button variant="outline" disabled={busy || own.length < ATTENDEE_CODE_MIN} onClick={() => void save({ code: own })}>
          Use it
        </Button>
      </div>
      <Button variant="ghost" className="mt-xs" disabled={busy} onClick={() => void save({ fresh: true })}>
        New random code
      </Button>
      <Problem text={problem} />
    </div>
  );
}

/**
 * The guest’s box: the xp the host set, and the code to type at the event. It says when the code works, from the
 * screen’s own clock so the box opens on time on a page left open, and that it was claimed once it was. Never shows
 * the code itself: the host shows that.
 */
export function ClaimCard({ view, onClaim }: { view: AttendeeCodeView; onClaim: (code: string) => Promise<{ xp: number; newBadges: string[] }> }) {
  const now = useNow();
  const state = now < Date.parse(view.opensAt) ? 'early' : now > Date.parse(view.closesAt) ? 'closed' : 'open';
  const celebrate = useCelebrate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const claim = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const r = await onClaim(code);
      celebrate({ title: 'You came, you got it', totalXp: r.xp, newBadges: r.newBadges, color: RELATIONSHIP_BY_KEY.friendship.color });
      setCode('');
    } catch (e) {
      setProblem(say(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-card bg-card p-md shadow-toy-soft">
      <div className="flex items-center justify-between gap-sm">
        <p className="m-0 text-[16px] font-extrabold">{view.claimed ? 'You got the xp for coming' : 'Got the code?'}</p>
        <p className="m-0 shrink-0 rounded-pill bg-paper px-sm py-xs text-[14px] font-extrabold">{view.claimed ? '✓ ' : '+'}{view.xp} xp</p>
      </div>
      {view.claimed ? (
        <p className="m-0 mt-xs text-[14px] font-semibold text-ink-soft">It is in your xp. A code counts once per person.</p>
      ) : state === 'early' ? (
        <p className="m-0 mt-xs text-[14px] font-semibold text-ink-soft">The host shows a code at the event. It works from {clock(view.opensAt)}.</p>
      ) : state === 'closed' ? (
        <p className="m-0 mt-xs text-[14px] font-semibold text-ink-soft">The code closed at {clock(view.closesAt)}.</p>
      ) : (
        <form
          className="mt-sm grid grid-cols-[1fr_auto] gap-xs"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length >= ATTENDEE_CODE_MIN && !busy) void claim();
          }}
        >
          <input value={code} onChange={(e) => setCode(normalizeCode(e.target.value))} maxLength={ATTENDEE_CODE_MAX} placeholder="The host's code" aria-label="The host's code" autoCapitalize="characters" autoComplete="off" className={`${field} uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal`} />
          <Button type="submit" disabled={busy || code.length < ATTENDEE_CODE_MIN}>
            Get {view.xp} xp
          </Button>
        </form>
      )}
      {!view.claimed && state === 'open' && <p className="m-0 mt-xs text-[12px] font-semibold text-ink-soft">It works until {clock(view.closesAt)}.</p>}
      <Problem text={problem} />
      {!view.claimed && <Nudge className="mt-xs" text={`For guests on the list, once each, up to ${ATTENDEE_CLAIMS_PER_DAY} events in 24 hours.`} />}
    </div>
  );
}
