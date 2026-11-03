import { contractGapNote, contractParties, docDateTime, fillContractText, hasPartiesSection, money, packageRate, parseDocStyle, sectionPrints, stripNumber, type ContractAnswer, type ContractDoc, type ContractSection, type DocAudience } from '@kreators/shared';
import { Fragment, type ReactNode } from 'react';
import { FIELD } from '../lib/ui';
import { Inert } from './Inert';
import { PrintSheet, type SheetStamp } from './PrintSheet';

/** A day as a person reads it on paper: 12 Oct 2026. */
export const paperDate = (iso: string): string => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** A short defined term in double quotes, such as "parties": set in bold on the page. */
const DEFINED = /("[A-Za-z][A-Za-z '-]{1,26}")/g;
function plainRun(text: string, key: string): ReactNode {
  return text.split(DEFINED).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={`${key}-d${i}`}>
        <Inert text={part} />
      </strong>
    ) : (
      <Inert key={`${key}-d${i}`} text={part} />
    ),
  );
}

/** **bold** inside a line, and nothing else: no links, no HTML. Every run of words goes through Inert, so an address stays plain text. */
function inline(text: string, key: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={`${key}-${i}`}>
        <Inert text={part} />
      </strong>
    ) : (
      <Fragment key={`${key}-${i}`}>{plainRun(part, `${key}-${i}`)}</Fragment>
    ),
  );
}

/**
 * The words of one section: paragraphs split by a blank line, lines inside a paragraph kept as lines, "- " bullets and **bold**.
 * Blanks like {{client}} are filled from the variables; a missing one is left out with its label, never drawn as underscores.
 */
function Words({ text, vars, audience }: { text: string; vars: Record<string, string>; audience: DocAudience }) {
  const filled = fillContractText(text, vars, audience).replace(/\r\n/g, '\n');
  const blocks = filled.split(/\n{2,}/).filter((b) => b.trim());
  return (
    <>
      {blocks.map((block, bi) => {
        const out: ReactNode[] = [];
        let bullets: string[] = [];
        let plain: string[] = [];
        const flushPlain = () => {
          if (!plain.length) return;
          const k = `p${bi}-${out.length}`;
          out.push(
            <p key={k} className="legal-clause">
              {plain.map((l, i) => (
                <Fragment key={i}>
                  {i > 0 && <br />}
                  {inline(l, `${k}-${i}`)}
                </Fragment>
              ))}
            </p>,
          );
          plain = [];
        };
        const flushBullets = () => {
          if (!bullets.length) return;
          const k = `u${bi}-${out.length}`;
          out.push(
            <ul key={k} className="legal-list">
              {bullets.map((b, i) => (
                <li key={i}>
                  <span aria-hidden="true" className="shrink-0 font-extrabold">
                    •
                  </span>
                  <span>{inline(b, `${k}-${i}`)}</span>
                </li>
              ))}
            </ul>,
          );
          bullets = [];
        };
        for (const line of block.split('\n')) {
          if (!line.trim()) continue;
          if (/^[-*] /.test(line)) {
            flushPlain();
            bullets.push(line.slice(2));
          } else {
            flushBullets();
            plain.push(line);
          }
        }
        flushPlain();
        flushBullets();
        return <Fragment key={bi}>{out}</Fragment>;
      })}
    </>
  );
}

const one = (unit: string) => (unit.endsWith('s') ? unit.slice(0, -1) : unit);

function Packages({ s, doc }: { s: ContractSection; doc: ContractDoc }) {
  const unit = s.unitName ?? 'pieces';
  const top = Math.max(0, ...(s.packages ?? []).map((p) => p.units));
  const dash = (cents: number) => (cents > 0 ? money(cents, doc.currency) : '—');
  return (
    <div className="mt-sm overflow-x-auto">
      <table className="legal-table text-left">
        <thead>
          <tr>
            <th>Package</th>
            <th>{unit.charAt(0).toUpperCase() + unit.slice(1)}</th>
            <th className="text-right">Package fee</th>
            <th className="text-right">Rate per {one(unit)}</th>
          </tr>
        </thead>
        <tbody>
          {(s.packages ?? []).map((p, i) => (
            <tr key={i}>
              <td>
                <Inert text={p.name} />
              </td>
              <td>{p.units}</td>
              <td className="text-right">{dash(p.feeCents)}</td>
              <td className="text-right">{dash(packageRate(p))}</td>
            </tr>
          ))}
          {s.extra && s.extra.units > 0 && (
            <tr>
              <td>
                Additional {unit} beyond {top}
              </td>
              <td>Each block of {s.extra.units}</td>
              <td className="text-right">{dash(s.extra.feeCents)} a block</td>
              <td className="text-right">{dash(packageRate({ name: '', units: s.extra.units, feeCents: s.extra.feeCents }))}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const blankAnswer: ContractAnswer = { picked: [], other: '', text: '' };

function Brief({ s, answers, onAnswer }: { s: ContractSection; answers: Record<string, ContractAnswer>; onAnswer?: (id: string, a: ContractAnswer) => void }) {
  const live = Boolean(onAnswer);
  return (
    <div className="mt-sm flex flex-col gap-md">
      {(s.questions ?? []).map((q) => {
        const a = answers[q.id] ?? blankAnswer;
        const set = (next: Partial<ContractAnswer>) => onAnswer?.(q.id, { ...a, ...next });
        return (
          <fieldset key={q.id} className="m-0 min-w-0 border-0 p-0">
            <legend className="p-0 text-[16px] font-extrabold">
              <Inert text={q.label} />
            </legend>
            {q.options.length > 0 && (
              <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                {q.options.map((o) => {
                  const on = a.picked.includes(o);
                  return (
                    <li key={o}>
                      <label className={`flex min-h-[44px] items-center gap-sm text-[16px] font-semibold ${live ? 'cursor-pointer' : ''}`}>
                        <input
                          type={q.multi ? 'checkbox' : 'radio'}
                          name={`q-${q.id}`}
                          checked={on}
                          disabled={!live}
                          onChange={() => set({ picked: q.multi ? (on ? a.picked.filter((x) => x !== o) : [...a.picked, o]) : [o] })}
                          className="size-[24px] shrink-0 accent-[var(--color-ink)]"
                        />
                        <span>
                          <Inert text={o} />
                        </span>
                      </label>
                    </li>
                  );
                })}
                {q.other && (
                  <li className="flex min-h-[44px] items-center gap-xs text-[16px] font-semibold">
                    <span>Other:</span>
                    {live ? (
                      <input value={a.other} onChange={(e) => set({ other: e.target.value })} maxLength={200} aria-label={`Other, ${q.label}`} className="min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm py-xs text-[16px]" />
                    ) : (
                      <span className="min-w-0 flex-1 border-b border-ink/40 pb-[2px]">{a.other ? <Inert text={a.other} /> : ' '}</span>
                    )}
                  </li>
                )}
              </ul>
            )}
            {q.text &&
              (live ? (
                <textarea value={a.text} onChange={(e) => set({ text: e.target.value })} rows={4} maxLength={1500} aria-label={q.label} className={FIELD} />
              ) : (
                <p className="mt-xs m-0 min-h-[64px] whitespace-pre-wrap rounded-tile border border-line p-sm text-[16px] font-semibold">{a.text ? <Inert text={a.text} /> : ''}</p>
              ))}
          </fieldset>
        );
      })}
    </div>
  );
}

function Signatures({ doc, acceptance, signLine }: { doc: ContractDoc; acceptance?: { name: string; title: string; at: string } | null; signLine?: { name: string; title: string } | null }) {
  const blank = ' ';
  const row = (label: string, value: string, hand = false) => (
    <p className="legal-sign-line m-0">
      <span className="shrink-0">{label}</span>
      <span className={hand ? 'font-display text-[20px] italic' : ''}>{value || blank}</span>
    </p>
  );
  const client = acceptance ?? (signLine ? { name: signLine.name, title: signLine.title, at: '' } : null);
  return (
    <div>
      <div className="legal-sign">
        <div className="legal-sign-block">
          <h3>For the service provider</h3>
          {row('Name:', doc.vars.provider ?? '')}
          {row('Designation:', doc.vars.providerTitle ?? '')}
          {row('Signature:', '')}
          {row('Date:', '')}
        </div>
        <div className="legal-sign-block">
          <h3>For the client</h3>
          {row('Name:', client?.name ?? '')}
          {row('Designation:', client?.title ?? '')}
          {row('Signature:', acceptance ? acceptance.name : '', true)}
          {row('Date:', acceptance ? paperDate(acceptance.at) : '')}
        </div>
      </div>
      {acceptance && (
        <p className="legal-sign-accepted">
          Accepted electronically by {acceptance.name} on {docDateTime(acceptance.at)}. Typed acceptance, not a certified e-signature.
        </p>
      )}
    </div>
  );
}

interface Props {
  doc: ContractDoc;
  answers?: Record<string, ContractAnswer>;
  /** When it is given, the brief is a form; without it the brief is read only. */
  onAnswer?: (questionId: string, answer: ContractAnswer) => void;
  acceptance?: { name: string; title: string; at: string } | null;
  /** The name and title being typed, shown in the signature block before the client accepts. */
  signLine?: { name: string; title: string } | null;
  /** AGR-1A2B3C, printed in the title block and the running header. */
  reference?: string;
  /** The date on the document. */
  date?: string;
  /** DRAFT, REVISED, SIGNED and so on, stamped faintly across the page. */
  stamp?: SheetStamp | null;
  /** An agreement, or one of the other documents (a summary, trial terms, a proposal, a report). */
  kind?: 'agreement' | 'document';
  /** The owner's page carries one note of what is missing; the client's page (the default) leaves every empty line and part out. */
  audience?: DocAudience;
}

/** The sender's name and address for the top of the first page, from the names filled in. */
function letterheadOf(doc: ContractDoc): { name: string; lines: string[] } {
  const v = doc.vars;
  const f = (k: string) => (v[k] ?? '').trim();
  return { name: f('providerBusiness') || f('provider'), lines: [...f('providerAddress').split('\n'), [f('providerEmail'), f('providerPhone')].filter(Boolean).join(' | ')].map((l) => l.trim()).filter(Boolean) };
}

/** An agreement (or any sectioned document) as a page: the letterhead, the title block, then every section in order. It prints as a legal document (PrintSheet). */
export function ContractView({ doc, answers = {}, onAnswer, acceptance, signLine, reference, date, stamp, kind = 'agreement', audience = 'client' }: Props) {
  const style = parseDocStyle(doc.style);
  const gapNote = audience === 'owner' ? contractGapNote(doc) : null;
  // A part with nothing written in it yet is the owner's to write: the owner sees it marked, the client never sees it.
  const empty = (s: ContractSection) => s.kind === 'text' && !fillContractText(s.body, doc.vars, audience).trim();
  const sections = audience === 'client' ? doc.sections.filter((s) => !empty(s)) : doc.sections;
  return (
    <PrintSheet
      kind={kind}
      title={doc.title}
      subtitle={doc.subtitle}
      reference={reference}
      date={date}
      style={style}
      stamp={stamp}
      letterhead={letterheadOf(doc)}
      parties={hasPartiesSection(doc) ? [] : contractParties(doc)}
    >
      {gapNote && (
        <p className="legal-clause italic" role="note">
          {gapNote}
        </p>
      )}
      {sections.map((s) => (
        <section key={s.id} className={sectionPrints(s) ? 'legal-sec' : 'legal-sec legal-noprint'} aria-label={s.heading || 'Section'}>
          {s.heading && <h2 className="legal-sec-h">{style.heading === 'numbered' ? stripNumber(s.heading) : s.heading}</h2>}
          {s.body && (
            <div>
              <Words text={s.body} vars={doc.vars} audience={audience} />
            </div>
          )}
          {empty(s) && <p className="legal-clause italic">Not written yet. Write this part before you send it.</p>}
          {s.kind === 'packages' && <Packages s={s} doc={doc} />}
          {s.kind === 'brief' && <Brief s={s} answers={answers} onAnswer={onAnswer} />}
          {s.kind === 'signatures' && <Signatures doc={doc} acceptance={acceptance} signLine={signLine} />}
        </section>
      ))}
      {doc.sections.some((s) => !sectionPrints(s)) && (
        <p className="legal-print-note m-0">
          {`Not printed here, and open at the agreement's link: ${doc.sections.filter((s) => !sectionPrints(s)).map((s) => s.heading.replace(/\.$/, '')).join('; ')}.`}
        </p>
      )}
      {doc.sections.length === 0 && <p className="mt-md m-0 text-[16px] font-semibold text-ink-soft">This document has no sections yet.</p>}
    </PrintSheet>
  );
}
