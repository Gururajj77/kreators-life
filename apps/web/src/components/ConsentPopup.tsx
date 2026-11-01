import { CONSENT_PURPOSES, LEGAL_VERSION, NO_CONSENT, type ConsentChoices } from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { globalPrivacyControl, useConsent } from '../lib/consent';
import { useMe } from '../lib/queries';
import { useSession } from '../lib/store';
import { Button } from './Button';

/**
 * The one-time card at the bottom left that asks about cookies, videos and news by email, and, for an account that was made before the
 * terms were written down, tells the person about them once. It is asked once: the answer is kept on the account (and on this device for a
 * visitor), changed any time under Profile, "Privacy choices", and shown again only when the wording changes or the footer's button opens it.
 */
export function ConsentPopup() {
  const token = useSession((s) => s.token);
  const qc = useQueryClient();
  const local = useConsent();
  const me = useMe();
  const legal = useQuery({ queryKey: ['legal'], queryFn: api.legal, enabled: Boolean(token) });
  const save = useMutation({
    mutationFn: async (choices: ConsentChoices) => {
      local.keep(choices);
      if (token) return api.saveConsent(choices, 'popup');
      return null;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['legal'] }),
  });
  const accept = useMutation({ mutationFn: api.acceptTerms, onSuccess: () => void qc.invalidateQueries({ queryKey: ['legal'] }) });
  const [draft, setDraft] = useState<ConsentChoices>({ ...NO_CONSENT });
  const root = useRef<HTMLDivElement>(null);
  const gpc = globalPrivacyControl();

  // A signed-in person's answer lives on the account: take it onto this device, or, if they answered as a visitor first, give it to the account.
  useEffect(() => {
    if (!token || !legal.data) return;
    if (legal.data.decided) {
      const same = JSON.stringify(legal.data.consent) === JSON.stringify(local.choices);
      if (!local.decided || !same) local.keep(legal.data.consent);
    } else if (local.decided && !save.isPending) {
      save.mutate(local.choices);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, legal.data?.decided, legal.data?.consent]);

  const decided = token ? (legal.data ? legal.data.decided || local.decided : true) : local.decided;
  // Only an account with an email gets the terms notice: a device account has not made a person's account yet.
  const needsTerms = Boolean(token && me.data?.user?.email && legal.data?.needsAcceptance);
  const show = local.open || (token ? Boolean(legal.data) && (!decided || needsTerms) : !decided);
  const step: 'terms' | 'choices' = needsTerms && !local.open ? 'terms' : 'choices';

  useEffect(() => {
    if (local.open) setDraft({ ...local.choices });
  }, [local.open, local.choices]);

  useEffect(() => {
    const el = root.current;
    if (!show || !el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.set(el, { opacity: 1, y: 0 });
    else gsap.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: 'expo.out' });
  }, [show, step]);

  // The footer's "Privacy choices" button.
  useEffect(() => {
    const open = () => local.setOpen(true);
    window.addEventListener('kreators:open-consent', open);
    return () => window.removeEventListener('kreators:open-consent', open);
  }, [local]);

  if (!show) return null;
  const choose = (choices: ConsentChoices) => save.mutate(gpc ? { ...choices, attribution: false } : choices);
  const toggle = (key: ConsentChoices extends infer C ? keyof C : never) => setDraft((d) => ({ ...d, [key]: !d[key] }));

  return (
    <div
      ref={root}
      role="dialog"
      aria-label={step === 'terms' ? 'Our terms and privacy policy' : 'Your privacy choices'}
      className="fixed inset-x-sm bottom-[calc(var(--spacing-xl)+var(--spacing-md)+env(safe-area-inset-bottom))] z-[45] max-h-[min(70dvh,560px)] overflow-y-auto rounded-card border-2 border-line bg-card-strong p-md text-ink shadow-toy md:inset-x-auto md:bottom-[calc(var(--spacing-xl)+var(--spacing-md))] md:left-[calc(240px+var(--spacing-md))] md:w-[400px]"
    >
      {step === 'terms' ? (
        <>
          <h2 className="m-0 text-[18px]">We wrote our rules down</h2>
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
            Our terms of use and privacy policy are now in plain words (version {LEGAL_VERSION}). Please read them and tell us you agree to carry on.
          </p>
          <p className="mt-xs m-0 flex flex-wrap gap-sm text-[14px] font-extrabold">
            <Link to="/terms" target="_blank" className="underline underline-offset-4">
              Terms of use
            </Link>
            <Link to="/privacy" target="_blank" className="underline underline-offset-4">
              Privacy policy
            </Link>
          </p>
          <div className="mt-sm flex">
            <Button size="sm" onClick={() => accept.mutate()} disabled={accept.isPending}>
              I agree
            </Button>
          </div>
        </>
      ) : (
        <>
          <h2 className="m-0 text-[18px]">Your privacy choices</h2>
          <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">All three start off. Change them any time under Profile, Privacy choices.</p>
          <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
            {CONSENT_PURPOSES.map((p) => {
              const off = p.key === 'attribution' && gpc;
              return (
                <li key={p.key}>
                  <label className="toy toy-flat flex min-h-[44px] cursor-pointer items-start gap-sm rounded-tile px-xs py-xs">
                    <input type="checkbox" checked={draft[p.key] && !off} disabled={off} onChange={() => toggle(p.key)} className="mt-xs size-[24px] shrink-0" />
                    <span>
                      <span className="block text-[14px] font-extrabold">{p.name}</span>
                      <span className="block text-[12px] font-semibold text-ink-soft">{off ? 'Your browser sent Global Privacy Control, so this stays off.' : p.line}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-sm grid grid-cols-3 gap-xs">
            <Button size="sm" variant="outline" onClick={() => choose({ ...NO_CONSENT })} disabled={save.isPending}>
              Reject all
            </Button>
            <Button size="sm" variant="outline" onClick={() => choose(draft)} disabled={save.isPending}>
              Save mine
            </Button>
            <Button size="sm" variant="outline" onClick={() => choose({ attribution: true, embeds: true, marketing: true })} disabled={save.isPending}>
              Accept all
            </Button>
          </div>
          <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">
            More in the{' '}
            <Link to="/privacy" target="_blank" className="underline underline-offset-4">
              privacy policy
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
