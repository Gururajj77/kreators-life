import { fillContractText, money, packageRate, type ContractAnswer, type ContractDoc, type ContractSection } from '@kreators/shared';
import { Fragment, type ReactNode } from 'react';
import { Inert } from './Inert';
import { tie } from '../lib/text';

/** A day as a person reads it on paper: 12 Oct 2026. */
export const paperDate = (iso: string): string => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** **bold** inside a line, and nothing else: no links, no HTML. Every run of words goes through Inert, so an address stays plain text. */
function inline(text: string, key: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={`${key}-${i}`}>
        <Inert text={part} />
      </strong>
    ) : (
      <Fragment key={`${key}-${i}`}>
        <Inert text={part} />
      </Fragment>
    ),
  );
}

/**
 * The words of one section: paragraphs split by a blank line, lines inside a paragraph kept as lines, "- " bullets and **bold**.
 * Blanks like {{client}} are filled from the variables; one that is missing shows as a line to write on.
 */
function Words({ text, vars }: { text: string; vars: Record<string, string> }) {
  const filled = fillContractText(text, vars).replace(/\r\n/g, '\n');
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
            <p key={k} className="mt-sm m-0 text-[16px] font-semibold leading-relaxed">
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
            <ul key={k} className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {bullets.map((b, i) => (
                <li key={i} className="flex gap-xs text-[16px] font-semibold leading-relaxed">
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
const cell = 'border border-line px-sm py-xs text-[14px] font-semibold';

function Packages({ s, doc }: { s: ContractSection; doc: ContractDoc }) {
  const unit = s.unitName ?? 'pieces';
  const top = Math.max(0, ...(s.packages ?? []).map((p) => p.units));
  const dash = (cents: number) => (cents > 0 ? money(cents, doc.currency) : '—');
  return (
    <div className="mt-sm overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-line/40">
            <th className={`${cell} font-extrabold`}>Package</th>
            <th className={`${cell} font-extrabold`}>{unit.charAt(0).toUpperCase() + unit.slice(1)}</th>
            <th className={`${cell} text-right font-extrabold`}>Package fee</th>
            <th className={`${cell} text-right font-extrabold`}>Rate per {one(unit)}</th>
          </tr>
        </thead>
        <tbody>
          {(s.packages ?? []).map((p, i) => (
            <tr key={i}>
              <td className={cell}>
                <Inert text={p.name} />
              </td>
              <td className={cell}>{p.units}</td>
              <td className={`${cell} text-right`}>{dash(p.feeCents)}</td>
              <td className={`${cell} text-right`}>{dash(packageRate(p))}</td>
            </tr>
          ))}
          {s.extra && s.extra.units > 0 && (
            <tr>
              <td className={cell}>
                Additional {unit} beyond {top}
              </td>
              <td className={cell}>Each block of {s.extra.units}</td>
              <td className={`${cell} text-right`}>{dash(s.extra.feeCents)} a block</td>
              <td className={`${cell} text-right`}>{dash(packageRate({ name: '', units: s.extra.units, feeCents: s.extra.feeCents }))}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const blankAnswer: ContractAnswer = { picked: [], other: '', text: '' };
const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';

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
                      <label className={`flex min-h-[40px] items-center gap-xs text-[16px] font-semibold ${live ? 'cursor-pointer' : ''}`}>
                        <input
                          type={q.multi ? 'checkbox' : 'radio'}
                          name={`q-${q.id}`}
                          checked={on}
                          disabled={!live}
                          onChange={() => set({ picked: q.multi ? (on ? a.picked.filter((x) => x !== o) : [...a.picked, o]) : [o] })}
                          className="size-[20px] shrink-0 accent-[var(--color-ink)]"
                        />
                        <span>
                          <Inert text={o} />
                        </span>
                      </label>
                    </li>
                  );
                })}
                {q.other && (
                  <li className="flex min-h-[40px] items-center gap-xs text-[16px] font-semibold">
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
                <textarea value={a.text} onChange={(e) => set({ text: e.target.value })} rows={4} maxLength={1500} aria-label={q.label} className={field} />
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
  const blank = ' ';
  const row = (label: string, value: string, hand = false) => (
    <p className="mt-xs m-0 flex gap-xs text-[16px] font-semibold">
      <span className="shrink-0">{label}</span>
      <span className={`min-w-0 flex-1 border-b border-ink/40 pb-[2px] ${hand ? 'font-display text-[20px] italic' : ''}`}>{value || blank}</span>
    </p>
  );
  const client = acceptance ?? (signLine ? { name: signLine.name, title: signLine.title, at: '' } : null);
  return (
    <div className="mt-sm grid gap-md md:grid-cols-2">
      <div>
        <h3 className="m-0 text-[16px] font-extrabold">For the service provider</h3>
        {row('Name:', doc.vars.provider ?? '')}
        {row('Designation:', doc.vars.providerTitle ?? '')}
        {row('Signature:', '')}
        {row('Date:', '')}
      </div>
      <div>
        <h3 className="m-0 text-[16px] font-extrabold">For the client</h3>
        {row('Name:', client?.name ?? '')}
        {row('Designation:', client?.title ?? '')}
        {row('Signature:', acceptance ? acceptance.name : '', true)}
        {row('Date:', acceptance ? paperDate(acceptance.at) : '')}
      </div>
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
}

/** An agreement as a page: the title, then every section in order. It prints as the page itself (print-doc). */
export function ContractView({ doc, answers = {}, onAnswer, acceptance, signLine }: Props) {
  return (
    <article className="print-doc rounded-card bg-card p-md shadow-toy md:p-lg">
      <h1 className="m-0 text-[28px] leading-tight">{tie(doc.title)}</h1>
      {doc.subtitle && <p className="mt-xs m-0 text-[16px] font-bold text-ink-soft">{doc.subtitle}</p>}
      {doc.sections.map((s) => (
        <section key={s.id} className="mt-lg border-t border-line pt-md" aria-label={s.heading || 'Section'}>
          {s.heading && <h2 className="m-0 text-[22px] leading-tight">{s.heading}</h2>}
          {s.body && (
            <div className="prose-long">
              <Words text={s.body} vars={doc.vars} />
            </div>
          )}
          {s.kind === 'packages' && <Packages s={s} doc={doc} />}
          {s.kind === 'brief' && <Brief s={s} answers={answers} onAnswer={onAnswer} />}
          {s.kind === 'signatures' && <Signatures doc={doc} acceptance={acceptance} signLine={signLine} />}
        </section>
      ))}
      {doc.sections.length === 0 && <p className="mt-md m-0 text-[16px] font-semibold text-ink-soft">This agreement has no sections yet.</p>}
    </article>
  );
}
