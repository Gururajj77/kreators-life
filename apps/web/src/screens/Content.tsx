import { MAX_BRANDS, type Brand } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { Nudge } from '../components/Nudge';
import { BackLink } from '../components/PageHeader';
import { Pager, usePage } from '../components/Pager';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const err = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** What the server can do today, said before anyone waits for it. */
export function ToolsLine({ tools }: { tools: { reach: boolean; writer: 'claude' | 'workers-ai' | 'none' } }) {
  const research = tools.reach ? 'Research runs through Agent Reach: web, YouTube, X, Instagram and Reddit.' : 'Research reads plain pages and YouTube for now. Connect Agent Reach for X, Reddit, transcripts and profiles.';
  const writer = tools.writer === 'claude' ? 'Claude writes the pieces.' : tools.writer === 'workers-ai' ? 'A small model writes the pieces.' : 'No writing model is connected, so pieces come back as research digests.';
  return (
    <p className="m-0 text-[12px] font-bold text-ink-soft">
      {research} {writer}
    </p>
  );
}

/**
 * Content: a strategist with one folder per brand. Each folder holds the links the brand is fed, the
 * research run on them, and the pieces written from that. The attribution screen (posts and tracked
 * links) is one tap away under Results.
 */
export function Content() {
  const pg = usePage();
  const q = useAuthed(['brands', pg.query], () => api.brands(pg.query));
  const nav = useNavigate();
  const [making, setMaking] = useState(false);
  const d = q.data;

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/shop">Shop</BackLink>
        <h1 className="text-[30px]">Content</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">A strategist for every brand you work on. Feed a folder links, let it research, and get plans, calendars, hooks and scripts back.</p>
        {d && (
          <div className="mt-sm">
            <ToolsLine tools={d.tools} />
          </div>
        )}
      </header>

      <section className="mt-lg" aria-labelledby="brands-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="brands-heading" className="text-[24px]">
            Brand folders
          </h2>
          <Button onClick={() => setMaking(true)} disabled={Boolean(d && d.brands.length >= MAX_BRANDS)}>
            New brand
          </Button>
        </div>
        {q.isError && <p className="mt-sm m-0 font-bold">{err(q.error, 'Could not load.')}</p>}
        {d && d.brands.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">No folders yet. Make one for your own brand, or for a client.</p>}
        <ul className="mt-sm grid list-none grid-cols-1 gap-xs p-0 m-0 md:grid-cols-2">
          {d?.brands.map((b) => (
            <li key={b.id}>
              <BrandCard b={b} />
            </li>
          ))}
        </ul>
        <Pager page={d?.page} label="brands" />
        <Nudge className="mt-sm" text="Each piece says who wrote it. A draft from the research digest is a start, not the finish." />
      </section>

      <section className="mt-lg" aria-labelledby="results-heading">
        <h2 id="results-heading" className="text-[24px]">
          Results
        </h2>
        <Link to="/shop/content/results" className="toy toy-soft mt-sm flex items-center gap-sm rounded-tile bg-card p-sm text-ink">
          <span className="flex size-[48px] shrink-0 items-center justify-center rounded-pill bg-paper text-[24px]" aria-hidden="true">
            📈
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold">Posts and tracked links</span>
            <span className="block text-[14px] font-semibold text-ink-soft">Which post made money: clicks, sales and revenue per piece of content.</span>
          </span>
        </Link>
      </section>

      <NewBrandSheet open={making} onClose={() => setMaking(false)} onMade={(b) => nav(`/shop/content/${b.id}`)} />
    </Screen>
  );
}

function BrandCard({ b }: { b: Brand }) {
  return (
    <Link to={`/shop/content/${b.id}`} className="toy toy-soft flex items-start gap-sm rounded-tile bg-card p-sm text-ink">
      <span className="flex size-[48px] shrink-0 items-center justify-center rounded-pill bg-paper text-[24px]" aria-hidden="true">
        📁
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-bold">{b.name}</span>
        <span className="block text-[14px] font-semibold text-ink-soft">{b.niche || 'No niche yet'}</span>
        <span className="mt-xs block text-[12px] font-bold text-ink-mute">
          {b.sources} {b.sources === 1 ? 'link' : 'links'}, {b.runs} {b.runs === 1 ? 'run' : 'runs'}, {b.pieces} {b.pieces === 1 ? 'piece' : 'pieces'}
        </span>
      </span>
    </Link>
  );
}

export function NewBrandSheet({ open, onClose, onMade }: { open: boolean; onClose: () => void; onMade: (b: Brand) => void }) {
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  const [description, setDescription] = useState('');
  const [voice, setVoice] = useState('');
  const make = useMutation({
    mutationFn: () => api.createBrand({ name, niche, description, voice }),
    onSuccess: (r) => {
      setName('');
      setNiche('');
      setDescription('');
      setVoice('');
      onClose();
      onMade(r.brand);
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="New brand folder">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) make.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Brand</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Niche</span>
          <input value={niche} onChange={(e) => setNiche(e.target.value)} maxLength={120} placeholder="Street food in Bengaluru, phone videography, running shoes" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">What it is</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} placeholder="What the brand sells, who buys it, what it wants from content." className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">How it sounds</span>
          <textarea value={voice} onChange={(e) => setVoice(e.target.value)} rows={2} maxLength={1000} placeholder="Warm and direct. Jokes allowed. Never says 'unlock your potential'." className={field} />
        </label>
        {make.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {err(make.error, 'Could not make the folder.')}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={make.isPending || !name.trim()}>
          Make the folder
        </Button>
      </form>
    </Sheet>
  );
}
