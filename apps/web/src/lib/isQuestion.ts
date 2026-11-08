/** True when a line someone typed reads as a question rather than an answer. Apart from explain.ts, so the setup chat can ask it in the first download and fetch the answers only when someone asks. */
export function isQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  return t.endsWith('?') || /^(what|whats|what's|how|why|who|where|when|which|can|could|is|are|do|does|should|tell me|explain|meaning)\b/.test(t);
}
