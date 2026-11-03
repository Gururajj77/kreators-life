import { CONSENT_PURPOSES, LEGAL_VERSION, LOCALE, type ConsentChoices } from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { globalPrivacyControl, useConsent } from '../lib/consent';
import { Section } from './Section';

/** Profile, "Privacy choices": the three things the popup asked about, each a tick that saves at once, and what the person agreed to and when. */
export function PrivacyChoices() {
  const qc = useQueryClient();
  const keep = useConsent((s) => s.keep);
  const q = useQuery({ queryKey: ['legal'], queryFn: api.legal });
  const save = useMutation({
    mutationFn: (choices: ConsentChoices) => {
      keep(choices);
      return api.saveConsent(choices, 'profile');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['legal'] }),
  });
  const gpc = globalPrivacyControl();
  const d = q.data;
  const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }) : null);
  return (
    <Section id="privacy-choices" title="Privacy choices" lede="Asked once, changed here any time. Each tick saves at once.">
      <ul className="flex list-none flex-col gap-xs p-0 m-0">
        {CONSENT_PURPOSES.map((p) => {
          const off = p.key === 'attribution' && gpc;
          return (
            <li key={p.key} className="rounded-tile bg-card p-xs shadow-toy-soft">
              <label className="toy toy-flat flex min-h-[44px] cursor-pointer items-start gap-sm rounded-tile px-xs py-xs">
                <input
                  type="checkbox"
                  checked={Boolean(d?.consent[p.key]) && !off}
                  disabled={!d || off || save.isPending}
                  onChange={(e) => d && save.mutate({ ...d.consent, [p.key]: e.target.checked })}
                  className="mt-xs size-[24px] shrink-0"
                />
                <span>
                  <span className="block text-[16px] font-bold">{p.name}</span>
                  <span className="block text-[12px] font-semibold text-ink-soft">{off ? 'Your browser sent Global Privacy Control, so this stays off.' : p.line}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {save.isError && (
        <p role="alert" className="mt-xs m-0 text-[14px] font-bold">
          That did not save. Try again.
        </p>
      )}
      <p className="mt-sm m-0 text-[12px] font-semibold text-ink-soft">
        {d && !d.needsAcceptance ? `You agreed to the terms of use and privacy policy (version ${LEGAL_VERSION}) on ${when(d.acceptedAt.terms) ?? 'an earlier day'}. ` : ''}Read the{' '}
        <Link to="/terms" className="font-extrabold underline underline-offset-4">
          terms
        </Link>{' '}
        and the{' '}
        <Link to="/privacy" className="font-extrabold underline underline-offset-4">
          privacy policy
        </Link>
        . Your data, export and delete are under Account.
      </p>
    </Section>
  );
}
