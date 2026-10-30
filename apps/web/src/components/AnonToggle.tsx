/** "Post under a made-up name", the choice Reddit gives. The name stays the same all through one conversation and changes in the next. */
export function AnonToggle({ on, onChange, className = '' }: { on: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <label className={`toy toy-flat flex min-h-[44px] cursor-pointer items-start gap-sm rounded-tile p-xs ${className}`}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-[2px] size-[22px] shrink-0" />
      <span className="min-w-0">
        <span className="block text-[14px] font-bold">Post anonymously</span>
        <span className="block text-[12px] font-bold text-ink-soft">You get a made-up name, the same all through this conversation. Others cannot see who you are. Staff can, if it is reported.</span>
      </span>
    </label>
  );
}
