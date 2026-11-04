import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { useModuleKey } from './HowTo';
import { BackLink } from './PageHeader';
import { CondensedTitle } from './fx/CondensedTitle';

// The drawing and its ripple download with the screen that shows them, never with the first page (the entry's budget).
// A failed download leaves the plain card: the art is decoration, so nothing is said.
const CoverArt = lazy<ComponentType<{ cover: string }>>(() =>
  import('./fx/CoverArt').then(
    (m) => ({ default: m.CoverArt }),
    () => ({ default: () => null }),
  ),
);

interface Props {
  /** The way back: drawn inside the card, at its top left. Profile, a main tab, has none and passes `topStart` instead. */
  back?: { to: string; label: string };
  /** In place of the way back, at the top left (Profile's small label). */
  topStart?: ReactNode;
  /** At the top right, level with the way back (Profile's compact Sign out). */
  topEnd?: ReactNode;
  /** A title row of its own (Profile: the picture, the name and its tags) in place of the plain h1; it must hold the page's h1. */
  heading?: ReactNode;
  /** The app whose cover to draw (a module key, or "rewards"); left out, it is the app the screen sits in. */
  cover?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  /** The helper lines under the title, right-aligned. */
  lede?: ReactNode;
  /** The header's actions: on the helper's line, at its left, the main action first and a gear right next to it. */
  actions?: ReactNode;
  /** Anything else the header carries (a row of jump links, filters): under the card, full width. */
  children?: ReactNode;
  /** Extra classes on the card (a document page's `no-print`). */
  className?: string;
}

/**
 * An app screen's header as one glass card with the app's own cover behind it (founder, 2026-11-04). The back button sits at the top left;
 * the title and the helper text under it sit at the bottom, right-aligned; the actions sit on the helper's line at its left (on a phone,
 * when they do not fit beside it, the actions take the bottom left and the helper wraps above them at the right). The cover (fx/CoverArt)
 * is anchored to the right behind the words and fades toward the left (app.css, "App covers").
 */
export function AppCover({ back, topStart, topEnd, heading, cover, eyebrow, title, lede, actions, children, className = '' }: Props) {
  const inApp = useModuleKey();
  const key = cover ?? inApp;
  const text = typeof title === 'string' ? title : '';
  return (
    <>
      <header data-cover="" className={`app-cover mt-lg rounded-card bg-card shadow-toy-soft ${className}`}>
        {key && (
          <div className="app-cover-art" aria-hidden="true">
            <Suspense fallback={null}>
              <CoverArt cover={key} />
            </Suspense>
          </div>
        )}
        <div className="app-cover-top">
          {back ? <BackLink to={back.to}>{back.label}</BackLink> : topStart}
          {topEnd && <div className="ml-auto">{topEnd}</div>}
        </div>
        <div className="app-cover-foot">
          {eyebrow && <p className="app-cover-eyebrow m-0 text-[14px] font-bold text-ink-soft">{eyebrow}</p>}
          {heading ?? (
            <CondensedTitle className="app-cover-title" title={text}>
              <h1 className="type-large">{title}</h1>
            </CondensedTitle>
          )}
          {(lede || actions) && (
            <div className="app-cover-row">
              {actions && (
                <div data-aside="" className="app-cover-actions">
                  {actions}
                </div>
              )}
              {lede && <div className="app-cover-lede text-[14px] font-semibold text-ink-soft">{lede}</div>}
            </div>
          )}
        </div>
      </header>
      {children && <div className={`mt-sm ${className}`}>{children}</div>}
    </>
  );
}
