import { contractAsText, docRef, formatCount, CONTRACT_STATUS_NAME, CONTRACT_STATUS_TONE, parseDocStyle, type ContractDoc, type DocComment, type TagTone } from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useState, type ReactNode } from 'react';
import { ArchiveRestore, Ban, Building2, ClipboardCopy, CopyPlus, KeyRound, LayoutTemplate, Link2, ListChecks, Mail, MessageSquare, Palette, Send, ShieldCheck, Trash2, Undo2, UserRound } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '../components/Button';
import { ContractView, paperDate } from '../components/ContractView';
import { ConfirmSheet, DocLog, EmailCopySheet, type EmailContext } from '../components/DocActions';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { DocStyleSheet } from '../components/DocStyleSheet';
import { blanksIn, FillDetailsSheet } from '../components/FillDetails';
import { HouseTemplateSheet, useSuperAdmin } from '../components/HouseTemplateButton';
import { Icon } from '../components/Icon';
import { DocPassword } from '../components/AgencyLifecycle';
import { MoreMenu, type MoreMenuItem } from '../components/MoreMenu';
import { Busy, Skeleton, SkeletonCard } from '../components/Skeleton';
import type { SheetStamp } from '../components/PrintSheet';
import { Inert } from '../components/Inert';
import { BackLink } from '../components/PageHeader';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { StatusTag } from '../components/StatusTag';
import { Toggle } from '../components/Toggle';
import { api, ApiError } from '../lib/api';
import { copyPlain } from '../lib/clipboard';
import { fileTitle, printAs, useAutoPrint } from '../lib/printDoc';
import { tie } from '../lib/text';
import { FIELD } from '../lib/ui';
import { useAutosave } from '../lib/useAutosave';

export const COPY = {
  law: 'Typed acceptance, not a certified e-signature. A starting point, not legal advice: have a lawyer read it before you rely on it.',
};

/** Lines from the client since your own last reply: what is waiting for you. */
export function waitingFrom(comments: readonly DocComment[]): number {
  const lastMine = comments.map((c) => c.author).lastIndexOf('me');
  return comments.slice(lastMine + 1).filter((c) => c.author === 'client').length;
}

/** What the paper editor saves: the document and the client it is for. */
export interface PaperState {
  doc: ContractDoc;
  clientId: string | null;
}

/**
 * The paper of one document, edited in place and saved as you go. `load` gives the server's copy and its version; the hook keeps the
 * page's own copy, saves it 800 ms after the last change with that version, and on a 409 refetches and starts again from the server.
 */
export function usePaperDoc({ id, server, refetch, save, enabled }: { id: string; server: { doc: ContractDoc; clientId: string | null; updatedAt: string } | undefined; refetch: () => Promise<unknown>; save: (s: PaperState, version: string) => Promise<string>; enabled: boolean }) {
  const [state, setState] = useState<PaperState | null>(null);
  const [reloads, setReloads] = useState(0);
  const auto = useAutosave<PaperState>({
    value: state,
    save,
    restore: setState,
    onConflict: useCallback(() => {
      void refetch().then(() => setReloads((n) => n + 1));
    }, [refetch]),
    enabled,
  });
  // The page starts from the server once per document, and again only after a conflict: a save of our own never resets what is typed.
  useEffect(() => {
    if (!server) return;
    const s = { doc: server.doc, clientId: server.clientId };
    setState(s);
    auto.reset(s, server.updatedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reloads, Boolean(server)]);
  return { state, setState, auto };
}

/** A few words that say what a tap did ("The link copied."), gone after three seconds. */
export function useSaid(): [string, (s: string) => void] {
  const [said, setSaid] = useState('');
  useEffect(() => {
    if (!said) return;
    const t = window.setTimeout(() => setSaid(''), 3000);
    return () => window.clearTimeout(t);
  }, [said]);
  return [said, setSaid];
}

/** The quiet line beside the status: Saving, Saved (with Undo for the last change), or what went wrong. */
export function SaveLine({ words, canUndo, onUndo }: { words: string; canUndo: boolean; onUndo: () => void }) {
  return (
    <span className="inline-flex min-h-[24px] items-center gap-xs">
      <span role="status" className="text-[12px] font-semibold text-ink-mute">
        {words}
      </span>
      {canUndo && words === 'Saved' && (
        <button type="button" onClick={onUndo} className="min-h-[24px] rounded-pill px-xs text-[12px] font-bold text-ink-soft underline underline-offset-2 hover:text-ink">
          Undo
        </button>
      )}
    </span>
  );
}

/** The top of a document page: back, the title, one status, the save line, then one main action, Download and More. Nothing else. */
export function DocHeader({ back, backLabel, title, tone, status, save, primary, onDownload, more, moreLabel, error }: { back: string; backLabel: string; title: string; tone: TagTone; status: string; save: ReactNode; primary: ReactNode; onDownload: () => void; more: MoreMenuItem[]; moreLabel: string; error: unknown }) {
  const hint = useId();
  return (
    <AppCover
      // A document's title is long ("TRIAL ENGAGEMENT AGREEMENT"): on a phone it keeps the old header's 24px with its last two words
      // tied, so no word stands alone and none breaks; from md it is the cover's large title. A string, so the condensed bar keeps it.
      className="no-print [&_h1]:text-[24px]! md:[&_h1]:text-[length:var(--text-large-title)]!"
      back={{ to: back, label: backLabel }}
      title={tie(title)}
      lede={
        <span className="inline-flex flex-wrap items-center justify-end gap-x-sm gap-y-xs">
          {/* The save line first, so the status ends flush with the title even while the line is empty. */}
          {save}
          <StatusTag tone={tone}>{status}</StatusTag>
        </span>
      }
      actions={
        <>
          {primary}
          {/* Download as an icon on a phone, so the main action, Download and More share the cover's line without a label breaking. */}
          <Button variant="outline" onClick={onDownload} aria-label="Download a PDF" aria-describedby={hint}>
            <AnimatedIcon name="download" size={18} />
            <span className="hidden sm:inline">Download</span>
          </Button>
          <span id={hint} className="sr-only">
            Opens the print window. Choose Save as PDF there to download it.
          </span>
          <MoreMenu items={more} label={moreLabel} />
        </>
      }
    >
      {Boolean(error) && (
        <p role="alert" className="m-0 rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-red)' }}>
          {error instanceof ApiError ? error.message : 'That did not work. Try again.'}
        </p>
      )}
    </AppCover>
  );
}

/** The sheets behind More that a document page shares: the client, comments and activity, and saving as a template. */
export function ClientSheet({ open, onClose, value, onChange, clients }: { open: boolean; onClose: () => void; value: string | null; onChange: (id: string | null) => void; clients: { id: string; name: string }[] }) {
  return (
    <Sheet open={open} onClose={onClose} title="Client">
      <label className="block text-[14px] font-bold" htmlFor="paper-client">
        Who it is for
        <select id="paper-client" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} className={FIELD}>
          <option value="">No client</option>
          {clients.map((cl) => (
            <option key={cl.id} value={cl.id}>
              {cl.name}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-md pb-xl">
        <Button onClick={onClose}>Done</Button>
      </div>
    </Sheet>
  );
}

export function TemplateSheet({ open, onClose, defaultName, kind, fromId, beforeSave, existing }: { open: boolean; onClose: () => void; defaultName: string; kind: 'contract' | 'doc'; fromId: string; beforeSave: () => Promise<unknown>; existing: { id: string; name: string; scope?: string }[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState(defaultName);
  const [done, setDone] = useState('');
  useEffect(() => {
    if (open) {
      setName(defaultName || 'My template');
      setDone('');
    }
  }, [open, defaultName]);
  const same = existing.find((t) => (t.scope ?? 'own') === 'own' && t.name.trim().toLowerCase() === name.trim().toLowerCase());
  const save = useMutation({
    mutationFn: async (replaceId: string | null) => {
      await beforeSave();
      if (replaceId) return api.agencyTemplateUpdate(replaceId, { fromId });
      return api.agencyTemplateAdd({ kind, name: name.trim(), fromId });
    },
    onSuccess: () => {
      setDone(`Saved as "${name.trim()}".`);
      void qc.invalidateQueries({ queryKey: ['agency'] });
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Save as template">
      <p className="m-0 text-balance text-[14px] font-semibold text-ink-soft">It keeps the sections and the look, not the names filled in.</p>
      <label className="mt-sm block text-[14px] font-bold" htmlFor="tpl-name">
        Name
      </label>
      <input id="tpl-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={FIELD} />
      {same && (
        <p className="mt-sm m-0 rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-yellow)' }}>
          You already have a template called "{same.name}".
        </p>
      )}
      {done && (
        <p role="status" className="mt-sm m-0 text-[14px] font-bold">
          {done}
        </p>
      )}
      {save.error && (
        <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
          {save.error instanceof ApiError ? save.error.message : 'That did not work. Try again.'}
        </p>
      )}
      <div className="mt-md flex flex-wrap gap-xs pb-xl">
        {same && (
          <Button onClick={() => save.mutate(same.id)} disabled={save.isPending || Boolean(done)}>
            Replace it
          </Button>
        )}
        <Button variant={same ? 'outline' : 'primary'} onClick={() => save.mutate(null)} disabled={save.isPending || !name.trim() || Boolean(done)}>
          {save.isPending ? 'Saving' : same ? 'Save as a new one' : 'Save template'}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {done ? 'Close' : 'Cancel'}
        </Button>
      </div>
    </Sheet>
  );
}

/** The client's comments, your replies and what was done with the paper (emailed, accepted), in one sheet. */
export function ThreadSheet({ open, onClose, type, id, comments, reply, setReply, onSend, sending, fieldId }: { open: boolean; onClose: () => void; type: 'contract' | 'doc'; id: string; comments: readonly DocComment[]; reply: string; setReply: (v: string) => void; onSend: () => void; sending: boolean; fieldId: string }) {
  return (
    <Sheet open={open} onClose={onClose} title="Comments and activity">
      {comments.length === 0 && <p className="m-0 text-[14px] font-semibold text-ink-soft">No comments yet. When the client asks for a change at their link, it shows here.</p>}
      <ul className="flex list-none flex-col gap-xs p-0 m-0">
        {comments.map((m) => (
          <li key={m.id} className={`rounded-tile p-sm shadow-toy-soft ${m.author === 'client' ? 'bg-card-strong' : 'bg-card'}`}>
            <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
              {m.author === 'client' ? 'Client' : 'You'} · {paperDate(m.createdAt)}
            </p>
            <p className="mt-xs m-0 whitespace-pre-wrap text-[16px] font-semibold">
              <Inert text={m.body} />
            </p>
          </li>
        ))}
      </ul>
      <form
        className="mt-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (reply.trim()) onSend();
        }}
      >
        <label className="block text-[14px] font-bold" htmlFor={fieldId}>
          Reply
        </label>
        <textarea id={fieldId} value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={600} className={FIELD} />
        <div className="mt-xs">
          <Button type="submit" size="sm" disabled={sending || !reply.trim()}>
            {sending ? 'Sending' : 'Add reply'}
          </Button>
        </div>
      </form>
      <h3 className="mt-md mb-xs text-[16px]">Activity</h3>
      <DocLog type={type} id={id} />
      <div className="mt-md pb-xl">
        <Button onClick={onClose}>Done</Button>
      </div>
    </Sheet>
  );
}

type Open = 'fill' | 'client' | 'can' | 'thread' | 'template' | 'house' | 'style' | 'email' | 'password' | 'draft' | 'void' | 'delete' | null;

/**
 * An agreement: the paper is the page. The header has back, the title, one status with the quiet save line, then one action for where it
 * stands (Send to client for a draft, Revise for a signed one), Download and More, which holds everything else. A draft or a sent agreement
 * is edited on the paper itself and saved as you go; a signed one is a record.
 */
export function AgencyContract() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['agency', 'contract', id], queryFn: () => api.agencyContract(id) });
  const clients = useQuery({ queryKey: ['agency', 'clients-pick'], queryFn: () => api.agency('csize=100') });
  const mine = useQuery({ queryKey: ['agency', 'templates', 'contract'], queryFn: () => api.agencyTemplates('contract') });
  const superAdmin = useSuperAdmin();
  const c = q.data?.contract;
  const editable = c?.status === 'draft' || c?.status === 'sent';
  const [open, setOpen] = useState<Open>(null);
  const [said, setSaid] = useSaid();
  const save = useCallback(
    async (s: PaperState, version: string) => {
      const r = await api.agencyContractUpdate(id, { doc: s.doc, clientId: s.clientId, ifUpdatedAt: version });
      qc.setQueryData(['agency', 'contract', id], { contract: r.contract });
      return r.contract.updatedAt;
    },
    [id, qc],
  );
  const { state, setState, auto } = usePaperDoc({ id, server: c, refetch: q.refetch, save, enabled: Boolean(editable) });
  const doc = state?.doc ?? null;
  const clientId = state?.clientId ?? null;

  useAutoPrint(Boolean(c && doc), fileTitle('Agreement', c?.clientName, c?.doc.title));
  const [params] = useSearchParams();
  useEffect(() => {
    if (c && params.get('email') === '1') setOpen('email');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id]);

  const done = () => void qc.invalidateQueries({ queryKey: ['agency'] });
  const setStatus = useMutation({
    mutationFn: async (status: 'draft' | 'sent' | 'void') => {
      await auto.flush();
      return api.agencyContractUpdate(id, { status });
    },
    onSuccess: (r) => {
      if (state) auto.reset(state, r.contract.updatedAt);
      qc.setQueryData(['agency', 'contract', id], { contract: r.contract });
      done();
    },
  });
  // Restore: back to the status it had before the void, at the same link (the server keeps both).
  const restore = useMutation({
    mutationFn: () => api.agencyContractRestore(id),
    onSuccess: (r) => {
      if (state) auto.reset(state, r.contract.updatedAt);
      qc.setQueryData(['agency', 'contract', id], { contract: r.contract });
      setSaid(`Restored as ${CONTRACT_STATUS_NAME[r.restoredTo].toLowerCase()}.`);
      done();
    },
  });
  const duplicate = useMutation({
    mutationFn: async () => {
      await auto.flush();
      return api.agencyContractDuplicate(id);
    },
    onSuccess: (r) => {
      done();
      nav(`/agency/contracts/${r.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.agencyContractRemove(id),
    onSuccess: () => {
      done();
      nav('/agency?tab=agreements');
    },
  });
  const thread = useQuery({ queryKey: ['agency', 'comments', 'contract', id], queryFn: () => api.agencyComments('contract', id), enabled: Boolean(c) });
  const [reply, setReply] = useState('');
  const send = useMutation({
    mutationFn: () => api.agencyCommentAdd('contract', id, reply),
    onSuccess: () => {
      setReply('');
      void qc.invalidateQueries({ queryKey: ['agency', 'comments', 'contract', id] });
    },
  });

  if (q.isPending) {
    return (
      <Screen columns={false}>
        <header className="pt-lg">
          <BackLink to="/agency?tab=agreements">Agency</BackLink>
        </header>
        <Busy label="Loading the agreement" className="mt-md grid gap-md">
          <Skeleton className="h-[36px] w-2/3" />
          <SkeletonCard lines={10} />
        </Busy>
      </Screen>
    );
  }
  if (q.isError || !c || !doc) {
    return (
      <Screen columns={false}>
        <AppCover back={{ to: '/agency?tab=agreements', label: 'Agency' }} title="Not found" lede={<span role="alert">That agreement is not here. It may have been removed.</span>} />
      </Screen>
    );
  }

  const pick = clients.data?.clients ?? [];
  const clientName = pick.find((cl) => cl.id === clientId)?.name ?? c.clientName;
  const ref = docRef('AGR', c.id);
  const link = c.token && c.status !== 'void' ? `${window.location.origin}/k/${c.token}` : '';
  const emailCtx: EmailContext = { kind: 'contract', clientId: c.clientId, title: doc.title, number: ref, signed: c.status === 'signed', docKind: doc.templateKey };
  const fileName = fileTitle('Agreement', clientName, doc.title);
  const sheetStamp: SheetStamp | null = c.status === 'draft' ? 'draft' : c.status === 'void' ? 'void' : c.status === 'signed' ? 'signed' : c.revisedAt ? 'revised' : null;
  const comments = thread.data?.comments ?? [];
  const waiting = waitingFrom(comments);
  const edit = (fn: (d: ContractDoc) => ContractDoc) => setState((s) => (s ? { ...s, doc: fn(s.doc) } : s));
  const copy = async (text: string, what: string) => setSaid((await copyPlain(text)) ? `${what} copied.` : 'Could not copy. Try again.');
  const close = () => setOpen(null);
  const revised = c.status === 'sent' && c.revisedAt;
  // While a draft still has blanks, filling them is the main action and sending waits in More.
  const blanks = blanksIn(doc);
  const fillFirst = c.status === 'draft' && blanks > 0;
  const more: MoreMenuItem[] = [
    { key: 'fill', label: 'Fill in the details', icon: ListChecks, hint: blanks ? `${formatCount(blanks)} empty` : undefined, onSelect: () => setOpen('fill') },
    ...(fillFirst ? [{ key: 'send', label: 'Send to client', icon: Send, disabled: setStatus.isPending, onSelect: () => setStatus.mutate('sent') }] : []),
    ...(link ? [{ key: 'link', label: 'Copy link', icon: Link2, onSelect: () => void copy(link, 'The link') }] : []),
    { key: 'email', label: 'Email a copy', icon: Mail, onSelect: () => setOpen('email') },
    { key: 'text', label: 'Copy text', icon: ClipboardCopy, onSelect: () => void copy(contractAsText(doc, { reference: ref, date: c.sentAt ?? c.createdAt, answers: c.answers, acceptance: c.acceptance }), 'The text') },
    { key: 'thread', label: 'Comments', icon: MessageSquare, hint: waiting ? `${waiting} new` : comments.length ? String(comments.length) : undefined, onSelect: () => setOpen('thread') },
    ...(editable ? [{ key: 'client', label: 'Client', icon: UserRound, hint: clientName || 'None', onSelect: () => setOpen('client') }] : []),
    ...(editable ? [{ key: 'can', label: 'Client permissions', icon: ShieldCheck, hint: doc.show.comments ? 'Comments on' : 'Comments off', onSelect: () => setOpen('can') }] : []),
    { key: 'password', label: 'Password', icon: KeyRound, onSelect: () => setOpen('password') },
    ...(c.status !== 'signed' ? [{ key: 'dup', label: 'Duplicate', icon: CopyPlus, onSelect: () => duplicate.mutate(), disabled: duplicate.isPending }] : []),
    { key: 'tpl', label: 'Save as template', icon: LayoutTemplate, onSelect: () => setOpen('template') },
    ...(superAdmin && c.status !== 'void' ? [{ key: 'house', label: 'Save as house template', icon: Building2, onSelect: () => setOpen('house') }] : []),
    ...(editable ? [{ key: 'style', label: 'Style', icon: Palette, onSelect: () => setOpen('style') }] : []),
    ...(c.status === 'sent' ? [{ key: 'draft', label: 'Take back to draft', icon: Undo2, destructive: true, onSelect: () => setOpen('draft') }] : []),
    ...(c.status !== 'void' ? [{ key: 'void', label: 'Void', icon: Ban, destructive: true, onSelect: () => setOpen('void') }] : []),
    ...(c.status === 'void' ? [{ key: 'restore', label: 'Restore', icon: ArchiveRestore, disabled: restore.isPending, onSelect: () => restore.mutate() }] : []),
    ...(c.status === 'draft' || c.status === 'void' ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onSelect: () => setOpen('delete') }] : []),
  ];
  const primary = fillFirst ? (
    <Button onClick={() => setOpen('fill')}>
      <Icon icon={ListChecks} size={18} />
      Fill in the details
    </Button>
  ) : c.status === 'draft' ? (
    <Button onClick={() => setStatus.mutate('sent')} disabled={setStatus.isPending}>
      <Icon icon={Send} size={18} />
      Send to client
    </Button>
  ) : c.status === 'signed' ? (
    <Button onClick={() => duplicate.mutate()} disabled={duplicate.isPending}>
      <Icon icon={CopyPlus} size={18} />
      Revise
    </Button>
  ) : null;
  const error = [setStatus, restore, duplicate, remove].map((m) => m.error).find(Boolean);

  return (
    <Screen columns={false}>
      <DocHeader
        back="/agency?tab=agreements"
        backLabel="Agency"
        title={doc.title || 'Agreement'}
        tone={revised ? 'warn' : CONTRACT_STATUS_TONE[c.status]}
        status={revised ? `Revised ${paperDate(c.revisedAt!)}` : c.status === 'signed' && c.acceptance ? `Signed ${paperDate(c.acceptance.at)}` : CONTRACT_STATUS_NAME[c.status]}
        save={<SaveLine words={said || auto.words} canUndo={auto.canUndo} onUndo={auto.undo} />}
        primary={primary}
        onDownload={() => printAs(fileName)}
        more={more}
        moreLabel="More for this agreement"
        error={error}
      />

      <section className="mt-md" aria-label="The agreement">
        <ContractView
          audience="owner"
          doc={doc}
          answers={c.answers}
          acceptance={c.acceptance}
          reference={ref}
          date={c.sentAt ?? c.createdAt}
          stamp={sheetStamp}
          onDocChange={editable ? (d) => edit(() => d) : undefined}
          onFill={() => setOpen('fill')}
        />
      </section>

      <FillDetailsSheet
        open={open === 'fill'}
        onClose={close}
        doc={doc}
        clientId={clientId}
        record={
          c.status === 'signed'
            ? {
                why: 'This agreement is signed, so it is a record. Revise to change it.',
                revise: (
                  <Button variant="outline" onClick={() => duplicate.mutate()} disabled={duplicate.isPending}>
                    <Icon icon={CopyPlus} size={18} />
                    Revise
                  </Button>
                ),
              }
            : c.status === 'void'
              ? { why: 'This agreement is void, so it cannot change. Restore it first.' }
              : null
        }
        onDocVars={(changes) => edit((d) => ({ ...d, vars: { ...d.vars, ...changes } }))}
        onSaved={setSaid}
      />

      <ClientSheet open={open === 'client'} onClose={close} value={clientId} onChange={(v) => setState((s) => (s ? { ...s, clientId: v } : s))} clients={pick} />
      <Sheet open={open === 'can'} onClose={close} title="Client permissions">
        <Toggle on={doc.show.comments} onChange={(on) => edit((d) => ({ ...d, show: { ...d.show, comments: on } }))} label="Write comments" hint="They can ask for a change at their link." />
        <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Once it is sent, they can always read it, answer the brief, accept and download it.</p>
        <div className="mt-md pb-xl">
          <Button onClick={close}>Done</Button>
        </div>
      </Sheet>
      <Sheet open={open === 'password'} onClose={close} title="Password">
        <DocPassword clientId={clientId} clientName={clientName} savedClientId={c.clientId} />
        <div className="mt-md pb-xl">
          <Button onClick={close}>Done</Button>
        </div>
      </Sheet>
      <ThreadSheet open={open === 'thread'} onClose={close} type="contract" id={id} comments={comments} reply={reply} setReply={setReply} onSend={() => send.mutate()} sending={send.isPending} fieldId="c-reply" />
      <DocStyleSheet open={open === 'style'} onClose={close} value={parseDocStyle(doc.style)} onChange={(style) => edit((d) => ({ ...d, style }))} disabled={!editable} />
      <EmailCopySheet open={open === 'email'} onClose={close} route="contracts" id={id} defaultTo={pick.find((cl) => cl.id === clientId)?.contactEmail ?? ''} context={emailCtx} noLinkYet={c.status === 'draft' || c.status === 'void'} />
      <HouseTemplateSheet open={open === 'house'} onClose={close} kind="contract" fromId={id} defaultName={doc.title || 'Agreement'} beforeSave={() => auto.flush()} />
      <TemplateSheet open={open === 'template'} onClose={close} kind="contract" fromId={id} defaultName={doc.title} beforeSave={() => auto.flush()} existing={mine.data?.templates ?? []} />
      <ConfirmSheet open={open === 'draft'} onClose={close} title="Take it back to draft?" body="The client's link closes until you send it again. Their answers so far are kept." action="Take back to draft" onConfirm={() => setStatus.mutate('draft')} busy={setStatus.isPending} />
      <ConfirmSheet open={open === 'void'} onClose={close} title="Void this agreement?" body="It is kept for the record and its link closes. Restore, in the same menu, brings it back as it was." action="Void it" onConfirm={() => setStatus.mutate('void')} busy={setStatus.isPending} />
      <ConfirmSheet open={open === 'delete'} onClose={close} title="Delete this agreement?" body="It is removed for good, with its comments." action="Delete it" onConfirm={() => remove.mutate()} busy={remove.isPending} />
    </Screen>
  );
}
