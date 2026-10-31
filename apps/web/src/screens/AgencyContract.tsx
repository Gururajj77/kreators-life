import {
  AGENCY_CURRENCIES,
  CONTRACT_STATUS_NAME,
  CONTRACT_STATUS_TONE,
  CONTRACT_TEXT_MAX,
  CONTRACT_VARS,
  MAX_CONTRACT_QUESTIONS,
  MAX_CONTRACT_SECTIONS,
  money,
  priceForUnits,
  type ContractDoc,
  type ContractPackage,
  type ContractQuestion,
  type ContractSection,
} from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../components/Button';
import { ContractView, paperDate } from '../components/ContractView';
import { Inert } from '../components/Inert';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { StatusTag } from '../components/StatusTag';
import { Toggle } from '../components/Toggle';
import { api, ApiError } from '../lib/api';
import { tie } from '../lib/text';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const small = 'mt-xs w-full min-h-[44px] rounded-tile border-2 border-line bg-paper px-sm text-[16px]';
const COPY = {
  hint: 'A blank line starts a new paragraph. Start a line with "- " for a bullet. Put two stars round words to make them bold. Write {{client}} to fill in a name from the form above.',
  law: 'Typed acceptance, not a certified e-signature. A starting point, not legal advice: have a lawyer read it before you rely on it.',
  sentNote: 'The client sees a change at the same link, marked as revised.',
  signed: 'A signed agreement is a record. Make a revised copy.',
};

/** A control that asks twice: the first tap says what it will do, the second does it. */
function useTwoTap(): [string | null, (key: string, run: () => void) => void] {
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
    const cur = Math.round(Number.parseFloat(txt || '0') * 100);
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
        const n = Math.round(Number.parseFloat(v) * 100);
        if (v === '') onChange(0);
        else if (Number.isFinite(n) && n >= 0) onChange(n);
      }}
      className={small}
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
      className={field}
    />
  );
}

const newId = () => `n${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/** The agreement editor: every part can be changed while it is a draft or has been sent but not signed. */
export function AgencyContract() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [armed, tap] = useTwoTap();
  const q = useQuery({ queryKey: ['agency', 'contract', id], queryFn: () => api.agencyContract(id) });
  const clients = useQuery({ queryKey: ['agency', 'clients-pick'], queryFn: () => api.agency('csize=100') });
  const c = q.data?.contract;
  const [doc, setDoc] = useState<ContractDoc | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const stamp = c ? `${c.id}:${c.updatedAt}` : 'none';
  useEffect(() => {
    if (!c) return;
    setDoc(c.doc);
    setClientId(c.clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);

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
  const thread = useQuery({ queryKey: ['agency', 'comments', 'contract', id], queryFn: () => api.agencyComments('contract', id), enabled: Boolean(c) });
  const [reply, setReply] = useState('');
  const send = useMutation({
    mutationFn: () => api.agencyCommentAdd('contract', id, reply),
    onSuccess: () => {
      setReply('');
      void qc.invalidateQueries({ queryKey: ['agency', 'comments', 'contract', id] });
    },
  });

  const error = [save, setStatus, duplicate, remove].map((m) => m.error).find(Boolean);
  const link = c?.token ? `${window.location.origin}/k/${c.token}` : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  const printIt = () => {
    const prev = document.title;
    document.title = doc?.title || 'Agreement';
    const restore = () => {
      document.title = prev;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
  };

  const edit = (fn: (d: ContractDoc) => ContractDoc) => setDoc((d) => (d ? fn(d) : d));
  const patchSection = (i: number, p: Partial<ContractSection>) => edit((d) => ({ ...d, sections: d.sections.map((s, j) => (j === i ? { ...s, ...p } : s)) }));
  const moveSection = (i: number, by: -1 | 1) =>
    edit((d) => {
      const next = [...d.sections];
      const j = i + by;
      if (j < 0 || j >= next.length) return d;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return { ...d, sections: next };
    });
  const addSection = (kind: 'text' | 'packages' | 'brief') =>
    edit((d) => {
      if (d.sections.length >= MAX_CONTRACT_SECTIONS) return d;
      const base: ContractSection = { id: newId(), heading: kind === 'packages' ? 'Fees' : kind === 'brief' ? 'Brief' : 'New section', kind, body: '' };
      if (kind === 'packages') {
        base.unitName = 'pieces';
        base.packages = [{ name: 'Package', units: 1, feeCents: 0 }];
      }
      if (kind === 'brief') base.questions = [];
      // A new section goes before the signatures, so the signing block stays last.
      const at = d.sections.findIndex((s) => s.kind === 'signatures');
      const next = [...d.sections];
      next.splice(at < 0 ? next.length : at, 0, base);
      return { ...d, sections: next };
    });

  if (q.isPending) return <Screen columns={false}><p className="pt-lg m-0 text-[16px] font-semibold text-ink-soft">Loading…</p></Screen>;
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

  return (
    <Screen columns={false}>
      <header className="no-print pt-lg">
        <BackLink to="/agency?tab=agreements">Agency</BackLink>
        <h1 className="text-[30px]">{tie(doc.title || 'Agreement')}</h1>
        <div className="mt-xs flex flex-wrap items-center gap-xs">
          <StatusTag tone={CONTRACT_STATUS_TONE[c.status]}>{CONTRACT_STATUS_NAME[c.status]}</StatusTag>
          {c.revisedAt && <span className="text-[14px] font-semibold text-ink-soft">Revised {paperDate(c.revisedAt)}</span>}
          {c.clientName && <span className="text-[14px] font-semibold text-ink-soft">For {c.clientName}</span>}
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
          {c.status === 'signed' && c.acceptance && (
            <p className="mt-xs m-0 text-[16px] font-semibold">
              Accepted by <strong>{c.acceptance.name}</strong>
              {c.acceptance.title ? `, ${c.acceptance.title}` : ''} on {paperDate(c.acceptance.at)}. {COPY.signed}
            </p>
          )}
          {c.status === 'void' && <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">This agreement is voided. Its link is closed.</p>}
          {c.status === 'draft' && <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">Not sent yet. Send it and the client gets a link to read it, answer the brief and accept.</p>}
          {c.status === 'sent' && (
            <>
              <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">Sent {c.sentAt ? paperDate(c.sentAt) : ''}. Share this link. {COPY.sentNote}</p>
              <div className="mt-xs flex flex-wrap items-center gap-xs">
                <input readOnly value={link} aria-label="Link for the client" onFocus={(e) => e.currentTarget.select()} className="min-h-[44px] min-w-0 flex-1 rounded-pill border-2 border-line bg-paper px-sm font-mono text-[14px]" />
                <Button size="sm" variant="outline" onClick={copy}>
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
            {c.status === 'draft' && (
              <Button variant="outline" onClick={() => setStatus.mutate('sent')} disabled={setStatus.isPending}>
                Send to client
              </Button>
            )}
            {c.status === 'sent' && (
              <Button variant="outline" onClick={() => tap('draft', () => setStatus.mutate('draft'))}>
                {armed === 'draft' ? 'Tap again to close the link' : 'Take back to draft'}
              </Button>
            )}
            {(c.status === 'draft' || c.status === 'sent' || c.status === 'signed') && (
              <Button variant="outline" onClick={() => tap('void', () => setStatus.mutate('void'))}>
                {armed === 'void' ? 'Tap again to void it' : 'Void'}
              </Button>
            )}
            <Button variant="outline" onClick={() => duplicate.mutate()} disabled={duplicate.isPending}>
              {c.status === 'signed' ? 'Revise (new draft)' : 'Duplicate'}
            </Button>
            {doc.show.download && (
              <Button variant="outline" onClick={printIt}>
                Download PDF
              </Button>
            )}
            {(c.status === 'draft' || c.status === 'void') && (
              <Button variant="ghost" onClick={() => tap('delete', () => remove.mutate())}>
                {armed === 'delete' ? 'Tap again to delete' : 'Delete'}
              </Button>
            )}
          </div>
          {dirty && editable && <p className="mt-xs m-0 text-[14px] font-bold">You have changes that are not saved.</p>}
          <p className="mt-xs m-0 text-[12px] font-semibold text-ink-mute">"Download PDF" opens the print window. Choose "Save as PDF" there.</p>
        </section>

        {editable ? (
          <>
            <section className="mt-lg" aria-labelledby="details-heading">
              <h2 id="details-heading" className="text-[24px]">
                Details
              </h2>
              <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
                <label className="block text-[14px] font-bold" htmlFor="c-title">
                  Title
                </label>
                <input id="c-title" value={doc.title} onChange={(e) => edit((d) => ({ ...d, title: e.target.value }))} maxLength={120} className={small} />
                <label className="mt-sm block text-[14px] font-bold" htmlFor="c-sub">
                  Line under the title
                </label>
                <input id="c-sub" value={doc.subtitle} onChange={(e) => edit((d) => ({ ...d, subtitle: e.target.value }))} maxLength={160} className={small} />
                <div className="mt-sm grid gap-sm md:grid-cols-2">
                  <label className="block text-[14px] font-bold" htmlFor="c-client">
                    Client
                    <select id="c-client" value={clientId ?? ''} onChange={(e) => setClientId(e.target.value || null)} className={small}>
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
                    <select id="c-cur" value={doc.currency} onChange={(e) => edit((d) => ({ ...d, currency: e.target.value }))} className={small}>
                      {AGENCY_CURRENCIES.map((cur) => (
                        <option key={cur} value={cur}>
                          {cur}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </section>

            <section className="mt-lg" aria-labelledby="vars-heading">
              <h2 id="vars-heading" className="text-[24px]">
                Names and blanks
              </h2>
              <p className="mt-xs m-0 text-balance text-[14px] font-semibold text-ink-soft">These fill the {'{{blanks}}'} in the text. A blank left empty prints as a line to write on.</p>
              <div className="mt-sm grid gap-sm rounded-card bg-card p-md shadow-toy-soft md:grid-cols-2">
                {CONTRACT_VARS.map((v) => (
                  <label key={v.key} className="block text-[14px] font-bold">
                    {v.label}
                    <input value={doc.vars[v.key] ?? ''} maxLength={300} onChange={(e) => edit((d) => ({ ...d, vars: { ...d.vars, [v.key]: e.target.value } }))} className={small} />
                  </label>
                ))}
              </div>
            </section>

            <section className="mt-lg" aria-labelledby="parts-heading">
              <h2 id="parts-heading" className="text-[24px]">
                Sections
              </h2>
              <p className="mt-xs m-0 text-balance text-[14px] font-semibold text-ink-soft">{COPY.hint}</p>
              <ol className="mt-sm flex list-none flex-col gap-sm p-0 m-0">
                {doc.sections.map((s, i) => (
                  <li key={s.id} className="rounded-card bg-card p-md shadow-toy-soft">
                    <div className="flex flex-wrap items-center justify-between gap-xs">
                      <span className="text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
                        {s.kind === 'text' ? 'Text' : s.kind === 'packages' ? 'Packages and prices' : s.kind === 'brief' ? 'Brief for the client' : 'Signatures'}
                      </span>
                      <span className="flex flex-wrap gap-xs">
                        <Button size="sm" variant="outline" onClick={() => moveSection(i, -1)} disabled={i === 0} aria-label={`Move ${s.heading || 'section'} up`}>
                          Up
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => moveSection(i, 1)} disabled={i === doc.sections.length - 1} aria-label={`Move ${s.heading || 'section'} down`}>
                          Down
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => tap(`rm-${s.id}`, () => edit((d) => ({ ...d, sections: d.sections.filter((_, j) => j !== i) })))}>
                          {armed === `rm-${s.id}` ? 'Tap again to remove' : 'Remove'}
                        </Button>
                      </span>
                    </div>
                    <label className="mt-xs block text-[14px] font-bold" htmlFor={`h-${s.id}`}>
                      Heading
                    </label>
                    <input id={`h-${s.id}`} value={s.heading} maxLength={120} onChange={(e) => patchSection(i, { heading: e.target.value })} className={small} />
                    <label className="mt-sm block text-[14px] font-bold" htmlFor={`b-${s.id}`}>
                      {s.kind === 'signatures' ? 'Words above the signatures' : 'Words'}
                    </label>
                    <textarea id={`b-${s.id}`} value={s.body} rows={s.kind === 'text' ? 8 : 4} maxLength={CONTRACT_TEXT_MAX} onChange={(e) => patchSection(i, { body: e.target.value })} className={field} />

                    {s.kind === 'packages' && <PackagesEditor s={s} currency={doc.currency} count={counts[s.id] ?? ''} onCount={(v) => setCounts((m) => ({ ...m, [s.id]: v }))} onChange={(p) => patchSection(i, p)} />}
                    {s.kind === 'brief' && <BriefEditor s={s} onChange={(qs) => patchSection(i, { questions: qs })} armed={armed} tap={tap} />}
                  </li>
                ))}
              </ol>
              <div className="mt-sm flex flex-wrap gap-xs">
                <Button size="sm" variant="outline" onClick={() => addSection('text')} disabled={doc.sections.length >= MAX_CONTRACT_SECTIONS}>
                  Add a text section
                </Button>
                <Button size="sm" variant="outline" onClick={() => addSection('packages')} disabled={doc.sections.length >= MAX_CONTRACT_SECTIONS}>
                  Add packages and prices
                </Button>
                <Button size="sm" variant="outline" onClick={() => addSection('brief')} disabled={doc.sections.length >= MAX_CONTRACT_SECTIONS}>
                  Add a brief
                </Button>
              </div>
            </section>

            <section className="mt-lg" aria-labelledby="can-heading">
              <h2 id="can-heading" className="text-[24px]">
                What the client can do
              </h2>
              <div className="mt-sm flex flex-col gap-xs">
                <Toggle on={doc.show.comments} onChange={(on) => edit((d) => ({ ...d, show: { ...d.show, comments: on } }))} label="Write comments" hint="They can ask for a change at their link." />
                <Toggle on={doc.show.download} onChange={(on) => edit((d) => ({ ...d, show: { ...d.show, download: on } }))} label="Download a PDF copy" hint="They can save or print a copy." />
              </div>
            </section>
          </>
        ) : (
          c.status === 'signed' && (
            <p className="mt-md m-0 rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-sky)' }}>
              {COPY.signed} A copy keeps the words and starts a new draft with no answers and no link.
            </p>
          )
        )}
      </div>

      <section className="mt-lg" aria-labelledby="preview-heading">
        <h2 id="preview-heading" className="no-print text-[24px]">
          Preview
        </h2>
        <div className="mt-sm">
          <ContractView doc={doc} answers={c.answers} acceptance={c.acceptance} />
        </div>
      </section>

      <section className="no-print mt-lg" aria-labelledby="thread-heading">
        <h2 id="thread-heading" className="text-[24px]">
          Comments
        </h2>
        {thread.data && thread.data.comments.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">No comments yet. When the client asks for a change at their link, it shows here.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {thread.data?.comments.map((m) => (
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
          <label className="block text-[14px] font-bold" htmlFor="c-reply">
            Reply
          </label>
          <textarea id="c-reply" value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={600} className={field} />
          <div className="mt-xs">
            <Button type="submit" size="sm" disabled={send.isPending || !reply.trim()}>
              {send.isPending ? 'Sending' : 'Add reply'}
            </Button>
          </div>
        </form>
        <p className="mt-md m-0 text-[12px] font-semibold text-ink-mute">{COPY.law}</p>
      </section>
    </Screen>
  );
}

function PackagesEditor({ s, currency, count, onCount, onChange }: { s: ContractSection; currency: string; count: string; onCount: (v: string) => void; onChange: (p: Partial<ContractSection>) => void }) {
  const packages = s.packages ?? [];
  const setPkg = (i: number, p: Partial<ContractPackage>) => onChange({ packages: packages.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const n = Math.round(Number(count));
  const price = count && n > 0 ? priceForUnits(packages, s.extra, n) : undefined;
  return (
    <div className="mt-sm rounded-tile bg-paper p-sm">
      <label className="block text-[14px] font-bold">
        What is counted
        <input value={s.unitName ?? ''} maxLength={20} placeholder="videos" onChange={(e) => onChange({ unitName: e.target.value })} className={small} />
      </label>
      <ul className="mt-sm flex list-none flex-col gap-sm p-0 m-0">
        {packages.map((p, i) => (
          <li key={i} className="grid grid-cols-2 gap-xs md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
            <label className="col-span-2 block text-[12px] font-bold md:col-span-1">
              Package name
              <input value={p.name} maxLength={60} onChange={(e) => setPkg(i, { name: e.target.value })} className={small} />
            </label>
            <label className="block text-[12px] font-bold">
              How many
              <input type="number" min={0} max={10000} value={p.units} onChange={(e) => setPkg(i, { units: Math.max(0, Math.round(Number(e.target.value)) || 0) })} className={small} />
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
          <input type="number" min={0} max={10000} value={s.extra?.units ?? 0} onChange={(e) => onChange({ extra: { units: Math.max(0, Math.round(Number(e.target.value)) || 0), feeCents: s.extra?.feeCents ?? 0 } })} className={small} />
        </label>
        <label className="block text-[12px] font-bold">
          Fee for a block ({currency})
          <MoneyField cents={s.extra?.feeCents ?? 0} label="Fee for each extra block" onChange={(feeCents) => onChange({ extra: { units: s.extra?.units ?? 0, feeCents } })} />
        </label>
      </div>
      <label className="mt-sm block text-[12px] font-bold">
        Try a number: what does it cost?
        <input inputMode="numeric" value={count} onChange={(e) => onCount(e.target.value.replace(/[^0-9]/g, ''))} className={small} />
      </label>
      {count && (
        <p className="mt-xs m-0 text-[14px] font-bold">{price === undefined ? '' : price === null ? 'That number is not on the list. Quote it in writing.' : price > 0 ? money(price, currency) : 'No fee set yet.'}</p>
      )}
    </div>
  );
}

function BriefEditor({ s, onChange, armed, tap }: { s: ContractSection; onChange: (qs: ContractQuestion[]) => void; armed: string | null; tap: (key: string, run: () => void) => void }) {
  const qs = s.questions ?? [];
  const set = (i: number, p: Partial<ContractQuestion>) => onChange(qs.map((q, j) => (j === i ? { ...q, ...p } : q)));
  return (
    <div className="mt-sm rounded-tile bg-paper p-sm">
      <ol className="flex list-none flex-col gap-sm p-0 m-0">
        {qs.map((q, i) => (
          <li key={q.id} className="rounded-tile bg-card p-sm">
            <label className="block text-[14px] font-bold">
              Question {i + 1}
              <textarea value={q.label} rows={2} maxLength={400} onChange={(e) => set(i, { label: e.target.value })} className={field} />
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
          <Button size="sm" variant="outline" onClick={() => onChange([...qs, { id: newId(), label: '', options: [], multi: false, other: false, text: false }])}>
            Add a question
          </Button>
        </div>
      )}
    </div>
  );
}
