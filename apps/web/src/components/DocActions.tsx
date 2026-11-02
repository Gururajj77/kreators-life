import { docDate, type DocType } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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

/** Email the text version and the client's link. The server sends it (ten an hour at most) and says plainly when email is not set up. */
export function EmailCopySheet({ open, onClose, route, id, defaultTo, text, noLinkYet = false }: { open: boolean; onClose: () => void; route: 'invoices' | 'contracts' | 'docs'; id: string; defaultTo: string; text: string; noLinkYet?: boolean }) {
  const qc = useQueryClient();
  const [to, setTo] = useState(defaultTo);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (open) {
      setTo(defaultTo);
      setMsg('');
    }
    // The address starts from the client's each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const send = useMutation({
    mutationFn: () => api.agencyEmailCopy(route, id, to.trim() || undefined),
    onSuccess: async (r) => {
      setMsg(r.note);
      await qc.invalidateQueries({ queryKey: ['agency', 'doc-log'] });
    },
    onError: (e) => setMsg(e instanceof ApiError ? e.message : 'That did not go. Try again.'),
  });
  return (
    <Sheet open={open} onClose={onClose} title="Email a copy">
      <div className="grid gap-sm pb-xl">
        <p className="m-0 text-[14px] font-semibold text-ink-soft">This sends the words below and a link to the page, from our server, to the address you choose. You can also copy the text and send it from your own email.</p>
        {noLinkYet && <p className="m-0 rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-yellow)' }}>It has not been sent yet, so there is no link. Send it first.</p>}
        <Field id="email-copy-to" label="Send to" type="email" value={to} onChange={setTo} max={120} placeholder="the client's email" />
        <div>
          <p className="m-0 text-[14px] font-bold">What goes in the email</p>
          <pre className="legal-text" tabIndex={0}>
            {text}
          </pre>
        </div>
        {msg && (
          <p role="status" className="m-0 text-[14px] font-bold">
            {msg}
          </p>
        )}
        <div className="flex flex-wrap gap-xs">
          <Button onClick={() => send.mutate()} disabled={send.isPending || noLinkYet}>
            {send.isPending ? 'Sending' : 'Send the email'}
          </Button>
          <Button
            variant="outline"
            onClick={async () => setMsg((await copyPlain(text)) ? 'Copied. Paste it into your own email.' : 'Copying did not work here. Select the text above and copy it by hand.')}
          >
            Copy text instead
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
