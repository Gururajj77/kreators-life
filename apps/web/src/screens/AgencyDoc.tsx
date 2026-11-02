import {
  AGENCY_DOC_KIND_META,
  AGENCY_DOC_STATUS_NAME,
  AGENCY_DOC_STATUS_TONE,
  AGENCY_CURRENCIES,
  contractAsText,
  CONTRACT_TEXT_MAX,
  CONTRACT_VARS,
  MAX_CONTRACT_SECTIONS,
  parseDocStyle,
  type ContractDoc,
  type ContractSection,
} from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '../components/Button';
import { ContractView, paperDate } from '../components/ContractView';
import { DocActions, DocLog, DocTextFold, EmailCopySheet } from '../components/DocActions';
import { DocStyleCard, DocStyleSheet } from '../components/DocStyleSheet';
import { HouseTemplateButton } from '../components/HouseTemplateButton';
import { Inert } from '../components/Inert';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { StatusTag } from '../components/StatusTag';
import { Toggle } from '../components/Toggle';
import type { SheetStamp } from '../components/PrintSheet';
import { api, ApiError } from '../lib/api';
import { fileTitle, useAutoPrint } from '../lib/printDoc';
import { tie } from '../lib/text';
import { BriefEditor, COPY, field, KIND_NAME, lineOf, newId, PackagesEditor, small, useTwoTap } from './AgencyContract';

type Open = { kind: 'details' } | { kind: 'section'; id: string } | { kind: 'can' } | { kind: 'thread' } | { kind: 'template' } | { kind: 'style' } | { kind: 'email' } | { kind: 'activity' } | null;

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
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState<Open>(null);
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
  // ?print=1 opens the print window once the document has loaded (Download PDF on a list row); ?email=1 opens the email sheet.
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
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const edit = (fn: (x: ContractDoc) => ContractDoc) => setDoc((x) => (x ? fn(x) : x));
  const patchSection = (sid: string, p: Partial<ContractSection>) => edit((x) => ({ ...x, sections: x.sections.map((s) => (s.id === sid ? { ...s, ...p } : s)) }));
  const moveSection = (i: number, by: -1 | 1) =>
    edit((x) => {
      const next = [...x.sections];
      const j = i + by;
      if (j < 0 || j >= next.length) return x;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return { ...x, sections: next };
    });
  const addSection = (kind: 'text' | 'packages' | 'brief') => {
    const base: ContractSection = { id: newId(), heading: kind === 'packages' ? 'Fees' : kind === 'brief' ? 'Questions' : 'New section', kind, body: '' };
    if (kind === 'packages') {
      base.unitName = 'pieces';
      base.packages = [{ name: 'Package', units: 1, feeCents: 0 }];
    }
    if (kind === 'brief') base.questions = [];
    edit((x) => {
      if (x.sections.length >= MAX_CONTRACT_SECTIONS) return x;
      const at = x.sections.findIndex((s) => s.kind === 'signatures');
      const next = [...x.sections];
      next.splice(at < 0 ? next.length : at, 0, base);
      return { ...x, sections: next };
    });
    setOpen({ kind: 'section', id: base.id });
  };

  if (q.isPending) return <Screen columns={false}><p className="pt-lg m-0 text-[16px] font-semibold text-ink-soft">Loading…</p></Screen>;
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
  const fileName = fileTitle(meta.name, clientName, doc.title);
  const sheetStamp: SheetStamp | null = d.status === 'draft' ? 'draft' : d.status === 'approved' ? 'approved' : d.status === 'revised' ? 'revised' : null;
  const openSection = open?.kind === 'section' ? doc.sections.find((s) => s.id === open.id) : undefined;
  const comments = thread.data?.comments ?? [];
  const latest = comments[comments.length - 1];
  const sameName = mine.data?.templates.find((t) => t.scope === 'own' && t.name.trim().toLowerCase() === tplName.trim().toLowerCase());
  const closeSheet = () => setOpen(null);
  const row = 'flex flex-wrap items-center justify-between gap-xs rounded-tile bg-card p-sm shadow-toy-soft';

  return (
    <Screen columns={false}>
      <header className="no-print pt-lg">
        <BackLink to="/agency?tab=agreements&agseg=other">Documents</BackLink>
        <h1 className="text-[30px]">{tie(doc.title || meta.name)}</h1>
        <div className="mt-xs flex flex-wrap items-center gap-xs">
          <StatusTag tone={AGENCY_DOC_STATUS_TONE[d.status]}>{AGENCY_DOC_STATUS_NAME[d.status]}</StatusTag>
          <span className="text-[14px] font-semibold text-ink-soft">{meta.name}</span>
          {d.revisedAt && <span className="text-[14px] font-semibold text-ink-soft">Revised {paperDate(d.revisedAt)}</span>}
          {clientName && <span className="text-[14px] font-semibold text-ink-soft">For {clientName}</span>}
          {dirty && editable && <StatusTag tone="warn">Unsaved changes</StatusTag>}
        </div>
      </header>

      <div className="no-print">
        {error && (
          <p role="alert" className="mt-md m-0 rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-red)' }}>
            {error instanceof ApiError ? error.message : 'That did not work. Try again.'}
          </p>
        )}

        <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="send-heading">
          <h2 id="send-heading" className="text-[20px]">
            Send and keep
          </h2>
          {d.status === 'approved' && d.acceptance && (
            <p className="mt-xs m-0 text-[16px] font-semibold">
              Approved by <strong>{d.acceptance.name}</strong>
              {d.acceptance.title ? `, ${d.acceptance.title}` : ''} on {paperDate(d.acceptance.at)}. An approved document is a record. Make a revised copy.
            </p>
          )}
          {d.status === 'draft' && <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">Not sent yet. Send it and the client gets a link to read it and approve.</p>}
          {(d.status === 'sent' || d.status === 'revised') && (
            <>
              <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">Sent {d.sentAt ? paperDate(d.sentAt) : ''}. Share this link. The client sees a change at the same link, marked as revised.</p>
              <div className="mt-xs flex flex-wrap items-center gap-xs">
                <input readOnly value={link} aria-label="Link for the client" onFocus={(e) => e.currentTarget.select()} className="min-h-[44px] min-w-0 flex-1 rounded-pill border-2 border-line bg-paper px-sm font-mono text-[14px]" />
                <Button size="sm" variant="outline" onClick={copyLink}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <a href={link} target="_blank" rel="noopener noreferrer" className="toy toy-ink inline-flex min-h-[40px] items-center rounded-pill border border-ink/30 bg-card-strong px-sm text-[14px] font-semibold text-ink">
                  Open as the client
                </a>
              </div>
            </>
          )}
          <div className="mt-sm flex flex-wrap gap-xs">
            {editable && (
              <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
                {save.isPending ? 'Saving' : 'Save changes'}
              </Button>
            )}
            {d.status === 'draft' && (
              <Button variant="outline" onClick={() => setStatus.mutate('sent')} disabled={setStatus.isPending}>
                Send to client
              </Button>
            )}
            {(d.status === 'sent' || d.status === 'revised') && (
              <Button variant="outline" onClick={() => tap('draft', () => setStatus.mutate('draft'))}>
                {armed === 'draft' ? 'Tap again to close the link' : 'Take back to draft'}
              </Button>
            )}
            <Button variant="outline" onClick={() => duplicate.mutate()} disabled={duplicate.isPending}>
              {d.status === 'approved' ? 'Revise (new draft)' : 'Duplicate'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setTplName(doc.title || 'My template');
                setTplDone('');
                saveTemplate.reset();
                setOpen({ kind: 'template' });
              }}
            >
              Save as template
            </Button>
            <HouseTemplateButton kind="doc" fromId={id} defaultName={doc.title || meta.name} beforeSave={dirty && editable ? () => save.mutateAsync() : undefined} />
            {d.status === 'draft' && (
              <Button variant="ghost" onClick={() => tap('delete', () => remove.mutate())}>
                {armed === 'delete' ? 'Tap again to delete' : 'Delete'}
              </Button>
            )}
          </div>
          <DocActions className="mt-sm" fileName={fileName} text={text} onEmail={() => setOpen({ kind: 'email' })} />
        </section>
        <DocTextFold text={text} />

        {editable && (
          <section className="mt-lg" aria-labelledby="parts-heading">
            <h2 id="parts-heading" className="text-[24px]">
              The document
            </h2>
            <p className="mt-xs m-0 text-balance text-[14px] font-semibold text-ink-soft">Each part has its own Edit. What you change shows in the preview at once; save when you are happy.</p>
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              <li className={row}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-extrabold">Details</span>
                  <span className="block text-[14px] font-semibold text-ink-soft">{[clientName || 'No client', doc.currency].filter(Boolean).join(', ')}</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => setOpen({ kind: 'details' })}>
                  Edit
                </Button>
              </li>
              {doc.sections.map((s, i) => (
                <li key={s.id} className={row}>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-xs">
                      <span className="text-[16px] font-extrabold">{tie(s.heading || 'Untitled')}</span>
                      <StatusTag tone={s.kind === 'text' || s.kind === 'signatures' ? 'neutral' : 'info'}>{KIND_NAME[s.kind]}</StatusTag>
                    </span>
                    <span className="block text-[14px] font-semibold text-ink-soft">{lineOf(s, doc.vars)}</span>
                  </span>
                  <span className="flex flex-wrap gap-xs">
                    <Button size="sm" variant="outline" onClick={() => setOpen({ kind: 'section', id: s.id })}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => moveSection(i, -1)} disabled={i === 0} aria-label={`Move ${s.heading || 'section'} up`}>
                      Up
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => moveSection(i, 1)} disabled={i === doc.sections.length - 1} aria-label={`Move ${s.heading || 'section'} down`}>
                      Down
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => tap(`rm-${s.id}`, () => edit((x) => ({ ...x, sections: x.sections.filter((y) => y.id !== s.id) })))}>
                      {armed === `rm-${s.id}` ? 'Tap again to remove' : 'Remove'}
                    </Button>
                  </span>
                </li>
              ))}
              <li className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 text-[16px] font-extrabold">Add a section</p>
                <div className="mt-xs flex flex-wrap gap-xs">
                  <Button size="sm" variant="outline" onClick={() => addSection('text')} disabled={doc.sections.length >= MAX_CONTRACT_SECTIONS}>
                    Text
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addSection('packages')} disabled={doc.sections.length >= MAX_CONTRACT_SECTIONS}>
                    Packages and prices
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => addSection('brief')} disabled={doc.sections.length >= MAX_CONTRACT_SECTIONS}>
                    Questions
                  </Button>
                </div>
              </li>
              <DocStyleCard style={parseDocStyle(doc.style)} onEdit={() => setOpen({ kind: 'style' })} />
              <li className={row}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-extrabold">What the client can do</span>
                  <span className="block text-[14px] font-semibold text-ink-soft">Comments {doc.show.comments ? 'on' : 'off'}. Once sent, they can read, approve and download a PDF.</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => setOpen({ kind: 'can' })}>
                  Edit
                </Button>
              </li>
            </ul>
          </section>
        )}
        {d.status === 'approved' && (
          <p className="mt-md m-0 rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-sky)' }}>
            An approved document is a record. A copy keeps the words and starts a new draft with no answers and no link.
          </p>
        )}

        <section className="mt-md" aria-labelledby="thread-heading">
          <h2 id="thread-heading" className="sr-only">
            Comments and activity
          </h2>
          <ul className="flex list-none flex-col gap-xs p-0 m-0">
            <li className={row}>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-extrabold">Comments</span>
                <span className="block text-[14px] font-semibold text-ink-soft">
                  {comments.length === 0 ? 'None yet. When the client asks for a change, it shows here.' : `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}, the last from ${latest?.author === 'client' ? 'the client' : 'you'}`}
                </span>
              </span>
              <Button size="sm" variant="outline" onClick={() => setOpen({ kind: 'thread' })}>
                Open
              </Button>
            </li>
            <li className={row}>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-extrabold">Activity</span>
                <span className="block text-[14px] font-semibold text-ink-soft">Copies you emailed and when it was approved.</span>
              </span>
              <Button size="sm" variant="outline" onClick={() => setOpen({ kind: 'activity' })}>
                Open
              </Button>
            </li>
          </ul>
        </section>
      </div>

      <section className="mt-lg legal-host" aria-labelledby="preview-heading">
        <h2 id="preview-heading" className="no-print text-[24px]">
          Preview
        </h2>
        <div className="mt-sm">
          <ContractView kind="document" doc={doc} answers={d.answers} acceptance={d.acceptance} reference={d.ref} date={d.sentAt ?? d.createdAt} stamp={sheetStamp} />
        </div>
        <p className="no-print mt-md m-0 text-[12px] font-semibold text-ink-mute">{COPY.law}</p>
      </section>

      <Sheet open={open?.kind === 'details'} onClose={closeSheet} title="Details">
        <label className="block text-[14px] font-bold" htmlFor="d-title">
          Title
        </label>
        <input id="d-title" value={doc.title} onChange={(e) => edit((x) => ({ ...x, title: e.target.value }))} maxLength={120} className={small} />
        <label className="mt-sm block text-[14px] font-bold" htmlFor="d-sub">
          Line under the title
        </label>
        <input id="d-sub" value={doc.subtitle} onChange={(e) => edit((x) => ({ ...x, subtitle: e.target.value }))} maxLength={160} className={small} />
        <div className="mt-sm grid gap-sm md:grid-cols-2">
          <label className="block text-[14px] font-bold" htmlFor="d-client">
            Client
            <select id="d-client" value={clientId ?? ''} onChange={(e) => setClientId(e.target.value || null)} className={small}>
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
            <select id="d-cur" value={doc.currency} onChange={(e) => edit((x) => ({ ...x, currency: e.target.value }))} className={small}>
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
              <input value={doc.vars[v.key] ?? ''} maxLength={300} onChange={(e) => edit((x) => ({ ...x, vars: { ...x.vars, [v.key]: e.target.value } }))} className={small} />
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
            <input id={`h-${openSection.id}`} value={openSection.heading} maxLength={120} onChange={(e) => patchSection(openSection.id, { heading: e.target.value })} className={small} />
            <label className="mt-sm block text-[14px] font-bold" htmlFor={`b-${openSection.id}`}>
              {openSection.kind === 'signatures' ? 'Words above the signatures' : 'Words'}
            </label>
            <textarea id={`b-${openSection.id}`} value={openSection.body} rows={openSection.kind === 'text' ? 10 : 4} maxLength={CONTRACT_TEXT_MAX} onChange={(e) => patchSection(openSection.id, { body: e.target.value })} className={field} />
            <p className="mt-xs m-0 text-balance text-[12px] font-semibold text-ink-soft">{COPY.hint}</p>
            {openSection.kind === 'packages' && (
              <PackagesEditor s={openSection} currency={doc.currency} count={counts[openSection.id] ?? ''} onCount={(v) => setCounts((m) => ({ ...m, [openSection.id]: v }))} onChange={(p) => patchSection(openSection.id, p)} />
            )}
            {openSection.kind === 'brief' && <BriefEditor s={openSection} onChange={(qs) => patchSection(openSection.id, { questions: qs })} armed={armed} tap={tap} />}
            <div className="mt-md">
              <Button onClick={closeSheet}>Done</Button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={open?.kind === 'can'} onClose={closeSheet} title="What the client can do">
        <Toggle on={doc.show.comments} onChange={(on) => edit((x) => ({ ...x, show: { ...x.show, comments: on } }))} label="Write comments" hint="They can ask for a change at their link." />
        <div className="mt-md">
          <Button onClick={closeSheet}>Done</Button>
        </div>
      </Sheet>

      <DocStyleSheet open={open?.kind === 'style'} onClose={closeSheet} value={parseDocStyle(doc.style)} onChange={(style) => edit((x) => ({ ...x, style }))} disabled={!editable} />
      <EmailCopySheet open={open?.kind === 'email'} onClose={closeSheet} route="docs" id={id} defaultTo={clients.data?.clients.find((cl) => cl.id === clientId)?.contactEmail ?? ''} text={text} noLinkYet={d.status === 'draft'} />
      <Sheet open={open?.kind === 'activity'} onClose={closeSheet} title="Activity">
        <DocLog type="doc" id={id} />
      </Sheet>

      <Sheet open={open?.kind === 'thread'} onClose={closeSheet} title="Comments">
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
            if (reply.trim()) send.mutate();
          }}
        >
          <label className="block text-[14px] font-bold" htmlFor="d-reply">
            Reply
          </label>
          <textarea id="d-reply" value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={600} className={field} />
          <div className="mt-xs">
            <Button type="submit" size="sm" disabled={send.isPending || !reply.trim()}>
              {send.isPending ? 'Sending' : 'Add reply'}
            </Button>
          </div>
        </form>
      </Sheet>

      <Sheet open={open?.kind === 'template'} onClose={closeSheet} title="Save as template">
        <p className="m-0 text-balance text-[14px] font-semibold text-ink-soft">A template keeps the sections and the look, not the names filled in. Start a new document from it any time.</p>
        <label className="mt-sm block text-[14px] font-bold" htmlFor="dtpl-name">
          Name
        </label>
        <input id="dtpl-name" value={tplName} maxLength={60} onChange={(e) => setTplName(e.target.value)} className={small} />
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
