import { docDate, type DocType } from '@kreators/shared';
import { EMAIL_NOTE_MAX, EMAIL_TEMPLATES, emailTemplate, emptyEmailVars, fillEmail, suggestEmailTemplate, type EmailVars } from '@kreators/shared/agencyEmail';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError } from '../lib/api';
import { printAs } from '../lib/printDoc';
import { useAuthed } from '../lib/queries';
import { Button } from './Button';
import { Fold } from './Fold';
import { Field } from './InvoiceView';
import { Sheet } from './Sheet';

/** Copy plain text to the clipboard. Says whether it worked, so the screen can point at the text version when it did not. */
export async function copyPlain(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The buttons every document has, in one place: Download PDF and Print (the browser's own print, named by the document), and for the owner
 * Copy text and Email a copy. A client sees Download PDF and Print only where the document allows it; pass no `text` and no `onEmail` there.
 */
export function DocActions({ fileName, canDownload = true, text, onEmail, onPrint, className = '' }: { fileName: string; canDownload?: boolean; text?: string; onEmail?: () => void; /** Print in some other way (an invoice prints the client's version). */ onPrint?: () => void; className?: string }) {
  const print = onPrint ?? (() => printAs(fileName));
  const [note, setNote] = useState('');
  const copy = async () => {
    setNote((await copyPlain(text ?? '')) ? 'Copied. Paste it into your email.' : 'Copying did not work here. Open the text version below and copy it by hand.');
    window.setTimeout(() => setNote(''), 4000);
  };
  return (
    <div className={`no-print ${className}`}>
      <div className="flex flex-wrap gap-xs">
        {canDownload && (
          <Button size="sm" variant="outline" onClick={print}>
            Download PDF
          </Button>
        )}
        {canDownload && (
          <Button size="sm" variant="outline" onClick={print}>
            Print
          </Button>
        )}
        {text !== undefined && (
          <Button size="sm" variant="outline" onClick={copy}>
            Copy text
          </Button>
        )}
        {onEmail && (
          <Button size="sm" variant="outline" onClick={onEmail}>
            Email a copy
          </Button>
        )}
      </div>
      {note && (
        <p role="status" className="mt-xs m-0 text-[14px] font-bold">
          {note}
        </p>
      )}
      {canDownload && <p className="mt-xs m-0 text-[12px] font-semibold text-ink-mute">"Download PDF" opens the print window. Choose "Save as PDF" there.</p>}
    </div>
  );
}

/** The text that Copy text and Email a copy use, shown as it is, so it can be read and selected before it is pasted anywhere. */
export function DocTextFold({ text, title = 'Text version', hint = 'to paste into an email' }: { text: string; title?: string; hint?: string }) {
  return (
    <Fold className="no-print mt-md" title={title} hint={hint}>
      <pre className="legal-text" tabIndex={0} aria-label="The document as plain text">
        {text}
      </pre>
    </Fold>
  );
}

/** What a document knows that its email note can start from. Every part is optional and every one can be changed in the sheet. */
export interface EmailContext {
  kind: 'invoice' | 'contract' | 'doc';
  /** Who the note greets, from the client's contact: "Parag". */
  names?: string;
  engagement?: string;
  /** What goes with the note, one per line: "The invoice EX-001 for ₹54,000". */
  attached?: string[];
  amount?: string;
  period?: string;
  dueBy?: string;
  /** An agreement the client has already signed: the note offered first is the signed-copy one. */
  signed?: boolean;
  /** An invoice that belongs to a retainer month. */
  retainerMonth?: boolean;
}

const SELECT = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';

/**
 * Write the email: pick a note (the first send, this month's invoice, a renewal, a payment reminder and the rest), fill the few details, and the
 * words are written out for you to change. The sender's name, studio, phone and email come from Agency settings. Nothing is sent until you tap.
 */
function EmailNote({ ctx, onChange }: { ctx: EmailContext; onChange: (n: { subject: string; body: string }) => void }) {
  const settings = useAuthed(['agency', 'settings'], () => api.agency());
  const profile = settings.data?.settings.profile;
  const [key, setKey] = useState<string>(() => suggestEmailTemplate(ctx.kind, { retainerMonth: ctx.retainerMonth, signed: ctx.signed }));
  const [vars, setVars] = useState<EmailVars>(() => ({ ...emptyEmailVars(), names: ctx.names ?? '', engagement: ctx.engagement ?? '', attached: ctx.attached ?? [], amount: ctx.amount ?? '', period: ctx.period ?? '', dueBy: ctx.dueBy ?? '' }));
  const [signed, setSigned] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [typed, setTyped] = useState(false);
  // The sender's lines arrive with the settings, once.
  useEffect(() => {
    if (!profile || signed) return;
    setSigned(true);
    setVars((v) => ({ ...v, signName: profile.signerName || '', signStudio: profile.from.name, signPhone: profile.from.phone, signEmail: profile.from.email }));
  }, [profile, signed]);
  // The words follow the note and the details until the person types in them; "Start again" gives the control back.
  useEffect(() => {
    if (typed) return;
    const f = fillEmail(key, vars);
    setSubject(f.subject);
    setBody(f.body);
  }, [key, vars, typed]);
  useEffect(() => onChange({ subject, body }), [subject, body, onChange]);
  const set = (patch: Partial<EmailVars>) => setVars((v) => ({ ...v, ...patch }));
  const t = emailTemplate(key);
  return (
    <div className="grid gap-sm">
      <div>
        <label htmlFor="email-note-key" className="block text-[14px] font-bold">
          Which note
        </label>
        <select id="email-note-key" value={key} onChange={(e) => { setKey(e.target.value); setTyped(false); }} className={SELECT}>
          {EMAIL_TEMPLATES.map((n) => (
            <option key={n.key} value={n.key}>
              {n.name}
            </option>
          ))}
        </select>
        <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">{t.when}</p>
      </div>
      <Fold title="Fill in the details" hint="names, amount, day">
        <div className="grid gap-sm md:grid-cols-2">
          <Field id="en-names" label="Who it greets" value={vars.names} onChange={(v) => set({ names: v })} max={120} placeholder="Parag and Circle team" />
          <Field id="en-eng" label="What the work is called" value={vars.engagement} onChange={(v) => set({ engagement: v })} max={120} placeholder="one month Voxpop trial engagement" />
          <Field id="en-amt" label="Amount" value={vars.amount} onChange={(v) => set({ amount: v })} max={40} placeholder="₹30,000" />
          <Field id="en-per" label="Month or period" value={vars.period} onChange={(v) => set({ period: v })} max={60} placeholder="May 2026" />
          <Field id="en-due" label="Pay by or due on" value={vars.dueBy} onChange={(v) => set({ dueBy: v })} max={40} placeholder="1 May 2026" />
          <Field id="en-status" label="How the work stands" value={vars.status} onChange={(v) => set({ status: v })} max={160} placeholder="shoot completed, editing in progress" />
        </div>
        <div className="mt-sm">
          <label htmlFor="en-att" className="block text-[14px] font-bold">
            What is attached, one line each
          </label>
          <textarea id="en-att" rows={3} value={vars.attached.join('\n')} onChange={(e) => set({ attached: e.target.value.split('\n').slice(0, 8) })} className={SELECT} placeholder="The Service Agreement for the one month trial" />
        </div>
        <div className="mt-sm">
          <label htmlFor="en-more" className="block text-[14px] font-bold">
            Anything else to add
          </label>
          <textarea id="en-more" rows={2} value={vars.note} maxLength={1200} onChange={(e) => set({ note: e.target.value })} className={SELECT} />
        </div>
      </Fold>
      <Field id="en-subject" label="Subject" value={subject} onChange={(v) => { setSubject(v); setTyped(true); }} max={200} />
      <div>
        <label htmlFor="en-body" className="block text-[14px] font-bold">
          The email
        </label>
        <textarea id="en-body" rows={14} value={body} maxLength={EMAIL_NOTE_MAX} onChange={(e) => { setBody(e.target.value); setTyped(true); }} className={`${SELECT} font-medium leading-snug [text-wrap:wrap]`} />
        {typed && (
          <button type="button" onClick={() => setTyped(false)} className="toy-flat mt-xs rounded-pill px-sm py-xs text-[12px] font-bold">
            Start again from the note
          </button>
        )}
      </div>
    </div>
  );
}

/** Email a note and the client's link. The server sends it (ten an hour at most) and says plainly when email is not set up. */
export function EmailCopySheet({ open, onClose, route, id, defaultTo, text, context, noLinkYet = false }: { open: boolean; onClose: () => void; route: 'invoices' | 'contracts' | 'docs'; id: string; defaultTo: string; text: string; context: EmailContext; noLinkYet?: boolean }) {
  const qc = useQueryClient();
  const [to, setTo] = useState(defaultTo);
  const [msg, setMsg] = useState('');
  const [note, setNote] = useState({ subject: '', body: '' });
  const onNote = useCallback((n: { subject: string; body: string }) => setNote(n), []);
  useEffect(() => {
    if (open) {
      setTo(defaultTo);
      setMsg('');
    }
    // The address starts from the client's each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const send = useMutation({
    mutationFn: () => api.agencyEmailCopy(route, id, { to: to.trim() || undefined, message: note.body, subject: note.subject }),
    onSuccess: async (r) => {
      setMsg(r.note);
      await qc.invalidateQueries({ queryKey: ['agency', 'doc-log'] });
    },
    onError: (e) => setMsg(e instanceof ApiError ? e.message : 'That did not go. Try again.'),
  });
  const copyNote = async () => setMsg((await copyPlain(`${note.subject}\n\n${note.body}`)) ? 'Copied the subject and the email. Paste them into your own email.' : 'Copying did not work here. Select the text and copy it by hand.');
  return (
    <Sheet open={open} onClose={onClose} title="Email a copy">
      <div className="grid gap-sm pb-xl">
        <p className="m-0 text-[14px] font-semibold text-ink-soft">Pick a note, check the words, then send it from here with a link to the page, or copy it and send it from your own email with the PDF attached.</p>
        {noLinkYet && <p className="m-0 rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-yellow)' }}>It has not been sent yet, so there is no link. Send it first.</p>}
        <Field id="email-copy-to" label="Send to" type="email" value={to} onChange={setTo} max={120} placeholder="the client's email" />
        {open && <EmailNote ctx={context} onChange={onNote} />}
        {msg && (
          <p role="status" className="m-0 text-[14px] font-bold">
            {msg}
          </p>
        )}
        <div className="flex flex-wrap gap-xs">
          <Button onClick={() => send.mutate()} disabled={send.isPending || noLinkYet || !note.body.trim()}>
            {send.isPending ? 'Sending' : 'Send the email'}
          </Button>
          <Button variant="outline" onClick={copyNote}>
            Copy the email
          </Button>
          <Button variant="outline" onClick={async () => setMsg((await copyPlain(text)) ? 'Copied the document text. Paste it into your own email.' : 'Copying did not work here.')}>
            Copy the document text
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

const EVENT_NAME: Record<string, string> = { emailed: 'Emailed a copy to', 'email-not-sent': 'Tried to email a copy to', approved: 'Approved by' };

/** What was done with a document: emailed, approved. Only its owner sees this. */
export function DocLog({ type, id }: { type: DocType; id: string }) {
  const q = useAuthed(['agency', 'doc-log', type, id], () => api.agencyDocLog(type, id));
  const log = q.data?.log ?? [];
  if (log.length === 0) return <p className="m-0 text-[14px] font-semibold text-ink-soft">Nothing yet. When you email a copy or the client approves, it is noted here.</p>;
  return (
    <ul className="m-0 flex list-none flex-col gap-xs p-0">
      {log.map((l) => (
        <li key={l.id} className="text-[14px] font-semibold">
          {EVENT_NAME[l.event] ?? l.event} {l.detail} <span className="text-ink-soft">on {docDate(l.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Buttons on a list row: Download PDF and Print open the document with `?print=1`, which opens the print window as soon as it has loaded;
 * Copy text fetches the document and copies its text version; Email a copy opens the document's email sheet.
 */
export function DocRowActions({ path, getText }: { path: string; getText: () => Promise<string> }) {
  const nav = useNavigate();
  const [note, setNote] = useState('');
  return (
    <div className="no-print">
      <div className="flex flex-wrap gap-xs">
        <Button size="sm" variant="outline" onClick={() => nav(`${path}?print=1`)}>
          Download PDF
        </Button>
        <Button size="sm" variant="outline" onClick={() => nav(`${path}?print=1`)}>
          Print
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              setNote((await copyPlain(await getText())) ? 'Copied.' : 'Open it to copy the text.');
            } catch {
              setNote('That did not load. Try again.');
            }
            window.setTimeout(() => setNote(''), 3000);
          }}
        >
          Copy text
        </Button>
        <Button size="sm" variant="outline" onClick={() => nav(`${path}?email=1`)}>
          Email a copy
        </Button>
      </div>
      {note && (
        <p role="status" className="mt-xs m-0 text-[12px] font-bold">
          {note}
        </p>
      )}
    </div>
  );
}
