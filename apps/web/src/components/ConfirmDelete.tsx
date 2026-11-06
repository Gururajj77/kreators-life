import { Button } from './Button';
import { Sheet } from './Sheet';

/** The pale red outline a delete wears (the Sign out button's look), never solid until the sheet asks. */
export const DELETE_BTN = 'toy inline-flex min-h-[48px] items-center justify-center rounded-pill border-2 border-r1/40 bg-transparent px-md text-headline text-r1 hover:bg-r1/10 disabled:opacity-50';

/**
 * Asks before a delete, the Mindful session pattern: a red "Yes, delete it" and a quiet "Keep it". Every removal asks first (the founder,
 * 2026-11-06: "removals should always ask confirmation"); `yes` and `keep` name other removals in their own words ("Yes, leave the
 * club", "Yes, refund it").
 */
export function ConfirmDelete({ open, title, body, pending, failed, error, onYes, onClose, yes = 'Yes, delete it', keep = 'Keep it' }: { open: boolean; title: string; body: string; pending: boolean; failed: boolean; /** The server's own reason, shown in place of the fixed line when the delete fails. */ error?: string; onYes: () => void; onClose: () => void; yes?: string; keep?: string }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="grid gap-md pb-xl">
        <p className="m-0 text-callout text-ink-soft">{body}</p>
        {failed && <p role="alert" className="m-0 text-subhead text-r1">{error || 'That did not work. Try again.'}</p>}
        <div className="flex flex-wrap gap-xs">
          <button type="button" disabled={pending} onClick={onYes} className={DELETE_BTN}>
            {yes}
          </button>
          <Button variant="outline" onClick={onClose}>
            {keep}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
