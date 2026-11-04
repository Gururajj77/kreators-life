/**
 * Keeps the last two words of a short line together with a non-breaking space, so a heading, a card line or a caption that has to
 * wrap never leaves one word alone on its last line. For text the stylesheet cannot balance, such as a three-word title in a narrow
 * card. Lines of fewer than three words are left alone, and so is a tail too long to sit on one line (`max` characters; a narrower
 * place passes less, like a kanban card beside its Move button).
 */
export function tie(text: string, max = 28): string {
  const words = text.trim().split(/\s+/);
  if (words.length < 3) return text;
  const tail = words.slice(-2).join(' ');
  return tail.length > max ? text : `${words.slice(0, -2).join(' ')} ${tail}`;
}
