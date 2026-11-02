import {
  AGENCY_CURRENCIES,
  GST_RATES_BPS,
  INVOICE_DESIGN_META,
  INVOICE_DESIGNS,
  INVOICE_SHOW_PARTS,
  INVOICE_TITLES,
  TDS_MODE_NAME,
  TDS_MODES,
  TDS_RATES_BPS,
  emptyProfile,
  parseDocStyle,
  type BusinessProfile,
  type DocStyle,
  type TdsMode,
} from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { Button } from './Button';
import { DocStyleCard, DocStyleSheet } from './DocStyleSheet';
import { Inert } from './Inert';
import { BankFields, Chips, Field, FIELD, LABEL, PartyFields, ShowSwitches, SummaryCard } from './InvoiceView';
import { Sheet } from './Sheet';

const GST = GST_RATES_BPS.map((b) => ({ value: b, name: b === 0 ? 'None' : `${b / 100}%` }));
const TDS = TDS_RATES_BPS.map((b) => ({ value: b, name: b === 0 ? 'None' : `${b / 100}%` }));

type Part = 'from' | 'bank' | 'defaults' | 'show' | 'agree' | 'hours';

/**
 * The person's business details: what every invoice and agreement starts from. They stay on the person's own account.
 * The page is a short list of cards; each has an Edit button that opens only its own form, which saves by itself.
 */
export function AgencySettings() {
  const qc = useQueryClient();
  const q = useAuthed(['agency', 'settings'], () => api.agency());
  const [part, setPart] = useState<Part | null>(null);
  const [profile, setProfile] = useState<BusinessProfile>(emptyProfile());
  const [currency, setCurrency] = useState('INR');
  const [hours, setHours] = useState('30');
  const [note, setNote] = useState('');
  const [styleOpen, setStyleOpen] = useState(false);
  const [docStyle, setDocStyle] = useState<DocStyle>(parseDocStyle(undefined));
  const saved = q.data?.settings;

  const open = (p: Part) => {
    // A sheet always starts from what is saved, so a change you did not save never lingers.
    if (saved) {
      setProfile(saved.profile);
      setCurrency(saved.currency);
      setHours(String(saved.weeklyHours));
    }
    setNote('');
    setPart(p);
  };
  const save = useMutation({
    mutationFn: () => api.agencySettings({ currency, weeklyHours: Math.max(1, Math.min(100, Math.round(Number.parseFloat(hours) || 30))), profile }),
    onSuccess: async () => {
      setNote('Saved.');
      setPart(null);
      await qc.invalidateQueries({ queryKey: ['agency'] });
    },
    onError: (e: Error) => setNote(e.message),
  });
  const set = (patch: Partial<BusinessProfile>) => setProfile((p) => ({ ...p, ...patch }));

  if (q.isError) {
    return (
      <p role="alert" className="mt-md m-0 text-[14px] font-bold">
        Could not load your business details. Try again.
      </p>
    );
  }
  if (!saved) return <p className="mt-md m-0 text-[16px] font-semibold text-ink-soft">Loading…</p>;

  const p = saved.profile;
  const tail = p.bank.account.replace(/\s/g, '').slice(-4);
  const example = p.invoicePrefix ? `${p.invoicePrefix}-001` : `INV-${new Date().getFullYear()}-001`;
  const shownCount = INVOICE_SHOW_PARTS.filter((x) => p.show[x.key]).length;
  const sheetOf = (key: Part, title: string, body: ReactNode) => (
    <Sheet open={part === key} onClose={() => setPart(null)} title={title}>
      {body}
      <div className="mt-md flex flex-wrap items-center gap-sm">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving' : 'Save'}
        </Button>
        <Button variant="outline" onClick={() => setPart(null)}>
          Cancel
        </Button>
        {note && part === key && (
          <p role="alert" className="m-0 text-[14px] font-bold">
            {note}
          </p>
        )}
      </div>
    </Sheet>
  );

  return (
    <div>
      <p className="mt-md mb-0 text-[14px] font-semibold text-ink-soft">These stay on your own account. They only go on an invoice or an agreement that you choose to send.</p>
      {note && !part && (
        <p role="status" className="mt-sm mb-0 text-[14px] font-bold">
          {note}
        </p>
      )}

      <ul className="mt-md m-0 flex list-none flex-col gap-xs p-0" aria-label="Your business details">
        <SummaryCard title="Who invoices come from" onEdit={() => open('from')} summary={p.from.name ? <Inert text={p.from.line ? `${p.from.name}, ${p.from.line}` : p.from.name} /> : 'Not filled in yet'} />
        <SummaryCard title="Bank details" onEdit={() => open('bank')} summary={p.bank.bankName || tail ? <Inert text={`${p.bank.bankName || 'Bank'}${tail ? `, ends ${tail}` : ''}`} /> : 'Not filled in yet'} />
        <SummaryCard
          title="Starting point for every invoice"
          onEdit={() => open('defaults')}
          summary={`${p.title}, ${INVOICE_DESIGN_META[p.design].name} look, next number ${example}, ${p.payDays} days to pay, ${p.gstBps > 0 ? `GST ${p.gstBps / 100}%` : 'no GST'}, ${p.tdsBps > 0 && p.tdsMode !== 'none' ? `TDS ${p.tdsBps / 100}%` : 'no TDS'}`}
        />
        <SummaryCard title="What a client sees on a new invoice" onEdit={() => open('show')} summary={`${shownCount} of ${INVOICE_SHOW_PARTS.length} shown. You can change them on each invoice.`} />
        <SummaryCard title="For agreements" onEdit={() => open('agree')} summary={p.signerName ? <Inert text={`${p.signerName}${p.signerTitle ? `, ${p.signerTitle}` : ''}${p.jurisdiction ? `. Courts of ${p.jurisdiction}` : ''}`} /> : 'Not filled in yet'} />
        <DocStyleCard
          style={parseDocStyle(p.docStyle)}
          onEdit={() => {
            setDocStyle(parseDocStyle(p.docStyle));
            setStyleOpen(true);
          }}
        />
        <SummaryCard title="Currency and hours" onEdit={() => open('hours')} summary={`${saved.currency}, ${saved.weeklyHours} hours a week`} />
      </ul>

      <DocStyleSheet open={styleOpen} onClose={() => setStyleOpen(false)} value={docStyle} onChange={setDocStyle} asDefault />
      {sheetOf('from', 'Who invoices come from', <PartyFields idp="set-from" value={profile.from} onChange={(from) => set({ from })} nameLabel="Name or brand" lineLabel="Line under the name" lineHint="Prop. Your name for Your brand" />)}
      {sheetOf('bank', 'Bank details', (
        <>
          <p className="mt-0 mb-sm text-[14px] font-semibold text-ink-soft">Where clients pay you. You can hide them on any one invoice.</p>
          <BankFields value={profile.bank} onChange={(bank) => set({ bank })} />
        </>
      ))}
      {sheetOf(
        'defaults',
        'Starting point for every invoice',
        <>
          <div className="grid gap-sm md:grid-cols-2">
            <div className="min-w-0">
              <label htmlFor="set-title" className={LABEL}>
                Title
              </label>
              <select id="set-title" value={(INVOICE_TITLES as readonly string[]).includes(profile.title) ? profile.title : INVOICE_TITLES[0]} onChange={(e) => set({ title: e.target.value })} className={FIELD}>
                {INVOICE_TITLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <Field id="set-prefix" label="Number prefix" value={profile.invoicePrefix} onChange={(v) => set({ invoicePrefix: v })} max={12} placeholder="SSBB" />
              <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">
                Your next invoice is numbered {profile.invoicePrefix ? `${profile.invoicePrefix}-001` : `INV-${new Date().getFullYear()}-001`}. Leave it empty for the year style.
              </p>
            </div>
            <Field id="set-days" label="Days to pay" inputMode="numeric" value={String(profile.payDays)} onChange={(v) => set({ payDays: Math.max(0, Math.min(180, Math.round(Number.parseFloat(v) || 0))) })} />
          </div>
          <div className="mt-sm">
            <span className={LABEL}>GST rate</span>
            <Chips label="GST rate" options={GST} value={profile.gstBps} onChange={(v) => set({ gstBps: v })} />
          </div>
          <div className="mt-sm">
            <span className={LABEL}>TDS rate</span>
            <Chips label="TDS rate" options={TDS} value={(TDS_RATES_BPS as readonly number[]).includes(profile.tdsBps) ? profile.tdsBps : -1} onChange={(v) => set({ tdsBps: v })} />
            <label htmlFor="set-tdsmode" className={`${LABEL} mt-sm`}>
              How to treat TDS
            </label>
            <select id="set-tdsmode" value={profile.tdsMode} onChange={(e) => set({ tdsMode: e.target.value as TdsMode })} className={FIELD}>
              {TDS_MODES.map((m) => (
                <option key={m} value={m}>
                  {TDS_MODE_NAME[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-sm">
            <span className={LABEL}>Design</span>
            <Chips label="Design" options={INVOICE_DESIGNS.map((d) => ({ value: d, name: INVOICE_DESIGN_META[d].name }))} value={profile.design} onChange={(design) => set({ design })} />
          </div>
          <div className="mt-sm">
            <label htmlFor="set-footnote" className={LABEL}>
              Line under the totals
            </label>
            <textarea id="set-footnote" rows={2} maxLength={300} value={profile.footnote} onChange={(e) => set({ footnote: e.target.value })} className={FIELD} />
          </div>
          <div className="mt-sm">
            <label htmlFor="set-footer" className={LABEL}>
              Line at the foot of the page
            </label>
            <textarea id="set-footer" rows={2} maxLength={300} value={profile.footer} onChange={(e) => set({ footer: e.target.value })} className={FIELD} />
          </div>
        </>,
      )}
      {sheetOf(
        'show',
        'What a client sees on a new invoice',
        <>
          <p className="mt-0 mb-sm text-[14px] font-semibold text-ink-soft">The starting switches. You can change them on each invoice.</p>
          <ShowSwitches value={profile.show} onChange={(show) => set({ show })} />
        </>,
      )}
      {sheetOf(
        'agree',
        'For agreements',
        <>
          <p className="mt-0 mb-sm text-[14px] font-semibold text-ink-soft">Who signs for you, and which courts the agreement names.</p>
          <div className="grid gap-sm md:grid-cols-2">
            <Field id="set-signer" label="Your name" value={profile.signerName} onChange={(v) => set({ signerName: v })} max={80} />
            <Field id="set-signer-title" label="Your title" value={profile.signerTitle} onChange={(v) => set({ signerTitle: v })} max={80} placeholder="Founder" />
            <Field id="set-court" label="Courts of" value={profile.jurisdiction} onChange={(v) => set({ jurisdiction: v })} max={80} placeholder="Bengaluru, Karnataka" />
          </div>
        </>,
      )}
      {sheetOf(
        'hours',
        'Currency and hours',
        <div className="grid gap-sm md:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="set-currency" className={LABEL}>
              Currency
            </label>
            <select id="set-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={FIELD}>
              {AGENCY_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <Field id="set-weekly" label="Hours a week" inputMode="numeric" value={hours} onChange={setHours} />
            <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">Used to work out how much of your week is paid work.</p>
          </div>
        </div>,
      )}
    </div>
  );
}
