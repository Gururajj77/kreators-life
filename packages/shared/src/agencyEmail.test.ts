import { describe, expect, it } from 'vitest';
import { EMAIL_NOTE_MAX, EMAIL_SUBJECT_MAX, EMAIL_TEMPLATES, emailTemplate, emptyEmailVars, fillEmail, emailVarsFor, parseEmailNote, suggestEmailTemplate, type EmailVars } from './agencyEmail';

const full: EmailVars = {
  names: 'Parag and Circle team',
  engagement: 'one month Voxpop trial engagement',
  attached: ['The Service Agreement for the one month Voxpop trial engagement', 'The invoice for ₹30,000 (full advance)'],
  amount: '₹30,000',
  period: 'May 2026',
  dueBy: '1 May 2026',
  status: 'shoot completed, editing in progress',
  note: 'One more thing.',
  signName: 'Shubham Aggarwal',
  signStudio: 'Studio Example',
  signPhone: '+91 90000 00000',
  signEmail: 'hello@example.test',
};

describe('agency email notes', () => {
  it('has a unique key, a name and a reason for every note', () => {
    const keys = EMAIL_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of EMAIL_TEMPLATES) {
      expect(t.name.length).toBeGreaterThan(3);
      expect(t.when.length).toBeGreaterThan(10);
    }
  });

  it('fills every note with no token, no "undefined" and no double gap', () => {
    for (const t of EMAIL_TEMPLATES) {
      for (const vars of [full, emptyEmailVars()]) {
        const { subject, body } = fillEmail(t.key, vars);
        expect(subject.length).toBeGreaterThan(3);
        expect(body.length).toBeLessThan(EMAIL_NOTE_MAX);
        expect(`${subject}\n${body}`).not.toMatch(/undefined|null|\{|\}|NaN/);
        expect(body).not.toMatch(/\n{3,}/);
        expect(body).not.toMatch(/ ,|\( \)|\(\)/);
        expect(`${subject}${body}`).not.toMatch(/Kreators Life/);
      }
    }
  });

  it('follows the shape of the first send: attached, then what must happen, then the sign-off', () => {
    const { body } = fillEmail('begin', full);
    expect(body.startsWith('Hi Parag and Circle team,')).toBe(true);
    expect(body).toContain('• The Service Agreement for the one month Voxpop trial engagement');
    expect(body).toContain('• Your email confirmation approving the agreement');
    expect(body).toContain('• Payment of the full invoice amount (₹30,000)');
    expect(body.indexOf('please find attached')).toBeLessThan(body.indexOf('formally begin'));
    expect(body.trimEnd().endsWith('hello@example.test')).toBe(true);
    expect(body).toContain('Shubham Aggarwal\nStudio Example\n+91 90000 00000 | hello@example.test');
  });

  it('leaves out a line whose words are empty', () => {
    const { body } = fillEmail('monthly-invoice', { ...emptyEmailVars(), names: 'Jayanth', period: 'June 2026' });
    expect(body).not.toContain('Status of deliverables');
    expect(body).not.toContain('Kindly process');
    expect(body).toContain('Here is the invoice for June 2026.');
  });

  it('puts the payment day only where it was given', () => {
    expect(fillEmail('payment-nudge', full).body).toContain('due on 1 May 2026');
    expect(fillEmail('payment-nudge', { ...full, dueBy: '' }).body).not.toContain('due on');
  });

  it('falls back to the first note for an unknown or prototype key', () => {
    expect(emailTemplate('constructor').key).toBe('begin');
    expect(emailTemplate('nope').key).toBe('begin');
  });

  it('suggests a note to match the document', () => {
    expect(suggestEmailTemplate('invoice', { retainerMonth: true })).toBe('monthly-invoice');
    expect(suggestEmailTemplate('invoice')).toBe('begin');
    expect(suggestEmailTemplate('contract', { signed: true })).toBe('signed-copy');
  });
});

describe('a saved email note', () => {
  it('keeps the words and their line breaks, and one line of subject', () => {
    expect(parseEmailNote({ subject: 'Invoice\r\nfor May', message: 'Hi Parag,\r\n\r\nThe invoice is attached.\rThanks' })).toEqual({ subject: 'Invoice for May', message: 'Hi Parag,\n\nThe invoice is attached.\nThanks' });
  });
  it('drops control characters but keeps tabs', () => {
    expect(parseEmailNote({ subject: 'A\u0007B', message: 'one\u0000two\tthree\u001b' })).toEqual({ subject: 'A B', message: 'onetwo\tthree' });
  });
  it('holds the words and the subject to their limits', () => {
    const n = parseEmailNote({ subject: 'x'.repeat(EMAIL_SUBJECT_MAX + 50), message: 'y'.repeat(EMAIL_NOTE_MAX + 50) })!;
    expect(n.subject.length).toBe(EMAIL_SUBJECT_MAX);
    expect(n.message.length).toBe(EMAIL_NOTE_MAX);
  });
  it('refuses a note with no words, and anything that is not one', () => {
    expect(parseEmailNote({ subject: 'Hello', message: '   \n ' })).toBeNull();
    expect(parseEmailNote(null)).toBeNull();
    expect(parseEmailNote('Hello')).toBeNull();
    expect(parseEmailNote({ subject: 3, message: 'Hi' })).toEqual({ subject: '', message: 'Hi' });
  });
});

describe('a note written from the records', () => {
  const client = { name: 'Circle', contactName: 'Parag Shah', month: { published: 3, inReview: 1, open: 2 } };
  const profile = { signerName: 'Asha Rao', from: { name: 'Asha Studio', phone: '+91 98000 00000', email: 'asha@example.com' } };
  it('fills every part from the client, the profile and the document, and every note has no blank in it', () => {
    const { vars, missing } = emailVarsFor({ kind: 'invoice', client, profile, number: 'KR-0007', amount: '₹30,000', dueBy: '1 May 2026', period: 'May 2026' });
    expect(missing).toEqual([]);
    expect(vars.names).toBe('Parag and Circle team');
    expect(vars.attached).toEqual(['The invoice KR-0007 for ₹30,000']);
    expect(vars.status).toBe('3 published, 1 waiting for your review, 2 being made');
    for (const t of EMAIL_TEMPLATES) {
      const { subject, body } = fillEmail(t.key, vars);
      expect(`${subject}\n${body}`, t.key).not.toMatch(/__|\{|\}|TBD|undefined/);
      expect(body, t.key).toContain('Asha Rao');
      expect(body.startsWith('Hi Parag and Circle team,'), t.key).toBe(true);
    }
  });
  it('names what is missing once, where it is saved, and still writes no blank', () => {
    const { vars, missing } = emailVarsFor({ kind: 'contract', docKind: 'trial', title: 'Trial engagement agreement', client: { name: 'Circle', contactName: '' }, profile: { ...profile, from: { ...profile.from, phone: '' } } });
    expect(missing.map((m) => [m.key, m.where])).toEqual([['contactName', 'client'], ['phone', 'profile']]);
    expect(vars.engagement).toBe('trial engagement');
    const { body } = fillEmail('begin', vars);
    expect(body.startsWith('Hi Circle team,')).toBe(true);
    expect(body).toContain('• The Trial engagement agreement');
    expect(body).not.toMatch(/__|\|  |\| $/m);
  });
  it('offers the note the moment needs', () => {
    expect(suggestEmailTemplate('invoice', { paid: true })).toBe('payment-thanks');
    expect(suggestEmailTemplate('invoice', { overdue: true })).toBe('payment-nudge');
    expect(suggestEmailTemplate('invoice', { stage: 'delivery' })).toBe('monthly-invoice');
    expect(suggestEmailTemplate('invoice', { stage: 'agreement_sent' })).toBe('begin');
    expect(suggestEmailTemplate('contract', { docKind: 'retainer', stage: 'retainer' })).toBe('renewal');
    expect(suggestEmailTemplate('doc', { docKind: 'trial_terms' })).toBe('before-shoot');
    expect(suggestEmailTemplate('doc', { docKind: 'monthly_report' })).toBe('report');
    expect(suggestEmailTemplate('doc', { docKind: 'brief' })).toBe('plan');
  });
});
