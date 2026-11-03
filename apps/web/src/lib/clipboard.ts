import { useCallback, useEffect, useRef, useState } from 'react';

/** Copies plain text. Resolves true when it worked; false where the browser refused (no permission, an old browser, no secure origin). */
export async function copyPlain(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the old way.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** A copy button's state: `copy(text)` copies, and `said` is "Copied" or "Could not copy" for two seconds, so a copy is never silent. */
export function useCopy(): { copy: (text: string) => Promise<boolean>; said: string | null } {
  const [said, setSaid] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  const copy = useCallback(async (text: string) => {
    const ok = await copyPlain(text);
    setSaid(ok ? 'Copied' : 'Could not copy. Select the text and copy it yourself.');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSaid(null), 2000);
    return ok;
  }, []);
  return { copy, said };
}
