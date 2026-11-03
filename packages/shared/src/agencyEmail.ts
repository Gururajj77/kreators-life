// The cover notes an agency sends with its paperwork: the agreement and invoice that start an engagement, the month's invoice, a
// renewal, a nudge about payment. Plain words in the order a client reads them (what is attached, what happens next, what is needed),
// written to be changed before they go. Pure functions, no fetching, so the screen, the server and the test share one version.
// Kept out of the main barrel (its own export, `@kreators/shared/agencyEmail`) because only the Agency screens read it.

/** What a note can say. Every field is the person's to change; an empty one drops its line instead of leaving a gap. */
export interface EmailVars {
  /** Who the note greets: "Parag and Circle team". */
  names: string;
  /** What the work is called: "one month Voxpop trial engagement". */
  engagement: string;
  /** What is attached, one line each: "The Service Agreement for the one month trial", "The invoice for ₹30,000 (full advance)". */
  attached: string[];
  /** An amount already written: "₹55,000". */
  amount: string;
  /** The month or period a note is about: "May 2026", "July to September 2026". */
  period: string;
  /** A day already written: "1 May 2026". */
  dueBy: string;
  /** How the work stands: "shoot completed, editing in progress". */
  status: string;
  /** Anything else, as its own paragraph. */
  note: string;
  signName: string;
  signStudio: string;
  signPhone: string;
  signEmail: string;
}

export const emptyEmailVars = (): EmailVars => ({ names: '', engagement: '', attached: [], amount: '', period: '', dueBy: '', status: '', note: '', signName: '', signStudio: '', signPhone: '', signEmail: '' });

export type EmailTemplateKey = 'begin' | 'monthly-invoice' | 'renewal' | 'signed-copy' | 'plan' | 'before-shoot' | 'payment-nudge' | 'payment-firm' | 'payment-thanks';

export interface EmailTemplate {
  key: EmailTemplateKey;
  name: string;
  /** When to reach for it, in one line. */
  when: string;
  subject: (v: EmailVars) => string;
  body: (v: EmailVars) => string;
}

const present = (s: string) => s.trim().length > 0;
const bullets = (items: string[]) => items.filter(present).map((i) => `• ${i.trim()}`).join('\n');
const hi = (v: EmailVars) => `Hi ${present(v.names) ? v.names.trim() : 'there'},`;
/** Paragraphs joined by a blank line, with any empty one left out. */
const joined = (parts: (string | false | null | undefined)[]) => parts.filter((p): p is string => typeof p === 'string' && present(p)).join('\n\n');

function signoff(v: EmailVars, closing: string): string {
  const contact = [v.signPhone, v.signEmail].filter(present).map((s) => s.trim()).join(' | ');
  return [closing, [v.signName, v.signStudio, contact].filter(present).map((s) => s.trim()).join('\n')].filter(present).join('\n\n');
}

const attachedBlock = (v: EmailVars, lead = 'As discussed, please find attached:') => (v.attached.some(present) ? `${lead}\n\n${bullets(v.attached)}` : '');

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    key: 'begin',
    name: 'Agreement and invoice to start',
    when: 'The first send: the agreement and the invoice, and what has to happen before work begins.',
    subject: (v) => `Agreement and invoice${present(v.engagement) ? `: ${v.engagement.trim()}` : ''}`,
    body: (v) =>
      joined([
        hi(v),
        attachedBlock(v),
        `As agreed, the engagement will formally begin upon receipt of:\n\n${bullets(['Your email confirmation approving the agreement', `Payment of the full invoice amount${present(v.amount) ? ` (${v.amount.trim()})` : ''}`])}`,
        'Kindly note that production will commence upon receipt of payment, and the final edited videos will be released after completion, as per the agreed scope.',
        v.note,
        'Please confirm once processed so we can proceed with scheduling and execution.',
        signoff(v, 'Looking forward to kicking this off.\n\nBest regards,'),
      ]),
  },
  {
    key: 'monthly-invoice',
    name: "This month's invoice",
    when: 'After a month is delivered: the next month’s invoice, the day to pay by and where the work stands.',
    subject: (v) => `Invoice for ${present(v.period) ? v.period.trim() : 'the month'}`,
    body: (v) =>
      joined([
        hi(v),
        `Here is the invoice for ${present(v.period) ? v.period.trim() : 'this month'}${present(v.amount) ? `, ${v.amount.trim()}` : ''}.`,
        present(v.dueBy) ? `Kindly process the payment by ${v.dueBy.trim()}.` : '',
        present(v.status) ? `Status of deliverables: ${v.status.trim()}` : '',
        v.note,
        signoff(v, 'Thanks in advance!\n\nBest regards,'),
      ]),
  },
  {
    key: 'renewal',
    name: 'Renewal',
    when: 'The engagement is renewing: the new agreement and invoice, and anything that changes.',
    subject: (v) => `Renewal${present(v.period) ? `: ${v.period.trim()}` : ''}`,
    body: (v) =>
      joined([
        hi(v),
        `Thank you for renewing the engagement${present(v.period) ? ` for ${v.period.trim()}` : ''}. We are excited to keep building on the work so far.`,
        attachedBlock(v, 'Please find attached:'),
        present(v.note) ? `What changes:\n\n${v.note.trim()}` : 'There is no change to the scope of work or the commercial terms.',
        'Kindly review the agreement and let me know if everything looks in order. Once confirmed, we will go ahead with the production schedule as planned.',
        signoff(v, 'Looking forward to another great stretch together.\n\nWarm regards,'),
      ]),
  },
  {
    key: 'signed-copy',
    name: 'Signed copy',
    when: 'You are sending the signed agreement back.',
    subject: (v) => `Signed agreement${present(v.engagement) ? `: ${v.engagement.trim()}` : ''}`,
    body: (v) =>
      joined([
        hi(v),
        v.attached.some(present) ? `Attached is the signed copy:\n\n${bullets(v.attached)}` : 'Attached is the signed agreement.',
        v.note,
        signoff(v, 'Let me know if anything else is needed.\n\nBest regards,'),
      ]),
  },
  {
    key: 'plan',
    name: 'Content plan',
    when: 'You are sharing the plan for the weeks or months ahead.',
    subject: (v) => `Content plan${present(v.period) ? `: ${v.period.trim()}` : ''}`,
    body: (v) =>
      joined([
        hi(v),
        `I have put together the plan${present(v.period) ? ` for ${v.period.trim()}` : ''} and attached it below.`,
        attachedBlock(v, 'Attached:'),
        v.note,
        'Please have a look and tell me what you would like to change or move. Once we agree, we will schedule the shoots around it.',
        signoff(v, 'Best regards,'),
      ]),
  },
  {
    key: 'before-shoot',
    name: 'Before the next shoot',
    when: 'You want the brief settled before a batch: the goal, the reaction, the product and the must-haves.',
    subject: (v) => `Before the next shoot${present(v.period) ? `: ${v.period.trim()}` : ''}`,
    body: (v) =>
      joined([
        hi(v),
        'To make each batch as strong as it can be, it helps us to agree a few things before the shoot:',
        `→ Primary objective\nWhat are we mainly trying to achieve with this batch?\n\n→ Desired audience response\nWhat reaction are we after: curiosity, humour, debate, surprise or product interest?\n\n→ Brand and product integration\nHow prominently should the product or brand feature?\n\n→ Must-have requirements\nAre there creative, messaging or production elements we need to plan for?`,
        'Once we have that, we will take it from there and make the creative choices on the ground. The clarity simply lets us pick the right approach from the start, rather than reinterpreting the goal after the shoot.',
        v.note,
        signoff(v, 'Best regards,'),
      ]),
  },
  {
    key: 'payment-nudge',
    name: 'Payment reminder, friendly',
    when: 'An invoice is a little late and you want to ask kindly.',
    subject: (v) => `Invoice for ${present(v.period) ? v.period.trim() : 'the month'}: a quick reminder`,
    body: (v) =>
      joined([
        hi(v),
        `I am following up on the invoice for ${present(v.period) ? v.period.trim() : 'this month'}${present(v.amount) ? ` (${v.amount.trim()})` : ''}.`,
        present(v.dueBy) ? `As it was due on ${v.dueBy.trim()}, I would appreciate it if the payment could be cleared at the earliest.` : 'I would appreciate it if the payment could be cleared at the earliest.',
        'If it is already in process, please share the payment details and I will match it on our end. If you need anything from me to help it through, just say so.',
        v.note,
        signoff(v, 'Thank you,'),
      ]),
  },
  {
    key: 'payment-firm',
    name: 'Payment reminder, firm',
    when: 'A second reminder: it keeps happening, and you want to say plainly why it matters.',
    subject: (v) => `Payment still pending${present(v.period) ? `: ${v.period.trim()}` : ''}`,
    body: (v) =>
      joined([
        hi(v),
        `The payment${present(v.amount) ? ` of ${v.amount.trim()}` : ''}${present(v.period) ? ` for ${v.period.trim()}` : ''}${present(v.dueBy) ? `, due on ${v.dueBy.trim()},` : ''} is still pending, and this is the second time we have had to follow up.`,
        'I want to be open about why this matters. Our timelines, our resource planning and the energy we bring to the work all depend on payments arriving when agreed. When one slips without notice, everything after it is affected.',
        'Please have this cleared at the earliest. If there is something holding it up on your side, tell me and we can sort it out directly.',
        v.note,
        signoff(v, 'I value what we are building together, and I hope this feels like a fair ask.\n\nWith best intentions,'),
      ]),
  },
  {
    key: 'payment-thanks',
    name: 'Payment received',
    when: 'The money has arrived.',
    subject: (v) => `Payment received${present(v.period) ? `: ${v.period.trim()}` : ''}`,
    body: (v) =>
      joined([
        hi(v),
        `We have received the payment${present(v.amount) ? ` of ${v.amount.trim()}` : ''}${present(v.period) ? ` for ${v.period.trim()}` : ''}. Thank you for processing it.`,
        v.note,
        signoff(v, 'Looking forward to the next stretch.\n\nBest regards,'),
      ]),
  },
];

const byKey: Record<string, EmailTemplate> = Object.assign(Object.create(null), Object.fromEntries(EMAIL_TEMPLATES.map((t) => [t.key, t])));

export function emailTemplate(key: string): EmailTemplate {
  return byKey[key] ?? EMAIL_TEMPLATES[0]!;
}

/** The subject and the words of a note, ready to read and change. */
export function fillEmail(key: string, vars: EmailVars): { subject: string; body: string } {
  const t = emailTemplate(key);
  return { subject: t.subject(vars).slice(0, 200), body: t.body(vars) };
}

/** The note a document most likely goes with, so the picker opens on a sensible one. */
export function suggestEmailTemplate(kind: 'invoice' | 'contract' | 'doc', ctx: { retainerMonth?: boolean; signed?: boolean } = {}): EmailTemplateKey {
  if (kind === 'invoice') return ctx.retainerMonth ? 'monthly-invoice' : 'begin';
  if (kind === 'contract') return ctx.signed ? 'signed-copy' : 'begin';
  return 'plan';
}

/** The longest note the server will send. */
export const EMAIL_NOTE_MAX = 6000;
