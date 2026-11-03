import { docDate, parseDocStyle, type DocParty, type DocStyle, type Invoice } from '@kreators/shared';
import { useRef, useState, type ReactNode } from 'react';
import { todayLocal } from '../lib/date';
import { supportsMarginBoxes } from '../lib/printDoc';
import { useNoLoneWord } from '../lib/noLoneWord';
import { tie } from '../lib/text';

/* The title's last two words are kept together by a nowrap span, never by tie()'s U+00A0, so the document's text stays exactly the
   words written (a copy from the page or the PDF carries plain spaces). The split follows tie(): it decides only where the span goes. */
function tiedTitle(title: string): ReactNode {
  const tied = tie(title);
  const at = tied.lastIndexOf(' ');
  if (at < 0) return title;
  const t = title.trim();
  const head = t.replace(/\s+\S+\s+\S+$/, '');
  return (
    <>
      {head} <span className="whitespace-nowrap">{t.slice(head.length).trim()}</span>
    </>
  );
}
import { Inert } from './Inert';

/** The words stamped faintly across a document. "Sent" is the normal state and gets none. */
export type SheetStamp = 'draft' | 'revised' | 'paid' | 'overdue' | 'signed' | 'approved' | 'void';
const STAMP_TEXT: Record<SheetStamp, string> = { draft: 'DRAFT', revised: 'REVISED', paid: 'PAID', overdue: 'OVERDUE', signed: 'SIGNED', approved: 'APPROVED', void: 'VOID' };

/** Which stamp an invoice wears: draft, revised after it was sent, paid, overdue past its due day, or void. */
export function invoiceStamp(inv: Pick<Invoice, 'status' | 'revisedAt' | 'dueDate'>): SheetStamp | null {
  if (inv.status === 'draft') return 'draft';
  if (inv.status === 'void') return 'void';
  if (inv.status === 'paid') return 'paid';
  if (inv.revisedAt) return 'revised';
  if (inv.dueDate && inv.dueDate < todayLocal()) return 'overdue';
  return null;
}

// The page itself, from keys. Nothing from stored data reaches CSS except through these maps and `cssString`.
const PAGE: Record<DocStyle['page'], string> = { a4: 'A4', letter: 'letter' };
const MARGIN: Record<DocStyle['margin'], string> = { narrow: '16mm 14mm 18mm', normal: '22mm 20mm 24mm', wide: '28mm 28mm 30mm' };
/**
 * A typed agreement with normal margins gets the text block of the PDF it copies: 6.5 by 9 inches (an inch all round on Letter, the same
 * block centred on A4), so its lines and its pages break where the PDF's do. The right margin is 27.4pt narrower and the sheet pads its
 * words back in by as much (app.css), because the PDF's price table reaches 27.4pt past the words.
 */
const TYPED_MARGIN: Record<DocStyle['page'], string> = { a4: '34.2mm 12.78mm 34.2mm 22.45mm', letter: '1in 44.6pt 1in 1in' };
const marginFor = (style: DocStyle): string => (style.layout === 'typed' && style.margin === 'normal' ? TYPED_MARGIN[style.page] : MARGIN[style.margin]);
/** A piece of text as a CSS string: printable characters only, no quotes, backslashes, braces or angle brackets, and short. */
const cssString = (s: string): string => `"${s.replace(/[^\x20-\x7E\u00A0-\uFFFF]|["\\<>{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90)}"`;
const BOX_FONT = "font: 8pt Georgia, 'Times New Roman', serif; color: #555;";

function pageCss(style: DocStyle, title: string, ref: string, boxes: boolean): string {
  let marginBoxes = '';
  if (boxes) {
    // A typed agreement has no running title, as the paper it copies has none.
    marginBoxes = style.layout === 'typed' ? '' : `@top-left { content: ${cssString(title)}; ${BOX_FONT} } @top-right { content: ${cssString(ref)}; ${BOX_FONT} }`;
    if (style.footer.trim()) marginBoxes += ` @bottom-left { content: ${cssString(style.footer)}; ${BOX_FONT} }`;
    if (style.pageNumbers) marginBoxes += ` @bottom-right { content: "Page " counter(page) " of " counter(pages); ${BOX_FONT} }`;
  }
  // The site's own bar and footer are not part of the document.
  return `@page { size: ${PAGE[style.page]}; margin: ${marginFor(style)}; ${marginBoxes} } @media print { header.safe-top, footer { display: none !important; } }`;
}

interface Props {
  kind: 'agreement' | 'invoice' | 'document';
  /** The document's title: the big line, the running header and the saved file's name. */
  title: string;
  subtitle?: string;
  /** AGR-1A2B3C or KR-0007: printed in the title block and the running header. */
  reference?: string;
  /** The date on the document, YYYY-MM-DD or an instant. */
  date?: string;
  dateLabel?: string;
  style?: DocStyle | null;
  stamp?: SheetStamp | null;
  /** Who it is from, at the top of the first page. An empty name with a logo shows the logo alone. */
  letterhead?: { name: string; lines: string[] } | null;
  parties?: DocParty[];
  /** The big title with the reference and date under it. An invoice draws its own, so it passes false. */
  titleBlock?: boolean;
  /** The title and the line under it as editable regions (the paper editor); the plain words are still the running header and file name. */
  titleNode?: ReactNode;
  subtitleNode?: ReactNode;
  children: ReactNode;
}

/**
 * The one page every Agency document is drawn on, in the app and in print: the letterhead, a title block with the reference and date, a
 * parties table, the document's own words, and a faint stamp where the status says so. Its style (font, size, accent rule, numbered
 * headings, page, margins, footer, page numbers, signature layout) comes from the document's own `DocStyle`. On paper the page is white
 * and black with real margins; see the legal block at the end of app.css.
 */
export function PrintSheet({ kind, title, subtitle, reference = '', date, dateLabel = 'Dated', style, stamp, letterhead, parties = [], titleBlock = true, titleNode, subtitleNode, children }: Props) {
  const s = parseDocStyle(style);
  const [boxes] = useState(supportsMarginBoxes);
  const runTitle = [title, reference].filter(Boolean).join(' ');
  const typed = s.layout === 'typed';
  const rootRef = useRef<HTMLDivElement | null>(null);
  useNoLoneWord(rootRef, typed);
  const showLetterhead = s.letterhead && letterhead && (letterhead.name || letterhead.lines.length > 0 || s.logo);
  return (
    <div ref={rootRef} className="legal-root" data-kind={kind} data-layout={s.layout ?? 'legal'} data-font={s.font} data-size={s.size} data-accent={s.accent} data-heading={s.heading} data-sign={s.signLayout} data-margin={s.margin} data-boxes={boxes ? '1' : '0'}>
      <style>{pageCss(s, title, typed ? '' : reference, boxes)}</style>
      <article className="legal-doc print-doc rounded-card bg-card-strong p-md text-ink shadow-toy-soft md:p-lg" aria-label={runTitle}>
        {stamp && (
          <div className="legal-stamp" aria-hidden="true">
            {/* A faint watermark, drawn from the attribute so it is decoration and not text; the status is said in words elsewhere on the page. */}
            <span data-stamp={STAMP_TEXT[stamp]} />
          </div>
        )}
        {!boxes && (
          <div className="legal-run-head" aria-hidden="true">
            {runTitle}
          </div>
        )}
        {showLetterhead && (
          <div className="legal-letterhead">
            {s.logo && <img className="legal-logo" src={`/api/public/media/${s.logo}`} alt={letterhead?.name ? `${letterhead.name} logo` : 'Logo'} />}
            <div className="min-w-0">
              {letterhead?.name && (
                <p className="legal-letterhead-name">
                  <Inert text={letterhead.name} />
                </p>
              )}
              {letterhead?.lines.map((l, i) => (
                <p key={i} className="legal-letterhead-lines">
                  <Inert text={l} />
                </p>
              ))}
            </div>
          </div>
        )}
        {titleBlock && (
          <div className="legal-head">
            {/* The last two words are tied, and on a narrow phone the title steps down in size so that pair fits on its line instead of
                breaking ("Trial engagement / agreement"). On paper and on a laptop the size is the full 1.75em (the clamp's top). */}
            <h1 className="legal-title" style={typed ? undefined : { fontSize: 'clamp(1.2em, 5.6vw, 1.75em)' }}>
              {titleNode ?? tiedTitle(title)}
            </h1>
            {subtitleNode ? <p className="legal-subtitle">{subtitleNode}</p> : subtitle && <p className="legal-subtitle">{subtitle}</p>}
            {!typed && (reference || date) && (
              <dl className="legal-meta">
                {reference && (
                  <div>
                    <dt>Reference</dt>
                    <dd>{reference}</dd>
                  </div>
                )}
                {date && docDate(date) && (
                  <div>
                    <dt>{dateLabel}</dt>
                    <dd>{docDate(date)}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        )}
        {parties.length > 0 && (
          <table className="legal-parties" aria-label="Parties">
            <tbody>
              {parties.map((p) => (
                <tr key={p.label}>
                  <th scope="row">{p.label}</th>
                  <td>
                    {p.lines.map((l, i) => (
                      <span key={i} className="block">
                        <Inert text={l} />
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {children}
        {!boxes && (
          <div className="legal-run-foot" aria-hidden="true">
            <span>{s.footer}</span>
            <span>{runTitle}</span>
          </div>
        )}
      </article>
    </div>
  );
}
