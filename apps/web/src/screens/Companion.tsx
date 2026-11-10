import { formatCount, type ChatMessage, type CompanionReply, type CompanionStatus } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { Button } from '../components/Button';
import { ChatComposer, ChatTurns, ChoiceChips, type ChatLine, type ChatVoice } from '../components/Chat';
import { errorText } from '../components/ErrorLine';
import { WorkingLine } from '../components/fx/WorkingLine';
import { Hero, HeroNumber } from '../components/Hero';
import { Markdown } from '../components/Markdown';
import { ModelPicker } from '../components/ModelPicker';
import { ModelReply, PlanCard } from '../components/ModelReply';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useCompanion, useMe } from '../lib/queries';
import { useAssistantModel } from '../lib/store';
import { RED_YES } from '../lib/ui';

const STARTERS = ['I feel tired today', 'I am stressed about work', 'What should I do next?', 'Today went well'];
const VOICE: ChatVoice = { name: 'Companion', icon: 'MessageCircleHeart' };
const THINKING = ['Reading your day', 'Thinking it over'] as const;

/** Why the built-in companion answered a line instead of the picked model. No plan is the normal free state, so it says nothing. */
type Fallback = 'credits' | 'day' | 'error';

/** Lines written by no model at all: the rules, the crisis line, and old lines from before models were recorded. */
const BUILT_IN_LINES = new Set(['', 'local', 'crisis']);

/** A Companion line: the answer of a model says which model wrote it; the rules and the crisis line say nothing more. */
function BotLine({ m, fallback }: { m: ChatMessage; fallback?: Fallback }) {
  const model = m.model ?? '';
  return (
    <div>
      {BUILT_IN_LINES.has(model) ? <Markdown text={m.body} className="text-prose" /> : <ModelReply text={m.body} model={model} />}
      {fallback === 'error' && <p className="m-0 mt-xs text-caption text-ink-soft">The model could not answer, so the built-in companion did.</p>}
      {(fallback === 'credits' || fallback === 'day') && (
        <div className="mt-xs grid gap-xs">
          <p className="m-0 text-caption text-ink-soft">{fallback === 'credits' ? 'Your credits ran out, so the built-in companion answered.' : "Today's limit is used, so the built-in companion answered."}</p>
          <PlanCard reason={fallback} />
        </div>
      )}
    </div>
  );
}

/**
 * The Companion, drawn as the assistant panel at full page width under the streak Hero: the same header with the
 * credits line, the same model picker (the same pick as the panel), model replies with "Answered by", the working
 * line while it thinks and a Stop square. With a plan the picked model answers through the one model layer on the server
 * and ledger; without one the built-in companion answers, free.
 */
export function Companion() {
  const q = useCompanion();
  const qc = useQueryClient();
  const streak = useMe().data?.user.streak ?? 0;
  const endRef = useRef<HTMLDivElement>(null);
  const lastTurn = useRef<HTMLElement>(null);
  const status = q.data;
  const account = status?.account;
  const canType = Boolean(status?.connected && account && account.plan !== 'none');
  const picked = useAssistantModel((m) => m.model);
  const setPicked = useAssistantModel((m) => m.setModel);
  const models = status?.models ?? [];
  const model = models.find((m) => m.id === picked) ?? models.find((m) => m.id === status?.model) ?? models[0] ?? null;

  const [pending, setPending] = useState<string | null>(null);
  const [since, setSince] = useState(0);
  const [stopping, setStopping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fallbacks, setFallbacks] = useState<Record<string, Fallback>>({});
  const run = useRef<string | null>(null);
  const running = pending !== null;

  const [asking, setAsking] = useState(false);
  const clear = useMutation({ mutationFn: api.clearCompanion, onSuccess: () => (setAsking(false), setFallbacks({}), q.refetch()) });
  const messages = status?.messages ?? [];

  const send = async (text: string) => {
    if (running) return;
    const runId = crypto.randomUUID();
    run.current = runId;
    setPending(text);
    setNotice(null);
    setStopping(false);
    setSince(Date.now());
    try {
      const r: CompanionReply = await api.say({ body: text, runId, context: { date: todayLocal(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }, ...(model ? { model: model.id } : {}) });
      const reply = r.messages[r.messages.length - 1];
      const why: Fallback | null = r.fallback === 'credits' || r.fallback === 'day' || r.fallback === 'error' ? r.fallback : r.stopped === 'credits' ? 'credits' : null;
      if (reply && why) setFallbacks((f) => ({ ...f, [reply.id]: why }));
      // The two new lines land at once, so the line you sent never blinks out while the list reloads.
      qc.setQueryData<CompanionStatus>(['companion'], (old) => (old ? { ...old, messages: [...old.messages, ...r.messages] } : old));
    } catch (e) {
      setNotice(`That did not go through. ${errorText(e)}`);
    } finally {
      setPending(null);
      setStopping(false);
      run.current = null;
      // The credits line and anything the plan screen shows follow what this message spent.
      void qc.invalidateQueries({ queryKey: ['companion'] });
      void qc.invalidateQueries({ queryKey: ['assistant'] });
      void qc.invalidateQueries({ queryKey: ['credits'] });
    }
  };

  /** Stop the reply on its way: the server ends before its next model call or read, and what it used is charged once. */
  const stop = () => {
    const id = run.current;
    if (!id || stopping) return;
    setStopping(true);
    void api.companionStop(id).catch(() => setStopping(false));
  };

  const log: ChatLine[] = [
    { id: 'hello', from: 'bot', text: messages.length ? 'Say anything.' : 'Say anything. Here are a few ways in.' },
    ...messages.map((m): ChatLine => (m.role === 'user' ? { id: m.id, from: 'you', text: m.body } : { id: m.id, from: 'bot', node: <BotLine m={m} fallback={fallbacks[m.id]} /> })),
  ];
  // What you sent shows as your line straight away, while the answer is on its way.
  if (pending !== null) log.push({ id: 'sending', from: 'you', text: pending });

  useEffect(() => {
    if (messages.length || running) endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, running]);

  const credits = !status ? '' : !status.connected ? 'Free' : !account || account.plan === 'none' ? 'Free: the built-in companion answers' : `${account.planName} · ${formatCount(account.total)} credits left`;
  const note = !canType ? 'Needs a plan. Until then the built-in companion answers, free.' : model?.private ? 'Keeps nothing you send, so it can see your mood and sleep.' : 'May keep what you type, so your mood, sleep and journal stay out.';

  return (
    <Screen assistant={false}>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-large-title">Companion</h1>
        <p className="mt-xs m-0 text-subhead text-ink-soft">Talk about your day. Not a therapist, and not for emergencies.</p>
        {/* Founder (2026-11-04): an app opens with a hero that says something about the person. Here, the streak the Companion knows about. */}
        <Hero color="var(--color-r6)" deep="var(--deep-guru)" className="mt-md" character="guru" mood={streak >= 7 ? 'excited' : streak > 0 ? 'happy' : 'sleepy'}>
          <p className="m-0 text-eyebrow uppercase opacity-90">Your streak</p>
          <HeroNumber value={streak} unit={streak === 1 ? 'day' : 'days'} label={streak === 0 ? 'Check in on Daily and it starts today.' : streak >= 7 ? 'A full week or more. Tell it how it feels.' : 'Keep it going. Tell it about today.'} />
        </Hero>
      </header>

      {/* The card of the assistant panel, as wide as the column: the page is the only thing that scrolls. */}
      <section aria-label="Companion chat" className="mt-md rounded-card border-2 border-line bg-card-strong">
        <div className="flex items-center gap-xs border-b-2 border-line py-xs pr-sm pl-md">
          <div className="min-w-0 flex-1 break-words">
            <p className="m-0 text-subhead font-semibold">Companion</p>
            <p className="m-0 text-caption text-ink-soft">{credits}</p>
          </div>
          {messages.length > 0 && (
            <button type="button" onClick={() => setAsking(true)} disabled={running} aria-label="Clear this conversation" title="Clear" className="toy toy-flat flex size-[44px] shrink-0 items-center justify-center rounded-pill text-ink-soft hover:text-r1 disabled:opacity-50">
              <AnimatedIcon name="trash" size={20} />
            </button>
          )}
        </div>
        {status?.connected && models.length > 1 && model && <ModelPicker models={models} model={model} onPick={setPicked} disabled={running || !canType} note={note} />}
        <div className="px-md">
          <ChatTurns
            log={log}
            typing={running ? VOICE : null}
            voice={VOICE}
            notice={notice}
            answer={messages.length === 0 && !running ? <ChoiceChips choices={STARTERS.map((s) => ({ value: s, label: s }))} onPick={(c) => void send(c.value)} /> : null}
            room="0px"
            lastTurn={lastTurn}
            typingStatus={running ? <WorkingLine key={since} label={stopping ? 'Companion is stopping' : 'Companion is thinking'} phrases={stopping ? ['Stopping after this step'] : THINKING} since={since || undefined} /> : undefined}
          />
        </div>
        <div className="border-t-2 border-line p-xs">
          <ChatComposer placeholder="Say what is on your mind" onSend={(t) => void send(t)} onStop={running ? stop : undefined} stopping={stopping} disabled={running} maxLength={2000} />
        </div>
        <div ref={endRef} />
      </section>

      <Sheet open={asking} onClose={() => setAsking(false)} title="Clear this conversation?">
        <div className="grid gap-md pb-xl">
          <p className="m-0 text-callout text-ink-soft">Every line here is gone for good. This cannot be undone.</p>
          {clear.isError && <p className="m-0 text-subhead text-r1">That did not work. Try again.</p>}
          <div className="flex flex-wrap gap-xs">
            <button
              type="button"
              disabled={clear.isPending}
              onClick={() => clear.mutate()}
              className={RED_YES}
            >
              Yes, clear it
            </button>
            <Button variant="outline" onClick={() => setAsking(false)}>
              Keep it
            </Button>
          </div>
        </div>
      </Sheet>
    </Screen>
  );
}
