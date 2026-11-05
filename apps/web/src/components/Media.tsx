import { videoEmbed, type MediaItem } from '@kreators/shared';
import gsap from 'gsap';
import { useLayoutEffect, useRef, useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react';
import { EmbedGate } from './EmbedGate';
import { Icon } from './Icon';
import { prefersReducedMotion } from './fx/env';
import { Play } from 'lucide-react';

/**
 * A picture that develops instead of popping in: held at opacity 0 and 102% until it has loaded, then brought to full over half a
 * second (opacity and transform only, GSAP). A picture already in the cache shows at once; reduced motion is a plain swap.
 * `frame` puts the picture in a box with those classes (the bg-paper placeholder, the corners, the size), so the frame shows while
 * the picture develops inside it and clips the slight scale; without it the parent clips. `reserve` holds a 16:9 space until the
 * picture arrives so the text under it does not jump. A picture that fails to load drops out, frame and all.
 */
export function FadeImage({ alt, frame, reserve = false, className = '', onLoad, onError, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { alt: string; frame?: string; reserve?: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  const shown = useRef(false);
  const [loaded, setLoaded] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.complete && el.naturalWidth > 0) {
      shown.current = true;
      setLoaded(true);
      return;
    }
    gsap.set(el, { opacity: 0, scale: 1.02 });
    return () => void gsap.killTweensOf(el);
  }, []);
  const develop = (e: SyntheticEvent<HTMLImageElement>) => {
    onLoad?.(e);
    setLoaded(true);
    if (shown.current) return;
    shown.current = true;
    const el = e.currentTarget;
    if (prefersReducedMotion()) {
      gsap.set(el, { clearProps: 'opacity,transform' });
      return;
    }
    gsap.to(el, { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out', onComplete: () => void gsap.set(el, { clearProps: 'opacity,transform' }) });
  };
  const drop = (e: SyntheticEvent<HTMLImageElement>) => {
    onError?.(e);
    const el = e.currentTarget;
    gsap.killTweensOf(el);
    (frame ? (el.parentElement ?? el) : el).style.display = 'none';
  };
  const img = <img ref={ref} {...rest} alt={alt} onLoad={develop} onError={drop} className={`${className} ${reserve && !loaded ? 'aspect-video' : ''}`} />;
  return frame ? <span className={`block overflow-hidden ${frame}`}>{img}</span> : img;
}

/** One picture, GIF or video, sized to its column. Videos play in their own player; a picture that fails to load drops out. */
export function MediaTile({ item, className = '', reserve = false }: { item: MediaItem; className?: string; reserve?: boolean }) {
  const frame = item.kind === 'video' ? videoEmbed(item.url) : null;
  if (item.kind === 'video') {
    if (!frame) return null;
    return (
      <figure className={`m-0 ${className}`}>
        {frame.type === 'frame' ? (
          <EmbedGate url={frame.src} title={item.caption || 'Video'}>
            <iframe
              src={frame.src}
              title={item.caption || 'Video'}
              loading="lazy"
              allow="encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="aspect-video w-full rounded-tile border-0 bg-paper"
            />
          </EmbedGate>
        ) : (
          <video src={frame.src} controls preload="metadata" playsInline className="aspect-video w-full rounded-tile bg-paper" aria-label={item.caption || 'Video'} />
        )}
        {item.caption && <figcaption className="mt-xs text-caption text-ink-soft">{item.caption}</figcaption>}
      </figure>
    );
  }
  return (
    <figure className={`m-0 ${className}`}>
      <FadeImage src={item.url} alt={item.caption} loading="lazy" decoding="async" referrerPolicy="no-referrer" frame="w-full rounded-tile bg-paper" className="w-full object-cover" reserve={reserve} />
      {item.caption && <figcaption className="mt-xs text-caption text-ink-soft">{item.caption}</figcaption>}
    </figure>
  );
}

/** The whole set: one big first item, the rest in a row that scrolls sideways. */
export function MediaGallery({ items }: { items: MediaItem[] }) {
  if (items.length === 0) return null;
  const [first, ...rest] = items;
  return (
    <div className="flex flex-col gap-xs">
      <MediaTile item={first!} reserve className="[&_img]:max-h-[360px]" />
      {rest.length > 0 && (
        <div className="scroll-row flex gap-xs">
          {rest.map((m) => (
            <MediaTile key={m.id} item={m} className="w-[220px] shrink-0 [&_img]:h-[140px]" />
          ))}
        </div>
      )}
    </div>
  );
}

/** The cover of a card: the first picture or GIF, or a video's play mark. Nothing when there is none. */
export function MediaCover({ items, title }: { items?: MediaItem[]; title?: string }) {
  const pic = items?.find((m) => m.kind !== 'video');
  const video = items?.find((m) => m.kind === 'video');
  if (pic) return <FadeImage src={pic.url} alt={pic.caption || title || ''} loading="lazy" decoding="async" referrerPolicy="no-referrer" frame="mb-sm h-[160px] w-full rounded-tile bg-paper" className="h-full w-full object-cover" />;
  if (video) return <div className="mb-sm flex h-[160px] w-full items-center justify-center rounded-tile bg-paper" aria-label={title ? `${title}: has a video` : 'Has a video'} role="img"><Icon icon={Play} size={32} filled /></div>;
  return null;
}
