import { discountCodeKey, money, type DiscountArea, type DiscountCheck } from '@kreators/shared';
import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Button } from './Button';

interface Props {
  area: DiscountArea;
  itemId: string;
  /** A pay-what-you-want offer in points, so the saving is worked out on what the person will pay. */
  points?: number;
  /** The code that is applied, or an empty string. The screen sends it with its checkout; the server checks it again and prices it. */
  value: string;
  onChange: (code: string, check: DiscountCheck | null) => void;
  /** The check, when the screen wants to show the new price itself. */
  check?: DiscountCheck | null;
  className?: string;
}

/** What a check saves, in words: money, points, or both. */
export function savingText(c: DiscountCheck): string {
  const parts: string[] = [];
  if (c.offCents > 0) parts.push(money(c.offCents, c.currency));
  if (c.offPoints > 0) parts.push(`${c.offPoints} ${c.offPoints === 1 ? 'point' : 'points'}`);
  return parts.join(' and ');
}

/**
 * "Have a discount code?": a small button that opens one box and Apply. An applied code shows what it saves and the new total, with a
 * way to take it off. The price is worked out by the server (`POST /discounts/check`); this only shows it.
 */
export function DiscountField({ area, itemId, points, value, onChange, check, className = '' }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  // Closing with Cancel or Escape hands focus back to "Have a discount code?".
  const back = useRef(false);

  useEffect(() => {
    if (open) input.current?.focus();
    else if (back.current) {
      back.current = false;
      trigger.current?.focus();
    }
  }, [open]);
  const close = () => {
    back.current = true;
    setOpen(false);
    setProblem(null);
  };

  // A pay-what-you-want offer that changes changes the saving, so the code is checked again on the new amount.
  useEffect(() => {
    if (!value || points === undefined) return;
    let live = true;
    api
      .discountCheck(value, area, itemId, points)
      .then((c) => live && onChange(c.code, c))
      .catch((e: unknown) => {
        if (!live) return;
        setProblem(e instanceof Error ? e.message : 'That code does not work.');
        onChange('', null);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  const apply = async () => {
    if (!discountCodeKey(text)) {
      setProblem('A code is three or more letters or numbers.');
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const c = await api.discountCheck(text, area, itemId, points);
      onChange(c.code, c);
      setText('');
      setOpen(false);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'That code does not work.');
    } finally {
      setBusy(false);
    }
  };

  if (value) {
    return (
      <div className={`rounded-tile bg-paper p-sm ${className}`} role="status">
        <p className="m-0 text-subhead font-semibold">
          Code <span className="font-mono">{value}</span> is on{check ? `: ${check.label}` : ''}.
        </p>
        {check && (
          <p className="mt-xs m-0 text-subhead text-ink-soft">
            You save {savingText(check)}.
            {check.offCents > 0 && check.listCents > 0 && ` New total ${money(check.payCents, check.currency)}.`}
            {check.offPoints > 0 && check.offCents === 0 && ` New total ${check.payPoints} ${check.payPoints === 1 ? 'point' : 'points'}.`}
          </p>
        )}
        <button type="button" onClick={() => onChange('', null)} className="mt-xs inline-flex min-h-[44px] items-center text-subhead font-semibold underline underline-offset-4 hover:text-ink-soft">
          Take the code off
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <div className={className}>
        <button ref={trigger} type="button" onClick={() => setOpen(true)} aria-expanded="false" className="inline-flex min-h-[44px] items-center text-subhead font-semibold underline underline-offset-4 hover:text-ink-soft">
          Have a discount code?
        </button>
        {problem && (
          <p role="alert" className="m-0 text-caption text-ink-soft">
            {problem}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        void apply();
      }}
    >
      <label htmlFor={id} className="block text-subhead font-semibold">
        Discount code
      </label>
      <div className="mt-xs flex gap-xs">
        <input
          ref={input}
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              close();
            }
          }}
          maxLength={40}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={problem ? `${id}-err` : undefined}
          className="min-h-[44px] min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm text-body"
        />
        <Button type="submit" variant="outline" disabled={busy || !text.trim()}>
          Apply
        </Button>
        <Button type="button" variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>
      {problem && (
        <p id={`${id}-err`} role="alert" className="mt-xs m-0 text-caption text-ink-soft">
          {problem}
        </p>
      )}
    </form>
  );
}
