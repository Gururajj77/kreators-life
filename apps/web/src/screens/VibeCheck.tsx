import {
  firstQuestionId,
  FOCUS_OPTIONS,
  KIND_META,
  nextQuestionId,
  nextRelationship,
  QUESTION_BY_ID,
  RELATIONSHIPS,
  RELATIONSHIP_BY_KEY,
  type Answers,
  type OnboardingResponse,
  type Question,
  type RelationshipKey,
} from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRef, useState } from 'react';
import { INTERESTS } from '@kreators/shared';
import { useNavigate } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { CheckRow } from '../components/CheckRow';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useMe, useRefreshAll } from '../lib/queries';

const STEPS_PER_FLOOR = 3;
const STEP_OF_ROLE = { gauge: 1, probe: 2, foundation: 3 } as const;

type Stage =
  | { kind: 'intro' }
  | { kind: 'question'; id: string; history: string[] }
  | { kind: 'reveal'; result: OnboardingResponse }
  | { kind: 'about'; result: OnboardingResponse }
  | { kind: 'ladders'; result: OnboardingResponse };

export function VibeCheck() {
  const me = useMe();
  const nav = useNavigate();
  const refresh = useRefreshAll();
  const [stage, setStage] = useState<Stage>({ kind: 'intro' });
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
      setStage({ kind: 'reveal', result });
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
        const floor = nextRelationship(q.relationship);
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
            About twenty taps, no typing. Each character asks what it needs to, then asks you to pick the foundation that must never crack on its floor. The rest of your tower is derived from that.
          </p>
        </div>
        <form
          className="mt-lg flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            setStage({ kind: 'question', id: firstQuestionId(RELATIONSHIPS[0]!.key), history: [] });
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

  if (stage.kind === 'question') {
    const q = QUESTION_BY_ID[stage.id];
    if (!q) return null;
    const prev = stage.history[stage.history.length - 1];
    return (
      <QuestionStage
        q={q}
        value={answers[q.id]}
        saving={onboard.isPending}
        error={onboard.isError ? 'Could not save your answers. Try the last one again.' : null}
        onAnswer={(v) => answer(q, v, stage.history)}
        onBack={() => setStage(prev ? { kind: 'question', id: prev, history: stage.history.slice(0, -1) } : { kind: 'intro' })}
      />
    );
  }

  if (stage.kind === 'reveal') {
    return <Reveal result={stage.result} onNext={() => setStage({ kind: 'about', result: stage.result })} />;
  }

  if (stage.kind === 'about') {
    return <AboutYou onNext={() => setStage({ kind: 'ladders', result: stage.result })} />;
  }

  return <Ladders result={stage.result} onDone={() => nav('/tower', { replace: true })} />;
}

function QuestionStage({
  q,
  value,
  saving,
  error,
  onAnswer,
  onBack,
}: {
  q: Question;
  value: number | undefined;
  saving: boolean;
  error: string | null;
  onAnswer: (v: number) => void;
  onBack: () => void;
}) {
  const reduce = useReducedMotion();
  const rel = RELATIONSHIP_BY_KEY[q.relationship];
  const step = STEP_OF_ROLE[q.role];
  const asks = q.role === 'foundation' ? `${rel.character} needs a foundation` : `${rel.character} asks`;
  return (
    <div className="min-h-dvh" style={{ background: `var(--soft-${rel.key})` }}>
      <Screen tabs={false}>
        <div className="pt-md">
          <div className="flex items-center justify-between gap-sm">
            <button type="button" onClick={onBack} className="rounded-pill px-sm py-xs text-[14px] font-bold text-ink-soft">
              Back
            </button>
            <span className="text-[14px] font-bold text-ink-soft">
              Floor {rel.floor} of {RELATIONSHIPS.length}, step {step} of {STEPS_PER_FLOOR}
            </span>
          </div>
          <ol className="mt-sm flex list-none gap-xs p-0 m-0" aria-hidden="true">
            {RELATIONSHIPS.map((r) => {
              const fill = r.floor < rel.floor ? 1 : r.floor === rel.floor ? step / STEPS_PER_FLOOR : 0;
              return (
                <li key={r.key} className="h-[8px] flex-1 overflow-hidden rounded-pill" style={{ background: 'rgba(79,52,34,0.12)' }}>
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
                This becomes the pillar on {rel.character}&rsquo;s floor. The principle, value goal, outcome, project and first tasks are derived from it.
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
    </div>
  );
}

function Reveal({ result, onNext }: { result: OnboardingResponse; onNext: () => void }) {
  const reduce = useReducedMotion();
  const floors = [...RELATIONSHIPS].sort((a, b) => b.floor - a.floor);
  return (
    <Screen tabs={false}>
      <div className="pt-xl">
        <h1 className="text-[36px]">Your rainbow</h1>
        <p className="mt-sm text-[16px] font-semibold text-ink-soft">
          How your seven relationships look today. A short bar is not bad news. It is where the easy wins are.
        </p>
      </div>
      <ol className="mt-lg flex list-none flex-col gap-sm p-0 m-0">
        {floors.map((r, i) => {
          const score = result.scores[r.key];
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
        See the tower we derived
      </Button>
    </Screen>
  );
}

function Ladders({ result, onDone }: { result: OnboardingResponse; onDone: () => void }) {
  const refresh = useRefreshAll();
  const weakestThree = [...RELATIONSHIPS].sort((a, b) => result.scores[a.key] - result.scores[b.key]).slice(0, 3).map((r) => r.key);
  const [chosen, setChosen] = useState<RelationshipKey[]>(weakestThree);
  const [error, setError] = useState<string | null>(null);
  const floors = [...RELATIONSHIPS].sort((a, b) => b.floor - a.floor);

  const build = useMutation({
    mutationFn: () => api.build(chosen, todayLocal()),
    onSuccess: async () => {
      await refresh();
      onDone();
    },
    onError: () => setError('Could not build the tower. Try again.'),
  });

  return (
    <Screen tabs={false}>
      <div className="pt-xl">
        <h1 className="text-[36px]">Derived from your answers</h1>
        <p className="mt-sm text-[16px] font-semibold text-ink-soft">
          Each floor took the foundation you picked and worked out the rest: one principle, one value goal, one outcome, one project and three tasks sized to where you are. Your three lowest floors are ticked. Tick any other you want built.
        </p>
      </div>
      <ol className="mt-lg flex list-none flex-col gap-md p-0 m-0">
        {floors.map((r) => {
          const l = result.ladders[r.key];
          const on = chosen.includes(r.key);
          const rows: [string, string][] = [
            [KIND_META.principle.label, l.principle],
            [KIND_META.value_goal.label, l.valueGoal],
            [KIND_META.outcome.label, l.outcome],
            [KIND_META.project.label, l.project],
          ];
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
                  title={`Build ${r.character}’s floor`}
                  subtitle={on ? 'Ticked. It will be built.' : 'Tick to build it too.'}
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
        {build.isPending ? 'Stacking the floors' : `Build ${chosen.length} ${chosen.length === 1 ? 'floor' : 'floors'}`}
      </Button>
      <Button variant="ghost" full className="mt-xs" onClick={onDone} disabled={build.isPending}>
        Start with an empty tower
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
        <h1 className="mt-md text-[36px]">What do you make?</h1>
        <p className="mt-sm text-[16px] font-semibold text-ink-soft">Pick a few interests and your city. Circles seat you with people nearby whose interests fit yours: the writer with the editor, the one on camera with the one behind it.</p>
      </div>
      <form
        className="mt-lg flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Interests, pick two or more</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {INTERESTS.map((t) => {
              const on = interests.includes(t);
              return (
                <button key={t} type="button" aria-pressed={on} onClick={() => setInterests(on ? interests.filter((x) => x !== t) : interests.length < 8 ? [...interests, t] : interests)} className={`rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                  {t}
                </button>
              );
            })}
          </div>
        </fieldset>
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
          {interests.length >= 2 && city.trim() ? 'Save and build my tower' : 'Skip for now'}
        </Button>
      </form>
    </Screen>
  );
}
