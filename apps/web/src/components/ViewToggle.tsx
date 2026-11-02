import { PIPELINE_VIEWS, type PipelineView } from '@kreators/shared';
import { Segmented } from './fx/Segmented';
import { useParamState } from '../lib/useParamState';

const NAME: Record<PipelineView, string> = { list: 'List', board: 'Board' };

/** Which way a pipeline is shown, kept in the URL (`prefix` tells two on one screen apart) so Back and a shared link keep it. */
export function useView(prefix = '', fallback: PipelineView = 'board'): [PipelineView, (v: PipelineView) => void] {
  const [raw, set] = useParamState(`${prefix}view`, fallback);
  const view = (PIPELINE_VIEWS as readonly string[]).includes(raw) ? (raw as PipelineView) : fallback;
  return [view, set];
}

/** The two-way switch between a list and a kanban board. */
export function ViewToggle({ view, onChange, label = 'View' }: { view: PipelineView; onChange: (v: PipelineView) => void; label?: string }) {
  return <Segmented label={label} value={view} onChange={onChange} options={PIPELINE_VIEWS.map((v) => ({ value: v, label: NAME[v] }))} />;
}
