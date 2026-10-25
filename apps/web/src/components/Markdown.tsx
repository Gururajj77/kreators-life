import { Fragment, type ReactNode } from 'react';

/** Bold inside a line, written **like this**. Nothing else: no HTML, no links, so a lesson can never run as code. */
function inline(text: string, key: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 === 1 ? <strong key={`${key}-${i}`}>{part}</strong> : <Fragment key={`${key}-${i}`}>{part}</Fragment>));
}

/**
 * The small markdown that lessons are written in: ## and ### headings, paragraphs, - bullets,
 * 1. numbered steps, > callouts and **bold**. Rendered with the app's own type and spacing.
 */
export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let n = 0;
  const key = () => `b${n++}`;
  const take = (test: (l: string) => boolean) => {
    const got: string[] = [];
    while (i < lines.length && test(lines[i] ?? '')) got.push(lines[i++] ?? '');
    return got;
  };
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.startsWith('### ')) {
      const k = key();
      out.push(
        <h4 key={k} className="mt-md text-[16px] font-extrabold">
          {inline(line.slice(4), k)}
        </h4>,
      );
      i += 1;
      continue;
    }
    if (line.startsWith('## ')) {
      const k = key();
      out.push(
        <h3 key={k} className="mt-md text-[18px]">
          {inline(line.slice(3), k)}
        </h3>,
      );
      i += 1;
      continue;
    }
    if (/^[-*] /.test(line)) {
      const items = take((l) => /^[-*] /.test(l));
      const k = key();
      out.push(
        <ul key={k} className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {items.map((it, j) => (
            <li key={j} className="flex gap-xs text-[14px] font-semibold leading-relaxed">
              <span aria-hidden="true" className="shrink-0 font-extrabold">
                •
              </span>
              <span>{inline(it.slice(2), `${k}-${j}`)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = take((l) => /^\d+\. /.test(l));
      const k = key();
      out.push(
        <ol key={k} className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {items.map((it, j) => (
            <li key={j} className="flex gap-xs text-[14px] font-semibold leading-relaxed">
              <span className="flex size-[24px] shrink-0 items-center justify-center rounded-pill bg-ink text-[12px] font-extrabold text-on-ink" aria-hidden="true">
                {j + 1}
              </span>
              <span>{inline(it.replace(/^\d+\. /, ''), `${k}-${j}`)}</span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }
    if (line.startsWith('> ')) {
      const quote = take((l) => l.startsWith('> ')).map((l) => l.slice(2));
      const k = key();
      out.push(
        <aside key={k} className="mt-sm rounded-tile bg-card p-sm text-[14px] font-semibold leading-relaxed shadow-toy-soft">
          {inline(quote.join(' '), k)}
        </aside>,
      );
      continue;
    }
    const para = take((l) => Boolean(l.trim()) && !/^(#{2,3} |[-*] |\d+\. |> )/.test(l));
    const k = key();
    out.push(
      <p key={k} className="mt-sm m-0 text-[14px] font-semibold leading-relaxed">
        {inline(para.join(' '), k)}
      </p>,
    );
  }
  return <div className={className}>{out}</div>;
}
