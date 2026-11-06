import { DEFAULT_PAGE_SIZE, DEFAULT_ZONE, DISCOUNT_AREAS, DISCOUNT_AREA_META, DISCOUNT_CODE_MAX, DISCOUNT_PER_PERSON_MAX, discountLabel, money, pageQuery, zonedToUtc, type AdminDiscountCode, type DiscountArea, type Page, type PageSize } from '@kreators/shared';
import { useCallback, useEffect, useState } from 'react';
import { adminApi, type DiscountInput, type DiscountList } from '../lib/api';
import { Button } from './Button';
import { StatTile } from './Charts';
import { DataTable, Select } from './DataTable';
import { Sheet } from './Sheet';
import { FIELD_44 } from '../lib/ui';

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_ZONE;
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const nextDay = (v: string) => new Date(Date.parse(`${v}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
/** The person's own day for an instant, as YYYY-MM-DD. */
const dayOf = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-CA') : '');
/** The last day a code works is the day before the instant it stops. */
const lastDayOf = (iso: string | null) => (iso ? new Date(Date.parse(iso) - 1).toLocaleDateString('en-CA') : '');
/** A day typed by the team as the first instant of that day in their zone. */
const startOfDay = (day: string) => zonedToUtc(day, 0, zone()).toISOString();
/** The code works through the whole of the last day: it stops at the first instant of the day after. */
const endAfterDay = (day: string) => zonedToUtc(nextDay(day), 0, zone()).toISOString();
const randomWord = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => alphabet[b % alphabet.length]).join('');
};

const BLANK = { code: '', kind: 'percent' as 'percent' | 'fixed', percent: '10', amount: '', currency: 'INR', areas: ['product'] as DiscountArea[], itemId: '', minAmount: '', maxUses: '', perPersonLimit: '1', startDay: '', endDay: '', note: '' };

const moneyGiven = (c: AdminDiscountCode) => [c.givenCents > 0 ? money(c.givenCents, c.currency) : '', c.givenPoints > 0 ? `${c.givenPoints} points` : ''].filter(Boolean).join(' and ') || 'Nothing yet';

/**
 * Admin, Discount codes. The team makes a code (a percent or a fixed amount, which places it works in, how many times, between which
 * days); the platform pays what it takes off. Sort, search and filter the table; switch a code off in its row or several at once.
 */
export function AdminDiscounts({ adminKey }: { adminKey: string }) {
  const [rows, setRows] = useState<AdminDiscountCode[] | null>(null);
  const [totals, setTotals] = useState<DiscountList['totals'] | null>(null);
  const [page, setPage] = useState<Page | undefined>(undefined);
  const [ask, setAsk] = useState<{ page: number; size: PageSize }>({ page: 1, size: DEFAULT_PAGE_SIZE });
  const [q, setQ] = useState('');
  const [active, setActive] = useState('');
  const [area, setArea] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [form, setForm] = useState(BLANK);

  const load = useCallback(
    async (next = ask) => {
      setBusy(true);
      setError(null);
      try {
        const r = await adminApi.discountCodes(adminKey, q, { active, area }, pageQuery(next.page, next.size));
        setRows(r.codes);
        setTotals(r.totals);
        setPage(r.page);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the codes.');
      } finally {
        setBusy(false);
      }
    },
    [adminKey, q, active, area, ask],
  );

  useEffect(() => {
    void load({ page: 1, size: ask.size });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, area]);

  const change = async (row: AdminDiscountCode, body: Record<string, unknown>) => {
    setError(null);
    try {
      const r = await adminApi.updateDiscount(adminKey, row.id, body);
      if (r.code) setRows((all) => (all ?? []).map((x) => (x.id === row.id ? r.code! : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    }
  };

  const set = <K extends keyof typeof BLANK>(k: K, v: (typeof BLANK)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleArea = (a: DiscountArea) => setForm((f) => ({ ...f, areas: f.areas.includes(a) ? f.areas.filter((x) => x !== a) : [...f.areas, a] }));

  const submit = async () => {
    if (form.startDay && !isDay(form.startDay)) return setError('The start is a day.');
    if (form.endDay && !isDay(form.endDay)) return setError('The end is a day.');
    const body: DiscountInput = {
      code: form.code.trim() || undefined,
      kind: form.kind,
      percent: form.kind === 'percent' ? form.percent : undefined,
      amount: form.kind === 'fixed' ? form.amount : undefined,
      currency: form.currency,
      areas: form.areas,
      itemId: form.areas.length === 1 ? form.itemId.trim() || undefined : undefined,
      minAmount: form.minAmount,
      maxUses: form.maxUses,
      perPersonLimit: form.perPersonLimit,
      startsAt: form.startDay ? startOfDay(form.startDay) : null,
      endsAt: form.endDay ? endAfterDay(form.endDay) : null,
      note: form.note,
    };
    setBusy(true);
    setError(null);
    try {
      await adminApi.createDiscount(adminKey, body);
      setMaking(false);
      setForm(BLANK);
      await load({ page: 1, size: ask.size });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not make the code.');
      setBusy(false);
    }
  };

  const bulk = async (list: AdminDiscountCode[], on: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.bulkDiscounts(adminKey, list.map((r) => r.id), on);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
      setBusy(false);
    }
  };

  return (
    <section className="mt-md" aria-labelledby="discounts-heading">
      <div className="flex items-center justify-between gap-sm">
        <h2 id="discounts-heading" className="text-title2">
          Discount codes
        </h2>
        <Button onClick={() => setMaking(true)}>Make a code</Button>
      </div>
      <p className="mt-xs m-0 text-subhead text-ink-soft">A code takes a percent or an amount off a product, program, ticket, plan or top-up.</p>
      <ul className="mt-xs m-0 flex list-disc flex-col gap-xs pl-md text-subhead text-ink-soft">
        <li>The platform pays, so the seller still gets the full price.</li>
        <li>A code’s word and worth never change. For a new deal, make a new code.</li>
      </ul>

      {totals && (
        <div className="mt-sm grid grid-cols-2 gap-sm md:grid-cols-4">
          <StatTile label="Codes" value={totals.codes} hint={`${totals.live} switched on`} />
          <StatTile label="Times used" value={totals.redemptions} />
          <StatTile label="Money given away" value={totals.givenCents.length === 0 ? '0' : totals.givenCents.map((m) => money(m.cents, m.currency)).join(', ')} />
          <StatTile label="Points given away" value={totals.givenPoints} />
        </div>
      )}

      <form
        className="mt-sm flex flex-wrap gap-xs"
        onSubmit={(e) => {
          e.preventDefault();
          void load({ page: 1, size: ask.size });
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a code or note" aria-label="Search codes" className="min-w-0 flex-1 rounded-pill border-2 border-line bg-card px-md py-sm text-body" />
        <Select value={active} onChange={(e) => setActive(e.target.value)} aria-label="Status" className="w-[140px]">
          <option value="">On and off</option>
          <option value="1">On</option>
          <option value="0">Off</option>
        </Select>
        <Select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Place" className="w-[180px]">
          <option value="">Every place</option>
          {DISCOUNT_AREAS.map((a) => (
            <option key={a} value={a}>
              {DISCOUNT_AREA_META[a].name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline" disabled={busy}>
          Search
        </Button>
      </form>

      {error && (
        <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-subhead">
          {error}
        </p>
      )}

      <div className="mt-sm">
        <DataTable<AdminDiscountCode>
          rows={rows ?? []}
          page={page}
          onPage={(p, size) => {
            const next = { page: p, size };
            setAsk(next);
            void load(next);
          }}
          rowKey={(r) => r.id}
          label="Discount codes"
          selectable
          search={false}
          busy={busy}
          empty={rows === null ? 'Loading' : 'No codes yet. Make one to start.'}
          columns={[
            { key: 'code', label: 'Code', get: (r) => r.code, render: (r) => <span className="font-mono font-semibold">{r.code}</span> },
            { key: 'worth', label: 'Takes off', get: (r) => discountLabel(r) },
            { key: 'where', label: 'Works on', get: (r) => r.areas.map((a) => DISCOUNT_AREA_META[a].name).join(', ') + (r.itemId ? ` (one item)` : ''), wrap: true },
            { key: 'used', label: 'Used', get: (r) => r.redeemed, align: 'right', render: (r) => `${r.redeemed}${r.maxUses !== null ? ` of ${r.maxUses}` : ''}` },
            { key: 'given', label: 'Given away', get: (r) => r.givenCents + r.givenPoints, render: moneyGiven },
            {
              key: 'on',
              label: 'On',
              get: (r) => r.active,
              filter: true,
              edit: { kind: 'toggle', onEdit: (r, v) => change(r, { active: Boolean(v) }) },
            },
            {
              key: 'ends',
              label: 'Last day',
              get: (r) => lastDayOf(r.endsAt),
              edit: {
                kind: 'text',
                onEdit: (r, v) => {
                  const day = String(v).trim();
                  if (day === '') return change(r, { endsAt: null });
                  if (!isDay(day)) return setError('A day looks like 2026-12-31.');
                  return change(r, { endsAt: endAfterDay(day) });
                },
              },
            },
            { key: 'starts', label: 'From', get: (r) => dayOf(r.startsAt), wide: true },
            { key: 'note', label: 'Note', get: (r) => r.note, wrap: true, edit: { kind: 'text', onEdit: (r, v) => change(r, { note: String(v) }) } },
          ]}
          bulk={[
            { label: 'Switch off', onClick: (list) => bulk(list, false) },
            { label: 'Switch on', onClick: (list) => bulk(list, true), variant: 'outline' },
          ]}
        />
      </div>

      <Sheet open={making} onClose={() => setMaking(false)} title="Make a discount code">
        <form
          className="flex flex-col gap-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {error && (
            <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="dc-code" className="block text-subhead font-semibold">
              Code
            </label>
            <div className="flex gap-xs">
              <input id="dc-code" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} maxLength={DISCOUNT_CODE_MAX} placeholder="SPRING25, or leave empty" autoComplete="off" className={FIELD_44} />
              <Button type="button" variant="outline" className="mt-xs shrink-0" onClick={() => set('code', randomWord())}>
                Make one
              </Button>
            </div>
            <p className="mt-xs m-0 text-caption text-ink-soft">Three to {DISCOUNT_CODE_MAX} letters, numbers or dashes. Empty makes a random one of eight.</p>
          </div>

          <fieldset className="m-0 border-0 p-0">
            <legend className="text-subhead font-semibold">What it takes off</legend>
            {/* Two equal choices across the full width in equal parts (as PeriodFilter), each 44px tall. */}
            <div className="mt-xs grid grid-cols-2 gap-xs">
              {(['percent', 'fixed'] as const).map((k) => (
                <button key={k} type="button" aria-pressed={form.kind === k} onClick={() => set('kind', k)} className={`toy min-h-[44px] min-w-0 rounded-pill border-2 px-md py-xs text-subhead font-medium ${form.kind === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                  {k === 'percent' ? 'A percent' : 'A fixed amount'}
                </button>
              ))}
            </div>
            {form.kind === 'percent' ? (
              <label className="mt-sm block">
                <span className="block text-subhead font-semibold">Percent off (0.01 to 100)</span>
                <input inputMode="decimal" value={form.percent} onChange={(e) => set('percent', e.target.value)} className={FIELD_44} />
                <span className="mt-xs block text-caption text-ink-soft">The amount off is rounded down. It works on prices in money and in points.</span>
              </label>
            ) : (
              <div className="mt-sm grid grid-cols-[1fr_120px] gap-xs">
                <label className="block">
                  <span className="block text-subhead font-semibold">Amount off</span>
                  <input inputMode="decimal" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="500" className={FIELD_44} />
                </label>
                <label className="block">
                  <span className="block text-subhead font-semibold">Money</span>
                  <Select value={form.currency} onChange={(e) => set('currency', e.target.value)} className="mt-xs">
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </Select>
                </label>
                <p className="col-span-2 m-0 text-caption text-ink-soft">Takes money off only. Plans and top-ups are in INR. It never takes off more than the price.</p>
              </div>
            )}
          </fieldset>

          <fieldset className="m-0 border-0 p-0">
            <legend className="text-subhead font-semibold">Where it works</legend>
            <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
              {DISCOUNT_AREAS.map((a) => (
                <li key={a}>
                  <label className="toy flex min-h-[44px] cursor-pointer items-start gap-sm rounded-tile bg-paper p-sm">
                    <input type="checkbox" checked={form.areas.includes(a)} onChange={() => toggleArea(a)} className="mt-xs size-[20px] accent-ink" />
                    <span>
                      <span className="block text-row-title">{DISCOUNT_AREA_META[a].name}</span>
                      <span className="block text-card-note text-ink-soft">{DISCOUNT_AREA_META[a].blurb}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {form.areas.length === 1 && (
              <label className="mt-sm block">
                <span className="block text-subhead font-semibold">Only one item (optional)</span>
                <input value={form.itemId} onChange={(e) => set('itemId', e.target.value)} placeholder="An id, or pro, pro_max, ultra, small, medium, large" className={FIELD_44} />
                <span className="mt-xs block text-caption text-ink-soft">Empty works on every item in that place.</span>
              </label>
            )}
          </fieldset>

          <div className="grid grid-cols-2 gap-xs">
            <label className="block">
              <span className="block text-subhead font-semibold">Times it can be used</span>
              <input inputMode="numeric" value={form.maxUses} onChange={(e) => set('maxUses', e.target.value)} placeholder="No limit" className={FIELD_44} />
              <span className="mt-xs block text-caption text-ink-soft">By everyone together. Empty means no limit.</span>
            </label>
            <label className="block">
              <span className="block text-subhead font-semibold">Times per person</span>
              <input inputMode="numeric" value={form.perPersonLimit} onChange={(e) => set('perPersonLimit', e.target.value)} className={FIELD_44} />
              <span className="mt-xs block text-caption text-ink-soft">By each person, from 1 to {DISCOUNT_PER_PERSON_MAX}.</span>
            </label>
            <label className="block">
              <span className="block text-subhead font-semibold">First day</span>
              <input type="date" value={form.startDay} onChange={(e) => set('startDay', e.target.value)} className={FIELD_44} />
              <span className="mt-xs block text-caption text-ink-soft">Starts at midnight. Empty means now.</span>
            </label>
            <label className="block">
              <span className="block text-subhead font-semibold">Last day</span>
              <input type="date" value={form.endDay} onChange={(e) => set('endDay', e.target.value)} className={FIELD_44} />
              <span className="mt-xs block text-caption text-ink-soft">Works all that day. Empty means no end.</span>
            </label>
          </div>
          <label className="block">
            <span className="block text-subhead font-semibold">Only for prices from (optional)</span>
            <input inputMode="decimal" value={form.minAmount} onChange={(e) => set('minAmount', e.target.value)} placeholder="Any price" className={FIELD_44} />
            <span className="mt-xs block text-caption text-ink-soft">Checks prices in money only. Prices in points always pass.</span>
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Note for the team</span>
            <input value={form.note} onChange={(e) => set('note', e.target.value)} maxLength={200} className={FIELD_44} />
            <span className="mt-xs block text-caption text-ink-soft">Only the team sees it. You can search the table by it.</span>
          </label>
          <Button type="submit" size="lg" full disabled={busy || form.areas.length === 0}>
            Make the code
          </Button>
        </form>
      </Sheet>
    </section>
  );
}
