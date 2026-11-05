import { Button } from './Button';
import { Sheet } from './Sheet';

/**
 * A spend asked once more in a sheet, instead of the browser's own confirm box: what it costs and what happens,
 * one solid button that does it, and Cancel. Used for reserving a reward and unlocking a card game with points.
 */
export function ConfirmSpend({
  open,
  onClose,
  title,
  body,
  action,
  onConfirm,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  action: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="grid gap-md pb-xl">
        <p className="m-0 text-callout text-ink-soft">{body}</p>
        <div className="flex flex-wrap gap-xs">
          <Button
            disabled={busy}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {action}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
