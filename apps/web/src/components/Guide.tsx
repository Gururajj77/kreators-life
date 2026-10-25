import { useState } from 'react';
import { Button } from './Button';

const KEY = 'kreators.guideSeen';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function useGuide(): { seen: boolean; dismiss: () => void; reset: () => void } {
  const [seen, setSeen] = useState(read);
  const write = (v: boolean) => {
    try {
      if (v) localStorage.setItem(KEY, '1');
      else localStorage.removeItem(KEY);
    } catch {
      // Private mode: the guide just shows again next time.
    }
    setSeen(v);
  };
  return { seen, dismiss: () => write(true), reset: () => write(false) };
}

const STEPS = [
  { title: 'Daily is your routine', body: 'Three boxes, every day. Check in, do the small act, tick one task. Tick a box once you have really done it.' },
  { title: 'Pillars are where you set things up', body: 'Seven pillars, one for each relationship in your life. A pillar you set up gives Daily its tasks.' },
  { title: 'Everything grows', body: 'Each task makes its pyramid stronger. Xp fills up who you are becoming, next to who you are now.' },
];

export function GuideCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section className="mt-md rounded-card bg-ink p-md text-on-ink shadow-toy-soft" aria-labelledby="guide-heading">
      <h2 id="guide-heading" className="text-[24px]">
        How this works
      </h2>
      <ol className="mt-sm flex list-none flex-col gap-sm p-0 m-0">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-sm">
            <span className="flex size-[32px] shrink-0 items-center justify-center rounded-pill bg-on-ink font-display text-[14px] font-extrabold text-ink" aria-hidden="true">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[16px] font-extrabold">{s.title}</span>
              <span className="block text-[14px] font-semibold text-on-ink/80">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <Button variant="outline" className="mt-md" onClick={onDismiss}>
        Got it
      </Button>
    </section>
  );
}
