import {
  addDays,
  daysBetween,
  docDate,
  INVOICE_DESIGN_META,
  INVOICE_DESIGNS,
  INVOICE_STATUS_NAME,
  INVOICE_STATUS_TONE,
  invoiceAsText,
  invoiceForClient,
  invoiceTotals,
  money,
  parseDocStyle,
  type Invoice,
  type InvoiceDoc,
  type InvoiceItem,
  LOCALE,
} from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Building2, Copy, CopyPlus, Download, Eye, EyeOff, KeyRound, LayoutTemplate, Link2, Mail, MessageSquare, Palette, Send, SlidersHorizontal, Trash2, Undo2, Check } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Field, FIELD, InvoiceView, LABEL, ShowSwitches, invoiceDate, type InvoiceEditor } from '../components/InvoiceView';
import { DocPassword } from '../components/AgencyLifecycle';
import { Button } from '../components/Button';
import { ConfirmSheet, DocLog, EmailCopySheet, type EmailContext } from '../components/DocActions';
import { DocStyleSheet } from '../components/DocStyleSheet';
import { HouseTemplateSheet, useSuperAdmin } from '../components/HouseTemplateButton';
import { Icon } from '../components/Icon';
import { MoreMenu, type MoreMenuItem } from '../components/MoreMenu';
import { Busy, Skeleton, SkeletonCard } from '../components/Skeleton';
import { Inert } from '../components/Inert';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { StatusTag } from '../components/StatusTag';
import { Toggle } from '../components/Toggle';
import { api } from '../lib/api';
import { copyPlain } from '../lib/clipboard';
import { todayLocal } from '../lib/date';
import { fileTitle, printAs, useAutoPrint } from '../lib/printDoc';
import { useAuthed } from '../lib/queries';

/** The invoice as the owner is changing it: what the PATCH sends. */
interface Draft {
  doc: InvoiceDoc;
  items: InvoiceItem[];
  number: string;
  issueDate: string;
  dueDate: string;
  note: string;
}
const draftOf = (inv: Invoice): Draft => ({ doc: { ...inv.doc, style: parseDocStyle(inv.doc.style) }, items: inv.items.length ? inv.items : [{ description: '', quantity: 1, unitCents: 0 }], number: inv.number, issueDate: inv.issueDate, dueDate: inv.dueDate ?? '', note: inv.note });
const itemsToSave = (d: Draft): InvoiceItem[] => d.items.filter((i) => i.description.trim()).map((i) => ({ ...i, description: i.description.trim() }));
/** How long the page waits after the last keystroke before it saves. */
const SAVE_AFTER_MS = 900;

/** The number that follows this one in its own series, as a hint: SSBB-001 gives SSBB-002. The server picks the real one. */
function nextHint(number: string): string {
  const m = /^(.*?)(\d+)$/.exec(number);
  return m ? `${m[1]}${String(Number(m[2]) + 1).padStart((m[2] ?? '').length, '0')}` : '';
}

type Panel = 'show' | 'activity' | 'style' | 'password';

/**
 * One invoice: the paper, edited where it is. The header holds the number, one status tag, the one action for where it stands (Send to client,
 * Mark paid), Download and a More menu with everything else. A change saves by itself a moment after the last keystroke, with Undo.
 */
export function AgencyInvoice() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useAuthed(['agency', 'invoice', id], () => api.agencyInvoice(id));
  const settings = useAuthed(['agency', 'settings'], () => api.agency());
  const inv = q.data?.invoice;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savedJson, setSavedJson] = useState('');
  const [undo, setUndo] = useState<Draft | null>(null);
  const [clientView, setClientView] = useState(false);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState<'void' | 'remove' | 'unpay' | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [houseOpen, setHouseOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const superAdmin = useSuperAdmin();
  // The draft follows the saved invoice when it is opened or its status changes; a save in between never resets what you are typing.
  const stamp = inv ? `${inv.id}:${inv.status}` : '';
  useEffect(() => {
    if (!inv) return;
    const d = draftOf(inv);
    setDraft(d);
    setSavedJson(JSON.stringify(d));
    setUndo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);

  const editable = inv ? inv.status === 'draft' || inv.status === 'sent' : false;
  const json = draft ? JSON.stringify(draft) : '';
  const dirty = Boolean(draft && json !== savedJson);
  const items = useMemo(() => (draft ? itemsToSave(draft) : []), [draft]);
  const totals = useMemo(() => (draft ? invoiceTotals(items, draft.doc) : null), [items, draft]);
  const paper: Invoice | null = useMemo(() => {
    if (!inv || !draft || !totals) return null;
    const p: Invoice = { ...inv, doc: draft.doc, items: draft.items, number: draft.number || inv.number, issueDate: draft.issueDate || inv.issueDate, dueDate: draft.dueDate || null, note: draft.note, totalCents: totals.total };
    return clientView ? invoiceForClient({ ...p, items }) : p;
  }, [inv, draft, totals, items, clientView]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['agency'] });
  const saving = useRef<Promise<unknown> | null>(null);
  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const list = itemsToSave(d);
      if (list.length === 0) throw new Error('Add at least one line with a description.');
      await api.agencyInvoiceUpdate(id, { items: list, doc: d.doc, dueDate: d.dueDate || null, issueDate: d.issueDate || null, note: d.note, number: d.number });
      return d;
    },
    onSuccess: (d, _v) => {
      setSavedJson(JSON.stringify(d));
      setNote('Saved');
      void qc.invalidateQueries({ queryKey: ['agency', 'invoices'] });
    },
    onError: (e: Error) => setNote(e.message),
  });
  const flush = useCallback(async () => {
    if (saving.current) await saving.current.catch(() => undefined);
    if (draft && editable && JSON.stringify(draft) !== savedJson) {
      saving.current = save.mutateAsync(draft);
      await saving.current;
    }
  }, [draft, editable, savedJson, save]);
  // Autosave: one PATCH a moment after the last change; the last saved version is kept for Undo.
  useEffect(() => {
    if (!dirty || !editable || !draft) return;
    const timer = window.setTimeout(() => {
      const before = savedJson ? (JSON.parse(savedJson) as Draft) : null;
      saving.current = save.mutateAsync(draft).then(() => setUndo(before), () => undefined);
    }, SAVE_AFTER_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json, editable]);
  // Leaving the page (Back, another tab of the app, closing the tab) inside the wait still sends what was typed.
  const leaveSave = useRef<() => void>(() => undefined);
  leaveSave.current = () => {
    if (!draft || !editable || JSON.stringify(draft) === savedJson) return;
    const list = itemsToSave(draft);
    if (list.length === 0) return;
    void api.agencyInvoiceUpdate(id, { items: list, doc: draft.doc, dueDate: draft.dueDate || null, issueDate: draft.issueDate || null, note: draft.note, number: draft.number }).catch(() => undefined);
  };
  useEffect(() => {
    const leave = () => leaveSave.current();
    window.addEventListener('pagehide', leave);
    return () => {
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, []);

  const status = useMutation({
    mutationFn: async (next: Invoice['status']) => {
      // What is still waiting to save goes first, so the status change goes out with it.
      if (editable) await flush();
      await api.agencyInvoiceUpdate(id, { status: next });
    },
    onSuccess: () => {
      setNote('');
      return refresh();
    },
    onError: (e: Error) => setNote(e.message),
  });
  const remove = useMutation({
    mutationFn: () => api.agencyInvoiceRemove(id),
    onSuccess: async () => {
      await refresh();
      nav('/agency?tab=invoices', { replace: true });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const comments = useAuthed(['agency', 'comments', 'invoice', id], () => api.agencyComments('invoice', id));
  const [reply, setReply] = useState('');
  const sendReply = useMutation({
    mutationFn: () => api.agencyCommentAdd('invoice', id, reply),
    onSuccess: () => {
      setReply('');
      return qc.invalidateQueries({ queryKey: ['agency', 'comments'] });
    },
  });

  const link = inv && inv.status !== 'draft' && inv.status !== 'void' ? `${window.location.origin}/i/${inv.token}` : '';
  const setDoc = (patch: Partial<InvoiceDoc>) => setDraft((d) => (d ? { ...d, doc: { ...d.doc, ...patch } } : d));
  const editor: InvoiceEditor | null = editable && !clientView ? { setDoc, setMeta: (patch) => setDraft((d) => (d ? { ...d, ...patch } : d)), setItems: (list) => setDraft((d) => (d ? { ...d, items: list } : d)), profile: settings.data?.settings.profile ?? null } : null;

  // The saved PDF is the client's version of the page, named "Invoice KR-0007".
  const fileName = fileTitle('Invoice', draft?.number || inv?.number);
  const print = () => {
    const wasClient = clientView;
    const restore = () => {
      setClientView(wasClient);
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    flushSync(() => setClientView(true));
    printAs(fileName);
  };
  const [params] = useSearchParams();
  // ?print=1 opens the print window once the invoice has loaded (Download PDF on a list row); ?email=1 opens the email sheet.
  useAutoPrint(Boolean(inv && draft), fileName, print);
  useEffect(() => {
    if (inv && params.get('email') === '1') setEmailOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv?.id]);
  // A quiet "Saved" fades after a few seconds.
  useEffect(() => {
    if (note !== 'Saved') return;
    const t = window.setTimeout(() => setNote(''), 4000);
    return () => window.clearTimeout(t);
  }, [note]);

  if (q.isError) {
    return (
      <Screen>
        <header className="no-print pt-lg">
          <BackLink to="/agency?tab=invoices">Invoices</BackLink>
          <h1 className="text-[30px]">No invoice here</h1>
          <p role="alert" className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">
            It may have been removed. Go back to the list.
          </p>
        </header>
      </Screen>
    );
  }
  if (!inv || !draft || !totals || !paper) {
    return (
      <Screen>
        <header className="no-print pt-lg">
          <BackLink to="/agency?tab=invoices">Invoices</BackLink>
        </header>
        <Busy label="Loading the invoice" className="mt-md grid gap-md">
          <Skeleton className="h-[36px] w-1/3" />
          <SkeletonCard lines={8} />
        </Busy>
      </Screen>
    );
  }

  // The words Copy text and Email a copy use: the client's version, so what is switched off is not in them.
  const text = invoiceAsText(invoiceForClient({ ...paper, items }), totals);
  const emailCtx: EmailContext = {
    kind: 'invoice',
    clientId: inv.agencyClientId,
    title: inv.doc.title,
    number: inv.number,
    amount: money(totals.total, inv.currency),
    dueBy: inv.dueDate ? invoiceDate(inv.dueDate) : '',
    period: new Date(`${inv.issueDate.slice(0, 7)}-01T12:00:00`).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' }),
    paid: inv.status === 'paid',
    overdue: inv.status === 'sent' && Boolean(inv.dueDate) && (inv.dueDate ?? '') < todayLocal(),
    advance: /advance/i.test(inv.doc.title),
    ...retainerMonthOf(inv),
  };
  const clientComments = comments.data?.comments ?? [];
  // Lines from the client since your last reply: what is waiting for you.
  const lastMine = clientComments.map((c) => c.author).lastIndexOf('me');
  const waiting = clientComments.slice(lastMine + 1).filter((c) => c.author === 'client').length;
  const say = async (copied: Promise<boolean>, ok: string) => setNote((await copied) ? ok : 'Could not copy. Try again.');
  const more: MoreMenuItem[] = [
    { key: 'view', label: clientView ? 'Back to editing' : 'View as client', icon: clientView ? EyeOff : Eye, onSelect: () => setClientView((v) => !v) },
    ...(link ? [{ key: 'link', label: 'Copy link', icon: Link2, onSelect: () => void say(copyPlain(link), 'Link copied.') }] : []),
    { key: 'email', label: 'Email a copy', icon: Mail, onSelect: () => setEmailOpen(true) },
    { key: 'text', label: 'Copy text', icon: Copy, onSelect: () => void say(copyPlain(text), 'Text copied.') },
    { key: 'activity', label: waiting > 0 ? `Comments (${waiting} new)` : 'Comments', icon: MessageSquare, onSelect: () => setPanel('activity') },
    { key: 'show', label: 'What the client sees', icon: SlidersHorizontal, disabled: !editable, onSelect: () => setPanel('show') },
    { key: 'dup', label: 'Duplicate', icon: CopyPlus, onSelect: () => setDupOpen(true) },
    { key: 'tpl', label: 'Save as template', icon: LayoutTemplate, onSelect: () => setTplOpen(true) },
    ...(superAdmin ? [{ key: 'house', label: 'Save as house template', icon: Building2, onSelect: () => setHouseOpen(true) }] : []),
    { key: 'style', label: 'Style and design', icon: Palette, disabled: !editable, onSelect: () => setPanel('style') },
    ...(inv.agencyClientId ? [{ key: 'password', label: 'Password', icon: KeyRound, onSelect: () => setPanel('password') }] : []),
    ...(inv.status === 'paid' ? [{ key: 'unpay', label: 'Mark as sent again', icon: Undo2, destructive: true, onSelect: () => setConfirm('unpay') }] : []),
    ...(inv.status === 'sent' ? [{ key: 'void', label: 'Void', icon: Ban, destructive: true, onSelect: () => setConfirm('void') }] : []),
    ...(inv.status === 'draft' ? [{ key: 'rm', label: 'Remove draft', icon: Trash2, destructive: true, onSelect: () => setConfirm('remove') }] : []),
  ];

  return (
    <Screen howTo={false}>
      <header className="no-print pt-lg">
        <BackLink to="/agency?tab=invoices">Invoices</BackLink>
        <div className="flex flex-wrap items-center gap-sm">
          <h1 className="m-0 text-[30px]">{inv.number}</h1>
          <StatusTag tone={INVOICE_STATUS_TONE[inv.status]}>{INVOICE_STATUS_NAME[inv.status]}</StatusTag>
          <div className="ml-auto flex w-full items-center justify-end gap-xs sm:w-auto">
            {inv.status === 'draft' && (
              <Button onClick={() => status.mutate('sent')} disabled={status.isPending}>
                <Icon icon={Send} size={18} />
                Send to client
              </Button>
            )}
            {inv.status === 'sent' && (
              <Button onClick={() => status.mutate('paid')} disabled={status.isPending}>
                <Icon icon={Check} size={18} />
                Mark paid
              </Button>
            )}
            <Button variant="outline" onClick={print} aria-label="Download a PDF">
              <Icon icon={Download} size={18} />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <MoreMenu items={more} label="More for this invoice" />
          </div>
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
          {clientView && !note && !save.isPending ? 'What your client sees.' : ''}
        </p>
      </header>

      <div className="legal-host">
        <div aria-hidden="true" />
        <InvoiceView invoice={paper} totals={totals} editor={editor} />
      </div>

      <Sheet open={panel === 'show'} onClose={() => setPanel(null)} title="What the client sees">
        <p className="mt-0 mb-sm text-[14px] font-semibold text-ink-soft">What is off is never sent to your client.</p>
        <ShowSwitches value={draft.doc.show} onChange={(show) => setDoc({ show })} />
        <div className="mt-md pb-xl">
          <Button onClick={() => setPanel(null)}>Done</Button>
        </div>
      </Sheet>

      <Sheet open={panel === 'password'} onClose={() => setPanel(null)} title="Password">
        <div className="pb-xl">
          <DocPassword clientId={inv.agencyClientId} clientName={inv.clientName} />
        </div>
      </Sheet>

      <Sheet open={panel === 'activity'} onClose={() => setPanel(null)} title="Comments">
        {clientComments.length === 0 && <p className="m-0 text-[14px] font-semibold text-ink-soft">No comments yet.</p>}
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {clientComments.map((c) => (
            <li key={c.id} className={`rounded-tile p-sm ${c.author === 'client' ? 'bg-paper' : 'bg-card-strong'}`}>
              <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
                {c.author === 'client' ? 'Client' : 'You'}, {docDate(c.createdAt)}
              </p>
              <p className="m-0 whitespace-pre-wrap text-[14px] font-semibold">
                <Inert text={c.body} />
              </p>
            </li>
          ))}
        </ul>
        <label htmlFor="inv-reply" className={`${LABEL} mt-sm`}>
          Reply
        </label>
        <textarea id="inv-reply" rows={2} maxLength={600} value={reply} onChange={(e) => setReply(e.target.value)} className={FIELD} />
        <div className="mt-xs flex flex-wrap gap-xs">
          <Button variant="outline" onClick={() => sendReply.mutate()} disabled={!reply.trim() || sendReply.isPending}>
            Send reply
          </Button>
        </div>
        <h3 className="mt-md mb-xs text-[16px]">Activity</h3>
        <DocLog type="invoice" id={inv.id} />
        <div className="mt-md pb-xl">
          <Button onClick={() => setPanel(null)}>Done</Button>
        </div>
      </Sheet>
      <DocStyleSheet
        open={panel === 'style'}
        onClose={() => setPanel(null)}
        title="Style and design"
        value={parseDocStyle(draft.doc.style)}
        onChange={(style) => setDoc({ style })}
        disabled={!editable}
        before={
          <div>
            <span className={LABEL}>Design</span>
            <div role="group" aria-label="Design" className="mt-xs grid gap-xs md:grid-cols-2">
              {INVOICE_DESIGNS.map((d) => (
                <button key={d} type="button" aria-pressed={draft.doc.design === d} onClick={() => setDoc({ design: d })} className={`toy rounded-tile border-2 p-sm text-left ${draft.doc.design === d ? 'border-ink bg-card-strong' : 'toy-soft border-line bg-card'}`}>
                  <span className="block text-[16px] font-extrabold">{INVOICE_DESIGN_META[d].name}</span>
                  <span className="mt-xs block text-[14px] font-semibold text-ink-soft">{INVOICE_DESIGN_META[d].blurb}</span>
                </button>
              ))}
            </div>
          </div>
        }
      />
      <HouseTemplateSheet open={houseOpen} onClose={() => setHouseOpen(false)} kind="invoice" fromId={inv.id} defaultName={inv.doc.title || 'Invoice'} beforeSave={dirty && editable ? flush : undefined} />
      <ConfirmSheet open={confirm === 'void'} onClose={() => setConfirm(null)} title="Void this invoice?" body="It is kept for the record and your client's link shows it as void. You cannot change it after this; duplicate it to start again." action="Void it" onConfirm={() => status.mutate('void')} busy={status.isPending} />
      <ConfirmSheet open={confirm === 'remove'} onClose={() => setConfirm(null)} title="Remove this draft?" body="The draft is deleted. It was never sent, so your client has not seen it." action="Remove the draft" onConfirm={() => remove.mutate()} busy={remove.isPending} />
      <ConfirmSheet open={confirm === 'unpay'} onClose={() => setConfirm(null)} title="Mark as sent again?" body="It stops counting as paid in your books, so you can change it. Mark it as paid again once it is right." action="Mark as sent again" onConfirm={() => status.mutate('sent')} busy={status.isPending} />
      <EmailCopySheet open={emailOpen} onClose={() => setEmailOpen(false)} route="invoices" id={inv.id} defaultTo={inv.clientEmail || inv.doc.to.email} context={emailCtx} noLinkYet={inv.status === 'draft' || inv.status === 'void'} />
      <TemplateSheet open={tplOpen} onClose={() => setTplOpen(false)} inv={inv} dirty={dirty && editable} saveFirst={flush} />
      <DuplicateSheet open={dupOpen} onClose={() => setDupOpen(false)} inv={inv} />
    </Screen>
  );
}

/**
 * Whether this invoice is a retainer month's, read from the line the cron writes ("Content retainer, month 3 of 6 (2026-05)", agencyCycles.ts),
 * so Email a copy opens on the monthly invoice note with the month filled in. Any other invoice gets nothing and opens on the first note.
 */
const RETAINER_LINE = /^Content retainer, month \d+ of \d+ \((\d{4})-(\d{2})\)$/;
function retainerMonthOf(inv: Invoice): { retainerMonth?: true; period?: string } {
  for (const i of inv.items) {
    const m = RETAINER_LINE.exec(i.description.trim());
    if (m) return { retainerMonth: true, period: new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' }) };
  }
  return {};
}

/** Copy an invoice for next time: the next number in the series, today's date, the same gap to the due date. */
function DuplicateSheet({ open, onClose, inv }: { open: boolean; onClose: () => void; inv: Invoice }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [issue, setIssue] = useState(todayLocal());
  const [bump, setBump] = useState(true);
  const [err, setErr] = useState('');
  const gap = inv.dueDate ? daysBetween(inv.issueDate, inv.dueDate) : null;
  const make = useMutation({
    mutationFn: () => api.agencyInvoiceDuplicate(inv.id, { issueDate: issue, bumpMonths: bump }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ['agency'] });
      onClose();
      nav(`/agency/invoices/${r.invoice.id}`);
    },
    onError: (e: Error) => setErr(e.message),
  });
  return (
    <Sheet open={open} onClose={onClose} title="Duplicate this invoice">
      <div className="grid gap-sm pb-xl">
        <p className="m-0 text-[14px] font-semibold text-ink-soft">The copy is a draft with the same lines, design and details.</p>
        <Field id="dup-issue" label="Date for the copy" type="date" value={issue} onChange={setIssue} />
        <p className="m-0 text-[14px] font-semibold">
          Number: {nextHint(inv.number) || 'the next free one'}
          <br />
          {gap !== null && issue ? `Due by ${invoiceDate(addDays(issue, gap))}, the same ${gap} days after it.` : 'No due date on the original.'}
        </p>
        <Toggle on={bump} onChange={setBump} label="Move months in the lines on" hint="A line like “Retainer, 2026-09” becomes the new month." />
        {err && (
          <p role="alert" className="m-0 text-[14px] font-bold">
            {err}
          </p>
        )}
        <Button onClick={() => make.mutate()} disabled={!issue || make.isPending}>
          {make.isPending ? 'Making the copy' : 'Make the copy'}
        </Button>
      </div>
    </Sheet>
  );
}

/** Keep this invoice as a template: its look, sender, bank, tax and lines, never who it is billed to. The same name replaces what a template holds. */
function TemplateSheet({ open, onClose, inv, dirty, saveFirst }: { open: boolean; onClose: () => void; inv: Invoice; dirty: boolean; saveFirst: () => Promise<unknown> }) {
  const qc = useQueryClient();
  const list = useAuthed(['agency', 'templates', 'invoice'], () => api.agencyTemplates('invoice'), open);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (open) {
      setName(`${inv.doc.title || 'Invoice'}, ${inv.clientName}`.slice(0, 60));
      setMsg('');
    }
    // The suggested name is made each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const same = (list.data?.templates ?? []).find((t) => t.name.trim().toLowerCase() === name.trim().toLowerCase());
  const keep = useMutation({
    mutationFn: async () => {
      if (dirty) await saveFirst();
      if (same) await api.agencyTemplateUpdate(same.id, { fromId: inv.id });
      else await api.agencyTemplateAdd({ kind: 'invoice', name: name.trim(), fromId: inv.id });
    },
    onSuccess: async () => {
      setMsg(same ? 'The template now holds this invoice.' : 'Saved as a template.');
      await qc.invalidateQueries({ queryKey: ['agency'] });
    },
    onError: (e: Error) => setMsg(e.message),
  });
  return (
    <Sheet open={open} onClose={onClose} title="Save as a template">
      <div className="grid gap-sm pb-xl">
        <p className="m-0 text-[14px] font-semibold text-ink-soft">A template keeps the look, who it is from, the bank, GST, TDS and the lines. It never keeps who it is billed to. Start a new invoice from it any time.</p>
        <Field id="tpl-name" label="Template name" value={name} onChange={setName} max={60} />
        {same && <p className="m-0 text-[14px] font-bold">You already have a template with this name. Saving will replace what it holds.</p>}
        {msg && (
          <p role="status" className="m-0 text-[14px] font-bold">
            {msg}
          </p>
        )}
        <Button onClick={() => keep.mutate()} disabled={!name.trim() || keep.isPending}>
          {keep.isPending ? 'Saving' : same ? 'Replace the template' : 'Save the template'}
        </Button>
      </div>
    </Sheet>
  );
}
