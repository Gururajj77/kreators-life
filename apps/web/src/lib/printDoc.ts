import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Print or save as PDF, with the browser's own title set to the document's name for the moment of printing (that title becomes the file's
 * name), then put back. A Worker does not make PDFs, so this is the one way; the print stylesheet in app.css makes the page a legal document.
 */
export function printAs(title: string, bodyClass?: string): void {
  const before = document.title;
  const restore = () => {
    document.title = before;
    if (bodyClass) document.body.classList.remove(bodyClass);
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  document.title = title;
  // A body class (the month calendar's `printing-month`) picks which print rules in app.css apply, for the moment of printing only.
  if (bodyClass) document.body.classList.add(bodyClass);
  window.print();
}

/** The file name a saved PDF gets: "Invoice KR-0007" or "Agreement - Acme - Pilot". */
export const fileTitle = (...parts: (string | undefined | null)[]): string => parts.map((p) => (p ?? '').trim()).filter(Boolean).join(' - ');

/**
 * `?print=1` on a page opens the print dialog once the page has its data. The Download PDF button on a list row sends the person there,
 * so a row can download without opening the document first.
 */
export function useAutoPrint(ready: boolean, title: string, run?: () => void): void {
  const [params] = useSearchParams();
  const asked = params.get('print') === '1';
  const done = useRef(false);
  useEffect(() => {
    if (!ready || !asked || done.current) return;
    // The flag is set inside the timer, so React's double effect in development cannot cancel the one print.
    const t = window.setTimeout(() => {
      if (done.current) return;
      done.current = true;
      if (run) run();
      else printAs(title);
    }, 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, asked, title]);
}

/** Whether the browser draws `@page` margin boxes (a running title and "Page 1 of 3"). Chromium 131 and up does. */
export function supportsMarginBoxes(): boolean {
  try {
    const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string; version: string }[] } }).userAgentData?.brands;
    const chromium = brands?.find((b) => /chromium/i.test(b.brand));
    return chromium ? Number(chromium.version) >= 131 : false;
  } catch {
    return false;
  }
}
