import { formatCount, type DmAutomation, type Funnel, type FunnelStep, type FunnelStepKind, type Sequence } from '@kreators/shared';
import { dateTime } from '../lib/date';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Pager, usePage } from '../components/Pager';
import { Button } from '../components/Button';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { Toggle } from '../components/Toggle';
import { api, errorText } from '../lib/api';
import { useAuthed, useStudio } from '../lib/queries';
import { FIELD, chip } from '../lib/ui';


const STEP_KINDS: { kind: FunnelStepKind; name: string }[] = [
  { kind: 'content', name: 'Post' },
  { kind: 'automation', name: 'Auto-DM' },
  { kind: 'link', name: 'Link click' },
  { kind: 'lead', name: 'Lead' },
  { kind: 'product', name: 'Sale' },
  { kind: 'broadcast', name: 'Broadcast' },
];

export function Automations() {
  const ds = usePage('ds');
  const autos = useAuthed(['automations', ds.query], () => api.automations(ds.query));
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
      <AppCover back={{ to: '/shop', label: 'Shop' }} title="Auto-DM" lede="Someone comments a keyword, they get your link in a DM. Funnels show where people drop off. Sequences follow up after a purchase." />

      {autos.data && !autos.data.metaConnected && (
        <p className="mt-md m-0 rounded-tile p-sm text-subhead text-ink" style={{ background: 'var(--tint-yellow)' }}>
          Meta is not connected on this server, so matched comments are queued here for you to send by hand.
        </p>
      )}

      <section className="mt-lg" aria-labelledby="auto-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="auto-heading" className="text-title2">
            Automations
          </h2>
          <Button onClick={() => setNewAuto(true)}>New automation</Button>
        </div>
        {autos.data && autos.data.automations.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">None yet. Pick a keyword like GUIDE and the message to send.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {autos.data?.automations.map((a) => (
            <AutomationCard key={a.id} a={a} onChange={() => void autos.refetch()} />
          ))}
        </ul>
        {autos.data && (autos.data.sends.length > 0 || autos.data.sendPage.page > 1) && (
          <div className="mt-md">
            <h3 className="text-headline">Recent matches</h3>
            <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
              {autos.data.sends.map((s) => (
                <li key={s.id} className="rounded-tile bg-card p-sm text-subhead shadow-toy-soft">
                  <span className="font-semibold">{s.recipientHandle || 'someone'}</span>, {s.status}
                  {s.error ? `: ${s.error}` : ''}, {dateTime(s.createdAt)}
                </li>
              ))}
            </ul>
            <Pager page={autos.data.sendPage} prefix="ds" label="matches" />
          </div>
        )}
      </section>

      <section className="mt-lg" aria-labelledby="funnel-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="funnel-heading" className="text-title2">
            Funnels
          </h2>
          <Button variant="outline" onClick={() => setNewFunnel(true)}>New funnel</Button>
        </div>
        {funnels.data && funnels.data.funnels.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">Chain a post, an Auto-DM, a link, a lead and a sale to see the drop-off at every step.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {funnels.data?.funnels.map((f) => (
            <FunnelCard key={f.id} f={f} onChange={() => void funnels.refetch()} />
          ))}
        </ul>
      </section>

      <section className="mt-lg" aria-labelledby="seq-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="seq-heading" className="text-title2">
            Sequences
          </h2>
          <Button variant="outline" onClick={() => setNewSeq(true)}>New message</Button>
        </div>
        <p className="mt-xs m-0 text-subhead text-ink-soft">Messages buyers get in their Inbox some days after a purchase.</p>
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

/** The pale red outline a delete wears (the Sign out button's look), never solid until the sheet asks. */
const DELETE_BTN = 'toy inline-flex min-h-[48px] items-center justify-center rounded-pill border-2 border-r1/40 bg-transparent px-md text-headline text-r1 hover:bg-r1/10 disabled:opacity-50';

/** Asks before a delete, the Mindful session pattern: a red "Yes, delete it" and a quiet "Keep it". */
function ConfirmDelete({ open, title, body, pending, failed, onYes, onClose }: { open: boolean; title: string; body: string; pending: boolean; failed: boolean; onYes: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="grid gap-md pb-xl">
        <p className="m-0 text-callout text-ink-soft">{body}</p>
        {failed && <p role="alert" className="m-0 text-subhead text-r1">That did not work. Try again.</p>}
        <div className="flex flex-wrap gap-xs">
          <button type="button" disabled={pending} onClick={onYes} className={DELETE_BTN}>
            Yes, delete it
          </button>
          <Button variant="outline" onClick={onClose}>
            Keep it
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function AutomationCard({ a, onChange }: { a: DmAutomation; onChange: () => void }) {
  const [comment, setComment] = useState('');
  const toggle = useMutation({ mutationFn: (active: boolean) => api.setAutomation(a.id, active), onSuccess: onChange });
  const remove = useMutation({ mutationFn: () => api.deleteAutomation(a.id), onSuccess: onChange });
  const [deleting, setDeleting] = useState(false);
  const test = useMutation({ mutationFn: () => api.simulateComment(a.id, { comment }), onSuccess: onChange });
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-headline">Keywords: {a.keywords.join(', ')}</p>
      <p className="mt-xs m-0 text-subhead text-ink-soft">
        {a.contentCaption ? `On "${a.contentCaption}"` : 'On every post'}. Sends {a.productTitle ? `the link to ${a.productTitle}` : 'your page link'} as /go/{a.linkCode}.
      </p>
      <p className="mt-xs m-0 whitespace-pre-wrap rounded-tile bg-paper p-sm text-subhead">{a.dmMessage}</p>
      {a.publicReplies.length > 0 && <p className="mt-xs m-0 text-caption text-ink-soft">Public replies: {a.publicReplies.join(' / ')}</p>}
      <dl className="mt-sm grid grid-cols-4 gap-xs m-0 text-subhead">
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
            <dt className="text-caption text-ink-soft">{k}</dt>
            <dd className="m-0 text-headline">{formatCount(v)}</dd>
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
          <span className="block text-caption">Test with a comment</span>
          <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={300} placeholder="Type what a viewer might comment" className={FIELD} />
        </label>
        <Button type="submit" variant="outline" disabled={test.isPending || !comment.trim()}>
          Test
        </Button>
      </form>
      {test.isSuccess && <p className="mt-xs m-0 text-subhead font-semibold">{test.data.matched > 0 ? `Matched. A DM was ${a.active ? 'queued' : 'not sent because the automation is paused'}.` : 'No keyword in that comment.'}</p>}
      {(toggle.isError || remove.isError || test.isError) && (
        <p role="alert" className="mt-xs m-0 rounded-tile bg-r1/15 p-sm text-subhead">
          {errorText(toggle.error ?? remove.error ?? test.error, 'That did not work.')}
        </p>
      )}
      <button type="button" disabled={remove.isPending} onClick={() => setDeleting(true)} className={`mt-xs ${DELETE_BTN}`}>
        Remove
      </button>
      <ConfirmDelete open={deleting} title="Delete this automation?" body="It stops answering comments. Its numbers go with it. This cannot be undone." pending={remove.isPending} failed={remove.isError} onYes={() => remove.mutate()} onClose={() => setDeleting(false)} />
    </li>
  );
}

function FunnelCard({ f, onChange }: { f: Funnel; onChange: () => void }) {
  const remove = useMutation({ mutationFn: () => api.deleteFunnel(f.id), onSuccess: onChange });
  const [deleting, setDeleting] = useState(false);
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-headline">{f.name}</p>
      <ol className="mt-sm flex list-none gap-xs overflow-x-auto p-0 m-0 pb-xs scrollbar-none">
        {f.steps.map((s, i) => {
          const prev = i > 0 ? (f.steps[i - 1]?.count ?? 0) : null;
          const here = s.count ?? 0;
          const drop = prev && prev > 0 ? Math.round(((prev - here) / prev) * 100) : null;
          return (
            <li key={`${s.kind}-${s.ref}-${i}`} className="flex shrink-0 items-center gap-xs">
              {i > 0 && (
                <span className="text-[12px] text-ink-mute" aria-label={drop === null ? 'next step' : `${drop} percent drop off`}>
                  {drop === null ? <Icon icon={ArrowRight} size={14} /> : <span className="inline-flex items-center gap-xs">−{Math.max(0, drop)}% <Icon icon={ArrowRight} size={14} /></span>}
                </span>
              )}
              <div className="min-w-[96px] rounded-tile bg-paper p-xs">
                <p className="m-0 text-caption text-ink-soft">{STEP_KINDS.find((k) => k.kind === s.kind)?.name ?? s.kind}</p>
                <p className="m-0 text-title3 type-figure leading-none">{here}</p>
                <p className="m-0 truncate text-caption text-ink-soft">{s.label}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <button type="button" disabled={remove.isPending} onClick={() => setDeleting(true)} className={`mt-xs ${DELETE_BTN}`}>
        Remove
      </button>
      <ConfirmDelete open={deleting} title="Delete this funnel?" body={`"${f.name}". The posts, links and sales in it stay. This cannot be undone.`} pending={remove.isPending} failed={remove.isError} onYes={() => remove.mutate()} onClose={() => setDeleting(false)} />
    </li>
  );
}

function SequenceCard({ s, onChange }: { s: Sequence; onChange: () => void }) {
  const toggle = useMutation({ mutationFn: (active: boolean) => api.setSequence(s.id, active), onSuccess: onChange });
  const remove = useMutation({ mutationFn: () => api.deleteSequence(s.id), onSuccess: onChange });
  const [deleting, setDeleting] = useState(false);
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-headline">{s.title}</p>
      <p className="mt-xs m-0 text-subhead text-ink-soft">
        {s.productTitle ?? 'Every product'}, {s.delayDays} {s.delayDays === 1 ? 'day' : 'days'} after purchase, sent {s.sent} {s.sent === 1 ? 'time' : 'times'}.
      </p>
      <p className="mt-xs m-0 whitespace-pre-wrap text-subhead">{s.body}</p>
      <div className="mt-sm">
        <Toggle on={s.active} onChange={(on) => toggle.mutate(on)} label={s.active ? 'Active' : 'Paused'} />
      </div>
      <button type="button" disabled={remove.isPending} onClick={() => setDeleting(true)} className={`mt-xs ${DELETE_BTN}`}>
        Remove
      </button>
      <ConfirmDelete open={deleting} title="Delete this message?" body={`"${s.title}". It stops going out to buyers. This cannot be undone.`} pending={remove.isPending} failed={remove.isError} onYes={() => remove.mutate()} onClose={() => setDeleting(false)} />
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
          <span className="block text-subhead font-semibold">Post</span>
          <select value={contentItemId} onChange={(e) => setContentItemId(e.target.value)} className={FIELD}>
            <option value="">Every post</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Keywords, comma separated</span>
          <input autoFocus value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="guide, link" required className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Message to send</span>
          <textarea value={dmMessage} onChange={(e) => setDmMessage(e.target.value)} rows={4} maxLength={900} required className={FIELD} />
          <span className="mt-xs block text-caption text-ink-soft">The tracked link is added at the end.</span>
        </label>
        <label className="block">
          <span className="block text-subhead">Public replies, one per line, up to five</span>
          <textarea value={replies} onChange={(e) => setReplies(e.target.value)} rows={3} placeholder="Sent you a DM!" className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">The link opens</span>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={FIELD}>
            <option value="">Your page</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        {create.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            {errorText(create.error, 'Could not create it.')}
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

type StepRow = FunnelStep & { key: string };
const firstSteps = (): StepRow[] => [
  { key: crypto.randomUUID(), kind: 'content', ref: '', label: '' },
  { key: crypto.randomUUID(), kind: 'product', ref: '', label: '' },
];

function NewFunnelSheet({ open, onClose, options, onDone }: { open: boolean; onClose: () => void; options: Options; onDone: () => void }) {
  const [name, setName] = useState('');
  // Each step carries a client-only key so removing one from the middle never hands its picks to the next; stripped before saving.
  const [steps, setSteps] = useState<StepRow[]>(firstSteps);
  const create = useMutation({
    mutationFn: () => api.createFunnel({ name, steps: steps.map(({ key: _key, ...st }) => st) }),
    onSuccess: () => {
      setName('');
      setSteps(firstSteps());
      onDone();
    },
  });
  const setStep = (i: number, patch: Partial<StepRow>) => setSteps((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
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
          <span className="block text-subhead font-semibold">Name</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className={FIELD} placeholder="Reel to resume template" />
        </label>
        <ol className="flex list-none flex-col gap-sm p-0 m-0">
          {steps.map((s, i) => (
            <li key={s.key} className="rounded-tile bg-paper p-sm">
              <p className="m-0 text-subhead font-semibold">Step {i + 1}</p>
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
                className={FIELD}
              >
                <option value="">Choose</option>
                {options[s.kind].map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              {options[s.kind].length === 0 && <p className="mt-xs m-0 text-caption text-ink-soft">Nothing of this kind yet.</p>}
              {steps.length > 2 && (
                <Button variant="ghost" className="mt-xs" onClick={() => setSteps((list) => list.filter((x) => x.key !== s.key))}>
                  Remove step
                </Button>
              )}
            </li>
          ))}
        </ol>
        {steps.length < 8 && (
          <Button variant="outline" onClick={() => setSteps((list) => [...list, { key: crypto.randomUUID(), kind: 'link', ref: options.link[0]?.id ?? '', label: options.link[0]?.label ?? '' }])}>
            Add a step
          </Button>
        )}
        {create.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            {errorText(create.error, 'Could not create it.')}
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
          <span className="block text-subhead font-semibold">After buying</span>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={FIELD}>
            <option value="">Any product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Days to wait</span>
          <input type="number" min={0} max={365} value={delay} onChange={(e) => setDelay(e.target.value)} className={FIELD} />
          <span className="mt-xs block text-caption text-ink-soft">
            Delivered to the buyer's Inbox {days} {days === 1 ? 'day' : 'days'} after purchase.
          </span>
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Message</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000} required className={FIELD} />
        </label>
        {create.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            {errorText(create.error, 'Could not create it.')}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={create.isPending || !title.trim() || !body.trim()}>
          Save message
        </Button>
      </form>
    </Sheet>
  );
}
