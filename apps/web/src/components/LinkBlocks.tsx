import { youtubeId, type LinkBlock } from '@kreators/shared';

/**
 * The link blocks on a public page, the way the creator stacked them: buttons, headers, text,
 * images, YouTube videos and carousels. A tap on anything with a link reports back so the owner
 * can see what people open. Every link opens in a new tab and leaves this page where it is.
 */
/** A picture that fails to load disappears instead of leaving a broken icon on the page. */
const hide = (e: { currentTarget: HTMLImageElement }) => {
  e.currentTarget.style.display = 'none';
};

export function LinkBlocks({ blocks, onOpen }: { blocks: LinkBlock[]; onOpen?: (id: string) => void }) {
  if (blocks.length === 0) return null;
  const open = (id: string) => () => onOpen?.(id);
  return (
    <section className="mt-md" aria-label="Links">
      <ul className="flex list-none flex-col gap-xs p-0 m-0">
        {blocks.map((b) => (
          <li key={b.id}>
            {b.type === 'link' && (
              <a href={b.url} target="_blank" rel="noreferrer" onClick={open(b.id)} className={`toy flex min-h-[56px] items-center justify-between gap-sm rounded-pill px-md text-[16px] font-bold ${b.featured ? 'toy-soft bg-r3 text-on-yellow' : 'bg-card text-ink shadow-toy-soft'}`}>
                <span className="min-w-0 flex-1 truncate text-center">{b.title || b.url}</span>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </a>
            )}
            {b.type === 'header' && <h2 className="mt-sm text-center text-[18px]">{b.title}</h2>}
            {b.type === 'text' && <p className="m-0 text-center text-[14px] font-semibold leading-relaxed">{b.text}</p>}
            {b.type === 'image' && (
              <figure className="m-0 overflow-hidden rounded-card bg-card shadow-toy-soft">
                {b.url ? (
                  <a href={b.url} target="_blank" rel="noreferrer" onClick={open(b.id)} className="block">
                    <img src={b.image} alt={b.title} loading="lazy" onError={hide} className="block max-h-[320px] w-full object-cover" />
                  </a>
                ) : (
                  <img src={b.image} alt={b.title} loading="lazy" onError={hide} className="block max-h-[320px] w-full object-cover" />
                )}
                {b.title && <figcaption className="p-sm text-center text-[14px] font-semibold">{b.title}</figcaption>}
              </figure>
            )}
            {b.type === 'video' &&
              (youtubeId(b.url) ? (
                <div className="overflow-hidden rounded-card bg-ink shadow-toy-soft">
                  <iframe src={`https://www.youtube-nocookie.com/embed/${youtubeId(b.url)}`} title={b.title || 'Video'} className="aspect-video w-full border-0" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
                  {b.title && <p className="m-0 p-sm text-center text-[14px] font-bold text-on-ink">{b.title}</p>}
                </div>
              ) : (
                <a href={b.url} target="_blank" rel="noreferrer" onClick={open(b.id)} className="toy flex min-h-[56px] items-center justify-center gap-xs rounded-pill bg-card px-md text-[16px] font-bold text-ink shadow-toy-soft">
                  <span aria-hidden="true">▶️</span>
                  {b.title || 'Watch'}
                </a>
              ))}
            {b.type === 'carousel' && (
              <div>
                {b.title && <h2 className="mt-sm text-center text-[18px]">{b.title}</h2>}
                <ul className="-mx-md mt-xs flex snap-x list-none gap-xs overflow-x-auto px-md pb-xs scrollbar-none m-0" aria-label={b.title || 'Carousel'}>
                  {b.items.map((it) => {
                    const card = (
                      <>
                        {it.image ? <img src={it.image} alt={it.title} loading="lazy" onError={hide} className="block aspect-[4/5] w-full object-cover" /> : <span className="flex aspect-[4/5] w-full items-center justify-center bg-paper text-[32px]" aria-hidden="true">🎠</span>}
                        {it.title && <span className="block p-sm text-[14px] font-bold">{it.title}</span>}
                      </>
                    );
                    return (
                      <li key={it.id} className="w-[240px] shrink-0 snap-start overflow-hidden rounded-card bg-card shadow-toy-soft">
                        {it.url ? (
                          <a href={it.url} target="_blank" rel="noreferrer" onClick={open(b.id)} className="toy block text-ink">
                            {card}
                          </a>
                        ) : (
                          card
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
