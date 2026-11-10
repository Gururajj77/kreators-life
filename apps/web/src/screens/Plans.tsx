import { AGENT_LIMITS, AGENT_META, AGENTS, formatCount, messagesFor, money, PAID_PLANS, PLAN_CURRENCY, PLAN_DAYS, PLANS, type AgentLimit, type CreditEntry, type CreditReason, type DiscountCheck } from '@kreators/shared';
import { useState } from 'react';
import { Button } from '../components/Button';
import { AreaLine, StatTile } from '../components/Charts';
import { DiscountField } from '../components/DiscountField';
import { PageHeader } from '../components/PageHeader';
import { Pager, usePage } from '../components/Pager';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { api } from '../lib/api';
import { prettyDate, shortDay } from '../lib/date';
import { useAuthed } from '../lib/queries';
import { Icon } from '../components/Icon';
import { Check } from 'lucide-react';

/**
 * Plans and credits: what typing to the assistant runs on. Numbers first (what is left, the plan, today, the last
 * thirty days, and a line of use per day), then the limits each plan sets per agent, then the plans and top-ups,
 * then every move of credits. Plans and top-ups can be picked, but until payments are live nothing is charged and
 * the team switches plans on.
 */

const n = (v: number) => formatCount(v);
const REASON: Record<CreditReason, string> = { plan: 'Plan credits', topup: 'Top-up', admin: 'From the team', usage: 'Used', expire: 'Ran out with the plan' };
const LIMIT_ROWS: { key: keyof AgentLimit; label: string; say: (v: number) => string }[] = [
  { key: 'contextTokens', label: 'Reads per message', say: (v) => `${n(v)} tokens` },
  { key: 'perMessage', label: 'Most one message spends', say: (v) => `${n(v)} credits` },
  { key: 'perDay', label: 'Most in a day', say: (v) => `${n(v)} credits` },
  { key: 'steps', label: 'Steps per message', say: (v) => String(v) },
];

function EntryRow({ e }: { e: CreditEntry }) {
  return (
    <li className="flex items-center gap-sm rounded-tile bg-card px-sm py-xs shadow-toy-soft">
      <span className="min-w-0 flex-1">
        <span className="block text-subhead">
          {REASON[e.reason]}
          {e.agent ? ` by the ${AGENT_META[e.agent].name.toLowerCase()}` : ''}
        </span>
        <span className="block text-caption text-ink-soft">
          {prettyDate(e.createdAt)}
          {e.note ? ` · ${e.note}` : ''}
          {e.tokens ? ` · ${n(e.tokens.input)} tokens in, ${n(e.tokens.output)} out` : ''}
        </span>
      </span>
      <span className="shrink-0 text-title3 type-figure">
        {e.amount > 0 ? '+' : ''}
        {n(e.amount)}
      </span>
    </li>
  );
}

export function Plans() {
  const q = useAuthed(['credits'], api.credits);
  const pg = usePage('use');
  const ledger = useAuthed(['credits', 'ledger', pg.query], () => api.creditLedger(pg.query));
  // What the checkout said, under the button that asked. Until payments are live it says nothing was charged.
  const [said, setSaid] = useState<Record<string, string>>({});
  const [asking, setAsking] = useState<string | null>(null);
  // A team discount code applied to one plan or top-up. The server prices it again at checkout.
  const [applied, setApplied] = useState<Record<string, DiscountCheck | null>>({});
  const choose = async (kind: 'plan' | 'topup', key: string) => {
    const id = `${kind}:${key}`;
    setAsking(id);
    try {
      await api.creditCheckout(kind, key, applied[id]?.code);
      setSaid((s) => ({ ...s, [id]: 'Done.' }));
    } catch (e) {
      setSaid((s) => ({ ...s, [id]: e instanceof Error ? e.message : 'That did not go through. Nothing was charged. Try again.' }));
    } finally {
      setAsking(null);
    }
  };

  const d = q.data;
  const a = d?.account;
  const used30 = d ? d.usage.reduce((sum, u) => sum + u.credits, 0) : 0;

  return (
    <Screen>
      <PageHeader back={{ to: '/you', label: 'Profile' }} title="Plans and credits" lede="Typing to the assistant runs on credits. Its flows stay free for everyone." />

      {q.isPending && (
        <p className="mt-md text-subhead text-ink-soft" role="status">
          Adding up your credits
        </p>
      )}
      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft flex flex-wrap-reverse items-center justify-between gap-sm" role="alert">
          <p className="m-0 font-semibold min-w-0 flex-1 basis-[60%]">Could not load your credits.</p>
          <Button variant="outline" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {d && a && (
        <>
          <div className="mt-md grid grid-cols-2 gap-xs lg:grid-cols-4">
            <StatTile label="Credits left" value={n(a.total)} hint={`About ${n(messagesFor(a.total))} messages`} />
            <StatTile label="Plan" value={a.planName} hint={a.planUntil ? `Until ${prettyDate(a.planUntil)}` : 'Typing needs one'} />
            <StatTile label="Used today" value={n(a.usedToday.assistant)} hint={a.limits ? `Of ${n(a.limits.assistant.perDay)} a day` : 'No plan yet'} />
            <StatTile label="Last 30 days" value={n(used30)} hint="Credits used" />
          </div>
          <p className="mt-sm m-0 text-caption text-ink-soft">
            {a.plan === 'none'
              ? `${n(a.extraCredits)} extra credits wait for a plan. A typical message is about 12 credits.`
              : `${n(a.planCredits)} from ${a.planName}, used first and gone when the plan ends. ${n(a.extraCredits)} extra, kept until used.`}
          </p>

          <Section id="plans-use" title="Credits used" lede="Each day over the last thirty days.">
            <div className="rounded-card bg-card p-sm shadow-toy-soft">
              <AreaLine
                values={d.usage.map((u) => u.credits)}
                max={Math.max(50, ...d.usage.map((u) => u.credits))}
                labels={d.usage.map((u) => shortDay(u.date))}
                color="var(--color-r1)"
                height={140}
                empty="No credits used yet"
                label={`Credits used per day for the last thirty days, ${n(used30)} in all`}
              />
            </div>
          </Section>

          <Section id="plans-limits" title="Limits by plan" lede="What each agent may read and spend. Your plan's column is marked.">
            {/* One card per agent, 12px apart (they touched), and the same columns in each, so a plan's numbers line up from card to card. */}
            <div className="flex flex-col gap-sm">
            {AGENTS.map((agent) => (
              <div key={agent} className="overflow-x-auto rounded-card bg-card p-sm shadow-toy-soft">
                <table className="w-full table-fixed border-collapse text-left text-subhead">
                  <caption className="pb-xs text-left text-subhead font-semibold">{AGENT_META[agent].name}</caption>
                  <colgroup>
                    <col className="w-[34%]" />
                    {PAID_PLANS.map((k) => (
                      <col key={k} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col" className="py-xs pr-sm text-eyebrow uppercase text-ink-soft">
                        Limit
                      </th>
                      {PAID_PLANS.map((k) => (
                        <th key={k} scope="col" className={`py-xs pr-sm text-eyebrow uppercase ${a.plan === k ? 'text-ink' : 'text-ink-soft'}`}>
                          <span className="inline-flex flex-wrap items-center gap-xs">
                            {PLANS[k].name}
                            {a.plan === k && <Icon icon={Check} size={14} strokeWidth={3} label="your plan" />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {LIMIT_ROWS.map((row) => (
                      <tr key={row.key} className="border-t border-line">
                        <th scope="row" className="py-xs pr-sm font-semibold">
                          {row.label}
                        </th>
                        {PAID_PLANS.map((k) => (
                          <td key={k} className={`py-xs pr-sm ${a.plan === k ? 'font-bold' : 'text-ink-soft'}`}>
                            {row.say(AGENT_LIMITS[k][agent][row.key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            </div>
          </Section>

          <Section id="plans-pick" title="Plans" lede={`Each gives a fixed worth of model use for ${PLAN_DAYS} days. What is left at the end does not carry over.`}>
            {/* Three from the `xl` width: at 1024 a card holds 198px, and "₹49,999 a month" needs 200. */}
            <ul className="m-0 grid list-none grid-cols-1 gap-sm p-0 xl:grid-cols-3">
              {d.plans.map((p) => {
                const mine = a.plan === p.key;
                const id = `plan:${p.key}`;
                return (
                  <li key={p.key} className={`flex flex-col rounded-card bg-card p-md shadow-toy-soft ${mine ? 'border-2 border-ink' : 'border-2 border-transparent'}`}>
                    <p className="m-0 text-eyebrow uppercase text-ink-soft">{p.name}</p>
                    <p className="mt-xs m-0 text-large-title type-figure leading-none">
                      {applied[id] && applied[id]!.offCents > 0 && <s className="mr-xs text-headline text-ink-soft">{money(p.priceCents, PLAN_CURRENCY)}</s>}
                      {money(applied[id] ? applied[id]!.payCents : p.priceCents, PLAN_CURRENCY)}
                      <span className="text-subhead text-ink-soft"> a month</span>
                    </p>
                    <p className="mt-sm m-0 text-subhead font-semibold">
                      {n(p.credits)} credits, about {n(messagesFor(p.credits))} messages
                    </p>
                    {/* The blurb says the same credits and messages as the line above, so the card says the period instead. */}
                    <p className="mt-xs m-0 flex-1 text-subhead text-ink-soft">For {PLAN_DAYS} days. Credits left at the end do not carry over.</p>
                    {mine ? (
                      <p className="mt-sm m-0 text-subhead font-semibold">Your plan</p>
                    ) : (
                      <Button variant="outline" className="mt-sm" disabled={asking === id} onClick={() => void choose('plan', p.key)}>
                        Choose {p.name}
                      </Button>
                    )}
                    {!mine && <DiscountField className="mt-xs" area="plan" itemId={p.key} value={applied[id]?.code ?? ''} check={applied[id] ?? null} onChange={(_c, check) => setApplied((a2) => ({ ...a2, [id]: check }))} />}
                    {said[id] && (
                      <p role="status" className="mt-xs m-0 text-caption text-ink-soft">
                        {said[id]}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section id="plans-topup" title="Top up" lede="Extra credits on top of a plan. They are used after the plan's own, and stay until you use them.">
            <ul className="m-0 grid list-none grid-cols-1 gap-sm p-0 lg:grid-cols-3">
              {d.topUps.map((t) => {
                const id = `topup:${t.key}`;
                return (
                  <li key={t.key} className="flex flex-col rounded-card bg-card p-md shadow-toy-soft">
                    <p className="m-0 text-title2 type-figure leading-none">{n(t.credits)} credits</p>
                    {/* flex-1: the words take the room, so Top up sits level on all three cards however the line wraps. */}
                    <p className="mt-xs m-0 flex-1 text-subhead text-ink-soft">
                      About {n(messagesFor(t.credits))} messages, for {applied[id] && applied[id]!.offCents > 0 && <s>{money(t.priceCents, PLAN_CURRENCY)}</s>} {money(applied[id] ? applied[id]!.payCents : t.priceCents, PLAN_CURRENCY)}
                    </p>
                    <Button variant="outline" className="mt-sm" disabled={asking === id} onClick={() => void choose('topup', t.key)}>
                      Top up
                    </Button>
                    <DiscountField className="mt-xs" area="topup" itemId={t.key} value={applied[id]?.code ?? ''} check={applied[id] ?? null} onChange={(_c, check) => setApplied((a2) => ({ ...a2, [id]: check }))} />
                    {said[id] && (
                      <p role="status" className="mt-xs m-0 text-caption text-ink-soft">
                        {said[id]}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            {!d.paymentsLive && <p className="mt-sm m-0 text-caption text-ink-soft">Payments are not live yet, so picking a plan or a top-up charges nothing. Until they are, the team can switch a plan on for you.</p>}
          </Section>

          <Section id="plans-history" title="History" lede="Every credit in and out, newest first.">
            {ledger.data && ledger.data.entries.length === 0 && <p className="m-0 text-subhead text-ink-soft">Nothing yet. When a plan starts or you type to the assistant, each move is listed here.</p>}
            {ledger.data && ledger.data.entries.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-xs p-0">
                {ledger.data.entries.map((e) => (
                  <EntryRow key={e.id} e={e} />
                ))}
              </ul>
            )}
            <Pager page={ledger.data?.page} prefix="use" label="entries" />
          </Section>
        </>
      )}
    </Screen>
  );
}
