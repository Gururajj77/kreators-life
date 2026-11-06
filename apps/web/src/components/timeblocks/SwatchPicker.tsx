import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, Pipette } from 'lucide-react';
import { SWATCH_META, TIME_BLOCK_SWATCHES, hexColorOf, isSwatch, type BlockColor, type HexColor } from '@kreators/shared';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { CloseButton } from '../CloseButton';
import { ErrorLine } from '../ErrorLine';
import { FIELD_LINE, LABEL } from '../../lib/ui';
import { tbStyle } from '../../lib/blockColor';

/** A typed colour as "#rrggbb": a hex as it is, or any colour name the browser knows ("teal", "rebeccapurple"), read through a canvas. */
function typedColour(v: string): HexColor | null {
  const hex = hexColorOf(v);
  if (hex) return hex;
  const word = v.trim();
  if (!/^[a-z]+$/i.test(word)) return null;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return null;
  // Two different starts: a name the browser does not know leaves each as it was, so they differ.
  ctx.fillStyle = 'black';
  ctx.fillStyle = word;
  const a = ctx.fillStyle;
  ctx.fillStyle = 'white';
  ctx.fillStyle = word;
  return a === ctx.fillStyle ? hexColorOf(a) : null;
}

/**
 * A block's colour: one 44px round button per swatch (a radio group), the picked one ringed in ink. Eleven are the colour wheel the
 * founder gave (2026-11-06), and the twelfth is your own: a white pipette that opens a small card just under it (not a dialog) with
 * one field for a hex code or a colour name, a preview dot, a tick to use it and a cross to close; once set, the button wears that
 * colour, and tapping it again does the same. Arrow keys move through the swatches, Home and End jump to the ends. Six to a row in a
 * narrow form and all twelve on one row where there is room, spread across the full width.
 */
export function SwatchPicker({ value, onChange, label = 'Colour' }: { value: BlockColor; onChange: (v: BlockColor) => void; label?: string }) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const card = useRef<HTMLDivElement>(null);
  const at = (TIME_BLOCK_SWATCHES as readonly string[]).indexOf(value);
  // Your own colour is anything that is not one of the eleven (a typed hex, or a colour from before the wheel).
  const own = at < 0 ? value : null;
  const OWN = TIME_BLOCK_SWATCHES.length;
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [bad, setBad] = useState(false);
  const preview = text.trim() ? typedColour(text) : null;
  const n = OWN + 1;
  const focusAt = (i: number) => refs.current[i]?.focus();
  const close = (back = true) => {
    setTyping(false);
    if (back) focusAt(OWN);
  };
  // A tap anywhere outside the card or its button closes it, as Escape does.
  useEffect(() => {
    if (!typing) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (card.current?.contains(t) || refs.current[OWN]?.contains(t)) return;
      setTyping(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [typing, OWN]);
  const move = (to: number) => {
    const i = ((to % n) + n) % n;
    if (i < OWN) onChange(TIME_BLOCK_SWATCHES[i]!);
    focusAt(i);
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest('[data-own-card]')) return;
    const i = at < 0 ? OWN : at;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(i - 1);
    else if (e.key === 'Home') move(0);
    else if (e.key === 'End') move(n - 1);
    else return;
    e.preventDefault();
  };
  const openOwn = () => {
    setText(own && !isSwatch(own) ? own : '');
    setBad(false);
    setTyping((t) => !t);
  };
  const setOwn = () => {
    if (!preview) {
      setBad(true);
      return;
    }
    onChange(preview);
    close();
  };
  const ownName = own ? (isSwatch(own) ? SWATCH_META[own].name : own) : null;
  return (
    <div className="relative @container" onKeyDown={onKey}>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-[repeat(6,44px)] justify-between gap-y-xs @min-[36rem]:grid-cols-[repeat(12,44px)]">
        {TIME_BLOCK_SWATCHES.map((k, i) => (
          <button
            key={k}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={k === value}
            aria-label={SWATCH_META[k].name}
            title={SWATCH_META[k].name}
            tabIndex={k === value ? 0 : -1}
            onClick={() => onChange(k)}
            className={`tb-swatch tb-${k}`}
          >
            <span aria-hidden="true" />
          </button>
        ))}
        <button
          ref={(el) => {
            refs.current[OWN] = el;
          }}
          type="button"
          role="radio"
          aria-checked={own !== null}
          aria-expanded={typing}
          aria-controls={`${id}-own`}
          aria-label={ownName ? `Your own colour, ${ownName}. Change it` : 'Your own colour'}
          title={ownName ? `Your own colour: ${ownName}` : 'Your own colour'}
          tabIndex={own !== null ? 0 : -1}
          onClick={openOwn}
          className={`tb-swatch tb-swatch-own ${own && isSwatch(own) ? `tb-${own}` : ''}`}
          style={tbStyle(own)}
        >
          <span aria-hidden="true">
            <Icon icon={Pipette} size={16} />
          </span>
        </button>
      </div>
      {/* The small card under the pipette: its own colour as you type, a field with an example, a tick and a cross. */}
      {typing && (
        <div
          ref={card}
          id={`${id}-own`}
          data-own-card=""
          role="group"
          aria-label="Your own colour"
          className="tb-own-card absolute right-0 top-full z-20 mt-xs w-[min(100%,360px)] rounded-tile p-sm shadow-toy-soft"
        >
          {/* The design rules' own parts: the label and its quiet line, FIELD_LINE, IconButton for the tick and CloseButton for the cross. */}
          <label htmlFor={`${id}-own-field`} className={LABEL}>
            Your own colour
          </label>
          <p className="m-0 text-caption text-ink-soft">A hex code like 1E90FF, or a colour name like teal.</p>
          <div className="mt-xs flex items-center gap-xs">
            <span className="tb-own-preview" style={tbStyle(preview)} aria-hidden="true" />
            <input
              id={`${id}-own-field`}
              className={`${FIELD_LINE} min-w-0 flex-1`}
              value={text}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              placeholder="1E90FF"
              aria-describedby={bad ? `${id}-own-bad` : undefined}
              aria-invalid={bad || undefined}
              onChange={(e) => {
                setText(e.target.value);
                setBad(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setOwn();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  close();
                }
              }}
            />
            <IconButton icon={Check} label="Use this colour" tip="br" onClick={setOwn} disabled={!preview} />
            <CloseButton onClick={() => close()} />
          </div>
          {bad && (
            <div id={`${id}-own-bad`} className="mt-xs">
              <ErrorLine e="That is not a colour yet." warning />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
