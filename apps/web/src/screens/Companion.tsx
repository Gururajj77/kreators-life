import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useCompanion } from '../lib/queries';

const STARTERS = ['I feel tired today', 'I am stressed about work', 'What should I do next?', 'Today went well'];

export function Companion() {
  const q = useCompanion();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const send = useMutation({
    mutationFn: (body: string) => api.say(body),
    onSuccess: () => {
      setText('');
      q.refetch();
    },
  });
  const clear = useMutation({ mutationFn: api.clearCompanion, onSuccess: () => q.refetch() });
  const messages = q.data?.messages ?? [];

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

      <div className="mt-md flex flex-col gap-xs" role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="rounded-card bg-card p-md shadow-toy-soft">
            <p className="m-0 text-[16px] font-bold">Say anything. A few ways in:</p>
            <div className="mt-sm flex flex-wrap gap-xs">
              {STARTERS.map((s) => (
                <button key={s} type="button" onClick={() => send.mutate(s)} className="toy toy-soft rounded-pill bg-paper px-sm py-xs text-[14px] font-bold">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-card p-sm text-[16px] font-semibold leading-relaxed ${m.role === 'user' ? 'self-end rounded-br-[8px] bg-ink text-on-ink' : 'self-start rounded-bl-[8px] bg-card shadow-toy-soft'}`}>
            {m.body}
          </div>
        ))}
        {send.isPending && <div className="self-start rounded-card rounded-bl-[8px] bg-card p-sm text-[16px] font-semibold text-ink-soft shadow-toy-soft">Thinking</div>}
        <div ref={endRef} />
      </div>

      <form
        className="mt-md flex gap-xs"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send.mutate(text.trim());
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Type to start chatting" aria-label="Message" className="min-w-0 flex-1 rounded-pill border-2 border-line bg-card px-md py-sm text-[16px]" />
        <Button type="submit" disabled={send.isPending || !text.trim()}>
          Send
        </Button>
      </form>
    </Screen>
  );
}
