import { AGENCY_DOC_KIND_META, AGENCY_DOC_STATUS_NAME, AGENCY_DOC_STATUS_TONE, contractAsText, parseDocStyle, type ContractDoc } from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, ClipboardCopy, CopyPlus, KeyRound, LayoutTemplate, Link2, Mail, MessageSquare, Palette, Send, ShieldCheck, Trash2, Undo2, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { DocPassword } from '../components/AgencyLifecycle';
import { Button } from '../components/Button';
import { ContractView, paperDate } from '../components/ContractView';
import { ConfirmSheet, EmailCopySheet, type EmailContext } from '../components/DocActions';
import { DocStyleSheet } from '../components/DocStyleSheet';
import { HouseTemplateSheet, useSuperAdmin } from '../components/HouseTemplateButton';
import { Icon } from '../components/Icon';
import { type MoreMenuItem } from '../components/MoreMenu';
import { BackLink } from '../components/PageHeader';
import type { SheetStamp } from '../components/PrintSheet';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { Busy, Skeleton, SkeletonCard } from '../components/Skeleton';
import { Toggle } from '../components/Toggle';
import { api } from '../lib/api';
import { copyPlain } from '../lib/clipboard';
import { fileTitle, printAs, useAutoPrint } from '../lib/printDoc';
import { ClientSheet, DocHeader, SaveLine, TemplateSheet, ThreadSheet, usePaperDoc, useSaid, waitingFrom, type PaperState } from './AgencyContract';

type Open = 'client' | 'can' | 'thread' | 'template' | 'house' | 'style' | 'email' | 'password' | 'draft' | 'delete' | null;

/**
 * An Agency document that is not an invoice or an agreement: a strategy session summary, trial video terms, a retainer proposal or a
 * monthly report. The same page as an agreement: the paper is the page, edited in place and saved as you go while it is a draft, sent or
 * revised; one main action (Send to client, or Revise once approved), Download and More. The client reads it at /d/<token> and approves it
 * by typing a name.
 */
export function AgencyDoc() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['agency', 'doc', id], queryFn: () => api.agencyDoc(id) });
  const clients = useQuery({ queryKey: ['agency', 'clients-pick'], queryFn: () => api.agency('csize=100') });
  const mine = useQuery({ queryKey: ['agency', 'templates', 'doc'], queryFn: () => api.agencyTemplates('doc') });
  const superAdmin = useSuperAdmin();
  const d = q.data?.doc;
  const editable = d?.status === 'draft' || d?.status === 'sent' || d?.status === 'revised';
  const [open, setOpen] = useState<Open>(null);
  const [said, setSaid] = useSaid();
  const save = useCallback(
    async (s: PaperState, version: string) => {
      const r = await api.agencyDocUpdate(id, { doc: s.doc, clientId: s.clientId, ifUpdatedAt: version });
      qc.setQueryData(['agency', 'doc', id], { doc: r.doc });
      return r.doc.updatedAt;
    },
    [id, qc],
  );
  const { state, setState, auto } = usePaperDoc({ id, server: d ? { doc: d.doc, clientId: d.clientId, updatedAt: d.updatedAt } : undefined, refetch: q.refetch, save, enabled: Boolean(editable) });
  const doc = state?.doc ?? null;
  const clientId = state?.clientId ?? null;
  const [params] = useSearchParams();
  useAutoPrint(Boolean(d && doc), fileTitle(d ? AGENCY_DOC_KIND_META[d.kind].name : 'Document', d?.clientName, d?.doc.title));
  useEffect(() => {
    if (d && params.get('email') === '1') setOpen('email');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.id]);

  const done = () => void qc.invalidateQueries({ queryKey: ['agency'] });
  const setStatus = useMutation({
    mutationFn: async (status: 'draft' | 'sent') => {
      await auto.flush();
      return api.agencyDocUpdate(id, { status });
    },
    onSuccess: (r) => {
      if (state) auto.reset(state, r.doc.updatedAt);
      qc.setQueryData(['agency', 'doc', id], { doc: r.doc });
      done();
    },
  });
  const duplicate = useMutation({
    mutationFn: async () => {
      await auto.flush();
      return api.agencyDocDuplicate(id);
    },
    onSuccess: (r) => {
      done();
      nav(`/agency/docs/${r.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.agencyDocRemove(id),
    onSuccess: () => {
      done();
      nav('/agency?tab=agreements&agseg=other');
    },
  });
  const thread = useQuery({ queryKey: ['agency', 'comments', 'doc', id], queryFn: () => api.agencyComments('doc', id), enabled: Boolean(d) });
  const [reply, setReply] = useState('');
  const send = useMutation({
    mutationFn: () => api.agencyCommentAdd('doc', id, reply),
    onSuccess: () => {
      setReply('');
      void qc.invalidateQueries({ queryKey: ['agency', 'comments', 'doc', id] });
    },
  });

  if (q.isPending) {
    return (
      <Screen columns={false}>
        <header className="pt-lg">
          <BackLink to="/agency?tab=agreements&agseg=other">Documents</BackLink>
        </header>
        <Busy label="Loading the document" className="mt-md grid gap-md">
          <Skeleton className="h-[36px] w-2/3" />
          <SkeletonCard lines={10} />
        </Busy>
      </Screen>
    );
  }
  if (q.isError || !d || !doc) {
    return (
      <Screen columns={false}>
        <header className="pt-lg">
          <BackLink to="/agency?tab=agreements&agseg=other">Documents</BackLink>
          <h1 className="text-[30px]">Not found</h1>
          <p role="alert" className="m-0 text-[16px] font-semibold text-ink-soft">
            That document is not here. It may have been removed.
          </p>
        </header>
      </Screen>
    );
  }

  const meta = AGENCY_DOC_KIND_META[d.kind];
  const pick = clients.data?.clients ?? [];
  const clientName = pick.find((cl) => cl.id === clientId)?.name ?? d.clientName;
  const link = d.token ? `${window.location.origin}/d/${d.token}` : '';
  // A monthly report's month is in its title ("Monthly report, November 2026"), so its note can say which month it covers.
  const reportMonth = d.kind === 'monthly_report' ? doc.title.split(', ').slice(1).join(', ') || undefined : undefined;
  const emailCtx: EmailContext = { kind: 'doc', clientId: d.clientId, title: doc.title, number: d.ref, docKind: d.kind, period: reportMonth };
  const fileName = fileTitle(meta.name, clientName, doc.title);
  const sheetStamp: SheetStamp | null = d.status === 'draft' ? 'draft' : d.status === 'approved' ? 'approved' : d.status === 'revised' ? 'revised' : null;
  const comments = thread.data?.comments ?? [];
  const waiting = waitingFrom(comments);
  const edit = (fn: (x: ContractDoc) => ContractDoc) => setState((s) => (s ? { ...s, doc: fn(s.doc) } : s));
  const copy = async (text: string, what: string) => setSaid((await copyPlain(text)) ? `${what} copied.` : 'Could not copy. Try again.');
  const close = () => setOpen(null);
  const more: MoreMenuItem[] = [
    ...(link ? [{ key: 'link', label: 'Copy link', icon: Link2, onSelect: () => void copy(link, 'The link') }] : []),
    { key: 'email', label: 'Email a copy', icon: Mail, onSelect: () => setOpen('email') },
    { key: 'text', label: 'Copy text', icon: ClipboardCopy, onSelect: () => void copy(contractAsText(doc, { reference: d.ref, date: d.sentAt ?? d.createdAt, answers: d.answers, acceptance: d.acceptance }), 'The text') },
    { key: 'thread', label: 'Comments', icon: MessageSquare, hint: waiting ? `${waiting} new` : comments.length ? String(comments.length) : undefined, onSelect: () => setOpen('thread') },
    ...(editable ? [{ key: 'client', label: 'Client', icon: UserRound, hint: clientName || 'None', onSelect: () => setOpen('client') }] : []),
    ...(editable ? [{ key: 'can', label: 'Client permissions', icon: ShieldCheck, hint: doc.show.comments ? 'Comments on' : 'Comments off', onSelect: () => setOpen('can') }] : []),
    { key: 'password', label: 'Password', icon: KeyRound, onSelect: () => setOpen('password') },
    ...(d.status !== 'approved' ? [{ key: 'dup', label: 'Duplicate', icon: CopyPlus, onSelect: () => duplicate.mutate(), disabled: duplicate.isPending }] : []),
    { key: 'tpl', label: 'Save as template', icon: LayoutTemplate, onSelect: () => setOpen('template') },
    ...(superAdmin ? [{ key: 'house', label: 'Save as house template', icon: Building2, onSelect: () => setOpen('house') }] : []),
    ...(editable ? [{ key: 'style', label: 'Style', icon: Palette, onSelect: () => setOpen('style') }] : []),
    ...(d.status === 'sent' || d.status === 'revised' ? [{ key: 'draft', label: 'Take back to draft', icon: Undo2, destructive: true, onSelect: () => setOpen('draft') }] : []),
    ...(d.status === 'draft' ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onSelect: () => setOpen('delete') }] : []),
  ];
  const primary =
    d.status === 'draft' ? (
      <Button onClick={() => setStatus.mutate('sent')} disabled={setStatus.isPending}>
        <Icon icon={Send} size={18} />
        Send to client
      </Button>
    ) : d.status === 'approved' ? (
      <Button onClick={() => duplicate.mutate()} disabled={duplicate.isPending}>
        <Icon icon={CopyPlus} size={18} />
        Revise
      </Button>
    ) : null;
  const error = [setStatus, duplicate, remove].map((m) => m.error).find(Boolean);

  return (
    <Screen columns={false}>
      <DocHeader
        back="/agency?tab=agreements&agseg=other"
        backLabel="Documents"
        title={doc.title || meta.name}
        tone={AGENCY_DOC_STATUS_TONE[d.status]}
        status={d.status === 'approved' && d.acceptance ? `Approved ${paperDate(d.acceptance.at)}` : d.status === 'revised' && d.revisedAt ? `Revised ${paperDate(d.revisedAt)}` : AGENCY_DOC_STATUS_NAME[d.status]}
        save={<SaveLine words={said || auto.words} canUndo={auto.canUndo} onUndo={auto.undo} />}
        primary={primary}
        onDownload={() => printAs(fileName)}
        more={more}
        moreLabel="More for this document"
        error={error}
      />

      <section className="mt-md" aria-label="The document">
        <ContractView audience="owner" kind="document" doc={doc} answers={d.answers} acceptance={d.acceptance} reference={d.ref} date={d.sentAt ?? d.createdAt} stamp={sheetStamp} onDocChange={editable ? (x) => edit(() => x) : undefined} />
      </section>

      <ClientSheet open={open === 'client'} onClose={close} value={clientId} onChange={(v) => setState((s) => (s ? { ...s, clientId: v } : s))} clients={pick} />
      <Sheet open={open === 'can'} onClose={close} title="Client permissions">
        <Toggle on={doc.show.comments} onChange={(on) => edit((x) => ({ ...x, show: { ...x.show, comments: on } }))} label="Write comments" hint="They can ask for a change at their link." />
        <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Once it is sent, they can always read it, approve it and download it.</p>
        <div className="mt-md pb-xl">
          <Button onClick={close}>Done</Button>
        </div>
      </Sheet>
      <Sheet open={open === 'password'} onClose={close} title="Password">
        <DocPassword clientId={clientId} clientName={clientName} savedClientId={d.clientId} />
        <div className="mt-md pb-xl">
          <Button onClick={close}>Done</Button>
        </div>
      </Sheet>
      <ThreadSheet open={open === 'thread'} onClose={close} type="doc" id={id} comments={comments} reply={reply} setReply={setReply} onSend={() => send.mutate()} sending={send.isPending} fieldId="d-reply" />
      <DocStyleSheet open={open === 'style'} onClose={close} value={parseDocStyle(doc.style)} onChange={(style) => edit((x) => ({ ...x, style }))} disabled={!editable} />
      <EmailCopySheet open={open === 'email'} onClose={close} route="docs" id={id} defaultTo={pick.find((cl) => cl.id === clientId)?.contactEmail ?? ''} context={emailCtx} noLinkYet={d.status === 'draft'} />
      <HouseTemplateSheet open={open === 'house'} onClose={close} kind="doc" fromId={id} defaultName={doc.title || meta.name} beforeSave={() => auto.flush()} />
      <TemplateSheet open={open === 'template'} onClose={close} kind="doc" fromId={id} defaultName={doc.title} beforeSave={() => auto.flush()} existing={mine.data?.templates ?? []} />
      <ConfirmSheet open={open === 'draft'} onClose={close} title="Take it back to draft?" body="The client's link closes until you send it again." action="Take back to draft" onConfirm={() => setStatus.mutate('draft')} busy={setStatus.isPending} />
      <ConfirmSheet open={open === 'delete'} onClose={close} title="Delete this document?" body="It is removed for good, with its comments." action="Delete it" onConfirm={() => remove.mutate()} busy={remove.isPending} />
    </Screen>
  );
}
