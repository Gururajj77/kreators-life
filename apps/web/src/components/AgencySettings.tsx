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
  docStyleSummary,
  emptyProfile,
  parseDocStyle,
  type BusinessProfile,
  type DocStyle,
  type TdsMode,
} from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronRight, Clock, FileSignature, FileText, Landmark, Library, Palette, Receipt, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useAuthed, useMe } from '../lib/queries';
import { AgreementTemplates } from './AgencyContracts';
import { InvoiceTemplates, PaperLoading } from './AgencyInvoices';
import { Button } from './Button';
import { DocStyleSheet } from './DocStyleSheet';
import { Icon } from './Icon';
import { Inert } from './Inert';
import { BankFields, Chips, Field, FIELD, LABEL, PartyFields, ShowSwitches } from './InvoiceView';
import { Busy, Skeleton } from './Skeleton';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';

const GST = GST_RATES_BPS.map((b) => ({ value: b, name: b === 0 ? 'None' : `${b / 100}%` }));
const TDS = TDS_RATES_BPS.map((b) => ({ value: b, name: b === 0 ? 'None' : `${b / 100}%` }));

type Part = 'from' | 'bank' | 'invoices' | 'agree' | 'hours';
type Library = 'invoice' | 'contract' | 'house';
const KIND_NAME: Record<string, string> = { invoice: 'Invoice', contract: 'Agreement', doc: 'Document' };

/** One row of the settings list: an icon, the title, what is set now, and a chevron. The whole row is the button. */
function Row({ icon, title, summary, onOpen }: { icon: LucideIcon; title: string; summary: ReactNode; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="fx-row text-ink">
        <span className="flex h-[40px] w-[48px] shrink-0 items-center justify-center text-ink-soft">
          <Icon icon={icon} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-extrabold">{title}</span>
          <span className="mt-xs block text-[14px] font-semibold text-ink-soft">{summary}</span>
        </span>
        <Icon icon={ChevronRight} size={20} className="text-ink-mute" />
      </button>
    </li>
  );
}

/** The house templates every Agency user can start from: read only here; a super admin makes and retires them in Admin. */
function HouseTemplates() {
  const me = useMe();
  const inv = useAuthed(['agency', 'templates', 'invoice'], () => api.agencyTemplates('invoice'));
  const con = useAuthed(['agency', 'templates', 'contract'], () => api.agencyTemplates('contract'));
  const doc = useAuthed(['agency', 'templates', 'doc'], () => api.agencyTemplates('doc'));
  const list = [...(inv.data?.templates ?? []), ...(con.data?.templates ?? []), ...(doc.data?.templates ?? [])].filter((t) => t.scope === 'house');
  const seen = new Set<string>();
  const house = list.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  return (
    <div>
      <p className="m-0 text-[14px] font-semibold text-ink-soft">Starting points from the kreators.app team. Pick one when you start a new invoice, agreement or document; you get your own copy to change.</p>
      {(inv.isPending || con.isPending || doc.isPending) && (
        <div className="mt-xs">
          <PaperLoading label="Loading house templates" />
        </div>
      )}
      {(inv.isError || con.isError || doc.isError) && (
        <p role="alert" className="mt-xs m-0 text-[14px] font-bold">
          Could not load the house templates. Try again.
        </p>
      )}
      {inv.data && con.data && doc.data && house.length === 0 && <p className="mt-xs m-0 rounded-tile bg-card p-sm text-[14px] font-semibold text-ink-soft">No house templates yet.</p>}
      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
        {house.map((t) => (
          <li key={t.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
            <span className="flex flex-wrap items-center gap-xs text-[16px] font-extrabold">
              {t.name}
              <StatusTag tone="info">{KIND_NAME[t.kind] ?? 'Template'}</StatusTag>
            </span>
            <span className="mt-xs block text-[14px] font-semibold text-ink-soft">{t.summary}</span>
          </li>
        ))}
      </ul>
      {me.data?.user.role === 'admin' && (
        <p className="mt-sm m-0 text-[14px] font-bold">
          <Link to="/admin?tab=agencyhouse">Manage house templates in Admin</Link>
        </p>
      )}
    </div>
  );
}

/**
 * The person's business details: what every invoice and agreement starts from. They stay on the person's own account.
 * The page is an inset grouped list; tapping a row opens only its own form in a sheet, which saves by itself.
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
  const [library, setLibrary] = useState<Library | null>(null);
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
  if (!saved)
    return (
      <Busy label="Loading your business details" className="mt-md flex flex-col gap-xs">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[56px] w-full" />
        ))}
      </Busy>
    );

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

      <h3 className="mt-md mb-xs text-[16px] font-extrabold">Your business</h3>
      <ul className="fx-inset" aria-label="Your business details">
        <Row icon={Building2} title="Who invoices come from" onOpen={() => open('from')} summary={p.from.name ? <Inert text={p.from.line ? `${p.from.name}, ${p.from.line}` : p.from.name} /> : 'Not filled in yet'} />
        <Row icon={Landmark} title="Bank details" onOpen={() => open('bank')} summary={p.bank.bankName || tail ? <Inert text={`${p.bank.bankName || 'Bank'}${tail ? `, ends ${tail}` : ''}`} /> : 'Not filled in yet'} />
        <Row
          icon={Receipt}
          title="New invoices"
          onOpen={() => open('invoices')}
          summary={`${p.title}, ${INVOICE_DESIGN_META[p.design].name} look, next number ${example}, ${p.payDays} days to pay, ${p.gstBps > 0 ? `GST ${p.gstBps / 100}%` : 'no GST'}, ${p.tdsBps > 0 && p.tdsMode !== 'none' ? `TDS ${p.tdsBps / 100}%` : 'no TDS'}. The client sees ${shownCount} of ${INVOICE_SHOW_PARTS.length} parts.`}
        />
        <Row icon={FileSignature} title="For agreements" onOpen={() => open('agree')} summary={p.signerName ? <Inert text={`${p.signerName}${p.signerTitle ? `, ${p.signerTitle}` : ''}${p.jurisdiction ? `. Courts of ${p.jurisdiction}` : ''}`} /> : 'Not filled in yet'} />
        <Row
          icon={Palette}
          title="Document style"
          summary={docStyleSummary(parseDocStyle(p.docStyle))}
          onOpen={() => {
            setDocStyle(parseDocStyle(p.docStyle));
            setStyleOpen(true);
          }}
        />
        <Row icon={Clock} title="Currency and hours" onOpen={() => open('hours')} summary={`${saved.currency}, ${saved.weeklyHours} hours a week`} />
      </ul>

      <h3 className="mt-md mb-xs text-[16px] font-extrabold">Templates</h3>
      <ul className="fx-inset" aria-label="Templates">
        <Row icon={Receipt} title="Invoice templates" summary="Your own starting points for an invoice" onOpen={() => setLibrary('invoice')} />
        <Row icon={FileText} title="Agreement templates" summary="Your own starting points for an agreement" onOpen={() => setLibrary('contract')} />
        <Row icon={Library} title="House templates" summary="Starting points from the kreators.app team" onOpen={() => setLibrary('house')} />
      </ul>
      <Sheet open={library !== null} onClose={() => setLibrary(null)} title={library === 'invoice' ? 'Invoice templates' : library === 'contract' ? 'Agreement templates' : 'House templates'}>
        <div className="pb-xl">
          {library === 'invoice' && <InvoiceTemplates />}
          {library === 'contract' && <AgreementTemplates />}
          {library === 'house' && <HouseTemplates />}
        </div>
      </Sheet>

      <DocStyleSheet open={styleOpen} onClose={() => setStyleOpen(false)} value={docStyle} onChange={setDocStyle} asDefault />
      {sheetOf('from', 'Who invoices come from', <PartyFields idp="set-from" value={profile.from} onChange={(from) => set({ from })} nameLabel="Name or brand" lineLabel="Line under the name" lineHint="Prop. Your name for Your brand" />)}
      {sheetOf('bank', 'Bank details', (
        <>
          <p className="mt-0 mb-sm text-[14px] font-semibold text-ink-soft">Where clients pay you. You can hide them on any one invoice.</p>
          <BankFields value={profile.bank} onChange={(bank) => set({ bank })} />
        </>
      ))}
      {sheetOf(
        'invoices',
        'New invoices',
        <>
          <p className="mt-0 mb-sm text-[14px] font-semibold text-ink-soft">What every new invoice starts with. You can change any of it on each invoice.</p>
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
          <h3 className="mt-md mb-xs text-[16px] font-extrabold">What the client sees</h3>
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
