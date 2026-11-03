import { PIPELINE_VIEWS, type PipelineView } from '@kreators/shared';
import { useEffect, useState } from 'react';
import { Segmented } from './fx/Segmented';
import { useParamState } from '../lib/useParamState';

const NAME: Record<PipelineView, string> = { list: 'List', board: 'Board' };

/** The same test as the `md` variant in app.css (width and height), so a phone, upright or on its side, counts as a phone. */
const WIDE = '(min-width: 48rem) and (min-height: 30rem)';
const isWide = () => typeof window === 'undefined' || typeof window.matchMedia !== 'function' || window.matchMedia(WIDE).matches;

/** Whether the screen is wide (the `md` test), following a resize or a phone turning. */
export function useWide(): boolean {
  const [wide, setWide] = useState(isWide);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const m = window.matchMedia(WIDE);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

/**
 * Which way a pipeline is shown, kept in the URL (`prefix` tells two on one screen apart) so Back and a shared link keep it.
 * With no view in the URL a phone starts on the list, since six columns of cards are a lot to swipe through; a laptop starts on `fallback`.
 */
export function useView(prefix = '', fallback: PipelineView = 'board'): [PipelineView, (v: PipelineView) => void] {
  const start: PipelineView = isWide() ? fallback : 'list';
  const [raw, set] = useParamState(`${prefix}view`, start);
  const view = (PIPELINE_VIEWS as readonly string[]).includes(raw) ? (raw as PipelineView) : start;
  return [view, set];
}

/** The two-way switch between a list and a kanban board. */
export function ViewToggle({ view, onChange, label = 'View' }: { view: PipelineView; onChange: (v: PipelineView) => void; label?: string }) {
  return <Segmented label={label} value={view} onChange={onChange} options={PIPELINE_VIEWS.map((v) => ({ value: v, label: NAME[v] }))} />;
}
