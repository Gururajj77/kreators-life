import {
  addDays,
  AGENCY_CURRENCIES,
  daysBetween,
  docFromProfile,
  INVOICE_DESIGN_META,
  INVOICE_DESIGNS,
  invoiceFooterFor,
  invoiceMoney,
  MAX_PROFILE_PACKAGES,
  packageExampleLine,
  packageInvoiceLine,
  packageRate,
  parseDocStyle,
  type AgencySettings as Settings,
  type BusinessProfile,
  type DocStyle,
  type Invoice,
  type InvoiceDoc,
  type InvoiceItem,
} from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Clock, LayoutTemplate, Palette, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useAuthed, useMe } from '../lib/queries';
import { AgreementTemplates } from './AgencyContracts';
import { InvoiceTemplates, PaperLoading } from './AgencyInvoices';
import { Button } from './Button';
import { DocStyleSheet } from './DocStyleSheet';
import { Icon } from './Icon';
import { Field, FIELD, InvoiceView, LABEL, MoneyCell, PaperText, ShowSwitches, type InvoiceEditor } from './InvoiceView';
import { MoreMenu } from './MoreMenu';
import { PrintSheet } from './PrintSheet';
import { Busy, Skeleton } from './Skeleton';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';

const KIND_NAME: Record<string, string> = { invoice: 'Invoice', contract: 'Agreement', doc: 'Document' };

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

/** The number a new invoice gets, as the paper shows it: "SSBB-001", or the year style when there is no prefix. */
const firstNumber = (prefix: string) => (prefix ? `${prefix}-001` : `INV-${new Date().getFullYear()}-001`);
const SAVE_AFTER_MS = 900;

/**
 * The person's business details, typed on two pieces of paper as they print: the invoice (header, bank, the defaults for a new one and
 * the footer) and the agreement (the parties, who signs, the courts, the brand and format words and the package table of section 6). They
 * stay on the person's own account and save by themselves a moment after the last keystroke. What the client sees, the document style,
 * currency and hours sit in one More menu; the templates are one row.
 */
export function AgencySettings() {
  const qc = useQueryClient();
  const q = useAuthed(['agency', 'settings'], () => api.agency());
  const saved = q.data?.settings;
  const [draft, setDraft] = useState<Settings | null>(null);
  const [savedJson, setSavedJson] = useState('');
  const [undo, setUndo] = useState<Settings | null>(null);
  const [note, setNote] = useState('');
  const [panel, setPanel] = useState<'show' | 'style' | 'hours' | 'templates' | null>(null);
  const [docStyle, setDocStyle] = useState<DocStyle>(parseDocStyle(undefined));
  const [sample, setSample] = useState<InvoiceItem[] | null>(null);
  // What only the sample shows (the client, a discount, the GST split, the date, the number as typed): typed on the paper, never saved.
  const [sampleDoc, setSampleDoc] = useState<Partial<InvoiceDoc>>({});
  const [sampleMeta, setSampleMeta] = useState<{ issueDate?: string; note?: string; number?: string }>({});
  const loaded = useRef(false);
  useEffect(() => {
    if (!saved || loaded.current) return;
    loaded.current = true;
    setDraft(saved);
    setSavedJson(JSON.stringify(saved));
  }, [saved]);
  const json = draft ? JSON.stringify(draft) : '';
  const save = useMutation({
    mutationFn: (d: Settings) => api.agencySettings({ currency: d.currency, weeklyHours: d.weeklyHours, profile: d.profile }),
    onSuccess: (_r, d) => {
      // The paper keeps what you typed (a half-typed email is not wiped); the server keeps only what is clean, and that is what loads next time.
      setSavedJson(JSON.stringify(d));
      setNote('Saved');
      void qc.invalidateQueries({ queryKey: ['agency'] });
    },
    onError: (e: Error) => setNote(e.message),
  });
  useEffect(() => {
    if (!draft || json === savedJson) return;
    const t = window.setTimeout(() => {
      const before = savedJson ? (JSON.parse(savedJson) as Settings) : null;
      save.mutateAsync(draft).then(() => setUndo(before), () => undefined);
    }, SAVE_AFTER_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json]);
  // Leaving the tab or the page inside the wait still sends what was typed.
  const leaveSave = useRef<() => void>(() => undefined);
  leaveSave.current = () => {
    if (draft && json !== savedJson) void api.agencySettings({ currency: draft.currency, weeklyHours: draft.weeklyHours, profile: draft.profile }).catch(() => undefined);
  };
  useEffect(() => {
    const leave = () => leaveSave.current();
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, []);
  useEffect(() => {
    if (note !== 'Saved') return;
    const t = window.setTimeout(() => setNote(''), 4000);
    return () => window.clearTimeout(t);
  }, [note]);

  const p = draft?.profile;
  const set = (patch: Partial<BusinessProfile>) => setDraft((d) => (d ? { ...d, profile: { ...d.profile, ...patch } } : d));
  const today = todayLocal();
  const preview: Invoice | null = useMemo(() => {
    if (!p || !draft) return null;
    const doc = { ...docFromProfile(p), ...sampleDoc };
    const items = sample ?? (p.packages.rows[0] ? [packageInvoiceLine(p.packages.rows[0], p)] : [{ description: 'Your first line', quantity: 1, unitCents: 0 }]);
    const issue = sampleMeta.issueDate || today;
    return { id: 'preview', number: sampleMeta.number ?? firstNumber(p.invoicePrefix), ownerName: '', ownerHandle: null, clientName: 'Your client', clientEmail: '', items, totalCents: 0, currency: draft.currency, status: 'sent', issueDate: issue, dueDate: addDays(issue, p.payDays), note: sampleMeta.note ?? '', token: '', paidAt: null, createdAt: '', revisedAt: null, agencyClientId: null, doc };
  }, [p, draft, sample, sampleDoc, sampleMeta, today]);

  if (q.isError) {
    return (
      <p role="alert" className="mt-md m-0 text-[14px] font-bold">
        Could not load your business details. Try again.
      </p>
    );
  }
  if (!draft || !p || !preview)
    return (
      <Busy label="Loading your business details" className="mt-md flex flex-col gap-xs">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[120px] w-full" />
        ))}
      </Busy>
    );

  // The invoice paper writes into the profile: what a new invoice starts with.
  const editor: InvoiceEditor = {
    setDoc: (patch: Partial<InvoiceDoc>) => {
      const next: Partial<BusinessProfile> = {};
      if (patch.from) next.from = patch.from;
      if (patch.bank) next.bank = patch.bank;
      if (patch.title !== undefined) next.title = patch.title;
      if (patch.design) next.design = patch.design;
      if (patch.gstBps !== undefined) next.gstBps = patch.gstBps;
      if (patch.tdsBps !== undefined) next.tdsBps = patch.tdsBps;
      if (patch.tdsMode) next.tdsMode = patch.tdsMode;
      if (patch.footnote !== undefined) next.footnote = patch.footnote;
      if (patch.footer !== undefined) next.footer = patch.footer === invoiceFooterFor(p) ? '' : patch.footer;
      if (patch.qtyLabel) next.invoiceQtyLabel = patch.qtyLabel;
      if (patch.qtyPad !== undefined) next.invoiceQtyPad = patch.qtyPad;
      if (patch.show) next.show = patch.show;
      set(next);
      const only: Partial<InvoiceDoc> = {};
      if (patch.to) only.to = patch.to;
      if (patch.discountMode !== undefined) only.discountMode = patch.discountMode;
      if (patch.discountValue !== undefined) only.discountValue = patch.discountValue;
      if (patch.gstSplit !== undefined) only.gstSplit = patch.gstSplit;
      if (Object.keys(only).length) setSampleDoc((s) => ({ ...s, ...only }));
    },
    setMeta: (m) => {
      // "EX-001" sets the prefix EX; the field shows what was typed while the prefix follows it.
      if (m.number !== undefined) {
        setSampleMeta((s) => ({ ...s, number: m.number }));
        set({ invoicePrefix: m.number.toUpperCase().replace(/[^A-Z0-9-]/g, '').replace(/-?\d+$/, '').replace(/-+$/, '').slice(0, 12) });
      }
      if (m.issueDate !== undefined || m.note !== undefined) setSampleMeta((s) => ({ ...s, ...(m.issueDate !== undefined ? { issueDate: m.issueDate } : {}), ...(m.note !== undefined ? { note: m.note } : {}) }));
      if (m.dueDate) set({ payDays: Math.max(0, Math.min(180, daysBetween(preview.issueDate, m.dueDate))) });
    },
    setItems: setSample,
    profile: p,
  };
  const more = [
    { key: 'show', label: 'What the client sees', icon: SlidersHorizontal, onSelect: () => setPanel('show') },
    {
      key: 'style',
      label: 'Document style',
      icon: Palette,
      onSelect: () => {
        setDocStyle(parseDocStyle(p.docStyle));
        setPanel('style');
      },
    },
    { key: 'hours', label: 'Currency and hours', icon: Clock, onSelect: () => setPanel('hours') },
  ];

  return (
    <div>
      <div className="mt-md flex flex-wrap items-center gap-sm">
        <button type="button" onClick={() => setPanel('templates')} className="fx-row min-w-0 flex-1 text-ink">
          <span className="flex h-[40px] w-[48px] shrink-0 items-center justify-center text-ink-soft">
            <Icon icon={LayoutTemplate} size={20} />
          </span>
          <span className="min-w-0 flex-1 text-[16px] font-extrabold">Templates</span>
          <Icon icon={ChevronRight} size={20} className="text-ink-mute" />
        </button>
        <MoreMenu items={more} label="More business settings" />
      </div>
      <p role="status" aria-live="polite" className="mt-xs m-0 min-h-[24px] text-[14px] font-semibold text-ink-soft">
        {save.isPending ? 'Saving' : note}
        {note === 'Saved' && undo && !save.isPending && (
          <>
            {' '}
            <button
              type="button"
              className="font-bold text-ink underline"
              onClick={() => {
                const back = undo;
                setUndo(null);
                setDraft(back);
              }}
            >
              Undo
            </button>
          </>
        )}
      </p>

      <h3 className="mt-sm mb-xs text-[16px] font-extrabold">Your invoice</h3>
      <div className="legal-host">
        <div aria-hidden="true" />
        <InvoiceView invoice={preview} editor={editor} />
      </div>

      <h3 className="mt-lg mb-xs text-[16px] font-extrabold">Your agreements</h3>
      <AgreementPaper p={p} currency={draft.currency} set={set} />

      <Sheet open={panel === 'templates'} onClose={() => setPanel(null)} title="Templates">
        <div className="grid gap-md pb-xl">
          <div>
            <h3 className="m-0 mb-xs text-[16px] font-extrabold">Invoice templates</h3>
            <InvoiceTemplates />
          </div>
          <div>
            <h3 className="m-0 mb-xs text-[16px] font-extrabold">Agreement templates</h3>
            <AgreementTemplates />
          </div>
          <div>
            <h3 className="m-0 mb-xs text-[16px] font-extrabold">House templates</h3>
            <HouseTemplates />
          </div>
        </div>
      </Sheet>
      <Sheet open={panel === 'show'} onClose={() => setPanel(null)} title="What the client sees">
        <p className="mt-0 mb-sm text-[14px] font-semibold text-ink-soft">What every new invoice shows. Change it on any one invoice too.</p>
        <ShowSwitches value={p.show} onChange={(show) => set({ show })} />
        <div className="mt-md pb-xl">
          <Button onClick={() => setPanel(null)}>Done</Button>
        </div>
      </Sheet>
      <DocStyleSheet
        open={panel === 'style'}
        onClose={() => setPanel(null)}
        value={docStyle}
        onChange={(s) => {
          // The draft holds it too, so the next autosave of the paper never puts the older look back.
          setDocStyle(s);
          set({ docStyle: s });
        }}
        asDefault
        before={
          <div>
            <span className={LABEL}>Invoice design</span>
            <div role="group" aria-label="Invoice design" className="mt-xs grid gap-xs md:grid-cols-2">
              {INVOICE_DESIGNS.map((d) => (
                <button key={d} type="button" aria-pressed={p.design === d} onClick={() => set({ design: d })} className={`toy rounded-tile border-2 p-sm text-left ${p.design === d ? 'border-ink bg-card-strong' : 'toy-soft border-line bg-card'}`}>
                  <span className="block text-[16px] font-extrabold">{INVOICE_DESIGN_META[d].name}</span>
                  <span className="mt-xs block text-[14px] font-semibold text-ink-soft">{INVOICE_DESIGN_META[d].blurb}</span>
                </button>
              ))}
            </div>
          </div>
        }
      />
      <Sheet open={panel === 'hours'} onClose={() => setPanel(null)} title="Currency and hours">
        <div className="grid gap-sm pb-xl md:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="set-currency" className={LABEL}>
              Currency
            </label>
            <select id="set-currency" value={draft.currency} onChange={(e) => setDraft({ ...draft, currency: e.target.value })} className={FIELD}>
              {AGENCY_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <Field id="set-weekly" label="Hours a week" inputMode="numeric" value={String(draft.weeklyHours)} onChange={(v) => setDraft({ ...draft, weeklyHours: Math.max(1, Math.min(100, Math.round(Number.parseFloat(v) || 1))) })} />
            <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">Used to work out how much of your week is paid work.</p>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

/** Two short fields side by side on the paper, for the second email or phone. */
function Pair({ values, onChange, label, placeholder, type = 'text' }: { values: string[]; onChange: (v: string[]) => void; label: string; placeholder: string; type?: string }) {
  const a = values[0] ?? '';
  const b = values[1] ?? '';
  const put = (x: string, y: string) => onChange(y ? [x, y] : x ? [x] : []);
  return (
    <span className="flex min-w-0 flex-1 flex-wrap gap-x-sm">
      <PaperText type={type} value={a} onChange={(v) => put(v, b)} label={`${label}, first`} placeholder={placeholder} max={120} className="min-w-[140px] flex-1" />
      <PaperText type={type} value={b} onChange={(v) => put(a, v)} label={`${label}, second`} placeholder="A second one (optional)" max={120} className="min-w-[140px] flex-1" />
    </span>
  );
}

/** A package's count typed on the paper. It can be emptied while typing (a draft), and only a whole number of one or more is kept. */
function CountCell({ units, onChange, label }: { units: number; onChange: (n: number) => void; label: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={draft ?? String(units)}
      onFocus={(e) => {
        const el = e.currentTarget;
        setDraft(String(units));
        window.requestAnimationFrame(() => el.value === String(units) && el.select());
      }}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = Math.round(Number(e.target.value));
        if (Number.isFinite(n) && n >= 1) onChange(Math.min(10000, n));
      }}
      className="inv-edit"
    />
  );
}

/**
 * The agreement's own details, on the paper they print on: the parties block as section 1 writes it, who signs and the courts, the brand
 * and format words the terms use, the past clients, and the package table of section 6 with its block row and the worked example.
 */
function AgreementPaper({ p, currency, set }: { p: BusinessProfile; currency: string; set: (patch: Partial<BusinessProfile>) => void }) {
  const pk = p.packages;
  const rows = pk.rows;
  const setRows = (next: typeof rows) => set({ packages: { ...pk, rows: next } });
  const addRow = () => rows.length < MAX_PROFILE_PACKAGES && setRows([...rows, { name: '', units: 1, feeCents: 0 }]);
  const top = [...rows].sort((a, b) => a.units - b.units).at(-1);
  const unit = pk.unit || 'Videos';
  const line = (label: string, field: ReactNode) => (
    <div className="flex flex-wrap items-baseline gap-x-xs">
      <span className="shrink-0 font-bold">{label}</span>
      {field}
    </div>
  );
  const example = packageExampleLine(pk, currency);
  return (
    <PrintSheet kind="agreement" title="Your agreement details" titleBlock={false} letterhead={null}>
      <section className="legal-sec">
        <h3 className="legal-sec-h">Parties</h3>
        <div className="legal-clause grid gap-xs">
          {line('Service Provider:', <PaperText value={p.signerName} onChange={(v) => set({ signerName: v })} label="Your name" placeholder="Your name" max={80} className="min-w-0 flex-1" />)}
          <div className="flex flex-wrap items-baseline gap-x-xs">
            <span>Proprietor,</span>
            <PaperText value={p.businessName} onChange={(v) => set({ businessName: v })} label="Business name" placeholder="Your business" max={120} className="w-auto min-w-[120px] flex-1" />
            <span>operating under</span>
            <PaperText value={p.operatingUnder === p.brandName ? '' : p.operatingUnder} onChange={(v) => set({ operatingUnder: v })} label="Operating under" placeholder={p.brandName || 'Your brand'} max={80} className="w-auto min-w-[120px] flex-1" />
          </div>
          {line('Address:', <PaperText multiline value={p.businessAddress} onChange={(v) => set({ businessAddress: v })} label="Business address" placeholder="Registered address" max={300} className="min-w-0 flex-1" />)}
          {line('Email:', <Pair type="email" values={p.emails} onChange={(emails) => set({ emails })} label="Email" placeholder="Email" />)}
          {line('Phone:', <Pair values={p.phones} onChange={(phones) => set({ phones })} label="Phone" placeholder="+91" />)}
          {line('Website:', <PaperText value={p.website} onChange={(v) => set({ website: v })} label="Website" placeholder="www.yourbrand.com" max={120} className="min-w-0 flex-1" />)}
        </div>
      </section>
      <section className="legal-sec">
        <h3 className="legal-sec-h">Words the terms use</h3>
        <div className="legal-clause grid gap-xs">
          {line('Brand:', <PaperText value={p.brandName} onChange={(v) => set({ brandName: v, ...(p.operatingUnder === p.brandName ? { operatingUnder: v } : {}) })} label="Brand name" placeholder="The brand you work under" max={80} className="min-w-0 flex-1" />)}
          {line('Format:', <PaperText value={p.formatName} onChange={(v) => set({ formatName: v, ...(p.formatNameInline === p.formatName ? { formatNameInline: v } : {}) })} label="Format name" placeholder="Your content format" max={60} className="min-w-0 flex-1" />)}
          {line('Format, inside a line:', <PaperText value={p.formatNameInline === p.formatName ? '' : p.formatNameInline} onChange={(v) => set({ formatNameInline: v })} label="Format name inside a line" placeholder={p.formatName || 'The same'} max={60} className="min-w-0 flex-1" />)}
          {line('Past clients:', <PaperText value={p.pastClients} onChange={(v) => set({ pastClients: v })} label="Past clients" placeholder="Brand A, Brand B" max={600} className="min-w-0 flex-1" />)}
        </div>
      </section>
      <section className="legal-sec">
        <h3 className="legal-sec-h">Packages and pricing</h3>
        <div className="overflow-x-auto">
          <table className="legal-table text-balance">
            <thead>
              <tr>
                <th>Package</th>
                <th>
                  <PaperText value={pk.unit} onChange={(v) => set({ packages: { ...pk, unit: v } })} label="What a package counts" placeholder="Videos" max={30} />
                </th>
                <th>Package fee</th>
                <th>
                  Effective rate <span className="whitespace-nowrap">per {unit.toLowerCase().replace(/s$/, '')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="inv-line">
                  <td>
                    <span className="flex items-center gap-xs">
                      <PaperText
                        value={r.name}
                        onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, name: v } : x)))}
                        label={`Package ${i + 1} name`}
                        placeholder={`${r.units} ${unit.replace(/s$/, '')} Package`}
                        max={60}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addRow();
                          } else if (e.key === 'Backspace' && !r.name) {
                            e.preventDefault();
                            setRows(rows.filter((_, j) => j !== i));
                          }
                        }}
                      />
                      <button type="button" aria-label={`Remove package ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="inv-handle no-print toy toy-soft min-h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded-pill text-ink-mute">
                        <Icon icon={Trash2} size={16} />
                      </button>
                    </span>
                  </td>
                  <td>
                    <CountCell units={r.units} onChange={(n) => setRows(rows.map((x, j) => (j === i ? { ...x, units: n } : x)))} label={`Package ${i + 1} count`} />
                  </td>
                  <td>
                    <MoneyCell cents={r.feeCents} currency={currency} onChange={(c) => setRows(rows.map((x, j) => (j === i ? { ...x, feeCents: c } : x)))} label={`Package ${i + 1} fee`} />
                  </td>
                  <td>{invoiceMoney(packageRate(r), currency)}</td>
                </tr>
              ))}
              <tr>
                <td>
                  {/* The tail stays on one line: the cell is narrow on a phone, and the paper's own word breaking would split "beyond 8" anyway. */}
                  Additional {unit.toLowerCase()} <span className="whitespace-nowrap">beyond {top?.units ?? '…'}</span>
                </td>
                <td>
                  <span className="flex items-baseline gap-xs">
                    Each block of
                    <input aria-label="Block size" inputMode="numeric" value={pk.block.units || ''} placeholder="5" onChange={(e) => set({ packages: { ...pk, block: { ...pk.block, units: Math.max(0, Math.min(10000, Math.round(Number(e.target.value)) || 0)) } } })} className="inv-edit w-[48px]" />
                  </span>
                </td>
                <td>
                  <MoneyCell cents={pk.block.feeCents} currency={currency} onChange={(c) => set({ packages: { ...pk, block: { ...pk.block, feeCents: c } } })} label="Fee per block" />
                </td>
                <td>{pk.block.units > 0 ? invoiceMoney(Math.round(pk.block.feeCents / pk.block.units), currency) : ''}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="legal-clause no-print">
            <button type="button" onClick={addRow} className="min-h-[44px] font-bold underline">
              Add your first package
            </button>
          </p>
        )}
        {example && <p className="legal-clause">{example}</p>}
      </section>
      <section className="legal-sec">
        <h3 className="legal-sec-h">Signatures and courts</h3>
        <div className="legal-clause grid gap-xs">
          {line('Designation:', <PaperText value={p.signerTitle} onChange={(v) => set({ signerTitle: v })} label="Your designation" placeholder={p.brandName ? `Founder, ${p.brandName}` : 'Founder'} max={80} className="min-w-0 flex-1" />)}
          {line('Courts of:', <PaperText value={p.jurisdiction} onChange={(v) => set({ jurisdiction: v })} label="Courts of" placeholder="City, State" max={80} className="min-w-0 flex-1" />)}
        </div>
      </section>
    </PrintSheet>
  );
}
