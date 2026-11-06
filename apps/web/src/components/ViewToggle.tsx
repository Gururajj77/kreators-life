import { PIPELINE_VIEWS, type PipelineView } from '@kreators/shared';
import { Segmented } from './fx/Segmented';
import { useParamState } from '../lib/useParamState';
import { isWide } from '../lib/useWide';

const NAME: Record<PipelineView, string> = { list: 'List', board: 'Board' };

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
export function ViewToggle({ view, onChange, label = 'View', className }: { view: PipelineView; onChange: (v: PipelineView) => void; label?: string; className?: string }) {
  return <Segmented label={label} value={view} onChange={onChange} options={PIPELINE_VIEWS.map((v) => ({ value: v, label: NAME[v] }))} className={className} />;
}
