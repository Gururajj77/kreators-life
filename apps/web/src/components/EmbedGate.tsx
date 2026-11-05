import { CONSENT_PURPOSES } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { useConsent } from '../lib/consent';
import { useSession } from '../lib/store';
import { Button } from './Button';

/** The site a video comes from, for the words on the card. */
export function embedHost(url: string): string {
  return /vimeo/i.test(url) ? 'Vimeo' : 'YouTube';
}

/**
 * A video from another site waits for a tap until the person says yes to videos in their privacy choices. Until then the other site
 * sees nothing: no request goes to it. "Play" loads this one video; "Always show videos" saves the choice for good.
 */
export function EmbedGate({ url, title, children, className = '' }: { url: string; title: string; children: ReactNode; className?: string }) {
  const allowed = useConsent((s) => s.choices.embeds);
  const [once, setOnce] = useState(false);
  const token = useSession((s) => s.token);
  const always = useMutation({
    mutationFn: async () => {
      const next = { ...useConsent.getState().choices, embeds: true };
      useConsent.getState().keep(next);
      if (token) await api.saveConsent(next, 'popup');
    },
  });
  if (allowed || once) return <>{children}</>;
  const host = embedHost(url);
  const line = CONSENT_PURPOSES.find((p) => p.key === 'embeds')?.line ?? '';
  return (
    <div className={`flex aspect-video w-full flex-col items-center justify-center gap-xs rounded-tile bg-paper p-md text-center ${className}`}>
      <p className="m-0 text-headline">{title || `Video from ${host}`}</p>
      <p className="m-0 max-w-[420px] text-caption text-ink-soft">This video is hosted by {host}, which sees your visit once it loads. {line}</p>
      <div className="mt-xs flex flex-wrap justify-center gap-xs">
        <Button size="sm" onClick={() => setOnce(true)}>
          Play this video
        </Button>
        <Button size="sm" variant="outline" onClick={() => always.mutate()} disabled={always.isPending}>
          Always show videos
        </Button>
      </div>
    </div>
  );
}
