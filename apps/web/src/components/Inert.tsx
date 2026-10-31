import type { ReactNode } from 'react';

/**
 * Words people write to each other (posts, replies, chat lines, notes) never become links. A web address in them stays plain text:
 * no anchor, nothing to tap or click, and it is set apart so it reads as an address, not as something that will open.
 * The page also tells the phone not to turn phone numbers, emails or addresses into links (see index.html).
 */
const ADDRESS = /((?:https?:\/\/|ftp:\/\/|www\.)[^\s<>"']+|\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|in|org|net|io|app|co|me|ly|gg|tv|xyz|dev|link|page|site|online|info)\b(?:\/[^\s<>"']*)?)/gi;

export function Inert({ text }: { text: string }): ReactNode {
  const parts = text.split(ADDRESS);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} data-inert-link="" title="Links are not clickable here" className="break-all font-mono text-[0.92em]">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
