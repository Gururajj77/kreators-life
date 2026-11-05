/**
 * Keeps the last two words of a line on one line, hyphens included ("twenty-five posts", "week-on-week trend."), so a line never
 * ends on a word alone. Unlike `tie` in lib/text.ts it returns nodes: the tail is a nowrap span, so the words themselves never change.
 * Lines of fewer than three words are left alone.
 */
export function keepTail(text: string) {
  const words = text.trim().split(/\s+/);
  if (words.length < 3) return text;
  return (
    <>
      {words.slice(0, -2).join(' ')} <span className="whitespace-nowrap">{words.slice(-2).join(' ')}</span>
    </>
  );
}
