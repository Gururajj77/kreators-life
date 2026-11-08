import { AnimatePresence, m as motion, useDragControls, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { tick } from './fx/haptics';
import { useDialogFocus } from '../lib/useDialogFocus';
import { useWide } from '../lib/useWide';
import { X } from 'lucide-react';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** The popup's own small round icon actions (settings, a More menu): they sit in the rail under Close, outside the panel, so they stay in reach however far it scrolls. A word button or a full-width action stays in the popup. */
  rail?: ReactNode;
}

export function Sheet({ open, onClose, title, children, rail }: Props) {
  const id = useId();
  // A tablet or laptop (the md test): the dialog is centred and scales in; on a phone it rises from the bottom and can be dragged down.
  const wide = useWide();
  // Under reduced motion the dialog is simply there: nothing rises or scales (the scrim only fades).
  const still = useReducedMotion();
  const grab = useDragControls();
  const dialog = useRef<HTMLDivElement>(null);
  // Focus moves in when it opens, Tab stays inside, Escape closes it (the top one only), and focus returns to what opened it.
  // The dialog node appears with `open`, so the hook runs after it is in the page.
  useDialogFocus(dialog, open, { onEscape: onClose });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Drawn at the top of the page, never inside whatever opened it: a glass panel's blur or a transform (the sidebar, a card, another
  // sheet) would otherwise become the sheet's frame and squeeze it into that box.
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            className="sheet-scrim fixed inset-0 z-40 bg-ink/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* The dialog is a frame: it animates and drags as a whole and holds the rail and the panel. The scrolling and the fill belong to the
              panel alone, so the rail never moves as the words scroll (the founder, 2026-11-07; "Popups" in app.css places it). */}
          <motion.div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={id}
            className="sheet-frame dialog-frame fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[480px] text-ink md:bottom-auto md:top-1/2 md:max-w-[600px] md:-translate-y-1/2"
            initial={still ? false : wide ? { opacity: 0, scale: 0.96, y: 12 } : { y: '100%' }}
            animate={wide ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={still ? undefined : wide ? { opacity: 0, scale: 0.97, y: 8 } : { y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            drag={wide ? false : 'y'}
            dragControls={grab}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) {
                tick();
                onClose();
              }
            }}
          >
            <div className="dialog-rail">
              <button type="button" onClick={onClose} aria-label="Close" data-tip="Close" className="sheet-close rail-tip toy toy-soft relative flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-ink">
                <Icon icon={X} size={20} />
              </button>
              {rail}
            </div>
            <div className="sheet-panel dialog-panel fx-sheen-top overflow-y-auto rounded-t-card bg-card px-md pt-md md:rounded-card md:p-lg" style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}>
              {/* The grab bar: drag it down to let the sheet go (a phone). The close button and Escape do the same for everyone else. */}
              <div className="fx-grab -mt-xs mb-xs flex h-[32px] items-start justify-center md:hidden" aria-hidden="true" onPointerDown={(e) => grab.start(e)}>
                <div className="h-[6px] w-[48px] rounded-pill bg-line" />
              </div>
              {/* The title keeps the room the round Close gave it, so the panel is the height it was. */}
              <div className="min-h-[44px]">
                <h2 id={id} className="min-w-0 text-title2">
                  {title}
                </h2>
              </div>
              <div className="mt-md">{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
