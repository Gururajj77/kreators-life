import { CONSENT_PURPOSES, LEGAL_VERSION, NO_CONSENT, type ConsentChoices, type ConsentPurpose } from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import gsap from 'gsap';
import { Link2, Mail, ShieldCheck, Video, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api } from '../lib/api';
import { globalPrivacyControl, useConsent } from '../lib/consent';
import { useMe } from '../lib/queries';
import { useSession } from '../lib/store';
import { Button } from './Button';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Toggle } from './Toggle';

/** The icon beside each choice in the sheet. */
const PURPOSE_ICON: Record<ConsentPurpose['key'], LucideIcon> = { attribution: Link2, embeds: Video, marketing: Mail };

/** The whole-page chats keep the screen to themselves while they run; the card waits until the person leaves them. */
const CHAT_PATHS = ['/onboarding', '/session'];

/**
 * The one-time privacy question, and, for an account made before the terms were written down, the terms notice once.
 * Compact by default: one short line with Accept all and Reject all, equally easy, and a quiet Choose that opens a sheet
 * with the three choices as switches. All three start off. On a laptop it is a small glass card at the bottom left, low
 * and narrow so it never covers the public hero's words; on a phone it is a slim bar above the tab bar. It is asked once:
 * the answer is kept on the account (and on this device for a visitor), changed any time under Profile, Privacy choices,
 * and shown again only when the wording changes (`CONSENT_VERSION`) or the footer's "Privacy choices" button opens it,
 * which goes straight to the sheet. Global Privacy Control keeps the tracked-link cookie off whatever is picked.
 */
export function ConsentPopup() {
  const token = useSession((s) => s.token);
  const qc = useQueryClient();
  const local = useConsent();
  const me = useMe();
  const { pathname } = useLocation();
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
  const [choosing, setChoosing] = useState(false);
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
  const inChat = CHAT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const asked = token ? Boolean(legal.data) && (!decided || needsTerms) : !decided;
  // The footer's button (local.open) opens the sheet itself; the card is for the first ask.
  const showCard = asked && !inChat && !local.open;
  const step: 'terms' | 'choices' = needsTerms ? 'terms' : 'choices';
  const sheetOpen = local.open || choosing;

  // The sheet starts from what is kept.
  useEffect(() => {
    if (sheetOpen) setDraft({ ...local.choices });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  useEffect(() => {
    const el = root.current;
    if (!showCard || !el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.set(el, { opacity: 1, y: 0 });
    else gsap.fromTo(el, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, ease: 'expo.out' });
  }, [showCard, step]);

  // The footer's "Privacy choices" button.
  useEffect(() => {
    const open = () => local.setOpen(true);
    window.addEventListener('kreators:open-consent', open);
    return () => window.removeEventListener('kreators:open-consent', open);
  }, [local]);

  const choose = (choices: ConsentChoices) => {
    save.mutate(gpc ? { ...choices, attribution: false } : choices);
    setChoosing(false);
  };
  const closeSheet = () => {
    setChoosing(false);
    if (local.open) local.setOpen(false);
  };

  // On a phone: a floating glass card with room around it, above the tab bar inside the app and just above the bottom edge on the
  // public site. Inside the app on a laptop (a sidebar, no hero under it), a small card docked beside the sidebar. On the public site's
  // laptop width, a full-width bar along the very bottom edge, which covers less of the hero than a card.
  // The tab bar is 82px tall (a 72px tab under its padding and edge), so the card sits 96px up: 14px clear of it, level with the assistant.
  const place = token ? 'bottom-[calc(var(--spacing-xl)+var(--spacing-lg)+env(safe-area-inset-bottom))]' : 'bottom-[calc(var(--spacing-sm)+env(safe-area-inset-bottom))]';
  const laptop = token
    ? 'md:bottom-md md:left-[calc(var(--nav-w)+var(--spacing-md))] md:right-auto md:w-[360px]'
    : 'md:inset-x-0 md:bottom-0 md:rounded-none md:border-x-0 md:border-b-0 md:border-t-2 md:px-md md:py-sm md:pb-[calc(var(--spacing-sm)+env(safe-area-inset-bottom))]';

  return (
    <>
      {showCard && (
        <div
          ref={root}
          role="dialog"
          aria-label={step === 'terms' ? 'Our terms and privacy policy' : 'Your privacy choices'}
          className={`fixed inset-x-sm z-[45] rounded-card border border-line bg-card-strong p-md text-ink shadow-toy-soft ${place} ${laptop}`}
        >
          {step === 'terms' ? (
            <div className="flex flex-col gap-xs">
              <p className="m-0 text-subhead text-ink-soft">
                <span className="font-bold text-ink">Our terms are in plain words now</span> (version {LEGAL_VERSION}). Please read the{' '}
                <Link to="/terms" target="_blank" className="font-bold text-ink underline underline-offset-4">
                  terms of use
                </Link>{' '}
                and the{' '}
                <Link to="/privacy" target="_blank" className="font-bold text-ink underline underline-offset-4">
                  privacy policy
                </Link>
                .
              </p>
              <div className="flex justify-end">
                <Button onClick={() => accept.mutate()} disabled={accept.isPending}>
                  I agree
                </Button>
              </div>
            </div>
          ) : (
            // On the public site's laptop width the words and the three choices share one short line, so the bar covers less of the page.
            <div className={`flex flex-col gap-sm ${token ? '' : 'md:mx-auto md:max-w-[1080px] md:flex-row md:items-center md:justify-between md:gap-md'}`}>
              <div className="min-w-0">
                <p className={`m-0 flex items-center gap-xs text-headline text-ink ${token ? '' : 'md:hidden'}`}>
                  <Icon icon={ShieldCheck} size={18} />
                  Your privacy
                </p>
                <p className={`mt-xs m-0 text-subhead text-ink-soft ${token ? '' : 'md:mt-0'}`}>
                  A cookie, outside videos and email news stay off unless you say yes.{' '}
                  <Link to="/privacy" target="_blank" className="whitespace-nowrap underline underline-offset-4">
                    Privacy policy
                  </Link>
                </p>
                <GrievanceLine />
              </div>
              {/* Two equal choices side by side, neither solid; "Choose" opens the three switches, as a quiet link above them. */}
              <div className={`grid grid-cols-2 gap-xs ${token ? '' : 'md:flex md:shrink-0 md:items-center'}`}>
                <button type="button" onClick={() => setChoosing(true)} className="col-span-2 inline-flex min-h-[44px] items-center justify-self-start text-subhead text-ink-soft underline underline-offset-4 hover:text-ink md:mr-xs">
                  Choose for each
                </button>
                <Button variant="outline" full onClick={() => choose({ ...NO_CONSENT })} disabled={save.isPending} className="md:w-auto">
                  Reject all
                </Button>
                <Button variant="outline" full onClick={() => choose({ attribution: true, embeds: true, marketing: true })} disabled={save.isPending} className="md:w-auto">
                  Accept all
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Sheet open={sheetOpen} onClose={closeSheet} title="Your privacy choices">
        <p className="m-0 text-subhead text-ink-soft">All three start off. You can change them any time under Profile, Privacy choices.</p>
        <GrievanceLine />
        <ul className="mt-sm m-0 flex list-none flex-col gap-xs p-0">
          {CONSENT_PURPOSES.map((p) => {
            const off = p.key === 'attribution' && gpc;
            return (
              <li key={p.key} className="flex items-start gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <span className="mt-sm flex size-[32px] shrink-0 items-center justify-center rounded-pill bg-paper text-ink-soft">
                  <Icon icon={PURPOSE_ICON[p.key]} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <Toggle compact on={draft[p.key] && !off} disabled={off} onChange={(on) => setDraft((d) => ({ ...d, [p.key]: on }))} label={p.name} />
                  <p className="m-0 text-caption text-ink-soft">{off ? 'Your browser sent Global Privacy Control, so this stays off.' : p.line}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-md flex flex-wrap items-center justify-end gap-xs">
          <Link to="/privacy" target="_blank" className="mr-auto text-subhead text-ink-soft underline underline-offset-4">
            Privacy policy
          </Link>
          <Button onClick={() => choose(draft)} disabled={save.isPending}>
            Save my choices
          </Button>
        </div>
      </Sheet>
    </>
  );
}

/** The one quiet line on who to ask: taking a choice back is one tap, and a question goes to the Grievance Officer (DPDP Act). */
function GrievanceLine() {
  return (
    <p className="mt-xs m-0 text-caption text-ink-soft">
      You can change these any time. Questions go to our{' '}
      <Link to="/contact" className="underline underline-offset-4">
        Grievance Officer
      </Link>
      .
    </p>
  );
}
