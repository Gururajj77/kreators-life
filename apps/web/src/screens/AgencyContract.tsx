import {
  contractAsText,
  docRef,
  fillContractText,
  AGENCY_CURRENCIES,
  CONTRACT_STATUS_NAME,
  CONTRACT_STATUS_TONE,
  CONTRACT_TEXT_MAX,
  CONTRACT_VARS,
  MAX_CONTRACT_QUESTIONS,
  MAX_CONTRACT_SECTIONS,
  docStyleSummary,
  money,
  parseDocStyle,
  type DocComment,
  priceForUnits,
  type ContractDoc,
  type ContractPackage,
  type ContractQuestion,
  type ContractSection,
  typedCents,
  sectionPrints,
} from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Ban, Building2, ChevronRight, CopyPlus, LayoutTemplate, Plus, Send, Trash2, Undo2 } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '../components/Button';
import { ContractView, paperDate } from '../components/ContractView';
import { ConfirmSheet, DocLog, EmailCopySheet, PrintButton, type EmailContext } from '../components/DocActions';
import { DocStyleSheet } from '../components/DocStyleSheet';
import { Segmented } from '../components/fx/Segmented';
import { HouseTemplateSheet, useSuperAdmin } from '../components/HouseTemplateButton';
import { Icon } from '../components/Icon';
import { MoreMenu, type MoreMenuItem } from '../components/MoreMenu';
import { ShareButton, ShareSheet } from '../components/ShareSheet';
import { Busy, Skeleton, SkeletonCard } from '../components/Skeleton';
import type { SheetStamp } from '../components/PrintSheet';
import { Inert } from '../components/Inert';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { StatusTag } from '../components/StatusTag';
import { Toggle } from '../components/Toggle';
import { api, ApiError } from '../lib/api';
import { fileTitle, printAs, useAutoPrint } from '../lib/printDoc';
import { useParamState } from '../lib/useParamState';
import { tie } from '../lib/text';
import { FIELD } from '../lib/ui';

export const COPY = {
  hint: 'A blank line starts a new paragraph. Start a line with "- " for a bullet. Put two stars round words to make them bold. Write {{client}} to fill in a name from Names and blanks.',
  law: 'Typed acceptance, not a certified e-signature. A starting point, not legal advice: have a lawyer read it before you rely on it.',
  sentNote: 'The client sees a change at the same link, marked as revised.',
  signed: 'A signed agreement is a record. Make a revised copy.',
};

/** A control that asks twice: the first tap says what it will do, the second does it. */
export function useTwoTap(): [string | null, (key: string, run: () => void) => void] {
  const [armed, setArmed] = useState<string | null>(null);
  const tap = (key: string, run: () => void) => {
    if (armed === key) {
      setArmed(null);
      run();
      return;
    }
    setArmed(key);
    window.setTimeout(() => setArmed((a) => (a === key ? null : a)), 4000);
  };
  return [armed, tap];
}

/** An amount typed in whole units (rupees) and kept in cents. */
function MoneyField({ cents, onChange, label }: { cents: number; onChange: (cents: number) => void; label: string }) {
  const [txt, setTxt] = useState(cents ? String(cents / 100) : '');
  useEffect(() => {
    const cur = typedCents(txt || '0');
    if (!Number.isFinite(cur) || cur !== cents) setTxt(cents ? String(cents / 100) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents]);
  return (
    <input
      inputMode="decimal"
      value={txt}
      aria-label={label}
      onChange={(e) => {
        const v = e.target.value;
        setTxt(v);
        const n = typedCents(v);
        if (v === '') onChange(0);
        else if (Number.isFinite(n) && n >= 0) onChange(n);
      }}
      className={FIELD}
    />
  );
}

/** One option a line: typing a new line never jumps, because the text is kept here and only the list goes up. */
function LinesField({ value, onChange, label, max }: { value: string[]; onChange: (v: string[]) => void; label: string; max: number }) {
  const [txt, setTxt] = useState(value.join('\n'));
  const parse = (t: string) =>
    t
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, max);
  useEffect(() => {
    if (JSON.stringify(parse(txt)) !== JSON.stringify(value)) setTxt(value.join('\n'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <textarea
      value={txt}
      rows={Math.min(8, Math.max(3, txt.split('\n').length + 1))}
      aria-label={label}
      onChange={(e) => {
        setTxt(e.target.value);
        onChange(parse(e.target.value));
      }}
      className={FIELD}
    />
  );
}

export const newId = () => `n${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/** One short line saying what a section holds, for its row. */
export function lineOf(s: ContractSection, vars: Record<string, string>): string {
  if (s.kind === 'packages') {
    const n = s.packages?.length ?? 0;
    return `${n} ${n === 1 ? 'package' : 'packages'}${s.unitName ? ` of ${s.unitName}` : ''}`;
  }
  if (s.kind === 'brief') {
    const n = s.questions?.length ?? 0;
    return `${n} ${n === 1 ? 'question' : 'questions'} for the client`;
  }
  const first = fillContractText(s.body, vars, 'owner').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const plain = first.replace(/^-\s*/, '').replace(/\*\*/g, '');
  if (!plain) return 'Empty so far';
  if (plain.length <= 80) return tie(plain);
  // Cut at a word, never in the middle of one, and keep the last two words together so no word is left alone.
  const cut = plain.slice(0, 80);
  return tie(`${cut.slice(0, Math.max(cut.lastIndexOf(' '), 40)).trimEnd()}…`);
}

/** The sheets this page opens, one at a time: a part of the agreement, the thread, saving a template, sharing. */
export type Open = { kind: 'details' } | { kind: 'section'; id: string } | { kind: 'add' } | { kind: 'can' } | { kind: 'thread' } | { kind: 'template' } | { kind: 'house' } | { kind: 'style' } | { kind: 'email' } | { kind: 'share' } | { kind: 'confirm'; what: 'draft' | 'void' | 'delete' } | null;

/**
 * The agreement editor: one primary action for where it stands, Share, Download or print and More at the top; a short inset list of its
 * parts, each opening just that part; the agreement itself under it (on a phone, Edit and Preview take turns). Draft or sent can change;
 * signed is a record.
 */
export function AgencyContract() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [armed, tap] = useTwoTap();
  const q = useQuery({ queryKey: ['agency', 'contract', id], queryFn: () => api.agencyContract(id) });
  const clients = useQuery({ queryKey: ['agency', 'clients-pick'], queryFn: () => api.agency('csize=100') });
  const mine = useQuery({ queryKey: ['agency', 'templates', 'contract'], queryFn: () => api.agencyTemplates('contract') });
  const superAdmin = useSuperAdmin();
  const [view, setView] = useEditPreview();
  const c = q.data?.contract;
  const [doc, setDoc] = useState<ContractDoc | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Open>(null);
  const [tplName, setTplName] = useState('');
  const [tplDone, setTplDone] = useState('');
  const stamp = c ? `${c.id}:${c.updatedAt}` : 'none';
  useEffect(() => {
    if (!c) return;
    setDoc(c.doc);
    setClientId(c.clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);

  const [params] = useSearchParams();
  // ?print=1 opens the print window once the agreement has loaded (Download or print on a list row); ?email=1 opens the email sheet.
  useAutoPrint(Boolean(c && doc), fileTitle('Agreement', c?.clientName, c?.doc.title));
  useEffect(() => {
    if (c && params.get('email') === '1') setOpen({ kind: 'email' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id]);

  const editable = c?.status === 'draft' || c?.status === 'sent';
  const dirty = Boolean(c && doc && (JSON.stringify(doc) !== JSON.stringify(c.doc) || clientId !== c.clientId));
  const invalidate = () => qc.invalidateQueries({ queryKey: ['agency'] });
  const done = () => void invalidate();

  const save = useMutation({ mutationFn: () => api.agencyContractUpdate(id, { doc: doc!, clientId }), onSuccess: done });
  const setStatus = useMutation({
    mutationFn: async (status: 'draft' | 'sent' | 'void') => {
      if (status === 'sent' && dirty && doc) await api.agencyContractUpdate(id, { doc, clientId });
      return api.agencyContractUpdate(id, { status });
    },
    onSuccess: done,
  });
  const duplicate = useMutation({
    mutationFn: () => api.agencyContractDuplicate(id),
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
  // A template takes what is saved, so unsaved changes are saved first. A template with the same name can be replaced instead of added.
  const saveTemplate = useMutation({
    mutationFn: async (replaceId: string | null) => {
      if (dirty && editable && doc) await api.agencyContractUpdate(id, { doc, clientId });
      if (replaceId) return api.agencyTemplateUpdate(replaceId, { fromId: id });
      return api.agencyTemplateAdd({ kind: 'contract', name: tplName.trim(), fromId: id });
    },
    onSuccess: () => {
      setTplDone(`Saved as "${tplName.trim()}". Start a new agreement from it any time.`);
      done();
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

  const error = [save, setStatus, duplicate, remove, saveTemplate].map((m) => m.error).find(Boolean);
  const link = c?.token && c.status !== 'void' ? `${window.location.origin}/k/${c.token}` : '';
  const edit = (fn: (d: ContractDoc) => ContractDoc) => setDoc((d) => (d ? fn(d) : d));
  const patchSection = (sid: string, p: Partial<ContractSection>) => edit((d) => ({ ...d, sections: d.sections.map((s) => (s.id === sid ? { ...s, ...p } : s)) }));
  const addSection = (kind: 'text' | 'packages' | 'brief') => {
    if (!doc) return;
    const r = withSection(doc, kind, 'Brief');
    setDoc(r.doc);
    setOpen(r.id ? { kind: 'section', id: r.id } : null);
  };

  if (q.isPending) {
    return (
      <Screen columns={false}>
        <header className="pt-lg">
          <BackLink to="/agency?tab=agreements">Agency</BackLink>
        </header>
        <Busy label="Loading the agreement" className="mt-md grid gap-md">
          <Skeleton className="h-[36px] w-2/3" />
          <Skeleton className="h-[48px] w-1/2" />
          <SkeletonCard lines={6} />
          <SkeletonCard lines={10} />
        </Busy>
      </Screen>
    );
  }
  if (q.isError || !c || !doc) {
    return (
      <Screen columns={false}>
        <header className="pt-lg">
          <BackLink to="/agency?tab=agreements">Agency</BackLink>
          <h1 className="text-[30px]">Not found</h1>
          <p role="alert" className="m-0 text-[16px] font-semibold text-ink-soft">That agreement is not here. It may have been removed.</p>
        </header>
      </Screen>
    );
  }

  const clientName = clients.data?.clients.find((cl) => cl.id === clientId)?.name ?? c.clientName;
  const ref = docRef('AGR', c.id);
  const text = contractAsText(doc, { reference: ref, date: c.sentAt ?? c.createdAt, answers: c.answers, acceptance: c.acceptance });
  const emailCtx: EmailContext = { kind: 'contract', clientId: c.clientId, title: doc.title, number: ref, signed: c.status === 'signed', docKind: doc.templateKey };
  const fileName = fileTitle('Agreement', clientName, doc.title);
  const print = () => printAs(fileName);
  const sheetStamp: SheetStamp | null = c.status === 'draft' ? 'draft' : c.status === 'void' ? 'void' : c.status === 'signed' ? 'signed' : c.revisedAt ? 'revised' : null;
  const openSection = open?.kind === 'section' ? doc.sections.find((s) => s.id === open.id) : undefined;
  const openIndex = openSection ? doc.sections.indexOf(openSection) : -1;
  const comments = thread.data?.comments ?? [];
  const latest = comments[comments.length - 1];
  const sameName = mine.data?.templates.find((t) => t.name.trim().toLowerCase() === tplName.trim().toLowerCase());
  const closeSheet = () => setOpen(null);
  const statusLine =
    c.status === 'signed' && c.acceptance
      ? `Accepted by ${c.acceptance.name}${c.acceptance.title ? `, ${c.acceptance.title}` : ''} on ${paperDate(c.acceptance.at)}. ${COPY.signed}`
      : c.status === 'void'
        ? 'Voided. Its link is closed.'
        : c.status === 'draft'
          ? 'Not sent yet. Send it and the client gets a link to read it, answer the brief and accept.'
          : `Sent ${c.sentAt ? paperDate(c.sentAt) : ''}. ${COPY.sentNote}`;
  const openTemplate = () => {
    setTplName(doc.title || 'My template');
    setTplDone('');
    saveTemplate.reset();
    setOpen({ kind: 'template' });
  };
  const more: MoreMenuItem[] = [
    ...(c.status !== 'signed' ? [{ key: 'dup', label: 'Duplicate', icon: CopyPlus, onSelect: () => duplicate.mutate(), disabled: duplicate.isPending }] : []),
    { key: 'tpl', label: 'Save as template', icon: LayoutTemplate, onSelect: openTemplate },
    ...(superAdmin && (editable || c.status === 'signed') ? [{ key: 'house', label: 'Save as house template', icon: Building2, onSelect: () => setOpen({ kind: 'house' }) }] : []),
    ...(c.status === 'sent' ? [{ key: 'draft', label: 'Take back to draft', icon: Undo2, destructive: true, onSelect: () => setOpen({ kind: 'confirm', what: 'draft' }) }] : []),
    ...(c.status === 'draft' || c.status === 'sent' || c.status === 'signed' ? [{ key: 'void', label: 'Void', icon: Ban, destructive: true, onSelect: () => setOpen({ kind: 'confirm', what: 'void' }) }] : []),
    ...(c.status === 'draft' || c.status === 'void' ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onSelect: () => setOpen({ kind: 'confirm', what: 'delete' }) }] : []),
  ];
  const confirmWhat = open?.kind === 'confirm' ? open.what : null;

  return (
    <Screen columns={false}>
      <header className="no-print pt-lg">
        <BackLink to="/agency?tab=agreements">Agency</BackLink>
        <h1 className="text-[30px]">{tie(doc.title || 'Agreement')}</h1>
        <div className="mt-xs flex flex-wrap items-center gap-xs">
          <StatusTag tone={CONTRACT_STATUS_TONE[c.status]}>{CONTRACT_STATUS_NAME[c.status]}</StatusTag>
          {c.revisedAt && <StatusTag tone="warn">{`Revised ${paperDate(c.revisedAt)}`}</StatusTag>}
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
          {c.status === 'draft' && (
            <Button onClick={() => setStatus.mutate('sent')} disabled={setStatus.isPending}>
              <Icon icon={Send} size={18} />
              Send to client
            </Button>
          )}
          {c.status === 'signed' && (
            <Button onClick={() => duplicate.mutate()} disabled={duplicate.isPending}>
              <Icon icon={CopyPlus} size={18} />
              Revise into a new draft
            </Button>
          )}
          <ShareButton onClick={() => setOpen({ kind: 'share' })} savedClientId={c.clientId} hasLink={Boolean(link)} />
          <PrintButton onPrint={print} />
          <MoreMenu items={more} label="More for this agreement" />
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
          The agreement
        </h2>
        <div className="mt-sm">
          <PartsList
            doc={doc}
            editable={editable}
            briefName="Brief"
            details={[clientName || 'No client', doc.vars.jurisdiction ? `courts of ${doc.vars.jurisdiction}` : '', doc.currency].filter(Boolean).join(', ')}
            canSummary={`Comments ${doc.show.comments ? 'on' : 'off'}. Once sent, they can always download a PDF.`}
            waiting={waitingFrom(comments)}
            thread={comments.length === 0 ? 'No comments yet. Copies you emailed and the acceptance are listed here too.' : `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}, the last from ${latest?.author === 'client' ? 'the client' : 'you'}`}
            onOpen={setOpen}
          />
        </div>
      </section>

      <section className={`mt-lg legal-host ${editable && view === 'edit' ? 'hidden md:block print:block' : ''}`} aria-labelledby="preview-heading">
        <h2 id="preview-heading" className="no-print text-[24px]">
          Preview
        </h2>
        <div className="mt-sm">
          <ContractView audience="owner" doc={doc} answers={c.answers} acceptance={c.acceptance} reference={ref} date={c.sentAt ?? c.createdAt} stamp={sheetStamp} />
        </div>
        <p className="no-print mt-md m-0 text-[12px] font-semibold text-ink-mute">{COPY.law}</p>
      </section>

      {dirty && editable && <SaveBar onSave={() => save.mutate()} saving={save.isPending} />}

      <Sheet open={open?.kind === 'details'} onClose={closeSheet} title="Details">
        <label className="block text-[14px] font-bold" htmlFor="c-title">
          Title
        </label>
        <input id="c-title" value={doc.title} onChange={(e) => edit((d) => ({ ...d, title: e.target.value }))} maxLength={120} className={FIELD} />
        <label className="mt-sm block text-[14px] font-bold" htmlFor="c-sub">
          Line under the title
        </label>
        <input id="c-sub" value={doc.subtitle} onChange={(e) => edit((d) => ({ ...d, subtitle: e.target.value }))} maxLength={160} className={FIELD} />
        <div className="mt-sm grid gap-sm md:grid-cols-2">
          <label className="block text-[14px] font-bold" htmlFor="c-client">
            Client
            <select id="c-client" value={clientId ?? ''} onChange={(e) => setClientId(e.target.value || null)} className={FIELD}>
              <option value="">No client</option>
              {clients.data?.clients.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[14px] font-bold" htmlFor="c-cur">
            Money in
            <select id="c-cur" value={doc.currency} onChange={(e) => edit((d) => ({ ...d, currency: e.target.value }))} className={FIELD}>
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
              <input value={doc.vars[v.key] ?? ''} maxLength={300} onChange={(e) => edit((d) => ({ ...d, vars: { ...d.vars, [v.key]: e.target.value } }))} className={FIELD} />
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
            {openSection.kind !== 'signatures' && (
              <div className="mt-sm">
                <Toggle on={sectionPrints(openSection)} onChange={(on) => patchSection(openSection.id, { print: on })} label="Print this section" hint="Off keeps it on the screen and the client's link and out of the printed page. The agreement is its main text; the brief and notes of information need not print." />
              </div>
            )}
            {openSection.kind === 'brief' && <BriefEditor s={openSection} onChange={(qs) => patchSection(openSection.id, { questions: qs })} armed={armed} tap={tap} />}
            <SectionSheetFoot
              id={openSection.id}
              index={openIndex}
              count={doc.sections.length}
              onMove={(by) => edit((d) => moved(d, openSection.id, by))}
              onRemove={() => {
                closeSheet();
                edit((d) => ({ ...d, sections: d.sections.filter((x) => x.id !== openSection.id) }));
              }}
              onDone={closeSheet}
              armed={armed}
              tap={tap}
            />
          </>
        )}
      </Sheet>

      <AddSectionSheet open={open?.kind === 'add'} onClose={closeSheet} onAdd={addSection} briefName="A brief" briefBlurb="Questions the client answers at their link before they accept." />

      <Sheet open={open?.kind === 'can'} onClose={closeSheet} title="Client permissions">
        <div className="flex flex-col gap-xs">
          <Toggle on={doc.show.comments} onChange={(on) => edit((d) => ({ ...d, show: { ...d.show, comments: on } }))} label="Write comments" hint="They can ask for a change at their link." />
        </div>
        <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Once it is sent, they can always read it, answer the brief, accept and download a PDF.</p>
        <div className="mt-md pb-xl">
          <Button onClick={closeSheet}>Done</Button>
        </div>
      </Sheet>

      <ThreadSheet open={open?.kind === 'thread'} onClose={closeSheet} type="contract" id={id} comments={comments} reply={reply} setReply={setReply} onSend={() => send.mutate()} sending={send.isPending} fieldId="c-reply" />
      <DocStyleSheet open={open?.kind === 'style'} onClose={closeSheet} value={parseDocStyle(doc.style)} onChange={(style) => edit((d) => ({ ...d, style }))} disabled={!editable} />
      <ShareSheet
        open={open?.kind === 'share'}
        onClose={closeSheet}
        link={link}
        noLink={c.status === 'void' ? 'A voided agreement has no link.' : 'Send it to the client and a link is made for them.'}
        clientId={clientId}
        savedClientId={c.clientId}
        clientName={clientName}
        text={text}
        email={emailCtx}
        onEmail={() => setOpen({ kind: 'email' })}
        onPrint={print}
      />
      <EmailCopySheet open={open?.kind === 'email'} onClose={closeSheet} route="contracts" id={id} defaultTo={clients.data?.clients.find((cl) => cl.id === clientId)?.contactEmail ?? ''} context={emailCtx} noLinkYet={c.status === 'draft' || c.status === 'void'} />
      <HouseTemplateSheet open={open?.kind === 'house'} onClose={closeSheet} kind="contract" fromId={id} defaultName={doc.title || 'Agreement'} beforeSave={dirty && editable ? () => save.mutateAsync() : undefined} />
      <ConfirmSheet open={confirmWhat === 'draft'} onClose={closeSheet} title="Take it back to draft?" body="The client's link closes until you send it again. Their answers so far are kept." action="Take back to draft" onConfirm={() => setStatus.mutate('draft')} busy={setStatus.isPending} />
      <ConfirmSheet open={confirmWhat === 'void'} onClose={closeSheet} title="Void this agreement?" body="It is kept for the record and its link closes. It cannot be sent or signed after this." action="Void it" onConfirm={() => setStatus.mutate('void')} busy={setStatus.isPending} />
      <ConfirmSheet open={confirmWhat === 'delete'} onClose={closeSheet} title="Delete this agreement?" body="It is removed for good, with its comments." action="Delete it" onConfirm={() => remove.mutate()} busy={remove.isPending} />

      <Sheet open={open?.kind === 'template'} onClose={closeSheet} title="Save as template">
        <p className="m-0 text-balance text-[14px] font-semibold text-ink-soft">A template keeps the sections and the look, not the names filled in. Start a new agreement from it any time.</p>
        <label className="mt-sm block text-[14px] font-bold" htmlFor="tpl-name">
          Name
        </label>
        <input id="tpl-name" value={tplName} maxLength={60} onChange={(e) => setTplName(e.target.value)} className={FIELD} />
        {dirty && editable && <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">Your unsaved changes are saved first, so the template matches what you see.</p>}
        {sameName && (
          <p className="mt-sm m-0 rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-yellow)' }}>
            You already have a template called "{sameName.name}".
          </p>
        )}
        {tplDone && (
          <p role="status" className="mt-sm m-0 text-[14px] font-bold">
            {tplDone}
          </p>
        )}
        <div className="mt-md flex flex-wrap gap-xs">
          {sameName && (
            <Button onClick={() => saveTemplate.mutate(sameName.id)} disabled={saveTemplate.isPending || Boolean(tplDone)}>
              Replace it with this
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

export function PackagesEditor({ s, currency, count, onCount, onChange }: { s: ContractSection; currency: string; count: string; onCount: (v: string) => void; onChange: (p: Partial<ContractSection>) => void }) {
  const packages = s.packages ?? [];
  const setPkg = (i: number, p: Partial<ContractPackage>) => onChange({ packages: packages.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const n = Math.round(Number(count));
  const price = count && n > 0 ? priceForUnits(packages, s.extra, n) : undefined;
  return (
    <div className="mt-sm rounded-tile bg-paper p-sm">
      <label className="block text-[14px] font-bold">
        What is counted
        <input value={s.unitName ?? ''} maxLength={20} placeholder="videos" onChange={(e) => onChange({ unitName: e.target.value })} className={FIELD} />
      </label>
      <ul className="mt-sm flex list-none flex-col gap-sm p-0 m-0">
        {packages.map((p, i) => (
          <li key={i} className="grid grid-cols-2 gap-xs md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
            <label className="col-span-2 block text-[12px] font-bold md:col-span-1">
              Package name
              <input value={p.name} maxLength={60} onChange={(e) => setPkg(i, { name: e.target.value })} className={FIELD} />
            </label>
            <label className="block text-[12px] font-bold">
              How many
              <input type="number" min={0} max={10000} value={p.units} onChange={(e) => setPkg(i, { units: Math.max(0, Math.round(Number(e.target.value)) || 0) })} className={FIELD} />
            </label>
            <label className="block text-[12px] font-bold">
              Fee ({currency})
              <MoneyField cents={p.feeCents} label={`Fee for ${p.name || 'package'}`} onChange={(feeCents) => setPkg(i, { feeCents })} />
            </label>
            <Button size="sm" variant="ghost" onClick={() => onChange({ packages: packages.filter((_, j) => j !== i) })} aria-label={`Remove ${p.name || 'package'}`}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      {packages.length < 8 && (
        <div className="mt-xs">
          <Button size="sm" variant="outline" onClick={() => onChange({ packages: [...packages, { name: 'Package', units: 1, feeCents: 0 }] })}>
            Add a package
          </Button>
        </div>
      )}
      <div className="mt-sm grid grid-cols-2 gap-xs">
        <label className="block text-[12px] font-bold">
          Each extra block holds
          <input type="number" min={0} max={10000} value={s.extra?.units ?? 0} onChange={(e) => onChange({ extra: { units: Math.max(0, Math.round(Number(e.target.value)) || 0), feeCents: s.extra?.feeCents ?? 0 } })} className={FIELD} />
        </label>
        <label className="block text-[12px] font-bold">
          Fee for a block ({currency})
          <MoneyField cents={s.extra?.feeCents ?? 0} label="Fee for each extra block" onChange={(feeCents) => onChange({ extra: { units: s.extra?.units ?? 0, feeCents } })} />
        </label>
      </div>
      <label className="mt-sm block text-[12px] font-bold">
        Try a number: what does it cost?
        <input inputMode="numeric" value={count} onChange={(e) => onCount(e.target.value.replace(/[^0-9]/g, ''))} className={FIELD} />
      </label>
      {count && (
        <p className="mt-xs m-0 text-[14px] font-bold">{price === undefined ? '' : price === null ? 'That number is not on the list. Quote it in writing.' : price > 0 ? money(price, currency) : 'No fee set yet.'}</p>
      )}
    </div>
  );
}

export function BriefEditor({ s, onChange, armed, tap }: { s: ContractSection; onChange: (qs: ContractQuestion[]) => void; armed: string | null; tap: (key: string, run: () => void) => void }) {
  const qs = s.questions ?? [];
  const set = (i: number, p: Partial<ContractQuestion>) => onChange(qs.map((q, j) => (j === i ? { ...q, ...p } : q)));
  return (
    <div className="mt-sm rounded-tile bg-paper p-sm">
      <ol className="flex list-none flex-col gap-sm p-0 m-0">
        {qs.map((q, i) => (
          <li key={q.id} className="rounded-tile bg-card p-sm">
            <label className="block text-[14px] font-bold">
              Question {i + 1}
              <textarea value={q.label} rows={2} maxLength={400} onChange={(e) => set(i, { label: e.target.value })} className={FIELD} />
            </label>
            <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">One choice on each line. Leave empty for a written answer.</p>
            <LinesField value={q.options} max={12} label={`Choices for question ${i + 1}`} onChange={(options) => set(i, { options })} />
            <div className="mt-xs flex flex-col gap-xs">
              <Toggle compact on={q.multi} onChange={(multi) => set(i, { multi })} label="More than one can be ticked" />
              <Toggle compact on={q.other} onChange={(other) => set(i, { other })} label='An "Other" line' />
              <Toggle compact on={q.text} onChange={(text) => set(i, { text })} label="A written answer" />
            </div>
            <div className="mt-xs">
              <Button size="sm" variant="ghost" onClick={() => tap(`q-${q.id}`, () => onChange(qs.filter((_, j) => j !== i)))}>
                {armed === `q-${q.id}` ? 'Tap again to remove' : 'Remove this question'}
              </Button>
            </div>
          </li>
        ))}
      </ol>
      {qs.length < MAX_CONTRACT_QUESTIONS && (
        <div className="mt-xs">
          <Button size="sm" variant="outline" plusToX onClick={() => onChange([...qs, { id: newId(), label: '', options: [], multi: false, other: false, text: false }])}>
            Add a question
          </Button>
        </div>
      )}
    </div>
  );
}

// ---- the pieces an agreement's page and another document's page share

/** Edit or Preview, kept in the URL: a phone shows one at a time so a long agreement is not one endless page; a laptop shows both. */
export function useEditPreview(): ['edit' | 'preview', (v: 'edit' | 'preview') => void] {
  const [v, set] = useParamState('view', 'edit');
  return [v === 'preview' ? 'preview' : 'edit', set as (v: 'edit' | 'preview') => void];
}
export function EditPreviewSwitch({ value, onChange }: { value: 'edit' | 'preview'; onChange: (v: 'edit' | 'preview') => void }) {
  return (
    <div className="no-print mt-md md:hidden">
      <Segmented<'edit' | 'preview'>
        label="Edit or preview"
        value={value}
        onChange={onChange}
        options={[
          { value: 'edit', label: 'Edit' },
          { value: 'preview', label: 'Preview' },
        ]}
      />
    </div>
  );
}

/** Lines from the client since your own last reply: what is waiting for you. */
export function waitingFrom(comments: readonly DocComment[]): number {
  const lastMine = comments.map((c) => c.author).lastIndexOf('me');
  return comments.slice(lastMine + 1).filter((c) => c.author === 'client').length;
}

/** The bar that holds Save: it shows only when something is not saved, and stays in sight at the foot of the screen while you scroll. */
export function SaveBar({ onSave, saving }: { onSave: () => void; saving: boolean }) {
  return (
    <div role="status" className="no-print sticky bottom-[calc(var(--spacing-xl)+var(--spacing-sm)+env(safe-area-inset-bottom))] z-30 mt-md mr-xl md:bottom-md md:mr-0">
      <div className="flex flex-wrap items-center justify-between gap-sm rounded-tile border border-line bg-card-strong p-sm shadow-toy-soft">
        <p className="m-0 text-[14px] font-bold">You have changes that are not saved.</p>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}

const SECTION_TAG: Partial<Record<ContractSection['kind'], string>> = { packages: 'Prices', brief: 'Brief' };

function PartRow({ title, summary, onOpen, lead, tags, label }: { title: string; summary: ReactNode; onOpen: () => void; lead?: ReactNode; tags?: ReactNode; label?: string }) {
  return (
    <li>
      <button type="button" onClick={onOpen} aria-label={label} className="fx-row text-ink">
        {lead}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-xs">
            <span className="text-[16px] font-extrabold">{title}</span>
            {tags && <span className="inline-flex flex-wrap items-center gap-xs">{tags}</span>}
          </span>
          <span className="mt-xs block text-[14px] font-semibold text-ink-soft">{summary}</span>
        </span>
        <Icon icon={ChevronRight} size={20} className="shrink-0 text-ink-mute" />
      </button>
    </li>
  );
}

/**
 * The parts of an agreement or a document as one inset list: the details, one line per section (its number, its heading, a tag only for a
 * brief, a price list or a section left off the paper), adding a section, the page's look, what the client may do, and the comments and
 * activity. Each line opens its own sheet; moving and removing a section live in that section's sheet. A record (signed or approved) shows
 * only the comments and activity.
 */
export function PartsList({
  doc,
  editable,
  details,
  briefName,
  waiting,
  thread,
  canSummary,
  onOpen,
}: {
  doc: ContractDoc;
  editable: boolean;
  details: string;
  /** What a brief is called on this kind of paper: "Brief" on an agreement, "Questions" on a document. */
  briefName: string;
  waiting: number;
  thread: string;
  canSummary: string;
  onOpen: (o: Exclude<Open, null>) => void;
}) {
  return (
    <ul className="fx-inset" aria-label="Parts">
      {editable && (
        <>
          <PartRow title="Details" summary={details} onOpen={() => onOpen({ kind: 'details' })} label="Edit details" />
          {doc.sections.map((s, i) => {
            const tag = s.kind === 'brief' ? briefName : SECTION_TAG[s.kind];
            return (
              <PartRow
                key={s.id}
                title={tie(s.heading || 'Untitled')}
                label={`Edit section ${i + 1}, ${s.heading || 'untitled'}`}
                lead={<span className="w-[32px] shrink-0 text-center text-[14px] font-extrabold tabular-nums text-ink-mute">{i + 1}</span>}
                tags={
                  <>
                    {tag && <StatusTag tone="info">{tag}</StatusTag>}
                    {!sectionPrints(s) && <StatusTag tone="neutral">Not printed</StatusTag>}
                  </>
                }
                summary={lineOf(s, doc.vars)}
                onOpen={() => onOpen({ kind: 'section', id: s.id })}
              />
            );
          })}
          {doc.sections.length < MAX_CONTRACT_SECTIONS && (
            <li>
              <button type="button" onClick={() => onOpen({ kind: 'add' })} className="fx-row text-ink">
                <span className="w-[32px] shrink-0 text-center text-ink-mute">
                  <Icon icon={Plus} size={20} />
                </span>
                <span className="min-w-0 flex-1 text-[16px] font-extrabold">Add a section</span>
              </button>
            </li>
          )}
          <PartRow title="Document style" summary={docStyleSummary(parseDocStyle(doc.style))} onOpen={() => onOpen({ kind: 'style' })} label="Edit document style" />
          <PartRow title="Client permissions" summary={canSummary} onOpen={() => onOpen({ kind: 'can' })} label="Edit client permissions" />
        </>
      )}
      <PartRow title="Comments and activity" tags={waiting > 0 ? <StatusTag tone="info">{`${waiting} new`}</StatusTag> : undefined} summary={thread} onOpen={() => onOpen({ kind: 'thread' })} />
    </ul>
  );
}

/** Add a section: words, a price list or questions for the client. It goes in before the signatures, so the signing block stays last. */
export function AddSectionSheet({ open, onClose, onAdd, briefName, briefBlurb }: { open: boolean; onClose: () => void; onAdd: (kind: 'text' | 'packages' | 'brief') => void; briefName: string; briefBlurb: string }) {
  const kinds: { kind: 'text' | 'packages' | 'brief'; name: string; blurb: string }[] = [
    { kind: 'text', name: 'Text', blurb: 'Words: a clause, a scope, terms.' },
    { kind: 'packages', name: 'Packages and prices', blurb: 'A price list by how many, with a fee for extra blocks.' },
    { kind: 'brief', name: briefName, blurb: briefBlurb },
  ];
  return (
    <Sheet open={open} onClose={onClose} title="Add a section">
      <ul className="fx-inset mb-xl">
        {kinds.map((k) => (
          <li key={k.kind}>
            <button type="button" className="fx-row text-ink" onClick={() => onAdd(k.kind)}>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-extrabold">{k.name}</span>
                <span className="mt-xs block text-[14px] font-semibold text-ink-soft">{k.blurb}</span>
              </span>
              <Icon icon={ChevronRight} size={20} className="shrink-0 text-ink-mute" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** The foot of a section's sheet: Done, then move it up or down, then a red Remove that asks twice. */
export function SectionSheetFoot({ index, count, onMove, onRemove, onDone, armed, tap, id }: { index: number; count: number; onMove: (by: -1 | 1) => void; onRemove: () => void; onDone: () => void; armed: string | null; tap: (key: string, run: () => void) => void; id: string }) {
  return (
    <div className="mt-md flex flex-wrap items-center gap-xs pb-xl">
      <Button onClick={onDone}>Done</Button>
      <Button variant="outline" onClick={() => onMove(-1)} disabled={index <= 0}>
        <Icon icon={ArrowUp} size={18} />
        Move up
      </Button>
      <Button variant="outline" onClick={() => onMove(1)} disabled={index >= count - 1}>
        <Icon icon={ArrowDown} size={18} />
        Move down
      </Button>
      <Button variant="ghost" className="!text-r1" onClick={() => tap(`rm-${id}`, onRemove)}>
        <Icon icon={Trash2} size={18} />
        {armed === `rm-${id}` ? 'Tap again to remove' : 'Remove'}
      </Button>
    </div>
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

/** A section added in one place: before the signatures, so the signing block stays last, and never past the most a paper holds. */
export function withSection(d: ContractDoc, kind: 'text' | 'packages' | 'brief', briefHeading: string): { doc: ContractDoc; id: string | null } {
  if (d.sections.length >= MAX_CONTRACT_SECTIONS) return { doc: d, id: null };
  const base: ContractSection = { id: newId(), heading: kind === 'packages' ? 'Fees' : kind === 'brief' ? briefHeading : 'New section', kind, body: '' };
  if (kind === 'packages') {
    base.unitName = 'pieces';
    base.packages = [{ name: 'Package', units: 1, feeCents: 0 }];
  }
  if (kind === 'brief') base.questions = [];
  const at = d.sections.findIndex((s) => s.kind === 'signatures');
  const next = [...d.sections];
  next.splice(at < 0 ? next.length : at, 0, base);
  return { doc: { ...d, sections: next }, id: base.id };
}

/** One section moved up or down by one place. */
export function moved(d: ContractDoc, sid: string, by: -1 | 1): ContractDoc {
  const i = d.sections.findIndex((s) => s.id === sid);
  const j = i + by;
  if (i < 0 || j < 0 || j >= d.sections.length) return d;
  const next = [...d.sections];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return { ...d, sections: next };
}
