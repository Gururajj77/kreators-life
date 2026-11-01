import { LEGAL_VERSION } from '@kreators/shared';
import { Link } from 'react-router';

/** The box next to the button that makes an account. Unticked at the start: the terms are agreed to on purpose, never by default. */
export function TermsBox({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="toy toy-flat mt-xs flex min-h-[44px] cursor-pointer items-start gap-sm rounded-tile px-xs py-xs">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-xs size-[24px] shrink-0" />
      <span className="text-[14px] font-semibold leading-snug">
        I agree to the{' '}
        <Link to="/terms" target="_blank" className="font-extrabold underline underline-offset-4">
          Terms of use
        </Link>{' '}
        and have read the{' '}
        <Link to="/privacy" target="_blank" className="font-extrabold underline underline-offset-4">
          Privacy policy
        </Link>{' '}
        (version {LEGAL_VERSION}).
      </span>
    </label>
  );
}
