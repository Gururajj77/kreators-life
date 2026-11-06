import { isSwatch, type BlockColor } from '@kreators/shared';
import type { CSSProperties } from 'react';

/**
 * A time block's colour on screen: a swatch key is its `.tb-<key>` class (app.css maps it to a token), and a person's own "#rrggbb"
 * (their data, 2026-11-06) sets `--tb` inline, which every `.tb-*` part reads the same way.
 */
export const tbClass = (c: BlockColor | null | undefined, fallback = ''): string => (c ? (isSwatch(c) ? `tb-${c}` : '') : fallback);
export const tbStyle = (c: BlockColor | null | undefined, more?: CSSProperties): CSSProperties | undefined =>
  c && !isSwatch(c) ? ({ ...more, '--tb': c } as CSSProperties) : more;
