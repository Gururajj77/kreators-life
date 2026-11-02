import { useSlider } from './useSlider';
import { tick } from './haptics';

/**
 * A segmented control: a capsule of choices with a thumb that glides under the chosen one (the macOS and iOS look). Each segment is a
 * button with aria-pressed, 44px tall, so it works the way the pill rows it replaces did; the thumb is only the paint. The owner keeps the
 * value (often in the URL); this never holds state of its own.
 */
export function Segmented<T extends string>({ label, value, onChange, options, className = '' }: { label: string; value: T; onChange: (v: T) => void; options: readonly { value: T; label: string }[]; className?: string }) {
  const { ref } = useSlider<HTMLDivElement>('[aria-pressed="true"]', value);
  return (
    <div ref={ref} role="group" aria-label={label} className={`fx-slide fx-seg ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => {
            if (o.value !== value) tick();
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
