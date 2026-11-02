import { hasFinePointer } from './env';

/**
 * One pointermove handler for every `.fx-spot` card: it writes the pointer's place inside the card to --mx and --my, and the CSS
 * (app.css, "Motion kit") draws a soft radial highlight there. Mouse and trackpad only; a touch screen never runs it.
 * Importing this file installs the handler once.
 */
let frame = 0;
let installed = false;

function install() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse' || !hasFinePointer()) return;
      const card = (e.target as Element | null)?.closest?.('.fx-spot') as HTMLElement | null;
      if (!card) return;
      const { clientX, clientY } = e;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${Math.round(clientX - r.left)}px`);
        card.style.setProperty('--my', `${Math.round(clientY - r.top)}px`);
      });
    },
    { passive: true },
  );
}
install();
