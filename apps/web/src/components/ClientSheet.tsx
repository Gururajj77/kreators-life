import { AGENCY_CHANNELS, AGENCY_CLIENT_STATUSES, AGENCY_HEALTH, AGENCY_HEALTH_NAME, AGENCY_NAME_MAX, AGENCY_NOTES_MAX, AGENCY_STATUS_NAME, type AgencyClient, type AgencyClientStatus, type AgencyHealth, type BusinessProfile, type InvoiceParty, INDIAN_STATES, PHONE_HINT, pinCodeProblem, portalPasswordProblem, REVISIONS_MAX } from '@kreators/shared';
import { emptyEmailVars, fillEmail } from '@kreators/shared/agencyEmail';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { Button } from './Button';
import { Fold } from './Fold';
import { Sheet } from './Sheet';
import { feeCents, FIELD, RED_YES } from '../lib/ui';
import { FieldLabel } from './Field';
import { useCopy } from '../lib/clipboard';
import { PasswordField, ShownOnce } from './ClientPassword';
import { StickyAction } from './StickyAction';


const COPY = {
  addTitle: 'Add a client',
  addName: 'Brand name',
  addEmail: "Client's email",
  addPassword: 'Password for their page',
  addPasswordHint: 'You set it. They type it to open their page.',
  separately: 'Their password, shown once here. Copy it now.',
  editTitle: 'Change this client',
  name: 'Who is the client? Their brand or business name.',
  money: 'Type amounts in whole units, like 50000.',
  billing: 'This is what shows under "Billed to" on their invoices and agreements.',
  army: 'Link a campaign you are a creator on in Army. Its deliverables can then come in here, and you can send versions to the brand.',
  armySave: 'Save the link first, then add its deliverables.',
  armyNone: 'You are not a creator on any campaign yet. Accept a role in Army first.',
  removeAsk: 'This removes the client, with its deliverables, time and agreements. It cannot be undone.',
  saveFail: 'That did not save. Check the name and try again.',
} as const;

// A billing address keeps its state and PIN code inside the one address text, "street, city, State PIN", so nothing new is stored.
const STATES_LONGEST = [...INDIAN_STATES].sort((a, b) => b.length - a.length);
function splitAddress(text: string): { rest: string; state: string; pin: string } {
  let rest = text.trim();
  let pin = '';
  const m = /\s*(\d{6})$/.exec(rest);
  if (m) {
    pin = m[1] ?? '';
    rest = rest.slice(0, m.index);
  }
  const state = STATES_LONGEST.find((st) => rest.endsWith(st)) ?? '';
  if (state) rest = rest.slice(0, rest.length - state.length);
  return { rest: rest.replace(/[,\s]+$/, ''), state, pin };
}
const joinAddress = (a: { rest: string; state: string; pin: string }) => [a.rest.trim(), [a.state, a.pin.trim()].filter(Boolean).join(' ')].filter(Boolean).join(', ');

/** The label a GST number is kept under, so the short form's field and the invoice's tax numbers are one value. */
const GST_LABEL = 'GSTIN';

/** A server's short answer as a sentence: "set a password" becomes "Set a password." */
const sentence = (m: string): string => `${m.charAt(0).toUpperCase()}${m.slice(1)}${/[.!?]$/.test(m) ? '' : '.'}`;

const toMajor = (cents: number): string => (cents === 0 ? '' : cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));
const whole = (v: string): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function Chips<T extends string>({ label, options, value, name, onChange }: { label: string; options: readonly T[]; value: T; name: (v: T) => string; onChange: (v: T) => void }) {
  return (
    <div className="mt-sm">
      <p className="m-0 text-subhead font-semibold">{label}</p>
      <div role="radiogroup" aria-label={label} className="mt-xs flex flex-wrap gap-xs">
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={`toy min-h-[36px] md:min-h-[44px] tap-pad rounded-pill border-2 px-md text-subhead font-medium ${value === o ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
            {name(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Add a client (client is null) or change one: details, billing, the Army campaign it is served through, and removing it. */
export function ClientSheet({ open, client, onClose }: { open: boolean; client: AgencyClient | null; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={client ? COPY.editTitle : COPY.addTitle}>
      <ClientForm client={client} onClose={onClose} />
    </Sheet>
  );
}

function ClientForm({ client, onClose }: { client: AgencyClient | null; onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [name, setName] = useState(client?.name ?? '');
  const [contactName, setContactName] = useState(client?.contactName ?? '');
  const [contactEmail, setContactEmail] = useState(client?.contactEmail ?? '');
  const [status, setStatus] = useState<AgencyClientStatus>(client?.status ?? 'active');
  const [health, setHealth] = useState<AgencyHealth>(client?.health ?? 'green');
  const [channels, setChannels] = useState<string[]>(client?.channels ?? []);
  const [typed, setTyped] = useState('');
  const [retainer, setRetainer] = useState(toMajor(client?.retainerCents ?? 0));
  const [pieces, setPieces] = useState(client && client.piecesPerMonth ? String(client.piecesPerMonth) : '');
  const [hours, setHours] = useState(client && client.hoursPerMonth ? String(client.hoursPerMonth) : '');
  const [renewal, setRenewal] = useState(client?.renewalDate ?? '');
  const [notes, setNotes] = useState(client?.notes ?? '');
  const [billing, setBilling] = useState<InvoiceParty>(client?.billing ?? { name: '', line: '', taxIds: [], address: '', email: '', phone: '' });
  const [campaignId, setCampaignId] = useState(client?.campaignId ?? '');
  const [addr, setAddr] = useState(() => splitAddress(client?.billing.address ?? ''));
  const setAddrPart = (part: Partial<typeof addr>) => {
    const next = { ...addr, ...part };
    setAddr(next);
    setBilling((b) => ({ ...b, address: joinAddress(next).slice(0, 300) }));
  };
  const badPin = addr.pin ? pinCodeProblem(addr.pin) : null;
  const [confirm, setConfirm] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  // A new client always has a password on its link: the owner types one or taps Make one. It is never put in the email.
  const [password, setPassword] = useState('');
  const passwordBad = password ? portalPasswordProblem(password, name) : null;
  const [made, setMade] = useState<{ token: string; password: string } | null>(null);
  const [revisions, setRevisions] = useState('2');
  const [revisionsSeen, setRevisionsSeen] = useState(false);

  const detail = useAuthed(['agency', 'client', client?.id ?? 'new'], () => api.agencyClient(client!.id), Boolean(client));
  const campaigns = detail.data?.campaigns ?? [];
  const overview = useAuthed(['agency', 'settings'], () => api.agency());
  const currency = detail.data?.settings.currency ?? overview.data?.settings.currency ?? 'INR';
  const savedRevisions = detail.data?.lifecycle.revisionsPerPiece;
  // A client's changes a piece come with their page; the field starts from it once.
  useEffect(() => {
    if (revisionsSeen || savedRevisions === undefined) return;
    setRevisionsSeen(true);
    setRevisions(String(savedRevisions));
  }, [savedRevisions, revisionsSeen]);
  const gst = billing.taxIds.find((t) => t.label === GST_LABEL)?.value ?? '';
  const setGst = (v: string) => {
    const rest = billing.taxIds.filter((t) => t.label !== GST_LABEL);
    setBilling({ ...billing, taxIds: v ? [{ label: GST_LABEL, value: v }, ...rest].slice(0, 4) : rest });
  };
  const revisionCount = Math.min(REVISIONS_MAX, Math.max(0, Math.round(Number(revisions || '0'))));
  const invalidate = () => qc.invalidateQueries({ queryKey: ['agency'] });

  const badRetainer = Number.isNaN(feeCents(retainer));
  const body = () => ({
    name: name.trim(),
    contactName: contactName.trim(),
    contactEmail: contactEmail.trim(),
    status,
    health,
    channels,
    retainerCents: feeCents(retainer),
    piecesPerMonth: whole(pieces),
    hoursPerMonth: whole(hours),
    renewalDate: renewal || null,
    notes,
  });
  const billingFilled = Boolean(billing.name || billing.line || billing.address || billing.email || billing.phone || billing.taxIds.length);

  const save = useMutation({
    mutationFn: async () => {
      if (client) {
        await api.agencyClientUpdate(client.id, { ...body(), billing, campaignId: campaignId || null });
        if (savedRevisions !== undefined && revisionCount !== savedRevisions) await api.agencyLifecycleSave(client.id, { revisionsPerPiece: revisionCount });
        return;
      }
      const added = await api.agencyClientAdd({ ...body(), portalPassword: password });
      if (billingFilled) await api.agencyClientUpdate(added.id, { billing });
      if (revisionCount !== 2) await api.agencyLifecycleSave(added.id, { revisionsPerPiece: revisionCount });
      return { token: added.portalToken, password };
    },
    onSuccess: (r) => {
      invalidate();
      if (r) setMade(r);
      else onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => api.agencyClientRemove(client!.id),
    onSuccess: () => {
      invalidate();
      onClose();
      nav('/agency');
    },
  });
  const importIt = useMutation({
    mutationFn: () => api.agencyArmyImport(client!.id),
    onSuccess: (r) => {
      setImported(r.added);
      invalidate();
    },
  });

  const addChannel = (c: string) => {
    const v = c.trim().slice(0, 30);
    if (!v || channels.some((x) => x.toLowerCase() === v.toLowerCase()) || channels.length >= 10) return;
    setChannels([...channels, v]);
  };
  const setId = (i: number, patch: Partial<{ label: string; value: string }>) => setBilling({ ...billing, taxIds: billing.taxIds.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  if (made) return <Invite name={name.trim()} contactName={contactName.trim()} token={made.token} password={made.password} profile={overview.data?.settings.profile ?? null} onClose={onClose} />;

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (name.trim() && !badRetainer && !badPin && (client || (contactEmail.trim() && password && !passwordBad))) save.mutate();
      }}
    >
      <FieldLabel className="mt-sm" label={client ? COPY.name : COPY.addName}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={AGENCY_NAME_MAX} required autoComplete="off" className={FIELD} />
      </FieldLabel>
      {!client && (
        <>
          <FieldLabel className="mt-sm" label={COPY.addEmail}>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} maxLength={120} required autoComplete="off" className={FIELD} />
          </FieldLabel>
          <div className="mt-sm">
            <PasswordField id="new-client-pw" label={COPY.addPassword} hint={COPY.addPasswordHint} value={password} onChange={setPassword} clientName={name} required />
          </div>
        </>
      )}
      {(() => {
        const details = (
          <>
      <div className="grid gap-sm md:grid-cols-2">
        <FieldLabel className="mt-sm" label="Contact name" hint="Who your emails greet.">
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={AGENCY_NAME_MAX} autoComplete="off" className={FIELD} />
        </FieldLabel>
        {client && (
          <FieldLabel className="mt-sm" label="Contact email" hint="Where documents are emailed.">
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} maxLength={120} autoComplete="off" className={FIELD} />
          </FieldLabel>
        )}
        <FieldLabel className="mt-sm" label="Phone, optional" hint={PHONE_HINT}>
          <input value={billing.phone} onChange={(e) => setBilling({ ...billing, phone: e.target.value })} maxLength={40} inputMode="tel" placeholder="+91 98765 43210" className={FIELD} />
        </FieldLabel>
        <FieldLabel className="mt-sm" label="GST number, optional">
          <input value={gst} onChange={(e) => setGst(e.target.value)} maxLength={40} className={FIELD} />
        </FieldLabel>
      </div>

      <div className="mt-sm">
        <p className="m-0 text-subhead font-semibold">Channels you make for</p>
        <div className="mt-xs flex flex-wrap gap-xs">
          {[...AGENCY_CHANNELS, ...channels.filter((c) => !(AGENCY_CHANNELS as readonly string[]).includes(c))].map((c) => {
            const on = channels.some((x) => x.toLowerCase() === c.toLowerCase());
            return (
              <button key={c} type="button" aria-pressed={on} onClick={() => setChannels(on ? channels.filter((x) => x.toLowerCase() !== c.toLowerCase()) : [...channels, c])} className={`toy min-h-[36px] md:min-h-[44px] tap-pad rounded-pill border-2 px-md text-subhead font-medium ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                {c}
              </button>
            );
          })}
        </div>
        <div className="mt-xs flex gap-xs">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addChannel(typed);
                setTyped('');
              }
            }}
            maxLength={30}
            placeholder="Another channel"
            aria-label="Another channel"
            className="min-h-[44px] min-w-0 flex-1 rounded-pill border-2 border-line bg-paper px-sm text-body"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              addChannel(typed);
              setTyped('');
            }}
          >
            Add
          </Button>
        </div>
      </div>

      <div className="grid gap-sm md:grid-cols-2">
        <FieldLabel className="mt-sm" label={`Retainer a month, in ${currency}`} hint={COPY.money}>
          <input inputMode="decimal" value={retainer} onChange={(e) => setRetainer(e.target.value)} aria-invalid={badRetainer || undefined} className={FIELD} />
          {badRetainer && <p role="alert" className="mt-xs m-0 text-subhead">Type the amount as a number, like 4000 or 4,000.50.</p>}
        </FieldLabel>
        <FieldLabel className="mt-sm" label="Deliverables a month">
          <input inputMode="numeric" value={pieces} onChange={(e) => setPieces(e.target.value)} className={FIELD} />
        </FieldLabel>
        <FieldLabel className="mt-sm" label="Hours a month">
          <input inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} className={FIELD} />
        </FieldLabel>
        <FieldLabel className="mt-sm" label="Changes included in each piece">
          <input inputMode="numeric" value={revisions} onChange={(e) => setRevisions(e.target.value.replace(/[^0-9]/g, ''))} className={FIELD} />
        </FieldLabel>
      </div>
      <FieldLabel className="mt-sm" label="Billing address" hint={COPY.billing}>
        <textarea value={addr.rest} onChange={(e) => setAddrPart({ rest: e.target.value })} rows={2} maxLength={260} placeholder="Building, street, city" className={FIELD} />
      </FieldLabel>
      <div className="grid gap-sm md:grid-cols-2">
        <FieldLabel className="mt-sm" label="State, optional">
          <select value={addr.state} onChange={(e) => setAddrPart({ state: e.target.value })} className={FIELD}>
            <option value="">Not in India, or not set</option>
            {INDIAN_STATES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel className="mt-sm" label="PIN code, optional">
          <input value={addr.pin} onChange={(e) => setAddrPart({ pin: e.target.value.replace(/\D/g, '').slice(0, 6) })} inputMode="numeric" maxLength={6} placeholder="560038" aria-invalid={badPin ? true : undefined} className={FIELD} />
          {badPin && <span className="mt-xs block text-caption text-ink-soft">{badPin}</span>}
        </FieldLabel>
      </div>

          </>
        );
        const more = (
          <>
        {client && (
          <>
            <Chips label="Status" options={AGENCY_CLIENT_STATUSES} value={status} name={(s) => AGENCY_STATUS_NAME[s]} onChange={setStatus} />
            <Chips label="How it is going" options={AGENCY_HEALTH} value={health} name={(h) => AGENCY_HEALTH_NAME[h]} onChange={setHealth} />
          </>
        )}
        <div className="grid gap-sm md:grid-cols-2">
          <FieldLabel className="mt-sm" label="Name on the invoice">
            <input value={billing.name} onChange={(e) => setBilling({ ...billing, name: e.target.value })} maxLength={120} placeholder={name} className={FIELD} />
          </FieldLabel>
          <FieldLabel className="mt-sm" label="Legal name">
            <input value={billing.line} onChange={(e) => setBilling({ ...billing, line: e.target.value })} maxLength={160} className={FIELD} />
          </FieldLabel>
          <FieldLabel className="mt-sm" label="Billing email">
            <input type="email" value={billing.email} onChange={(e) => setBilling({ ...billing, email: e.target.value })} maxLength={120} placeholder={contactEmail} className={FIELD} />
          </FieldLabel>
          <FieldLabel className="mt-sm" label="Renews on">
            <input type="date" value={renewal} onChange={(e) => setRenewal(e.target.value)} className={FIELD} />
          </FieldLabel>
        </div>
        <div className="mt-sm">
          <p className="m-0 text-subhead font-semibold">Other tax numbers</p>
          {billing.taxIds.map((t, i) =>
            t.label === GST_LABEL ? null : (
              <div key={i} className="mt-xs flex gap-xs">
                <input value={t.label} onChange={(e) => setId(i, { label: e.target.value })} maxLength={20} placeholder="PAN" aria-label="Tax number name" className="min-h-[44px] w-[28%] rounded-tile border-2 border-line bg-paper px-sm text-body" />
                <input value={t.value} onChange={(e) => setId(i, { value: e.target.value })} maxLength={40} placeholder="The number" aria-label="Tax number" className="min-h-[44px] min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm text-body" />
                <Button variant="outline" size="sm" onClick={() => setBilling({ ...billing, taxIds: billing.taxIds.filter((_, j) => j !== i) })} aria-label="Remove this number">
                  Remove
                </Button>
              </div>
            ),
          )}
          {billing.taxIds.length < 4 && (
            <div className="mt-xs">
              <Button variant="outline" size="sm" full onClick={() => setBilling({ ...billing, taxIds: [...billing.taxIds, { label: '', value: '' }] })}>
                Add a tax number
              </Button>
            </div>
          )}
        </div>
        <FieldLabel className="mt-sm" label="Notes, only for you">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={AGENCY_NOTES_MAX} className={FIELD} />
        </FieldLabel>
          </>
        );
        // Adding: the three fields above, and everything else optional behind one fold. Changing: the details, then the fold.
        return client ? (
          <>
            {details}
            <Fold className="mt-md" title="More details" hint="status, billing names, renewal, notes">
              {more}
            </Fold>
          </>
        ) : (
          <Fold className="mt-md" title="More details" hint="optional: contact, channels, fees, billing">
            {details}
            {more}
          </Fold>
        );
      })()}

      {client && (
        <>
          <h3 className="mt-md text-headline">Served through Army</h3>
          <p className="m-0 text-subhead text-ink-soft">{campaigns.length === 0 && !detail.isPending ? COPY.armyNone : COPY.army}</p>
          {campaigns.length > 0 && (
            <>
              <FieldLabel className="mt-sm" label="Campaign">
                <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={FIELD}>
                  <option value="">No campaign</option>
                  {campaigns.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}, {k.brand}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <div className="mt-xs flex flex-wrap items-center gap-sm">
                <Button variant="outline" size="sm" disabled={!campaignId || campaignId !== (client.campaignId ?? '') || importIt.isPending} onClick={() => importIt.mutate()}>
                  Add its deliverables
                </Button>
                {campaignId && campaignId !== (client.campaignId ?? '') && <span className="text-caption text-ink-soft">{COPY.armySave}</span>}
                {imported !== null && (
                  <span role="status" className="text-subhead">
                    {imported === 0 ? 'Nothing new to add.' : `Added ${imported} ${imported === 1 ? 'deliverable' : 'deliverables'}.`}
                  </span>
                )}
                {importIt.isError && (
                  <span role="alert" className="text-subhead">
                    That did not work. Try again.
                  </span>
                )}
              </div>
            </>
          )}
        </>
      )}

      {(save.isError || remove.isError) && (
        <p role="alert" className="mt-sm m-0 text-subhead">
          {!client && save.error instanceof Error && save.error.message ? sentence(save.error.message) : COPY.saveFail}
        </p>
      )}
      <StickyAction className="mt-md flex flex-wrap items-center gap-xs">
        <Button type="submit" className="flex-1" disabled={save.isPending || !name.trim() || badRetainer || Boolean(badPin) || (!client && (!contactEmail.trim() || !password || Boolean(passwordBad)))}>
          {save.isPending ? 'Saving' : client ? 'Save changes' : 'Add'}
        </Button>
        {client &&
          (confirm ? (
            <>
              <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className={RED_YES}>
                Yes, remove it
              </button>
              <Button variant="outline" onClick={() => setConfirm(false)}>
                Keep it
              </Button>
              <p className="m-0 basis-full text-subhead text-ink-soft">{COPY.removeAsk}</p>
            </>
          ) : (
            <Button variant="outline" onClick={() => setConfirm(true)}>
              Remove
            </Button>
          ))}
      </StickyAction>
    </form>
  );
}

/**
 * After a client is added: the note to send them (the link to their page, never the password), Copy link, and the password once, to
 * send by a different channel. The note is the `portal-invite` one, filled from the business profile.
 */
function Invite({ name, contactName, token, password, profile, onClose }: { name: string; contactName: string; token: string; password: string; profile: BusinessProfile | null; onClose: () => void }) {
  const link = `${window.location.origin}/a/${token}`;
  const first = contactName.split(/\s+/)[0] ?? '';
  const mail = fillEmail('portal-invite', {
    ...emptyEmailVars(),
    names: first ? `${first} and ${name} team` : `${name} team`,
    link,
    signName: profile?.signerName ?? '',
    signStudio: profile?.from.name ?? '',
    signPhone: profile?.from.phone ?? '',
    signEmail: profile?.from.email ?? '',
  });
  const note = useCopy();
  const linkCopy = useCopy();
  return (
    <div className="pb-xl">
      <p className="m-0 text-headline">{`${name} is added. Their page is ready.`}</p>
      <pre className="legal-text mt-sm" tabIndex={0} aria-label="The email to send, ready to paste">
        {`Subject: ${mail.subject}\n\n${mail.body}`}
      </pre>
      <div className="mt-sm flex flex-wrap items-center gap-xs">
        <Button size="sm" onClick={() => void note.copy(`Subject: ${mail.subject}\n\n${mail.body}`)}>
          Copy the email
        </Button>
        <Button size="sm" variant="outline" onClick={() => void linkCopy.copy(link)}>
          Copy link
        </Button>
        {(note.said || linkCopy.said) && (
          <span role="status" className="text-subhead">
            {note.said || linkCopy.said}
          </span>
        )}
      </div>
      <div className="mt-md">
        <ShownOnce password={password} note={COPY.separately} />
      </div>
      <div className="mt-md">
        <Button variant="outline" full onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
