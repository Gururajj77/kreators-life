import { Button } from './Button';
import { Sheet } from './Sheet';

/** The pale red outline a delete wears (the Sign out button's look), never solid until the sheet asks. */
export const DELETE_BTN = 'toy inline-flex min-h-[48px] items-center justify-center rounded-pill border-2 border-r1/40 bg-transparent px-md text-headline text-r1 hover:bg-r1/10 disabled:opacity-50';

/** Asks before a delete, the Mindful session pattern: a red "Yes, delete it" and a quiet "Keep it". */
export function ConfirmDelete({ open, title, body, pending, failed, onYes, onClose }: { open: boolean; title: string; body: string; pending: boolean; failed: boolean; onYes: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="grid gap-md pb-xl">
        <p className="m-0 text-callout text-ink-soft">{body}</p>
        {failed && <p role="alert" className="m-0 text-subhead text-r1">That did not work. Try again.</p>}
        <div className="flex flex-wrap gap-xs">
          <button type="button" disabled={pending} onClick={onYes} className={DELETE_BTN}>
            Yes, delete it
          </button>
          <Button variant="outline" onClick={onClose}>
            Keep it
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
