import {
  KPI_AUTO,
  KPI_AUTO_BY_KEY,
  KPI_NAME_MAX,
  KPI_NOTE_MAX,
  KPI_UNIT_NAME,
  KPI_UNITS,
  MAX_KPIS,
  PERIOD_KINDS,
  PERIOD_META,
  kpiFromInput,
  kpiShown,
  kpiStatus,
  kpiToInput,
  type Kpi,
  type KpiReading,
  type KpiStatus,
  type KpiUnit,
  type PeriodKind,
  type TagTone,
} from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { Button } from './Button';
import { Sparkline } from './Charts';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';
import { Toggle } from './Toggle';
import { FIELD } from '../lib/ui';

const STATUS: Record<KpiStatus, { tone: TagTone; word: string }> = {
  on: { tone: 'good', word: 'On target' },
  near: { tone: 'warn', word: 'Close' },
  off: { tone: 'bad', word: 'Off target' },
  none: { tone: 'neutral', word: 'No number yet' },
};
const COPY = {
  off: 'For people who run a business or a studio: track the numbers that matter, typed in or read from Agency.',
  on: 'Each number sits against its target. Type it in, or let it come from Agency.',
  auto: 'From Agency',
};

/** A number typed in the unit a person thinks in (rupees, hours), kept as the stored whole number. */
function NumberField({ unit, stored, onChange, label, id }: { unit: KpiUnit; stored: number | null; onChange: (stored: number | null) => void; label: string; id?: string }) {
  const show = (s: number | null) => (s === null ? '' : String(kpiToInput(unit, s)));
  const [txt, setTxt] = useState(show(stored));
  useEffect(() => {
    const cur = txt === '' ? null : kpiFromInput(unit, Number.parseFloat(txt));
    if (cur !== stored) setTxt(show(stored));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored, unit]);
  return (
    <input
      id={id}
      inputMode="decimal"
      value={txt}
      aria-label={label}
      onChange={(e) => {
        const v = e.target.value;
        setTxt(v);
        const n = Number.parseFloat(v);
        onChange(v === '' ? null : Number.isFinite(n) && n >= 0 ? kpiFromInput(unit, n) : stored);
      }}
      className={FIELD}
    />
  );
}

const unitHint = (unit: KpiUnit, currency: string): string => (unit === 'money' ? `in ${currency}` : unit === 'hours' ? 'in hours' : unit === 'percent' ? 'as a percent, 0 to 100' : 'as a count');

function change(r: KpiReading, currency: string): string {
  if (r.value === null || r.previous === null) return '';
  const diff = r.value - r.previous;
  if (diff === 0) return 'The same as the last period.';
  return `${diff > 0 ? 'Up' : 'Down'} ${kpiShown(r.kpi.unit, Math.abs(diff), currency)} on the last period.`;
}

/** The "Business metrics" block in Reviews. Only a person who switched it on sees the numbers; everyone else sees the quiet switch. */
export function BusinessMetrics({ kind, date }: { kind: PeriodKind; date: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['reviews', 'kpis', kind, date], queryFn: () => api.kpis(kind, date) });
  const d = q.data;
  const [editing, setEditing] = useState<Kpi | 'new' | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['reviews', 'kpis'] });
  const toggle = useMutation({ mutationFn: (on: boolean) => api.kpiSwitch(on), onSuccess: () => void refresh() });
  const total = d ? d.readings.length + d.elsewhere : 0;

  if (q.isPending) return null;
  if (q.isError || !d) {
    return (
      <section className="mt-lg" aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="text-title2">
          Business metrics
        </h2>
        <p role="alert" className="mt-xs m-0 text-subhead">
          Could not load these. Try again in a moment.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-lg" aria-labelledby="metrics-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-sm">
        <h2 id="metrics-heading" className="text-title2">
          Business metrics
        </h2>
        {d.enabled && (
          <Button size="sm" variant="outline" plusToX onClick={() => setEditing('new')} disabled={total >= MAX_KPIS}>
            Add a metric
          </Button>
        )}
      </div>
      <p className="mt-xs m-0 text-balance text-subhead text-ink-soft">{d.enabled ? COPY.on : COPY.off}</p>
      <div className="mt-sm">
        <Toggle on={d.enabled} onChange={(on) => toggle.mutate(on)} disabled={toggle.isPending} label="Show business metrics" hint={d.enabled ? 'Switch off to hide them here. Your metrics stay saved.' : undefined} />
      </div>
      {toggle.isError && (
        <p role="alert" className="mt-xs m-0 text-subhead">
          That did not change. Try again.
        </p>
      )}

      {d.enabled && (
        <>
          {d.readings.length === 0 && (
            <p className="mt-sm m-0 rounded-tile bg-card p-sm text-subhead text-ink-soft shadow-toy-soft">
              No {PERIOD_META[kind].short.toLowerCase()} metrics yet. Add one, such as pieces published or sales calls.
            </p>
          )}
          <ul className="mt-sm grid list-none gap-sm p-0 m-0 md:grid-cols-2">
            {d.readings.map((r) => (
              <li key={r.kpi.id}>
                <Card r={r} currency={d.currency} date={date} onEdit={() => setEditing(r.kpi)} />
              </li>
            ))}
          </ul>
          {d.elsewhere > 0 && (
            <p className="mt-sm m-0 text-subhead text-ink-soft">
              {d.elsewhere} more {d.elsewhere === 1 ? 'metric is' : 'metrics are'} for other periods. Pick that period above to see {d.elsewhere === 1 ? 'it' : 'them'}.
            </p>
          )}
        </>
      )}

      <MetricSheet editing={editing} kind={kind} onClose={() => setEditing(null)} currency={d.currency} />
    </section>
  );
}

function Card({ r, currency, date, onEdit }: { r: KpiReading; currency: string; date: string; onEdit: () => void }) {
  const qc = useQueryClient();
  const k = r.kpi;
  const auto = k.source !== 'manual';
  const [typed, setTyped] = useState<number | null>(r.value);
  const [note, setNote] = useState(r.note);
  const stamp = `${r.value}:${r.note}:${date}`;
  useEffect(() => {
    setTyped(r.value);
    setNote(r.note);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);
  const save = useMutation({
    mutationFn: (value: number | null) => api.kpiValue(k.id, { date, value, note: value === null ? '' : note }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reviews', 'kpis'] }),
  });
  const st = STATUS[kpiStatus(r.value, k.target, k.direction)];
  const max = Math.max(1, k.target, ...r.series.map((v) => v ?? 0));
  const moved = change(r, currency);
  return (
    <div className="h-full rounded-card bg-card p-md shadow-toy-soft">
      <div className="flex items-start justify-between gap-xs">
        <h3 className="m-0 min-w-0 text-headline">{k.name}</h3>
        <StatusTag tone={st.tone}>{st.word}</StatusTag>
      </div>
      <div className="mt-xs flex items-end justify-between gap-sm">
        <div className="min-w-0">
          <p className="m-0 text-title1 type-figure leading-none">{r.value === null ? '—' : kpiShown(k.unit, r.value, currency)}</p>
          <p className="mt-xs m-0 text-subhead text-ink-soft">
            Target {k.target > 0 ? `${k.direction === 'down' ? 'at most ' : ''}${kpiShown(k.unit, k.target, currency)}` : 'not set'}
          </p>
        </div>
        <Sparkline values={r.series} max={max} color="var(--color-r5)" width={96} height={36} />
      </div>
      {moved && <p className="mt-xs m-0 text-subhead text-ink-soft">{moved}</p>}
      {auto ? (
        <p className="mt-sm m-0 text-caption text-ink-mute">
          {COPY.auto}: {KPI_AUTO_BY_KEY[k.source]?.name ?? k.source}
        </p>
      ) : (
        <form
          className="mt-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed !== null) save.mutate(typed);
          }}
        >
          <label className="block text-subhead font-semibold" htmlFor={`v-${k.id}`}>
            This period, {unitHint(k.unit, currency)}
          </label>
          <NumberField id={`v-${k.id}`} unit={k.unit} stored={typed} onChange={setTyped} label={`${k.name}, this period`} />
          <label className="mt-xs block text-subhead font-semibold" htmlFor={`n-${k.id}`}>
            A note
          </label>
          <input id={`n-${k.id}`} value={note} maxLength={KPI_NOTE_MAX} onChange={(e) => setNote(e.target.value)} className={FIELD} />
          {save.isError && (
            <p role="alert" className="mt-xs m-0 text-subhead">
              {save.error instanceof ApiError ? save.error.message : 'That did not save. Try again.'}
            </p>
          )}
          <div className="mt-xs flex flex-wrap gap-xs">
            <Button type="submit" size="sm" disabled={typed === null || save.isPending}>
              {save.isPending ? 'Saving' : 'Save'}
            </Button>
            {r.value !== null && (
              <Button size="sm" variant="ghost" onClick={() => save.mutate(null)} disabled={save.isPending}>
                Clear
              </Button>
            )}
          </div>
        </form>
      )}
      <div className="mt-xs">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Edit this metric
        </Button>
      </div>
    </div>
  );
}

/** Add a metric, or change or remove one. A metric read from Agency has its unit and its good direction fixed by what it measures. */
function MetricSheet({ editing, kind, onClose, currency }: { editing: Kpi | 'new' | null; kind: PeriodKind; onClose: () => void; currency: string }) {
  const qc = useQueryClient();
  const open = editing !== null;
  const prev = editing && editing !== 'new' ? editing : null;
  const [source, setSource] = useState('manual');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<KpiUnit>('number');
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const [cadence, setCadence] = useState<PeriodKind>(kind);
  const [target, setTarget] = useState<number | null>(null);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!open) return;
    setArmed(false);
    if (prev) {
      setSource(prev.source);
      setName(prev.name);
      setUnit(prev.unit);
      setDirection(prev.direction);
      setCadence(prev.cadence);
      setTarget(prev.target);
    } else {
      setSource('manual');
      setName('');
      setUnit('number');
      setDirection('up');
      setCadence(kind);
      setTarget(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prev?.id, kind]);

  const def = KPI_AUTO_BY_KEY[source];
  const shownUnit: KpiUnit = def ? def.unit : unit;
  const shownDirection = def ? def.direction : direction;
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['reviews', 'kpis'] });
    onClose();
  };
  const body = { name: name.trim() || def?.name || '', unit: shownUnit, direction: shownDirection, cadence, target: target ?? 0, source };
  const save = useMutation({
    mutationFn: async () => {
      if (prev) await api.kpiUpdate(prev.id, body);
      else await api.kpiAdd(body);
    },
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => api.kpiRemove(prev!.id), onSuccess: done });
  const error = (save.error ?? remove.error) as unknown;

  return (
    <Sheet open={open} onClose={onClose} title={prev ? 'Change this metric' : 'Add a metric'}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.name) save.mutate();
        }}
      >
        {!prev && (
          <label className="block text-subhead font-semibold" htmlFor="m-source">
            Where does the number come from
            <select
              id="m-source"
              value={source}
              onChange={(e) => {
                const s = e.target.value;
                setSource(s);
                const a = KPI_AUTO_BY_KEY[s];
                if (a && !name.trim()) setName(a.name);
              }}
              className={FIELD}
            >
              <option value="manual">I type it in</option>
              {KPI_AUTO.map((a) => (
                <option key={a.key} value={a.key}>
                  Agency: {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="mt-sm block text-subhead font-semibold" htmlFor="m-name">
          Name
        </label>
        <input id="m-name" value={name} maxLength={KPI_NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder={def?.name ?? 'Sales calls'} className={FIELD} />
        {!def && (
          <div className="mt-sm grid gap-sm md:grid-cols-2">
            <label className="block text-subhead font-semibold">
              What it counts
              <select value={unit} onChange={(e) => setUnit(e.target.value as KpiUnit)} className={FIELD}>
                {KPI_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {KPI_UNIT_NAME[u]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-subhead font-semibold">
              Which way is good
              <select value={direction} onChange={(e) => setDirection(e.target.value as 'up' | 'down')} className={FIELD}>
                <option value="up">More is better</option>
                <option value="down">Less is better</option>
              </select>
            </label>
          </div>
        )}
        {def && <p className="mt-xs m-0 text-subhead text-ink-soft">This one is {KPI_UNIT_NAME[def.unit].toLowerCase()}, and more is better. It comes from Agency, so there is nothing to type.</p>}
        <label className="mt-sm block text-subhead font-semibold" htmlFor="m-cadence">
          How often
        </label>
        <select id="m-cadence" value={cadence} onChange={(e) => setCadence(e.target.value as PeriodKind)} className={FIELD}>
          {PERIOD_KINDS.map((k) => (
            <option key={k} value={k}>
              {PERIOD_META[k].short}
            </option>
          ))}
        </select>
        <label className="mt-sm block text-subhead font-semibold" htmlFor="m-target">
          Target, {unitHint(shownUnit, currency)}
        </label>
        <NumberField id="m-target" unit={shownUnit} stored={target} onChange={setTarget} label="Target" />
        {error != null && (
          <p role="alert" className="mt-sm m-0 text-subhead">
            {error instanceof ApiError ? error.message : 'That did not work. Try again.'}
          </p>
        )}
        <div className="mt-md flex flex-wrap gap-xs">
          <Button type="submit" disabled={save.isPending || !body.name}>
            {save.isPending ? 'Saving' : prev ? 'Save changes' : 'Add this metric'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {prev && (
            <Button
              variant="ghost"
              onClick={() => {
                if (armed) remove.mutate();
                else setArmed(true);
              }}
              disabled={remove.isPending}
            >
              {armed ? 'Tap again to remove' : 'Remove'}
            </Button>
          )}
        </div>
      </form>
    </Sheet>
  );
}
