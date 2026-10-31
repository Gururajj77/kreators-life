import {
  AGENCY_CURRENCIES,
  GST_RATES_BPS,
  INVOICE_DESIGN_META,
  INVOICE_DESIGNS,
  INVOICE_TITLES,
  TDS_MODE_NAME,
  TDS_MODES,
  TDS_RATES_BPS,
  emptyProfile,
  type BusinessProfile,
  type TdsMode,
} from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { Button } from './Button';
import { BankFields, Chips, Field, FIELD, LABEL, PartyFields, ShowSwitches } from './InvoiceView';
import { Section } from './Section';

const GST = GST_RATES_BPS.map((b) => ({ value: b, name: b === 0 ? 'None' : `${b / 100}%` }));
const TDS = TDS_RATES_BPS.map((b) => ({ value: b, name: b === 0 ? 'None' : `${b / 100}%` }));

/** The person's business details: what every invoice and agreement starts from. They stay on the person's own account. */
export function AgencySettings() {
  const qc = useQueryClient();
  const q = useAuthed(['agency', 'settings'], () => api.agency());
  const [profile, setProfile] = useState<BusinessProfile>(emptyProfile());
  const [currency, setCurrency] = useState('INR');
  const [hours, setHours] = useState('30');
  const [note, setNote] = useState('');
  const loaded = Boolean(q.data);
  useEffect(() => {
    if (!q.data) return;
    setProfile(q.data.settings.profile);
    setCurrency(q.data.settings.currency);
    setHours(String(q.data.settings.weeklyHours));
    // Fill the form once, when the first answer arrives; later typing is not overwritten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const save = useMutation({
    mutationFn: () => api.agencySettings({ currency, weeklyHours: Math.max(1, Math.min(100, Math.round(Number.parseFloat(hours) || 30))), profile }),
    onSuccess: async () => {
      setNote('Saved.');
      await qc.invalidateQueries({ queryKey: ['agency'] });
    },
    onError: (e: Error) => setNote(e.message),
  });
  const set = (patch: Partial<BusinessProfile>) => setProfile((p) => ({ ...p, ...patch }));
  const card = 'rounded-card bg-card p-md shadow-toy-soft';
  const example = profile.invoicePrefix ? `${profile.invoicePrefix}-001` : `INV-${new Date().getFullYear()}-001`;

  if (q.isError) {
    return (
      <p role="alert" className="mt-md m-0 text-[14px] font-bold">
        Could not load your business details. Try again.
      </p>
    );
  }
  if (!q.data) return <p className="mt-md m-0 text-[16px] font-semibold text-ink-soft">Loading…</p>;

  return (
    <div>
      <p className="mt-md mb-0 text-[14px] font-semibold text-ink-soft">These stay on your own account. They only go on an invoice or an agreement that you choose to send.</p>

      <Section id="set-from" title="Who invoices come from">
        <div className={card}>
          <PartyFields idp="set-from" value={profile.from} onChange={(from) => set({ from })} nameLabel="Name or brand" lineLabel="Line under the name" lineHint="Prop. Your name for Your brand" />
        </div>
      </Section>

      <Section id="set-bank" title="Bank details" lede="Where clients pay you. You can hide them on any one invoice.">
        <div className={card}>
          <BankFields value={profile.bank} onChange={(bank) => set({ bank })} />
        </div>
      </Section>

      <Section id="set-defaults" title="Starting point for every invoice">
        <div className={`${card} grid gap-sm`}>
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
              <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">Your next invoice is numbered {example}. Leave it empty for the year style.</p>
            </div>
            <Field id="set-days" label="Days to pay" inputMode="numeric" value={String(profile.payDays)} onChange={(v) => set({ payDays: Math.max(0, Math.min(180, Math.round(Number.parseFloat(v) || 0))) })} />
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
          </div>
          <div>
            <span className={LABEL}>GST rate</span>
            <Chips label="GST rate" options={GST} value={profile.gstBps} onChange={(v) => set({ gstBps: v })} />
          </div>
          <div>
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
          <div>
            <span className={LABEL}>Design</span>
            <Chips label="Design" options={INVOICE_DESIGNS.map((d) => ({ value: d, name: INVOICE_DESIGN_META[d].name }))} value={profile.design} onChange={(design) => set({ design })} />
          </div>
          <div>
            <label htmlFor="set-footnote" className={LABEL}>
              Line under the totals
            </label>
            <textarea id="set-footnote" rows={2} maxLength={300} value={profile.footnote} onChange={(e) => set({ footnote: e.target.value })} className={FIELD} />
          </div>
          <div>
            <label htmlFor="set-footer" className={LABEL}>
              Line at the foot of the page
            </label>
            <textarea id="set-footer" rows={2} maxLength={300} value={profile.footer} onChange={(e) => set({ footer: e.target.value })} className={FIELD} />
          </div>
        </div>
      </Section>

      <Section id="set-show" title="What a client sees on a new invoice" lede="The starting switches. You can change them on each invoice.">
        <ShowSwitches value={profile.show} onChange={(show) => set({ show })} />
      </Section>

      <Section id="set-agree" title="For agreements" lede="Who signs for you, and which courts the agreement names.">
        <div className={`${card} grid gap-sm md:grid-cols-2`}>
          <Field id="set-signer" label="Your name" value={profile.signerName} onChange={(v) => set({ signerName: v })} max={80} />
          <Field id="set-signer-title" label="Your title" value={profile.signerTitle} onChange={(v) => set({ signerTitle: v })} max={80} placeholder="Founder" />
          <Field id="set-court" label="Courts of" value={profile.jurisdiction} onChange={(v) => set({ jurisdiction: v })} max={80} placeholder="Bengaluru, Karnataka" />
        </div>
      </Section>

      <Section id="set-hours" title="Your hours" lede="Used to work out how much of your week is paid work.">
        <div className={`${card} max-w-[320px]`}>
          <Field id="set-weekly" label="Hours a week" inputMode="numeric" value={hours} onChange={setHours} />
        </div>
      </Section>

      <div className="mt-lg flex flex-wrap items-center gap-sm">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving' : 'Save my details'}
        </Button>
        {note && (
          <p role="status" className="m-0 text-[14px] font-bold">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
