import {
  affirmationFor,
  BAND_STATEMENTS,
  BREATHING,
  CONTRACT_MIN_DAYS_DEFAULT,
  COURAGE,
  DEFAULT_REAL_DAY,
  DRIVES,
  FEAR_OPTIONS,
  levelByValue,
  levelsInBand,
  MANTRAS,
  MAP_BAND_META,
  MAP_BANDS,
  pickFocus,
  MAX_FEARS,
  MAX_INSECURITIES,
  PENALTIES,
  placementFlags,
  RELATIONSHIP_BY_KEY,
  RELATIONSHIPS,
  routineFor,
  SCORE_LABEL,
  SCORECARD,
  type Contract,
  type Drives,
  type Fear,
  type Insecurity,
  type MapBand,
  type Placement,
  type Practices,
  type RealDay,
  type RelationshipKey,
  type Routine,
  type Scores,
} from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import gsap from 'gsap';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { MapLadder, PlacementChart } from '../components/LifeMap';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useAuthed, useMe, useRefreshAll } from '../lib/queries';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const chip = (on: boolean) => `min-h-[44px] rounded-pill border-2 px-sm text-[14px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`;
const STAGES = ['frame', 'map', 'fears', 'insecurities', 'scorecard', 'day', 'focus', 'routine', 'practices', 'contract', 'call'] as const;
type Stage = (typeof STAGES)[number];
type Phase = 'coreBand' | 'coreLevel' | 'floorBand' | 'floorLevel' | 'evidence';
const err = (e: unknown) => (e instanceof Error ? e.message : 'That did not work.');

/** One card at a time, with the step count on top and the way back and forward under it. */
function Frame({ step, eyebrow, title, children, onBack, onNext, nextLabel = 'Next', nextDisabled = false, busy = false, color, closeTo }: { step: number; eyebrow: string; title: string; children: ReactNode; onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean; busy?: boolean; color?: string; closeTo: string }) {
  const card = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    if (reduce) gsap.set(el, { opacity: 1, x: 0 });
    else gsap.fromTo(el, { opacity: 0, x: 24 }, { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' });
  }, [step, title, reduce]);
  return (
    <Screen tabs={false}>
      <div className="pt-xl">
        <Link to={closeTo} className="toy inline-flex min-h-[44px] items-center rounded-pill bg-card px-sm text-[14px] font-bold">
          Close
        </Link>
        <p className="mt-md m-0 text-[14px] font-extrabold uppercase tracking-wide" style={{ color: color ?? 'var(--color-ink-soft)' }}>
          Step {step} of {STAGES.length}. {eyebrow}
        </p>
        <h1 className="mt-xs text-[30px]">{title}</h1>
      </div>
      <div ref={card} className="mt-md">
        {children}
      </div>
      <div className="mt-lg flex gap-xs pb-xl">
        {onBack && (
          <Button variant="outline" size="lg" onClick={onBack} disabled={busy}>
            Back
          </Button>
        )}
        {onNext && (
          <Button size="lg" className="flex-1" onClick={onNext} disabled={nextDisabled || busy}>
            {busy ? 'Saving' : nextLabel}
          </Button>
        )}
      </div>
    </Screen>
  );
}

/**
 * The strategy session, self-serve: the frame, a placement on the map for each relationship (where you
 * live, where you drop), fears and insecurities asked early, a scorecard with a behaviour check, your real
 * day, the focus, a routine ramped from that day, practices, a signed contract, and the optional live call.
 * It ends by sending the focus pillars into the vibe check, which builds their pyramids.
 */
export function Session() {
  const nav = useNavigate();
  const me = useMe();
  const refresh = useRefreshAll();
  const [stage, setStage] = useState<Stage>('frame');
  const step = STAGES.indexOf(stage) + 1;
  // Map placement.
  const [relIndex, setRelIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('coreBand');
  const [placements, setPlacements] = useState<Partial<Record<RelationshipKey, Placement>>>({});
  const [coreBand, setCoreBand] = useState<MapBand>('empowerment');
  const [floorBand, setFloorBand] = useState<MapBand>('victim');
  // Fears, insecurities, scorecard, day.
  const [fears, setFears] = useState<Fear[]>([]);
  const [fearText, setFearText] = useState('');
  const [insecurities, setInsecurities] = useState<Insecurity[]>([]);
  const [insText, setInsText] = useState('');
  const [scores, setScores] = useState<Scores>({});
  const [behaviour, setBehaviour] = useState<Partial<Record<RelationshipKey, number>>>({});
  const [realDay, setRealDay] = useState<RealDay>(DEFAULT_REAL_DAY);
  // The plan.
  const [focus, setFocus] = useState<RelationshipKey[]>([]);
  const [dayType, setDayType] = useState<'general' | 'exceptional'>('general');
  const [practices, setPractices] = useState<Practices>({ mantra: 'none', breathing: 'box', affirmation: '', reading: '' });
  const [contract, setContract] = useState<Pick<Contract, 'minDays' | 'checkinTime' | 'penalty' | 'signedName'>>({ minDays: CONTRACT_MIN_DAYS_DEFAULT, checkinTime: '21:00', penalty: 'streak', signedName: '' });
  const [callOpen, setCallOpen] = useState(false);
  const placed = RELATIONSHIPS.map((r) => placements[r.key]).filter((p): p is Placement => Boolean(p));
  // Resume from the server: a half-done session picks up at the focus; someone already in the app re-runs it with
  // their last answers filled in, and can keep the map instead of placing all seven again.
  const onboarded = Boolean(me.data?.user.onboardedAt);
  const closeTo = onboarded ? '/tower#life-map' : '/start';
  const saved = useAuthed(['session', todayLocal()], () => api.session(todayLocal()));
  const [loaded, setLoaded] = useState(false);
  const previous = saved.data?.assessment ?? null;
  useEffect(() => {
    if (loaded || !saved.data || !me.data) return;
    setLoaded(true);
    const a = saved.data.assessment;
    if (!a) return;
    setPlacements(Object.fromEntries(a.placements.map((p) => [p.relationship, { relationship: p.relationship, core: p.core, floor: p.floor, evidence: p.evidence }])));
    setFears(a.fears);
    setInsecurities(a.insecurities);
    setScores(a.scores);
    setRealDay(a.realDay);
    if (saved.data.routine) setPractices(saved.data.routine.practices);
    if (saved.data.contract) setContract({ minDays: saved.data.contract.minDays, checkinTime: saved.data.contract.checkinTime, penalty: saved.data.contract.penalty, signedName: saved.data.contract.signedName });
    if (!me.data.user.onboardedAt && !saved.data.contract) {
      setFocus(a.focus.length ? a.focus : pickFocus(a.placements, a.insecurities));
      setStage('focus');
    }
  }, [saved.data, me.data, loaded]);
  const keepMap = () => {
    if (!previous) return;
    setFocus(previous.focus.length ? previous.focus : pickFocus(previous.placements, previous.insecurities));
    setStage('focus');
  };
  const required = placed.filter((p) => placementFlags(p).required).map((p) => p.relationship);

  const assess = useMutation({
    mutationFn: () => api.submitAssessment({ placements: placed, fears, insecurities, scores, behaviour, realDay }),
    onSuccess: (r) => {
      setFocus(r.suggestedFocus);
      setStage('focus');
    },
  });
  const plan = useMutation({
    mutationFn: () => api.submitPlan({ focus, practices: { ...practices, affirmation: practices.affirmation || affirmationFor(focus) }, contract, date: todayLocal() }),
    onSuccess: async () => {
      await refresh();
      setStage('call');
    },
  });

  // ---- 1. frame
  if (stage === 'frame') {
    return (
      <Frame closeTo={closeTo} step={step} eyebrow="The frame" title="Three areas. Seven relationships." onNext={() => setStage('map')} nextLabel="Place yourself on the map">
        <p className="m-0 text-[16px] font-semibold text-ink-soft">A life is health, wealth and relationships. Health is your body and your mind. Wealth is your money and your time. Relationships are seven, and the first two live inside them: health inside With yourself, work and money inside Servant leader.</p>
        <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0">
          {RELATIONSHIPS.map((r) => (
            <li key={r.key} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
              <Avatar relationship={r.key} size={36} decorative still />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold">{r.name}</span>
                <span className="block text-[14px] font-semibold text-ink-soft">{r.key === 'self' ? 'Body, health, mind.' : r.key === 'servant_leader' ? 'Work, money, time.' : r.question}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">Next you place each one on this map of how you operate, from stuck to at ease. Twice: where you usually live, and where you drop under stress. You see names, never numbers.</p>
        <div className="mt-sm">
          <MapLadder compact />
        </div>
        {previous && (
          <button type="button" onClick={keepMap} className="toy mt-md inline-flex min-h-[48px] items-center rounded-pill bg-card px-md text-[16px] font-bold shadow-toy-soft">
            Keep my map from last time and go to the focus
          </button>
        )}
      </Frame>
    );
  }

  // ---- 2. the map, one relationship at a time
  if (stage === 'map') {
    const rel = RELATIONSHIPS[relIndex]!;
    const current = placements[rel.key];
    const coreLevel = current?.core;
    const back = () => {
      if (phase === 'coreBand') {
        if (relIndex === 0) setStage('frame');
        else {
          setRelIndex(relIndex - 1);
          setPhase('coreBand');
        }
      } else if (phase === 'coreLevel') setPhase('coreBand');
      else if (phase === 'floorBand') setPhase('coreLevel');
      else if (phase === 'floorLevel') setPhase('floorBand');
      else setPhase('floorLevel');
    };
    const finishRel = () => {
      if (relIndex < RELATIONSHIPS.length - 1) {
        setRelIndex(relIndex + 1);
        setPhase('coreBand');
      } else setStage('fears');
    };
    const title = phase === 'coreBand' ? `Where do you usually live with ${rel.name.toLowerCase()}?` : phase === 'coreLevel' ? 'Which line sounds most like your head there?' : phase === 'floorBand' ? 'Under stress, where do you drop to?' : phase === 'floorLevel' ? 'And what does that sound like?' : 'What did you do last week that shows this?';
    return (
      <Frame closeTo={closeTo} step={step} eyebrow={`${rel.name}, ${relIndex + 1} of 7`} title={title} color={`var(--deep-${rel.key})`} onBack={back} onNext={phase === 'evidence' ? finishRel : undefined} nextLabel="Next relationship">
        <div className="flex items-center gap-sm">
          <Avatar relationship={rel.key} size={56} still />
          <p className="m-0 text-[14px] font-semibold text-ink-soft">{rel.key === 'self' ? 'Body, health and mind sit here.' : rel.key === 'servant_leader' ? 'Work, money and time sit here.' : rel.question}</p>
        </div>
        {(phase === 'coreBand' || phase === 'floorBand') && (
          <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0">
            {MAP_BANDS.map((b) => (
              <li key={b}>
                <button
                  type="button"
                  className="toy toy-soft w-full rounded-tile bg-card p-sm text-left"
                  onClick={() => {
                    if (phase === 'coreBand') {
                      setCoreBand(b);
                      setPhase('coreLevel');
                    } else {
                      setFloorBand(b);
                      setPhase('floorLevel');
                    }
                  }}
                >
                  <span className="block text-[14px] font-extrabold uppercase tracking-wide" style={{ color: `var(--deep-${rel.key})` }}>
                    {MAP_BAND_META[b].name}
                  </span>
                  <span className="mt-xs block text-[16px] font-semibold">{BAND_STATEMENTS[rel.key][b]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {(phase === 'coreLevel' || phase === 'floorLevel') && (
          <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0">
            {levelsInBand(phase === 'coreLevel' ? coreBand : floorBand).map((l) => (
              <li key={l.value}>
                <button
                  type="button"
                  className="toy toy-soft flex w-full items-center gap-sm rounded-tile bg-card p-sm text-left"
                  onClick={() => {
                    if (phase === 'coreLevel') {
                      setPlacements((p) => ({ ...p, [rel.key]: { relationship: rel.key, core: l.value, floor: p[rel.key]?.floor ?? l.value, evidence: p[rel.key]?.evidence ?? '' } }));
                      setPhase('floorBand');
                    } else {
                      setPlacements((p) => ({ ...p, [rel.key]: { relationship: rel.key, core: p[rel.key]?.core ?? l.value, floor: l.value, evidence: p[rel.key]?.evidence ?? '' } }));
                      if ((placements[rel.key]?.core ?? 0) >= 400) setPhase('evidence');
                      else finishRel();
                    }
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold">{l.name}</span>
                    <span className="block text-[14px] font-semibold text-ink-soft">“{l.sounds}”</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {phase === 'evidence' && (
          <label className="mt-md block">
            <span className="block text-[14px] font-bold">You placed yourself at {levelByValue(coreLevel ?? 400)?.name}. One thing from last week that shows it.</span>
            <textarea value={current?.evidence ?? ''} onChange={(e) => setPlacements((p) => ({ ...p, [rel.key]: { ...p[rel.key]!, evidence: e.target.value } }))} rows={3} maxLength={500} placeholder="What you did, not what you believe." className={field} />
            <span className="mt-xs block text-[12px] font-bold text-ink-soft">Leave it empty and this one is held at Acceptance until there is something to show.</span>
          </label>
        )}
      </Frame>
    );
  }

  // ---- 3. fears
  if (stage === 'fears') {
    const add = (text: string) => {
      if (!text.trim() || fears.length >= MAX_FEARS || fears.some((f) => f.text === text.trim())) return;
      setFears([...fears, { text: text.trim(), relationship: 'self', drives: 'sometimes' }]);
      setFearText('');
    };
    return (
      <Frame closeTo={closeTo} step={step} eyebrow="Fears" title="What shows up when you are about to act?" onBack={() => setStage('map')} onNext={() => setStage('insecurities')}>
        <div className="flex flex-wrap gap-xs">
          {FEAR_OPTIONS.map((f) => (
            <button key={f} type="button" className={chip(fears.some((x) => x.text === f))} onClick={() => (fears.some((x) => x.text === f) ? setFears(fears.filter((x) => x.text !== f)) : add(f))}>
              {f}
            </button>
          ))}
        </div>
        <form
          className="mt-sm flex gap-xs"
          onSubmit={(e) => {
            e.preventDefault();
            add(fearText);
          }}
        >
          <input value={fearText} onChange={(e) => setFearText(e.target.value)} maxLength={120} placeholder="Or your own words" className="min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          <Button type="submit" variant="outline" disabled={!fearText.trim()}>
            Add
          </Button>
        </form>
        <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0">
          {fears.map((f, i) => (
            <li key={f.text} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-[16px] font-bold">{f.text}</p>
              <label className="mt-xs block text-[12px] font-bold text-ink-soft">
                Pulls down
                <select value={f.relationship} onChange={(e) => setFears(fears.map((x, j) => (j === i ? { ...x, relationship: e.target.value as RelationshipKey } : x)))} className={field}>
                  {RELATIONSHIPS.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">Does it drive your decisions?</p>
              <div className="mt-xs flex gap-xs">
                {DRIVES.map((d) => (
                  <button key={d} type="button" className={chip(f.drives === d)} onClick={() => setFears(fears.map((x, j) => (j === i ? { ...x, drives: d as Drives } : x)))}>
                    {d}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        {fears.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">None is a fine answer. Most people find one or two.</p>}
      </Frame>
    );
  }

  // ---- 4. insecurities
  if (stage === 'insecurities') {
    return (
      <Frame closeTo={closeTo} step={step} eyebrow="Insecurities" title="What do you worry people see?" onBack={() => setStage('fears')} onNext={() => setStage('scorecard')}>
        <p className="m-0 text-[14px] font-semibold text-ink-soft">Asked now, not last, so the plan can answer it. Common ones: being awkward around people, looks, little experience with relationships, overthinking.</p>
        <form
          className="mt-sm flex gap-xs"
          onSubmit={(e) => {
            e.preventDefault();
            if (insText.trim() && insecurities.length < MAX_INSECURITIES) {
              setInsecurities([...insecurities, { text: insText.trim(), weight: 5, relationship: 'self' }]);
              setInsText('');
            }
          }}
        >
          <input value={insText} onChange={(e) => setInsText(e.target.value)} maxLength={120} placeholder="In a few words" className="min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          <Button type="submit" variant="outline" disabled={!insText.trim()}>
            Add
          </Button>
        </form>
        <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0">
          {insecurities.map((it, i) => (
            <li key={`${it.text}-${i}`} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <div className="flex items-center justify-between gap-sm">
                <p className="m-0 text-[16px] font-bold">{it.text}</p>
                <button type="button" onClick={() => setInsecurities(insecurities.filter((_, j) => j !== i))} className="text-[12px] font-bold text-ink-soft underline-offset-4 hover:underline">
                  Remove
                </button>
              </div>
              <label className="mt-xs block text-[12px] font-bold text-ink-soft">
                How heavy, out of 10: {it.weight}
                <input type="range" min={0} max={10} value={it.weight} onChange={(e) => setInsecurities(insecurities.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value) } : x)))} className="mt-xs w-full accent-ink" />
              </label>
              <label className="mt-xs block text-[12px] font-bold text-ink-soft">
                Sits in
                <select value={it.relationship} onChange={(e) => setInsecurities(insecurities.map((x, j) => (j === i ? { ...x, relationship: e.target.value as RelationshipKey } : x)))} className={field}>
                  {RELATIONSHIPS.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      </Frame>
    );
  }

  // ---- 5. scorecard
  if (stage === 'scorecard') {
    const slider = (key: keyof Scores, label: string) => (
      <label key={key} className="block rounded-tile bg-card p-sm shadow-toy-soft">
        <span className="flex items-center justify-between text-[14px] font-bold">
          <span>{label}</span>
          <span className="text-ink-soft">{scores[key] ?? 5} of 10</span>
        </span>
        <input type="range" min={0} max={10} value={scores[key] ?? 5} onChange={(e) => setScores({ ...scores, [key]: Number(e.target.value) })} className="mt-xs w-full accent-ink" />
      </label>
    );
    const checks = RELATIONSHIPS.filter((r) => (scores[r.key] ?? 5) >= 8 && (placements[r.key] ? placementFlags(placements[r.key]!).floor < COURAGE : false));
    return (
      <Frame closeTo={closeTo} step={step} eyebrow="Scorecard" title="Out of ten, honestly." onBack={() => setStage('insecurities')} onNext={() => setStage('day')}>
        <h2 className="text-[18px]">Health</h2>
        <div className="mt-xs flex flex-col gap-xs">{SCORECARD.health.map((k) => slider(k, SCORE_LABEL[k]))}</div>
        <h2 className="mt-md text-[18px]">Wealth</h2>
        <div className="mt-xs flex flex-col gap-xs">{SCORECARD.wealth.map((k) => slider(k, SCORE_LABEL[k]))}</div>
        <h2 className="mt-md text-[18px]">The seven</h2>
        <div className="mt-xs flex flex-col gap-xs">{RELATIONSHIPS.map((r) => slider(r.key, r.name))}</div>
        {checks.length > 0 && (
          <div className="mt-md rounded-card p-md" style={{ background: 'var(--soft-parent_child)' }}>
            <p className="m-0 text-[16px] font-bold">One check, because the map says otherwise.</p>
            {checks.map((r) => (
              <div key={r.key} className="mt-sm">
                <p className="m-0 text-[14px] font-semibold">In the last seven days, how many days did you act from courage with {r.name.toLowerCase()} instead of avoiding it?</p>
                <div className="mt-xs flex flex-wrap gap-xs">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <button key={n} type="button" className={chip(behaviour[r.key] === n)} onClick={() => setBehaviour({ ...behaviour, [r.key]: n })}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Frame>
    );
  }

  // ---- 6. the real day
  if (stage === 'day') {
    const t = (key: keyof RealDay, label: string) => (
      <label key={key} className="block">
        <span className="block text-[14px] font-bold">{label}</span>
        <input type="time" value={realDay[key]} onChange={(e) => setRealDay({ ...realDay, [key]: e.target.value })} className={field} />
      </label>
    );
    return (
      <Frame closeTo={closeTo} step={step} eyebrow="Your real day" title="How a normal day goes now." onBack={() => setStage('scorecard')} onNext={() => assess.mutate()} nextLabel="See my focus" busy={assess.isPending}>
        <p className="m-0 text-[14px] font-semibold text-ink-soft">The plan ramps from here, half an hour a week. Nobody moves a 10:30 wake-up to 8 on day one.</p>
        <div className="mt-sm grid grid-cols-2 gap-xs">
          {t('wake', 'Wake up')}
          {t('sleep', 'Lights out')}
          {t('workStart', 'Work starts')}
          {t('workEnd', 'Work ends')}
        </div>
        <label className="mt-sm block">
          <span className="block text-[14px] font-bold">Gym or movement, if any</span>
          <input type="time" value={realDay.gym} onChange={(e) => setRealDay({ ...realDay, gym: e.target.value })} className={field} />
        </label>
        <label className="mt-sm block">
          <span className="block text-[14px] font-bold">What fills the last hour before sleep?</span>
          <input value={realDay.evening} onChange={(e) => setRealDay({ ...realDay, evening: e.target.value })} maxLength={200} placeholder="Scrolling, a show, work mail" className={field} />
        </label>
        {assess.isError && (
          <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {err(assess.error)}
          </p>
        )}
      </Frame>
    );
  }

  // ---- 7. focus
  if (stage === 'focus') {
    const toggle = (k: RelationshipKey) => {
      if (required.includes(k)) return;
      if (focus.includes(k)) setFocus(focus.filter((x) => x !== k));
      else if (focus.length < 2) setFocus([...focus, k]);
    };
    return (
      <Frame closeTo={closeTo} step={step} eyebrow="Your focus" title="Two pillars for month one." onBack={() => setStage('day')} onNext={() => setStage('routine')} nextDisabled={focus.length === 0}>
        <PlacementChart placements={placed} />
        <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">{required.length ? 'A floor under Courage is a required focus. ' : ''}The rest is the lowest cores, weighted by what you said weighs on you. Swap one if the app got it wrong.</p>
        <div className="mt-sm flex flex-wrap gap-xs">
          {RELATIONSHIPS.map((r) => (
            <button key={r.key} type="button" aria-pressed={focus.includes(r.key)} disabled={required.includes(r.key)} onClick={() => toggle(r.key)} className={`${chip(focus.includes(r.key))} disabled:opacity-80`}>
              {r.name}
              {required.includes(r.key) ? ' (required)' : ''}
            </button>
          ))}
        </div>
      </Frame>
    );
  }

  // ---- 8. the routine
  if (stage === 'routine') {
    const preview: Routine = routineFor(realDay, 0, focus, placed);
    const blocks = dayType === 'general' ? preview.general : preview.exceptional;
    return (
      <Frame closeTo={closeTo} step={step} eyebrow="Your routine" title="Built from your day, not a template." onBack={() => setStage('focus')} onNext={() => setStage('practices')}>
        <p className="m-0 text-[14px] font-semibold text-ink-soft">Six blocks. The morning routine is the one that counts: done only when every step is ticked. Each week you hold it five days, wake-up moves thirty minutes earlier, until half past six.</p>
        <div className="mt-sm flex gap-xs">
          {(['general', 'exceptional'] as const).map((d) => (
            <button key={d} type="button" className={chip(dayType === d)} onClick={() => setDayType(d)}>
              {d === 'general' ? 'A normal day' : 'An exceptional day'}
            </button>
          ))}
        </div>
        <ol className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {blocks.map((b) => (
            <li key={b.key} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 flex items-center justify-between text-[16px] font-bold">
                <span>{b.name}</span>
                <span className="text-[12px] text-ink-soft">
                  {b.start} to {b.end}
                </span>
              </p>
              {b.steps.length > 0 && (
                <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0 text-[14px] font-semibold">
                  {b.steps.map((s) => (
                    <li key={s}>• {s}</li>
                  ))}
                </ul>
              )}
              <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{b.note}</p>
            </li>
          ))}
        </ol>
      </Frame>
    );
  }

  // ---- 9. practices
  if (stage === 'practices') {
    return (
      <Frame closeTo={closeTo} step={step} eyebrow="Practices" title="What you say, breathe and read." onBack={() => setStage('routine')} onNext={() => setStage('contract')}>
        <h2 className="text-[18px]">Mantra, five to ten minutes</h2>
        <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
          {MANTRAS.map((m) => (
            <li key={m.key}>
              <button type="button" aria-pressed={practices.mantra === m.key} onClick={() => setPractices({ ...practices, mantra: m.key })} className={`toy toy-flat w-full rounded-tile border-2 p-sm text-left ${practices.mantra === m.key ? 'border-ink bg-card' : 'border-line bg-card'}`}>
                <span className="block text-[16px] font-bold">{m.name}</span>
                <span className="block text-[14px] font-semibold text-ink-soft">{m.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
        <h2 className="mt-md text-[18px]">Breathing</h2>
        <div className="mt-xs flex flex-wrap gap-xs">
          {BREATHING.map((b) => (
            <button key={b.key} type="button" className={chip(practices.breathing === b.key)} onClick={() => setPractices({ ...practices, breathing: b.key })} title={b.blurb}>
              {b.name}
            </button>
          ))}
        </div>
        <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{BREATHING.find((b) => b.key === practices.breathing)?.blurb}</p>
        <label className="mt-md block">
          <span className="block text-[14px] font-bold">Your line, on waking and before sleep</span>
          <textarea value={practices.affirmation} onChange={(e) => setPractices({ ...practices, affirmation: e.target.value })} rows={2} maxLength={240} placeholder={affirmationFor(focus)} className={field} />
        </label>
        <label className="mt-sm block">
          <span className="block text-[14px] font-bold">One page a morning, from</span>
          <input value={practices.reading} onChange={(e) => setPractices({ ...practices, reading: e.target.value })} maxLength={120} placeholder="A book, a scripture, a long essay" className={field} />
        </label>
      </Frame>
    );
  }

  // ---- 10. the contract
  if (stage === 'contract') {
    return (
      <Frame closeTo={closeTo} step={step} eyebrow="The contract" title="Five days a week, or it is not a plan." onBack={() => setStage('practices')} onNext={() => plan.mutate()} nextLabel="Sign it" nextDisabled={!contract.signedName.trim()} busy={plan.isPending}>
        <label className="block">
          <span className="block text-[14px] font-bold">Days a week, at least</span>
          <select value={contract.minDays} onChange={(e) => setContract({ ...contract, minDays: Number(e.target.value) })} className={field}>
            {[3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-sm block">
          <span className="block text-[14px] font-bold">Daily check-in time</span>
          <input type="time" value={contract.checkinTime} onChange={(e) => setContract({ ...contract, checkinTime: e.target.value })} className={field} />
          <span className="mt-xs block text-[12px] font-bold text-ink-soft">A reminder lands in your inbox at this time on any day you have not checked in.</span>
        </label>
        <p className="mt-md m-0 text-[14px] font-bold">When a week falls short</p>
        <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
          {PENALTIES.map((p) => (
            <li key={p.key}>
              <button type="button" aria-pressed={contract.penalty === p.key} onClick={() => setContract({ ...contract, penalty: p.key })} className={`toy toy-flat w-full rounded-tile border-2 p-sm text-left ${contract.penalty === p.key ? 'border-ink bg-card' : 'border-line bg-card'}`}>
                <span className="block text-[16px] font-bold">{p.name}</span>
                <span className="block text-[14px] font-semibold text-ink-soft">{p.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">Weekly check on Sunday night, five minutes. Monthly review in thirty days. The app keeps both dates.</p>
        <label className="mt-sm block">
          <span className="block text-[14px] font-bold">Type your name to sign</span>
          <input value={contract.signedName} onChange={(e) => setContract({ ...contract, signedName: e.target.value })} maxLength={80} placeholder={me.data?.user.displayName || 'Your name'} className={field} />
        </label>
        {plan.isError && (
          <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {err(plan.error)}
          </p>
        )}
      </Frame>
    );
  }

  // ---- 11. the optional live call, then the vibe check for the focus pillars
  return (
    <Frame closeTo={closeTo} step={step} eyebrow="Signed" title="Your plan is in. One more thing, optional." onNext={() => nav(`/vibe-check?floors=${focus.join(',')}`, { replace: true })} nextLabel="Build my pillars">
      <p className="m-0 text-[16px] font-semibold text-ink-soft">The app is the program. If you want a person to read your answers back to you, book a live strategy call: US$100, or ₹10,000 in India. Skipping it changes nothing in your plan.</p>
      <button type="button" onClick={() => setCallOpen(true)} className="toy mt-sm inline-flex min-h-[48px] items-center rounded-pill bg-card px-md text-[16px] font-bold shadow-toy-soft">
        Book a live call
      </button>
      <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">Booking opens once payments are connected.</p>
      <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">Next, three taps per focus pillar builds its pyramid, and Daily shows your routine from tomorrow morning.</p>
      <Sheet open={callOpen} onClose={() => setCallOpen(false)} title="Book a live call">
        <p className="m-0 text-[16px] font-semibold text-ink-soft">A live strategy call with the coach is US$100, or ₹10,000 in India. Booking opens once payments are connected. Until then, write to the team under Help and we will set a time by hand.</p>
        <Link to="/help" className="toy mt-md inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md text-[16px] font-bold text-on-ink">
          Write to the team
        </Link>
      </Sheet>
    </Frame>
  );
}
