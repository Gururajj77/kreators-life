import {
  CONTRACT_VARS,
  contractVarGroups,
  contractVarsFor,
  contractVarsUsed,
  docVars,
  formatCount,
  PHONE_HINT,
  phoneProblem,
  typedCents,
  type AgencyClientPage,
  type BusinessProfile,
  type ContractClientFacts,
  type ContractDoc,
  type ContractVarFrom,
} from '@kreators/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useAgencyTeam } from '../lib/agencyWorkspace';
import { useAuthed } from '../lib/queries';
import { FIELD, LABEL } from '../lib/ui';
import { Button } from './Button';
import { ErrorLine } from './ErrorLine';
import { Sheet } from './Sheet';
import { Busy, Skeleton } from './Skeleton';
import { StatusTag } from './StatusTag';

/**
 * "Fill in the details": every blank a document's words use, in one form, grouped by where it is kept. Your business goes to the business
 * profile (PUT /agency/settings), the client to their record (PATCH /agency/clients/:id, and the changes per piece through the lifecycle
 * route), and the rest onto this document's own variables, which the page saves as it saves the paper (its version guard and its 409).
 * A record field the form changed updates the same words on this paper; a word the owner typed by hand on the paper is left alone unless
 * the form changed it. Agency settings opens the same sheet with the business group only.
 */

type Kind = 'text' | 'long' | 'email' | 'phone' | 'count' | 'money' | 'list';
interface ProfileDef {
  id: string;
  /** The variables it fills, the first one the label's and the paper's own. */
  vars: readonly string[];
  kind?: Kind;
  label?: string;
  optional?: boolean;
  hint?: string;
  read: (p: BusinessProfile) => string;
}
interface ClientDef {
  id: string;
  vars: readonly string[];
  kind?: Kind;
  label?: string;
  optional?: boolean;
  hint?: string;
  read: (c: AgencyClientPage) => string;
}

const units = (cents: number) => (cents > 0 ? `${Math.floor(cents / 100)}${cents % 100 ? `.${String(cents % 100).padStart(2, '0')}` : ''}` : '');
const whole = (n: number | undefined) => (typeof n === 'number' && n > 0 ? String(n) : '');

const PROFILE_FIELDS: readonly ProfileDef[] = [
  { id: 'signerName', vars: ['provider'], read: (p) => p.signerName },
  { id: 'signerTitle', vars: ['providerTitle', 'providerDesignation'], hint: 'How you sign, like Founder.', read: (p) => p.signerTitle },
  { id: 'businessName', vars: ['providerBusiness'], read: (p) => p.businessName || p.from.name },
  { id: 'operatingUnder', vars: ['providerBrand'], read: (p) => p.operatingUnder || p.brandName },
  { id: 'brandName', vars: ['brandName'], read: (p) => p.brandName },
  { id: 'businessAddress', vars: ['providerAddress'], kind: 'long', read: (p) => p.businessAddress || p.from.address },
  { id: 'email1', vars: ['providerEmail'], kind: 'email', read: (p) => p.emails[0] || p.from.email },
  { id: 'email2', vars: ['providerEmail2'], kind: 'email', optional: true, read: (p) => p.emails[1] ?? '' },
  { id: 'phone1', vars: ['providerPhone', 'providerPhones'], kind: 'phone', label: 'Your phone', read: (p) => p.phones[0] || p.from.phone },
  { id: 'phone2', vars: ['providerPhones'], kind: 'phone', label: 'Your second phone', optional: true, read: (p) => p.phones[1] ?? '' },
  { id: 'jurisdiction', vars: ['jurisdiction'], hint: 'The city whose courts hear a dispute.', read: (p) => p.jurisdiction },
  { id: 'formatName', vars: ['formatName'], read: (p) => p.formatName },
  { id: 'formatNameInline', vars: ['formatNameInline'], read: (p) => p.formatNameInline },
  { id: 'pastClients', vars: ['pastClients'], kind: 'long', hint: 'Brand names, like Brand A, Brand B.', read: (p) => p.pastClients },
];
const CLIENT_FIELDS: readonly ClientDef[] = [
  { id: 'name', vars: ['client'], label: "Client's name", read: (c) => c.client.name },
  { id: 'address', vars: ['clientAddress'], kind: 'long', read: (c) => c.client.billing.address },
  { id: 'contactName', vars: ['clientContact'], read: (c) => c.client.contactName || c.onboarding.answers?.pocName || '' },
  { id: 'contactTitle', vars: ['clientTitle'], read: (c) => c.onboarding.answers?.designation ?? '' },
  { id: 'pieces', vars: ['pieces'], kind: 'count', read: (c) => whole(c.client.piecesPerMonth) },
  { id: 'channels', vars: ['channels'], kind: 'list', hint: 'Put a comma between them.', read: (c) => c.client.channels.join(', ') },
  { id: 'hours', vars: ['hours'], kind: 'count', read: (c) => whole(c.client.hoursPerMonth) },
  { id: 'revisions', vars: ['revisions'], kind: 'count', read: (c) => String(c.lifecycle.revisionsPerPiece) },
  { id: 'retainer', vars: ['monthlyFee'], kind: 'money', hint: 'The amount, like 45,000.', read: (c) => units(c.client.retainerCents) },
];
const VAR_LABEL: Record<string, string> = Object.fromEntries(CONTRACT_VARS.map((v) => [v.key, v.label]));
const VAR_OPTIONAL = new Set<string>(CONTRACT_VARS.filter((v) => 'optional' in v && v.optional).map((v) => v.key));

/** One line of the form: what it is called, where it saves and what it starts as. */
interface Row {
  id: string;
  group: ContractVarFrom;
  label: string;
  optional: boolean;
  kind: Kind;
  hint?: string;
  readOnly: boolean;
  /** What the record (or the paper, for a line kept on the paper) held when the form opened. */
  saved: string;
  start: string;
  target: { profile: ProfileDef } | { client: ClientDef } | { var: string };
}

/** What a record field starts as: the record's value, else the words already on this paper (typed there by hand), so nothing typed is lost. */
function startOf(rec: string, onPaper: string, kind: Kind): string {
  if (rec.trim()) return rec;
  const t = onPaper.trim();
  if (!t || /^_+$/.test(t)) return '';
  if (kind === 'count') return /^\d{1,4}$/.test(t) ? t : '';
  if (kind === 'money') return units(typedCents(t));
  if (kind === 'phone') return t.split(' | ')[0] ?? '';
  return t;
}

function problemOf(row: Row, v: string): string | null {
  const t = v.trim();
  if (row.readOnly) return null;
  if (row.target && 'client' in row.target && row.target.client.id === 'name' && !t) return 'The client needs a name.';
  if (!t) return null;
  if (row.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return 'That email does not look right.';
  if (row.kind === 'phone' && phoneProblem(t)) return phoneProblem(t);
  if (row.kind === 'count' && !/^\d{1,4}$/.test(t)) return 'Type a whole number.';
  if (row.kind === 'money' && 'client' in row.target && typedCents(t) <= 0) return 'Type an amount, like 45,000.';
  return null;
}

/**
 * The business profile with the form's changes in it: only what changed is written, the emails and phones kept as a pair. A phone is
 * checked by phoneProblem (normalizePhone's rule) and kept as typed, as the settings paper keeps it, since the agreement prints it.
 */
function profileWith(p: BusinessProfile, rows: Row[], vals: Record<string, string>): BusinessProfile | null {
  const changed = rows.filter((r) => 'profile' in r.target && !r.readOnly && (vals[r.id] ?? '').trim() !== r.saved.trim());
  if (!changed.length) return null;
  const v = (id: string, fallback: string) => (rows.some((r) => r.id === id && !r.readOnly) ? (vals[id] ?? '').trim() : fallback);
  const next: BusinessProfile = { ...p };
  for (const r of changed) {
    const t = (vals[r.id] ?? '').trim();
    const id = (r.target as { profile: ProfileDef }).profile.id;
    if (id === 'signerName') next.signerName = t;
    else if (id === 'signerTitle') next.signerTitle = t;
    else if (id === 'businessName') next.businessName = t;
    else if (id === 'operatingUnder') next.operatingUnder = t;
    else if (id === 'brandName') next.brandName = t;
    else if (id === 'businessAddress') next.businessAddress = t;
    else if (id === 'jurisdiction') next.jurisdiction = t;
    else if (id === 'formatName') next.formatName = t;
    else if (id === 'formatNameInline') next.formatNameInline = t;
    else if (id === 'pastClients') next.pastClients = t;
  }
  if (changed.some((r) => /^email/.test(r.id))) next.emails = [v('email1', p.emails[0] || p.from.email), v('email2', p.emails[1] ?? '')].filter(Boolean);
  if (changed.some((r) => /^phone/.test(r.id))) next.phones = [v('phone1', p.phones[0] || p.from.phone), v('phone2', p.phones[1] ?? '')].filter(Boolean);
  return next;
}

/** What a client's record gives a document (the same facts the server reads), with the form's changes in it. */
function factsOf(page: AgencyClientPage, currency: string, vals: Record<string, string> = {}): ContractClientFacts {
  const c = page.client;
  const ob = page.onboarding.answers;
  const pick = (id: string, rec: string) => (id in vals ? vals[id]!.trim() : rec);
  const n = (id: string, rec: number) => (id in vals ? Number(vals[id]!.trim()) || 0 : rec);
  return {
    name: pick('name', c.name),
    address: pick('address', c.billing.address),
    contactName: pick('contactName', c.contactName || ob?.pocName || ''),
    contactTitle: pick('contactTitle', ob?.designation ?? ''),
    brands: ob?.brands ?? '',
    channels: 'channels' in vals ? splitList(vals.channels!) : c.channels,
    piecesPerMonth: n('pieces', c.piecesPerMonth),
    hoursPerMonth: n('hours', c.hoursPerMonth),
    revisionsPerPiece: 'revisions' in vals && vals.revisions!.trim() ? Number(vals.revisions) : page.lifecycle.revisionsPerPiece,
    retainerCents: 'retainer' in vals ? typedCents(vals.retainer!.trim() || '0') : c.retainerCents,
    currency,
  };
}
const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 10);

/** The rows for a document, in the order its words name them; or, with no document, every business field (Agency settings). */
function rowsFor(o: { doc: ContractDoc | null; profile: BusinessProfile | null; page: AgencyClientPage | null; owner: boolean; hasClient: boolean; locked: boolean }): Row[] {
  const { doc, profile, page } = o;
  const vars = doc?.vars ?? {};
  if (!doc) {
    return profile ? PROFILE_FIELDS.map((d) => ({ id: d.id, group: 'profile', label: d.label ?? VAR_LABEL[d.vars[d.vars.length - 1]!] ?? d.id, optional: d.optional ?? VAR_OPTIONAL.has(d.vars[0]!), kind: d.kind ?? 'text', hint: d.hint, readOnly: false, saved: d.read(profile), start: d.read(profile), target: { profile: d } })) : [];
  }
  const out: Row[] = [];
  for (const g of contractVarGroups(doc)) {
    const used = g.vars.map((v) => v.key);
    const byPaper = (key: string, readOnly: boolean): Row => ({ id: key, group: g.from, label: VAR_LABEL[key] ?? key, optional: VAR_OPTIONAL.has(key), kind: 'text', readOnly, saved: vars[key] ?? '', start: vars[key] ?? '', target: { var: key } });
    // A signed paper reads only, as it has them. A line kept on the paper is typed there. A record this person may not change (a team
    // member) reads only from the paper; the client's lines on a paper with no client are kept on the paper.
    const fromRecord = !o.locked && o.owner && (g.from === 'profile' ? Boolean(profile) : g.from === 'client' ? Boolean(page) : false);
    if (!fromRecord) {
      const editable = !o.locked && (g.from === 'typed' || (g.from === 'client' && o.owner && !o.hasClient));
      out.push(...used.map((k) => byPaper(k, !editable)));
      continue;
    }
    const defs = (g.from === 'profile' ? PROFILE_FIELDS : CLIENT_FIELDS) as readonly (ProfileDef | ClientDef)[];
    const placed = defs
      .map((d) => ({ d, at: Math.min(...d.vars.map((k) => (used.includes(k) ? used.indexOf(k) : Infinity))) }))
      .filter((x) => Number.isFinite(x.at))
      .sort((a, b) => a.at - b.at);
    for (const { d } of placed) {
      const first = d.vars.find((k) => used.includes(k))!;
      const rec = g.from === 'profile' ? (d as ProfileDef).read(profile!) : (d as ClientDef).read(page!);
      const onPaper = d.id === 'phone2' ? '' : (vars[d.vars[0]!] ?? '');
      out.push({
        id: d.id,
        group: g.from,
        label: d.label ?? VAR_LABEL[first] ?? d.id,
        optional: d.optional ?? VAR_OPTIONAL.has(first),
        kind: d.kind ?? 'text',
        hint: d.kind === 'phone' && !d.optional ? PHONE_HINT : d.hint,
        readOnly: false,
        saved: rec,
        start: startOf(rec, onPaper, d.kind ?? 'text'),
        target: g.from === 'profile' ? { profile: d as ProfileDef } : { client: d as ClientDef },
      });
    }
  }
  return out;
}

const GROUP_NAME: Record<ContractVarFrom, string> = { profile: 'Your business', client: 'The client', typed: '' };

interface Props {
  open: boolean;
  onClose: () => void;
  /** The document whose blanks it lists; null on Agency settings, where it lists the business details only. */
  doc: ContractDoc | null;
  /** "agreement" or "document", in the words. */
  noun?: 'agreement' | 'document';
  clientId?: string | null;
  /** A signed or approved one is a record: the form reads only, with the page's own Revise. */
  record?: { why: string; revise?: ReactNode } | null;
  /** The words for this paper, set on the page's copy so they show at once and save with the paper. */
  onDocVars?: (changes: Record<string, string>) => void;
  /** On Agency settings: the business profile on the page, and where its changes go (the page saves as it goes). */
  profile?: BusinessProfile;
  onProfile?: (next: BusinessProfile) => void;
  /** A short line after saving, for the page's save line. */
  onSaved?: (words: string) => void;
}

export function FillDetailsSheet({ open, onClose, doc, noun = 'agreement', clientId = null, record = null, onDocVars, profile: pageProfile, onProfile, onSaved }: Props) {
  const qc = useQueryClient();
  const { team } = useAgencyTeam();
  const owner = !team;
  const onSettings = !doc;
  const settings = useAuthed(['agency', 'settings'], () => api.agency(), open && owner && !onSettings);
  const page = useAuthed(['agency', 'client', clientId ?? ''], () => api.agencyClient(clientId ?? ''), open && owner && Boolean(clientId) && !onSettings);
  const profile = onSettings ? (pageProfile ?? null) : owner ? (settings.data?.settings.profile ?? null) : null;
  const clientPage = owner && clientId ? (page.data ?? null) : null;
  const loading = open && !onSettings && owner && (settings.isPending || (Boolean(clientId) && page.isPending));
  const locked = Boolean(record);
  const rows = useMemo(() => rowsFor({ doc, profile, page: clientPage, owner, hasClient: Boolean(clientId), locked }), [doc, profile, clientPage, owner, clientId, locked]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  // The form starts from the records each time it opens (and once they have loaded), never from a half-typed earlier visit.
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    if (shown || loading) return;
    setVals(Object.fromEntries(rows.map((r) => [r.id, r.start])));
    setErr(null);
    setShown(true);
  }, [open, loading, shown, rows]);
  useEffect(() => {
    if (open && !onSettings && owner) void settings.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const val = (r: Row) => vals[r.id] ?? r.start;
  const needed = rows.filter((r) => !r.optional);
  const missing = needed.filter((r) => !val(r).trim()).length;
  const problems = Object.fromEntries(rows.map((r) => [r.id, problemOf(r, val(r))]));
  const blocked = rows.some((r) => problems[r.id]);
  const thing = noun === 'agreement' ? 'agreement' : 'document';
  const clientName = clientPage?.client.name || '';

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const all: Record<string, string> = Object.fromEntries(rows.map((r) => [r.id, val(r)]));
      if (onSettings) {
        const next = pageProfile ? profileWith(pageProfile, rows, all) : null;
        if (next) onProfile?.(next);
        onSaved?.(next ? 'Your business details are saved.' : 'Nothing changed.');
        onClose();
        return;
      }
      const changes: Record<string, string> = {};
      // Your business: one save of the whole profile, as Agency settings saves it.
      const oldProfile = profile;
      const newProfile = oldProfile ? (profileWith(oldProfile, rows, all) ?? oldProfile) : null;
      if (oldProfile && newProfile !== oldProfile) await api.agencySettings({ profile: newProfile! });
      // The client: their record, and the changes included in each piece through the route that keeps them.
      const clientRows = rows.filter((r) => 'client' in r.target && !r.readOnly);
      const changedClient = clientRows.filter((r) => val(r).trim() !== r.saved.trim());
      const clientVals: Record<string, string> = Object.fromEntries(changedClient.map((r) => [(r.target as { client: ClientDef }).client.id, val(r)]));
      if (clientPage && clientId && changedClient.length) {
        const c = clientPage.client;
        const body: Parameters<typeof api.agencyClientUpdate>[1] = {};
        if ('name' in clientVals) body.name = clientVals.name!.trim();
        if ('contactName' in clientVals) body.contactName = clientVals.contactName!.trim();
        if ('address' in clientVals) body.billing = { ...c.billing, name: c.billing.name === c.name ? '' : c.billing.name, email: c.billing.email === c.contactEmail ? '' : c.billing.email, address: clientVals.address!.trim() };
        if ('channels' in clientVals) body.channels = splitList(clientVals.channels!);
        if ('pieces' in clientVals) body.piecesPerMonth = Number(clientVals.pieces!.trim()) || 0;
        if ('hours' in clientVals) body.hoursPerMonth = Number(clientVals.hours!.trim()) || 0;
        if ('retainer' in clientVals) body.retainerCents = clientVals.retainer!.trim() ? typedCents(clientVals.retainer!) : 0;
        if ('contactTitle' in clientVals) body.onboarding = { ...(clientPage.onboarding.answers ?? ({} as NonNullable<typeof clientPage.onboarding.answers>)), designation: clientVals.contactTitle!.trim() };
        if (Object.keys(body).length) await api.agencyClientUpdate(clientId, body);
        if ('revisions' in clientVals && clientVals.revisions!.trim()) await api.agencyLifecycleSave(clientId, { revisionsPerPiece: Number(clientVals.revisions) });
      }
      // This paper: a word a record field changed is changed here too, a blank the records now fill is filled, and a word typed by hand
      // on the paper stays unless the form changed it. A line kept on the paper is written as typed.
      const currency = settings.data?.settings.currency ?? 'INR';
      const before = oldProfile ? contractVarsFor(oldProfile, clientPage ? factsOf(clientPage, currency) : null) : null;
      const after = newProfile ? contractVarsFor(newProfile, clientPage ? factsOf(clientPage, currency, clientVals) : null) : null;
      const docVarsNow = doc!.vars;
      for (const r of rows) {
        if (r.readOnly) continue;
        if ('var' in r.target) {
          const t = val(r).trim();
          if (t !== (docVarsNow[r.target.var] ?? '').trim()) changes[r.target.var] = t;
          continue;
        }
        if (!before || !after) continue;
        for (const k of (('profile' in r.target ? r.target.profile : r.target.client) as ProfileDef | ClientDef).vars) {
          if (!(k in after)) continue;
          if ((after[k] ?? '') !== (before[k] ?? '')) changes[k] = after[k] ?? '';
          else if (!(docVarsNow[k] ?? '').trim() && (after[k] ?? '').trim()) changes[k] = after[k]!;
        }
      }
      if (Object.keys(changes).length) onDocVars?.(changes);
      void qc.invalidateQueries({ queryKey: ['agency', 'settings'] });
      if (clientId) void qc.invalidateQueries({ queryKey: ['agency', 'client', clientId] });
      void qc.invalidateQueries({ queryKey: ['agency', 'clients-pick'] });
      onSaved?.('Details saved.');
      onClose();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const groups = (['profile', 'client', 'typed'] as const).map((g) => ({ g, rows: rows.filter((r) => r.group === g) })).filter((x) => x.rows.length > 0);
  const where = (g: ContractVarFrom, rs: Row[]): string => {
    if (locked) return g === 'typed' ? `As this ${thing} has them.` : `As this ${thing} has them, not as they are now.`;
    if (g === 'typed') return `Kept on this ${thing} only.`;
    if (rs.every((r) => r.readOnly)) return 'Only the owner of this Agency changes these.';
    if (g === 'profile') return onSettings ? 'Saved to your business profile. Every new paper starts from it.' : `Saved to your business profile, for this ${thing} and every new one.`;
    return 'var' in rs[0]!.target ? `No client is picked, so these stay on this ${thing} only.` : `Saved to the record for ${clientName || 'this client'}, for this ${thing} and their next ones.`;
  };
  const hasPackages = Boolean(doc?.sections.some((s) => s.kind === 'packages')) || onSettings;

  return (
    <Sheet open={open} onClose={onClose} title={onSettings ? 'Your business details' : 'Fill in the details'}>
      {loading || (open && !shown) ? (
        <Busy label="Loading the details" className="grid gap-sm pb-xl">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[72px] w-full" />
          ))}
        </Busy>
      ) : (
        <form
          className="grid gap-md pb-xl"
          onSubmit={(e) => {
            e.preventDefault();
            if (!locked && !blocked && !busy) void save();
          }}
        >
          <p role="status" className="m-0 text-balance text-subhead">
            {rows.length === 0
              ? `This ${thing} has no blanks to fill in.`
              : missing
                ? `${formatCount(missing)} of ${formatCount(needed.length)} details ${locked ? 'were left empty' : 'are not filled yet'}.`
                : `All ${formatCount(needed.length)} details are filled.`}
          </p>
          {record && (
            <div className="grid gap-sm rounded-tile bg-paper p-sm">
              <p className="m-0 text-balance text-subhead">{record.why}</p>
              {record.revise}
            </div>
          )}
          {groups.map(({ g, rows: rs }) => (
            <section key={g} aria-labelledby={`fill-${g}`} className="grid gap-sm">
              <div>
                <h3 id={`fill-${g}`} className="m-0 text-headline">
                  {GROUP_NAME[g] || `This ${thing} only`}
                </h3>
                <p className="m-0 text-balance text-subhead text-ink-soft">{where(g, rs)}</p>
              </div>
              {rs.map((r) => (
                <FillRow key={r.id} row={r} value={val(r)} problem={problems[r.id] ?? null} onChange={(v) => setVals((s) => ({ ...s, [r.id]: v }))} />
              ))}
            </section>
          ))}
          {hasPackages &&
            (onSettings ? (
              <p className="m-0 text-balance text-subhead text-ink-soft">Your packages and prices are in the table on the agreement paper.</p>
            ) : (
              <div>
                <p className="m-0 text-balance text-subhead text-ink-soft">{`Prices are in the table on the ${thing}. Every new one starts from your packages.`}</p>
                <Link to="/agency?tab=settings" className="inline-flex min-h-[44px] items-center text-subhead text-ink underline underline-offset-2">
                  Change your packages in Agency settings
                </Link>
              </div>
            ))}
          <ErrorLine e={err} />
          <div className="flex flex-wrap gap-xs">
            {!locked && rows.some((r) => !r.readOnly) && (
              <Button type="submit" disabled={busy || blocked}>
                {busy ? 'Saving' : 'Save details'}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={onClose}>
              {locked ? 'Close' : 'Cancel'}
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}

function FillRow({ row, value, problem, onChange }: { row: Row; value: string; problem: string | null; onChange: (v: string) => void }) {
  const id = useId();
  const hint = `${id}-hint`;
  const empty = !value.trim();
  const common = {
    id,
    value,
    readOnly: row.readOnly,
    'aria-invalid': problem ? true : undefined,
    'aria-describedby': row.hint || problem ? hint : undefined,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
    className: `${FIELD} ${row.readOnly ? 'opacity-80' : ''}`,
  };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-sm gap-y-xs">
        <label htmlFor={id} className={LABEL}>
          {row.label}
        </label>
        {row.optional ? <span className="text-caption text-ink-soft">Optional</span> : empty ? <StatusTag tone="warn">Not filled yet</StatusTag> : null}
      </div>
      {row.kind === 'long' ? (
        <textarea {...common} rows={3} maxLength={row.id === 'pastClients' ? 600 : 300} />
      ) : (
        <input
          {...common}
          type={row.kind === 'email' ? 'email' : row.kind === 'phone' ? 'tel' : 'text'}
          inputMode={row.kind === 'count' ? 'numeric' : row.kind === 'money' ? 'decimal' : undefined}
          autoComplete="off"
          maxLength={row.kind === 'list' ? 300 : 120}
        />
      )}
      {(row.hint || problem) && (
        <span id={hint} className={`mt-xs block text-caption ${problem ? 'font-semibold text-ink' : 'text-ink-soft'}`}>
          {problem ?? row.hint}
        </span>
      )}
    </div>
  );
}

/** How many blanks a document still has that its client copy would leave out: the main action on a draft until it is none. */
export function blanksIn(doc: ContractDoc): number {
  const filled = docVars(doc);
  return contractVarsUsed(doc).filter((k) => !VAR_OPTIONAL.has(k) && !(filled[k] ?? '').trim()).length;
}
