import { describe, expect, it } from 'vitest';
import { EMAIL_NOTE_MAX, EMAIL_SUBJECT_MAX, EMAIL_TEMPLATES, emailTemplate, emptyEmailVars, fillEmail, emailVarsFor, paperGapLine, parseEmailNote, suggestEmailTemplate, withoutPaperLinks, type EmailPaper, type EmailVars } from './agencyEmail';

const AGREEMENT_LINK = 'https://kreators.test/k/AAAAAAAAAAAAAAAA';
const INVOICE_LINK = 'https://kreators.test/i/BBBBBBBBBBBBBBBB';

const full: EmailVars = {
  ...emptyEmailVars(),
  names: 'Asha and Example Foods team',
  engagement: 'trial engagement',
  papers: [{ label: 'The Trial Engagement Agreement', link: AGREEMENT_LINK, kind: 'contract' }],
  pair: [
    { label: 'The Trial Engagement Agreement', link: AGREEMENT_LINK, kind: 'contract' },
    { label: 'The invoice KR-0007 for ₹12,000 (full advance)', link: INVOICE_LINK, kind: 'invoice' },
  ],
  everyPaper: [
    { label: 'The Trial Engagement Agreement (AGR-A1B2C3)', link: AGREEMENT_LINK, kind: 'contract' },
    { label: 'The invoice KR-0007 for ₹12,000 (full advance)', link: INVOICE_LINK, kind: 'invoice' },
  ],
  clientName: 'Example Foods',
  entity: 'Example Foods Private Limited',
  plans: ['₹8,000 for 5 videos', '₹12,000 for 10 videos'],
  planSaving: 'The 10 videos plan costs about 25% less per video than the 5 videos plan, and it gives you more consistency and scale.',
  firstRate: '₹8,000',
  longerTerm: '6 months at ₹12,000 a month',
  longerPieces: '10 videos a month (60 over 6 months)',
  amount: '₹12,000',
  period: 'May 2026',
  dueBy: '1 May 2026',
  status: 'shoot completed, editing in progress',
  note: 'One more thing.',
  signName: 'Sam Lee',
  signStudio: 'Studio Example',
  signPhone: '+91 90000 00000',
  signEmail: 'hello@example.test',
};

/** A client's paper as the route lists it, with its link written. */
function paper(over: Partial<EmailPaper> & Pick<EmailPaper, 'kind' | 'id'>): EmailPaper {
  const invoice = over.kind === 'invoice';
  const path = over.path ?? (invoice ? `/i/${over.id.padEnd(16, 'X')}` : `/k/${over.id.padEnd(16, 'X')}`);
  return { title: invoice ? 'Invoice' : 'TRIAL ENGAGEMENT AGREEMENT', number: invoice ? 'KR-0007' : 'AGR-A1B2C3', status: 'sent', amount: invoice ? '₹12,000' : '', totalCents: invoice ? 12_000_00 : 0, currency: invoice ? 'INR' : '', advance: false, docKind: invoice ? '' : 'trial', revised: false, path, link: path ? `https://kreators.test${path}` : '', ...over };
}

/** Flesch reading ease, the same sums as scripts/flesch.py. */
function flesch(text: string): number {
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((x) => /[A-Za-z]/.test(x));
  const words = text.match(/[A-Za-z][A-Za-z']*/g) ?? [];
  const syl = words.reduce((sum, word) => {
    const w = word.toLowerCase().replace(/^'+|'+$/g, '');
    let n = (w.match(/[aeiouy]+/g) ?? []).length;
    if (w.endsWith('e') && !/(le|ee|ye)$/.test(w) && n > 1) n -= 1;
    return sum + Math.max(1, n);
  }, 0);
  return 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syl / words.length);
}

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
        // The mail carries a link and no file, so no note may say it has one attached.
        expect(`${subject}${body}`, t.key).not.toMatch(/attach/i);
      }
    }
  });

  it('holds no number, price or name of its own: with nothing on record, a note has no digit, no currency and no proper name', () => {
    const allowed = new Set(['I', 'P', 'S', 'Hi', 'Your', 'The', 'As', 'Please', 'Kindly', 'Best', 'Thank', 'If', 'Or', 'That', 'We', 'A', 'Our', 'Open', 'Nothing', 'Thanks', 'Here', 'Once', 'To', 'Have', 'You', 'What', 'Looking', 'With', 'Warm', 'Let', 'Are', 'How', 'When', 'Scripts', 'Without', 'Status', 'Primary', 'Desired', 'Brand', 'Must', 'There', 'It', 'Payment', 'Priority', 'Exclusivity', 'Agreed', 'Lasting', 'Agreement', 'Invoice', 'Renewal', 'Signed', 'Content', 'Monthly', 'Before', 'Updated', 'From', 'They', 'Tell', 'Each', 'Just', 'Sign', 'Start']);
    for (const t of EMAIL_TEMPLATES) {
      const { subject, body } = fillEmail(t.key, emptyEmailVars());
      const words = `${subject}\n${body}`;
      expect(words, t.key).not.toMatch(/\d|₹|\$|€|£/);
      // A capital in the middle of a sentence would be someone's name or brand.
      for (const m of words.matchAll(/(?<=[a-z,] )[A-Z][a-z]+/g)) expect(allowed.has(m[0]), `${t.key}: ${m[0]}`).toBe(true);
    }
  });

  it('follows the shape of the first send: both papers with a link each, then what must happen, then the sign-off', () => {
    const { body } = fillEmail('begin', full);
    expect(body.startsWith('Hi Asha and Example Foods team,')).toBe(true);
    expect(body).toContain(`As discussed, here are the agreement and the invoice. You can open and download each one here:\n\n• The Trial Engagement Agreement\n${AGREEMENT_LINK}\n• The invoice KR-0007 for ₹12,000 (full advance)\n${INVOICE_LINK}`);
    expect(body).toContain('• Your email confirmation approving the agreement');
    expect(body).toContain('• Payment of the full invoice amount (₹12,000)');
    expect(body.indexOf('You can open and download')).toBeLessThan(body.indexOf('formally begin'));
    expect(body.trimEnd().endsWith('hello@example.test')).toBe(true);
    expect(body).toContain('Best regards,\nSam Lee\nStudio Example\n+91 90000 00000 | hello@example.test');
  });

  it('promises no link it does not have', () => {
    const none = { ...full, papers: [{ label: 'The Trial Engagement Agreement', link: '', kind: 'contract' as const }], pair: [] };
    const { body } = fillEmail('begin', none);
    expect(body).toContain('As discussed, here is the agreement:\n\n• The Trial Engagement Agreement');
    expect(body).not.toContain('open and download');
    expect(fillEmail('monthly-invoice', { ...none, papers: [] }).body).not.toContain('open and download');
  });

  it('gives one paper its link in plain words', () => {
    const { body } = fillEmail('monthly-invoice', { ...full, papers: [{ label: 'The invoice KR-0007', link: INVOICE_LINK, kind: 'invoice' }] });
    expect(body).toContain(`You can open and download it here:\n${INVOICE_LINK}`);
    expect(fillEmail('signed-copy', full).body).toContain(`Here is the signed agreement. You can open and download it here:\n\n• The Trial Engagement Agreement\n${AGREEMENT_LINK}`);
  });

  it('says the links ask for a password only when they do, and never holds one', () => {
    expect(fillEmail('begin', { ...full, locked: true }).body).toContain('Each link asks for the password I shared with you.');
    expect(fillEmail('begin', { ...full, locked: true, pair: [full.pair[0]!] }).body).toContain('The link asks for the password I shared with you.');
    expect(fillEmail('begin', full).body).not.toContain('password');
  });

  it('leaves out a line whose words are empty', () => {
    const { body } = fillEmail('monthly-invoice', { ...emptyEmailVars(), names: 'Asha', period: 'June 2026' });
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

describe('the notes from the founder\'s thread', () => {
  it('the pricing P.S. sits before the sign-off and is written only from the records', () => {
    const { body } = fillEmail('begin-pricing', full);
    expect(body.indexOf('Please confirm once processed')).toBeLessThan(body.indexOf('P.S.'));
    expect(body.indexOf('P.S.')).toBeLessThan(body.indexOf('Best regards,'));
    expect(body).toContain('• ₹8,000 for 5 videos\n• ₹12,000 for 10 videos');
    expect(body).toContain('one-time rate of ₹8,000');
    expect(body).toContain('content engine for Example Foods');
    expect(body).toContain('Looking forward to taking Example Foods to the next level.');
  });
  it('leaves the P.S. out with no plans, and each of its lines with nothing to say', () => {
    const none = fillEmail('begin-pricing', { ...full, plans: [], planSaving: '', firstRate: '' }).body;
    expect(none).not.toContain('P.S.');
    expect(none).not.toContain('--------');
    const bare = fillEmail('begin-pricing', { ...full, planSaving: '', firstRate: '', clientName: '' }).body;
    expect(bare).toContain('P.S.');
    expect(bare).not.toContain('one-time rate');
    expect(bare).not.toContain('less per');
    expect(bare).toContain('content engine for you');
  });
  it('the clause reply fills from the records, and asks for nothing it cannot fill', () => {
    const { subject, body } = fillEmail('clause-reply', full);
    expect(subject).toBe('The proposed clauses: trial engagement');
    expect(body).toContain('If this stays the trial engagement at ₹12,000,');
    expect(body).toContain('a longer exclusive engagement: 6 months at ₹12,000 a month.');
    expect(body).toContain('• 10 videos a month (60 over 6 months)');
    expect(body).toContain(`You can open and download the agreement as it stands here:\n${AGREEMENT_LINK}`);
    const bare = fillEmail('clause-reply', { ...emptyEmailVars(), names: 'Asha' }).body;
    expect(bare).toContain('If this stays a short engagement,');
    expect(bare).toContain('Tell me the length you have in mind');
    expect(bare).not.toMatch(/• \n|: \.| at ,/);
  });
  it('the revised paper lists every paper with its link and names the new company when it is on record', () => {
    const { subject, body } = fillEmail('revised-paper', full);
    expect(subject).toBe('Updated agreements and invoices: Example Foods Private Limited');
    expect(body).toContain('updated the paperwork to show Example Foods Private Limited. You can open and download each one here:');
    expect(body).toContain(`• The Trial Engagement Agreement (AGR-A1B2C3)\n${AGREEMENT_LINK}`);
    expect(body).toContain(`• The invoice KR-0007 for ₹12,000 (full advance)\n${INVOICE_LINK}`);
    expect(fillEmail('revised-paper', { ...full, entity: '' }).body).toContain('with your new details');
    expect(fillEmail('revised-paper', { ...full, morePapers: 3 }).body).toContain('I can send the older ones too');
  });
  it('reads plainly: Flesch 60 or above on the new wording', () => {
    const plain = (s: string) => s.replace(/https?:\/\/\S+/g, '').replace(/[-]{3,}/g, '');
    const bare = { ...full, note: '', signName: '', signStudio: '', signPhone: '', signEmail: '', papers: [], pair: [], everyPaper: [] };
    for (const key of ['clause-reply', 'revised-paper']) expect(flesch(plain(fillEmail(key, bare).body)), key).toBeGreaterThanOrEqual(60);
    const ps = fillEmail('begin-pricing', bare).body;
    expect(flesch(plain(ps.slice(ps.indexOf('P.S.'))))).toBeGreaterThanOrEqual(60);
  });
  it('keeps a saved note free of this client\'s links', () => {
    const kept = withoutPaperLinks(fillEmail('begin', { ...full, locked: true }).body);
    expect(kept).not.toMatch(/https?:|open and download|password/);
    expect(kept).toContain('As discussed, here are the agreement and the invoice.\n\n• The Trial Engagement Agreement\n• The invoice');
    expect(kept).not.toContain('KR-0007');
    expect(kept).not.toMatch(/\n{3,}/);
    const one = withoutPaperLinks(fillEmail('monthly-invoice', { ...full, papers: [{ label: 'The invoice', link: INVOICE_LINK, kind: 'invoice' }] }).body);
    expect(one).not.toMatch(/https?:|open and download/);
    expect(withoutPaperLinks('See https://example.test/k/SHORT in the text.')).toContain('https://example.test/k/SHORT');
  });
  it('takes an invoice\'s number and amount and a link inside a sentence out of a kept note too', () => {
    expect(withoutPaperLinks('• The invoice KR-0007 for ₹5,00,000.00 (full advance)')).toBe('• The invoice');
    expect(withoutPaperLinks('Please sign https://kreators.app/k/AAAABBBBCCCC1111 today.')).toBe('Please sign today.');
    expect(withoutPaperLinks('• The Trial Agreement (AG-0012)')).toBe('• The Trial Agreement');
    expect(withoutPaperLinks('Here is the invoice for May, ₹20,000.\nPayment of the full amount (₹20,000) is due.', ['₹20,000'])).toBe('Here is the invoice for May.\nPayment of the full amount is due.');
    expect(withoutPaperLinks('A price of ₹20,000.')).toContain('₹20,000');
  });
  it('never calls one month a longer deal, and says month in the singular nowhere', () => {
    const v = emailVarsFor({ kind: 'contract', client: null, profile: null, title: '', longer: { months: 1, monthly: '₹20,000', pieces: 10 } }).vars;
    expect(v.longerTerm).toBe('₹20,000 a month');
    expect(v.longerPieces).toBe('10 videos a month');
    const six = emailVarsFor({ kind: 'contract', client: null, profile: null, title: '', longer: { months: 6, monthly: '₹20,000', pieces: 10 } }).vars;
    expect(six.longerTerm).toBe('6 months at ₹20,000 a month');
    expect(six.longerPieces).toBe('10 videos a month (60 over 6 months)');
  });
});

describe('a saved email note', () => {
  it('keeps the words and their line breaks, and one line of subject', () => {
    expect(parseEmailNote({ subject: 'Invoice\r\nfor May', message: 'Hi Asha,\r\n\r\nHere is the invoice.\rThanks' })).toEqual({ subject: 'Invoice for May', message: 'Hi Asha,\n\nHere is the invoice.\nThanks' });
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
  const client = { name: 'Example Foods', contactName: 'Asha Rao', month: { published: 3, inReview: 1, open: 2 } };
  const profile = { signerName: 'Sam Lee', from: { name: 'Sam Studio', phone: '+91 98000 00000', email: 'sam@example.test' } };
  it('fills every part from the client, the profile and the document, and every note has no blank in it', () => {
    const { vars, missing } = emailVarsFor({ kind: 'invoice', client, profile, number: 'KR-0007', amount: '₹30,000', dueBy: '1 May 2026', period: 'May 2026' });
    expect(missing).toEqual([]);
    expect(vars.names).toBe('Asha and Example Foods team');
    expect(vars.papers).toEqual([{ label: 'The invoice KR-0007 for ₹30,000', link: '', kind: 'invoice' }]);
    expect(vars.status).toBe('3 published, 1 waiting for your review, 2 being made');
    for (const t of EMAIL_TEMPLATES) {
      const { subject, body } = fillEmail(t.key, vars);
      expect(`${subject}\n${body}`, t.key).not.toMatch(/__|\{|\}|TBD|undefined/);
      expect(body, t.key).toContain('Sam Lee');
      expect(body.startsWith('Hi Asha and Example Foods team,'), t.key).toBe(true);
    }
  });
  it('names what is missing once, where it is saved, and still writes no blank', () => {
    const { vars, missing } = emailVarsFor({ kind: 'contract', docKind: 'trial', title: 'Trial engagement agreement', client: { name: 'Example Foods', contactName: '' }, profile: { ...profile, from: { ...profile.from, phone: '' } } });
    expect(missing.map((m) => [m.key, m.where])).toEqual([['contactName', 'client'], ['phone', 'profile']]);
    expect(vars.engagement).toBe('trial engagement');
    const { body } = fillEmail('begin', vars);
    expect(body.startsWith('Hi Example Foods team,')).toBe(true);
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
    expect(suggestEmailTemplate('contract', { revised: true })).toBe('revised-paper');
    expect(suggestEmailTemplate('invoice', { revised: true })).toBe('revised-paper');
    expect(suggestEmailTemplate('invoice', { revised: true, paid: true })).toBe('payment-thanks');
    expect(suggestEmailTemplate('contract', { revised: true, signed: true })).toBe('signed-copy');
    expect(suggestEmailTemplate('contract', { priceRose: true })).toBe('begin-pricing');
    expect(suggestEmailTemplate('invoice', { priceRose: true })).toBe('begin-pricing');
    expect(suggestEmailTemplate('invoice', { priceRose: true, stage: 'delivery' })).toBe('monthly-invoice');
  });

  const facts = { client, profile };
  it('names both papers of a first send, each with its own link, from whichever one it was opened', () => {
    const k = paper({ kind: 'contract', id: 'k1' });
    const i = paper({ kind: 'invoice', id: 'i1', advance: true });
    for (const opened of [{ kind: 'contract' as const, paperId: 'k1', title: k.title }, { kind: 'invoice' as const, paperId: 'i1', number: i.number, amount: i.amount }]) {
      const { vars, gaps } = emailVarsFor({ ...facts, ...opened, papers: [k, i] });
      expect(gaps).toEqual([]);
      expect(vars.follows).toEqual([]);
      expect(vars.pair).toEqual([
        { label: 'The Trial Engagement Agreement', link: k.link, kind: 'contract' },
        { label: 'The invoice KR-0007 for ₹12,000 (full advance)', link: i.link, kind: 'invoice' },
      ]);
      expect(vars.amount).toBe('₹12,000');
      expect(vars.engagement).toBe('trial engagement');
      const { body } = fillEmail('begin', vars);
      expect(body).toContain(k.link);
      expect(body).toContain(i.link);
      expect(body).not.toContain('will follow');
    }
  });
  it('says plainly when one is missing: in the note, and in a line for the owner', () => {
    const k = paper({ kind: 'contract', id: 'k1' });
    const noInvoice = emailVarsFor({ ...facts, kind: 'contract', paperId: 'k1', title: k.title, papers: [k] });
    expect(noInvoice.gaps).toEqual([{ word: 'invoice', state: 'none' }]);
    expect(paperGapLine(noInvoice.gaps[0]!, 'Example Foods')).toBe('Example Foods has no invoice yet. The note says it will follow.');
    const body = fillEmail('begin', noInvoice.vars).body;
    expect(body).toContain('As discussed, here is the agreement. You can open and download it here:');
    expect(body).toContain('The invoice will follow in a separate email.');

    const draft = paper({ kind: 'invoice', id: 'i1', status: 'draft', path: '', link: '' });
    const drafted = emailVarsFor({ ...facts, kind: 'contract', paperId: 'k1', title: k.title, papers: [k, draft] });
    expect(drafted.gaps).toEqual([{ word: 'invoice', state: 'draft', id: 'i1', number: 'KR-0007' }]);
    expect(paperGapLine(drafted.gaps[0]!, 'Example Foods')).toBe('The invoice KR-0007 is still a draft, so it has no link yet. The note says it will follow.');
    expect(fillEmail('begin', drafted.vars).body).not.toContain('KR-0007');

    const i = paper({ kind: 'invoice', id: 'i1' });
    const noAgreement = emailVarsFor({ ...facts, kind: 'invoice', paperId: 'i1', number: i.number, amount: i.amount, papers: [i] });
    expect(noAgreement.gaps).toEqual([{ word: 'agreement', state: 'none' }]);
    expect(fillEmail('begin', noAgreement.vars).body).toContain('The agreement will follow in a separate email.');
    expect(paperGapLine({ word: 'agreement', state: 'none' }, '')).toBe('This client has no agreement yet. The note says it will follow.');
  });
  it('still names the paper it was opened from while that one is a draft', () => {
    const k = paper({ kind: 'contract', id: 'k1', status: 'draft', path: '', link: '' });
    const i = paper({ kind: 'invoice', id: 'i1' });
    const { vars, gaps } = emailVarsFor({ ...facts, kind: 'contract', paperId: 'k1', title: k.title, papers: [k, i] });
    expect(gaps).toEqual([]);
    expect(vars.pair.map((l) => l.link)).toEqual(['', i.link]);
    expect(fillEmail('begin', vars).body).not.toContain('open and download');
  });
  it('picks what is out with the client over a draft or a paid one, and never a void', () => {
    const i = (id: string, status: string) => paper({ kind: 'invoice', id, status, number: id, path: status === 'draft' ? '' : `/i/${id.padEnd(16, 'X')}` });
    const k = paper({ kind: 'contract', id: 'k1' });
    const pick = (papers: EmailPaper[]) => emailVarsFor({ ...facts, kind: 'contract', paperId: 'k1', title: k.title, papers }).vars.pair[1]?.label;
    expect(pick([k, i('NEW', 'draft'), i('OUT', 'sent'), i('OLD', 'paid')])).toContain('OUT');
    expect(pick([k, i('OLD', 'paid')])).toContain('OLD');
    expect(pick([k, i('GONE', 'void')])).toBeUndefined();
  });
  it('without the papers (a team member) names only the paper it was opened from, and no gaps', () => {
    const { vars, gaps } = emailVarsFor({ ...facts, kind: 'invoice', number: 'KR-0007', amount: '₹12,000' });
    expect(gaps).toEqual([]);
    const { body } = fillEmail('begin', vars);
    expect(body).toContain('• The invoice KR-0007 for ₹12,000');
    expect(body).not.toContain('will follow');
    expect(body).not.toContain('open and download');
  });
  it('works out the P.S. from the plans and the first invoice, in whole numbers', () => {
    const plans = [{ units: 10, feeCents: 12_000_00, price: '₹12,000' }, { units: 5, feeCents: 8_000_00, price: '₹8,000' }];
    const k = paper({ kind: 'contract', id: 'k1' });
    const now = paper({ kind: 'invoice', id: 'i2', totalCents: 12_000_00, amount: '₹12,000' });
    const before = paper({ kind: 'invoice', id: 'i1', status: 'paid', totalCents: 8_000_00, amount: '₹8,000' });
    const r = emailVarsFor({ ...facts, kind: 'contract', paperId: 'k1', title: k.title, papers: [k, now, before], plans, unit: 'Videos' });
    expect(r.vars.plans).toEqual(['₹8,000 for 5 videos', '₹12,000 for 10 videos']);
    expect(r.vars.planSaving).toBe('The 10 videos plan costs about 25% less per video than the 5 videos plan, and it gives you more consistency and scale.');
    expect(r.vars.firstRate).toBe('₹8,000');
    expect(r.priceRose).toBe(true);
    expect(emailVarsFor({ ...facts, kind: 'contract', paperId: 'k1', title: k.title, papers: [k, now, before] }).priceRose).toBe(false);
    expect(emailVarsFor({ ...facts, kind: 'contract', paperId: 'k1', title: k.title, papers: [k, now], plans }).vars.firstRate).toBe('');
    expect(emailVarsFor({ ...facts, kind: 'contract', plans: [plans[1]!] }).vars.planSaving).toBe('');
    // A larger plan that costs more per unit says nothing about saving.
    expect(emailVarsFor({ ...facts, kind: 'contract', plans: [{ units: 5, feeCents: 5_000_00, price: 'x' }, { units: 10, feeCents: 20_000_00, price: 'y' }] }).vars.planSaving).toBe('');
  });
  it('fills a longer deal from a retainer on record, and the format from the profile', () => {
    const { vars } = emailVarsFor({ ...facts, kind: 'contract', docKind: 'trial', profile: { ...profile, formatName: 'StreetTalk' }, longer: { months: 6, monthly: '₹12,000', pieces: 10 }, unit: 'Videos' });
    expect(vars.longerTerm).toBe('6 months at ₹12,000 a month');
    expect(vars.longerPieces).toBe('10 videos a month (60 over 6 months)');
    expect(vars.engagement).toBe('StreetTalk trial engagement');
    expect(emailVarsFor({ ...facts, kind: 'contract', longer: { months: null, monthly: '₹12,000', pieces: 0 } }).vars.longerTerm).toBe('₹12,000 a month');
  });
  it('writes a title typed in capitals as a name, and lists every paper for the revised note', () => {
    const k = paper({ kind: 'contract', id: 'k1', title: 'TRIAL AND PILOT AGREEMENT' });
    const draft = paper({ kind: 'invoice', id: 'i0', status: 'draft', path: '', link: '' });
    const i = paper({ kind: 'invoice', id: 'i1' });
    const { vars } = emailVarsFor({ ...facts, kind: 'contract', paperId: 'k1', title: k.title, papers: [k, draft, i] });
    expect(vars.papers[0]!.label).toBe('The Trial and Pilot Agreement');
    expect(vars.everyPaper.map((l) => l.label)).toEqual(['The Trial and Pilot Agreement (AGR-A1B2C3)', 'The invoice KR-0007 for ₹12,000']);
    const many = Array.from({ length: 30 }, (_, n) => paper({ kind: 'invoice', id: `i${n}` }));
    const r = emailVarsFor({ ...facts, kind: 'contract', papers: many }).vars;
    expect(r.everyPaper).toHaveLength(24);
    expect(r.morePapers).toBe(6);
    expect(fillEmail('revised-paper', r).body.length).toBeLessThan(EMAIL_NOTE_MAX);
  });
});
