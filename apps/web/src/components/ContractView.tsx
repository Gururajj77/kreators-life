import {
  contractGapNote,
  contractParties,
  CONTRACT_VARS,
  docDateTime,
  docVars,
  fillContractText,
  hasPartiesSection,
  money,
  MAX_CONTRACT_QUESTIONS,
  MAX_CONTRACT_SECTIONS,
  packageRate,
  parseBodyBlocks,
  parseDocStyle,
  sectionPrints,
  stripNumber,
  unitOne,
  writeOnKeys,
  type BodyBlock,
  type ContractAnswer,
  type ContractDoc,
  type ContractPackage,
  type ContractQuestion,
  type ContractSection,
  type DocAudience,
  LOCALE,
} from '@kreators/shared';
import { ArrowDown, ArrowUp, ListPlus, Plus, Printer, Trash2, Type } from 'lucide-react';
import { createElement, useState, type ReactNode } from 'react';
import { FIELD } from '../lib/ui';
import { Inert } from './Inert';
import { type MoreMenuItem } from './MoreMenu';
import { BlocksEditor, EditableText, focusAt, MoneyCell, NumberCell, SectionHandle, useLongPress, VarField, type BlockVars } from './PaperEdit';
import { PrintSheet, type SheetStamp } from './PrintSheet';

/** A day as a person reads it on paper: 12 Oct 2026. */
export const paperDate = (iso: string): string => new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });

const LABEL: Record<string, string> = Object.fromEntries(CONTRACT_VARS.map((v) => [v.key, v.label]));
const labelOf = (k: string) => LABEL[k] ?? k;

/**
 * Read-only words are kept together on a screen by a span round them, never by changing a character, so the text (and a copy of it) is
 * byte for byte what was written. On paper they wrap as the PDF's word processor wraps them.
 */
const KEEP = 'whitespace-nowrap print:whitespace-normal';
/**
 * A word joined by a hyphen ("short-form", "on-ground", "pre-production") never breaks at the hyphen, so half of it is never left alone
 * on the last line; on paper too, as the founder's PDF never breaks one. A web address is not a word: one with a slash, a dot, an @ or a
 * scheme around the hyphen is left to Inert.
 */
const KEEP_WORD = 'whitespace-nowrap';
const HYPHEN_WORD = /(?<![\p{L}\p{N}./:@-])([\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)+)(?![\p{L}\p{N}/@-]|\.[\p{L}\p{N}])/u;

/** A line left to write on by hand (a run of underscores): one unbroken line, cut at the edge of its column, so a narrow phone never leaves a
 * short "__" stub on the next line. The characters are the same; only how much of the line shows changes (print shows it whole). */
const WRITE_ON_RUN = /(_{8,})/;

/** Read-only text: hyphened words kept whole, lines to write on kept to one line, everything else through Inert so an address stays plain text. */
function ReadText({ text }: { text: string }) {
  if (WRITE_ON_RUN.test(text)) {
    return (
      <>
        {text.split(WRITE_ON_RUN).map((p, i) =>
          i % 2 === 1 ? (
            <span key={i} className="legal-writeon">
              {p}
            </span>
          ) : p ? (
            <ReadText key={i} text={p} />
          ) : null,
        )}
      </>
    );
  }
  const parts = text.split(HYPHEN_WORD);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className={KEEP_WORD}>
            {p}
          </span>
        ) : p ? (
          <Inert key={i} text={p} />
        ) : null,
      )}
    </>
  );
}

/**
 * A paragraph read (not edited) keeps its last two words together, so it never ends on one word alone. Only the last line typed (after
 * any kept line break) is touched, and only when it has three words or more and a short enough tail. Returns the words before the pair
 * and the pair, or null to leave the text as it is.
 */
function tieTail(text: string): [string, string] | null {
  const cut = text.lastIndexOf('\n') + 1;
  const last = text.slice(cut);
  if (last.trim().split(/\s+/).length < 3) return null;
  const m = /(\S+) (\S+)\s*$/.exec(last);
  if (!m || m[1]!.length + m[2]!.length > 27) return null;
  const at = cut + m.index;
  return [text.slice(0, at), text.slice(at)];
}

/** One block's pieces as read-only text: words and **bold**. */
function staticSegments(b: BodyBlock, key: string, tie = false): ReactNode[] {
  const lastText = tie ? b.segments.length - 1 : -1;
  return b.segments.map((s, i) => {
    if (typeof s === 'string') {
      const tied = i === lastText ? tieTail(s) : null;
      return tied ? (
        <span key={`${key}-${i}`}>
          <ReadText text={tied[0]} />
          <span className={KEEP}>
            <ReadText text={tied[1]} />
          </span>
        </span>
      ) : (
        <ReadText key={`${key}-${i}`} text={s} />
      );
    }
    return 'bold' in s ? (
      <strong key={`${key}-${i}`}>
        <ReadText text={s.bold} />
      </strong>
    ) : null;
  });
}

/**
 * Where the founder's typed Trial agreement starts a new page by hand (its PDF: before 8.8, 8.11 and 8.13 and before "That's the
 * system"), by section id and the words a block opens with. Matched on the words, never on a position, so a block the owner rewrote
 * simply loses its break; nothing is added to the words. Only the typed layout uses it, and only on paper.
 */
const TYPED_PAGE_BREAKS: Readonly<Record<string, readonly string[]>> = { how: ['8.8 ', '8.11 ', '8.13 ', "That's the system"] };
const blockText = (b: BodyBlock): string => b.segments.map((s) => (typeof s === 'string' ? s : 'bold' in s ? s.bold : '')).join('');
/** The indexes of the blocks in `body` that open a printed page. */
function pageBreaksIn(sectionId: string, body: string): number[] {
  const starts = Object.prototype.hasOwnProperty.call(TYPED_PAGE_BREAKS, sectionId) ? TYPED_PAGE_BREAKS[sectionId]! : [];
  if (!starts.length) return [];
  return parseBodyBlocks(body.replace(/\r\n/g, '\n')).flatMap((b, i) => (b.kind !== 'li' && starts.some((w) => blockText(b).startsWith(w)) ? [i] : []));
}

/**
 * The words of one section, filled and read only: paragraphs (their own lines kept), "- " bullets, "### " subheads and whole bold lines,
 * drawn block for block the same way the editor draws them, so the page you edit is the page that prints. A missing blank is left out
 * with its label (or, on a typed agreement, left as a line for the client to write on), never drawn as {{braces}}.
 */
function Words({ text, vars, audience, writeOn, sectionId = '' }: { text: string; vars: Record<string, string>; audience: DocAudience; writeOn?: ReadonlySet<string>; sectionId?: string }) {
  const filled = fillContractText(text, vars, audience, writeOn).replace(/\r\n/g, '\n');
  const blocks = parseBodyBlocks(filled);
  const breaks = new Set(pageBreaksIn(sectionId, filled));
  const pb = (i: number) => (breaks.has(i) ? '' : undefined);
  const out: ReactNode[] = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i]!;
    if (b.kind === 'li') {
      const run: BodyBlock[] = [];
      while (i < blocks.length && blocks[i]!.kind === 'li') run.push(blocks[i++]!);
      i -= 1;
      out.push(
        <ul key={`u${i}`} className="legal-list">
          {run.map((x, j) => (
            <li key={j}>
              <span aria-hidden="true" className="legal-bullet">
                •
              </span>
              <span>{staticSegments(x, `l${i}-${j}`)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    const tight = b.sep === '\n' ? '' : undefined;
    if (b.kind === 'h3')
      out.push(
        <h3 key={i} className="legal-h3" data-tight={tight} data-page-break={pb(i)}>
          {staticSegments(b, `h${i}`)}
        </h3>,
      );
    else if (b.kind === 'strong')
      out.push(
        <p key={i} className="legal-clause legal-strong" data-tight={tight} data-page-break={pb(i)}>
          <strong>{staticSegments(b, `s${i}`)}</strong>
        </p>,
      );
    else
      out.push(
        <p key={i} className="legal-clause" data-tight={tight} data-page-break={pb(i)}>
          {staticSegments(b, `p${i}`, true)}
        </p>,
      );
  }
  return <>{out}</>;
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The price table: a row per package with its effective rate, and the row for blocks past the largest, as the agreement draws it. */
function Packages({ s, doc, edit }: { s: ContractSection; doc: ContractDoc; edit?: (p: Partial<ContractSection>) => void }) {
  const unit = (s.unitName ?? 'pieces').toLowerCase();
  const packages = s.packages ?? [];
  const top = Math.max(0, ...packages.map((p) => p.units));
  const m = (c: number) => (c > 0 ? money(c, doc.currency) : '—');
  const setPkg = (i: number, p: Partial<ContractPackage>) => edit?.({ packages: packages.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  // A client never sees an empty table; the owner sees where the rows go.
  if (!packages.length && !edit) return null;
  return (
    <div className="legal-table-wrap">
      <table className="legal-table">
        <thead>
          <tr>
            <th>Package</th>
            <th>{edit ? <EditableText value={capital(unit)} label="What is counted" onChange={(v) => edit({ unitName: v.toLowerCase() || 'pieces' })} /> : capital(unit)}</th>
            <th className="text-right">Package fee</th>
            <th className="text-right">Effective rate per {unitOne(unit)}</th>
          </tr>
        </thead>
        <tbody>
          {packages.map((p, i) => (
            <tr key={i}>
              {edit ? (
                <>
                  <EditableText as="td" value={p.name} label={`Package ${i + 1} name`} placeholder="Package name" onChange={(name) => setPkg(i, { name })} />
                  <NumberCell value={p.units} label={`How many ${unit} in ${p.name || 'this package'}`} onChange={(units) => setPkg(i, { units })} />
                  <MoneyCell cents={p.feeCents} currency={doc.currency} className="text-right" label={`Package fee, ${p.name || 'this package'}`} onChange={(feeCents) => setPkg(i, { feeCents })} />
                </>
              ) : (
                <>
                  <td>
                    <Inert text={p.name} />
                  </td>
                  <td>{p.units}</td>
                  <td className="text-right">{m(p.feeCents)}</td>
                </>
              )}
              <td className="text-right">{m(packageRate(p))}</td>
            </tr>
          ))}
          {s.extra && s.extra.units > 0 && (
            <tr>
              <td>
                Additional {unit} beyond {top}
              </td>
              {edit ? (
                <>
                  <NumberCell value={s.extra.units} prefix="Each block of " label="How many in each extra block" onChange={(units) => edit({ extra: { units, feeCents: s.extra?.feeCents ?? 0 } })} />
                  <MoneyCell cents={s.extra.feeCents} currency={doc.currency} suffix=" per block" className="text-right" label="Fee for each extra block" onChange={(feeCents) => edit({ extra: { units: s.extra?.units ?? 0, feeCents } })} />
                </>
              ) : (
                <>
                  <td>Each block of {s.extra.units}</td>
                  <td className="text-right">{s.extra.feeCents > 0 ? `${m(s.extra.feeCents)} per block` : '—'}</td>
                </>
              )}
              <td className="text-right">{m(packageRate({ name: '', units: s.extra.units, feeCents: s.extra.feeCents }))}</td>
            </tr>
          )}
          {!packages.length && (
            <tr className="no-print">
              <td colSpan={4} className="text-ink-mute">
                Your packages are not set. Add them once in Settings, or add a row from this section's handle.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const blankAnswer: ContractAnswer = { picked: [], other: '', text: '' };

/** A tick box as the paper draws it: ☐ or ☑. On the screen, where the client answers, a real checkbox stands in its place. */
function Box({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className="legal-box">
      {on ? '☑' : '☐'}
    </span>
  );
}

/** A list of short lines edited in place: Enter adds one under it, Backspace in an empty one takes it out. */
function LinesEdit({ lines, onChange, label, ordered = false, box = false }: { lines: string[]; onChange: (lines: string[]) => void; label: string; ordered?: boolean; box?: boolean }) {
  const host = useState<{ el: HTMLUListElement | null }>({ el: null })[0];
  const focus = (i: number, where: 'start' | 'end') => window.requestAnimationFrame(() => focusAt(host.el?.querySelectorAll<HTMLElement>('[data-paper-edit]')[i], where));
  const items = lines.length ? lines : [''];
  return createElement(
    ordered ? 'ol' : 'ul',
    { className: box ? 'legal-ticks' : 'legal-list', ref: (el: HTMLUListElement | null) => (host.el = el) },
    items.map((l, i) => (
      <li key={i}>
        {box ? <Box on={false} /> : <span aria-hidden="true" className="legal-bullet">•</span>}
        <EditableText
          value={l}
          label={`${label} ${i + 1}`}
          placeholder="Type here"
          onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)).filter((x, j) => x || j === i))}
          onEnter={(before, after) => {
            const next = [...items];
            next[i] = before;
            next.splice(i + 1, 0, after);
            onChange(next.slice(0, 16));
            focus(i + 1, 'start');
          }}
          onBackspaceEmpty={() => {
            if (items.length <= 1) return;
            onChange(items.filter((_, j) => j !== i));
            focus(Math.max(0, i - 1), 'end');
          }}
        />
      </li>
    )),
  );
}

/** The brief: each question as the agreement prints it (subhead, line, tick boxes with Other, written answer, brand guide lines, links). */
function Brief({ s, answers, onAnswer, edit }: { s: ContractSection; answers: Record<string, ContractAnswer>; onAnswer?: (id: string, a: ContractAnswer) => void; edit?: (p: Partial<ContractSection>) => void }) {
  const live = Boolean(onAnswer);
  const qs = s.questions ?? [];
  const [menu, setMenu] = useState<string | null>(null);
  const setQ = (i: number, p: Partial<ContractQuestion>) => edit?.({ questions: qs.map((q, j) => (j === i ? { ...q, ...p } : q)) });
  return (
    <div className="legal-brief">
      {qs.map((q, qi) => {
        const a = answers[q.id] ?? blankAnswer;
        const set = (next: Partial<ContractAnswer>) => onAnswer?.(q.id, { ...a, ...next });
        const tick = (o: string) => {
          const on = a.picked.includes(o);
          set({ picked: q.multi ? (on ? a.picked.filter((x) => x !== o) : [...a.picked, o]) : on ? [] : [o] });
        };
        const name = q.heading || q.group || q.label || `Question ${qi + 1}`;
        const qItems: MoreMenuItem[] = [
          { key: 'multi', label: 'More than one can be ticked', hint: q.multi ? 'On' : 'Off', onSelect: () => setQ(qi, { multi: !q.multi }) },
          { key: 'other', label: 'An "Other" line', hint: q.other ? 'On' : 'Off', onSelect: () => setQ(qi, { other: !q.other }) },
          { key: 'text', label: 'A written answer', hint: q.text ? 'On' : 'Off', onSelect: () => setQ(qi, { text: !q.text }) },
          { key: 'opts', label: q.options.length ? 'Take the tick boxes away' : 'Add tick boxes', onSelect: () => setQ(qi, { options: q.options.length ? [] : ['Choice'] }) },
          ...(qs.length < MAX_CONTRACT_QUESTIONS ? [{ key: 'add', label: 'Add a question below', icon: Plus, onSelect: () => edit?.({ questions: [...qs.slice(0, qi + 1), { id: `q${Date.now().toString(36)}`, label: 'New question', options: [], multi: false, other: false, text: true }, ...qs.slice(qi + 1)] }) }] : []),
          { key: 'rm', label: 'Remove this question', icon: Trash2, destructive: true, confirm: 'Tap again to remove it', onSelect: () => edit?.({ questions: qs.filter((_, j) => j !== qi) }) },
        ];
        return (
          <fieldset key={q.id} className="legal-q" aria-label={name}>
            {(q.heading || edit) &&
              (edit ? (
                <EditableText as="h3" className="legal-h3" value={q.heading ?? ''} placeholder="Subhead (optional)" label={`Subhead of ${name}`} onChange={(heading) => setQ(qi, { heading })} />
              ) : (
                <h3 className="legal-h3">
                  <Inert text={q.heading!} />
                </h3>
              ))}
            {edit && <SectionHandle items={qItems} label={`Question: ${name}`} open={menu === q.id} onOpenChange={(o) => setMenu(o ? q.id : null)} />}
            {q.intro &&
              (edit ? (
                <EditableText as="p" className="legal-clause" value={q.intro} label={`Line under ${name}`} onChange={(intro) => setQ(qi, { intro })} />
              ) : (
                <p className="legal-clause">
                  <Inert text={q.intro} />
                </p>
              ))}
            {q.group &&
              (edit ? (
                <EditableText as="p" className="legal-clause legal-strong" value={q.group} label={`Group of ${name}`} onChange={(group) => setQ(qi, { group })} />
              ) : (
                <p className="legal-clause legal-strong">
                  <Inert text={q.group} />
                </p>
              ))}
            {(q.label || (edit && !q.fields?.length)) &&
              (edit ? (
                <EditableText as="p" className="legal-clause" value={q.label} placeholder="The question" label={`Question ${qi + 1}`} onChange={(label) => setQ(qi, { label })} />
              ) : (
                <p className="legal-clause">
                  <Inert text={q.label} />
                </p>
              ))}
            {edit && q.options.length > 0 && <LinesEdit box lines={q.options} label={`Tick box of ${name}`} onChange={(options) => setQ(qi, { options: options.map((x) => x.trim()).filter(Boolean).length ? options : ['Choice'] })} />}
            {!edit && q.options.length > 0 && (
              <ul className="legal-ticks">
                {q.options.map((o) => {
                  const on = a.picked.includes(o);
                  return (
                    <li key={o}>
                      {live ? (
                        <label className="legal-tick-row">
                          <input type="checkbox" checked={on} onChange={() => tick(o)} className="legal-tick-input" />
                          <Box on={on} />
                          <span>
                            <Inert text={o} />
                          </span>
                        </label>
                      ) : (
                        <>
                          <Box on={on} />
                          <span>
                            <Inert text={o} />
                          </span>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {q.other && (
              <ul className="legal-ticks">
                <li className="legal-other">
                  {live ? (
                    <>
                      <input type="checkbox" checked={Boolean(a.other)} readOnly tabIndex={-1} aria-hidden="true" className="legal-tick-input" />
                      <Box on={Boolean(a.other)} />
                      <span>Other:</span>
                      <input value={a.other} onChange={(e) => set({ other: e.target.value })} maxLength={200} aria-label={`Other, ${name}`} className="legal-line-input" />
                    </>
                  ) : (
                    <>
                      <Box on={Boolean(a.other)} />
                      <span>Other:</span>
                      <span className="legal-rule">{a.other ? <Inert text={a.other} /> : ' '}</span>
                    </>
                  )}
                </li>
              </ul>
            )}
            {q.text && (
              <>
                <p className="legal-clause legal-strong">{q.answerLabel || 'Answer:'}</p>
                {live ? (
                  <textarea value={a.text} onChange={(e) => set({ text: e.target.value })} rows={4} maxLength={1500} aria-label={`${q.answerLabel || 'Answer'} ${name}`} className={FIELD} />
                ) : (
                  <p className="legal-clause legal-answer">{a.text ? <Inert text={a.text} /> : ''}</p>
                )}
              </>
            )}
            {(q.fields ?? []).length > 0 &&
              (edit ? (
                <LinesEdit lines={q.fields!} label={`Line of ${name}`} onChange={(fields) => setQ(qi, { fields })} />
              ) : (
                <ul className="legal-list">
                  {q.fields!.map((f) => {
                    const v = a.fields?.[f] ?? '';
                    return (
                      <li key={f}>
                        <span aria-hidden="true" className="legal-bullet">
                          •
                        </span>
                        {live ? (
                          <label className="legal-field">
                            <span>
                              <Inert text={f} />
                            </span>
                            <input value={v} maxLength={300} onChange={(e) => set({ fields: { ...(a.fields ?? {}), [f]: e.target.value } })} className="legal-line-input" />
                          </label>
                        ) : (
                          <span>
                            <Inert text={v ? `${f}: ${v}` : f} />
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ))}
            {q.links && (live ? <LinksAnswer max={q.links.max} links={a.links ?? []} onChange={(links) => set({ links })} label={name} /> : (a.links ?? []).length > 0 && (
              <ol className="legal-links">
                {(a.links ?? []).map((l, i) => (
                  <li key={i}>
                    <Inert text={l} />
                  </li>
                ))}
              </ol>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}

/** The client gives a few web links (examples of videos): one line each, up to the question's own number. */
function LinksAnswer({ max, links, onChange, label }: { max: number; links: string[]; onChange: (l: string[]) => void; label: string }) {
  const rows = links.length < max ? [...links, ''] : links;
  return (
    <ol className="legal-links">
      {rows.map((l, i) => (
        <li key={i}>
          <input
            value={l}
            inputMode="url"
            placeholder="https://"
            maxLength={500}
            aria-label={`${label}, link ${i + 1}`}
            onChange={(e) => {
              const next = [...rows];
              next[i] = e.target.value;
              onChange(next.filter((x, j) => x.trim() || j < next.length - 1).slice(0, max));
            }}
            className="legal-line-input"
          />
        </li>
      ))}
    </ol>
  );
}

function Signatures({ doc, acceptance, signLine, vars }: { doc: ContractDoc; acceptance?: { name: string; title: string; at: string } | null; signLine?: { name: string; title: string } | null; vars?: BlockVars }) {
  const blank = ' ';
  const row = (label: string, value: ReactNode, hand = false) => (
    <p className="legal-sign-line m-0">
      <span className="shrink-0">{label}</span>
      <span className={hand ? 'legal-hand' : ''}>{value || blank}</span>
    </p>
  );
  const client = acceptance ?? (signLine ? { name: signLine.name, title: signLine.title, at: '' } : null);
  const designation = (doc.vars.providerDesignation ?? '').trim() || (doc.vars.providerTitle ?? '').trim();
  return (
    <div>
      <div className="legal-sign">
        <div className="legal-sign-block">
          <h3>For the Service Provider:</h3>
          {row('Name:', vars ? <VarField name="provider" value={vars.values.provider ?? ''} onChange={(v) => vars.set('provider', v)} label="Your name" /> : (doc.vars.provider ?? ''))}
          {row('Designation:', vars ? <VarField name="providerDesignation" value={vars.values.providerDesignation ?? ''} onChange={(v) => vars.set('providerDesignation', v)} label="Your designation" /> : designation)}
          {row('Signature:', '')}
          {row('Date:', '')}
        </div>
        <div className="legal-sign-block">
          <h3>For the Client:</h3>
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
  /** AGR-1A2B3C, printed in the title block and the running header (the legal layout). */
  reference?: string;
  /** The date on the document. */
  date?: string;
  /** DRAFT, REVISED, SIGNED and so on, stamped faintly across the page. */
  stamp?: SheetStamp | null;
  /** An agreement, or one of the other documents (a summary, trial terms, a proposal, a report). */
  kind?: 'agreement' | 'document';
  /** The owner's page carries one note of what is missing; the client's page (the default) leaves every empty line and part out. */
  audience?: DocAudience;
  /** The owner edits the paper in place: every change comes back as the whole document (saved as you go by the page). */
  onDocChange?: (doc: ContractDoc) => void;
  /** The owner's note of what is missing then ends with "Fill them in", which opens the Fill in the details form. */
  onFill?: () => void;
  /**
   * On paper that is a record (signed, approved, void), the owner may still switch a section on or off the printed page: each section
   * then keeps a handle whose menu holds only "Print this section". It changes what goes on paper, never the words.
   */
  onPrint?: (sectionId: string, print: boolean) => void;
  /** A quiet line shown under the brief's heading on the screen (the client's "Saved" while answers save as they type). */
  briefNote?: ReactNode;
}

/** The sender's name and address for the top of the first page, from the names filled in. */
function letterheadOf(doc: ContractDoc): { name: string; lines: string[] } {
  const v = doc.vars;
  const f = (k: string) => (v[k] ?? '').trim();
  return { name: f('providerBusiness') || f('provider'), lines: [...f('providerAddress').split('\n'), [f('providerEmail'), f('providerPhone')].filter(Boolean).join(' | ')].map((l) => l.trim()).filter(Boolean) };
}

const newSectionId = () => `n${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/** One section of the paper in edit mode: its handle in the margin, its heading, its words and its table or questions, all in place. */
function SectionEdit({ s, index, doc, set, onMove, onRemove, onAdd, vars, answers }: { s: ContractSection; index: number; doc: ContractDoc; set: (p: Partial<ContractSection>) => void; onMove: (by: -1 | 1) => void; onRemove: () => void; onAdd: (kind: 'text' | 'packages' | 'brief') => void; vars: BlockVars; answers: Record<string, ContractAnswer> }) {
  const [menu, setMenu] = useState(false);
  const press = useLongPress(() => setMenu(true));
  const name = s.heading || `Section ${index + 1}`;
  const prints = sectionPrints(s);
  const items: MoreMenuItem[] = [
    { key: 'up', label: 'Move up', icon: ArrowUp, disabled: index === 0, onSelect: () => onMove(-1) },
    { key: 'down', label: 'Move down', icon: ArrowDown, disabled: index >= doc.sections.length - 1, onSelect: () => onMove(1) },
    ...(s.kind !== 'signatures' ? [{ key: 'print', label: 'Print this section', icon: Printer, hint: prints ? 'On' : 'Off', onSelect: () => set({ print: !prints }) }] : []),
    ...(s.kind === 'packages'
      ? [
          { key: 'row', label: 'Add a package row', icon: Plus, disabled: (s.packages ?? []).length >= 8, onSelect: () => set({ packages: [...(s.packages ?? []), { name: 'Package', units: 1, feeCents: 0 }] }) },
          ...((s.packages ?? []).length ? [{ key: 'unrow', label: 'Remove the last row', icon: Trash2, onSelect: () => set({ packages: (s.packages ?? []).slice(0, -1) }) }] : []),
          { key: 'block', label: s.extra && s.extra.units > 0 ? 'Remove the extra block row' : 'Add a row for extra blocks', onSelect: () => set({ extra: s.extra && s.extra.units > 0 ? undefined : { units: 5, feeCents: 0 } }) },
        ]
      : []),
    ...(doc.sections.length < MAX_CONTRACT_SECTIONS
      ? [
          { key: 'addt', label: 'Add a text section below', icon: Type, onSelect: () => onAdd('text') },
          { key: 'addp', label: 'Add a price table below', icon: ListPlus, onSelect: () => onAdd('packages') },
          { key: 'addb', label: 'Add questions below', icon: ListPlus, onSelect: () => onAdd('brief') },
        ]
      : []),
    { key: 'del', label: 'Delete this section', icon: Trash2, destructive: true, confirm: 'Tap again to delete it', onSelect: onRemove },
  ];
  return (
    <section className={`legal-sec paper-sec ${prints ? '' : 'legal-noprint'}`} data-kind={s.kind} data-sec-n={index} aria-label={name}>
      {/* A section typed without a heading (the opening paragraph) stays without one; a long press on its words opens the handle. */}
      {s.heading || !s.body ? (
        <div {...press}>
          <EditableText as="h2" className={`legal-sec-h${/^\s*\d/.test(s.heading) ? ' legal-own-num' : ''}`} value={s.heading} placeholder="Heading" label={`Heading of section ${index + 1}`} onChange={(heading) => set({ heading })} />
        </div>
      ) : null}
      {/* After the heading in the page's order, so Tab from the heading reaches it; it shows on hover and while the section has focus. */}
      <SectionHandle items={items} label={`Section: ${name}`} open={menu} onOpenChange={setMenu} />
      {!prints && <p className="paper-note no-print">Not printed. On the screen and at the client's link.</p>}
      <div {...(s.heading ? {} : press)}>
        <BlocksEditor body={s.body} onChange={(body) => set({ body })} vars={vars} label={name} />
      </div>
      {s.kind === 'packages' && <Packages s={s} doc={doc} edit={set} />}
      {s.kind === 'brief' && <Brief s={s} answers={answers} edit={set} />}
      {s.tail !== undefined && <BlocksEditor body={s.tail} onChange={(tail) => set({ tail })} vars={vars} label={`${name}, after`} />}
      {s.kind === 'signatures' && <Signatures doc={doc} vars={vars} />}
    </section>
  );
}

/** One section of read-only paper. With `onPrint` it keeps a handle whose menu has only "Print this section" (a record's one switch). */
function SectionRead({ s, doc, style, vars, audience, writeOn, answers, onAnswer, acceptance, signLine, empty, onPrint, briefNote }: { s: ContractSection; doc: ContractDoc; style: ReturnType<typeof parseDocStyle>; vars: Record<string, string>; audience: DocAudience; writeOn: ReturnType<typeof writeOnKeys>; answers: Record<string, ContractAnswer>; onAnswer?: (id: string, a: ContractAnswer) => void; acceptance?: Props['acceptance']; signLine?: Props['signLine']; empty: boolean; onPrint?: Props['onPrint']; briefNote?: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const press = useLongPress(() => setMenu(true));
  const prints = sectionPrints(s);
  const switchable = Boolean(onPrint) && s.kind !== 'signatures';
  const name = s.heading || 'Section';
  const items: MoreMenuItem[] = switchable ? [{ key: 'print', label: 'Print this section', icon: Printer, hint: prints ? 'On' : 'Off', onSelect: () => onPrint?.(s.id, !prints) }] : [];
  return (
    <section className={`legal-sec${switchable ? ' paper-sec' : ''}${prints ? '' : ' legal-noprint'}`} data-print-only={switchable ? '' : undefined} data-kind={s.kind} aria-label={name}>
      {s.heading && (
        <h2 className="legal-sec-h" {...(switchable ? press : {})}>
          {style.heading === 'numbered' ? stripNumber(s.heading) : s.heading}
        </h2>
      )}
      {switchable && <SectionHandle items={items} label={`Section: ${name}`} open={menu} onOpenChange={setMenu} />}
      {switchable && !prints && (
        <p className="paper-note no-print">
          Not printed. On the screen and at the client's link.
          <span className="paper-hint paper-hint-touch">Press and hold the heading to print it.</span>
          <span className="paper-hint paper-hint-mouse">Point at the heading to print it.</span>
        </p>
      )}
      {s.kind === 'brief' && briefNote}
      {s.body && (
        <div {...(switchable && !s.heading ? press : {})}>
          <Words text={s.body} vars={vars} audience={audience} writeOn={writeOn} sectionId={s.id} />
        </div>
      )}
      {empty && <p className="legal-clause italic no-print">Not written yet. Write this part before you send it.</p>}
      {s.kind === 'packages' && <Packages s={s} doc={doc} />}
      {s.kind === 'brief' && <Brief s={s} answers={answers} onAnswer={onAnswer} />}
      {s.tail && <Words text={s.tail} vars={vars} audience={audience} writeOn={writeOn} />}
      {s.kind === 'signatures' && <Signatures doc={doc} acceptance={acceptance} signLine={signLine} />}
    </section>
  );
}

/**
 * An agreement (or any sectioned document) as a page: the title block, then every section in order. It prints as a legal document
 * (PrintSheet). With `onDocChange` it is also the editor: the same page, every part of it editable where it stands.
 */
export function ContractView({ doc, answers = {}, onAnswer, acceptance, signLine, reference, date, stamp, kind = 'agreement', audience = 'client', onDocChange, onFill, onPrint, briefNote }: Props) {
  const style = parseDocStyle(doc.style);
  const typed = style.layout === 'typed';
  const vars = docVars(doc);
  const writeOn = writeOnKeys(doc);
  const gapNote = audience === 'owner' ? contractGapNote(doc) : null;
  const editing = Boolean(onDocChange);
  // A part with nothing written in it yet is the owner's to write: the owner sees it marked, the client never sees it.
  const empty = (s: ContractSection) => s.kind === 'text' && !fillContractText(s.body, vars, audience).trim();
  const sections = audience === 'client' ? doc.sections.filter((s) => !empty(s)) : doc.sections;
  const change = (fn: (d: ContractDoc) => ContractDoc) => onDocChange?.(fn(doc));
  const blockVars: BlockVars = { values: doc.vars, set: (k, v) => change((d) => ({ ...d, vars: { ...d.vars, [k]: v } })), labelOf, derived: { packageExample: vars.packageExample ?? '' } };
  const setSection = (id: string, p: Partial<ContractSection>) => change((d) => ({ ...d, sections: d.sections.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const move = (id: string, by: -1 | 1) =>
    change((d) => {
      const i = d.sections.findIndex((x) => x.id === id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= d.sections.length) return d;
      const next = [...d.sections];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return { ...d, sections: next };
    });
  const add = (afterId: string | null, k: 'text' | 'packages' | 'brief') =>
    change((d) => {
      if (d.sections.length >= MAX_CONTRACT_SECTIONS) return d;
      const base: ContractSection = { id: newSectionId(), heading: k === 'packages' ? 'Fees' : k === 'brief' ? 'Questions' : 'New section', kind: k, body: '' };
      if (k === 'packages') Object.assign(base, { unitName: 'pieces', packages: [{ name: 'Package', units: 1, feeCents: 0 }] });
      if (k === 'brief') base.questions = [{ id: `q${Date.now().toString(36)}`, label: 'New question', options: [], multi: false, other: false, text: true }];
      const at = afterId ? d.sections.findIndex((x) => x.id === afterId) + 1 : d.sections.length;
      const next = [...d.sections];
      next.splice(at, 0, base);
      return { ...d, sections: next };
    });
  const notPrinted = doc.sections.filter((s) => !sectionPrints(s));
  // The editor's blocks carry their index (PaperEdit); a page that opens by hand is a rule on that index. Only integers reach the CSS.
  const breakAt = doc.sections.flatMap((s, i) => pageBreaksIn(s.id, s.body).map((n) => `.legal-root[data-layout='typed'] .legal-sec[data-sec-n='${i}'] > div > .paper-blocks > [data-block='${n}']`));
  const ownerBreaks = breakAt.length ? `@media print { ${breakAt.join(', ')} { break-before: page; page-break-before: always; } ${breakAt.map((x) => `${x} > *`).join(', ')} { margin-top: 0; } }` : '';
  return (
    <PrintSheet
      kind={kind}
      title={doc.title}
      subtitle={doc.subtitle}
      titleNode={editing ? <EditableText value={doc.title} label="Title" placeholder="Title" onChange={(title) => change((d) => ({ ...d, title }))} /> : undefined}
      subtitleNode={editing ? <EditableText value={doc.subtitle} label="Line under the title" placeholder="Line under the title (optional)" onChange={(subtitle) => change((d) => ({ ...d, subtitle }))} /> : undefined}
      reference={typed ? '' : reference}
      date={typed ? undefined : date}
      style={style}
      stamp={stamp}
      letterhead={letterheadOf(doc)}
      parties={hasPartiesSection(doc) ? [] : contractParties(doc)}
    >
      {editing && typed && ownerBreaks && <style>{ownerBreaks}</style>}
      {gapNote && (
        <p className="legal-clause legal-gap no-print" role="note">
          {gapNote}
          {onFill && (
            <>
              {' '}
              <button type="button" onClick={onFill} className="relative font-bold underline underline-offset-2 before:absolute before:-inset-x-[4px] before:-inset-y-[13px] before:content-['']">
                Fill them in
              </button>
            </>
          )}
        </p>
      )}
      {editing
        ? doc.sections.map((s, i) => (
            <SectionEdit
              key={s.id}
              s={s}
              index={i}
              doc={doc}
              vars={blockVars}
              answers={answers}
              set={(p) => setSection(s.id, p)}
              onMove={(by) => move(s.id, by)}
              onRemove={() => change((d) => ({ ...d, sections: d.sections.filter((x) => x.id !== s.id) }))}
              onAdd={(k) => add(s.id, k)}
            />
          ))
        : sections.map((s) => (
            <SectionRead key={s.id} s={s} doc={doc} style={style} vars={vars} audience={audience} writeOn={writeOn} answers={answers} onAnswer={onAnswer} acceptance={acceptance} signLine={signLine} empty={empty(s)} onPrint={onPrint} briefNote={briefNote} />
          ))}
      {notPrinted.length > 0 && (
        <p className="legal-print-note m-0">{`Not printed here, and open at the agreement's link: ${notPrinted.map((s) => s.heading.replace(/\.$/, '')).join('; ')}.`}</p>
      )}
      {doc.sections.length === 0 &&
        (editing ? (
          <p className="no-print mt-md m-0">
            <button type="button" className="toy toy-soft min-h-[44px] rounded-pill px-md text-[16px] font-bold" onClick={() => add(null, 'text')}>
              Add a section
            </button>
          </p>
        ) : (
          <p className="mt-md m-0 text-[16px] font-semibold text-ink-soft">This document has no sections yet.</p>
        ))}
    </PrintSheet>
  );
}
export type { Props as ContractViewProps };
