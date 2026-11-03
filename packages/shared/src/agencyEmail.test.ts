import { describe, expect, it } from 'vitest';
import { EMAIL_NOTE_MAX, EMAIL_TEMPLATES, emailTemplate, emptyEmailVars, fillEmail, suggestEmailTemplate, type EmailVars } from './agencyEmail';

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
