import { describe, expect, it } from 'vitest';
import {
  CONTRACT_TEMPLATE_BY_KEY,
  ONBOARDING_STEPS,
  PASSWORD_REQUEST_REASON_MAX,
  onboardingBriefSteps,
  RETENTION_DAYS,
  emptyOnboarding,
  gstinProblem,
  onboardingProblem,
  onboardingToBilling,
  panProblem,
  parseOnboarding,
  type ClientOnboarding,
  type ContractQuestion,
} from './index';
import { emptyEmailVars, fillEmail } from './agencyEmail';

const questions: ContractQuestion[] = (CONTRACT_TEMPLATE_BY_KEY.trial?.doc.sections ?? []).flatMap((s) => s.questions ?? []);

const filled = (): ClientOnboarding => ({
  ...emptyOnboarding(),
  legalName: 'Example Foods Private Limited',
  brands: 'Example Bites',
  addressLine: '12 Main Road, Indiranagar',
  city: 'Bengaluru',
  state: 'Karnataka',
  pin: '560038',
  gstin: '29ABCDE1234F1Z5',
  pan: 'ABCDE1234F',
  pocName: 'Asha Rao',
  designation: 'Marketing head',
  email: 'asha@example.test',
  phone: '98765 43210',
  billingEmail: '',
  brief: Object.fromEntries(
    questions.map((q) => [
      q.id,
      {
        picked: q.options.length ? [q.options[0]!] : [],
        other: '',
        text: q.text ? 'Some words' : '',
        ...((q.fields ?? []).length ? { fields: { [q.fields![0]!]: 'Warm, bold, honest' } } : {}),
        ...(q.links ? { links: ['https://example.test/a', 'https://example.test/b', 'https://example.test/c'] } : {}),
      },
    ]),
  ),
  references: ['https://example.test/1', 'https://example.test/2', 'https://example.test/3'],
});

describe('GSTIN and PAN', () => {
  it('takes a real GSTIN in any case and with spaces, and an empty one', () => {
    expect(gstinProblem('29ABCDE1234F1Z5')).toBeNull();
    expect(gstinProblem('29abcde1234f1z5')).toBeNull();
    expect(gstinProblem(' 29 ABCDE 1234F 1Z5 ')).toBeNull();
    expect(gstinProblem('')).toBeNull();
  });
  it('refuses a GSTIN of the wrong shape', () => {
    for (const bad of ['29ABCDE1234F1Z', '29ABCDE1234F0Z5', '2XABCDE1234F1Z5', '29ABCDE1234F1Y5', '29ABCDE1234F1Z5X']) expect(gstinProblem(bad)).toMatch(/15 characters/);
  });
  it('takes a real PAN and refuses a wrong one', () => {
    expect(panProblem('ABCDE1234F')).toBeNull();
    expect(panProblem('abcde1234f')).toBeNull();
    expect(panProblem('')).toBeNull();
    for (const bad of ['ABCD1234F', 'ABCDE12345', '1BCDE1234F', 'ABCDE1234FF']) expect(panProblem(bad)).toMatch(/10 characters/);
  });
});

describe('parseOnboarding', () => {
  it('drops unknown keys and keeps the known ones', () => {
    const o = parseOnboarding({ legalName: 'Acme', hacker: 'x', __proto__: { y: 1 }, constructor: 'z' }) as unknown as Record<string, unknown>;
    expect(o.legalName).toBe('Acme');
    expect('hacker' in o).toBe(false);
    expect(Object.keys(o).sort()).toEqual(Object.keys(emptyOnboarding()).sort());
  });
  it('caps lengths, tidies the tax numbers and the PIN, and keeps only web links', () => {
    const o = parseOnboarding({ legalName: 'a'.repeat(500), gstin: '29 abcde 1234 f1z5', pan: 'abcde1234f', pin: '56-00 38', references: ['https://a.test', 'javascript:alert(1)', 'ftp://x', 'http://b.test', 'https://c.test', 'https://d.test', 'https://e.test', 'https://f.test'] });
    expect(o.legalName.length).toBe(160);
    expect(o.gstin).toBe('29ABCDE1234F1Z5');
    expect(o.pan).toBe('ABCDE1234F');
    expect(o.pin).toBe('560038');
    expect(o.references).toEqual(['https://a.test', 'http://b.test', 'https://c.test', 'https://d.test', 'https://e.test']);
  });
  it('keeps only answers to the agreement\'s own questions, and only options it offered', () => {
    const q = questions.find((x) => !x.text && !x.multi)!;
    const o = parseOnboarding({ brief: { [q.id]: { picked: [q.options[0], 'Made up', q.options[1]], other: 'x'.repeat(400), text: 'no' }, madeUp: { picked: ['a'] } } }, questions);
    expect(Object.keys(o.brief)).toEqual([q.id]);
    expect(o.brief[q.id]!.picked).toEqual([q.options[0]]);
    expect(o.brief[q.id]!.other.length).toBe(200);
    expect(o.brief[q.id]!.text).toBe('');
  });
  it('reads junk as an empty form', () => {
    expect(parseOnboarding(null)).toEqual(emptyOnboarding());
    expect(parseOnboarding('x')).toEqual(emptyOnboarding());
  });
});

describe('onboardingProblem', () => {
  it('passes a filled form', () => {
    expect(onboardingProblem(filled(), questions)).toBeNull();
  });
  it('names the first missing required field and its step', () => {
    expect(onboardingProblem(emptyOnboarding(), questions)).toMatchObject({ step: 0, field: 'legalName' });
    expect(onboardingProblem({ ...filled(), pin: '0123' }, questions)).toMatchObject({ step: 0, field: 'pin' });
    expect(onboardingProblem({ ...filled(), gstin: 'BAD' }, questions)).toMatchObject({ step: 0, field: 'gstin' });
    expect(onboardingProblem({ ...filled(), designation: '' }, questions)).toMatchObject({ step: 1, field: 'designation' });
    expect(onboardingProblem({ ...filled(), phone: '12' }, questions)).toMatchObject({ step: 1, field: 'phone' });
    expect(onboardingProblem({ ...filled(), billingEmail: 'nope' }, questions)).toMatchObject({ step: 1, field: 'billingEmail' });
    // A template with no links question of its own still asks for three reference links, on the last step.
    const noLinks = questions.filter((q) => !q.links);
    expect(onboardingProblem({ ...filled(), references: ['https://a.test'] }, noLinks)).toMatchObject({ step: ONBOARDING_STEPS.length - 1, field: 'references' });
  });
  it('asks for every brief question, on the step that holds it', () => {
    const q = questions[0]!;
    const f = filled();
    delete f.brief[q.id];
    const p = onboardingProblem(f, questions);
    expect(p?.field).toBe(`q-${q.id}`);
    expect(p?.step).toBeGreaterThanOrEqual(2);
  });
  it('puts 3.1 to 3.3 on the third step, 3.4 on the fourth and the brand guide with its parts on the fifth', () => {
    const steps = onboardingBriefSteps(questions);
    expect(steps.flat().length).toBe(questions.length);
    expect(steps[0]).toEqual([]);
    expect(steps[1]).toEqual([]);
    const num = (q: ContractQuestion) => /(\d+\.\d+)/.exec(q.heading ?? q.label)?.[1] ?? '';
    for (const q of steps[2]!) if (num(q)) expect(['3.1', '3.2', '3.3']).toContain(num(q));
    for (const q of steps[3]!) if (num(q)) expect(num(q)).toBe('3.4');
    expect(steps[4]!.length).toBeGreaterThan(0);
  });
  it('keeps brand guide lines and links only where the question asks for them', () => {
    const withFields = questions.find((q) => (q.fields ?? []).length);
    const withLinks = questions.find((q) => q.links);
    if (withFields) {
      const o = parseOnboarding({ brief: { [withFields.id]: { fields: { [withFields.fields![0]!]: 'Bold', 'Not a line': 'x' } } } }, questions);
      expect(o.brief[withFields.id]!.fields).toEqual({ [withFields.fields![0]!]: 'Bold' });
    }
    if (withLinks) {
      const o = parseOnboarding({ brief: { [withLinks.id]: { links: ['https://a.test', 'javascript:x', 'https://b.test'] } } }, questions);
      expect(o.brief[withLinks.id]!.links).toEqual(['https://a.test', 'https://b.test']);
      const f = filled();
      f.brief[withLinks.id] = { picked: [], other: '', text: '', links: ['https://a.test'] };
      expect(onboardingProblem(f, questions)?.field).toBe(`q-${withLinks.id}`);
    }
  });
  it('lets the GSTIN, the PAN and the billing email stay empty', () => {
    expect(onboardingProblem({ ...filled(), gstin: '', pan: '', billingEmail: '' }, questions)).toBeNull();
  });
});

describe('onboardingToBilling', () => {
  it('puts the brand on top, the legal name under it, the tax numbers and the whole address', () => {
    const b = onboardingToBilling(filled(), 'Example Bites');
    expect(b.name).toBe('Example Bites');
    expect(b.line).toBe('Example Foods Private Limited');
    expect(b.taxIds).toEqual([{ label: 'GSTIN', value: '29ABCDE1234F1Z5' }, { label: 'PAN', value: 'ABCDE1234F' }]);
    expect(b.address).toBe('12 Main Road, Indiranagar, Bengaluru, Karnataka 560038');
    expect(b.email).toBe('asha@example.test');
    expect(b.phone).toBe('+919876543210');
  });
  it('uses the billing email when there is one, and leaves out tax numbers that were not typed', () => {
    const b = onboardingToBilling({ ...filled(), billingEmail: 'accounts@example.test', gstin: '', pan: '' }, '');
    expect(b.email).toBe('accounts@example.test');
    expect(b.taxIds).toEqual([]);
    expect(b.name).toBe('Example Bites');
  });
});

describe('the steps, the password request and the notes', () => {
  it('has five steps, each with a title and a short line', () => {
    expect(ONBOARDING_STEPS).toHaveLength(5);
    for (const s of ONBOARDING_STEPS) {
      expect(s.title.split(' ').length).toBeLessThanOrEqual(5);
      expect(s.line.split(' ').length).toBeLessThanOrEqual(15);
    }
  });
  it('keeps a short reason and a closed ask for ninety days', () => {
    expect(PASSWORD_REQUEST_REASON_MAX).toBe(200);
    expect(RETENTION_DAYS.passwordRequests).toBe(90);
  });
  it('fills the invite and the owner note with no token, and the invite never holds a password', () => {
    for (const key of ['portal-invite', 'onboarding-done']) {
      for (const vars of [emptyEmailVars(), { ...emptyEmailVars(), names: 'Asha and Example team', signStudio: 'Studio Example', signName: 'Sam', link: 'https://kreators.app/a/ABCDEFGHJKLMNPQR' }]) {
        const { subject, body } = fillEmail(key, vars);
        expect(`${subject}\n${body}`).not.toMatch(/\{\{|\}\}|undefined|null/);
        expect(subject.length).toBeGreaterThan(3);
      }
    }
    const invite = fillEmail('portal-invite', { ...emptyEmailVars(), signStudio: 'Studio Example', link: 'https://kreators.app/a/ABCDEFGHJKLMNPQR' });
    expect(invite.subject).toBe('Your page with Studio Example');
    expect(invite.body).toContain('https://kreators.app/a/ABCDEFGHJKLMNPQR');
    expect(invite.body).toContain('Your password comes in a separate message.');
    expect(invite.body.toLowerCase()).not.toMatch(/password:\s*\S/);
  });
});
