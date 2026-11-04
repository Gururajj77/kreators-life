import { youtubeId, type LinkBlock } from '@kreators/shared';
import type { CSSProperties } from 'react';
import { EmbedGate } from './EmbedGate';
import { FadeImage } from './Media';
import { Icon } from './Icon';
import { ArrowUpRight, GalleryHorizontal, Play, Star } from 'lucide-react';

/** The site a link goes to, as a short quiet line under its title ("youtube.com"). Blocks are https only (`parseLinkBlocks`). */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** A featured link: the glass card with a soft yellow wash over its left side (the family pillar's tint, so dark mode follows). */
const FEATURED: CSSProperties = { backgroundImage: 'linear-gradient(120deg, var(--tint-yellow), transparent 75%)' };

/**
 * The link blocks on a public page, the way the creator stacked them: links, headers, text, images, YouTube videos and carousels,
 * each a calm glass card (wave 19, 2026-11-04). A featured link is the larger card with a star; a header starts a group; a carousel
 * scrolls sideways in a `.scroll-row`. A tap on anything with a link reports back so the owner can see what people open. Every link
 * opens in a new tab and leaves this page where it is.
 */
export function LinkBlocks({ blocks, onOpen }: { blocks: LinkBlock[]; onOpen?: (id: string) => void }) {
  if (blocks.length === 0) return null;
  const open = (id: string) => () => onOpen?.(id);
  return (
    <section className="mt-md" aria-label="Links">
      <ul className="flex list-none flex-col gap-xs p-0 m-0">
        {blocks.map((b) => (
          <li key={b.id}>
            {b.type === 'link' && (
              <a
                href={b.url}
                target="_blank"
                rel="noreferrer"
                onClick={open(b.id)}
                data-pillar={b.featured ? 'parent_child' : undefined}
                style={b.featured ? FEATURED : undefined}
                className={`group toy toy-soft flex items-center gap-sm rounded-tile bg-card text-ink ${b.featured ? 'min-h-[80px] p-md' : 'min-h-[64px] px-md py-sm'}`}
              >
                {b.featured && (
                  <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-r3 text-on-yellow" aria-hidden="true">
                    <Icon icon={Star} size={20} filled />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className={`block break-words font-bold leading-snug ${b.featured ? 'text-[18px]' : 'text-[16px]'}`}>{b.title || hostOf(b.url) || b.url}</span>
                  {b.title && hostOf(b.url) && <span className="block truncate text-[12px] font-semibold text-ink-soft">{hostOf(b.url)}</span>}
                </span>
                <span className="flex size-[32px] shrink-0 items-center justify-center rounded-pill bg-paper text-ink-soft transition-transform motion-safe:group-hover:translate-x-xs" aria-hidden="true">
                  <Icon icon={ArrowUpRight} size={16} strokeWidth={2.5} />
                </span>
                {b.featured && <span className="sr-only">Featured.</span>}
              </a>
            )}
            {b.type === 'header' && <h2 className="mt-md text-[20px]">{b.title}</h2>}
            {b.type === 'text' && <p className="m-0 px-xs text-[14px] font-semibold leading-relaxed text-ink-soft">{b.text}</p>}
            {b.type === 'image' && (
              <figure className="m-0 overflow-hidden rounded-card bg-card shadow-toy-soft">
                {b.url ? (
                  <a href={b.url} target="_blank" rel="noreferrer" onClick={open(b.id)} className="block">
                    <FadeImage src={b.image} alt={b.title} loading="lazy" decoding="async" className="block max-h-[360px] w-full object-cover" />
                  </a>
                ) : (
                  <FadeImage src={b.image} alt={b.title} loading="lazy" decoding="async" className="block max-h-[360px] w-full object-cover" />
                )}
                {b.title && <figcaption className="px-md py-sm text-[14px] font-semibold">{b.title}</figcaption>}
              </figure>
            )}
            {b.type === 'video' &&
              (youtubeId(b.url) ? (
                <figure className="m-0 overflow-hidden rounded-card bg-card shadow-toy-soft">
                  <EmbedGate url={b.url} title={b.title || 'Video'} className="rounded-none">
                    <iframe src={`https://www.youtube-nocookie.com/embed/${youtubeId(b.url)}`} title={b.title || 'Video'} className="block aspect-video w-full border-0" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
                  </EmbedGate>
                  {b.title && <figcaption className="px-md py-sm text-[14px] font-semibold">{b.title}</figcaption>}
                </figure>
              ) : (
                <a href={b.url} target="_blank" rel="noreferrer" onClick={open(b.id)} className="group toy toy-soft flex min-h-[64px] items-center gap-sm rounded-tile bg-card px-md py-sm text-ink">
                  <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper" aria-hidden="true">
                    <Icon icon={Play} size={18} filled />
                  </span>
                  <span className="min-w-0 flex-1 text-[16px] font-bold leading-snug">{b.title || 'Watch'}</span>
                </a>
              ))}
            {b.type === 'carousel' && (
              <div>
                {b.title && <h2 className="mt-md text-[20px]">{b.title}</h2>}
                <div className="mt-xs">
                  <ul className="scroll-row snap-x list-none" aria-label={b.title || 'Carousel'}>
                    {b.items.map((it) => {
                      const card = (
                        <>
                          {it.image ? (
                            <FadeImage src={it.image} alt={it.title} loading="lazy" decoding="async" className="block aspect-[4/5] w-full object-cover" />
                          ) : (
                            <span className="flex aspect-[4/5] w-full items-center justify-center bg-paper text-ink-soft" aria-hidden="true">
                              <Icon icon={GalleryHorizontal} size={32} />
                            </span>
                          )}
                          {it.title && <span className="block px-sm py-sm text-[14px] font-bold leading-snug">{it.title}</span>}
                        </>
                      );
                      return (
                        <li key={it.id} className="w-[200px] shrink-0 snap-start md:w-[220px]">
                          {it.url ? (
                            <a href={it.url} target="_blank" rel="noreferrer" onClick={open(b.id)} className="toy toy-soft block h-full overflow-hidden rounded-tile bg-card text-ink">
                              {card}
                            </a>
                          ) : (
                            <div className="h-full overflow-hidden rounded-tile bg-card shadow-toy-soft">{card}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
