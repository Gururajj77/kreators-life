import { DEFAULT_PHONE_COUNTRY, dialOf, LOCALE, PHONE_COUNTRIES, phoneFrom, splitPhone } from '@kreators/shared';
import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { Icon } from './Icon';

type Country = { iso: string; dial: string; name: string };
let named: Country[] | null = null;

/** The countries by name, in the reader's words from the browser (Intl.DisplayNames), worked out once. */
function countries(): Country[] {
  if (named) return named;
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([LOCALE], { type: 'region' });
  } catch {
    names = null;
  }
  const nameOf = (iso: string) => {
    try {
      return names?.of(iso) ?? iso;
    } catch {
      return iso;
    }
  };
  named = PHONE_COUNTRIES.map((c) => ({ ...c, name: nameOf(c.iso) })).sort((a, b) => a.name.localeCompare(b.name, LOCALE));
  return named;
}

/**
 * A phone number with its country picked beside it (2026-11-17, the founder: "add country code selection in phone number while
 * onboarding"). The picker is a real select, drawn as the code and a chevron in the field's look; India is picked until someone
 * changes it. What is sent is the code and the number together (`phoneFrom` in shared), so the server's rule is unchanged. A number
 * pasted or filled in with its own +code moves that code to the picker; one typed with a plus is sent as typed and moves on leaving it.
 */
export function PhoneField({
  value,
  onChange,
  hint,
  surface = 'paper',
  required,
  label = 'Phone',
}: {
  value: string;
  onChange: (phone: string) => void;
  hint?: string | null;
  surface?: 'paper' | 'card';
  required?: boolean;
  label?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const [start] = useState(() => splitPhone(value, DEFAULT_PHONE_COUNTRY));
  const [iso, setIso] = useState(start.iso);
  const [typed, setTyped] = useState(start.number);
  const list = countries();
  const bg = surface === 'card' ? 'bg-card' : 'bg-paper';

  const put = (nextIso: string, nextTyped: string) => {
    setIso(nextIso);
    setTyped(nextTyped);
    onChange(phoneFrom(nextIso, nextTyped));
  };
  // A whole number with its code (pasted, or filled in by the browser) moves the code to the picker; one being typed waits for blur,
  // so "+1" is never read as the US while someone is still typing Jamaica's +1876.
  const takeCode = (raw: string, nextIso = iso) => {
    const t = raw.trim();
    if (!t.startsWith('+') && !/^00/.test(t)) return put(nextIso, raw);
    const split = splitPhone(t, nextIso);
    if (split.number && split.number !== t) return put(split.iso, split.number);
    put(nextIso, raw);
  };

  return (
    <div>
      <label htmlFor={id} className="block text-subhead font-semibold">
        {label}
      </label>
      <div className="mt-xs flex gap-xs">
        <span className={`phone-country relative flex shrink-0 items-center gap-xs rounded-tile border-2 border-line ${bg} px-sm text-body`}>
          <span aria-hidden="true">+{dialOf(iso)}</span>
          <Icon icon={ChevronDown} size={16} className="text-ink-soft" />
          <select
            aria-label="Country code"
            value={iso}
            onChange={(e) => put(e.target.value, typed)}
            autoComplete="tel-country-code"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          >
            {list.map((c) => (
              <option key={c.iso} value={c.iso}>
                {`${c.name} +${c.dial}`}
              </option>
            ))}
          </select>
        </span>
        <input
          id={id}
          type="tel"
          required={required}
          value={typed}
          onChange={(e) => {
            // A key typed or a letter deleted waits; a paste, a drop or the browser's autofill (no inputType at all) is a whole number.
            const kind = (e.nativeEvent as InputEvent).inputType ?? '';
            if (kind === 'insertText' || kind.startsWith('delete')) put(iso, e.target.value);
            else takeCode(e.target.value);
          }}
          onBlur={() => takeCode(typed)}
          autoComplete="tel"
          inputMode="tel"
          maxLength={24}
          placeholder={iso === 'IN' ? '98765 43210' : undefined}
          aria-describedby={hint ? hintId : undefined}
          className={`min-w-0 flex-1 rounded-tile border-2 border-line ${bg} px-sm py-sm text-body`}
        />
      </div>
      {hint && (
        <span id={hintId} className="mt-xs block text-caption text-ink-soft">
          {hint}
        </span>
      )}
    </div>
  );
}
