import { AGENCY_STAGE_BY_KEY, RETAINER_DEFAULT_OPTIONS, RETAINER_MONTHS_MAX, RETAINER_OPTIONS_MAX, RETAINER_STATUS_NAME, RETAINER_STATUS_TONE, REVISIONS_MAX, TRIAL_RULES, money, moveProblem, nextStage, previousStage, retainerMonthlyCents, retainerTotalCents, stageIndex, typedCents, typedPercentBps, type AgencyClient, type AgencyRetainer, type ClientLifecycle, type RetainerOption } from '@kreators/shared';
import { useAuthed } from '../lib/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { ApiError, api } from '../lib/api';
import { prettyDate, todayLocal, shortDay } from '../lib/date';
import { Button } from './Button';
import { Fold } from './Fold';
import { Sheet } from './Sheet';
import { StageBar } from './StageBar';
import { StatusTag } from './StatusTag';
import { CardHead } from './CardHead';
import { Toggle } from './Toggle';
import { FIELD } from '../lib/ui';
import { ConfirmDelete } from './ConfirmDelete';
import { FieldLabel } from './Field';
import { ClientPassword } from './ClientPassword';


const failed = (e: unknown): string => (e instanceof ApiError ? e.message : 'That did not go through. Try again.');
const day = (d: string | null): string => (d ? prettyDate(d) : 'not set');

/** A short card with what is set now and its own Edit button at the bottom right, in line with its last line (the founder, 2026-11-06). */
function LifeCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <li className="flex items-end justify-between gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="min-w-0 flex-1">
        <h3 className="m-0 text-card-title">{title}</h3>
        <div className="mt-xs text-card-note text-ink-soft">{children}</div>
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

/**
 * The way a client goes from enquiry to monthly delivery, as the owner works it: move along, tick the steps, set the days, see the log.
 * `compact` is the client page's one stage card: the bar, one "You:" line, the move button, a quiet step back, and everything else
 * (what the client does, the checklist, the days, the trial rules and what happened) folded under "Stage details".
 */
export function LifecycleCard({ client, life, compact = false }: { client: AgencyClient; life: ClientLifecycle; compact?: boolean }) {
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

  const checklist = (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <h3 className="m-0 text-headline">{`Checklist for this stage, ${done} of ${stage.steps.length}`}</h3>
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
  );
  const days = (
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
  );
  const trialRules = life.stage === 'trial' && (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <h3 className="m-0 text-card-title">The trial rules</h3>
      <p className="mt-xs m-0 text-card-note text-ink-soft">The client sees these at their link. They are quoted from the Trial and pilot agreement; if you changed your copy of it, yours wins.</p>
      <ul className="mt-sm m-0 list-disc pl-md text-subhead">
        {TRIAL_RULES.map((r) => (
          <li key={r.key}>
            {r.text} <span className="text-caption text-ink-soft">{`(${r.source})`}</span>
          </li>
        ))}
      </ul>
      <div className="mt-sm">
        {life.trialItemId ? (
          <p className="m-0 text-subhead">The trial video is in the pipeline under Work. Send it for review when it is ready.</p>
        ) : (
          <Button size="sm" onClick={() => trial.mutate()} disabled={trial.isPending}>
            {trial.isPending ? 'Adding' : 'Add the trial video to the pipeline'}
          </Button>
        )}
        {trial.isError && (
          <p role="alert" className="mt-xs m-0 text-subhead">
            {failed(trial.error)}
          </p>
        )}
      </div>
    </li>
  );
  // Inside the compact view's card the lines sit on the card's own edge (a paper tile in a card drew no box, only a 12px indent);
  // in the fold of the full view each line is its own tile.
  const logList = (inCard: boolean) =>
    life.log.length === 0 ? (
      <p className="m-0 text-subhead text-ink-soft">Nothing yet. Stage moves, password changes and retainer steps are written here.</p>
    ) : (
      <ul className={`m-0 flex list-none flex-col p-0 ${inCard ? 'gap-sm' : 'gap-xs'}`}>
        {life.log.map((l) => (
          <li key={l.id} className={inCard ? 'text-subhead' : 'rounded-tile bg-paper p-sm text-subhead'}>
            <span className="block text-caption text-ink-soft">{`${l.actor === 'me' ? 'You' : l.actor === 'client' ? 'The client' : 'Automatic'}, ${prettyDate(l.at)}`}</span>
            {l.text}
          </li>
        ))}
      </ul>
    );
  const moves = (
    <>
      <div className="mt-sm flex flex-wrap items-center gap-xs">
        {next && (
          // One solid button per screen: while the client's password ask is open, "Set a new password" above is the solid one.
          <Button variant={life.password.request ? 'outline' : 'primary'} onClick={() => move.mutate({ to: next, undo: false })} disabled={Boolean(problem) || move.isPending}>
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
            <Button variant={compact ? 'ghost' : 'outline'} size="sm" onClick={() => setConfirmBack(true)}>
              {compact ? 'Step back' : 'Step back one'}
            </Button>
          ))}
      </div>
      {/* Stepping back before the agreement's stages: what is already sent or signed stays as it is and no longer moves them on by itself. */}
      {confirmBack && prev && (prev === 'enquiry' || prev === 'agreement_sent') && (
        <p className="mt-xs m-0 text-subhead text-ink-soft">The agreement stays as it is. They move on again when you send one or the client signs one, or with the move button.</p>
      )}
      {problem && <p className="mt-xs m-0 text-subhead text-ink-soft">{problem}</p>}
      {move.isError && (
        <p role="alert" className="mt-xs m-0 text-subhead">
          {failed(move.error)}
        </p>
      )}
      {!next && <p className="mt-xs m-0 text-subhead text-ink-soft">This is the last stage. The work goes on, month by month.</p>}
    </>
  );
  const daysSheet = (
    <Sheet open={editing} onClose={() => setEditing(false)} title="Days and changes">
      {editing && <DaysForm client={client} life={life} onClose={() => setEditing(false)} />}
    </Sheet>
  );

  if (compact) {
    return (
      <div className="rounded-card bg-card p-md shadow-toy-soft">
        <StageBar stage={life.stage} />
        <p className="mt-sm m-0 text-subhead text-ink-soft">
          <strong className="text-ink">You:</strong> {stage.ownerDoes}
        </p>
        {moves}
        <Fold className="mt-sm" title="Stage details" hint={stage.steps.length > 0 ? `${done} of ${stage.steps.length} done` : undefined}>
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            <LifeCard title="The client">
              <span className="block">{stage.clientDoes}</span>
            </LifeCard>
            {checklist}
            {days}
            {trialRules}
            <li className="rounded-tile bg-card p-sm shadow-toy-soft">
              <h3 className="m-0 text-headline">What happened</h3>
              <div className="mt-xs">{logList(true)}</div>
            </li>
          </ul>
        </Fold>
        {daysSheet}
      </div>
    );
  }

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
        {checklist}
        {days}
        {trialRules}
      </ul>
      {moves}
      <Fold className="mt-sm" title="What happened" hint={life.log.length ? String(life.log.length) : undefined}>
        {logList(false)}
      </Fold>
      {daysSheet}
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
      <div className="grid items-end gap-sm md:grid-cols-2">
        <FieldLabel className="mt-sm" label="Strategy session day" hint="Shown at their link once the agreement is signed.">
          <input type="date" value={strategyDay} onChange={(e) => setStrategyDay(e.target.value)} className={FIELD} />
        </FieldLabel>
        <FieldLabel className="mt-sm" label="Trial video due" hint="Shown at their link during the trial.">
          <input type="date" value={trialDue} onChange={(e) => setTrialDue(e.target.value)} className={FIELD} />
        </FieldLabel>
      </div>
      <FieldLabel className="mt-sm" label="Call link" hint="Starts with https. The client sees it at their link.">
        <input type="url" value={strategyLink} onChange={(e) => setStrategyLink(e.target.value)} placeholder="https://" maxLength={300} className={FIELD} />
      </FieldLabel>
      <div className="grid items-end gap-sm md:grid-cols-2">
        <FieldLabel className="mt-sm" label="Pilot starts" hint="Shown at their link from the pilot month.">
          <input type="date" value={pilotStart} onChange={(e) => setPilotStart(e.target.value)} className={FIELD} />
        </FieldLabel>
        <FieldLabel className="mt-sm" label="Pilot ends" hint="Shown at their link from the pilot month.">
          <input type="date" value={pilotEnd} min={pilotStart || undefined} onChange={(e) => setPilotEnd(e.target.value)} className={FIELD} />
        </FieldLabel>
      </div>
      <FieldLabel className="mt-sm" label="Changes included in each piece" hint="Both the trial and the retainer agreements say two rounds. A piece can be given more from its own page.">
        <input inputMode="numeric" value={revisions} onChange={(e) => setRevisions(e.target.value.replace(/\D/g, '').slice(0, 2))} className={FIELD} />
      </FieldLabel>
      {save.isError && (
        <p role="alert" className="mt-sm m-0 text-subhead">
          {failed(save.error)}
        </p>
      )}
      <div className="mt-md">
        <Button type="submit" full disabled={save.isPending}>
          {save.isPending ? 'Saving' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

// ---- the password on the client link (drawn by ClientPassword, the one module)

/**
 * The password on a document's own page (an invoice, an agreement, another document): the client's `ClientPassword` card, since one
 * password opens the client's page and every document sent to them.
 */
export function DocPassword({ clientId, clientName, savedClientId }: { clientId: string | null; clientName: string; savedClientId?: string | null }) {
  const q = useAuthed(['agency', 'client', clientId ?? ''], () => api.agencyClient(clientId ?? ''), Boolean(clientId));
  const page = q.data;
  if (!clientId) {
    return <p className="no-print mt-sm m-0 text-subhead text-ink-soft">Pick a client for this document to protect its link with a password.</p>;
  }
  // The client picked here is not saved yet: the live link still follows the client it was saved with, so its password says nothing yet.
  if (savedClientId !== undefined && savedClientId !== clientId) {
    return <p className="no-print mt-sm m-0 text-subhead text-ink-soft">Save this change first. Until then the link is protected by the password of the client it was saved with.</p>;
  }
  if (q.isError && !page) {
    const gone = q.error instanceof ApiError && q.error.status === 404;
    return (
      <div role="alert" className="no-print mt-sm flex flex-wrap items-center gap-xs rounded-tile bg-card p-sm shadow-toy-soft">
        <StatusTag tone="warn">{gone ? 'Client gone' : 'Not checked'}</StatusTag>
        <p className="m-0 min-w-0 flex-1 text-subhead text-ink-soft">{gone ? 'The client for this document was removed. Pick another client to protect its link.' : 'We could not check the password just now.'}</p>
        {!gone && (
          <Button size="sm" variant="outline" onClick={() => void q.refetch()} disabled={q.isFetching}>
            {q.isFetching ? 'Checking' : 'Try again'}
          </Button>
        )}
      </div>
    );
  }
  if (!page) {
    return (
      <div className="no-print mt-sm flex flex-wrap items-center gap-xs rounded-tile bg-card p-sm shadow-toy-soft">
        <StatusTag tone="neutral">Checking</StatusTag>
        <p className="m-0 text-subhead text-ink-soft">Checking the password on this link.</p>
      </div>
    );
  }
  // Drawn under the paper inside a Fold (2026-11-06, was a sheet behind More), so the card keeps its own surface.
  return <ClientPassword className="no-print" clientId={page.client.id} clientName={clientName || page.client.name} state={page.lifecycle.password} linkOn={Boolean(page.client.portalToken)} />;
}

/**
 * A document page's password, under the paper (2026-11-06: "fix all 20", the popups pass): a closed Fold titled for the client, holding
 * the same password card the client page shows. The More menu's Password item opens it and moves focus to it (`revealIn`).
 */
export function DocPasswordFold({ id, open, onOpenChange, clientId, clientName, savedClientId }: { id: string; open: boolean; onOpenChange: (open: boolean) => void; clientId: string | null; clientName: string; savedClientId?: string | null }) {
  return (
    <div id={id} className="no-print mt-md">
      <Fold title={`Password for ${clientName || 'the client'}`} open={open} onOpenChange={onOpenChange}>
        <DocPassword clientId={clientId} clientName={clientName} savedClientId={savedClientId} />
      </Fold>
    </div>
  );
}

/**
 * Brings a control on the page into view and gives it focus, for a More menu item whose panel now lives on the page. Two frames later,
 * so the menu has closed and handed focus back first.
 */
export function revealIn(id: string, selector = 'select, input, [role="switch"], button'): void {
  window.requestAnimationFrame(() =>
    window.requestAnimationFrame(() => {
      const box = document.getElementById(id);
      if (!box) return;
      box.scrollIntoView({ block: 'center' });
      const target = box.matches(selector) ? box : box.querySelector<HTMLElement>(selector);
      target?.focus({ preventScroll: true });
    }),
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
  const [askingBack, setAskingBack] = useState(false);
  const withdraw = useMutation({ mutationFn: (id: string) => api.agencyRetainerWithdraw(id), onSuccess: () => { setAskingBack(false); void refresh(); } });
  const end = useMutation({ mutationFn: (id: string) => api.agencyRetainerEnd(id), onSuccess: () => { setConfirmEnd(false); void refresh(); } });
  const auto = useMutation({ mutationFn: (v: { id: string; on: boolean }) => api.agencyRetainerAutoSend(v.id, v.on), onSuccess: () => refresh() });
  const err = withdraw.error ?? end.error ?? auto.error;

  return (
    <div className="rounded-card bg-card p-md shadow-toy-soft">
      {!r && (
        <>
          <p className="m-0 text-subhead text-ink-soft">
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
          <CardHead tag={<StatusTag fit tone={RETAINER_STATUS_TONE[r.status]}>{RETAINER_STATUS_NAME[r.status]}</StatusTag>}>
            <h3 className="m-0 text-headline">{r.status === 'active' ? 'Running retainer' : r.status === 'ended' ? 'Last retainer' : 'Retainer offer'}</h3>
          </CardHead>
          <OptionsList r={r} currency={currency} />
          <p className="mt-xs m-0 text-subhead text-ink-soft">
            {`${r.piecesPerMonth} ${r.piecesPerMonth === 1 ? 'piece' : 'pieces'} a month, ${r.revisionsPerPiece} ${r.revisionsPerPiece === 1 ? 'change' : 'changes'} included in each.`}
          </p>
          {r.status === 'chosen' && r.months && (
            <p role="status" className="mt-sm m-0 rounded-tile p-sm text-subhead" style={{ background: 'var(--tint-yellow)' }}>
              {`${client.name} chose ${r.months} months: ${money(r.monthlyCents ?? 0, currency)} a month, ${money(r.totalCents ?? 0, currency)} in all.`}
            </p>
          )}
          {r.status === 'offered' && <p className="mt-sm m-0 text-subhead text-ink-soft">Waiting for the client to pick a length at their link.</p>}
          {r.status === 'active' && (
            <>
              <p className="mt-sm m-0 text-subhead font-semibold">
                {`${r.months} months from ${r.startDay ? prettyDate(r.startDay) : 'the start day'}. ${r.cyclesMade} of ${r.months} made.`}
                {r.nextCycle ? ` Next cycle: ${shortDay(r.nextCycle.day)}.` : ''}
              </p>
              <p className="mt-xs m-0 text-subhead text-ink-soft">Each month makes its invoice and its pieces by itself, once, on the retainer&apos;s own day. A short month falls on its last day.</p>
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
              <Button variant="outline" size="sm" onClick={() => { withdraw.reset(); setAskingBack(true); }} disabled={withdraw.isPending}>
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
            {r.status === 'active' && (
              <Button variant="outline" size="sm" onClick={() => { end.reset(); setConfirmEnd(true); }}>
                End the retainer
              </Button>
            )}
          </div>
          <ConfirmDelete open={askingBack} title="Take this offer back?" body="It leaves the client's link at once. You can offer again." yes="Yes, take it back" keep="Keep the offer" pending={withdraw.isPending} failed={withdraw.isError} error={withdraw.error ? failed(withdraw.error) : undefined} onYes={() => withdraw.mutate(r.id)} onClose={() => setAskingBack(false)} />
          <ConfirmDelete open={confirmEnd} title="End this retainer?" body="Months not yet made will not be made. What is already made stays." yes="Yes, end it" pending={end.isPending} failed={end.isError} error={end.error ? failed(end.error) : undefined} onYes={() => end.mutate(r.id)} onClose={() => setConfirmEnd(false)} />
        </>
      )}
      {err && (
        <p role="alert" className="mt-xs m-0 text-subhead">
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
        <li key={o.months} className={`rounded-tile p-sm text-subhead ${r.months === o.months ? 'bg-card-strong' : 'bg-paper'}`}>
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
  // A typed percent is read from its digits (`typedPercentBps`, never Number(x) * 100): blank is no discount, anything else that is not 0.01 to 100 is refused.
  const offBps = (off: string): number => (off.trim() === '' || /^0*(\.0*)?$/.test(off.trim()) ? 0 : typedPercentBps(off));
  const badOff = rows.some((r) => Number.isNaN(offBps(r.off)));
  const options: RetainerOption[] = rows
    .map((r) => ({ months: Math.round(Number(r.months)), discountBps: offBps(r.off) }))
    .filter((o) => Number.isInteger(o.months) && o.months >= 1 && o.months <= RETAINER_MONTHS_MAX && !Number.isNaN(o.discountBps));
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
        if (options.length > 0 && !badOff && Number.isFinite(cents) && cents > 0) save.mutate();
      }}
    >
      <FieldLabel className="mt-sm" label={`Fee for a month, in ${currency}`} hint="Type whole units, like 50000. It starts as the client's retainer amount.">
        <input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} className={FIELD} />
      </FieldLabel>
      <div className="grid items-end gap-sm md:grid-cols-2">
        <FieldLabel className="mt-sm" label="Pieces each month" hint="Each month adds this many pieces to the pipeline.">
          <input inputMode="numeric" value={pieces} onChange={(e) => setPieces(e.target.value.replace(/\D/g, '').slice(0, 2))} className={FIELD} />
        </FieldLabel>
        <FieldLabel className="mt-sm" label="Changes included in each piece" hint="Rounds the client can ask for on each piece.">
          <input inputMode="numeric" value={revisions} onChange={(e) => setRevisions(e.target.value.replace(/\D/g, '').slice(0, 2))} className={FIELD} />
        </FieldLabel>
      </div>
      <fieldset className="mt-sm m-0 border-0 p-0">
        <legend className="p-0 text-subhead">Lengths to offer, with a discount on the month if you like</legend>
        {rows.map((r, i) => (
          <div key={i} className="mt-xs grid grid-cols-[1fr_1fr_auto] items-end gap-xs">
            <label className="text-caption">
              Months
              <input inputMode="numeric" value={r.months} onChange={(e) => setRow(i, { months: e.target.value.replace(/\D/g, '').slice(0, 2) })} className={FIELD} />
            </label>
            <label className="text-caption">
              Percent off
              <input inputMode="decimal" value={r.off} placeholder="0" onChange={(e) => setRow(i, { off: e.target.value.replace(/[^\d.]/g, '').slice(0, 5) })} className={FIELD} />
            </label>
            <Button type="button" variant="outline" size="sm" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Remove length ${i + 1}`} disabled={rows.length <= 1}>
              Remove
            </Button>
          </div>
        ))}
        {rows.length < RETAINER_OPTIONS_MAX && (
          <div className="mt-xs">
            <Button type="button" variant="outline" size="sm" full onClick={() => setRows([...rows, { months: '', off: '' }])}>
              Add a length
            </Button>
          </div>
        )}
      </fieldset>
      {badOff && (
        <p role="alert" className="mt-xs m-0 text-subhead">
          A percent off is a number from 0.01 to 100, like 5 or 7.5. Leave it blank for no discount.
        </p>
      )}
      {Number.isFinite(cents) && cents > 0 && options.length > 0 && !badOff && (
        <ul className="mt-sm m-0 list-none rounded-tile bg-paper p-sm text-subhead text-ink-soft">
          {options.map((o) => (
            <li key={o.months}>{`${o.months} months: ${money(retainerMonthlyCents(cents, o.discountBps), currency)} a month, ${money(retainerTotalCents(cents, o.months, o.discountBps), currency)} in all`}</li>
          ))}
        </ul>
      )}
      <div className="mt-sm">
        <Toggle compact on={auto} onChange={setAuto} label="Send each month's invoice by itself" hint="Off keeps each one as a draft for you to send." />
      </div>
      {save.isError && (
        <p role="alert" className="mt-sm m-0 text-subhead">
          {failed(save.error)}
        </p>
      )}
      <div className="mt-md">
        <Button type="submit" full disabled={save.isPending || options.length === 0 || badOff || !Number.isFinite(cents) || cents <= 0}>
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
      <p className="m-0 text-subhead text-ink-soft">{`${retainer.months} months at ${money(retainer.monthlyCents ?? 0, currency)} a month. The first month starts on the day below; the next ones start on the same day of each month (a short month on its last day).`}</p>
      <FieldLabel className="mt-sm" label="First month starts">
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={FIELD} />
      </FieldLabel>
      <div className="mt-sm">
        <Toggle compact on={auto} onChange={setAuto} label="Send each month's invoice by itself" />
      </div>
      {save.isError && (
        <p role="alert" className="mt-sm m-0 text-subhead">
          {failed(save.error)}
        </p>
      )}
      <div className="mt-md">
        <Button type="submit" full disabled={save.isPending || !start}>
          {save.isPending ? 'Starting' : 'Start the retainer'}
        </Button>
      </div>
    </form>
  );
}
