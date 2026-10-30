import { videoEmbed, type MediaItem } from '@kreators/shared';

/** One picture, GIF or video, sized to its column. Videos play in their own player; a picture that fails to load drops out. */
export function MediaTile({ item, className = '' }: { item: MediaItem; className?: string }) {
  const frame = item.kind === 'video' ? videoEmbed(item.url) : null;
  if (item.kind === 'video') {
    if (!frame) return null;
    return (
      <figure className={`m-0 ${className}`}>
        {frame.type === 'frame' ? (
          <iframe
            src={frame.src}
            title={item.caption || 'Video'}
            loading="lazy"
            allow="encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="aspect-video w-full rounded-tile border-0 bg-paper"
          />
        ) : (
          <video src={frame.src} controls preload="metadata" playsInline className="aspect-video w-full rounded-tile bg-paper" aria-label={item.caption || 'Video'} />
        )}
        {item.caption && <figcaption className="mt-xs text-[12px] font-bold text-ink-soft">{item.caption}</figcaption>}
      </figure>
    );
  }
  return (
    <figure className={`m-0 ${className}`}>
      <img src={item.url} alt={item.caption} loading="lazy" referrerPolicy="no-referrer" className="w-full rounded-tile bg-paper object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
      {item.caption && <figcaption className="mt-xs text-[12px] font-bold text-ink-soft">{item.caption}</figcaption>}
    </figure>
  );
}

/** The whole set: one big first item, the rest in a row that scrolls sideways. */
export function MediaGallery({ items }: { items: MediaItem[] }) {
  if (items.length === 0) return null;
  const [first, ...rest] = items;
  return (
    <div className="flex flex-col gap-xs">
      <MediaTile item={first!} className="[&_img]:max-h-[360px]" />
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
export function MediaCover({ items }: { items?: MediaItem[] }) {
  const pic = items?.find((m) => m.kind !== 'video');
  const video = items?.find((m) => m.kind === 'video');
  if (pic) return <img src={pic.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="mb-sm h-[160px] w-full rounded-tile bg-paper object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />;
  if (video) return <div className="mb-sm flex h-[160px] w-full items-center justify-center rounded-tile bg-paper text-[32px]" aria-label="Has a video" role="img">▶</div>;
  return null;
}
