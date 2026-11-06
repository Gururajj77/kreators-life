import { useState } from 'react';
import { ConfirmDelete } from './ConfirmDelete';

/**
 * The button that starts a kept chat over. It asks first in a sheet with a red yes (the founder, 2026-11-06: "removals should always
 * ask confirmation"), so a stray tap never throws a conversation away. Anything the chat already saved stays saved.
 */
export function StartOver({ onConfirm, className = '' }: { onConfirm: () => void; className?: string }) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-haspopup="dialog"
        className={`toy inline-flex min-h-[44px] shrink-0 items-center rounded-pill bg-card px-sm text-subhead font-medium ${className}`}
      >
        Start over
      </button>
      <ConfirmDelete
        open={asking}
        title="Start this chat over?"
        body="The lines on screen are cleared and the chat starts fresh. Anything already saved stays saved."
        pending={false}
        failed={false}
        onYes={() => {
          setAsking(false);
          onConfirm();
        }}
        onClose={() => setAsking(false)}
        yes="Yes, start over"
        keep="Keep chatting"
      />
    </>
  );
}
