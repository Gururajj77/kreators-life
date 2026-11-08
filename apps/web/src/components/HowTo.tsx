import { MODULE_BY_KEY } from '@kreators/shared';
import { createContext, lazy, Suspense, useContext, useState, type ComponentType, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import type { PanelProps } from './HowItWorksPanel';

const Key = createContext<string | null>(null);

/** Tells the screens inside which app they belong to, so `Screen` can end with that app's how-it-works. */
export function HowTo({ moduleKey, children }: { moduleKey: string; children: ReactNode }) {
  return <Key.Provider value={moduleKey}>{children}</Key.Provider>;
}

/** The app the screen belongs to (set by `Gate` and `explained` in App.tsx), or null outside one. The app cover reads it too. */
export function useModuleKey(): string | null {
  return useContext(Key);
}

/**
 * The drawn card and its steps (`HOW_TO`, `@kreators/shared/help`) are a chunk of their own, fetched the first time a screen
 * shows the section, so that long text never sits in the shared chunk or the first download (2026-11-07). A failed fetch
 * leaves the section out rather than breaking the screen.
 */
const Panel = lazy<ComponentType<PanelProps>>(() =>
  import('./HowItWorksPanel').then(
    (m) => ({ default: m.HowItWorksPanel }),
    () => ({ default: () => null }),
  ),
);

/**
 * "How it works" at the bottom of an app's main screen: one card that is a button. Tap it and the
 * steps from HOW_TO and the words the app leans on open together, each as its own smaller toggle;
 * tap it again and everything folds away. Detail pages inside an app (one event, one club, one
 * product) leave it to the main screen. The card itself is `HowItWorksPanel`; this keeps the place and the open state.
 */
export function HowItWorks({ page }: { /** A core page that is not an app (Emerging): its own HOW_TO key and name, shown wherever it is drawn. */ page?: { key: string; name: string } } = {}) {
  const ctxKey = useContext(Key);
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState(true);
  const [words, setWords] = useState(true);
  const key = page?.key ?? ctxKey;
  const meta = page ? { name: page.name, path: pathname } : key ? MODULE_BY_KEY[key] : undefined;
  if (!key || !meta || pathname !== meta.path) return null;
  return (
    <Suspense fallback={null}>
      <Panel howKey={key} name={meta.name} open={open} setOpen={setOpen} steps={steps} setSteps={setSteps} words={words} setWords={setWords} />
    </Suspense>
  );
}
