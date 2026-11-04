import { ASSISTANT_MODEL_BY_ID, formatCount, messagesFor, money, PLAN_CURRENCY, PLANS, type AssistantPaywall } from '@kreators/shared';
import { ArrowRight, WandSparkles } from 'lucide-react';
import { Link } from 'react-router';
import { Icon } from './Icon';
import { Markdown } from './Markdown';

/**
 * The parts a model's answer is drawn with, shared by the assistant panel and the Companion: the reply with "Answered
 * by", and the plan card. They live outside the panel's chunk so the Companion screen does not pull the panel in.
 */

export const PAYWALL: Record<AssistantPaywall, { title: string; line: string }> = {
  plan: {
    title: 'Typing is part of a plan',
    line: `Pro is ${money(PLANS.pro.priceCents, PLAN_CURRENCY)} a month for ${formatCount(PLANS.pro.credits)} credits, about ${formatCount(messagesFor(PLANS.pro.credits))} messages. The flows stay free.`,
  },
  credits: { title: 'Out of credits', line: 'Top up, or wait for your plan to start again. The flows stay free.' },
  day: { title: "Today's limit is used", line: 'It frees up over the next 24 hours, and a bigger plan has more room. The flows stay free.' },
};

/** Who wrote a line, in words: a listed model's name, the built-in model, or the id as it came. */
export function answeredBy(model: string): string {
  if (model === 'workers-ai') return 'the built-in model';
  return ASSISTANT_MODEL_BY_ID[model]?.name ?? model;
}

/** A reply from the model: its small markdown, and which model wrote it, so it is never mistaken for a built-in line. */
export function ModelReply({ text, model }: { text: string; model: string }) {
  return (
    <div>
      <Markdown text={text} className="text-[16px] font-semibold leading-relaxed" />
      <p className="m-0 mt-xs text-[12px] font-bold text-ink-mute">Answered by {answeredBy(model)}</p>
    </div>
  );
}

export function PlanCard({ reason }: { reason: AssistantPaywall }) {
  const p = PAYWALL[reason];
  return (
    <Link to="/plans" className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm text-ink shadow-toy-soft">
      <Icon icon={WandSparkles} size={22} />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold">{p.title}</span>
        <span className="block text-[12px] font-semibold text-ink-soft">{p.line}</span>
      </span>
      <Icon icon={ArrowRight} size={18} />
    </Link>
  );
}
