import { BREATHING, MANTRAS, PENALTIES, RELATIONSHIP_BY_KEY, RELATIONSHIPS, SCORE_LABEL, SCORECARD } from '@kreators/shared';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useAuthed, useMe } from '../lib/queries';
import { Avatar } from './Avatar';
import { Segments } from './Charts';
import { MapLadder, PlacementChart, ScoreRow } from './LifeMap';
import { Ring } from './Ring';
import { Section } from './Section';

const avg = (vals: (number | undefined)[]) => {
  const v = vals.filter((x): x is number => typeof x === 'number');
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};

function Gauge10({ value, label, color }: { value: number | null; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-xs rounded-tile bg-card p-sm shadow-toy-soft">
      <Ring value={value === null ? 0 : value / 10} size={64} stroke={7} color={color} label={`${label}, ${value ?? 'not rated'} of 10`}>
        <span className="font-display text-[16px] font-extrabold">{value ?? '–'}</span>
      </Ring>
      <span className="text-[12px] font-bold text-ink-soft">{label}</span>
    </div>
  );
}

/**
 * Everything the strategy session collected, in one place inside Pillars: the map with all seven placed, the
 * focus, the scorecard, fears and insecurities, the real day, the routine, the practices and the contract.
 */
/**
 * Everything the strategy session collected, as one section under the pillars: the focus, the bars, the map with
 * all seven placed, the scorecard, fears and insecurities, the routine, the practices and the contract.
 */
export function LifeMapPanel() {
  const me = useMe();
  const date = todayLocal();
  const q = useAuthed(['session', date], () => api.session(date));
  const d = q.data;
  if (!d) return null;
  const a = d.assessment;
  const built = new Set((me.data?.relationships ?? []).filter((r) => r.pillars > 0).map((r) => r.key));
  if (!a) return null;
  const focus = a.focus;
  const unbuilt = focus.filter((k) => !built.has(k));
  const relScores = RELATIONSHIPS.map((r) => a.scores[r.key]);
  const when = new Date(a.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <section id="life-map" className="mt-lg scroll-mt-[64px]" aria-labelledby="life-map-heading">
      <h2 id="life-map-heading" className="text-[24px]">
        Your life map
      </h2>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{`From your strategy session on ${when}. Health lives inside With yourself; work, money and time inside Servant leader.`}</p>
      <div className="mt-sm flex flex-wrap gap-xs">
        <Link to="/session" className="toy inline-flex min-h-[44px] items-center rounded-pill bg-card px-sm text-[14px] font-bold shadow-toy-soft">
          Run the session again
        </Link>
        {unbuilt.length > 0 && (
          <Link to={`/vibe-check?floors=${unbuilt.join(',')}`} className="toy inline-flex min-h-[44px] items-center rounded-pill bg-ink px-sm text-[14px] font-bold text-on-ink">
            Build the pillars for your focus
          </Link>
        )}
      </div>

      <Section id="focus-heading" title="Month one" lede={focus.length ? 'The pillars the plan is built around. A floor under Courage is always one of them.' : 'No focus picked yet.'}>
        <ul className="m-0 flex list-none flex-wrap gap-xs p-0">
          {focus.map((k) => (
            <li key={k}>
              <Link to={`/realm/${k}`} className="toy flex min-h-[44px] items-center gap-xs rounded-pill px-sm text-[14px] font-bold" style={{ background: RELATIONSHIP_BY_KEY[k].color, color: RELATIONSHIP_BY_KEY[k].text }}>
                <Avatar relationship={k} size={24} decorative still />
                {RELATIONSHIP_BY_KEY[k].name}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="place-heading" title="Where each one sits" lede="The bar runs from where you drop under stress to where you usually live. The thin line is Courage.">
        <PlacementChart placements={a.placements} focus={focus} />
      </Section>

      <Section id="ladder-heading" title="The whole map" lede="Sixteen levels in three bands. The goal for month one is every floor above the Courage line.">
        <MapLadder placements={a.placements} />
      </Section>

      <Section id="scores-heading" title="Day zero scores" lede="Out of ten, as you rated them. A high score over a low floor was settled by what you did last week.">
        <div className="grid grid-cols-3 gap-xs">
          <Gauge10 value={avg(SCORECARD.health.map((k) => a.scores[k]))} label="Health" color="var(--deep-self)" />
          <Gauge10 value={avg(SCORECARD.wealth.map((k) => a.scores[k]))} label="Wealth" color="var(--deep-servant_leader)" />
          <Gauge10 value={avg(relScores)} label="Relationships" color="var(--deep-friendship)" />
        </div>
        <ul className="mt-sm m-0 flex list-none flex-col gap-xs p-0">
          {SCORECARD.health.map((k) => (
            <ScoreRow key={k} label={SCORE_LABEL[k]} value={a.scores[k]} color="var(--deep-self)" />
          ))}
          {SCORECARD.wealth.map((k) => (
            <ScoreRow key={k} label={SCORE_LABEL[k]} value={a.scores[k]} color="var(--deep-servant_leader)" />
          ))}
          {RELATIONSHIPS.map((r) => (
            <ScoreRow key={r.key} label={r.name} value={a.scores[r.key]} color={r.color} />
          ))}
        </ul>
      </Section>

      <Section id="fears-heading" title="What gets in the way" lede={a.fears.length + a.insecurities.length ? 'Named early, so the plan answers them.' : 'Nothing named. That is a fine answer.'}>
        {a.fears.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {a.fears.map((f) => (
              <li key={f.text} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <Avatar relationship={f.relationship} size={24} decorative still />
                <span className="min-w-0 flex-1 text-[14px] font-bold">{f.text}</span>
                <span className="text-[12px] font-bold text-ink-soft">{f.drives === 'yes' ? 'drives decisions' : f.drives === 'sometimes' ? 'sometimes drives them' : 'does not drive them'}</span>
              </li>
            ))}
          </ul>
        )}
        {a.insecurities.length > 0 && (
          <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
            {a.insecurities.map((it, i) => (
              <li key={`${it.text}-${i}`} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <Avatar relationship={it.relationship} size={24} decorative still />
                <span className="min-w-0 flex-1 text-[14px] font-bold">{it.text}</span>
                <Segments value={it.weight} max={10} color={RELATIONSHIP_BY_KEY[it.relationship].color} label={`weighs ${it.weight} of 10`} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {d.routine && (
        <Section id="routine-heading" title="Your routine" lede={`Built from your day: up at ${a.realDay.wake}, lights out ${a.realDay.sleep}, work ${a.realDay.workStart} to ${a.realDay.workEnd}. Wake-up moves thirty minutes earlier for every week you keep the deal.`}>
          <ol className="m-0 flex list-none flex-col gap-xs p-0">
            {d.routine.general.map((b) => (
              <li key={b.key} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 flex items-center justify-between text-[14px] font-bold">
                  <span>{b.name}</span>
                  <span className="text-[12px] text-ink-soft">
                    {b.start} to {b.end}
                  </span>
                </p>
                {b.steps.length > 0 && <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">{b.steps.join(' · ')}</p>}
                <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{b.note}</p>
              </li>
            ))}
          </ol>
          <ul className="mt-sm m-0 flex list-none flex-col gap-xs p-0 text-[14px] font-semibold">
            <li>Mantra: {MANTRAS.find((m) => m.key === d.routine?.practices.mantra)?.name ?? 'none'}.</li>
            <li>Breathing: {BREATHING.find((b) => b.key === d.routine?.practices.breathing)?.name ?? 'box'}.</li>
            {d.routine.practices.affirmation && <li>Your line: “{d.routine.practices.affirmation}”</li>}
            {d.routine.practices.reading && <li>One page a morning from {d.routine.practices.reading}.</li>}
          </ul>
          <p className="mt-sm m-0 text-[12px] font-bold text-ink-soft">
            The morning steps are on <Link to="/today" className="underline underline-offset-4">Daily</Link> as tick rows.
          </p>
        </Section>
      )}

      {d.contract && (
        <Section id="contract-heading" title="The contract" lede={`Signed ${d.contract.signedName} on ${new Date(d.contract.signedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}.`}>
          <ul className="m-0 flex list-none flex-col gap-xs p-0 text-[14px] font-semibold">
            <li>At least {d.contract.minDays} days a week. This week: {d.week.done} of 7 done.</li>
            <li>Check-in at {d.contract.checkinTime}; a reminder lands in your inbox on any day you have not.</li>
            <li>A short week: {PENALTIES.find((p) => p.key === d.contract?.penalty)?.name.toLowerCase() ?? 'the streak breaks'}.</li>
            <li>Weekly check on {d.contract.nextWeekly}. Monthly review on {d.contract.nextMonthly}.</li>
          </ul>
        </Section>
      )}
    </section>
  );
}

