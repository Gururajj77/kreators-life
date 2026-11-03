import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { ApiError, api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { tie } from '../lib/text';
import { AnimatedIcon } from './AnimatedIcon';
import { PortalSecurityCard } from './AgencyLifecycle';
import { Button } from './Button';
import { copyPlain } from '../lib/clipboard';
import { ReadyEmail, type EmailContext } from './DocActions';
import { Fold } from './Fold';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';

/** The client page that holds the password for a document's link: the same query the client page uses, so both read one copy. */
function useClientPage(clientId: string | null | undefined) {
  return useAuthed(['agency', 'client', clientId ?? ''], () => api.agencyClient(clientId ?? ''), Boolean(clientId));
}

/**
 * The one Share button on a document's page: it opens the Share sheet, and says "No password" beside its label when the link the client
 * holds is open to anyone who has it. The password is the saved client's, so an unsaved pick of another client says nothing yet.
 */
export function ShareButton({ onClick, savedClientId, hasLink }: { onClick: () => void; savedClientId: string | null; hasLink: boolean }) {
  const q = useClientPage(savedClientId);
  const open = hasLink && Boolean(q.data) && !q.data?.lifecycle.password.set;
  return (
    <Button variant="outline" onClick={onClick} aria-haspopup="dialog">
      <AnimatedIcon name="share" size={18} />
      Share
      {open && <StatusTag tone="warn">No password</StatusTag>}
    </Button>
  );
}

/** Whether the saved client's password guards this link, the same words for every document, and the controls one tap away. */
function SharePassword({ clientId, savedClientId, clientName }: { clientId: string | null; savedClientId: string | null; clientName: string }) {
  const [editing, setEditing] = useState(false);
  const q = useClientPage(savedClientId);
  const page = q.data;
  if (!clientId && !savedClientId) {
    return <p className="m-0 text-[14px] font-semibold text-ink-soft">Pick a client for this document to protect its link with a password.</p>;
  }
  // The client picked on the page is not saved yet: the live link still follows the client it was saved with, so its password says nothing yet.
  if (clientId !== savedClientId) {
    return <p className="m-0 text-[14px] font-semibold text-ink-soft">Save your change of client first. Until then the link follows the password of the client it was saved with.</p>;
  }
  if (q.isError && !page) {
    const gone = q.error instanceof ApiError && q.error.status === 404;
    return (
      <div role="alert" className="flex flex-col items-start gap-xs sm:flex-row sm:items-center">
        <StatusTag tone="warn">{gone ? 'Client gone' : 'Not checked'}</StatusTag>
        <p className="m-0 min-w-0 flex-1 text-[14px] font-semibold text-ink-soft">{gone ? 'The client for this document was removed. Pick another client to protect its link.' : 'We could not check the password just now.'}</p>
        {!gone && (
          <Button size="sm" variant="outline" onClick={() => void q.refetch()} disabled={q.isFetching}>
            {q.isFetching ? 'Checking' : 'Try again'}
          </Button>
        )}
      </div>
    );
  }
  const set = page?.lifecycle.password.set;
  return (
    <div className="grid gap-sm">
      {/* The words take the whole line on a phone and the button sits under them, so the sentence is never squeezed beside it. */}
      <div className="flex flex-col items-start gap-xs sm:flex-row sm:items-center">
        <StatusTag tone={set ? 'good' : 'warn'}>{page ? (set ? 'Password set' : 'No password') : 'Checking'}</StatusTag>
        <p className="m-0 min-w-0 flex-1 text-[14px] font-semibold text-ink-soft">
          {tie(set ? `${clientName || 'The client'} types a password before they can read this link. It is the same one for their page and every document sent to them.` : 'Anyone with this link can open it. Set a password and the client types it first.')}
        </p>
        <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)} disabled={!page} aria-expanded={editing}>
          {editing ? 'Close' : set ? 'Change the password' : 'Set a password'}
        </Button>
      </div>
      {editing && page && <PortalSecurityCard client={page.client} life={page.lifecycle} />}
    </div>
  );
}

/**
 * Everything about sharing one document, in one sheet: the client's link (copy it, open it as the client), whether the client's password
 * guards it, Email a copy, Download or print, and the email to send with it, written from the records and ready to copy. The document's
 * own text is only a secondary copy here ("Copy the full text") and the PDF.
 */
export function ShareSheet({
  open,
  onClose,
  link,
  noLink,
  clientId,
  savedClientId,
  clientName,
  text,
  email,
  onEmail,
  onPrint,
}: {
  open: boolean;
  onClose: () => void;
  /** The client's link, or '' when there is none yet (a draft, a voided paper). */
  link: string;
  /** Why there is no link yet, in a sentence. */
  noLink: string;
  /** The client picked on the page now. */
  clientId: string | null;
  /** The client the document was saved with: the one whose password guards the live link. */
  savedClientId: string | null;
  clientName: string;
  /** The whole document as plain text, for "Copy the full text". */
  text: string;
  /** What the ready email is written from. */
  email: EmailContext;
  onEmail: () => void;
  onPrint: () => void;
}) {
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState<'link' | 'text' | null>(null);
  const say = (what: 'link' | 'text', ok: boolean) => {
    setCopied(ok ? what : null);
    setNote(ok ? (what === 'link' ? 'Link copied.' : 'Copied the full text.') : what === 'link' ? 'Copying did not work here. Select the link and copy it by hand.' : 'Copying did not work here. Use Download or print instead.');
    window.setTimeout(() => {
      setNote('');
      setCopied(null);
    }, 3000);
  };
  const row = 'fx-row text-ink';
  return (
    <Sheet open={open} onClose={onClose} title="Share">
      <div className="grid gap-md pb-xl">
        <section aria-labelledby="share-link-h" className="grid gap-xs">
          <h3 id="share-link-h" className="m-0 text-[16px] font-extrabold">
            The client's link
          </h3>
          {link ? (
            <>
              <input readOnly value={link} aria-label="Link for the client" onFocus={(e) => e.currentTarget.select()} className="min-h-[44px] w-full min-w-0 rounded-pill border-2 border-line bg-paper px-sm font-mono text-[14px]" />
              <div className="flex flex-wrap gap-xs">
                <Button size="sm" variant="outline" onClick={async () => say('link', await copyPlain(link))}>
                  <AnimatedIcon name="copy" size={18} active={copied === 'link'} />
                  {copied === 'link' ? 'Copied' : 'Copy link'}
                </Button>
                <a href={link} target="_blank" rel="noopener noreferrer" className="toy toy-ink inline-flex min-h-[44px] items-center gap-xs rounded-pill border border-ink/30 bg-card-strong px-sm text-[14px] font-semibold text-ink">
                  <Icon icon={ExternalLink} size={18} />
                  Open as the client
                </a>
              </div>
            </>
          ) : (
            <p className="m-0 text-[14px] font-semibold text-ink-soft">{noLink}</p>
          )}
        </section>

        <section aria-labelledby="share-pass-h" className="grid gap-xs">
          <h3 id="share-pass-h" className="m-0 text-[16px] font-extrabold">
            Password
          </h3>
          <SharePassword clientId={clientId} savedClientId={savedClientId} clientName={clientName} />
        </section>

        <ul className="fx-inset" aria-label="Send it another way">
          <li>
            <button
              type="button"
              className={row}
              onClick={() => {
                onClose();
                onEmail();
              }}
            >
              <AnimatedIcon name="mail" size={20} className="shrink-0" />
              <span className="min-w-0 flex-1 text-[16px] font-bold">Email a copy</span>
            </button>
          </li>
          <li>
            <button type="button" className={row} onClick={async () => say('text', await copyPlain(text))}>
              <AnimatedIcon name="copy" size={20} active={copied === 'text'} className="shrink-0" />
              <span className="min-w-0 flex-1 text-[16px] font-bold">{copied === 'text' ? 'Copied the full text' : 'Copy the full text'}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className={row}
              onClick={() => {
                onClose();
                onPrint();
              }}
            >
              <AnimatedIcon name="download" size={20} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold">Download or print</span>
                <span className="block text-[12px] font-semibold text-ink-mute">Choose Save as PDF in the print window to download it.</span>
              </span>
            </button>
          </li>
        </ul>
        {note && (
          <p role="status" className="m-0 text-[14px] font-bold">
            {note}
          </p>
        )}
        <Fold title="The email to send with it" hint="ready to paste" defaultOpen>
          <ReadyEmail ctx={email} />
        </Fold>
      </div>
    </Sheet>
  );
}
