import { birthDateProblem, passwordProblem, phoneProblem } from '@kreators/shared';
import { useState } from 'react';
import { ChatActions } from './Chat';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';

/**
 * The account, made inside a conversation: the same fields and rules as the sign-up page. The setup chat shows
 * it first to a device session; the strategy session keeps it for a device account that opens Pillars.
 */
export function AccountForm({ initialName, onSend }: { initialName: string; onSend: (value: Record<string, string>, label: string) => void }) {
  const [v, setV] = useState({ name: initialName, email: '', password: '', confirm: '', phone: '', birthDate: '' });
  const weak = v.password ? passwordProblem(v.password, v.email) : null;
  const mismatch = v.confirm.length > 0 && v.confirm !== v.password;
  const badPhone = v.phone ? phoneProblem(v.phone) : null;
  const badBirth = v.birthDate ? birthDateProblem(v.birthDate) : null;
  const ready = v.email.includes('@') && v.password.length > 0 && !weak && v.confirm === v.password && v.phone.length > 0 && !badPhone && v.birthDate.length > 0 && !badBirth;
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const hint = (t: string | null) => (t ? <span className="mt-xs block text-[12px] font-bold text-ink-soft">{t}</span> : null);
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="grid gap-xs md:grid-cols-2">
        <label className="block">
          <span className="block text-[14px] font-bold">What should we call you?</span>
          <input value={v.name} onChange={set('name')} maxLength={40} autoComplete="nickname" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Email</span>
          <input type="email" value={v.email} onChange={set('email')} autoComplete="email" maxLength={254} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Password</span>
          <input type="password" value={v.password} onChange={set('password')} autoComplete="new-password" maxLength={128} className={field} />
          {hint(weak ?? 'Eight characters or more. Not your email, not one from the usual guess lists.')}
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Password, once more</span>
          <input type="password" value={v.confirm} onChange={set('confirm')} autoComplete="new-password" maxLength={128} className={field} />
          {hint(mismatch ? 'The two do not match yet.' : null)}
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Phone</span>
          <input type="tel" value={v.phone} onChange={set('phone')} autoComplete="tel" maxLength={24} placeholder="+91 98765 43210" className={field} />
          {hint(badPhone)}
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Date of birth</span>
          <input type="date" value={v.birthDate} onChange={set('birthDate')} autoComplete="bday" max={new Date().toISOString().slice(0, 10)} className={field} />
          {hint(badBirth ?? 'Eighteen or over. Never shown to anyone.')}
        </label>
      </div>
      <ChatActions full next="Make my account" ready={ready} onNext={() => onSend({ name: v.name.trim(), email: v.email.trim(), password: v.password, phone: v.phone.trim(), birthDate: v.birthDate }, `Account made for ${v.email.trim()}`)} />
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
  const hint = (t: string | null) => (t ? <span className="mt-xs block text-[12px] font-bold text-ink-soft">{t}</span> : null);
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
          <span className="block text-[14px] font-bold">Your name</span>
          <input value={v.name} onChange={set('name')} maxLength={40} autoComplete="nickname" className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Email</span>
          <input type="email" value={v.email} onChange={set('email')} autoComplete="email" maxLength={254} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Password</span>
          <input type="password" value={v.password} onChange={set('password')} autoComplete="new-password" maxLength={128} className={field} />
          {hint(weak ?? 'Eight or more letters, numbers or signs.')}
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Password again</span>
          <input type="password" value={v.confirm} onChange={set('confirm')} autoComplete="new-password" maxLength={128} className={field} />
          {hint(mismatch ? 'These two do not match yet.' : null)}
        </label>
      </div>
      <ChatActions next="Next" extra="one more step" ready={ready} submit />
    </form>
  );
}

export function PrivateCard({ onSend }: { onSend: (value: Record<string, string>, label: string) => void }) {
  const [v, setV] = useState({ phone: '', birthDate: '' });
  const badPhone = v.phone ? phoneProblem(v.phone) : null;
  const badBirth = v.birthDate ? birthDateProblem(v.birthDate) : null;
  const ready = v.phone.length > 0 && !badPhone && v.birthDate.length > 0 && !badBirth;
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const hint = (t: string | null) => (t ? <span className="mt-xs block text-[12px] font-bold text-ink-soft">{t}</span> : null);
  return (
    <form
      className="rounded-tile bg-card p-sm shadow-toy-soft"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onSend({ phone: v.phone.trim(), birthDate: v.birthDate }, 'Phone and birthday added');
      }}
    >
      <div className="grid gap-xs md:grid-cols-2">
        <label className="block">
          <span className="block text-[14px] font-bold">Phone</span>
          <input type="tel" value={v.phone} onChange={set('phone')} autoComplete="tel" maxLength={24} placeholder="+91 98765 43210" className={field} />
          {hint(badPhone)}
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">Date of birth</span>
          <input type="date" value={v.birthDate} onChange={set('birthDate')} autoComplete="bday" max={new Date().toISOString().slice(0, 10)} className={field} />
          {hint(badBirth)}
        </label>
      </div>
      <ChatActions next="Make my account" ready={ready} submit />
    </form>
  );
}
