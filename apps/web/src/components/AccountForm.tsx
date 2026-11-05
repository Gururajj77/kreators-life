import { birthDateProblem, passwordProblem, PHONE_HINT, phoneProblem } from '@kreators/shared';
import { useState } from 'react';
import { todayLocal } from '../lib/date';
import { FIELD, FIELD_LINE } from '../lib/ui';
import { AnimatedIcon } from './AnimatedIcon';
import { ChatActions } from './Chat';
import { TermsBox } from './TermsBox';

/**
 * A new password field with a show and hide button inside its right edge (the animated eye). The button is 44px and
 * names what it does; the field keeps room for it so typed text never runs under it.
 */
function PasswordField({ value, onChange, what }: { value: string; onChange: (e: { target: { value: string } }) => void; what: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="relative mt-xs block">
      <input type={shown ? 'text' : 'password'} value={value} onChange={onChange} autoComplete="new-password" maxLength={128} autoCapitalize="off" spellCheck={false} className={`${FIELD_LINE} pr-xl`} />
      <button
        type="button"
        onClick={() => setShown((x) => !x)}
        aria-label={shown ? `Hide ${what}` : `Show ${what}`}
        aria-pressed={shown}
        className="toy toy-flat absolute right-xs top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-pill text-ink-soft"
      >
        <AnimatedIcon name="visibility" size={20} active={shown} interaction="click-toggle" />
      </button>
    </span>
  );
}

/**
 * The account, made inside a conversation: the same fields and rules as the sign-up page. The setup chat shows
 * it first to a device session; the strategy session keeps it for a device account that opens Pillars.
 */
export function AccountForm({ initialName, onSend }: { initialName: string; onSend: (value: Record<string, string>, label: string) => void }) {
  const [v, setV] = useState({ name: initialName, email: '', password: '', confirm: '', phone: '', birthDate: '' });
  const [agree, setAgree] = useState(false);
  const weak = v.password ? passwordProblem(v.password, v.email) : null;
  const mismatch = v.confirm.length > 0 && v.confirm !== v.password;
  const badPhone = v.phone ? phoneProblem(v.phone) : null;
  const badBirth = v.birthDate ? birthDateProblem(v.birthDate) : null;
  const ready = v.email.includes('@') && v.password.length > 0 && !weak && v.confirm === v.password && v.phone.length > 0 && !badPhone && v.birthDate.length > 0 && !badBirth && agree;
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const hint = (t: string | null) => (t ? <span className="mt-xs block text-caption text-ink-soft">{t}</span> : null);
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="grid gap-xs md:grid-cols-2">
        <label className="block">
          <span className="block text-subhead font-semibold">What should we call you?</span>
          <input value={v.name} onChange={set('name')} maxLength={40} autoComplete="nickname" className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Email</span>
          <input type="email" value={v.email} onChange={set('email')} autoComplete="email" maxLength={254} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Password</span>
          <PasswordField value={v.password} onChange={set('password')} what="password" />
          {hint(weak ?? 'Eight characters or more. Not your email, not one from the usual guess lists.')}
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Password, once more</span>
          <PasswordField value={v.confirm} onChange={set('confirm')} what="password" />
          {hint(mismatch ? 'The two do not match yet.' : null)}
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Phone</span>
          <input type="tel" value={v.phone} onChange={set('phone')} autoComplete="tel" maxLength={24} placeholder="+91 98765 43210" className={FIELD} />
          {hint(badPhone ?? PHONE_HINT)}
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Date of birth</span>
          <input type="date" value={v.birthDate} onChange={set('birthDate')} autoComplete="bday" max={todayLocal()} className={FIELD} />
          {hint(badBirth ?? 'Eighteen or over. Never shown to anyone.')}
        </label>
      </div>
      <TermsBox checked={agree} onChange={setAgree} />
      <ChatActions full next="Make my account" ready={ready} onNext={() => onSend({ name: v.name.trim(), email: v.email.trim(), password: v.password, phone: v.phone.trim(), birthDate: v.birthDate, acceptTerms: 'yes' }, `Account made for ${v.email.trim()}`)} />
    </div>
  );
}

/**
 * The same account in two small cards, for the setup chat: first how you sign in, then the two private details.
 * Each card sends its half; the chat posts both together.
 */
export function SignInCard({ initialName, onSend }: { initialName: string; onSend: (value: Record<string, string>, label: string) => void }) {
  const [v, setV] = useState({ name: initialName, email: '', password: '', confirm: '' });
  const weak = v.password ? passwordProblem(v.password, v.email) : null;
  const mismatch = v.confirm.length > 0 && v.confirm !== v.password;
  const ready = v.email.includes('@') && v.password.length > 0 && !weak && v.confirm === v.password;
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const hint = (t: string | null) => (t ? <span className="mt-xs block text-caption text-ink-soft">{t}</span> : null);
  return (
    <form
      className="rounded-tile bg-card p-sm shadow-toy-soft"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSend({ name: v.name.trim(), email: v.email.trim(), password: v.password }, `${v.name.trim() ? `${v.name.trim()}, ` : ''}${v.email.trim()}`);
      }}
    >
      <div className="grid gap-xs md:grid-cols-2">
        <label className="block">
          <span className="block text-subhead font-semibold">Your name</span>
          <input value={v.name} onChange={set('name')} maxLength={40} autoComplete="nickname" className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Email</span>
          <input type="email" value={v.email} onChange={set('email')} autoComplete="email" maxLength={254} className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Password</span>
          <PasswordField value={v.password} onChange={set('password')} what="password" />
          {hint(weak ?? 'Eight or more letters, numbers or signs.')}
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Password again</span>
          <PasswordField value={v.confirm} onChange={set('confirm')} what="password" />
          {hint(mismatch ? 'These two do not match yet.' : null)}
        </label>
      </div>
      <ChatActions next="Next" extra="one more step" ready={ready} submit />
    </form>
  );
}

export function PrivateCard({ onSend }: { onSend: (value: Record<string, string>, label: string) => void }) {
  const [v, setV] = useState({ phone: '', birthDate: '' });
  const [agree, setAgree] = useState(false);
  const badPhone = v.phone ? phoneProblem(v.phone) : null;
  const badBirth = v.birthDate ? birthDateProblem(v.birthDate) : null;
  const ready = v.phone.length > 0 && !badPhone && v.birthDate.length > 0 && !badBirth && agree;
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const hint = (t: string | null) => (t ? <span className="mt-xs block text-caption text-ink-soft">{t}</span> : null);
  return (
    <form
      className="rounded-tile bg-card p-sm shadow-toy-soft"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSend({ phone: v.phone.trim(), birthDate: v.birthDate, acceptTerms: 'yes' }, 'Phone and birthday added');
      }}
    >
      <div className="grid gap-xs md:grid-cols-2">
        <label className="block">
          <span className="block text-subhead font-semibold">Phone</span>
          <input type="tel" value={v.phone} onChange={set('phone')} autoComplete="tel" maxLength={24} placeholder="+91 98765 43210" className={FIELD} />
          {hint(badPhone ?? PHONE_HINT)}
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">Date of birth</span>
          <input type="date" value={v.birthDate} onChange={set('birthDate')} autoComplete="bday" max={todayLocal()} className={FIELD} />
          {hint(badBirth)}
        </label>
      </div>
      <TermsBox checked={agree} onChange={setAgree} />
      <ChatActions next="Make my account" ready={ready} submit />
    </form>
  );
}
