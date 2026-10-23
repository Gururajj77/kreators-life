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
  { title: 'Today is your routine', body: 'Three things, every day: check in, do the spark, tick a task. Done means done.' },
  { title: 'Tower is where you build', body: 'Seven floors, one per relationship. A floor you build gives Today its tasks.' },
  { title: 'Everything evolves', body: 'Tasks feed the rungs above them. Xp fills up who you are becoming, next to who you are now.' },
];

export function GuideCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section className="mt-md rounded-card bg-ink p-md text-white shadow-[0_4px_0_0_#15101f]" aria-labelledby="guide-heading">
      <h2 id="guide-heading" className="text-[22px]">
        How this works
      </h2>
      <ol className="mt-sm flex list-none flex-col gap-sm p-0 m-0">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-sm">
            <span className="flex size-[32px] shrink-0 items-center justify-center rounded-pill bg-white font-display text-[14px] font-extrabold text-ink" aria-hidden="true">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[16px] font-extrabold">{s.title}</span>
              <span className="block text-[14px] font-semibold text-white/80">{s.body}</span>
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
