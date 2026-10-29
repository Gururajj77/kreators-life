import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Button } from '../components/Button';
import { ChatComposer, ChatTurns, ChoiceChips, type ChatLine, type ChatVoice } from '../components/Chat';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useCompanion } from '../lib/queries';

const STARTERS = ['I feel tired today', 'I am stressed about work', 'What should I do next?', 'Today went well'];
const VOICE: ChatVoice = { name: 'Companion', emoji: '💬' };

/** The Companion, drawn like the other chats: its lines as plain text under its name, yours as bubbles. */
export function Companion() {
  const q = useCompanion();
  const endRef = useRef<HTMLDivElement>(null);
  const lastTurn = useRef<HTMLElement>(null);
  const send = useMutation({ mutationFn: (body: string) => api.say(body), onSuccess: () => q.refetch() });
  const clear = useMutation({ mutationFn: api.clearCompanion, onSuccess: () => q.refetch() });
  const messages = q.data?.messages ?? [];
  const log: ChatLine[] = [
    { id: 'hello', from: 'bot', text: messages.length ? 'Say anything.' : 'Say anything. Here are a few ways in.' },
    ...messages.map((m): ChatLine => ({ id: m.id, from: m.role === 'user' ? 'you' : 'bot', text: m.body })),
  ];
  // What you sent shows as your line straight away, while the answer is on its way.
  if (send.isPending && send.variables) log.push({ id: 'sending', from: 'you', text: send.variables });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, send.isPending]);

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <div className="flex items-center justify-between gap-sm">
          <h1 className="text-[30px]">Companion</h1>
          {messages.length > 0 && (
            <Button variant="ghost" onClick={() => window.confirm('Clear this conversation?') && clear.mutate()}>
              Clear
            </Button>
          )}
        </div>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          It knows your pillars, your streak and what you logged today. {q.data?.model === 'local' ? 'Running without a language model, so it reflects and asks rather than chats.' : 'Not a therapist. In a crisis, call your local emergency number.'}
        </p>
      </header>

      <div role="log" aria-live="polite">
        <ChatTurns log={log} typing={send.isPending ? VOICE : null} voice={VOICE} answer={messages.length === 0 && !send.isPending ? <ChoiceChips choices={STARTERS.map((s) => ({ value: s, label: s }))} onPick={(c) => send.mutate(c.value)} /> : null} room="0px" lastTurn={lastTurn} />
        <div ref={endRef} />
      </div>

      <ChatComposer placeholder="Type to start chatting" onSend={(t) => send.mutate(t)} disabled={send.isPending} maxLength={2000} className="mt-sm" />
    </Screen>
  );
}
