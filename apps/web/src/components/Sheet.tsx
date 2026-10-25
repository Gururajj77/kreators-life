import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, children }: Props) {
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-40 bg-ink/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={id}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-t-card bg-card px-md pt-md text-ink md:bottom-auto md:top-1/2 md:max-w-[600px] md:-translate-y-1/2 md:rounded-card md:p-lg"
            style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          >
            <div className="mx-auto mb-md h-[6px] w-[48px] rounded-pill bg-line md:hidden" aria-hidden="true" />
            <div className="flex items-start justify-between gap-md">
              <h2 id={id} className="min-w-0 text-[24px]">
                {title}
              </h2>
              <button type="button" onClick={onClose} aria-label="Close" className="toy toy-soft flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-ink">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="mt-md">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
