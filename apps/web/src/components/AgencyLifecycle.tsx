import {
  AGENCY_STAGE_BY_KEY,
  PORTAL_PASSWORD_MIN,
  RETAINER_DEFAULT_OPTIONS,
  RETAINER_MONTHS_MAX,
  RETAINER_OPTIONS_MAX,
  RETAINER_STATUS_NAME,
  RETAINER_STATUS_TONE,
  REVISIONS_MAX,
  TRIAL_RULES,
  money,
  moveProblem,
  nextStage,
  portalPasswordProblem,
  previousStage,
  retainerMonthlyCents,
  retainerTotalCents,
  stageIndex,
  typedCents,
  type AgencyClient,
  type AgencyRetainer,
  type ClientLifecycle,
  type RetainerOption,
} from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, api } from '../lib/api';
import { prettyDate, todayLocal } from '../lib/date';
import { Button } from './Button';
import { Fold } from './Fold';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';
import { Toggle } from './Toggle';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';

const failed = (e: unknown): string => (e instanceof ApiError ? e.message : 'That did not go through. Try again.');
const day = (d: string | null): string => (d ? prettyDate(d) : 'not set');

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="mt-sm block text-[14px] font-bold">
      {label}
      {children}
      {hint && <span className="mt-xs block text-[12px] font-semibold text-ink-soft">{hint}</span>}
    </label>
  );
}

/** A short card with what is set now and its own Edit button, like the invoice and agreement editors. */
function LifeCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="min-w-0 flex-1">
        <h3 className="m-0 text-[16px] font-extrabold">{title}</h3>
        <div className="mt-xs text-[14px] font-semibold text-ink-soft">{children}</div>
      </div>
      {action}
    </li>
  );
}

function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['agency'] });
}

// ---- the lifecycle: stage, what each side does, the checklist, the days, the trial rules and what happened

/** The way a client goes from enquiry to monthly delivery, as the owner works it: move along, tick the steps, set the days, see the log. */
export function LifecycleCard({ client, life }: { client: AgencyClient; life: ClientLifecycle }) {
  const refresh = useRefresh();
  const [editing, setEditing] = useState(false);
  const [confirmBack, setConfirmBack] = useState(false);
  const stage = AGENCY_STAGE_BY_KEY[life.stage];
  const next = nextStage(life.stage);
  const prev = previousStage(life.stage);
  const facts = { offerOpen: life.retainer?.status === 'offered' || life.retainer?.status === 'chosen', retainerActive: life.retainer?.status === 'active' };
  const problem = next ? moveProblem(life.stage, next, facts) : null;
  const move = useMutation({ mutationFn: (v: { to: typeof life.stage; undo: boolean }) => api.agencyStageMove(client.id, v.to, v.undo), onSuccess: () => { setConfirmBack(false); void refresh(); } });
  const tick = useMutation({ mutationFn: (v: { key: string; done: boolean }) => api.agencyChecklist(client.id, v.key, v.done), onSuccess: () => refresh() });
  const trial = useMutation({ mutationFn: () => api.agencyTrialVideo(client.id), onSuccess: () => refresh() });
  const done = stage.steps.filter((s) => life.ticks[`${stage.key}:${s.key}`]).length;
  const d = life.dates;

  return (
    <div>
      <ul className="m-0 flex list-none flex-col gap-xs p-0">
        <LifeCard title="Right now">
          <span className="block">{stage.line}</span>
          <span className="mt-xs block">
            <strong className="text-ink">The client:</strong> {stage.clientDoes}
          </span>
          <span className="mt-xs block">
            <strong className="text-ink">You:</strong> {stage.ownerDoes}
          </span>
        </LifeCard>

        <li className="rounded-tile bg-card p-sm shadow-toy-soft">
          <h3 className="m-0 text-[16px] font-extrabold">{`Checklist for this stage, ${done} of ${stage.steps.length}`}</h3>
          <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
            {stage.steps.map((s) => {
              const key = `${stage.key}:${s.key}`;
              return (
                <li key={s.key}>
                  <Toggle compact on={Boolean(life.ticks[key])} onChange={(v) => tick.mutate({ key, done: v })} label={s.text} disabled={tick.isPending} />
                </li>
              );
            })}
          </ul>
        </li>

        <LifeCard
          title="Days"
          action={
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} aria-label="Edit days">
              Edit
            </Button>
          }
        >
          <span className="block">{`Strategy session: ${day(d.strategyDay)}${d.strategyLink ? ', call link added' : ''}`}</span>
          <span className="block">{`Trial video due: ${day(d.trialDue)}`}</span>
          <span className="block">{`Pilot: ${d.pilotStart || d.pilotEnd ? `${day(d.pilotStart)} to ${day(d.pilotEnd)}` : 'not set'}`}</span>
          <span className="block">{`Changes included in each piece: ${life.revisionsPerPiece}`}</span>
        </LifeCard>

        {life.stage === 'trial' && (
          <li className="rounded-tile bg-card p-sm shadow-toy-soft">
            <h3 className="m-0 text-[16px] font-extrabold">The trial rules</h3>
            <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">The client sees these at their link. They are quoted from the Trial and pilot agreement; if you changed your copy of it, yours wins.</p>
            <ul className="mt-xs m-0 list-disc pl-md text-[14px] font-semibold">
              {TRIAL_RULES.map((r) => (
                <li key={r.key}>
                  {r.text} <span className="text-[12px] text-ink-soft">{`(${r.source})`}</span>
                </li>
              ))}
            </ul>
            <div className="mt-sm">
              {life.trialItemId ? (
                <p className="m-0 text-[14px] font-bold">The trial video is in the pipeline below. Send it for review when it is ready.</p>
              ) : (
                <Button size="sm" onClick={() => trial.mutate()} disabled={trial.isPending}>
                  {trial.isPending ? 'Adding' : 'Add the trial video to the pipeline'}
                </Button>
              )}
              {trial.isError && (
                <p role="alert" className="mt-xs m-0 text-[14px] font-bold">
                  {failed(trial.error)}
                </p>
              )}
            </div>
          </li>
        )}
      </ul>

      <div className="mt-sm flex flex-wrap items-center gap-xs">
        {next && (
          <Button onClick={() => move.mutate({ to: next, undo: false })} disabled={Boolean(problem) || move.isPending}>
            {move.isPending ? 'Moving' : `Move to ${AGENCY_STAGE_BY_KEY[next].name}`}
          </Button>
        )}
        {prev &&
          (confirmBack ? (
            <>
              <Button variant="outline" size="sm" onClick={() => move.mutate({ to: prev, undo: true })} disabled={move.isPending}>
                {`Yes, back to ${AGENCY_STAGE_BY_KEY[prev].name}`}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmBack(false)}>
                Stay
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirmBack(true)}>
              Step back one
            </Button>
          ))}
      </div>
      {problem && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{problem}</p>}
      {move.isError && (
        <p role="alert" className="mt-xs m-0 text-[14px] font-bold">
          {failed(move.error)}
        </p>
      )}
      {!next && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">This is the last stage. The work goes on, month by month.</p>}

      <Fold className="mt-sm" title="What happened" hint={life.log.length ? String(life.log.length) : undefined}>
        {life.log.length === 0 ? (
          <p className="m-0 text-[14px] font-semibold text-ink-soft">Nothing yet. Stage moves, password changes and retainer steps are written here.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {life.log.map((l) => (
              <li key={l.id} className="rounded-tile bg-paper p-sm text-[14px] font-semibold">
                <span className="block text-[12px] font-bold text-ink-soft">{`${l.actor === 'me' ? 'You' : l.actor === 'client' ? 'The client' : 'Automatic'}, ${prettyDate(l.at.slice(0, 10))}`}</span>
                {l.text}
              </li>
            ))}
          </ul>
        )}
      </Fold>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Days and changes">
        {editing && <DaysForm client={client} life={life} onClose={() => setEditing(false)} />}
      </Sheet>
    </div>
  );
}

function DaysForm({ client, life, onClose }: { client: AgencyClient; life: ClientLifecycle; onClose: () => void }) {
  const refresh = useRefresh();
  const d = life.dates;
  const [strategyDay, setStrategyDay] = useState(d.strategyDay ?? '');
  const [strategyLink, setStrategyLink] = useState(d.strategyLink);
  const [trialDue, setTrialDue] = useState(d.trialDue ?? '');
  const [pilotStart, setPilotStart] = useState(d.pilotStart ?? '');
  const [pilotEnd, setPilotEnd] = useState(d.pilotEnd ?? '');
  const [revisions, setRevisions] = useState(String(life.revisionsPerPiece));
  const save = useMutation({
    mutationFn: () =>
      api.agencyLifecycleSave(client.id, {
        strategyDay: strategyDay || null,
        strategyLink: strategyLink.trim(),
        trialDue: trialDue || null,
        pilotStart: pilotStart || null,
        pilotEnd: pilotEnd || null,
        revisionsPerPiece: Math.min(REVISIONS_MAX, Math.max(0, Math.round(Number(revisions) || 0))),
      }),
    onSuccess: () => {
      void refresh();
      onClose();
    },
  });
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-sm md:grid-cols-2">
        <Field label="Strategy session day">
          <input type="date" value={strategyDay} onChange={(e) => setStrategyDay(e.target.value)} className={field} />
        </Field>
        <Field label="Trial video due">
          <input type="date" value={trialDue} onChange={(e) => setTrialDue(e.target.value)} className={field} />
        </Field>
      </div>
      <Field label="Call link" hint="Starts with https. The client sees it at their link.">
        <input type="url" value={strategyLink} onChange={(e) => setStrategyLink(e.target.value)} placeholder="https://" maxLength={300} className={field} />
      </Field>
      <div className="grid gap-sm md:grid-cols-2">
        <Field label="Pilot starts">
          <input type="date" value={pilotStart} onChange={(e) => setPilotStart(e.target.value)} className={field} />
        </Field>
        <Field label="Pilot ends">
          <input type="date" value={pilotEnd} min={pilotStart || undefined} onChange={(e) => setPilotEnd(e.target.value)} className={field} />
        </Field>
      </div>
      <Field label="Changes included in each piece" hint="Both the trial and the retainer agreements say two rounds. A piece can be given more from its own page.">
        <input inputMode="numeric" value={revisions} onChange={(e) => setRevisions(e.target.value.replace(/\D/g, '').slice(0, 2))} className={field} />
      </Field>
      {save.isError && (
        <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
          {failed(save.error)}
        </p>
      )}
      <div className="mt-md">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

// ---- the password on the client link

/** The password on this client's link: whether there is one, set or make one (shown once), remove it, and when the link was last opened. */
export function PortalSecurityCard({ client, life }: { client: AgencyClient; life: ClientLifecycle }) {
  const refresh = useRefresh();
  const [shown, setShown] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [setting, setSetting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const on = Boolean(client.portalToken);
  const set = life.password.set;
  const gen = useMutation({
    mutationFn: () => api.agencyPassword(client.id, { generate: true }),
    onSuccess: (r) => {
      setShown(r.password ?? null);
      setCopied(false);
      void refresh();
    },
  });
  const clear = useMutation({
    mutationFn: () => api.agencyPassword(client.id, { clear: true }),
    onSuccess: () => {
      setConfirmClear(false);
      setShown(null);
      void refresh();
    },
  });
  const copy = async () => {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(shown);
      setCopied(true);
    } catch {
      document.getElementById(`pw-${client.id}`)?.focus();
    }
  };

  return (
    <div className="rounded-card bg-card p-md shadow-toy-soft">
      <div className="flex flex-wrap items-center gap-xs">
        <h3 className="m-0 text-[16px] font-extrabold">Password</h3>
        <StatusTag tone={set ? 'good' : 'warn'}>{set ? 'Password set' : 'No password'}</StatusTag>
      </div>
      {!set && (
        <p role="note" className="mt-xs m-0 rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-yellow)' }}>
          Anyone with the link can open this. Set a password.
        </p>
      )}
      {set && (
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          {`The client types it once to open their page, their agreements and their invoices. It lasts twelve hours in their browser tab. ${life.password.setAt ? `Set ${prettyDate(life.password.setAt.slice(0, 10))}.` : ''} We keep only a scrambled copy, so we cannot show it again.`}
        </p>
      )}
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{life.password.lastOpenedDay ? `Last opened ${prettyDate(life.password.lastOpenedDay)}.` : on ? 'Not opened yet.' : 'The link is switched off, so nobody can open it.'}</p>

      {shown && (
        <div role="status" className="mt-sm rounded-tile bg-paper p-sm">
          <p className="m-0 text-[14px] font-bold">Here is the password. It is shown once. Send it to your client separately from the link.</p>
          <input id={`pw-${client.id}`} readOnly value={shown} onFocus={(e) => e.currentTarget.select()} aria-label="The new password" className="mt-xs w-full rounded-tile border-2 border-line bg-card px-sm py-sm font-mono text-[16px]" />
          <div className="mt-xs flex flex-wrap gap-xs">
            <Button size="sm" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShown(null)}>
              I have saved it
            </Button>
          </div>
        </div>
      )}

      <div className="mt-sm flex flex-wrap gap-xs">
        <Button size="sm" onClick={() => gen.mutate()} disabled={gen.isPending}>
          {gen.isPending ? 'Making' : set ? 'Make a new password' : 'Make a password for me'}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setSetting(true)}>
          Type my own
        </Button>
        {set &&
          (confirmClear ? (
            <>
              <Button size="sm" variant="outline" onClick={() => clear.mutate()} disabled={clear.isPending}>
                Yes, remove it
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setConfirmClear(true)}>
              Remove password
            </Button>
          ))}
      </div>
      {(gen.isError || clear.isError) && (
        <p role="alert" className="mt-xs m-0 text-[14px] font-bold">
          {failed(gen.error ?? clear.error)}
        </p>
      )}
      <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">Changing or removing the password signs the client out of every tab at once.</p>

      <Sheet open={setting} onClose={() => setSetting(false)} title="Type a password">
        {setting && <TypedPassword client={client} onClose={() => setSetting(false)} />}
      </Sheet>
    </div>
  );
}

function TypedPassword({ client, onClose }: { client: AgencyClient; onClose: () => void }) {
  const refresh = useRefresh();
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const problem = pw ? portalPasswordProblem(pw, client.name) : null;
  const save = useMutation({
    mutationFn: () => api.agencyPassword(client.id, { password: pw }),
    onSuccess: () => {
      void refresh();
      onClose();
    },
  });
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (!problem && pw) save.mutate();
      }}
    >
      <Field label={`Password, at least ${PORTAL_PASSWORD_MIN} characters`} hint="Not the client's name, and not one of the passwords everyone tries first.">
        <div className="flex gap-xs">
          <input type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" spellCheck={false} maxLength={128} className={`${field} mt-xs flex-1`} />
          <Button type="button" variant="outline" size="sm" onClick={() => setShow((s) => !s)} aria-pressed={show}>
            {show ? 'Hide' : 'Show'}
          </Button>
        </div>
      </Field>
      {problem && (
        <p role="alert" className="mt-xs m-0 text-[14px] font-bold">
          {problem}
        </p>
      )}
      {save.isError && (
        <p role="alert" className="mt-xs m-0 text-[14px] font-bold">
          {failed(save.error)}
        </p>
      )}
      <div className="mt-md">
        <Button type="submit" disabled={save.isPending || !pw || Boolean(problem)}>
          {save.isPending ? 'Saving' : 'Save the password'}
        </Button>
      </div>
    </form>
  );
}

// ---- the retainer

const pct = (bps: number): string => `${bps % 100 === 0 ? bps / 100 : (bps / 100).toFixed(2)}%`;

/** The retainer after the pilot: offer lengths, see the client's pick, confirm it, watch the months it makes, end it or renew it. */
export function RetainerCard({ client, life, currency }: { client: AgencyClient; life: ClientLifecycle; currency: string }) {
  const refresh = useRefresh();
  const r = life.retainer;
  const [offering, setOffering] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const ready = stageIndex(life.stage) >= stageIndex('pilot');
  const withdraw = useMutation({ mutationFn: (id: string) => api.agencyRetainerWithdraw(id), onSuccess: () => refresh() });
  const end = useMutation({ mutationFn: (id: string) => api.agencyRetainerEnd(id), onSuccess: () => { setConfirmEnd(false); void refresh(); } });
  const auto = useMutation({ mutationFn: (v: { id: string; on: boolean }) => api.agencyRetainerAutoSend(v.id, v.on), onSuccess: () => refresh() });
  const err = withdraw.error ?? end.error ?? auto.error;

  return (
    <div className="rounded-card bg-card p-md shadow-toy-soft">
      {!r && (
        <>
          <p className="m-0 text-[14px] font-semibold text-ink-soft">
            {ready ? 'The pilot is done. Offer the retainer: the client picks how many months, and each month then makes its own invoice and pieces.' : 'A retainer comes after the pilot month. Move the client to the pilot month first.'}
          </p>
          <div className="mt-sm">
            <Button onClick={() => setOffering(true)} disabled={!ready}>
              Offer a retainer
            </Button>
          </div>
        </>
      )}
      {r && (
        <>
          <div className="flex flex-wrap items-center gap-xs">
            <h3 className="m-0 text-[16px] font-extrabold">{r.status === 'active' ? 'Running retainer' : r.status === 'ended' ? 'Last retainer' : 'Retainer offer'}</h3>
            <StatusTag tone={RETAINER_STATUS_TONE[r.status]}>{RETAINER_STATUS_NAME[r.status]}</StatusTag>
          </div>
          <OptionsList r={r} currency={currency} />
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
            {`${r.piecesPerMonth} ${r.piecesPerMonth === 1 ? 'piece' : 'pieces'} a month, ${r.revisionsPerPiece} ${r.revisionsPerPiece === 1 ? 'change' : 'changes'} included in each.`}
          </p>
          {r.status === 'chosen' && r.months && (
            <p role="status" className="mt-sm m-0 rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-yellow)' }}>
              {`${client.name} chose ${r.months} months: ${money(r.monthlyCents ?? 0, currency)} a month, ${money(r.totalCents ?? 0, currency)} in all.`}
            </p>
          )}
          {r.status === 'offered' && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Waiting for the client to pick a length at their link.</p>}
          {r.status === 'active' && (
            <>
              <p className="mt-sm m-0 text-[14px] font-bold">
                {`${r.months} months from ${r.startDay ? prettyDate(r.startDay) : 'the start day'}. ${r.cyclesMade} of ${r.months} made.`}
                {r.nextCycle ? ` Next cycle: ${new Date(`${r.nextCycle.day}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}.` : ''}
              </p>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Each month makes its invoice and its pieces by itself, once, on the retainer&apos;s own day. A short month falls on its last day.</p>
            </>
          )}
          {r.status !== 'ended' && r.status !== 'withdrawn' && (
            <div className="mt-sm">
              <Toggle compact on={r.autoSend} onChange={(v) => auto.mutate({ id: r.id, on: v })} disabled={auto.isPending} label="Send each month's invoice by itself" hint={r.autoSend ? 'It goes to the client the day the month starts.' : 'Each invoice waits as a draft for you to send.'} />
            </div>
          )}
          <div className="mt-sm flex flex-wrap gap-xs">
            {r.status === 'chosen' && <Button onClick={() => setConfirming(true)}>Confirm and start</Button>}
            {(r.status === 'offered' || r.status === 'chosen') && (
              <Button variant="outline" size="sm" onClick={() => withdraw.mutate(r.id)} disabled={withdraw.isPending}>
                Take the offer back
              </Button>
            )}
            {r.status === 'offered' && (
              <Button variant="outline" size="sm" onClick={() => setOffering(true)}>
                Change the offer
              </Button>
            )}
            {(r.status === 'ended' || r.status === 'withdrawn') && (
              <Button onClick={() => setOffering(true)} disabled={!ready}>
                {r.status === 'ended' ? 'Offer a renewal' : 'Offer again'}
              </Button>
            )}
            {r.status === 'active' &&
              (confirmEnd ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => end.mutate(r.id)} disabled={end.isPending}>
                    Yes, end it
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmEnd(false)}>
                    Keep it
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setConfirmEnd(true)}>
                  End the retainer
                </Button>
              ))}
          </div>
          {r.status === 'active' && confirmEnd && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Months not yet made will not be made. What is already made stays.</p>}
        </>
      )}
      {err && (
        <p role="alert" className="mt-xs m-0 text-[14px] font-bold">
          {failed(err)}
        </p>
      )}

      <Sheet open={offering} onClose={() => setOffering(false)} title={r?.status === 'ended' ? 'Offer a renewal' : 'Offer a retainer'}>
        {offering && <OfferForm client={client} currency={currency} previous={r} onClose={() => setOffering(false)} />}
      </Sheet>
      <Sheet open={confirming} onClose={() => setConfirming(false)} title="Start the retainer">
        {confirming && r && <ConfirmForm retainer={r} currency={currency} onClose={() => setConfirming(false)} />}
      </Sheet>
    </div>
  );
}

function OptionsList({ r, currency }: { r: AgencyRetainer; currency: string }) {
  const rows: RetainerOption[] = r.status === 'active' || r.status === 'ended' ? (r.months ? [{ months: r.months, discountBps: r.discountBps }] : []) : r.options;
  return (
    <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
      {rows.map((o) => (
        <li key={o.months} className={`rounded-tile p-sm text-[14px] font-semibold ${r.months === o.months ? 'bg-card-strong' : 'bg-paper'}`}>
          <strong className="text-ink">{`${o.months} ${o.months === 1 ? 'month' : 'months'}`}</strong>
          {`: ${money(retainerMonthlyCents(r.feeCents, o.discountBps), currency)} a month, ${money(retainerTotalCents(r.feeCents, o.months, o.discountBps), currency)} in all${o.discountBps > 0 ? `, ${pct(o.discountBps)} off` : ''}`}
          {r.months === o.months && r.status !== 'active' && r.status !== 'ended' ? ', chosen' : ''}
        </li>
      ))}
    </ul>
  );
}

function OfferForm({ client, currency, previous, onClose }: { client: AgencyClient; currency: string; previous: AgencyRetainer | null; onClose: () => void }) {
  const refresh = useRefresh();
  const startFee = previous?.feeCents || client.retainerCents;
  const [fee, setFee] = useState(startFee ? String(startFee / 100) : '');
  const [pieces, setPieces] = useState(String(previous?.piecesPerMonth ?? client.piecesPerMonth));
  const [revisions, setRevisions] = useState(String(previous?.revisionsPerPiece ?? 2));
  const [auto, setAuto] = useState(previous?.autoSend ?? true);
  const seed: RetainerOption[] = previous && previous.options.length > 0 ? previous.options : [...RETAINER_DEFAULT_OPTIONS];
  const [rows, setRows] = useState<{ months: string; off: string }[]>(seed.map((o) => ({ months: String(o.months), off: o.discountBps ? String(o.discountBps / 100) : '' })));
  const cents = typedCents(fee);
  const options: RetainerOption[] = rows
    .map((r) => ({ months: Math.round(Number(r.months)), discountBps: Math.round(Number(r.off || 0) * 100) }))
    .filter((o) => Number.isInteger(o.months) && o.months >= 1 && o.months <= RETAINER_MONTHS_MAX);
  const save = useMutation({
    mutationFn: () => api.agencyRetainerOffer(client.id, { options, feeCents: Number.isFinite(cents) ? cents : 0, piecesPerMonth: Math.round(Number(pieces) || 0), revisionsPerPiece: Math.round(Number(revisions) || 0), autoSend: auto }),
    onSuccess: () => {
      void refresh();
      onClose();
    },
  });
  const setRow = (i: number, patch: Partial<{ months: string; off: string }>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (options.length > 0 && Number.isFinite(cents) && cents > 0) save.mutate();
      }}
    >
      <Field label={`Fee for a month, in ${currency}`} hint="Type whole units, like 50000. It starts as the client's retainer amount.">
        <input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} className={field} />
      </Field>
      <div className="grid gap-sm md:grid-cols-2">
        <Field label="Pieces each month">
          <input inputMode="numeric" value={pieces} onChange={(e) => setPieces(e.target.value.replace(/\D/g, '').slice(0, 2))} className={field} />
        </Field>
        <Field label="Changes included in each piece">
          <input inputMode="numeric" value={revisions} onChange={(e) => setRevisions(e.target.value.replace(/\D/g, '').slice(0, 2))} className={field} />
        </Field>
      </div>
      <fieldset className="mt-sm m-0 border-0 p-0">
        <legend className="p-0 text-[14px] font-bold">Lengths to offer, with a discount on the month if you like</legend>
        {rows.map((r, i) => (
          <div key={i} className="mt-xs grid grid-cols-[1fr_1fr_auto] items-end gap-xs">
            <label className="text-[12px] font-bold">
              Months
              <input inputMode="numeric" value={r.months} onChange={(e) => setRow(i, { months: e.target.value.replace(/\D/g, '').slice(0, 2) })} className={field} />
            </label>
            <label className="text-[12px] font-bold">
              Percent off
              <input inputMode="decimal" value={r.off} placeholder="0" onChange={(e) => setRow(i, { off: e.target.value.replace(/[^\d.]/g, '').slice(0, 5) })} className={field} />
            </label>
            <Button type="button" variant="outline" size="sm" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Remove length ${i + 1}`} disabled={rows.length <= 1}>
              Remove
            </Button>
          </div>
        ))}
        {rows.length < RETAINER_OPTIONS_MAX && (
          <div className="mt-xs">
            <Button type="button" variant="outline" size="sm" onClick={() => setRows([...rows, { months: '', off: '' }])}>
              Add a length
            </Button>
          </div>
        )}
      </fieldset>
      {Number.isFinite(cents) && cents > 0 && options.length > 0 && (
        <ul className="mt-sm m-0 list-none rounded-tile bg-paper p-sm text-[14px] font-semibold text-ink-soft">
          {options.map((o) => (
            <li key={o.months}>{`${o.months} months: ${money(retainerMonthlyCents(cents, o.discountBps), currency)} a month, ${money(retainerTotalCents(cents, o.months, o.discountBps), currency)} in all`}</li>
          ))}
        </ul>
      )}
      <div className="mt-sm">
        <Toggle compact on={auto} onChange={setAuto} label="Send each month's invoice by itself" hint="Off keeps each one as a draft for you to send." />
      </div>
      {save.isError && (
        <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
          {failed(save.error)}
        </p>
      )}
      <div className="mt-md">
        <Button type="submit" disabled={save.isPending || options.length === 0 || !Number.isFinite(cents) || cents <= 0}>
          {save.isPending ? 'Sending' : 'Send the offer'}
        </Button>
      </div>
    </form>
  );
}

function ConfirmForm({ retainer, currency, onClose }: { retainer: AgencyRetainer; currency: string; onClose: () => void }) {
  const refresh = useRefresh();
  const [start, setStart] = useState(todayLocal());
  const [auto, setAuto] = useState(retainer.autoSend);
  const save = useMutation({
    mutationFn: () => api.agencyRetainerConfirm(retainer.id, { startDay: start, autoSend: auto }),
    onSuccess: () => {
      void refresh();
      onClose();
    },
  });
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (start) save.mutate();
      }}
    >
      <p className="m-0 text-[14px] font-semibold text-ink-soft">{`${retainer.months} months at ${money(retainer.monthlyCents ?? 0, currency)} a month. The first month starts on the day below; the next ones start on the same day of each month (a short month on its last day).`}</p>
      <Field label="First month starts">
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={field} />
      </Field>
      <div className="mt-sm">
        <Toggle compact on={auto} onChange={setAuto} label="Send each month's invoice by itself" />
      </div>
      {save.isError && (
        <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
          {failed(save.error)}
        </p>
      )}
      <div className="mt-md">
        <Button type="submit" disabled={save.isPending || !start}>
          {save.isPending ? 'Starting' : 'Start the retainer'}
        </Button>
      </div>
    </form>
  );
}
