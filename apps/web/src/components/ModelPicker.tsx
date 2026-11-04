import type { AssistantModel } from '@kreators/shared';

/**
 * The model picker under a model chat's header, shared by the assistant panel and the Companion (both read and write
 * the same `useAssistantModel` pick). The select sits beside "Model" when there is room for its longest name, and on
 * a line of its own when not; the note under it says what the picked model may keep.
 */
export function ModelPicker({ models, model, onPick, disabled, note }: { models: readonly AssistantModel[]; model: AssistantModel; onPick: (id: string) => void; disabled?: boolean; note: string }) {
  return (
    <div className="border-b-2 border-line px-md py-xs">
      <label className="flex flex-wrap items-center gap-xs text-[12px] font-bold text-ink-soft">
        <span className="shrink-0">Model</span>
        <select value={model.id} onChange={(e) => onPick(e.target.value)} disabled={disabled} className="min-h-[44px] min-w-0 flex-1 basis-[240px] rounded-pill border-2 border-line bg-card px-xs text-[12px] font-bold text-ink">
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}, {m.by}
              {m.private ? ', keeps nothing' : ''}
            </option>
          ))}
        </select>
      </label>
      <p className="m-0 mt-xs text-[12px] font-semibold text-ink-soft">{note}</p>
    </div>
  );
}
