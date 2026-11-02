import { AGENCY_CHANNELS, AGENCY_CLIENT_STATUSES, AGENCY_HEALTH, AGENCY_HEALTH_NAME, AGENCY_NAME_MAX, AGENCY_NOTES_MAX, AGENCY_STATUS_NAME, type AgencyClient, type AgencyClientStatus, type AgencyHealth, type InvoiceParty } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { Button } from './Button';
import { Sheet } from './Sheet';
import { Toggle } from './Toggle';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';

const COPY = {
  addTitle: 'Add a client',
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

const toMajor = (cents: number): string => (cents === 0 ? '' : cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));
const toCents = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};
const whole = (v: string): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="mt-sm block text-[14px] font-bold">
      {label}
      {children}
      {hint && <span className="mt-xs block text-[12px] font-semibold text-ink-soft">{hint}</span>}
    </label>
  );
}

function Chips<T extends string>({ label, options, value, name, onChange }: { label: string; options: readonly T[]; value: T; name: (v: T) => string; onChange: (v: T) => void }) {
  return (
    <div className="mt-sm">
      <p className="m-0 text-[14px] font-bold">{label}</p>
      <div role="radiogroup" aria-label={label} className="mt-xs flex flex-wrap gap-xs">
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)} className={`toy min-h-[44px] rounded-pill border-2 px-md text-[14px] font-bold ${value === o ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
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
  const [confirm, setConfirm] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  // A new client starts with a password on its link unless the owner says otherwise; the generated one is shown once, here.
  const [askPassword, setAskPassword] = useState(true);
  const [made, setMade] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const detail = useAuthed(['agency', 'client', client?.id ?? 'new'], () => api.agencyClient(client!.id), Boolean(client));
  const campaigns = detail.data?.campaigns ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ['agency'] });

  const body = () => ({
    name: name.trim(),
    contactName: contactName.trim(),
    contactEmail: contactEmail.trim(),
    status,
    health,
    channels,
    retainerCents: toCents(retainer),
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
        return;
      }
      const added = await api.agencyClientAdd({ ...body(), ...(askPassword ? { portalPassword: 'generate' as const } : {}) });
      if (billingFilled) await api.agencyClientUpdate(added.id, { billing });
      return added.password ?? null;
    },
    onSuccess: (password) => {
      invalidate();
      if (password) setMade(password);
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

  if (made) {
    return (
      <div>
        <p className="m-0 text-[16px] font-bold">{`${name.trim()} is added, with a password on their link.`}</p>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Here is the password. It is shown once, and we keep only a scrambled copy. Send it to your client separately from the link. You can make a new one any time from their page.</p>
        <input readOnly value={made} aria-label="The password" onFocus={(e) => e.currentTarget.select()} className="mt-sm w-full rounded-tile border-2 border-line bg-paper px-sm py-sm font-mono text-[16px]" />
        <div className="mt-sm flex flex-wrap gap-xs">
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(made);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            I have saved it
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (name.trim()) save.mutate();
      }}
    >
      <Field label={COPY.name}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={AGENCY_NAME_MAX} required className={field} />
      </Field>
      <div className="grid gap-sm md:grid-cols-2">
        <Field label="Contact name">
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={AGENCY_NAME_MAX} className={field} />
        </Field>
        <Field label="Contact email">
          <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} maxLength={120} className={field} />
        </Field>
      </div>
      <Chips label="Status" options={AGENCY_CLIENT_STATUSES} value={status} name={(s) => AGENCY_STATUS_NAME[s]} onChange={setStatus} />
      <Chips label="How it is going" options={AGENCY_HEALTH} value={health} name={(h) => AGENCY_HEALTH_NAME[h]} onChange={setHealth} />

      <div className="mt-sm">
        <p className="m-0 text-[14px] font-bold">Channels you make for</p>
        <div className="mt-xs flex flex-wrap gap-xs">
          {[...AGENCY_CHANNELS, ...channels.filter((c) => !(AGENCY_CHANNELS as readonly string[]).includes(c))].map((c) => {
            const on = channels.some((x) => x.toLowerCase() === c.toLowerCase());
            return (
              <button key={c} type="button" aria-pressed={on} onClick={() => setChannels(on ? channels.filter((x) => x.toLowerCase() !== c.toLowerCase()) : [...channels, c])} className={`toy min-h-[44px] rounded-pill border-2 px-md text-[14px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
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
            className="min-h-[44px] min-w-0 flex-1 rounded-pill border-2 border-line bg-paper px-sm text-[16px]"
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

      <div className="grid gap-sm md:grid-cols-3">
        <Field label="Retainer a month" hint={COPY.money}>
          <input inputMode="decimal" value={retainer} onChange={(e) => setRetainer(e.target.value)} className={field} />
        </Field>
        <Field label="Deliverables a month">
          <input inputMode="numeric" value={pieces} onChange={(e) => setPieces(e.target.value)} className={field} />
        </Field>
        <Field label="Hours a month">
          <input inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} className={field} />
        </Field>
      </div>
      <Field label="Renews on">
        <input type="date" value={renewal} onChange={(e) => setRenewal(e.target.value)} className={field} />
      </Field>
      <Field label="Notes, only for you">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={AGENCY_NOTES_MAX} className={field} />
      </Field>

      {!client && (
        <div className="mt-md">
          <Toggle on={askPassword} onChange={setAskPassword} label="Ask for a password at their link" hint="Recommended. We make one and show it once, so you can send it to them. Without it, anyone with the link can open their page." />
        </div>
      )}

      <h3 className="mt-md text-[18px]">Billing details</h3>
      <p className="m-0 text-[14px] font-semibold text-ink-soft">{COPY.billing}</p>
      <div className="grid gap-sm md:grid-cols-2">
        <Field label="Name on the invoice">
          <input value={billing.name} onChange={(e) => setBilling({ ...billing, name: e.target.value })} maxLength={120} placeholder={name} className={field} />
        </Field>
        <Field label="Legal name">
          <input value={billing.line} onChange={(e) => setBilling({ ...billing, line: e.target.value })} maxLength={160} className={field} />
        </Field>
      </div>
      <Field label="Address">
        <textarea value={billing.address} onChange={(e) => setBilling({ ...billing, address: e.target.value })} rows={2} maxLength={300} className={field} />
      </Field>
      <div className="grid gap-sm md:grid-cols-2">
        <Field label="Billing email">
          <input type="email" value={billing.email} onChange={(e) => setBilling({ ...billing, email: e.target.value })} maxLength={120} placeholder={contactEmail} className={field} />
        </Field>
        <Field label="Phone">
          <input value={billing.phone} onChange={(e) => setBilling({ ...billing, phone: e.target.value })} maxLength={40} className={field} />
        </Field>
      </div>
      <div className="mt-sm">
        <p className="m-0 text-[14px] font-bold">Tax numbers</p>
        {billing.taxIds.map((t, i) => (
          <div key={i} className="mt-xs flex gap-xs">
            <input value={t.label} onChange={(e) => setId(i, { label: e.target.value })} maxLength={20} placeholder="GSTIN" aria-label="Tax number name" className="min-h-[44px] w-[28%] rounded-tile border-2 border-line bg-paper px-sm text-[16px]" />
            <input value={t.value} onChange={(e) => setId(i, { value: e.target.value })} maxLength={40} placeholder="The number" aria-label="Tax number" className="min-h-[44px] min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm text-[16px]" />
            <Button variant="outline" size="sm" onClick={() => setBilling({ ...billing, taxIds: billing.taxIds.filter((_, j) => j !== i) })} aria-label="Remove this number">
              Remove
            </Button>
          </div>
        ))}
        {billing.taxIds.length < 4 && (
          <div className="mt-xs">
            <Button variant="outline" size="sm" onClick={() => setBilling({ ...billing, taxIds: [...billing.taxIds, { label: '', value: '' }] })}>
              Add a tax number
            </Button>
          </div>
        )}
      </div>

      {client && (
        <>
          <h3 className="mt-md text-[18px]">Served through Army</h3>
          <p className="m-0 text-[14px] font-semibold text-ink-soft">{campaigns.length === 0 && !detail.isPending ? COPY.armyNone : COPY.army}</p>
          {campaigns.length > 0 && (
            <>
              <Field label="Campaign">
                <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={field}>
                  <option value="">No campaign</option>
                  {campaigns.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}, {k.brand}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="mt-xs flex flex-wrap items-center gap-sm">
                <Button variant="outline" size="sm" disabled={!campaignId || campaignId !== (client.campaignId ?? '') || importIt.isPending} onClick={() => importIt.mutate()}>
                  Add its deliverables
                </Button>
                {campaignId && campaignId !== (client.campaignId ?? '') && <span className="text-[12px] font-bold text-ink-soft">{COPY.armySave}</span>}
                {imported !== null && (
                  <span role="status" className="text-[14px] font-bold">
                    {imported === 0 ? 'Nothing new to add.' : `Added ${imported} ${imported === 1 ? 'deliverable' : 'deliverables'}.`}
                  </span>
                )}
                {importIt.isError && (
                  <span role="alert" className="text-[14px] font-bold">
                    That did not work. Try again.
                  </span>
                )}
              </div>
            </>
          )}
        </>
      )}

      {(save.isError || remove.isError) && (
        <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
          {COPY.saveFail}
        </p>
      )}
      <div className="mt-md flex flex-wrap items-center gap-xs">
        <Button type="submit" disabled={save.isPending || !name.trim()}>
          {save.isPending ? 'Saving' : client ? 'Save changes' : 'Add the client'}
        </Button>
        {client &&
          (confirm ? (
            <>
              <Button variant="outline" onClick={() => remove.mutate()} disabled={remove.isPending}>
                Yes, remove it
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Keep it
              </Button>
              <p className="m-0 basis-full text-[14px] font-semibold text-ink-soft">{COPY.removeAsk}</p>
            </>
          ) : (
            <Button variant="outline" onClick={() => setConfirm(true)}>
              Remove
            </Button>
          ))}
      </div>
    </form>
  );
}
