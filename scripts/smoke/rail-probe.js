// A probeFile for shoot.mjs (SHOOT_PROBE=scripts/smoke/rail-probe.js), for a shot whose `before` opens a popup.
// An open popup's Close and round icon actions sit in its rail, outside the panel that scrolls, and on the screen. Each hit is { line }.
(() => {
  const hits = [];
  for (const dialog of document.querySelectorAll('[role="dialog"][aria-modal="true"], [data-assistant-panel]')) {
    const name = dialog.querySelector('h2')?.textContent ?? dialog.getAttribute('aria-label') ?? '';
    const panel = dialog.querySelector('.dialog-panel');
    const rail = dialog.querySelector('.dialog-rail');
    if (!rail) {
      hits.push({ line: `${name}: no rail` });
      continue;
    }
    if (panel) for (const b of panel.querySelectorAll('button[aria-label^="Close"]')) hits.push({ line: `${name}: ${b.getAttribute('aria-label')} is inside the panel` });
    for (const b of rail.querySelectorAll('button, a')) {
      const r = b.getBoundingClientRect();
      if (r.left < 0 || r.top < 0 || r.right > window.innerWidth || r.bottom > window.innerHeight) hits.push({ line: `${name}: ${b.getAttribute('aria-label')} is off the screen` });
    }
  }
  return hits;
})();
