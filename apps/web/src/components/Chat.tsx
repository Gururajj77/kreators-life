import { characterTitle, hostName, type Host, type IconName } from '@kreators/shared';
import gsap from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router';
import { ArrowRight, ArrowUp, Check, Square } from 'lucide-react';
import { AppIcon } from './AppIcon';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { MoodFace } from './MoodFace';
import { Button } from './Button';
import { FocusPill } from './FocusPill';
import { StartOver } from './StartOver';
import { ThemeToggle } from './ThemeToggle';

gsap.registerPlugin(ScrollToPlugin);

/**
 * The one chat look, shared by the setup chat, the strategy session, the assistant and the Companion, drawn the
 * way ChatGPT and Claude draw theirs: the guide's lines as plain text under its name, the person's lines as
 * bubbles on the right, the choices right under the question, and the buttons under them (a skip on the left,
 * the main one on the right). Each new turn is lifted to the top of what scrolls, the page under its header or a
 * panel's own list, so the question and its choices are read at the top and nothing sits behind a bar.
 */

export interface ChatLine {
  id: number | string;
  from: 'bot' | 'you';
  /** Who says a guide's line: one of the seven, or Bumling when no one of them owns the subject. */
  host?: Host;
  text?: string;
  node?: ReactNode;
}

/** Who says the lines that are not one of the seven's, like the Companion's. */
export interface ChatVoice {
  name: string;
  /** The voice's badge, a shared icon key. */
  icon?: IconName;
}

export interface ChatChoice {
  value: string;
  label: string;
  /** A small icon before the label, a shared icon key. */
  icon?: IconName;
  /** A mood from 1 to 5: the choice wears that mood's face (moods are `MoodFace`, never emoji). */
  mood?: number;
  /** Takes a whole line of its own at the end of a row of pills (the setup chat's strategy session); the pills before it fill their lines. */
  row?: boolean;
  /** A line under the label turns the choice into a card; on a pick-some pill it sits small after the label. */
  blurb?: string;
}

export interface ChatChoiceGroup {
  label?: string;
  icon?: IconName;
  choices: ChatChoice[];
}

/** What sits before a choice's label: its mood face or its icon, never an emoji. */
function Mark({ c, size = 16 }: { c: { icon?: IconName; mood?: number }; size?: number }) {
  if (c.mood) return <MoodFace value={c.mood} size={size + 4} className="mr-xs inline-block align-[-5px]" />;
  if (c.icon) return <AppIcon name={c.icon} size={size} className="mr-xs inline-block align-[-3px]" />;
  return null;
}

/** How long a line takes to type: longer lines take longer, up to a cap. */
export const typingTime = (line: string | { node: ReactNode }) => (typeof line === 'string' ? Math.min(1800, 450 + line.length * 14) : 500);

/** A pill that is picked or not: soft until it is picked, then ink. */
export const chip = (on: boolean) => `toy min-h-[36px] md:min-h-[44px] tap-pad rounded-pill border-2 px-sm text-subhead font-medium disabled:opacity-60 ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`;

/** The person's line opens a turn; the guide's lines after it belong to that turn. */
function turnsOf(log: ChatLine[]): ChatLine[][] {
  const turns: ChatLine[][] = [];
  for (const m of log) {
    if (m.from === 'you' || turns.length === 0) turns.push([m]);
    else turns[turns.length - 1]!.push(m);
  }
  return turns;
}
export const countTurns = (log: ChatLine[]) => turnsOf(log).length;

function Badge({ voice }: { voice: ChatVoice }) {
  return (
    <span aria-hidden="true" className="flex size-[24px] shrink-0 items-center justify-center rounded-pill bg-card text-[14px] text-ink-soft shadow-toy-soft">
      {voice.icon ? <AppIcon name={voice.icon} size={14} /> : null}
    </span>
  );
}

function Lines({ lines, voice }: { lines: ChatLine[]; voice?: ChatVoice }) {
  return (
    <>
      {lines.map((m, i) => {
        if (m.from === 'you') {
          return (
            <div key={m.id} data-msg className="mt-md flex justify-end">
              <p className="m-0 max-w-[85%] whitespace-pre-wrap rounded-card bg-card px-md py-sm text-prose shadow-toy-soft">{m.text}</p>
            </div>
          );
        }
        const prev = lines[i - 1];
        const first = !prev || prev.from === 'you' || prev.host !== m.host;
        const own = !m.host && voice;
        return (
          <div key={m.id} data-msg className={first ? 'mt-md' : 'mt-xs'}>
            {first && (
              <p className="m-0 mb-xs flex items-center gap-xs text-caption text-ink-soft">
                {own ? <Badge voice={voice} /> : <Avatar relationship={m.host ?? 'bumling'} size={24} decorative still />}
                {own ? voice.name : characterTitle(m.host ?? 'bumling')}
              </p>
            )}
            {m.text ? <p className="m-0 whitespace-pre-wrap text-prose">{m.text}</p> : m.node}
          </div>
        );
      })}
    </>
  );
}

function Typing({ who, continued, status }: { who: Host | ChatVoice; continued: boolean; status?: ReactNode }) {
  const reduce = useReducedMotion();
  const dots = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = dots.current;
    if (!el) return;
    if (reduce) {
      gsap.set(el.children, { y: 0 });
      return;
    }
    const t = gsap.to(el.children, { y: -4, duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 0.12 });
    return () => {
      t.kill();
    };
  }, [reduce]);
  const name = typeof who === 'string' ? hostName(who) : who.name;
  return (
    // With a status line (a long job, see fx/WorkingLine) that line speaks for the row; the dots stay as they are.
    <div data-typing role={status ? undefined : 'status'} aria-label={status ? undefined : `${name} is typing`} className={`${continued ? 'mt-sm' : 'mt-md'} flex min-w-0 items-center gap-xs`}>
      {!continued && (typeof who === 'string' ? <Avatar relationship={who} size={24} decorative still /> : <Badge voice={who} />)}
      <span ref={dots} className="inline-flex items-center gap-[4px] py-xs" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block size-[8px] rounded-pill bg-ink-mute" />
        ))}
      </span>
      {status}
    </div>
  );
}

/** The answer under the question slides in once, when it first shows. */
function Answer({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!box.current) return;
    if (reduce) gsap.set(box.current, { opacity: 1, y: 0 });
    else gsap.fromTo(box.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
  }, [reduce]);
  return (
    <div ref={box} data-answer aria-live="off" className="mt-sm">
      {children}
    </div>
  );
}

/**
 * The typing box: grows with what is typed, Enter sends, Shift and Enter starts a new line. With `onStop`, while an
 * answer is on its way the send arrow becomes a Stop square (the assistant); `stopping` greys it once tapped.
 */
export function ChatComposer({
  placeholder,
  onSend,
  disabled,
  maxLength = 600,
  className = '',
  onStop,
  stopping = false,
}: {
  placeholder: string;
  onSend: (text: string) => void;
  disabled?: boolean;
  maxLength?: number;
  className?: string;
  onStop?: () => void;
  stopping?: boolean;
}) {
  const [text, setText] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);
  const send = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
  };
  return (
    <form
      data-composer
      className={`flex w-full items-end gap-xs ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <textarea
        ref={box}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        rows={1}
        maxLength={maxLength}
        enterKeyHint="send"
        data-autofocus
        aria-label={placeholder}
        placeholder={placeholder}
        className="min-h-[48px] flex-1 resize-none rounded-card border-2 border-line bg-card px-md py-sm text-body"
      />
      {onStop ? (
        <button type="button" aria-label={stopping ? 'Stopping' : 'Stop'} title={stopping ? 'Stopping' : 'Stop'} onClick={onStop} disabled={stopping} className="toy flex size-[48px] shrink-0 items-center justify-center rounded-pill bg-ink text-on-ink disabled:opacity-40">
          <Icon icon={Square} size={18} filled />
        </button>
      ) : (
        <button type="submit" aria-label="Send" disabled={disabled || !text.trim()} className="toy flex size-[48px] shrink-0 items-center justify-center rounded-pill bg-ink text-on-ink disabled:opacity-40">
          <Icon icon={ArrowUp} size={20} />
        </button>
      )}
    </form>
  );
}

/**
 * The buttons under an answer: a skip on the left when there is one, and the main button on the right, with a
 * few words after its label on what it sends (how many are picked). With `full` (the strategy session) the main
 * button fills the width. A label never breaks inside its button: when the two do not fit side by side, both
 * buttons take the full width, one above the other.
 */
export function ChatActions({
  skip,
  onSkip,
  next,
  extra,
  ready = true,
  onNext,
  submit = false,
  full = false,
}: {
  skip?: string;
  onSkip?: () => void;
  next: string;
  extra?: string;
  ready?: boolean;
  onNext?: () => void;
  /** The main button sends the form it sits in. */
  submit?: boolean;
  full?: boolean;
}) {
  // Whether the two buttons fit side by side, measured from their labels, so a stretched button never fools it.
  const row = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);
  useLayoutEffect(() => {
    const el = row.current;
    if (!el || !skip) {
      setStacked(false);
      return;
    }
    const natural = (btn: Element) => {
      const cs = getComputedStyle(btn);
      const kids = Array.from(btn.children);
      const inner = kids.reduce((a, k) => a + k.getBoundingClientRect().width, 0) + (parseFloat(cs.columnGap) || 0) * Math.max(0, kids.length - 1);
      return inner + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    };
    const check = () => {
      const [a, b] = Array.from(el.children);
      if (a && b) setStacked(natural(a) + (parseFloat(getComputedStyle(el).columnGap) || 0) + natural(b) > el.clientWidth + 0.5);
    };
    check();
    document.fonts?.ready.then(check).catch(() => {});
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [skip, next, extra, full]);
  return (
    <div ref={row} className={`mt-sm flex gap-sm ${stacked ? 'flex-col' : 'flex-wrap items-center'}`}>
      {skip && (
        <button type="button" onClick={onSkip} className={`toy toy-flat inline-flex min-h-[40px] md:min-h-[48px] tap-pad max-w-full items-center justify-center whitespace-nowrap rounded-pill border-2 border-line px-md text-headline ${stacked ? 'w-full' : 'shrink-0'}`}>
          <span>{skip}</span>
        </button>
      )}
      <Button type={submit ? 'submit' : 'button'} size={full ? 'lg' : 'md'} disabled={!ready} onClick={onNext} className={`max-w-full whitespace-nowrap ${stacked ? 'w-full' : full ? 'min-w-fit flex-1' : 'ml-auto'}`}>
        <span>{next}</span>
        {extra && <span className="text-subhead text-on-ink/70">· {extra}</span>}
        <Icon icon={ArrowRight} size={18} />
      </Button>
    </div>
  );
}

/**
 * One tap answers: pills, or cards when a choice has a line under it (two across on a laptop when `wide`). With
 * `full` (the strategy session) every choice is a button the width of the column, and numbers share one row.
 */
export function ChoiceChips({ choices, onPick, wide = false, full = false }: { choices: ChatChoice[]; onPick: (c: ChatChoice) => void; wide?: boolean; full?: boolean }) {
  const cards = choices.some((c) => c.blurb);
  if (full && !cards) {
    const numbers = choices.every((c) => c.label.length <= 2);
    return (
      <div role="group" aria-label="Your answer" className={numbers ? 'grid gap-xs' : 'flex flex-col gap-xs'} style={numbers ? { gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` } : undefined}>
        {choices.map((c) => (
          <button key={c.value} type="button" onClick={() => onPick(c)} className="toy toy-soft min-h-[40px] md:min-h-[48px] tap-pad w-full rounded-pill border-2 border-line bg-card px-sm text-headline">
            <Mark c={c} />
            {c.label}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div role="group" aria-label="Your answer" className={cards ? `grid grid-cols-1 gap-xs ${wide ? 'md:grid-cols-2' : ''}` : `flex flex-wrap gap-xs ${choices.some((c) => c.row) ? 'fill-row-all' : ''}`}>
      {choices.map((c) =>
        cards ? (
          <button key={c.value} type="button" onClick={() => onPick(c)} className="toy toy-flat w-full rounded-tile border-2 border-line bg-card p-sm text-left">
            <span className="block text-headline">
              <Mark c={c} />
              {c.label}
            </span>
            {c.blurb && <span className="block text-subhead text-ink-soft">{c.blurb}</span>}
          </button>
        ) : (
          <button key={c.value} type="button" onClick={() => onPick(c)} className={`toy toy-soft min-h-[36px] md:min-h-[44px] tap-pad rounded-pill border-2 border-line bg-card px-sm text-subhead font-medium ${c.row ? 'basis-full' : ''}`}>
            <Mark c={c} />
            {c.label}
          </button>
        ),
      )}
    </div>
  );
}

/**
 * Pick some: small labelled groups of pills, then the buttons. A locked choice is on and stays on. With a skip,
 * picking nothing is an answer too.
 */
export function ChoiceGroups({
  groups,
  picked,
  onPicked,
  locked = [],
  min = 1,
  max,
  done,
  skip,
  onDone,
  full = false,
}: {
  groups: ChatChoiceGroup[];
  /** What is ticked, kept by the chat so it survives a question typed in between. */
  picked: string[];
  onPicked: (next: string[]) => void;
  locked?: string[];
  min?: number;
  max?: number;
  done: string;
  skip?: string;
  onDone: (values: string[], labels: string[]) => void;
  /** The button fills the width (the strategy session). */
  full?: boolean;
}) {
  const setPicked = (f: (p: string[]) => string[]) => onPicked(f(picked.filter((v) => !locked.includes(v))));
  const all = groups.flatMap((g) => g.choices);
  const chosen = [...locked, ...picked.filter((v) => !locked.includes(v))];
  const atMax = max !== undefined && chosen.length >= max;
  const label = (v: string) => all.find((c) => c.value === v)?.label ?? v;
  return (
    <div role="group" aria-label="Pick what fits">
      {groups.map((g, gi) => (
        <div key={g.label ?? gi} className={gi === 0 ? '' : 'mt-sm'}>
          {g.label && (
            <p className="m-0 text-eyebrow uppercase text-ink-soft">
              <Mark c={g} size={14} />
              {g.label}
            </p>
          )}
          <div className={`${g.label ? 'mt-xs ' : ''}fill-row-all flex flex-wrap gap-xs`}>
            {g.choices.map((c) => {
              const on = chosen.includes(c.value);
              const fixed = locked.includes(c.value);
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={on}
                  disabled={fixed || (!on && atMax)}
                  onClick={() => setPicked((p) => (p.includes(c.value) ? p.filter((x) => x !== c.value) : [...p, c.value]))}
                  className={`${chip(on)} text-left`}
                >
                  {on ? <Icon icon={Check} size={16} strokeWidth={3} className="mr-xs inline-block align-[-3px]" /> : <Mark c={c} />}
                  {c.label}
                  {c.blurb && <span className={`ml-xs text-caption ${on ? 'text-on-ink/70' : 'text-ink-soft'}`}>{c.blurb}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {atMax && max !== undefined && max < all.length && <p className="mt-xs m-0 text-caption text-ink-soft">That's {max}, the most. Untick one to swap it.</p>}
      <ChatActions
        skip={skip}
        onSkip={() => onDone([], [])}
        next={done}
        extra={chosen.length ? `${chosen.length} picked` : undefined}
        ready={chosen.length >= min}
        onNext={() => onDone(chosen, chosen.map(label))}
        full={full}
      />
    </div>
  );
}

/** The small text links under an answer: Tell me more, Change my last answer. */
export function ChatLinks({ items }: { items: { label: string; onClick: () => void }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-sm flex flex-wrap items-center gap-md">
      {items.map((it) => (
        <button key={it.label} type="button" onClick={it.onClick} className="inline-flex min-h-[44px] items-center text-caption font-medium text-ink-soft underline underline-offset-4">
          {it.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The conversation: each turn opens with the person's line, and the last one carries the typing dots, a notice
 * and the answer. The last turn is at least `room` tall, so it can always be lifted to the top.
 */
export function ChatTurns({
  log,
  typing,
  voice,
  answer,
  answerKey,
  notice,
  room,
  lastTurn,
  typingStatus,
}: {
  log: ChatLine[];
  typing: Host | ChatVoice | null;
  /** A line beside the typing dots while a long job runs (the assistant's model call). */
  typingStatus?: ReactNode;
  voice?: ChatVoice;
  /** What the person answers with, under the last lines: choices, a card, or a short wait line, then its links. */
  answer?: ReactNode;
  /** Changes whenever a new ask shows, so its answer slides in once. */
  answerKey?: string | number;
  notice?: string | null;
  /** The last turn's least height, as CSS. */
  room: string;
  lastTurn: RefObject<HTMLElement | null>;
}) {
  const turns = turnsOf(log);
  const lastLine = log[log.length - 1];
  const continued = Boolean(typing && lastLine?.from === 'bot' && (typeof typing === 'string' ? lastLine.host === typing : !lastLine.host));
  // The transcript is a log (it reads as one, and screen readers hear each new line); the answer box inside it stays quiet.
  return (
    <div role="log" aria-live="polite" aria-label="Conversation" className="contents">
      {turns.map((t, i) => {
        const last = i === turns.length - 1;
        return (
          <section key={t[0]!.id} ref={last ? lastTurn : undefined} data-turn style={last ? { minHeight: room } : undefined} className="pt-xs pb-md">
            <Lines lines={t} voice={voice} />
            {last && typing && <Typing who={typing} continued={continued} status={typingStatus} />}
            {last && notice && (
              <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-subhead">
                {notice}
              </p>
            )}
            {last && answer && !typing && <Answer key={answerKey}>{answer}</Answer>}
          </section>
        );
      })}
    </div>
  );
}

/**
 * Moves a chat along. A new turn (an answer, a question typed, or a step taken back) is lifted to the top of what
 * scrolls: the window under a sticky header, or a panel's own list when `scroller` is given. A chat that starts
 * over goes back to the top. The newest line fades in.
 */
export function useChatMotion({ count, lines, lastTurn, root, scroller, head }: { count: number; lines: number; lastTurn: RefObject<HTMLElement | null>; root: RefObject<HTMLElement | null>; scroller?: RefObject<HTMLElement | null>; head?: RefObject<HTMLElement | null> }) {
  const reduce = useReducedMotion();
  const seen = useRef(0);
  useEffect(() => {
    const el = lastTurn.current;
    const box = scroller?.current ?? null;
    const before = seen.current;
    seen.current = count;
    const go = (y: number, smooth: boolean) => {
      if (smooth) gsap.to(box ?? window, { duration: 0.45, scrollTo: { y, autoKill: true }, ease: 'power2.out', overwrite: true });
      else (box ?? window).scrollTo(0, y);
    };
    if (count <= 1) {
      if (before > 1) go(0, false);
      return;
    }
    if (!el) return;
    // Two frames later: by then a typing box has shrunk back and the turn's height has caught up, so there is
    // room for the lift and the browser does not cut it short.
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        const base = box ? box.getBoundingClientRect().top - box.scrollTop : -window.scrollY;
        go(Math.max(0, el.getBoundingClientRect().top - base - (head?.current?.offsetHeight ?? 0) - 8), !reduce && before !== 0);
      });
    });
    return () => window.cancelAnimationFrame(frame);
    // The refs hold the same elements throughout; only a new turn moves the chat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, reduce]);

  useEffect(() => {
    const all = root.current?.querySelectorAll<HTMLElement>('[data-msg]');
    const last = all?.[all.length - 1];
    if (!last) return;
    if (reduce) gsap.set(last, { opacity: 1, y: 0 });
    else gsap.fromTo(last, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
  }, [lines, reduce, root]);
}

/** The card colour over the page's solid base: an opaque fill for the chat's header and typing box. */
const SOLID = 'linear-gradient(var(--card-strong), var(--card-strong)), var(--page-base-a)';

/** A whole-page chat: a slim header, the conversation, and the typing box at the bottom. Only the page scrolls. */
export function ChatScreen({
  title,
  step,
  progress,
  closeTo,
  onStartOver,
  log,
  typing,
  answer,
  answerKey,
  notice,
  composer,
}: {
  title: string;
  step?: string;
  /** 0 to 1. */
  progress?: number;
  closeTo: string;
  onStartOver?: () => void;
  log: ChatLine[];
  typing: Host | null;
  answer?: ReactNode;
  answerKey?: string | number;
  notice?: string | null;
  composer?: { placeholder: string; onSend: (text: string) => void; disabled?: boolean } | null;
}) {
  const head = useRef<HTMLElement>(null);
  const foot = useRef<HTMLElement>(null);
  const body = useRef<HTMLElement>(null);
  const lastTurn = useRef<HTMLElement>(null);
  const [room, setRoom] = useState(220);

  // The last turn is at least a screen tall, less the header and the typing box, so it can always be lifted up.
  useLayoutEffect(() => {
    const measure = () => setRoom((head.current?.offsetHeight ?? 0) + (foot.current?.offsetHeight ?? 0));
    measure();
    const ro = new ResizeObserver(measure);
    if (head.current) ro.observe(head.current);
    if (foot.current) ro.observe(foot.current);
    return () => ro.disconnect();
  }, []);
  useChatMotion({ count: countTurns(log), lines: log.length, lastTurn, root: body, head });

  return (
    <div className="min-h-dvh">
      {/* Fully opaque in both themes: the near-solid card colour laid over the page's own solid base, so no line of the
          chat shows through the header or the typing box as it scrolls under them. */}
      <header ref={head} data-top-bar="" className="safe-top sticky top-0 z-20" style={{ background: SOLID }}>
        {/* Start over on the left, Close and the theme on the right. On a phone the title and the step take a second
            line under the buttons, so they are never cut short; on a laptop they sit between them. */}
        <div className="mx-auto grid w-full max-w-[760px] grid-cols-[1fr_auto] items-center gap-x-xs gap-y-xs px-md py-sm md:grid-cols-[1fr_auto_1fr]">
          {/* A running or paused focus clock (lib/focusSession.ts) shows beside Start over, so it is never out of sight in a chat. */}
          <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-xs">
            {onStartOver && log.length > 1 && <StartOver onConfirm={onStartOver} />}
            <FocusPill compact />
          </div>
          <div className="col-span-2 col-start-1 row-start-2 min-w-0 text-left md:col-span-1 md:col-start-2 md:row-start-1">
            <p className="m-0 truncate text-subhead font-semibold">{title}</p>
            {step && <p className="m-0 truncate text-caption text-ink-soft">{step}</p>}
          </div>
          <div className="col-start-2 row-start-1 flex items-center justify-end gap-xs md:col-start-3">
            <Link to={closeTo} className="toy toy-soft inline-flex min-h-[44px] min-w-[44px] shrink-0 justify-center items-center rounded-pill bg-card px-sm text-subhead font-semibold">
              Close
            </Link>
            <ThemeToggle />
          </div>
        </div>
        {progress !== undefined && (
          <div className="h-[3px] w-full bg-line" aria-hidden="true">
            <div className="h-full bg-ink transition-[width] duration-500" style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }} />
          </div>
        )}
      </header>

      <main ref={body} className="mx-auto w-full max-w-[760px] px-md" aria-live="polite">
        <ChatTurns log={log} typing={typing} answer={answer} answerKey={answerKey} notice={notice} room={`calc(100dvh - ${room}px)`} lastTurn={lastTurn} />
      </main>

      <footer ref={foot} className="sticky bottom-0 z-20">
        <div className="h-md" style={{ background: 'linear-gradient(to top, var(--card-strong), transparent)' }} aria-hidden="true" />
        <div className="safe-bottom" style={{ background: SOLID }}>{composer ? <ChatComposer {...composer} className="mx-auto max-w-[760px] px-md pb-sm" /> : <div className="h-sm" />}</div>
      </footer>
    </div>
  );
}
