import { useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { A, Bullets, Fact, Grievance, H, LegalPage, Mail, NOT_SET, P, Strong, contactEmail, useBusiness } from './legalBits';
import { Link } from 'react-router';
import { FIELD } from '../lib/ui';


interface Blank {
  name: string;
  email: string;
  work: string;
  urls: string;
  statement: string;
  signature: string;
}
const BLANK: Blank = { name: '', email: '', work: '', urls: '', statement: '', signature: '' };

/** One of the two forms. It posts to the public notice route and shows the reference, or the server's own words when it says no. */
function NoticeForm({ kind }: { kind: 'notice' | 'counter' }) {
  const [v, setV] = useState<Blank>(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const counter = kind === 'counter';
  const id = (n: string) => `${kind}-${n}`;
  const set = (k: keyof Blank) => (e: { target: { value: string } }) => setV((o) => ({ ...o, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/public/copyright-notice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...v, kind }) });
      const body = (await res.json().catch(() => ({}))) as { error?: string; reference?: string };
      if (!res.ok || !body.reference) {
        setError(body.error ?? 'That did not send. Try again in a moment.');
      } else {
        setReference(body.reference);
        setV(BLANK);
      }
    } catch {
      setError('That did not send. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <div role="status" className="mt-sm rounded-tile bg-card p-md">
        <p className="m-0 text-[16px] font-extrabold">We have it.</p>
        <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">
          Your reference is <Strong>{reference}</Strong>. Keep it. A person will read your {counter ? 'counter-notice' : 'notice'} and write back to the email you gave.
        </p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="mt-sm rounded-card bg-card p-md" aria-label={counter ? 'Counter-notice' : 'Copyright notice'}>
      <label className="block text-[14px] font-bold" htmlFor={id('name')}>
        Your full name
      </label>
      <input id={id('name')} required value={v.name} onChange={set('name')} maxLength={120} autoComplete="name" className={FIELD} />
      <label className="mt-sm block text-[14px] font-bold" htmlFor={id('email')}>
        Your email
      </label>
      <input id={id('email')} required type="email" value={v.email} onChange={set('email')} maxLength={200} autoComplete="email" className={FIELD} />
      <label className="mt-sm block text-[14px] font-bold" htmlFor={id('work')}>
        {counter ? 'What was removed, and where it was shown before' : 'The work that was copied'}
      </label>
      <textarea id={id('work')} required value={v.work} onChange={set('work')} rows={3} maxLength={1000} className={FIELD} />
      <label className="mt-sm block text-[14px] font-bold" htmlFor={id('urls')}>
        {counter ? 'The addresses where it was shown' : 'The addresses (links) on kreators.app where it is shown'}
      </label>
      <textarea id={id('urls')} required value={v.urls} onChange={set('urls')} rows={3} maxLength={2000} className={FIELD} />
      <label className="mt-sm block text-[14px] font-bold" htmlFor={id('statement')}>
        {counter ? 'Your statement, with your address and phone number' : 'Your statement'}
      </label>
      <textarea id={id('statement')} value={v.statement} onChange={set('statement')} rows={4} maxLength={1000} className={FIELD} />
      <p className="mt-xs m-0 text-[12px] font-semibold text-ink-mute">
        {counter
          ? 'Say that you believe, in good faith, that it was removed by mistake or because it was wrongly identified, that this is true under penalty of perjury, and that you accept the courts of your home country for any claim.'
          : 'Say that you believe, in good faith, that the use is not allowed by the owner, the law or a licence, that what you wrote is accurate, and, under penalty of perjury, that you own the right or may act for the owner.'}
      </p>
      <label className="mt-sm block text-[14px] font-bold" htmlFor={id('signature')}>
        Your signature (type your full name)
      </label>
      <input id={id('signature')} required value={v.signature} onChange={set('signature')} maxLength={120} className={FIELD} />
      {error && (
        <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
          {error}
        </p>
      )}
      <div className="mt-md">
        <Button type="submit" disabled={busy}>
          {busy ? 'Sending' : counter ? 'Send the counter-notice' : 'Send the notice'}
        </Button>
      </div>
    </form>
  );
}

/** The copyright policy: what we do with a notice, how to send one or answer one, and who the designated agent is. */
export function Copyright() {
  const { business, loading } = useBusiness();
  const email = contactEmail(business);
  const agent = business?.dmcaAgent ?? '';
  const unset = loading ? 'Loading.' : NOT_SET;
  return (
    <LegalPage
      title="Copyright"
      lede="If something here copies your work, or we took down yours by mistake."
      action={
        <>
          <Link to="#send-notice" className="toy toy-soft inline-flex min-h-[44px] items-center rounded-pill bg-card px-md text-[14px] font-bold">
            Send a notice
          </Link>
          <Link to="#send-counter" className="toy toy-soft inline-flex min-h-[44px] items-center rounded-pill bg-card px-md text-[14px] font-bold">
            Send a counter-notice
          </Link>
        </>
      }
    >
      <H>Content people post</H>
      <P>People upload pictures and post words here, and they promise they have the right to. We do not check each one beforehand. When a copyright owner tells us about a copy, we act on it. If you upload or post something, it must be yours, or you must have permission to use it.</P>
      <H>What we do with a notice</H>
      <Bullets
        items={[
          'We remove the content or switch off access to it quickly.',
          'We tell the person who posted it, with a copy of the notice.',
          'If they send a valid counter-notice, we pass it to you. We put the content back after the legal waiting period, which is ten to fourteen business days, unless you tell us you have started a court case.',
          'We keep a record of the notice for three years after it is settled.',
        ]}
      />
      <H>Repeat infringers</H>
      <P>An account that gets repeated valid notices is closed.</P>

      <H id="send-notice">Send a copyright notice</H>
      <P>A notice needs these things. The form below asks for each.</P>
      <Bullets
        items={[
          'Which work was copied.',
          'Where the copy is on kreators.app: the addresses.',
          'Your name and a working email.',
          'A statement that you believe in good faith the use is not allowed.',
          'A statement that what you wrote is accurate and, under penalty of perjury, that you own the right or may act for the owner.',
          'Your signature: your full name, typed.',
        ]}
      />
      <NoticeForm kind="notice" />

      <H id="send-counter">Send a counter-notice</H>
      <P>Use this if we removed your content and you think that was a mistake. Say what was removed, where it was shown, and why you think it was wrong. We pass what you send to the person who made the notice.</P>
      <NoticeForm kind="counter" />

      <H>Notices from India</H>
      <P>A notice about a work copied in India is handled under India's Copyright Act and the IT Rules, through our Grievance Officer. Use the forms above, or write to the Grievance Officer.</P>
      <Grievance business={business} loading={loading} />

      <H>Our designated agent (United States)</H>
      <P>For a notice under the US copyright law (the DMCA), you can also write to our agent.</P>
      <div className="mt-sm grid gap-sm md:grid-cols-2">
        <Fact label="Agent" value={agent} unset={unset} />
        <Fact label="Address" value={business?.dmcaAddress} unset={unset} />
        <Fact label="Email" value={business?.dmcaEmail || email} unset="" />
      </div>
      {!loading && !business?.dmcaRegistered && <P>Listing with the US Copyright Office is in progress.</P>}
      <P>
        Questions that are not a notice go to <Mail address={email} />. Read our <A to="/terms">terms</A> too.
      </P>
    </LegalPage>
  );
}
