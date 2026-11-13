/**
 * One polite live region for the whole app, made once and kept in the body, for news whose own place leaves the page with it: a task hidden
 * from Daily (its plan panel goes with the row), a hidden task shown again (its row leaves Hidden tasks). The region is made empty and the
 * words land a moment later, since a region inserted already holding its words is not read out everywhere.
 */
let region: HTMLElement | null = null;
let pending = 0;

export function sayStatus(words: string) {
  if (!region || !region.isConnected) {
    region = document.createElement('div');
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.className = 'sr-only';
    document.body.appendChild(region);
  }
  const r = region;
  r.textContent = '';
  window.clearTimeout(pending);
  pending = window.setTimeout(() => {
    r.textContent = words;
  }, 120);
}
