import { INDIAN_STATES, ONBOARDING_STEPS, emptyOnboarding, gstinProblem, onboardingBriefSteps, onboardingProblem, panProblem, phoneProblem, pinCodeProblem, type ClientOnboarding as Draft, type ContractAnswer, type ContractQuestion } from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ApiError, publicApi } from '../lib/api';
import { FIELD } from '../lib/ui';
import { Button } from './Button';
import { GlideFill, StepSlide } from './fx/StepSlide';
import { Busy, SkeletonCard } from './Skeleton';

/** The words on the form. Short lines, plain words, one idea each. */
const COPY = {
  title: 'A few details first',
  lede: 'Fill this in once. It goes into your agreement and your invoices.',
  saved: 'Saved',
  saving: 'Saving',
  saveFailed: 'Not saved yet. We will try again.',
  check: 'Check your answers',
  checkLede: 'This is what goes into your agreement. Tap Change to fix a step.',
  send: 'Send',
  sending: 'Sending',
  sent: 'Thank you. Your agreement is being prepared.',
  sentLede: 'You will see it here as soon as it is ready to read and sign.',
  failed: 'That did not go through. Try again.',
  otherLabel: 'Other',
  refsLabel: 'Videos you like',
  refsHint: 'Paste links to videos or a folder that show the feel you want.',
  addLink: 'Add another link',
};

const FIELDS = {
  legalName: { label: 'Company legal name', hint: 'As it is on your GST or company papers.', auto: 'organization' },
  brands: { label: 'Brand or brands for this trial', hint: '', auto: 'off' },
  addressLine: { label: 'Registered address', hint: 'Building, street and area.', auto: 'street-address' },
  city: { label: 'City', hint: '', auto: 'address-level2' },
  pin: { label: 'PIN code', hint: '', auto: 'postal-code' },
  gstin: { label: 'GSTIN, optional', hint: 'Fifteen characters, like 29ABCDE1234F1Z5.', auto: 'off' },
  pan: { label: 'PAN, optional', hint: 'Ten characters, like ABCDE1234F.', auto: 'off' },
  pocName: { label: 'Their name', hint: '', auto: 'name' },
  designation: { label: 'Their role', hint: 'Like Marketing head or Founder.', auto: 'organization-title' },
  email: { label: 'Their email', hint: '', auto: 'email' },
  phone: { label: 'Their phone', hint: 'Without a code we read it as Indian (+91).', auto: 'tel' },
  billingEmail: { label: 'Billing email, optional', hint: 'Where invoices go. Leave it empty to use the email above.', auto: 'email' },
} as const;
type TextKey = keyof typeof FIELDS;

/** A question's subhead number, for the check screen ("3.4"). */
const numberOf = (q: ContractQuestion): string => /(\d+\.\d+)/.exec(q.heading ?? '')?.[1] ?? /^\s*(\d+\.\d+)/.exec(q.label)?.[1] ?? '';
/** A PAN sits inside a GSTIN, from the third character to the twelfth. */
const panFromGstin = (g: string): string => (gstinProblem(g) === null && g.length === 15 ? g.slice(2, 12) : '');
const emptyAnswer = (): ContractAnswer => ({ picked: [], other: '', text: '' });

/** One labelled text field. Its id is the one the server names when something is missing, so the form can send the person to it. */
function Text({ k, draft, set, onBlur, error, type = 'text', children }: { k: TextKey; draft: Draft; set: (p: Partial<Draft>) => void; onBlur: () => void; error: string | null; type?: string; children?: ReactNode }) {
  const f = FIELDS[k];
  const id = `ob-${k}`;
  return (
    <div className="mt-md">
      <label htmlFor={id} className="block text-headline">
        {f.label}
      </label>
      {f.hint && (
        <span id={`${id}-h`} className="block text-subhead text-ink-soft">
          {f.hint}
        </span>
      )}
      {children ?? (
        <input
          id={id}
          type={type}
          value={draft[k]}
          onChange={(e) => set({ [k]: e.target.value } as Partial<Draft>)}
          onBlur={onBlur}
          autoComplete={f.auto}
          inputMode={k === 'pin' ? 'numeric' : k === 'phone' ? 'tel' : type === 'email' ? 'email' : undefined}
          placeholder={k === 'phone' ? '+91 98765 43210' : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={[f.hint ? `${id}-h` : '', error ? `${id}-e` : ''].filter(Boolean).join(' ') || undefined}
          className={FIELD}
        />
      )}
      {error && (
        <p id={`${id}-e`} role="alert" className="mt-xs m-0 text-subhead">
          {error}
        </p>
      )}
    </div>
  );
}

/** One brief question, as the agreement asks it: tick boxes (or one choice) with an Other line, or a box for words. */
function Question({ q, answer, onChange, onBlur, error }: { q: ContractQuestion; answer: ContractAnswer; onChange: (a: ContractAnswer) => void; onBlur: () => void; error: string | null }) {
  const id = `ob-q-${q.id}`;
  return (
    <>
      {q.heading && <h3 className="mt-md mb-0 text-headline">{q.heading}</h3>}
      {q.intro && <p className="mt-xs m-0 text-subhead text-ink-soft">{q.intro}</p>}
      <Answer q={q} id={id} answer={answer} onChange={onChange} onBlur={onBlur} error={error} />
    </>
  );
}

const Problem = ({ text }: { text: string | null }) =>
  text ? (
    <p role="alert" className="mt-xs m-0 text-subhead">
      {text}
    </p>
  ) : null;

/** The answer part of a question: the lines of a brand guide, a set of links, a box for words, or tick boxes with an Other line. */
function Answer({ q, id, answer, onChange, onBlur, error }: { q: ContractQuestion; id: string; answer: ContractAnswer; onChange: (a: ContractAnswer) => void; onBlur: () => void; error: string | null }) {
  if ((q.fields ?? []).length) {
    const fields = answer.fields ?? {};
    return (
      <fieldset id={id} tabIndex={-1} className="mt-sm m-0 min-w-0 border-0 p-0">
        <legend className="text-headline">{q.group || q.label}</legend>
        {(q.fields ?? []).map((f, i) => (
          <label key={f} className="mt-sm block">
            <span className="block text-subhead font-semibold">{f}</span>
            <input value={fields[f] ?? ''} onChange={(e) => onChange({ ...answer, fields: { ...fields, [f]: e.target.value } })} onBlur={onBlur} maxLength={300} aria-describedby={i === 0 && error ? `${id}-e` : undefined} className={FIELD} />
          </label>
        ))}
        <span id={`${id}-e`}>
          <Problem text={error} />
        </span>
      </fieldset>
    );
  }
  if (q.links) {
    const min = q.links.min;
    const max = q.links.max;
    const shown = (answer.links ?? []).length >= min ? [...(answer.links ?? [])] : [...(answer.links ?? []), ...Array<string>(min - (answer.links ?? []).length).fill('')];
    return (
      <fieldset id={id} tabIndex={-1} className="mt-sm m-0 min-w-0 border-0 p-0">
        <legend className="text-headline">{q.group || COPY.refsLabel}</legend>
        {q.label && <span className="block text-subhead text-ink-soft">{q.label}</span>}
        {shown.map((l, i) => (
          <input
            key={i}
            value={l}
            onChange={(e) => {
              const list = [...shown];
              list[i] = e.target.value;
              onChange({ ...answer, links: list });
            }}
            onBlur={() => {
              onChange({ ...answer, links: shown.map((x) => x.trim()) });
              onBlur();
            }}
            type="url"
            inputMode="url"
            placeholder="https://"
            aria-label={`Link ${i + 1}`}
            maxLength={500}
            className={FIELD}
          />
        ))}
        {shown.length < max && (
          <div className="mt-xs">
            <Button size="sm" variant="ghost" full onClick={() => onChange({ ...answer, links: [...shown, ''] })}>
              {COPY.addLink}
            </Button>
          </div>
        )}
        <Problem text={error} />
      </fieldset>
    );
  }
  if (q.text) {
    return (
      <div className="mt-md">
        <label htmlFor={id} className="mt-sm block text-headline">
          {q.label || q.group}
        </label>
        <textarea id={id} value={answer.text} onChange={(e) => onChange({ ...answer, text: e.target.value })} onBlur={onBlur} rows={4} maxLength={1500} aria-invalid={error ? true : undefined} className={FIELD} />
        {error && (
          <p role="alert" className="mt-xs m-0 text-subhead">
            {error}
          </p>
        )}
      </div>
    );
  }
  const toggle = (opt: string) => {
    const on = answer.picked.includes(opt);
    onChange({ ...answer, picked: q.multi ? (on ? answer.picked.filter((p) => p !== opt) : [...answer.picked, opt]) : on ? [] : [opt] });
  };
  return (
    <fieldset id={id} tabIndex={-1} className="mt-sm m-0 min-w-0 border-0 p-0" aria-invalid={error ? true : undefined}>
      <legend className="text-headline">{q.label || q.group}</legend>
      <span className="block text-subhead text-ink-soft">{q.multi ? 'Tick all that apply.' : 'Pick one.'}</span>
      <div className="mt-sm grid gap-xs">
        {q.options.map((opt) => {
          const on = answer.picked.includes(opt);
          return (
            <label key={opt} className={`toy flex min-h-[48px] cursor-pointer items-center gap-sm rounded-tile border-2 px-sm text-callout ${on ? 'border-ink bg-card-strong' : 'toy-soft border-line bg-card'}`}>
              <input type={q.multi ? 'checkbox' : 'radio'} name={id} checked={on} onChange={() => toggle(opt)} onBlur={onBlur} className="size-[20px] shrink-0 accent-[var(--color-ink)]" />
              <span className="min-w-0">{opt}</span>
            </label>
          );
        })}
      </div>
      {q.other && (
        <label className="mt-xs block">
          <span className="block text-subhead">{COPY.otherLabel}</span>
          <input value={answer.other} onChange={(e) => onChange({ ...answer, other: e.target.value })} onBlur={onBlur} maxLength={200} className={FIELD} />
        </label>
      )}
      {error && (
        <p role="alert" className="mt-xs m-0 text-subhead">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/**
 * The client's first visit: a short form in five steps, phone first, saved as they go (on Next and when a field is left), resumed at the
 * first step not finished. The brief's questions come from the server, so they are the agreement's own. Sending it once fills the client's
 * record and makes their agreement; when it is ready to sign, the form goes straight to it.
 */
export function ClientOnboarding({ token, agencyName, clientName, onDone }: { token: string; agencyName: string; clientName: string; onDone: () => void }) {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['agency', 'portal', token, 'onboarding'], queryFn: () => publicApi.onboarding(token), retry: false, staleTime: Infinity });
  const questions = useMemo(() => q.data?.questions ?? [], [q.data]);
  const byStep = useMemo(() => onboardingBriefSteps(questions), [questions]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState(0);
  const [review, setReview] = useState(false);
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const [status, setStatus] = useState<'' | 'saving' | 'saved' | 'failed'>('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sent, setSent] = useState(false);
  const top = useRef<HTMLHeadingElement>(null);
  const timer = useRef<number | null>(null);
  const latest = useRef<Draft | null>(null);
  // The link boxes as typed (empty ones too); the draft keeps only the filled ones.
  const [refInputs, setRefInputs] = useState<string[]>(['', '', '']);

  // The saved draft, with what the owner already typed filled in, and the first step not finished.
  useEffect(() => {
    if (!q.data || draft) return;
    const d = { ...emptyOnboarding(), ...q.data.draft };
    if (!d.brands) d.brands = q.data.prefill.brand;
    if (!d.email) d.email = q.data.prefill.email;
    setDraft(d);
    latest.current = d;
    setRefInputs(d.references.length >= 3 ? d.references : [...d.references, ...Array<string>(3 - d.references.length).fill('')]);
    const p = onboardingProblem(d, q.data.questions);
    setStep(p ? p.step : ONBOARDING_STEPS.length - 1);
    if (!p) setReview(true);
  }, [q.data, draft]);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const save = async () => {
    const d = latest.current;
    if (!d) return;
    if (timer.current) window.clearTimeout(timer.current);
    setStatus('saving');
    try {
      await publicApi.onboardingSave(token, d);
      setStatus('saved');
    } catch {
      setStatus('failed');
    }
  };
  // A field left saves after a short pause, so a run of fields left one after the other saves once.
  const saveSoon = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void save(), 600);
  };
  const set = (p: Partial<Draft>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...p };
      // A PAN typed nowhere yet is read from the GSTIN.
      if ('gstin' in p && !prev.pan) next.pan = panFromGstin(next.gstin.replace(/\s+/g, '').toUpperCase());
      latest.current = next;
      return next;
    });
    if (error) setError(null);
  };
  const moveTo = (n: number) => {
    setStep(n);
    setReview(false);
    window.requestAnimationFrame(() => top.current?.focus());
  };

  if (q.isPending || (!draft && !q.isError)) {
    return (
      <Busy label="Loading the form" className="grid gap-md pt-md">
        <SkeletonCard lines={5} />
      </Busy>
    );
  }
  if (q.isError || !draft) {
    return (
      <div role="alert" className="mt-md rounded-card bg-card p-md shadow-toy-soft">
        <p className="m-0 text-headline">{COPY.failed}</p>
        <div className="mt-sm">
          <Button onClick={() => void q.refetch()}>Try again</Button>
        </div>
      </div>
    );
  }

  const next = async () => {
    const p = onboardingProblem(draft, questions);
    if (p && p.step <= step) {
      setStep(p.step);
      setError({ field: p.field, message: p.message });
      window.requestAnimationFrame(() => document.getElementById(`ob-${p.field}`)?.focus());
      return;
    }
    void save();
    if (step >= ONBOARDING_STEPS.length - 1) {
      setReview(true);
      window.requestAnimationFrame(() => top.current?.focus());
    } else moveTo(step + 1);
  };
  const send = async () => {
    setSending(true);
    setSendError('');
    try {
      const r = await publicApi.onboardingSubmit(token, draft);
      setSent(true);
      if (r.contractToken) nav(`/k/${r.contractToken}`);
      else onDone();
    } catch (e) {
      if (e instanceof ApiError && typeof e.data.step === 'number') {
        moveTo(e.data.step as number);
        setError({ field: String(e.data.field ?? ''), message: e.message });
      } else if (e instanceof ApiError && e.status === 409) {
        onDone();
      } else setSendError(e instanceof ApiError ? e.message : COPY.failed);
    } finally {
      setSending(false);
    }
  };
  const errOf = (field: string) => (error?.field === field ? error.message : null);
  const blur = saveSoon;
  const s = ONBOARDING_STEPS[step]!;
  const refs = refInputs;
  const setRef = (i: number, v: string) => {
    const list = [...refs];
    list[i] = v;
    setRefInputs(list);
    set({ references: list.map((x) => x.trim()).filter(Boolean) });
  };
  const live = (k: 'pin' | 'gstin' | 'pan' | 'phone'): string | null => {
    const v = draft[k];
    if (!v) return errOf(k);
    return errOf(k) ?? (k === 'pin' ? (v.length >= 6 ? pinCodeProblem(v) : null) : k === 'gstin' ? (v.replace(/\s+/g, '').length >= 15 ? gstinProblem(v) : null) : k === 'pan' ? (v.replace(/\s+/g, '').length >= 10 ? panProblem(v) : null) : null);
  };

  if (sent) {
    return (
      <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" role="status">
        <h2 className="text-title2">{COPY.sent}</h2>
        <p className="mt-xs m-0 text-callout text-ink-soft">{COPY.sentLede}</p>
      </section>
    );
  }

  return (
    <section className="mt-md mx-auto max-w-[600px]" aria-labelledby="ob-step">
      <p className="m-0 text-subhead text-ink-soft" aria-live="polite">
        {review ? COPY.check : `Step ${step + 1} of ${ONBOARDING_STEPS.length}`}
      </p>
      <div className="mt-xs h-[6px] overflow-hidden rounded-pill bg-line" aria-hidden>
        <GlideFill share={(review ? ONBOARDING_STEPS.length : step + 1) / ONBOARDING_STEPS.length} className="h-full w-full rounded-pill bg-ink" />
      </div>
      <StepSlide at={review ? ONBOARDING_STEPS.length : step}>
        <h2 id="ob-step" ref={top} tabIndex={-1} className="mt-md text-title1 outline-none">
          {review ? COPY.check : s.title}
        </h2>
        <p className="mt-xs m-0 text-callout text-ink-soft">{review ? COPY.checkLede : s.line}</p>

        {review ? (
          <Review draft={draft} questions={questions} byStep={byStep} onChange={moveTo} />
        ) : (
          <div className="rounded-card bg-card p-md shadow-toy-soft mt-md">
            {step === 0 && (
              <>
                <Text k="legalName" draft={draft} set={set} onBlur={blur} error={errOf('legalName')} />
                <Text k="brands" draft={draft} set={set} onBlur={blur} error={errOf('brands')} />
                <Text k="addressLine" draft={draft} set={set} onBlur={blur} error={errOf('addressLine')} />
                <Text k="city" draft={draft} set={set} onBlur={blur} error={errOf('city')} />
                <div className="mt-md">
                  <label htmlFor="ob-state" className="block text-headline">
                    State
                  </label>
                  <select id="ob-state" value={draft.state} onChange={(e) => set({ state: e.target.value })} onBlur={blur} autoComplete="address-level1" aria-invalid={errOf('state') ? true : undefined} className={FIELD}>
                    <option value="">Pick a state</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  {errOf('state') && (
                    <p role="alert" className="mt-xs m-0 text-subhead">
                      {errOf('state')}
                    </p>
                  )}
                </div>
                <Text k="pin" draft={draft} set={(p) => set({ pin: (p.pin ?? '').replace(/\D/g, '').slice(0, 6) })} onBlur={blur} error={live('pin')} />
                <Text k="gstin" draft={draft} set={(p) => set({ gstin: (p.gstin ?? '').toUpperCase().slice(0, 20) })} onBlur={blur} error={live('gstin')} />
                <Text k="pan" draft={draft} set={(p) => set({ pan: (p.pan ?? '').toUpperCase().slice(0, 12) })} onBlur={blur} error={live('pan')} />
              </>
            )}
            {step === 1 && (
              <>
                <Text k="pocName" draft={draft} set={set} onBlur={blur} error={errOf('pocName')} />
                <Text k="designation" draft={draft} set={set} onBlur={blur} error={errOf('designation')} />
                <Text k="email" type="email" draft={draft} set={set} onBlur={blur} error={errOf('email')} />
                <Text k="phone" type="tel" draft={draft} set={set} onBlur={blur} error={errOf('phone') ?? (draft.phone.replace(/\D/g, '').length >= 10 ? phoneProblem(draft.phone) : null)} />
                <Text k="billingEmail" type="email" draft={draft} set={set} onBlur={blur} error={errOf('billingEmail')} />
              </>
            )}
            {step >= 2 &&
              (byStep[step] ?? []).map((qq) => (
                <Question key={qq.id} q={qq} answer={draft.brief[qq.id] ?? emptyAnswer()} onChange={(a) => set({ brief: { ...draft.brief, [qq.id]: a } })} onBlur={blur} error={errOf(`q-${qq.id}`)} />
              ))}
            {step === ONBOARDING_STEPS.length - 1 && !questions.some((qq) => qq.links) && (
              <fieldset id="ob-references" tabIndex={-1} className="mt-md m-0 min-w-0 border-0 p-0">
                <legend className="text-headline">{COPY.refsLabel}</legend>
                <span className="block text-subhead text-ink-soft">{COPY.refsHint}</span>
                {refs.map((r, i) => (
                  <input key={i} value={r} onChange={(e) => setRef(i, e.target.value)} onBlur={blur} type="url" inputMode="url" placeholder="https://" aria-label={`Link ${i + 1}`} maxLength={500} className={FIELD} />
                ))}
                {refs.length < 5 && (
                  <div className="mt-xs">
                    <Button size="sm" variant="ghost" full onClick={() => setRefInputs([...refs, ''])}>
                      {COPY.addLink}
                    </Button>
                  </div>
                )}
                {errOf('references') && (
                  <p role="alert" className="mt-xs m-0 text-subhead">
                    {errOf('references')}
                  </p>
                )}
              </fieldset>
            )}
          </div>
        )}
      </StepSlide>

      {sendError && (
        <p role="alert" className="mt-sm m-0 text-subhead">
          {sendError}
        </p>
      )}
      <div className="mt-md flex items-center justify-between gap-sm">
        <Button variant="outline" onClick={() => (review ? moveTo(ONBOARDING_STEPS.length - 1) : moveTo(step - 1))} disabled={!review && step === 0}>
          Back
        </Button>
        <span className="min-w-0 text-caption text-ink-soft" aria-live="polite">
          {status === 'saving' ? COPY.saving : status === 'saved' ? COPY.saved : status === 'failed' ? COPY.saveFailed : ''}
        </span>
        {review ? (
          <Button onClick={() => void send()} disabled={sending}>
            {sending ? COPY.sending : COPY.send}
          </Button>
        ) : (
          <Button onClick={() => void next()}>Next</Button>
        )}
      </div>
      <p className="mt-md m-0 text-caption text-ink-mute">{`For ${clientName}${agencyName ? `, from ${agencyName}` : ''}.`}</p>
    </section>
  );
}

/** Every answer on one screen before it is sent, grouped by step, each with a Change that goes back to it. */
function Review({ draft, questions, byStep, onChange }: { draft: Draft; questions: readonly ContractQuestion[]; byStep: ContractQuestion[][]; onChange: (step: number) => void }) {
  const line = (label: string, value: string) => (value.trim() ? [label, value.trim()] : null);
  const answerText = (q: ContractQuestion) => {
    const a = draft.brief[q.id];
    if (!a) return '';
    if (q.links) return (a.links ?? []).filter(Boolean).join('\n');
    if ((q.fields ?? []).length) return Object.entries(a.fields ?? {}).filter(([, v]) => v.trim()).map(([k, v]) => `${k}: ${v.trim()}`).join('\n');
    return q.text ? a.text : [...a.picked, a.other.trim() ? `Other: ${a.other.trim()}` : ''].filter(Boolean).join(', ');
  };
  const groups: { step: number; rows: (string[] | null)[] }[] = [
    { step: 0, rows: [line('Legal name', draft.legalName), line('Brands', draft.brands), line('Address', [draft.addressLine, draft.city, `${draft.state} ${draft.pin}`.trim()].filter(Boolean).join(', ')), line('GSTIN', draft.gstin), line('PAN', draft.pan)] },
    { step: 1, rows: [line('Name', draft.pocName), line('Role', draft.designation), line('Email', draft.email), line('Phone', draft.phone), line('Billing email', draft.billingEmail)] },
    ...[2, 3, 4].map((st) => ({ step: st, rows: [...(byStep[st] ?? []).map((q) => line([numberOf(q), q.group].filter(Boolean).join(' ') || q.label.slice(0, 40), answerText(q))), ...(st === 4 && !questions.some((q) => q.links) ? [line('Videos you like', draft.references.join('\n'))] : [])] })),
  ];
  return (
    <div className="mt-md grid gap-sm">
      {groups.map((g) => (
        <div key={g.step} className="rounded-card bg-card p-md shadow-toy-soft">
          <div className="flex items-center justify-between gap-sm">
            <h3 className="m-0 text-headline">{ONBOARDING_STEPS[g.step]!.title}</h3>
            <Button size="sm" variant="ghost" onClick={() => onChange(g.step)}>
              Change
            </Button>
          </div>
          <dl className="mt-xs m-0 grid gap-xs">
            {g.rows
              .filter((r): r is string[] => r !== null)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-caption text-ink-soft">{k}</dt>
                  {/* One block per line, so a list of links reads as separate lines (one link is never a lone word under the others). */}
                  <dd className="m-0 whitespace-pre-wrap break-words text-prose">
                    {(v ?? '').split('\n').map((ln, i) => (
                      <span key={i} className="block">
                        {ln || ' '}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
