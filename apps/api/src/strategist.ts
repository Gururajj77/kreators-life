import Anthropic from '@anthropic-ai/sdk';
import { PIECE_META, type BrandPiece, type PieceKind, type ResearchItem } from '@kreators/shared';
import type { Env } from './env';

/**
 * The writer behind Content. Claude through the official SDK when ANTHROPIC_API_KEY is set; Workers AI
 * when only the AI binding exists; and without either, a digest that lays the research out in the shape
 * of the piece, labelled as such, so the app never hands back nothing.
 */
export type Writer = 'claude' | 'workers-ai' | 'none';
export const writerFor = (env: Env): Writer => (env.ANTHROPIC_API_KEY ? 'claude' : env.AI ? 'workers-ai' : 'none');

export interface Context {
  brand: { name: string; niche: string; description: string; voice: string };
  sources: { label: string; url: string; summary: string }[];
  runs: { kind: string; query: string; items: ResearchItem[] }[];
}

const n = (v: number | undefined) => (typeof v === 'number' && v > 0 ? v.toLocaleString() : '');

/** Everything the writer may lean on, bounded so a long run never blows the request up. */
export function digest(ctx: Context, maxChars = 60_000): string {
  const out: string[] = [];
  out.push(`# Brand: ${ctx.brand.name}`);
  if (ctx.brand.niche) out.push(`Niche: ${ctx.brand.niche}`);
  if (ctx.brand.description) out.push(`About: ${ctx.brand.description}`);
  if (ctx.brand.voice) out.push(`Voice: ${ctx.brand.voice}`);
  if (ctx.sources.length) {
    out.push('\n# Sources the owner gave');
    for (const s of ctx.sources) out.push(`- ${s.label || s.url} <${s.url}>${s.summary ? `: ${s.summary.slice(0, 400)}` : ''}`);
  }
  for (const r of ctx.runs) {
    out.push(`\n# Research: ${r.kind}${r.query ? ` "${r.query}"` : ''} (${r.items.length} items)`);
    r.items.forEach((it, i) => {
      const stats = Object.entries(it.stats)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k} ${n(v)}`)
        .join(', ');
      out.push(`\n## ${i + 1}. ${it.title || it.url}\n${[it.author, it.publishedAt, stats].filter(Boolean).join(' · ')}\n${it.url}\n${it.text.slice(0, 2500)}`);
    });
  }
  const text = out.join('\n');
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n\n[research cut here to fit]` : text;
}

const SYSTEM = `You are the content strategist inside kreators.app. You work for one brand at a time and you write for a creator or a small team that will post the work themselves.

How you work:
- Everything you say rests on the research digest you are given. When the digest shows numbers, use them. When it shows a pattern (a hook type, a format, a length) name it and point at the item it came from. When the digest is thin, say what is missing and what to research next, instead of inventing facts.
- Write in the brand's voice when one is given. Otherwise write plainly, like a sharp friend who makes videos for a living.
- Short sentences. Plain words a teenager can read. No hype, no filler, no emoji.
- Format with this small markdown only: "## " and "### " headings, "- " bullets, "1. " numbered steps, "> " for a callout, and **bold** for a lead-in. No tables, no links in brackets, no code blocks. Put a URL on its own line when you cite one.
- Hooks are the first line a viewer hears or reads. A hook earns its place by being specific, by promising something, or by breaking an expectation.
- Scripts are 30 to 60 seconds: hook (first three seconds), setup, payoff, call to action. Mark the beats with ### headings.
- Plans are concrete: days of the week, number of posts, platforms, what is measured and when.
- End every piece with "## What to research next": two or three runs that would make the next version sharper.`;

const ASK: Record<PieceKind, string> = {
  audit: 'Write a content strategy audit for this brand. Sections: "## Where the brand is now" (what its own sources show), "## What wins in this niche" (the hooks, formats, lengths and topics the research shows working, each tied to an item), "## Gaps" (what the brand does not do that the winners do), "## Ten moves, in order" (numbered, each one a sentence of what and a sentence of why).',
  plan: 'Write a marketing plan. Sections: "## Positioning" (one paragraph), "## Who it is for" (two or three people, described plainly), "## Three content pillars" (each with the research behind it), "## Channels and cadence" (platforms, posts a week, formats), "## The first 30 days", "## Days 31 to 60", "## Days 61 to 90", "## Numbers to watch" (five, with what good looks like), "## What it costs" (time and money, honestly).',
  calendar: 'Write a four-week content calendar. One "## Week N" heading per week, and under it a numbered list with one entry per post: the day, the platform, the format, the hook written out, and the call to action. Vary formats and pull hooks from the patterns in the research. Lead with the strongest idea each week.',
  ideas: 'Write fifteen video ideas as a numbered list. For each: a bold title, then the angle in one line, the hook written out, the format and length, and "Why it should work" pointing at the research item or pattern it leans on.',
  hooks: 'Write twenty hooks for the topic in the brief. Group them under "### " headings by type: Question, Contrarian, Number, Story, How-to, Warning. Under each hook, one line on why it works and which research item uses the pattern.',
  script: 'Write a short-form video script. If the brief names a research item to remix, keep its structure and change the substance to this brand. If the brief contains a draft, fix it and say in a "## What changed" section what you fixed and why. Otherwise write from scratch. Use "### Hook", "### Setup", "### Payoff", "### Call to action", then "## On screen" (text overlays and b-roll, as bullets) and "## Why this should work".',
  post: 'Write posts ready to publish for the platforms named in the brief (if none are named, write for Instagram, X and LinkedIn). One "## Platform" heading per platform, the post under it in full, then a "### Notes" bullet or two on timing and the first comment.',
  analysis: 'Take one video or post apart. Sections: "## The hook" (quote it, say what it promises), "## The structure" (the beats in order), "## The format and style" (length, pacing, visuals, tone), "## Why it worked" (tied to numbers if any), "## What to take" (three concrete things for this brand).',
};

async function withClaude(env: Env, kind: PieceKind, brief: string, ctx: Context): Promise<string> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const stream = client.beta.messages.stream({
    model: env.ANTHROPIC_MODEL || 'claude-opus-5-5',
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [
      { role: 'user', content: `${digest(ctx)}\n\n# The ask\n${ASK[kind]}\n\n# The brief from the owner\n${brief || '(none)'}` },
    ],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') throw new Error('The writer declined this one. Change the brief and try again.');
  return message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

async function withWorkersAi(ai: Ai, kind: PieceKind, brief: string, ctx: Context): Promise<string> {
  const res = (await ai.run('@cf/meta/llama-3.1-8b-instruct' as never, { messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: `${digest(ctx, 20_000)}\n\n# The ask\n${ASK[kind]}\n\n# The brief\n${brief || '(none)'}` }], max_tokens: 2048 } as never)) as { response?: string };
  return (res.response ?? '').trim();
}

/** No model: the research, laid out in the shape of the piece and honest about it. */
export function assemble(kind: PieceKind, brief: string, ctx: Context): string {
  const items = ctx.runs.flatMap((r) => r.items.map((it) => ({ ...it, run: r.kind })));
  const byViews = [...items].sort((a, b) => (b.stats.views ?? 0) - (a.stats.views ?? 0));
  const line = (it: ResearchItem) => `- **${it.title || it.url}**${it.author ? `, ${it.author}` : ''}${it.stats.views ? `, ${n(it.stats.views)} views` : ''}\n${it.url}`;
  const out: string[] = [];
  out.push(`> No writing model is connected, so this is the research laid out as a ${PIECE_META[kind].name.toLowerCase()}. Set ANTHROPIC_API_KEY to have it written.`);
  if (brief) out.push(`## The brief\n${brief}`);
  out.push(`## About ${ctx.brand.name}\n${[ctx.brand.niche && `Niche: ${ctx.brand.niche}`, ctx.brand.description, ctx.brand.voice && `Voice: ${ctx.brand.voice}`].filter(Boolean).join('\n') || 'Nothing written yet.'}`);
  if (ctx.sources.length) out.push(`## Sources\n${ctx.sources.map((s) => `- **${s.label || s.url}**${s.summary ? `: ${s.summary.slice(0, 300)}` : ''}\n${s.url}`).join('\n')}`);
  if (byViews.length) out.push(`## What the research found, most watched first\n${byViews.slice(0, 15).map(line).join('\n')}`);
  if (kind === 'hooks' || kind === 'ideas') out.push(`## Titles to learn from\n${byViews.slice(0, 20).map((it, i) => `${i + 1}. ${it.title}`).join('\n')}`);
  if (kind === 'analysis' && byViews[0]) out.push(`## The item to take apart\n${byViews[0].title}\n${byViews[0].url}\n\n${byViews[0].text.slice(0, 3000)}`);
  out.push('## What to research next\n- Read the brand\'s own channel so the writer knows the current voice.\n- Find outliers for two or three topics the brand could own.\n- Pull a transcript of the single most watched competitor video.');
  return out.join('\n\n');
}

/** Write one piece. Returns the text and who wrote it. */
export async function write(env: Env, kind: PieceKind, brief: string, ctx: Context): Promise<{ body: string; writer: string }> {
  const writer = writerFor(env);
  if (writer === 'claude') {
    const body = await withClaude(env, kind, brief, ctx);
    if (body) return { body, writer: 'claude' };
  }
  if (writer !== 'none' && env.AI) {
    try {
      const body = await withWorkersAi(env.AI, kind, brief, ctx);
      if (body) return { body, writer: 'workers-ai' };
    } catch {
      // fall through to the digest
    }
  }
  return { body: assemble(kind, brief, ctx), writer: 'digest' };
}

export const titleFor = (kind: PieceKind, brief: string, brandName: string): string => {
  const head = brief.split('\n')[0]?.trim().slice(0, 60) ?? '';
  return `${PIECE_META[kind].name}${head ? `: ${head}` : ` for ${brandName}`}`;
};

export type { BrandPiece };
