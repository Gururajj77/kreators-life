import { AnimatePresence, m as motion, useDragControls } from 'motion/react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { tick } from './fx/haptics';
import { useDialogFocus } from '../lib/useDialogFocus';
import { X } from 'lucide-react';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** A tablet or laptop (the same test as the md breakpoint): the dialog is centred and scales in; on a phone it rises from the bottom and can be dragged down. */
function useWide(): boolean {
  const q = '(min-width: 48rem) and (min-height: 30rem)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

export function Sheet({ open, onClose, title, children }: Props) {
  const id = useId();
  const wide = useWide();
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
            className="fixed inset-0 z-40 bg-ink/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={id}
            className="fx-sheen-top fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-t-card bg-card px-md pt-md text-ink md:bottom-auto md:top-1/2 md:max-w-[600px] md:-translate-y-1/2 md:rounded-card md:p-lg"
            style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}
            initial={wide ? { opacity: 0, scale: 0.96, y: 12 } : { y: '100%' }}
            animate={wide ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={wide ? { opacity: 0, scale: 0.97, y: 8 } : { y: '100%' }}
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
            {/* The grab bar: drag it down to let the sheet go (a phone). The close button and Escape do the same for everyone else. */}
            <div className="fx-grab -mt-xs mb-xs flex h-[32px] items-start justify-center md:hidden" aria-hidden="true" onPointerDown={(e) => grab.start(e)}>
              <div className="h-[6px] w-[48px] rounded-pill bg-line" />
            </div>
            <div className="flex items-start justify-between gap-md">
              <h2 id={id} className="min-w-0 text-[24px]">
                {title}
              </h2>
              <button type="button" onClick={onClose} aria-label="Close" className="toy toy-soft flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-ink">
                <Icon icon={X} size={20} />
              </button>
            </div>
            <div className="mt-md">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
