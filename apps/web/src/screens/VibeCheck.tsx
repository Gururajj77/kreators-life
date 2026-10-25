import {
  firstQuestionId,
  FOCUS_OPTIONS,
  isRelationshipKey,
  KIND_META,
  ladderOptions,
  nextQuestionId,
  QUESTION_BY_ID,
  RELATIONSHIPS,
  RELATIONSHIP_BY_KEY,
  type Answers,
  KINDS,
  type LadderPicks,
  type NodeKind,
  type OnboardingResponse,
  type Question,
  type RelationshipKey,
} from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import gsap from 'gsap';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { InterestPicker } from '../components/InterestPicker';
import { useNavigate, useSearchParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { OnboardingTroupe } from '../components/OnboardingTroupe';
import { Pyramid } from '../components/Pyramid';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useMe, useRefreshAll } from '../lib/queries';

const STEPS_PER_FLOOR = 3;
const STEP_OF_ROLE = { gauge: 1, probe: 2, foundation: 3 } as const;

type Stage =
  | { kind: 'intro' }
  | { kind: 'floors' }
  | { kind: 'question'; id: string; history: string[] }
  | { kind: 'reveal'; result: OnboardingResponse }
  | { kind: 'learn'; result: OnboardingResponse }
  | { kind: 'about'; result: OnboardingResponse }
  | { kind: 'ladders'; result: OnboardingResponse };

/** The floors in tower order. */
const ordered = (keys: RelationshipKey[]) => RELATIONSHIPS.filter((r) => keys.includes(r.key)).map((r) => r.key);

export function VibeCheck() {
  const me = useMe();
  const nav = useNavigate();
  const refresh = useRefreshAll();
  const [params] = useSearchParams();
  // One floor at a time, from the Tower: skip the intro and only ask that floor.
  const single = isRelationshipKey(params.get('floor')) ? (params.get('floor') as RelationshipKey) : null;
  const [floors, setFloors] = useState<RelationshipKey[]>(single ? [single] : []);
  const [stage, setStage] = useState<Stage>(single ? { kind: 'question', id: firstQuestionId(single), history: [] } : { kind: 'intro' });
  const [name, setName] = useState('');
  const [focus, setFocus] = useState('');
  const [answers, setAnswers] = useState<Answers>({});
  // One answer per question. Taps that land while the next question slides in are ignored.
  const advancing = useRef(false);

  const onboard = useMutation({
    mutationFn: (final: Answers) =>
      api.onboard({
        answers: Object.entries(final).map(([questionId, value]) => ({ questionId, value })),
        displayName: name || me.data?.user.displayName,
        focus: focus || me.data?.user.focus,
      }),
    onSuccess: (result) => {
      refresh();
      advancing.current = false;
      setStage(single ? { kind: 'ladders', result } : { kind: 'reveal', result });
    },
    onError: () => {
      advancing.current = false;
    },
  });

  // The flow branches: where we go depends on what was just answered.
  const answer = (q: Question, value: number, history: string[]) => {
    if (advancing.current) return;
    advancing.current = true;
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    window.setTimeout(() => {
      const nextId = nextQuestionId(q, value) ?? (() => {
        // Only the floors the person chose are asked about.
        const floor = floors[floors.indexOf(q.relationship) + 1];
        return floor ? firstQuestionId(floor) : null;
      })();
      if (nextId) {
        setStage({ kind: 'question', id: nextId, history: [...history, q.id] });
        window.setTimeout(() => {
          advancing.current = false;
        }, 320);
      } else {
        onboard.mutate(next);
      }
    }, 260);
  };

  if (stage.kind === 'intro') {
    return (
      <Screen tabs={false}>
        <div className="pt-xl">
          <Avatar relationship="self" size={88} />
          <h1 className="mt-md text-[36px]">Quick vibe check</h1>
          <p className="mt-sm text-[16px] font-semibold text-ink-soft">
            A few taps, no typing. Each character asks three things, then asks you to pick one thing you will not let break. The rest is built from that.
          </p>
        </div>
        <form
          className="mt-lg flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            setStage({ kind: 'floors' });
          }}
        >
          <label className="block">
            <span className="block text-[14px] font-bold">What should the characters call you?</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Your name or handle"
              autoComplete="nickname"
              className="mt-xs w-full rounded-tile border-2 border-line bg-card px-sm py-sm text-[16px]"
            />
          </label>
          <fieldset className="m-0 border-0 p-0">
            <legend className="text-[14px] font-bold">What fills most of your days?</legend>
            <div className="mt-xs flex flex-wrap gap-xs">
              {FOCUS_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={focus === t}
                  onClick={() => setFocus(t)}
                  className={`rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${focus === t ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </fieldset>
          <Button type="submit" size="lg" full>
            Start
          </Button>
          <p className="m-0 text-center text-[14px] font-semibold text-ink-mute">Both optional. You can change them later.</p>
        </form>
      </Screen>
    );
  }

  if (stage.kind === 'floors') {
    return (
      <PickFloors
        chosen={floors}
        onChange={setFloors}
        onBack={() => setStage({ kind: 'intro' })}
        onNext={() => {
          const list = ordered(floors);
          setFloors(list);
          setStage({ kind: 'question', id: firstQuestionId(list[0]!), history: [] });
        }}
      />
    );
  }

  if (stage.kind === 'question') {
    const q = QUESTION_BY_ID[stage.id];
    if (!q) return null;
    const prev = stage.history[stage.history.length - 1];
    return (
      <QuestionStage
        q={q}
        floors={floors}
        value={answers[q.id]}
        saving={onboard.isPending}
        error={onboard.isError ? 'Could not save your answers. Try the last one again.' : null}
        onAnswer={(v) => answer(q, v, stage.history)}
        onBack={() => setStage(prev ? { kind: 'question', id: prev, history: stage.history.slice(0, -1) } : single ? { kind: 'question', id: stage.id, history: [] } : { kind: 'floors' })}
      />
    );
  }

  if (stage.kind === 'reveal') {
    return <Reveal result={stage.result} onNext={() => setStage({ kind: 'learn', result: stage.result })} />;
  }

  if (stage.kind === 'learn') {
    return <Learn result={stage.result} floors={floors} onNext={() => setStage({ kind: 'about', result: stage.result })} />;
  }

  if (stage.kind === 'about') {
    return <AboutYou onNext={() => setStage({ kind: 'ladders', result: stage.result })} />;
  }

  return <Ladders result={stage.result} floors={floors} onDone={() => nav(single ? `/realm/${single}` : '/tower', { replace: true })} />;
}

/** Which floors to work on now. The rest can be answered later from the Tower. */
function PickFloors({ chosen, onChange, onBack, onNext }: { chosen: RelationshipKey[]; onChange: (k: RelationshipKey[]) => void; onBack: () => void; onNext: () => void }) {
  return (
    <Screen tabs={false}>
      <div className="pt-md">
        <button type="button" onClick={onBack} className="rounded-pill px-sm py-xs text-[14px] font-bold text-ink-soft">
          Back
        </button>
        <h1 className="mt-md text-[36px]">Which relationships need work right now?</h1>
        <p className="mt-sm text-[16px] font-semibold text-ink-soft">Pick the areas you want to start with. Each one asks three questions. The others wait under Areas until you are ready for them.</p>
      </div>
      <ul className="mt-lg flex list-none flex-col gap-xs p-0 m-0 pb-2xl">
        {RELATIONSHIPS.map((r) => {
          const on = chosen.includes(r.key);
          return (
            <li key={r.key}>
              <CheckRow
                checked={on}
                onToggle={() => onChange(on ? chosen.filter((k) => k !== r.key) : [...chosen, r.key])}
                title={r.name}
                subtitle={`${r.character} asks three questions.`}
                color={r.color}
                deep={`var(--deep-${r.key})`}
                text={r.text}
                aside={<Avatar relationship={r.key} size={44} mood={on ? 'excited' : 'sleepy'} decorative className="self-center" />}
              />
            </li>
          );
        })}
      </ul>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card p-md">
        <div className="mx-auto max-w-[480px]">
          <Button size="lg" full disabled={chosen.length === 0} onClick={onNext}>
            {chosen.length === 0 ? 'Pick at least one floor' : `Ask me about ${chosen.length} ${chosen.length === 1 ? 'floor' : 'floors'}`}
          </Button>
        </div>
      </div>
    </Screen>
  );
}

function QuestionStage({
  q,
  floors,
  value,
  saving,
  error,
  onAnswer,
  onBack,
}: {
  q: Question;
  floors: RelationshipKey[];
  value: number | undefined;
  saving: boolean;
  error: string | null;
  onAnswer: (v: number) => void;
  onBack: () => void;
}) {
  const reduce = useReducedMotion();
  const rel = RELATIONSHIP_BY_KEY[q.relationship];
  const step = STEP_OF_ROLE[q.role];
  const at = floors.indexOf(q.relationship);
  const asks = q.role === 'foundation' ? `${rel.character} needs a foundation` : `${rel.character} asks`;
  return (
    <div className="min-h-dvh pb-2xl" style={{ background: `var(--soft-${rel.key})` }}>
      <Screen tabs={false}>
        <div className="pt-md">
          <div className="flex items-center justify-between gap-sm pr-xl">
            <button type="button" onClick={onBack} className="rounded-pill px-sm py-xs text-[14px] font-bold text-ink-soft">
              Back
            </button>
            <span className="text-[14px] font-bold text-ink-soft">
              Area {at + 1} of {floors.length}, step {step} of {STEPS_PER_FLOOR}
            </span>
          </div>
          <ol className="mt-sm flex list-none gap-xs p-0 m-0" aria-hidden="true">
            {floors.map((k, i) => {
              const r = RELATIONSHIP_BY_KEY[k];
              const fill = i < at ? 1 : i === at ? step / STEPS_PER_FLOOR : 0;
              return (
                <li key={k} className="h-[8px] flex-1 overflow-hidden rounded-pill" style={{ background: 'color-mix(in oklab, var(--color-ink) 12%, transparent)' }}>
                  <span className="block h-full rounded-pill" style={{ width: `${fill * 100}%`, background: r.color }} />
                </li>
              );
            })}
          </ol>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={q.id}
            initial={{ opacity: 0, x: reduce ? 0 : 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduce ? 0 : -40 }}
            transition={{ duration: 0.22 }}
          >
            <div className="mt-lg flex items-end gap-sm">
              <Avatar relationship={q.relationship} size={84} mood={value === undefined ? 'neutral' : 'excited'} decorative />
              <div className="flex-1 rounded-card rounded-bl-[8px] bg-card p-md shadow-toy-soft">
                <p className="m-0 text-[14px] font-bold" style={{ color: `var(--deep-${rel.key})` }}>
                  {asks}
                </p>
                <h1 className="mt-xs text-[24px] leading-tight">{q.prompt}</h1>
              </div>
            </div>

            <div className="mt-lg" role="group" aria-label="Your answer">
              {q.format === 'pick' && q.options && (
                <div className="flex flex-col gap-sm">
                  {q.options.map((o, i) => (
                    <button
                      key={o.label}
                      type="button"
                      aria-pressed={value === i}
                      onClick={() => onAnswer(i)}
                      className="toy toy-soft flex w-full items-center gap-sm rounded-card border-[3px] bg-card p-md text-left"
                      style={{ borderColor: value === i ? rel.color : 'transparent' }}
                    >
                      <span className="text-[30px]" aria-hidden="true">
                        {o.emoji}
                      </span>
                      <span className="text-[18px] font-bold leading-tight">{o.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {q.format === 'scale' && q.scale && (
                <div className="grid grid-cols-5 gap-xs">
                  {q.scale.labels.map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={value === i}
                      onClick={() => onAnswer(i)}
                      className="toy toy-soft flex min-h-[88px] flex-col items-center justify-end gap-xs rounded-tile bg-card p-xs text-center text-[12px] font-bold leading-tight"
                      style={value === i ? { background: rel.color, color: rel.text } : undefined}
                    >
                      <span
                        className="block rounded-pill"
                        style={{ width: 12 + i * 5, height: 12 + i * 5, background: value === i ? rel.text : rel.color }}
                        aria-hidden="true"
                      />
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {q.format === 'yesno' && (
                <div className="grid grid-cols-2 gap-sm">
                  <Button variant="color" color={rel.color} deep={`var(--deep-${rel.key})`} size="lg" style={{ color: rel.text }} aria-pressed={value === 1} onClick={() => onAnswer(1)}>
                    Yes
                  </Button>
                  <Button variant="outline" size="lg" aria-pressed={value === 0} onClick={() => onAnswer(0)}>
                    Not yet
                  </Button>
                </div>
              )}
            </div>
            {q.role === 'foundation' && (
              <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">
                This becomes the base of {rel.character}&rsquo;s pyramid. The rule, the feeling, the proof, the project and the first tasks come from it.
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {saving && (
          <p className="mt-lg text-center text-[14px] font-bold text-ink-soft" role="status">
            Painting your rainbow
          </p>
        )}
        {error && (
          <p role="alert" className="mt-lg rounded-tile bg-card p-sm text-[14px] font-bold">
            {error}
          </p>
        )}
      </Screen>
      <OnboardingTroupe floors={floors} current={q.relationship} step={step} steps={STEPS_PER_FLOOR} />
    </div>
  );
}

function Reveal({ result, onNext }: { result: OnboardingResponse; onNext: () => void }) {
  const reduce = useReducedMotion();
  const floors = [...RELATIONSHIPS].sort((a, b) => b.floor - a.floor);
  const asked = new Set(result.answered);
  return (
    <Screen tabs={false}>
      <div className="pt-xl">
        <h1 className="text-[36px]">Your rainbow</h1>
        <p className="mt-sm text-[16px] font-semibold text-ink-soft">
          How your relationships look today. A short bar is not bad news. It is where the easy wins are.
        </p>
      </div>
      <ol className="mt-lg flex list-none flex-col gap-sm p-0 m-0">
        {floors.map((r, i) => {
          const score = result.scores[r.key];
          if (!asked.has(r.key)) {
            return (
              <li key={r.key} className="flex items-center gap-sm opacity-60">
                <Avatar relationship={r.key} size={40} still decorative mood="sleepy" />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-[14px] font-bold">
                    <span>{r.name}</span>
                    <span className="text-ink-soft">not asked yet</span>
                  </div>
                  <div className="mt-xs h-[16px] w-full rounded-pill border-2 border-dashed border-line" aria-hidden="true" />
                </div>
              </li>
            );
          }
          return (
            <li key={r.key} className="flex items-center gap-sm">
              <Avatar relationship={r.key} size={40} still decorative />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-[14px] font-bold">
                  <span>{r.name}</span>
                  <span>{score}%</span>
                </div>
                <div className="mt-xs h-[16px] w-full overflow-hidden rounded-pill bg-card shadow-toy-soft" aria-hidden="true">
                  <motion.div
                    className="h-full rounded-pill"
                    style={{ background: r.color }}
                    initial={{ width: reduce ? `${Math.max(6, score)}%` : 0 }}
                    animate={{ width: `${Math.max(6, score)}%` }}
                    transition={{ delay: reduce ? 0 : 0.2 + i * 0.1, duration: reduce ? 0 : 0.7, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <Button size="lg" full className="mt-lg" onClick={onNext}>
        What this builds
      </Button>
    </Screen>
  );
}

function Ladders({ result, floors: asked, onDone }: { result: OnboardingResponse; floors: RelationshipKey[]; onDone: () => void }) {
  const refresh = useRefreshAll();
  const [chosen, setChosen] = useState<RelationshipKey[]>(asked);
  const [picks, setPicks] = useState<LadderPicks>({});
  const [error, setError] = useState<string | null>(null);
  const floors = [...RELATIONSHIPS].filter((r) => asked.includes(r.key)).sort((a, b) => b.floor - a.floor);
  const pick = (key: RelationshipKey, field: 'valueGoal' | 'project', v: string) => setPicks((p) => ({ ...p, [key]: { ...p[key], [field]: v } }));

  const build = useMutation({
    mutationFn: () => api.build(chosen, todayLocal(), picks),
    onSuccess: async () => {
      await refresh();
      onDone();
    },
    onError: () => setError('Could not set up your areas. Try again.'),
  });

  return (
    <Screen tabs={false}>
      <div className="pt-xl">
        <h1 className="text-[36px]">Built from your answers</h1>
        <p className="mt-sm text-[16px] font-semibold text-ink-soft">
          Each area took the foundation you picked and worked out the rest. Before you tick an area, choose the feeling and the project you want it to start with, or write your own.
        </p>
      </div>
      <ol className="mt-lg flex list-none flex-col gap-md p-0 m-0">
        {floors.map((r) => {
          const l = result.ladders[r.key];
          const on = chosen.includes(r.key);
          const rows: [string, string][] = [
            [KIND_META.principle.label, l.principle],
            [KIND_META.outcome.label, l.outcome],
          ];
          const opts = ladderOptions(r.key);
          const mine = picks[r.key] ?? {};
          return (
            <li key={r.key} className="rounded-card p-md" style={{ background: `var(--soft-${r.key})` }}>
              <div className="flex items-start gap-sm">
                <Avatar relationship={r.key} size={56} mood={on ? 'excited' : 'neutral'} decorative />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[14px] font-bold" style={{ color: `var(--deep-${r.key})` }}>
                    {r.character}, {result.scores[r.key]}%, {l.branch === 'low' ? 'gentle start' : 'stretch tasks'}
                  </p>
                  <h2 className="mt-xs text-[24px]">{l.pillar}</h2>
                </div>
              </div>
              <dl className="mt-sm m-0 grid grid-cols-[auto_1fr] gap-x-sm gap-y-xs text-[14px]">
                {rows.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="font-bold" style={{ color: `var(--deep-${r.key})` }}>
                      {k}
                    </dt>
                    <dd className="m-0 font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <Picker label={KIND_META.value_goal.label} options={opts.valueGoals} chosen={mine.valueGoal ?? l.valueGoal} color={r.color} deep={`var(--deep-${r.key})`} onPick={(v) => pick(r.key, 'valueGoal', v)} />
              <Picker label={KIND_META.project.label} options={opts.projects} chosen={mine.project ?? l.project} color={r.color} deep={`var(--deep-${r.key})`} onPick={(v) => pick(r.key, 'project', v)} />
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0 text-[14px] font-semibold">
                {l.tasks.map((t) => (
                  <li key={t} className="flex gap-xs">
                    <span className="mt-xs size-[8px] shrink-0 rounded-pill" style={{ background: r.color }} aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="mt-md">
                <CheckRow
                  checked={on}
                  onToggle={() => setChosen((a) => (on ? a.filter((k) => k !== r.key) : [...a, r.key]))}
                  title={`Set up ${r.character}’s area`}
                  subtitle={on ? 'Ticked. It will be set up.' : 'Tick to set it up too.'}
                  color={r.color}
                  deep={`var(--deep-${r.key})`}
                  text={r.text}
                />
              </div>
            </li>
          );
        })}
      </ol>
      {error && (
        <p role="alert" className="mt-md rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          {error}
        </p>
      )}
      <Button size="lg" full className="mt-lg" onClick={() => build.mutate()} disabled={build.isPending || chosen.length === 0}>
        {build.isPending ? 'Setting up' : `Set up ${chosen.length} ${chosen.length === 1 ? 'area' : 'areas'}`}
      </Button>
      <Button variant="ghost" full className="mt-xs" onClick={onDone} disabled={build.isPending}>
        Start with nothing set up
      </Button>
    </Screen>
  );
}


/** Interests and place, so circles can seat you with people nearby whose work fits yours. */
function AboutYou({ onNext }: { onNext: () => void }) {
  const refresh = useRefreshAll();
  const [interests, setInterests] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const save = useMutation({
    mutationFn: () => api.updateMe({ interests, city, area, lat: coords?.lat ?? null, lng: coords?.lng ?? null }),
    onSuccess: async () => {
      await refresh();
      onNext();
    },
  });
  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: Math.round(pos.coords.latitude * 1000) / 1000, lng: Math.round(pos.coords.longitude * 1000) / 1000 });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  };
  return (
    <Screen tabs={false}>
      <div className="pt-xl">
        <Avatar relationship="friendship" size={88} />
        <h1 className="mt-md text-[36px]">What are you into?</h1>
        <p className="mt-sm text-[16px] font-semibold text-ink-soft">Pick up to ten and add your city. Circles seat you with people nearby whose interests fit yours: the same ones, or pairs that gel, like the writer with the film maker.</p>
      </div>
      <form
        className="mt-lg flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <InterestPicker legend="Interests, pick two or more" value={interests} onChange={setInterests} />
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">City</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} placeholder="Bengaluru" autoComplete="address-level2" className="mt-xs w-full rounded-tile border-2 border-line bg-card px-sm py-sm text-[16px]" />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Area (optional)</span>
            <input value={area} onChange={(e) => setArea(e.target.value)} maxLength={80} placeholder="Indiranagar" className="mt-xs w-full rounded-tile border-2 border-line bg-card px-sm py-sm text-[16px]" />
          </label>
        </div>
        <button type="button" onClick={locate} disabled={locating || coords !== null} className="toy toy-soft inline-flex min-h-[48px] items-center justify-center rounded-pill bg-card px-md text-[14px] font-bold disabled:opacity-60">
          {coords ? 'Position saved for nearby matching' : locating ? 'Finding you' : 'Use my position for nearby matching (optional)'}
        </button>
        <p className="m-0 text-[12px] font-semibold text-ink-mute">Your position stays on the server and is only used to keep tables within twenty kilometres. Nobody sees it.</p>
        {save.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            Could not save. Try again.
          </p>
        )}
        <Button type="submit" size="lg" full disabled={save.isPending}>
          {interests.length >= 2 && city.trim() ? 'Save and set up my areas' : 'Skip for now'}
        </Button>
      </form>
    </Screen>
  );
}


/** A few options as chips, plus a line to write your own. The chosen one is filled in the floor's colour. */
function Picker({ label, options, chosen, color, deep, onPick }: { label: string; options: string[]; chosen: string; color: string; deep: string; onPick: (v: string) => void }) {
  const custom = !options.includes(chosen);
  const [own, setOwn] = useState(custom ? chosen : '');
  return (
    <div className="mt-sm">
      <p className="m-0 text-[14px] font-bold" style={{ color: deep }}>
        {label}
      </p>
      <div className="mt-xs flex flex-wrap gap-xs" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o} type="button" aria-pressed={chosen === o} onClick={() => onPick(o)} className="toy toy-soft rounded-pill border-2 px-sm py-xs text-left text-[14px] font-bold" style={chosen === o ? { background: color, borderColor: color, color: 'var(--color-on-fill)' } : { background: 'var(--color-card)', borderColor: 'transparent' }}>
            {o}
          </button>
        ))}
      </div>
      <input
        value={own}
        onChange={(e) => {
          setOwn(e.target.value);
          if (e.target.value.trim()) onPick(e.target.value.trim());
          else onPick(options[0] ?? '');
        }}
        maxLength={120}
        placeholder="Or write your own"
        aria-label={`Your own ${label.toLowerCase()}`}
        className="mt-xs w-full rounded-tile border-2 border-line bg-card px-sm py-xs text-[14px] font-semibold"
      />
    </div>
  );
}


/**
 * After the answers, before the build. The pyramid sits on top and can be tapped; one card at a time
 * sits under it, so nothing lands on the reader all at once. Results first, then what each layer is,
 * then the one rule it will not work without, then what to expect.
 */
function Learn({ result, floors, onNext }: { result: OnboardingResponse; floors: RelationshipKey[]; onNext: () => void }) {
  const weakest = [...floors].sort((a, b) => result.scores[a] - result.scores[b])[0] ?? floors[0] ?? 'self';
  const rel = RELATIONSHIP_BY_KEY[weakest];
  const l = result.ladders[weakest];
  const words: Partial<Record<NodeKind, string>> = { pillar: l.pillar, principle: l.principle, value_goal: l.valueGoal, outcome: l.outcome, project: l.project, task: l.tasks[0] ?? 'Your first task' };
  const slides: { key: string; layer?: NodeKind; eyebrow: string; title: string; body: ReactNode }[] = [
    ...KINDS.map((k) => ({
      key: k,
      layer: k,
      eyebrow: `Layer ${KIND_META[k].rung} of 6`,
      title: KIND_META[k].label,
      body: (
        <>
          <p className="m-0 text-[16px] font-semibold text-ink-soft">{KIND_META[k].explain}</p>
          <p className="mt-sm m-0 rounded-tile p-sm text-[16px] font-bold" style={{ background: `var(--soft-${rel.key})` }}>
            Yours: {words[k]}
          </p>
        </>
      ),
    })),
    {
      key: 'not',
      eyebrow: 'What this is',
      title: 'Not a to-do list',
      body: <p className="m-0 text-[16px] font-semibold text-ink-soft">Most apps start with tasks. Tasks fade in a week. It is not a to-do list and it is not a mood app. It is a pyramid for each area of your life, and every task has a base under it.</p>,
    },
    {
      key: 'rule',
      eyebrow: 'The one rule',
      title: 'It will not work unless',
      body: <p className="m-0 text-[16px] font-semibold text-ink-soft">You tick one task a day. Tick the tip, and the whole pyramid gets stronger. Miss a week, and nothing moves. That is the only rule.</p>,
    },
    {
      key: 'expect',
      eyebrow: 'What to expect',
      title: 'Four places',
      body: (
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {[
            ['☀️', 'Daily', 'Three boxes a day: check in, one small act, one task.'],
            ['🏰', 'Areas', 'One pyramid per relationship. Tap an area to see it or change it.'],
            ['🏠', 'Home', 'Your numbers first, then where to go next.'],
            ['🧩', 'Apps', 'Switch on only what you need.'],
          ].map(([emoji, name, line]) => (
            <li key={name} className="flex items-center gap-sm">
              <span className="flex size-[36px] shrink-0 items-center justify-center rounded-pill bg-paper text-[18px]" aria-hidden="true">
                {emoji}
              </span>
              <span className="min-w-0 text-[14px] font-semibold text-ink-soft">
                <span className="font-bold text-ink">{name}. </span>
                {line}
              </span>
            </li>
          ))}
        </ul>
      ),
    },
  ];
  const [at, setAt] = useState(0);
  const slide = slides[at]!;
  const card = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = card.current;
    if (!el || reduce) return;
    gsap.fromTo(el, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' });
  }, [at, reduce]);
  const last = at === slides.length - 1;

  return (
    <Screen tabs={false}>
      <div className="pt-xl">
        <p className="m-0 text-[14px] font-extrabold uppercase tracking-wide" style={{ color: `var(--deep-${rel.key})` }}>
          Result
        </p>
        <h1 className="mt-xs text-[36px]">{rel.name} needs you most.</h1>
        <p className="mt-sm text-[16px] font-semibold text-ink-soft">You scored {result.scores[weakest]}% there. Tap a layer of the pyramid, or swipe through the cards.</p>
      </div>

      <section className="mt-lg rounded-card p-md" style={{ background: `var(--soft-${rel.key})` }} aria-label="Your first pyramid">
        <Pyramid relationship={weakest} autoplay compact words={words} selected={slide.layer ?? null} onSelect={(k) => setAt(KINDS.indexOf(k))} />
      </section>

      <section className="mt-md" aria-live="polite">
        <div ref={card} className="rounded-card bg-card p-md shadow-toy-soft">
          <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{slide.eyebrow}</p>
          <h2 className="mt-xs text-[24px]">{slide.title}</h2>
          <div className="mt-sm">{slide.body}</div>
        </div>
        <div className="mt-sm flex items-center justify-between gap-sm">
          <Button variant="outline" onClick={() => setAt((i) => Math.max(0, i - 1))} disabled={at === 0} aria-label="Previous card">
            Back
          </Button>
          <ol className="m-0 flex list-none gap-xs p-0" aria-label={`Card ${at + 1} of ${slides.length}`}>
            {slides.map((sl, i) => (
              <li key={sl.key}>
                <button type="button" onClick={() => setAt(i)} aria-label={`Card ${i + 1}, ${sl.title}`} aria-current={i === at ? 'step' : undefined} className="block size-[12px] rounded-pill" style={{ background: i === at ? rel.color : 'var(--color-line)' }} />
              </li>
            ))}
          </ol>
          {last ? (
            <Button onClick={onNext}>Next</Button>
          ) : (
            <Button onClick={() => setAt((i) => Math.min(slides.length - 1, i + 1))} aria-label="Next card">
              Next
            </Button>
          )}
        </div>
        {last && <p className="mt-sm m-0 text-center text-[14px] font-semibold text-ink-soft">Next: pick what each area starts with.</p>}
      </section>
    </Screen>
  );
}
