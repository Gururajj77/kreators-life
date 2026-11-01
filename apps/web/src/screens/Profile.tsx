import { AVAILABILITY, CATEGORIES, EXPERIENCE_LEVELS, GOALS, SKILLS, TIMEZONES, type PortfolioItem, type Socials, type User, DEFAULT_PUBLIC, PUBLIC_SETTING_META, type PublicSettings } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { InterestPicker } from '../components/InterestPicker';
import { LinksEditor } from '../components/LinksEditor';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Toggle } from '../components/Toggle';
import { api } from '../lib/api';
import { useAuthed, useMe, useRefreshAll } from '../lib/queries';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';

function Err({ e }: { e: unknown }) {
  if (!e) return null;
  return (
    <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
      {e instanceof Error ? e.message : 'That did not work. Check your connection and try again.'}
    </p>
  );
}

function Chips({ legend, options, value, onChange, max, hint }: { legend: string; options: readonly string[]; value: string[]; onChange: (next: string[]) => void; max?: number; hint?: string }) {
  const toggle = (o: string) => {
    if (value.includes(o)) onChange(value.filter((v) => v !== o));
    else if (!max || value.length < max) onChange([...value, o]);
  };
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="text-[14px] font-bold">
        {legend}
        {max ? <span className="font-semibold text-ink-soft"> (up to {max})</span> : ''}
      </legend>
      {hint && <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{hint}</p>}
      <div className="mt-xs flex flex-wrap gap-xs">
        {options.map((o) => {
          const on = value.includes(o);
          const full = Boolean(max && value.length >= max && !on);
          return (
            <button key={o} type="button" aria-pressed={on} disabled={full} onClick={() => toggle(o)} className={`toy rounded-pill border-2 px-sm py-xs text-[14px] font-bold disabled:opacity-50 ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              {o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function OneOf({ legend, options, value, onChange }: { legend: string; options: readonly string[]; value: string; onChange: (next: string) => void }) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="text-[14px] font-bold">{legend}</legend>
      <div className="mt-xs flex flex-wrap gap-xs">
        {options.map((o) => (
          <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(value === o ? '' : o)} className={`toy rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${value === o ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Profile() {
  const me = useMe();
  if (!me.data) return null;
  return <ProfileView key={me.data.user.id} user={me.data.user} />;
}

function ProfileView({ user }: { user: User }) {
  const refresh = useRefreshAll();
  const [handle, setHandle] = useState(user.handle ?? '');
  const [bio, setBio] = useState(user.bio);
  const [skills, setSkills] = useState<string[]>(user.skills);
  const [categories, setCategories] = useState<string[]>(user.categories);
  const [goals, setGoals] = useState<string[]>(user.goals);
  const [experienceLevel, setExperience] = useState(user.experienceLevel);
  const [availability, setAvailability] = useState(user.availability);
  const [location, setLocation] = useState(user.location);
  const [openToIntros, setOpenToIntros] = useState(user.openToIntros);
  const [pub, setPub] = useState<PublicSettings>({ ...DEFAULT_PUBLIC, ...user.publicSettings });
  const [interests, setInterests] = useState<string[]>(user.interests);
  const [city, setCity] = useState(user.city);
  const [area, setArea] = useState(user.area);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null | undefined>(undefined);
  const [locating, setLocating] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [socials, setSocials] = useState<Socials>(user.socials);
  const [timezone, setTimezone] = useState(user.timezone || 'Asia/Kolkata');
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: () => api.updateMe({ handle: handle || null, bio, skills, categories, goals, experienceLevel, availability, location, openToIntros, interests, city, area, avatarUrl, socials, timezone, publicSettings: pub, ...(coords === undefined ? {} : { lat: coords?.lat ?? null, lng: coords?.lng ?? null }) }),
    onSuccess: () => {
      refresh();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    },
  });
  const link = user.handle ? `${window.location.origin}/u/${user.handle}` : null;

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Profile</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">What brands, hosts and other people see. Your journal and wellbeing never appear here.</p>
        {link ? (
          <div className="mt-sm rounded-tile bg-card p-sm shadow-toy-soft">
            <p className="m-0 text-[14px] font-bold">Your public page</p>
            <p className="m-0 break-all text-[16px] font-semibold">{link}</p>
            <div className="mt-sm flex flex-wrap gap-xs">
              <Button variant="outline" onClick={() => navigator.clipboard?.writeText(link)}>
                Copy
              </Button>
              <Link to={`/u/${user.handle}`} className="toy inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
                Open
              </Link>
            </div>
          </div>
        ) : (
          <p className="mt-sm m-0 rounded-tile bg-r3 p-sm text-[14px] font-bold text-ink-fixed">Pick a page name below so people can find you.</p>
        )}
      </header>

      <form
        className="mt-lg grid grid-cols-1 gap-md rounded-card bg-card p-md shadow-toy-soft"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Username</span>
          <div className="mt-xs flex items-center gap-xs">
            <span className="text-[16px] font-bold text-ink-soft">/u/</span>
            <input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase())} maxLength={20} pattern="[a-z0-9_]{3,20}" placeholder="yourname" className="min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          </div>
          <span className="mt-xs block text-[12px] font-bold text-ink-soft">Yours alone, and it is your page address. Three to twenty characters: letters, numbers, underscore.</span>
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Bio</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} rows={3} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Photo link</span>
          <div className="mt-xs flex items-center gap-sm">
            {avatarUrl && <img src={avatarUrl} alt="" width={64} height={64} className="size-[64px] shrink-0 rounded-pill object-cover" />}
            <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} maxLength={500} placeholder="https://… a square image" className="min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          </div>
          <span className="mt-xs block text-[12px] font-bold text-ink-soft">Shown on your page in place of the first letter of your name.</span>
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Links</legend>
          <div className="mt-xs grid grid-cols-2 gap-xs md:grid-cols-4">
            {(
              [
                ['instagram', 'Instagram'],
                ['youtube', 'YouTube'],
                ['x', 'X'],
                ['website', 'Website'],
              ] as [keyof Socials, string][]
            ).map(([k, label]) => (
              <label key={k} className="block">
                <span className="block text-[12px] font-bold text-ink-soft">{label}</span>
                <input type="url" value={socials[k]} onChange={(e) => setSocials({ ...socials, [k]: e.target.value })} maxLength={200} placeholder="https://" className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="block text-[14px] font-bold">Time zone</span>
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={field}>
            {(TIMEZONES.includes(timezone as (typeof TIMEZONES)[number]) ? TIMEZONES : [timezone, ...TIMEZONES]).map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <span className="mt-xs block text-[12px] font-bold text-ink-soft">Your availability and bookings are written in this zone. Buyers see the same slots in their own.</span>
        </label>
        <div>
          <Chips legend="Skills" options={SKILLS} value={skills} onChange={setSkills} max={12} hint="What you can be hired for." />
        </div>
        <div>
          <Chips legend="Categories" options={CATEGORIES} value={categories} onChange={setCategories} max={12} hint="What your work is about." />
        </div>
        <div>
          <Chips legend="Goals" options={GOALS} value={goals} onChange={setGoals} max={12} hint="What you want from Kreators. It shapes what we suggest." />
        </div>
        <OneOf legend="Experience" options={EXPERIENCE_LEVELS} value={experienceLevel} onChange={setExperience} />
        <OneOf legend="Availability" options={AVAILABILITY} value={availability} onChange={setAvailability} />
        <div id="interests" className="scroll-mt-[64px]">
          <InterestPicker value={interests} onChange={setInterests} hint="What you are into. Circles seat you with people whose interests fit yours." />
        </div>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">City</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} placeholder="Bengaluru" className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Area</span>
            <input value={area} onChange={(e) => setArea(e.target.value)} maxLength={80} placeholder="Indiranagar" className={field} />
          </label>
        </div>
        <button
          type="button"
          disabled={locating}
          onClick={() => {
            if (coords || user.hasLocation) {
              setCoords(null);
              return;
            }
            if (!navigator.geolocation) return;
            setLocating(true);
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setCoords({ lat: Math.round(pos.coords.latitude * 1000) / 1000, lng: Math.round(pos.coords.longitude * 1000) / 1000 });
                setLocating(false);
              },
              () => setLocating(false),
              { timeout: 8000 },
            );
          }}
          className="toy toy-soft inline-flex min-h-[48px] items-center justify-center rounded-pill bg-card px-md text-[14px] font-bold disabled:opacity-60"
        >
          {locating ? 'Finding you' : coords ? 'Position ready to save; tap to clear' : coords === null ? 'Position will be removed on save' : user.hasLocation ? 'Position saved; tap to remove' : 'Use my position for nearby matching'}
        </button>
        <label className="block">
          <span className="block text-[14px] font-bold">Location on your page</span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} placeholder="City, country" className={field} />
        </label>
        <label className="flex items-center gap-sm text-[14px] font-bold">
          <input type="checkbox" checked={openToIntros} onChange={(e) => setOpenToIntros(e.target.checked)} className="size-[20px] accent-ink" />
          Open to introductions from people I meet at events
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[16px] font-bold">What is public</legend>
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Each part of your page has a switch. Off means it is not shown to anyone but you. Your journal and wellbeing are never on your page.</p>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {PUBLIC_SETTING_META.map((m) => (
              <li key={m.key} className={m.key !== 'pagePublic' && !pub.pagePublic ? 'opacity-60' : ''}>
                <Toggle on={pub[m.key]} onChange={(on) => setPub((p) => ({ ...p, [m.key]: on }))} label={m.name} hint={m.blurb} disabled={m.key !== 'pagePublic' && !pub.pagePublic} />
              </li>
            ))}
          </ul>
        </fieldset>
        <div>
          <Err e={save.isError ? save.error : null} />
        </div>
        <div>
          <Button type="submit" size="lg" full disabled={save.isPending}>
            {saved ? 'Saved' : 'Save profile'}
          </Button>
        </div>
      </form>

      <Portfolio />

      <section className="mt-lg" aria-labelledby="links-heading">
        <h2 id="links-heading" className="text-[24px]">
          Links
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Your page is the door to everything you make. Stack buttons, headers, text, pictures, videos and carousels; the best thing goes first. Each change saves on its own.</p>
        <div className="mt-sm">
          <LinksEditor key={user.id} initial={user.links} />
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="more-heading">
        <h2 id="more-heading" className="text-[24px]">
          More of your page
        </h2>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {(
            [
              ['/shop/page', '🛍️', 'Products and your page', 'What you sell, and the lead form.'],
              ['/you', '🙂', 'Profile', 'Name, focus, features, account.'],
            ] as [string, string, string, string][]
          ).map(([to, emoji, title, blurb]) => (
            <li key={to}>
              <Link to={to} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm text-ink">
                <span className="flex size-[48px] shrink-0 items-center justify-center rounded-pill bg-paper text-[24px]" aria-hidden="true">
                  {emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold leading-tight">{title}</span>
                  <span className="mt-xs block text-[14px] font-semibold leading-snug text-ink-soft">{blurb}</span>
                </span>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-mute">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Screen>
  );
}

function Portfolio() {
  const q = useAuthed(['portfolio'], api.portfolio);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<PortfolioItem['visibility']>('public');
  const add = useMutation({
    mutationFn: () => api.addPortfolio({ title, url, description, visibility }),
    onSuccess: () => {
      setTitle('');
      setUrl('');
      setDescription('');
      q.refetch();
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => api.removePortfolio(id), onSuccess: () => q.refetch() });
  const items = q.data?.items ?? [];
  return (
    <section className="mt-lg" aria-labelledby="portfolio-heading">
      <h2 id="portfolio-heading" className="text-[24px]">
        Portfolio
      </h2>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Your best work, as links. Public items show on your page and go with every application you send. Up to five travel with an application.</p>
      {q.data && items.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Nothing here yet. Add the piece you are proudest of.</p>}
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {items.map((it) => (
          <li key={it.id} className="flex items-start gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
            <span className="min-w-0 flex-1">
              <a href={it.url} target="_blank" rel="noreferrer" className="block truncate text-[16px] font-bold underline-offset-4 hover:underline">
                {it.title}
              </a>
              {it.description && <span className="block text-[14px] font-semibold text-ink-soft">{it.description}</span>}
              <span className="block text-[12px] font-bold text-ink-mute">{it.visibility === 'public' ? 'Public' : 'Only you'}</span>
            </span>
            <Button variant="ghost" className="shrink-0" aria-label={`Remove ${it.title}`} onClick={() => remove.mutate(it.id)} disabled={remove.isPending}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="mt-sm flex flex-col gap-md rounded-card bg-card p-md shadow-toy-soft"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && url.trim()) add.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Link</span>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} required placeholder="https://" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">One line about it</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} className={field} />
        </label>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[14px] font-bold">Who sees it</legend>
          <div className="mt-xs flex flex-wrap gap-xs">
            {(
              [
                ['public', 'Everyone'],
                ['private', 'Only you'],
              ] as [PortfolioItem['visibility'], string][]
            ).map(([v, label]) => (
              <button key={v} type="button" aria-pressed={visibility === v} onClick={() => setVisibility(v)} className={`toy rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${visibility === v ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <Err e={add.isError ? add.error : null} />
        <Button type="submit" full disabled={add.isPending || !title.trim() || !url.trim()}>
          Add to portfolio
        </Button>
      </form>
    </section>
  );
}
