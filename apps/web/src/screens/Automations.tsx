import type { DmAutomation, Funnel, FunnelStep, FunnelStepKind, Sequence } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { Toggle } from '../components/Toggle';
import { api } from '../lib/api';
import { useAuthed, useStudio } from '../lib/queries';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const chip = (on: boolean) => `min-h-[44px] rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`;
const err = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

const STEP_KINDS: { kind: FunnelStepKind; name: string }[] = [
  { kind: 'content', name: 'Post' },
  { kind: 'automation', name: 'Auto-DM' },
  { kind: 'link', name: 'Link click' },
  { kind: 'lead', name: 'Lead' },
  { kind: 'product', name: 'Sale' },
  { kind: 'broadcast', name: 'Broadcast' },
];

export function Automations() {
  const autos = useAuthed(['automations'], api.automations);
  const funnels = useAuthed(['funnels'], api.funnels);
  const sequences = useAuthed(['sequences'], api.sequences);
  const content = useAuthed(['content', 'revenue'], () => api.content('revenue'));
  const links = useAuthed(['links'], api.links);
  const studio = useStudio();
  const audience = useAuthed(['audience'], api.audience);
  const [newAuto, setNewAuto] = useState(false);
  const [newFunnel, setNewFunnel] = useState(false);
  const [newSeq, setNewSeq] = useState(false);
  const products = studio.data?.products ?? [];
  const items = content.data?.items ?? [];

  return (
    <Screen>
      <header className="pt-lg">
        <Link to="/shop" className="inline-flex min-h-[44px] items-center gap-xs font-bold text-ink-soft">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Shop
        </Link>
        <h1 className="text-[30px]">Auto-DM</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Someone comments a keyword, they get your link in a DM. Funnels show where people drop off. Sequences follow up after a purchase.</p>
      </header>

      {autos.data && !autos.data.metaConnected && (
        <p className="mt-md m-0 rounded-tile p-sm text-[14px] font-bold text-ink-fixed" style={{ background: 'var(--tint-yellow)' }}>
          Meta is not connected on this server, so matched comments are queued here for you to send by hand.
        </p>
      )}

      <section className="mt-lg" aria-labelledby="auto-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="auto-heading" className="text-[24px]">
            Automations
          </h2>
          <Button onClick={() => setNewAuto(true)}>New automation</Button>
        </div>
        {autos.data && autos.data.automations.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">None yet. Pick a keyword like GUIDE and the message to send.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {autos.data?.automations.map((a) => (
            <AutomationCard key={a.id} a={a} onChange={() => void autos.refetch()} />
          ))}
        </ul>
        {autos.data && autos.data.sends.length > 0 && (
          <div className="mt-md">
            <h3 className="text-[18px]">Recent matches</h3>
            <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
              {autos.data.sends.map((s) => (
                <li key={s.id} className="rounded-tile bg-card p-sm text-[14px] font-semibold shadow-toy-soft">
                  <span className="font-bold">{s.recipientHandle || 'someone'}</span>, {s.status}
                  {s.error ? `: ${s.error}` : ''}, {new Date(s.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-lg" aria-labelledby="funnel-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="funnel-heading" className="text-[24px]">
            Funnels
          </h2>
          <Button onClick={() => setNewFunnel(true)}>New funnel</Button>
        </div>
        {funnels.data && funnels.data.funnels.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Chain a post, an Auto-DM, a link, a lead and a sale to see the drop-off at every step.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {funnels.data?.funnels.map((f) => (
            <FunnelCard key={f.id} f={f} onChange={() => void funnels.refetch()} />
          ))}
        </ul>
      </section>

      <section className="mt-lg" aria-labelledby="seq-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="seq-heading" className="text-[24px]">
            Sequences
          </h2>
          <Button onClick={() => setNewSeq(true)}>New message</Button>
        </div>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Messages buyers get in their Inbox some days after a purchase.</p>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {sequences.data?.sequences.map((s) => (
            <SequenceCard key={s.id} s={s} onChange={() => void sequences.refetch()} />
          ))}
        </ul>
      </section>

      <NewAutomationSheet
        open={newAuto}
        onClose={() => setNewAuto(false)}
        products={products}
        items={items.map((i) => ({ id: i.id, label: i.caption || i.url }))}
        onDone={() => {
          setNewAuto(false);
          void Promise.all([autos.refetch(), links.refetch()]);
        }}
      />
      <NewFunnelSheet
        open={newFunnel}
        onClose={() => setNewFunnel(false)}
        options={{
          content: items.map((i) => ({ id: i.id, label: i.caption || i.url })),
          automation: (autos.data?.automations ?? []).map((a) => ({ id: a.id, label: `${a.keywords.join(', ')} (${a.linkCode})` })),
          link: (links.data?.links ?? []).map((l) => ({ id: l.id, label: l.label || l.code })),
          lead: [{ id: 'all', label: 'Leads from your page and lead magnets' }],
          product: products.map((p) => ({ id: p.id, label: p.title })),
          broadcast: (audience.data?.broadcasts ?? []).map((b) => ({ id: b.id, label: b.title })),
        }}
        onDone={() => {
          setNewFunnel(false);
          void funnels.refetch();
        }}
      />
      <NewSequenceSheet
        open={newSeq}
        onClose={() => setNewSeq(false)}
        products={products}
        onDone={() => {
          setNewSeq(false);
          void sequences.refetch();
        }}
      />
    </Screen>
  );
}

function AutomationCard({ a, onChange }: { a: DmAutomation; onChange: () => void }) {
  const [comment, setComment] = useState('');
  const toggle = useMutation({ mutationFn: (active: boolean) => api.setAutomation(a.id, active), onSuccess: onChange });
  const remove = useMutation({ mutationFn: () => api.deleteAutomation(a.id), onSuccess: onChange });
  const test = useMutation({ mutationFn: () => api.simulateComment(a.id, { comment }), onSuccess: onChange });
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-[16px] font-bold">Keywords: {a.keywords.join(', ')}</p>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
        {a.contentCaption ? `On "${a.contentCaption}"` : 'On every post'}. Sends {a.productTitle ? `the link to ${a.productTitle}` : 'your page link'} as /go/{a.linkCode}.
      </p>
      <p className="mt-xs m-0 whitespace-pre-wrap rounded-tile bg-paper p-sm text-[14px] font-semibold">{a.dmMessage}</p>
      {a.publicReplies.length > 0 && <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">Public replies: {a.publicReplies.join(' / ')}</p>}
      <dl className="mt-sm grid grid-cols-4 gap-xs m-0 text-[14px]">
        {(
          [
            ['matched', a.matched],
            ['sent', a.sent],
            ['queued', a.queued],
            ['failed', a.failed],
            ['clicks', a.clicks],
            ['sales', a.sales],
            ['points', a.revenuePoints],
          ] as [string, number][]
        ).map(([k, v]) => (
          <div key={k} className="rounded-tile bg-paper p-xs">
            <dt className="text-[12px] font-bold text-ink-soft">{k}</dt>
            <dd className="m-0 font-display text-[16px] font-extrabold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-sm">
        <Toggle on={a.active} onChange={(on) => toggle.mutate(on)} label={a.active ? 'Active' : 'Paused'} />
      </div>
      <form
        className="mt-sm flex items-end gap-xs"
        onSubmit={(e) => {
          e.preventDefault();
          if (comment.trim()) test.mutate();
        }}
      >
        <label className="block min-w-0 flex-1">
          <span className="block text-[12px] font-bold">Test with a comment</span>
          <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} placeholder="Type what a viewer might comment" className={field} />
        </label>
        <Button type="submit" variant="outline" disabled={test.isPending || !comment.trim()}>
          Test
        </Button>
      </form>
      {test.isSuccess && <p className="mt-xs m-0 text-[14px] font-bold">{test.data.matched > 0 ? `Matched. A DM was ${a.active ? 'queued' : 'not sent because the automation is paused'}.` : 'No keyword in that comment.'}</p>}
      {(toggle.isError || remove.isError || test.isError) && (
        <p role="alert" className="mt-xs m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          {err(toggle.error ?? remove.error ?? test.error, 'That did not work.')}
        </p>
      )}
      <Button variant="ghost" className="mt-xs" disabled={remove.isPending} onClick={() => window.confirm('Remove this automation?') && remove.mutate()}>
        Remove
      </Button>
    </li>
  );
}

function FunnelCard({ f, onChange }: { f: Funnel; onChange: () => void }) {
  const remove = useMutation({ mutationFn: () => api.deleteFunnel(f.id), onSuccess: onChange });
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-[16px] font-bold">{f.name}</p>
      <ol className="mt-sm flex list-none gap-xs overflow-x-auto p-0 m-0 pb-xs scrollbar-none">
        {f.steps.map((s, i) => {
          const prev = i > 0 ? (f.steps[i - 1]?.count ?? 0) : null;
          const here = s.count ?? 0;
          const drop = prev && prev > 0 ? Math.round(((prev - here) / prev) * 100) : null;
          return (
            <li key={`${s.kind}-${s.ref}-${i}`} className="flex shrink-0 items-center gap-xs">
              {i > 0 && (
                <span className="text-[12px] font-bold text-ink-mute" aria-label={drop === null ? 'next step' : `${drop} percent drop off`}>
                  {drop === null ? '→' : `−${Math.max(0, drop)}% →`}
                </span>
              )}
              <div className="min-w-[96px] rounded-tile bg-paper p-xs">
                <p className="m-0 text-[12px] font-bold text-ink-soft">{STEP_KINDS.find((k) => k.kind === s.kind)?.name ?? s.kind}</p>
                <p className="m-0 font-display text-[20px] font-extrabold leading-none">{here}</p>
                <p className="m-0 truncate text-[12px] font-semibold text-ink-soft">{s.label}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <Button variant="ghost" className="mt-xs" disabled={remove.isPending} onClick={() => window.confirm('Remove this funnel?') && remove.mutate()}>
        Remove
      </Button>
    </li>
  );
}

function SequenceCard({ s, onChange }: { s: Sequence; onChange: () => void }) {
  const toggle = useMutation({ mutationFn: (active: boolean) => api.setSequence(s.id, active), onSuccess: onChange });
  const remove = useMutation({ mutationFn: () => api.deleteSequence(s.id), onSuccess: onChange });
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-[16px] font-bold">{s.title}</p>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
        {s.productTitle ?? 'Every product'}, {s.delayDays} {s.delayDays === 1 ? 'day' : 'days'} after purchase, sent {s.sent} {s.sent === 1 ? 'time' : 'times'}.
      </p>
      <p className="mt-xs m-0 whitespace-pre-wrap text-[14px] font-semibold">{s.body}</p>
      <div className="mt-sm">
        <Toggle on={s.active} onChange={(on) => toggle.mutate(on)} label={s.active ? 'Active' : 'Paused'} />
      </div>
      <Button variant="ghost" className="mt-xs" disabled={remove.isPending} onClick={() => window.confirm('Remove this message?') && remove.mutate()}>
        Remove
      </Button>
    </li>
  );
}

function NewAutomationSheet({ open, onClose, products, items, onDone }: { open: boolean; onClose: () => void; products: { id: string; title: string }[]; items: { id: string; label: string }[]; onDone: () => void }) {
  const [contentItemId, setContentItemId] = useState('');
  const [keywords, setKeywords] = useState('');
  const [dmMessage, setDmMessage] = useState('');
  const [replies, setReplies] = useState('');
  const [productId, setProductId] = useState('');
  const create = useMutation({
    mutationFn: () =>
      api.createAutomation({
        contentItemId: contentItemId || null,
        keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
        dmMessage,
        publicReplies: replies.split('\n').map((r) => r.trim()).filter(Boolean).slice(0, 5),
        productId: productId || null,
      }),
    onSuccess: () => {
      setKeywords('');
      setDmMessage('');
      setReplies('');
      onDone();
    },
  });
  const ready = keywords.trim() && dmMessage.trim();
  return (
    <Sheet open={open} onClose={onClose} title="New automation">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) create.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Post</span>
          <select value={contentItemId} onChange={(e) => setContentItemId(e.target.value)} className={field}>
            <option value="">Every post</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Keywords, comma separated</span>
          <input autoFocus value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="guide, link" required className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Message to send</span>
          <textarea value={dmMessage} onChange={(e) => setDmMessage(e.target.value)} rows={4} maxLength={900} required className={field} />
          <span className="mt-xs block text-[12px] font-bold text-ink-soft">The tracked link is added at the end.</span>
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Public replies, one per line, up to five</span>
          <textarea value={replies} onChange={(e) => setReplies(e.target.value)} rows={3} placeholder="Sent you a DM!" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">The link opens</span>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={field}>
            <option value="">Your page</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        {create.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {err(create.error, 'Could not create it.')}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={create.isPending || !ready}>
          Create automation
        </Button>
      </form>
    </Sheet>
  );
}

type Options = Record<FunnelStepKind, { id: string; label: string }[]>;

function NewFunnelSheet({ open, onClose, options, onDone }: { open: boolean; onClose: () => void; options: Options; onDone: () => void }) {
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<FunnelStep[]>([
    { kind: 'content', ref: '', label: '' },
    { kind: 'product', ref: '', label: '' },
  ]);
  const create = useMutation({
    mutationFn: () => api.createFunnel({ name, steps }),
    onSuccess: () => {
      setName('');
      setSteps([
        { kind: 'content', ref: '', label: '' },
        { kind: 'product', ref: '', label: '' },
      ]);
      onDone();
    },
  });
  const setStep = (i: number, patch: Partial<FunnelStep>) => setSteps((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const pick = (i: number, kind: FunnelStepKind) => {
    const first = options[kind][0];
    setStep(i, { kind, ref: first?.id ?? '', label: first?.label ?? '' });
  };
  const ready = name.trim() && steps.length >= 2 && steps.every((s) => s.ref);
  return (
    <Sheet open={open} onClose={onClose} title="New funnel">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) create.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className={field} placeholder="Reel to resume template" />
        </label>
        <ol className="flex list-none flex-col gap-sm p-0 m-0">
          {steps.map((s, i) => (
            <li key={i} className="rounded-tile bg-paper p-sm">
              <p className="m-0 text-[14px] font-bold">Step {i + 1}</p>
              <div className="mt-xs flex flex-wrap gap-xs" role="group" aria-label={`Step ${i + 1} kind`}>
                {STEP_KINDS.map((k) => (
                  <button key={k.kind} type="button" aria-pressed={s.kind === k.kind} onClick={() => pick(i, k.kind)} className={chip(s.kind === k.kind)}>
                    {k.name}
                  </button>
                ))}
              </div>
              <select
                value={s.ref}
                onChange={(e) => setStep(i, { ref: e.target.value, label: options[s.kind].find((o) => o.id === e.target.value)?.label ?? '' })}
                aria-label={`Step ${i + 1} target`}
                className={field}
              >
                <option value="">Choose</option>
                {options[s.kind].map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              {options[s.kind].length === 0 && <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">Nothing of this kind yet.</p>}
              {steps.length > 2 && (
                <Button variant="ghost" className="mt-xs" onClick={() => setSteps((list) => list.filter((_, j) => j !== i))}>
                  Remove step
                </Button>
              )}
            </li>
          ))}
        </ol>
        {steps.length < 8 && (
          <Button variant="outline" onClick={() => setSteps((list) => [...list, { kind: 'link', ref: options.link[0]?.id ?? '', label: options.link[0]?.label ?? '' }])}>
            Add a step
          </Button>
        )}
        {create.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {err(create.error, 'Could not create it.')}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={create.isPending || !ready}>
          Create funnel
        </Button>
      </form>
    </Sheet>
  );
}

function NewSequenceSheet({ open, onClose, products, onDone }: { open: boolean; onClose: () => void; products: { id: string; title: string }[]; onDone: () => void }) {
  const [productId, setProductId] = useState('');
  const [delay, setDelay] = useState('1');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const create = useMutation({
    mutationFn: () => api.createSequence({ productId: productId || null, delayDays: Number(delay) || 0, title, body }),
    onSuccess: () => {
      setTitle('');
      setBody('');
      onDone();
    },
  });
  const days = Number(delay) || 0;
  return (
    <Sheet open={open} onClose={onClose} title="New message">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && body.trim()) create.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">After buying</span>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={field}>
            <option value="">Any product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Days to wait</span>
          <input type="number" min={0} max={365} value={delay} onChange={(e) => setDelay(e.target.value)} className={field} />
          <span className="mt-xs block text-[12px] font-bold text-ink-soft">
            Delivered to the buyer's Inbox {days} {days === 1 ? 'day' : 'days'} after purchase.
          </span>
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Message</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000} required className={field} />
        </label>
        {create.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {err(create.error, 'Could not create it.')}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={create.isPending || !title.trim() || !body.trim()}>
          Save message
        </Button>
      </form>
    </Sheet>
  );
}
