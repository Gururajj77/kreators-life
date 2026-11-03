import {
  AGENCY_DOC_KIND_META,
  AGENCY_DOC_STATUS_NAME,
  AGENCY_DOC_STATUS_TONE,
  AGENCY_CURRENCIES,
  contractAsText,
  CONTRACT_TEXT_MAX,
  CONTRACT_VARS,
  parseDocStyle,
  type ContractDoc,
  type ContractSection,
} from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CopyPlus, LayoutTemplate, Send, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '../components/Button';
import { ContractView, paperDate } from '../components/ContractView';
import { ConfirmSheet, EmailCopySheet, PrintButton, type EmailContext } from '../components/DocActions';
import { DocStyleSheet } from '../components/DocStyleSheet';
import { HouseTemplateSheet, useSuperAdmin } from '../components/HouseTemplateButton';
import { Icon } from '../components/Icon';
import { Inert } from '../components/Inert';
import { MoreMenu, type MoreMenuItem } from '../components/MoreMenu';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { ShareButton, ShareSheet } from '../components/ShareSheet';
import { Sheet } from '../components/Sheet';
import { Busy, Skeleton, SkeletonCard } from '../components/Skeleton';
import { StatusTag } from '../components/StatusTag';
import { Toggle } from '../components/Toggle';
import type { SheetStamp } from '../components/PrintSheet';
import { api, ApiError } from '../lib/api';
import { fileTitle, printAs, useAutoPrint } from '../lib/printDoc';
import { tie } from '../lib/text';
import { AddSectionSheet, BriefEditor, COPY, EditPreviewSwitch, moved, PackagesEditor, PartsList, SaveBar, SectionSheetFoot, ThreadSheet, useEditPreview, useTwoTap, waitingFrom, withSection, type Open } from './AgencyContract';
import { FIELD } from '../lib/ui';

/**
 * An Agency document that is not an invoice or an agreement: a strategy session summary, trial video terms, a retainer proposal or a
 * monthly report. Same page, same style sheet, same text version and email as an agreement; the client reads it at /d/<token> and approves
 * it by typing a name. Draft, sent and revised can change; approved is a record, revised only into a new draft.
 */
export function AgencyDoc() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [armed, tap] = useTwoTap();
  const q = useQuery({ queryKey: ['agency', 'doc', id], queryFn: () => api.agencyDoc(id) });
  const clients = useQuery({ queryKey: ['agency', 'clients-pick'], queryFn: () => api.agency('csize=100') });
  const mine = useQuery({ queryKey: ['agency', 'templates', 'doc'], queryFn: () => api.agencyTemplates('doc') });
  const d = q.data?.doc;
  const [doc, setDoc] = useState<ContractDoc | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Open>(null);
  const superAdmin = useSuperAdmin();
  const [view, setView] = useEditPreview();
  const [tplName, setTplName] = useState('');
  const [tplDone, setTplDone] = useState('');
  const [params] = useSearchParams();
  const stamp = d ? `${d.id}:${d.updatedAt}` : 'none';
  useEffect(() => {
    if (!d) return;
    setDoc(d.doc);
    setClientId(d.clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);
  // ?print=1 opens the print window once the document has loaded (Download or print on a list row); ?email=1 opens the email sheet.
  useAutoPrint(Boolean(d && doc), fileTitle(d ? AGENCY_DOC_KIND_META[d.kind].name : 'Document', d?.clientName, d?.doc.title));
  useEffect(() => {
    if (d && params.get('email') === '1') setOpen({ kind: 'email' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.id]);

  const editable = d?.status === 'draft' || d?.status === 'sent' || d?.status === 'revised';
  const dirty = Boolean(d && doc && (JSON.stringify(doc) !== JSON.stringify(d.doc) || clientId !== d.clientId));
  const done = () => void qc.invalidateQueries({ queryKey: ['agency'] });

  const save = useMutation({ mutationFn: () => api.agencyDocUpdate(id, { doc: doc!, clientId }), onSuccess: done });
  const setStatus = useMutation({
    mutationFn: async (status: 'draft' | 'sent') => {
      if (status === 'sent' && dirty && doc) await api.agencyDocUpdate(id, { doc, clientId });
      return api.agencyDocUpdate(id, { status });
    },
    onSuccess: done,
  });
  const duplicate = useMutation({
    mutationFn: () => api.agencyDocDuplicate(id),
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
  const saveTemplate = useMutation({
    mutationFn: async (replaceId: string | null) => {
      if (dirty && editable && doc) await api.agencyDocUpdate(id, { doc, clientId });
      if (replaceId) return api.agencyTemplateUpdate(replaceId, { fromId: id });
      return api.agencyTemplateAdd({ kind: 'doc', name: tplName.trim(), fromId: id });
    },
    onSuccess: () => {
      setTplDone(`Saved as "${tplName.trim()}". Start a new document from it any time.`);
      done();
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

  const error = [save, setStatus, duplicate, remove, saveTemplate].map((m) => m.error).find(Boolean);
  const link = d?.token ? `${window.location.origin}/d/${d.token}` : '';

  const edit = (fn: (x: ContractDoc) => ContractDoc) => setDoc((x) => (x ? fn(x) : x));
  const patchSection = (sid: string, p: Partial<ContractSection>) => edit((x) => ({ ...x, sections: x.sections.map((s) => (s.id === sid ? { ...s, ...p } : s)) }));
  const addSection = (kind: 'text' | 'packages' | 'brief') => {
    if (!doc) return;
    const r = withSection(doc, kind, 'Questions');
    setDoc(r.doc);
    setOpen(r.id ? { kind: 'section', id: r.id } : null);
  };

  if (q.isPending) {
    return (
      <Screen columns={false}>
        <header className="pt-lg">
          <BackLink to="/agency?tab=agreements&agseg=other">Documents</BackLink>
        </header>
        <Busy label="Loading the document" className="mt-md grid gap-md">
          <Skeleton className="h-[36px] w-2/3" />
          <Skeleton className="h-[48px] w-1/2" />
          <SkeletonCard lines={6} />
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
          <p role="alert" className="m-0 text-[16px] font-semibold text-ink-soft">That document is not here. It may have been removed.</p>
        </header>
      </Screen>
    );
  }

  const meta = AGENCY_DOC_KIND_META[d.kind];
  const clientName = clients.data?.clients.find((cl) => cl.id === clientId)?.name ?? d.clientName;
  const text = contractAsText(doc, { reference: d.ref, date: d.sentAt ?? d.createdAt, answers: d.answers, acceptance: d.acceptance });
  // A monthly report's month is in its title ("Monthly report, November 2026"), so its note can say which month it covers.
  const reportMonth = d.kind === 'monthly_report' ? (doc.title.split(', ').slice(1).join(', ') || undefined) : undefined;
  const emailCtx: EmailContext = { kind: 'doc', clientId: d.clientId, title: doc.title, number: d.ref, docKind: d.kind, period: reportMonth };
  const fileName = fileTitle(meta.name, clientName, doc.title);
  const print = () => printAs(fileName);
  const sheetStamp: SheetStamp | null = d.status === 'draft' ? 'draft' : d.status === 'approved' ? 'approved' : d.status === 'revised' ? 'revised' : null;
  const openSection = open?.kind === 'section' ? doc.sections.find((s) => s.id === open.id) : undefined;
  const openIndex = openSection ? doc.sections.indexOf(openSection) : -1;
  const comments = thread.data?.comments ?? [];
  const latest = comments[comments.length - 1];
  const sameName = mine.data?.templates.find((t) => t.scope === 'own' && t.name.trim().toLowerCase() === tplName.trim().toLowerCase());
  const closeSheet = () => setOpen(null);
  const statusLine =
    d.status === 'approved' && d.acceptance
      ? `Approved by ${d.acceptance.name}${d.acceptance.title ? `, ${d.acceptance.title}` : ''} on ${paperDate(d.acceptance.at)}. An approved document is a record. Make a revised copy.`
      : d.status === 'draft'
        ? 'Not sent yet. Send it and the client gets a link to read it and approve.'
        : `Sent ${d.sentAt ? paperDate(d.sentAt) : ''}. The client sees a change at the same link, marked as revised.`;
  const openTemplate = () => {
    setTplName(doc.title || 'My template');
    setTplDone('');
    saveTemplate.reset();
    setOpen({ kind: 'template' });
  };
  const more: MoreMenuItem[] = [
    ...(d.status !== 'approved' ? [{ key: 'dup', label: 'Duplicate', icon: CopyPlus, onSelect: () => duplicate.mutate(), disabled: duplicate.isPending }] : []),
    { key: 'tpl', label: 'Save as template', icon: LayoutTemplate, onSelect: openTemplate },
    ...(superAdmin ? [{ key: 'house', label: 'Save as house template', icon: Building2, onSelect: () => setOpen({ kind: 'house' }) }] : []),
    ...(d.status === 'sent' || d.status === 'revised' ? [{ key: 'draft', label: 'Take back to draft', icon: Undo2, destructive: true, onSelect: () => setOpen({ kind: 'confirm', what: 'draft' }) }] : []),
    ...(d.status === 'draft' ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onSelect: () => setOpen({ kind: 'confirm', what: 'delete' }) }] : []),
  ];
  const confirmWhat = open?.kind === 'confirm' ? open.what : null;

  return (
    <Screen columns={false}>
      <header className="no-print pt-lg">
        <BackLink to="/agency?tab=agreements&agseg=other">Documents</BackLink>
        <h1 className="text-[30px]">{tie(doc.title || meta.name)}</h1>
        <div className="mt-xs flex flex-wrap items-center gap-xs">
          <StatusTag tone={AGENCY_DOC_STATUS_TONE[d.status]}>{AGENCY_DOC_STATUS_NAME[d.status]}</StatusTag>
          <span className="text-[14px] font-semibold text-ink-soft">{meta.name}</span>
          {d.revisedAt && <StatusTag tone="warn">{`Revised ${paperDate(d.revisedAt)}`}</StatusTag>}
        </div>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          {clientName ? (
            <>
              For <Inert text={clientName} />.{' '}
            </>
          ) : null}
          {statusLine}
        </p>
        <div className="mt-md flex flex-wrap items-center gap-xs">
          {d.status === 'draft' && (
            <Button onClick={() => setStatus.mutate('sent')} disabled={setStatus.isPending}>
              <Icon icon={Send} size={18} />
              Send to client
            </Button>
          )}
          {d.status === 'approved' && (
            <Button onClick={() => duplicate.mutate()} disabled={duplicate.isPending}>
              <Icon icon={CopyPlus} size={18} />
              Revise into a new draft
            </Button>
          )}
          <ShareButton onClick={() => setOpen({ kind: 'share' })} savedClientId={d.clientId} hasLink={Boolean(link)} />
          <PrintButton onPrint={print} />
          <MoreMenu items={more} label="More for this document" />
        </div>
        {error && (
          <p role="alert" className="mt-sm m-0 rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-red)' }}>
            {error instanceof ApiError ? error.message : 'That did not work. Try again.'}
          </p>
        )}
      </header>

      {/* A record (signed or approved) has nothing to edit, so a phone shows it whole with no switch. */}
      {editable && <EditPreviewSwitch value={view} onChange={setView} />}

      <section className={`no-print mt-lg ${editable && view === 'preview' ? 'hidden md:block' : ''}`} aria-labelledby="parts-heading">
        <h2 id="parts-heading" className="text-[24px]">
          The document
        </h2>
        <div className="mt-sm">
          <PartsList
            doc={doc}
            editable={editable}
            briefName="Questions"
            details={[clientName || 'No client', doc.currency].filter(Boolean).join(', ')}
            canSummary={`Comments ${doc.show.comments ? 'on' : 'off'}. Once sent, they can read, approve and download a PDF.`}
            waiting={waitingFrom(comments)}
            thread={comments.length === 0 ? 'No comments yet. Copies you emailed and the approval are listed here too.' : `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}, the last from ${latest?.author === 'client' ? 'the client' : 'you'}`}
            onOpen={setOpen}
          />
        </div>
      </section>

      <section className={`mt-lg legal-host ${editable && view === 'edit' ? 'hidden md:block print:block' : ''}`} aria-labelledby="preview-heading">
        <h2 id="preview-heading" className="no-print text-[24px]">
          Preview
        </h2>
        <div className="mt-sm">
          <ContractView audience="owner" kind="document" doc={doc} answers={d.answers} acceptance={d.acceptance} reference={d.ref} date={d.sentAt ?? d.createdAt} stamp={sheetStamp} />
        </div>
        <p className="no-print mt-md m-0 text-[12px] font-semibold text-ink-mute">{COPY.law}</p>
      </section>

      {dirty && editable && <SaveBar onSave={() => save.mutate()} saving={save.isPending} />}

      <Sheet open={open?.kind === 'details'} onClose={closeSheet} title="Details">
        <label className="block text-[14px] font-bold" htmlFor="d-title">
          Title
        </label>
        <input id="d-title" value={doc.title} onChange={(e) => edit((x) => ({ ...x, title: e.target.value }))} maxLength={120} className={FIELD} />
        <label className="mt-sm block text-[14px] font-bold" htmlFor="d-sub">
          Line under the title
        </label>
        <input id="d-sub" value={doc.subtitle} onChange={(e) => edit((x) => ({ ...x, subtitle: e.target.value }))} maxLength={160} className={FIELD} />
        <div className="mt-sm grid gap-sm md:grid-cols-2">
          <label className="block text-[14px] font-bold" htmlFor="d-client">
            Client
            <select id="d-client" value={clientId ?? ''} onChange={(e) => setClientId(e.target.value || null)} className={FIELD}>
              <option value="">No client</option>
              {clients.data?.clients.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[14px] font-bold" htmlFor="d-cur">
            Money in
            <select id="d-cur" value={doc.currency} onChange={(e) => edit((x) => ({ ...x, currency: e.target.value }))} className={FIELD}>
              {AGENCY_CURRENCIES.map((cur) => (
                <option key={cur} value={cur}>
                  {cur}
                </option>
              ))}
            </select>
          </label>
        </div>
        <h3 className="mt-md text-[16px]">Names and blanks</h3>
        <p className="mt-xs m-0 text-balance text-[14px] font-semibold text-ink-soft">These fill the {'{{blanks}}'} in the text. A blank left empty prints as a line to write on.</p>
        <div className="mt-xs grid gap-sm md:grid-cols-2">
          {CONTRACT_VARS.map((v) => (
            <label key={v.key} className="block text-[14px] font-bold">
              {v.label}
              <input value={doc.vars[v.key] ?? ''} maxLength={300} onChange={(e) => edit((x) => ({ ...x, vars: { ...x.vars, [v.key]: e.target.value } }))} className={FIELD} />
            </label>
          ))}
        </div>
        <div className="mt-md">
          <Button onClick={closeSheet}>Done</Button>
        </div>
      </Sheet>

      <Sheet open={Boolean(openSection)} onClose={closeSheet} title={openSection?.heading || 'Section'}>
        {openSection && (
          <>
            <label className="block text-[14px] font-bold" htmlFor={`h-${openSection.id}`}>
              Heading
            </label>
            <input id={`h-${openSection.id}`} value={openSection.heading} maxLength={120} onChange={(e) => patchSection(openSection.id, { heading: e.target.value })} className={FIELD} />
            <label className="mt-sm block text-[14px] font-bold" htmlFor={`b-${openSection.id}`}>
              {openSection.kind === 'signatures' ? 'Words above the signatures' : 'Words'}
            </label>
            <textarea id={`b-${openSection.id}`} value={openSection.body} rows={openSection.kind === 'text' ? 10 : 4} maxLength={CONTRACT_TEXT_MAX} onChange={(e) => patchSection(openSection.id, { body: e.target.value })} className={FIELD} />
            <p className="mt-xs m-0 text-balance text-[12px] font-semibold text-ink-soft">{COPY.hint}</p>
            {openSection.kind === 'packages' && (
              <PackagesEditor s={openSection} currency={doc.currency} count={counts[openSection.id] ?? ''} onCount={(v) => setCounts((m) => ({ ...m, [openSection.id]: v }))} onChange={(p) => patchSection(openSection.id, p)} />
            )}
            {openSection.kind === 'brief' && <BriefEditor s={openSection} onChange={(qs) => patchSection(openSection.id, { questions: qs })} armed={armed} tap={tap} />}
            <SectionSheetFoot
              id={openSection.id}
              index={openIndex}
              count={doc.sections.length}
              onMove={(by) => edit((x) => moved(x, openSection.id, by))}
              onRemove={() => {
                closeSheet();
                edit((x) => ({ ...x, sections: x.sections.filter((y) => y.id !== openSection.id) }));
              }}
              onDone={closeSheet}
              armed={armed}
              tap={tap}
            />
          </>
        )}
      </Sheet>

      <AddSectionSheet open={open?.kind === 'add'} onClose={closeSheet} onAdd={addSection} briefName="Questions" briefBlurb="Questions the client answers at their link before they approve." />

      <Sheet open={open?.kind === 'can'} onClose={closeSheet} title="Client permissions">
        <Toggle on={doc.show.comments} onChange={(on) => edit((x) => ({ ...x, show: { ...x.show, comments: on } }))} label="Write comments" hint="They can ask for a change at their link." />
        <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Once it is sent, they can always read it, approve it and download a PDF.</p>
        <div className="mt-md pb-xl">
          <Button onClick={closeSheet}>Done</Button>
        </div>
      </Sheet>

      <ThreadSheet open={open?.kind === 'thread'} onClose={closeSheet} type="doc" id={id} comments={comments} reply={reply} setReply={setReply} onSend={() => send.mutate()} sending={send.isPending} fieldId="d-reply" />
      <DocStyleSheet open={open?.kind === 'style'} onClose={closeSheet} value={parseDocStyle(doc.style)} onChange={(style) => edit((x) => ({ ...x, style }))} disabled={!editable} />
      <ShareSheet
        open={open?.kind === 'share'}
        onClose={closeSheet}
        link={link}
        noLink="Send it to the client and a link is made for them."
        clientId={clientId}
        savedClientId={d.clientId}
        clientName={clientName}
        text={text}
        email={emailCtx}
        onEmail={() => setOpen({ kind: 'email' })}
        onPrint={print}
      />
      <EmailCopySheet open={open?.kind === 'email'} onClose={closeSheet} route="docs" id={id} defaultTo={clients.data?.clients.find((cl) => cl.id === clientId)?.contactEmail ?? ''} context={emailCtx} noLinkYet={d.status === 'draft'} />
      <HouseTemplateSheet open={open?.kind === 'house'} onClose={closeSheet} kind="doc" fromId={id} defaultName={doc.title || meta.name} beforeSave={dirty && editable ? () => save.mutateAsync() : undefined} />
      <ConfirmSheet open={confirmWhat === 'draft'} onClose={closeSheet} title="Take it back to draft?" body="The client's link closes until you send it again." action="Take back to draft" onConfirm={() => setStatus.mutate('draft')} busy={setStatus.isPending} />
      <ConfirmSheet open={confirmWhat === 'delete'} onClose={closeSheet} title="Delete this document?" body="It is removed for good, with its comments." action="Delete it" onConfirm={() => remove.mutate()} busy={remove.isPending} />

      <Sheet open={open?.kind === 'template'} onClose={closeSheet} title="Save as template">
        <p className="m-0 text-balance text-[14px] font-semibold text-ink-soft">A template keeps the sections and the look, not the names filled in. Start a new document from it any time.</p>
        <label className="mt-sm block text-[14px] font-bold" htmlFor="dtpl-name">
          Name
        </label>
        <input id="dtpl-name" value={tplName} maxLength={60} onChange={(e) => setTplName(e.target.value)} className={FIELD} />
        {dirty && editable && <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">Your unsaved changes are saved first, so the template matches what you see.</p>}
        {tplDone && (
          <p role="status" className="mt-sm m-0 text-[14px] font-bold">
            {tplDone}
          </p>
        )}
        <div className="mt-md flex flex-wrap gap-xs">
          {sameName && (
            <Button onClick={() => saveTemplate.mutate(sameName.id)} disabled={saveTemplate.isPending || Boolean(tplDone)}>
              Replace "{sameName.name}"
            </Button>
          )}
          <Button variant={sameName ? 'outline' : 'primary'} onClick={() => saveTemplate.mutate(null)} disabled={saveTemplate.isPending || !tplName.trim() || Boolean(tplDone)}>
            {saveTemplate.isPending ? 'Saving' : sameName ? 'Save as a new one' : 'Save template'}
          </Button>
          <Button variant="ghost" onClick={closeSheet}>
            {tplDone ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}
