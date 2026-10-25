import { Link } from 'react-router';

/**
 * A quiet one-liner about what an action pays, with a way to see the whole picture.
 * Never a banner: small, soft, one sentence, placed under the thing it talks about.
 */
export function Nudge({ text, className = '' }: { text: string; className?: string }) {
  return (
    <p className={`m-0 text-[12px] font-bold text-ink-soft ${className}`}>
      {text}{' '}
      <Link to="/help#earning" className="underline underline-offset-4 hover:text-ink">
        How it adds up
      </Link>
    </p>
  );
}
