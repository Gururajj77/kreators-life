import type { ConnectPerson } from '@kreators/shared/connect';
import { useEffect, useState, type Ref } from 'react';
import { connectApi, type ConnectDoor } from '../lib/connectApi';
import { useDebounced } from '../lib/useDebounced';
import { FIELD } from '../lib/ui';
import { errorText } from './ErrorLine';
import { FieldLabel } from './Field';

/** A picture, or the first letter on the paper fill: never an email, a phone or a birth date. */
export function Face({ person }: { person: ConnectPerson }) {
  const [broken, setBroken] = useState(false);
  const url = person.avatarUrl;
  if (url && (url.startsWith('https://') || url.startsWith('/api/public/media/')) && !broken)
    return <img src={url} alt="" width={44} height={44} loading="lazy" decoding="async" onError={() => setBroken(true)} className="size-[44px] shrink-0 rounded-pill bg-paper object-cover" />;
  return (
    <span aria-hidden="true" className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-headline text-ink-soft">
      {(person.name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

/**
 * One person, found by email, @username, friend code or id as it is typed; the preview is all the form shows of them. An answer counts only
 * for the words it was asked about (`for`): while the field holds anything else (a key just typed, a lookup still on its way on a slow
 * network, the field emptied after a send) the form has nobody, so a send never goes out with the person the field no longer names.
 * Connect people (Admin and Manage) and the cohort page's manager share it (2026-11-10).
 */
export function PersonField({ door, find, label, value, onChange, onFound, inputRef }: { door: ConnectDoor; find?: (who: string) => Promise<{ person: ConnectPerson }>; label: string; value: string; onChange: (v: string) => void; onFound: (p: ConnectPerson | null) => void; inputRef?: Ref<HTMLInputElement> }) {
  const now = value.trim();
  const typed = useDebounced(now, 300);
  const [answer, setAnswer] = useState<{ for: string; person: ConnectPerson | null; missing: string }>({ for: '', person: null, missing: '' });
  useEffect(() => {
    let live = true;
    if (typed.length < 3) {
      setAnswer({ for: typed, person: null, missing: '' });
      return;
    }
    // `find` is a lookup of the caller's own (the cohort page's, for a program's maker who is not on staff); else the team's door.
    (find ? find(typed) : connectApi.person(door, typed))
      .then((r) => live && setAnswer({ for: typed, person: r.person, missing: '' }))
      .catch((e: unknown) => live && setAnswer({ for: typed, person: null, missing: errorText(e) }));
    return () => {
      live = false;
    };
    // `find` is a new function each render of its parent; the field follows the words and the door only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [door, typed]);
  const current = answer.for === now;
  const found = current ? answer.person : null;
  const missing = current ? answer.missing : '';
  useEffect(() => {
    onFound(found);
    // onFound is a setter of the parent; the person follows only the answer that matches the field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found]);
  return (
    <div>
      <FieldLabel label={label} hint="Email, @username, friend code or id">
        <input ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" spellCheck={false} className={FIELD} />
      </FieldLabel>
      {found && (
        <p className="mt-xs m-0 flex items-center gap-sm text-subhead" role="status">
          <Face person={found} />
          <span className="min-w-0">
            <span className="block font-semibold">{found.name}</span>
            {found.handle && <span className="block text-caption text-ink-soft">@{found.handle}</span>}
          </span>
        </p>
      )}
      {missing && <p className="mt-xs m-0 text-subhead text-ink-soft" role="status">{missing}</p>}
    </div>
  );
}
