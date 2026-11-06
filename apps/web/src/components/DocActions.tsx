import { docDate, MAX_TEMPLATES, TEMPLATE_NAME_MAX, type AgencySettings, type DocType } from '@kreators/shared';
import { EMAIL_NOTE_MAX, EMAIL_SUBJECT_MAX, EMAIL_TEMPLATES, emailTemplate, emailVarsFor, fillEmail, suggestEmailTemplate, type EmailGap, type EmailVars } from '@kreators/shared/agencyEmail';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useState, type CSSProperties } from 'react';
import { api, ApiError } from '../lib/api';
import { copyPlain } from '../lib/clipboard';
import { printAs } from '../lib/printDoc';
import { useAuthed } from '../lib/queries';
import { FIELD, LABEL } from '../lib/ui';
import { AnimatedIcon } from './AnimatedIcon';
import { Button } from './Button';
import { Field } from './InvoiceView';
import { Sheet } from './Sheet';

/** The one print button a document has, "Download". A PDF is the browser's own print and save (the hint says so), so Download and Print are one action. */
export function PrintButton({ onPrint, size = 'md', variant = 'outline', full = false }: { onPrint: () => void; size?: 'sm' | 'md'; variant?: 'outline' | 'primary'; full?: boolean }) {
  const hint = useId();
  return (
    <>
      <Button size={size} variant={variant} full={full} onClick={onPrint} aria-describedby={hint}>
        <AnimatedIcon name="download" size={18} />
        Download
      </Button>
      <span id={hint} className="sr-only">
        Opens the print window. Choose Save as PDF there to download it.
      </span>
    </>
  );
}

/**
 * The print button where a client reads a document (an invoice, an agreement or another document): shown only where the document allows
 * it. The owner's pages have it beside Share instead, with the link, the text and the email inside the Share sheet.
 */
export function DocActions({ fileName, canDownload = true, onPrint, className = '' }: { fileName: string; canDownload?: boolean; /** Print in some other way (an invoice prints the client's version). */ onPrint?: () => void; className?: string }) {
  if (!canDownload) return null;
  return (
    <div className={`no-print ${className}`}>
      <PrintButton size="sm" onPrint={onPrint ?? (() => printAs(fileName))} />
    </div>
  );
}

/**
 * On a phone, a long agreement puts its answer form thousands of pixels down: this bar stays at the foot of the screen and jumps to the
 * form (`targetId`, its heading), then moves the keyboard to the first field. It hides itself while the form is on screen, and on a laptop.
 */
export function JumpToBar({ targetId, label }: { targetId: string; label: string }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const form = el.closest('form') ?? el;
    const io = new IntersectionObserver(([e]) => setShown(!e?.isIntersecting), { threshold: 0.05 });
    io.observe(form);
    return () => io.disconnect();
  }, [targetId]);
  if (!shown) return null;
  const jump = () => {
    const el = document.getElementById(targetId);
    if (!el) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    const first = (el.closest('form') ?? el.parentElement)?.querySelector<HTMLElement>('input, textarea, button');
    window.setTimeout(() => first?.focus({ preventScroll: true }), still ? 0 : 400);
  };
  return (
    <div className="no-print sticky bottom-[calc(var(--spacing-sm)+env(safe-area-inset-bottom))] z-30 mt-md md:hidden">
      <Button full onClick={jump}>
        {label}
      </Button>
    </div>
  );
}

/** A destructive step asked once more in a sheet: what will happen, a red button that does it and a quiet one that does not. */
export function ConfirmSheet({ open, onClose, title, body, action, onConfirm, busy = false }: { open: boolean; onClose: () => void; title: string; body: string; action: string; onConfirm: () => void; busy?: boolean }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="grid gap-md pb-xl">
        <p className="m-0 text-callout text-ink-soft">{body}</p>
        <div className="flex flex-wrap gap-xs">
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            disabled={busy}
            className="toy inline-flex min-h-[48px] items-center justify-center rounded-pill bg-r1 px-md text-callout text-on-fill disabled:opacity-50"
            style={{ '--toy-color': 'var(--deep-servant_leader)' } as CSSProperties}
          >
            {action}
          </button>
          <Button variant="outline" onClick={onClose}>
            Keep it
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/** What a document knows that its email note is written from: the client and the profile are read from the records. */
export interface EmailContext {
  kind: 'invoice' | 'contract' | 'doc';
  /** The client the document is for: their contact, stage and month come from their record. */
  clientId?: string | null;
  /** The document's title, as printed. */
  title?: string;
  /** The invoice number or the document's reference. */
  number?: string;
  amount?: string;
  period?: string;
  dueBy?: string;
  /** An agreement the client has already signed: the note offered first is the signed-copy one. */
  signed?: boolean;
  /** An invoice that belongs to a retainer month. */
  retainerMonth?: boolean;
  overdue?: boolean;
  paid?: boolean;
  advance?: boolean;
  /** The agreement's template or the document's kind. */
  docKind?: string;
}

/** A saved note is picked by its id, kept apart from the built-in keys. */
const OWN = 'own:';

/** The records a note is written from: the client's page (their contact, stage and month, and the settings) or, with no client, the settings alone. */
function useEmailFacts(ctx: EmailContext) {
  const page = useAuthed(['agency', 'client', ctx.clientId ?? ''], () => api.agencyClient(ctx.clientId ?? ''), Boolean(ctx.clientId));
  const overview = useAuthed(['agency', 'settings'], () => api.agency(), !ctx.clientId);
  const settings = page.data?.settings ?? overview.data?.settings;
  const client = page.data?.client;
  const facts = emailVarsFor({
    kind: ctx.kind,
    client: client ? { name: client.name, contactName: client.contactName, month: client.month } : null,
    profile: settings ? settings.profile : null,
    title: ctx.title,
    number: ctx.number,
    amount: ctx.amount,
    dueBy: ctx.dueBy,
    period: ctx.period,
    docKind: ctx.docKind,
    advance: ctx.advance,
  });
  const suggested = suggestEmailTemplate(ctx.kind, { stage: client?.stage, retainerMonth: ctx.retainerMonth, signed: ctx.signed, overdue: ctx.overdue, paid: ctx.paid, docKind: ctx.docKind });
  return { ...facts, suggested, ready: Boolean(settings) && (!ctx.clientId || Boolean(client)), client, settings };
}

/**
 * A value a note needs that no record holds: one line, typed once, saved where it belongs (the client's record or the business profile),
 * and every note and document after it fills from there.
 */
function AddOnce({ gap, clientId, settings }: { gap: EmailGap; clientId?: string | null; settings?: AgencySettings }) {
  const qc = useQueryClient();
  const id = useId();
  const [value, setValue] = useState('');
  const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: async () => {
      const v = value.trim();
      if (gap.where === 'client') {
        if (!clientId) throw new Error('Pick a client first.');
        await api.agencyClientUpdate(clientId, { contactName: v });
        return;
      }
      if (!settings) throw new Error('Your settings are still loading.');
      const pr = settings.profile;
      const from = { ...pr.from, ...(gap.key === 'businessName' ? { name: v } : gap.key === 'phone' ? { phone: v } : gap.key === 'email' ? { email: v } : {}) };
      await api.agencySettings({ profile: { ...pr, from, signerName: gap.key === 'signerName' ? v : pr.signerName } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agency'] }),
    onError: (e: Error) => setErr(e.message),
  });
  return (
    <form
      className="flex flex-wrap items-end gap-xs"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) save.mutate();
      }}
    >
      <label htmlFor={id} className="min-w-0 flex-1 basis-[220px]">
        <span className={LABEL}>{`Add ${gap.label} once`}</span>
        <input id={id} value={value} onChange={(e) => setValue(e.target.value)} maxLength={120} type={gap.key === 'email' ? 'email' : 'text'} className={FIELD} />
      </label>
      <Button size="sm" type="submit" disabled={!value.trim() || save.isPending}>
        {save.isPending ? 'Saving' : gap.where === 'client' ? 'Save to the client' : 'Save to your profile'}
      </Button>
      <p className="m-0 w-full text-caption text-ink-soft">{gap.where === 'client' ? 'Saved on the client. Every note after this fills it in.' : 'Saved on your profile. Every note after this fills it in.'}</p>
      {err && <p role="alert" className="m-0 w-full text-subhead text-r1">{err}</p>}
    </form>
  );
}

/** The lines asking for what no record holds yet. Nothing when every value is there. */
function AddOnceLines({ missing, clientId, settings }: { missing: EmailGap[]; clientId?: string | null; settings?: AgencySettings }) {
  if (missing.length === 0) return null;
  return (
    <div className="grid gap-sm rounded-tile bg-paper p-sm">
      {missing.map((g) => (
        <AddOnce key={g.key} gap={g} clientId={clientId} settings={settings} />
      ))}
    </div>
  );
}

/**
 * Write the email: the note this moment needs is picked and filled from the records (the client, the document, the business profile);
 * another can be picked, the words changed, and any note kept as your own ("Save this note"), renamed or removed. What no record holds is
 * asked once and saved where it belongs. Nothing is sent until you tap.
 */
function EmailNote({ ctx, onChange }: { ctx: EmailContext; onChange: (n: { subject: string; body: string }) => void }) {
  const qc = useQueryClient();
  const f = useEmailFacts(ctx);
  const mine = useAuthed(['agency', 'templates', 'email'], () => api.agencyTemplates('email'));
  const own = (mine.data?.templates ?? []).filter((t) => t.scope === 'own' && t.kind === 'email' && t.email);
  const [chosenKey, setKey] = useState<string | null>(null);
  const key = chosenKey ?? f.suggested;
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [typed, setTyped] = useState(false);
  // Saving, renaming and removing a note of your own: one small form at a time. Remove and Start again ask with a second tap, which
  // clears itself after four seconds.
  const [naming, setNaming] = useState<'save' | 'rename' | null>(null);
  const [name, setName] = useState('');
  const [armed, setArmed] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!armed && !resetting) return;
    const timer = window.setTimeout(() => {
      setArmed(false);
      setResetting(false);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [armed, resetting]);
  const picked = key.startsWith(OWN) ? own.find((t) => `${OWN}${t.id}` === key) : undefined;
  const varsKey = JSON.stringify(f.vars);
  // The words follow the note and the records until the person types in them; "Start again" gives the control back. A saved note is its
  // own words, as it was kept.
  useEffect(() => {
    if (typed) return;
    if (key.startsWith(OWN)) {
      if (!picked?.email) return;
      setSubject(picked.email.subject);
      setBody(picked.email.message);
      return;
    }
    const filled = fillEmail(key, JSON.parse(varsKey) as EmailVars);
    setSubject(filled.subject);
    setBody(filled.body);
  }, [key, varsKey, typed, picked]);
  useEffect(() => onChange({ subject, body }), [subject, body, onChange]);
  const t = picked ? null : emailTemplate(key);
  const refresh = () => qc.invalidateQueries({ queryKey: ['agency', 'templates', 'email'] });
  const sameName = own.find((n) => n.name.trim().toLowerCase() === name.trim().toLowerCase());
  const keep = useMutation({
    mutationFn: async () => {
      if (naming === 'rename' && picked) {
        const change = { name: name.trim() };
        await api.agencyTemplateUpdate(picked.id, change);
        return { id: picked.id, note: 'Renamed.' };
      }
      // A note with the same name is replaced, so saving again after a change keeps one copy.
      const words = { name: name.trim(), subject, message: body };
      if (sameName) {
        await api.agencyTemplateUpdate(sameName.id, words);
        return { id: sameName.id, note: `Saved over "${sameName.name}".` };
      }
      const r = await api.agencyTemplateAdd({ kind: 'email' as const, ...words });
      return { id: r.id, note: 'Saved. It is under Your notes from now on.' };
    },
    onSuccess: async (r) => {
      await refresh();
      setNaming(null);
      setMsg(r.note);
      setKey(`${OWN}${r.id}`);
      setTyped(false);
      setResetting(false);
    },
    onError: (e: Error) => setMsg(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.agencyTemplateRemove(id),
    onSuccess: async () => {
      await refresh();
      setArmed(false);
      setResetting(false);
      setMsg('Removed.');
      setKey(null);
      setTyped(false);
    },
    onError: (e: Error) => setMsg(e.message),
  });
  return (
    <div className="grid gap-sm">
      <div>
        <label htmlFor="email-note-key" className={LABEL}>
          Which note
        </label>
        <select
          id="email-note-key"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setTyped(false);
            setNaming(null);
            setArmed(false);
            setResetting(false);
            setMsg('');
          }}
          className={FIELD}
        >
          <optgroup label="Notes to start from">
            {EMAIL_TEMPLATES.map((n) => (
              <option key={n.key} value={n.key}>
                {n.name}
              </option>
            ))}
          </optgroup>
          {own.length > 0 && (
            <optgroup label="Your notes">
              {own.map((n) => (
                <option key={n.id} value={`${OWN}${n.id}`}>
                  {n.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {t && <p className="mt-xs m-0 text-caption text-ink-soft">{t.when}</p>}
        {picked && <p className="mt-xs m-0 text-caption text-ink-soft">Your own note, as you saved it.</p>}
        {picked && (
          <div className="mt-xs flex flex-wrap gap-xs">
            <Button size="sm" variant="outline" onClick={() => { setName(picked.name); setNaming('rename'); setMsg(''); }}>
              Rename
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="!text-r1"
              disabled={remove.isPending}
              onClick={() => {
                if (armed) remove.mutate(picked.id);
                else {
                  setResetting(false);
                  setArmed(true);
                }
              }}
            >
              <span aria-live="polite">{armed ? 'Tap again to remove it' : 'Remove'}</span>
            </Button>
          </div>
        )}
      </div>
      {!picked && <AddOnceLines missing={f.missing} clientId={ctx.clientId} settings={f.settings} />}
      <div>
        <Field id="en-subject" label="Subject" value={subject} onChange={(v) => { setSubject(v); setTyped(true); }} max={EMAIL_SUBJECT_MAX} />
        <p className="mt-xs m-0 text-caption text-ink-soft">The line they see first in their inbox.</p>
      </div>
      <div>
        <label htmlFor="en-body" className={LABEL}>
          The email
        </label>
        <textarea id="en-body" rows={14} value={body} maxLength={EMAIL_NOTE_MAX} onChange={(e) => { setBody(e.target.value); setTyped(true); }} className={`${FIELD} leading-snug [text-wrap:wrap]`} />
        <p className="mt-xs m-0 text-caption text-ink-soft">Send it from here and the link to the page goes under your words.</p>
        <div className="mt-xs flex flex-wrap gap-xs">
          {typed && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (resetting) {
                  setResetting(false);
                  setTyped(false);
                } else {
                  setArmed(false);
                  setResetting(true);
                }
              }}
            >
              <span aria-live="polite">{resetting ? 'Tap again to start again' : 'Start again from the note'}</span>
            </Button>
          )}
          {naming === null && (
            <Button
              size="sm"
              variant="outline"
              disabled={!body.trim() || own.length >= MAX_TEMPLATES}
              onClick={() => {
                setName(picked ? picked.name : (t?.name ?? 'My note').slice(0, TEMPLATE_NAME_MAX));
                setNaming('save');
                setMsg('');
              }}
            >
              Save this note as a template
            </Button>
          )}
        </div>
      </div>
      {naming && (
        <div className="grid gap-xs rounded-tile bg-paper p-sm">
          <div>
            <Field id="en-save-name" label={naming === 'rename' ? 'New name' : 'Name for this note'} value={name} onChange={setName} max={TEMPLATE_NAME_MAX} />
            <p className="mt-xs m-0 text-caption text-ink-soft">You pick it under Your notes next time.</p>
          </div>
          {naming === 'save' && sameName && <p className="m-0 text-subhead text-ink-soft">{`You have a note called "${sameName.name}". Saving puts these words in it.`}</p>}
          <div className="flex flex-wrap gap-xs">
            <Button size="sm" className="flex-1" onClick={() => keep.mutate()} disabled={!name.trim() || keep.isPending}>
              {keep.isPending ? 'Saving' : naming === 'rename' ? 'Rename it' : 'Save the note'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNaming(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {msg && (
        <p role="status" className="m-0 text-subhead">
          {msg}
        </p>
      )}
    </div>
  );
}

/** Email a note and the client's link. The server sends it (ten an hour at most) and says plainly when email is not set up. */
export function EmailCopySheet({ open, onClose, route, id, defaultTo, context, noLinkYet = false }: { open: boolean; onClose: () => void; route: 'invoices' | 'contracts' | 'docs'; id: string; defaultTo: string; context: EmailContext; noLinkYet?: boolean }) {
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
  const copyNote = async () => setMsg((await copyPlain(`Subject: ${note.subject}\n\n${note.body}`)) ? 'Copied the subject and the email. Paste them into your own email.' : 'Copying did not work here. Select the text and copy it by hand.');
  return (
    <Sheet open={open} onClose={onClose} title="Email a copy">
      <div className="grid gap-sm pb-xl">
        <p className="m-0 text-subhead text-ink-soft">Pick a note, check the words, then send it from here with a link to the page, or copy it and send it from your own email with the PDF attached.</p>
        {noLinkYet && <p className="m-0 rounded-tile p-sm text-subhead" style={{ background: 'var(--tint-yellow)' }}>It has not been sent yet, so there is no link. Send it first.</p>}
        <div>
          <Field id="email-copy-to" label="Send to" type="email" value={to} onChange={setTo} max={120} placeholder="the client's email" />
          <p className="mt-xs m-0 text-caption text-ink-soft">Left empty, it goes to the client's email on record.</p>
        </div>
        {open && <EmailNote ctx={context} onChange={onNote} />}
        {msg && (
          <p role="status" className="m-0 text-subhead">
            {msg}
          </p>
        )}
        <div className="flex flex-wrap gap-xs">
          <Button className="flex-1" onClick={() => send.mutate()} disabled={send.isPending || noLinkYet || !note.body.trim()}>
            <AnimatedIcon name={send.isPending ? 'loading' : 'mail'} size={18} />
            {send.isPending ? 'Sending' : 'Send the email'}
          </Button>
          <Button variant="outline" onClick={copyNote}>
            Copy the email
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
  if (log.length === 0) return <p className="m-0 text-subhead text-ink-soft">Nothing yet. When you email a copy or the client approves, it is noted here.</p>;
  return (
    <ul className="m-0 flex list-none flex-col gap-xs p-0">
      {log.map((l) => (
        <li key={l.id} className="text-subhead">
          {EVENT_NAME[l.event] ?? l.event} {l.detail} <span className="text-ink-soft">on {docDate(l.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
