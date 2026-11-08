// The cover notes an agency sends with its paperwork: the agreement and invoice that start an engagement, the month's invoice, a
// renewal, a nudge about payment. Plain words in the order a client reads them (what they can open, what happens next, what is needed),
// written to be changed before they go. A Worker makes no PDF, so the mail carries no file and a note never says "attached": it names
// each paper with its own link, where the client opens and downloads it. Pure functions, no fetching, so the screen, the server and the
// test share one version. Kept out of the main barrel (its own export, `@kreators/shared/agencyEmail`) because only the Agency screens
// read it. Nothing here holds a real person, brand, number or price: those live only in the owner's profile and the client's record.

export type EmailPaperKind = 'contract' | 'invoice' | 'doc';

/** One paper of a client, as `GET /agency/clients/:id/papers` lists it, newest first. Owner only: a team member is never given a client's link. */
export interface EmailPaper {
  kind: EmailPaperKind;
  id: string;
  /** As printed. */
  title: string;
  /** The invoice number, or the paper's reference. */
  number: string;
  status: string;
  /** An invoice's total, already written, in whole cents and its currency: the note says it and the pricing P.S. compares it. */
  amount: string;
  totalCents: number;
  currency: string;
  /** An invoice that is only an advance. */
  advance: boolean;
  /** The agreement's template or the document's kind. */
  docKind: string;
  /** Changed after it was emailed. */
  revised: boolean;
  /** Where the client opens it, "/k/<token>"; empty while it has no link (a draft). */
  path: string;
  /** The whole link, which the screen writes from the site's address. */
  link?: string;
}

/** What `GET /agency/clients/:id/papers` answers. `base` is the site's address when the server has one set. */
export interface ClientPapers {
  papers: EmailPaper[];
  base: string;
}

/** One paper as a note names it: its name and the link under it. */
export interface EmailLine {
  label: string;
  link: string;
  kind?: EmailPaperKind;
}

/** What a note can say. Every field is the person's to change; an empty one drops its line instead of leaving a gap. */
export interface EmailVars {
  /** Who the note greets: "Asha and Example Foods team". */
  names: string;
  /** What the work is called: "trial engagement". */
  engagement: string;
  /** The paper the note was opened from, with its link. */
  papers: EmailLine[];
  /** The first send's two papers, the agreement and then the invoice, each with its own link. Empty when the records were not read. */
  pair: EmailLine[];
  /** Which of those two has no link to give yet, so the note says it will follow. */
  follows: PaperWord[];
  /** Every agreement and invoice that has a link: the note after a change of company name lists them all. */
  everyPaper: EmailLine[];
  /** How many more than the note lists. */
  morePapers: number;
  /** Whether the client's links ask for a password. The note says so; it never holds the password. */
  locked: boolean;
  /** The client as a brand. */
  clientName: string;
  /** The client's legal name on their billing details. */
  entity: string;
  /** The owner's standard plans, one line each: "₹10,000 for 5 videos". Empty leaves the pricing P.S. out. */
  plans: string[];
  /** How the largest plan compares with the smallest, worked out from them. */
  planSaving: string;
  /** What the client's earlier, lower invoice came to, when there is one. */
  firstRate: string;
  /** A longer deal from the records: "6 months at ₹20,000 a month". */
  longerTerm: string;
  /** What that deal delivers: "10 videos a month (60 over 6 months)". */
  longerPieces: string;
  /** An amount already written: "₹20,000". */
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
  /** A link the note is about (a client's page), when it has one. */
  link?: string;
}

export const emptyEmailVars = (): EmailVars => ({ names: '', engagement: '', papers: [], pair: [], follows: [], everyPaper: [], morePapers: 0, locked: false, clientName: '', entity: '', plans: [], planSaving: '', firstRate: '', longerTerm: '', longerPieces: '', amount: '', period: '', dueBy: '', status: '', note: '', signName: '', signStudio: '', signPhone: '', signEmail: '' });

export type EmailTemplateKey = 'portal-invite' | 'onboarding-done' | 'begin' | 'begin-pricing' | 'monthly-invoice' | 'renewal' | 'revised-paper' | 'clause-reply' | 'signed-copy' | 'plan' | 'report' | 'before-shoot' | 'payment-nudge' | 'payment-firm' | 'payment-thanks';

export interface EmailTemplate {
  key: EmailTemplateKey;
  name: string;
  /** When to reach for it, in one line. */
  when: string;
  /** A note that names the agreement and the invoice together, so the sheet says plainly when one has no link. */
  namesPair?: boolean;
  /** A note that lays out the owner's plans, so the sheet says plainly when none are set. */
  namesPlans?: boolean;
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
  return [closing, [v.signName, v.signStudio, contact].filter(present).map((s) => s.trim()).join('\n')].filter(present).join('\n');
}

const named = (lines: EmailLine[]) => lines.filter((l) => present(l.label));
// The link starts its own line with no indent: a phone's narrow column would otherwise break after the spaces and leave a blank line.
const lineText = (l: EmailLine) => `• ${l.label.trim()}${present(l.link) ? `\n${l.link.trim()}` : ''}`;

/**
 * Names papers with what the mail really carries: each with its own link, where it can be opened and downloaded. A paper with no link
 * yet is only named, and the words promise no link (the server adds the paper's own link under a note that holds none).
 */
function papersBlock(lines: EmailLine[], opening: string): string {
  const list = named(lines);
  if (list.length === 0) return '';
  const linked = list.every((l) => present(l.link));
  const how = !linked ? ':' : list.length === 1 ? '. You can open and download it here:' : '. You can open and download each one here:';
  return `${opening}${how}\n\n${list.map(lineText).join('\n')}`;
}
const papersOr = (lines: EmailLine[], opening: string) => papersBlock(lines, opening) || `${opening}.`;

/** The first paper's link on its own lines, for a note whose sentence already says what the paper is. */
function linkLine(v: EmailVars, what?: string): string {
  const line = named(v.papers)[0];
  if (!line || !present(line.link)) return '';
  return `You can open and download ${what ?? 'it'} here:\n${line.link.trim()}`;
}

const pairOf = (v: EmailVars) => (named(v.pair).length > 0 ? v.pair : v.papers);
const everyOf = (v: EmailVars) => (named(v.everyPaper).length > 0 ? v.everyPaper : v.papers);

/** What the lines are, in words: "here are the agreement and the invoice". */
function pairPhrase(lines: EmailLine[], updated = false): string {
  const list = named(lines);
  const contract = list.some((l) => l.kind === 'contract');
  const invoice = list.some((l) => l.kind === 'invoice');
  const agreement = updated ? 'the updated agreement' : 'the agreement';
  if (contract && invoice) return `here are ${agreement} and the invoice`;
  if (contract) return `here is ${agreement}`;
  if (invoice) return 'here is the invoice';
  return 'here is what I am sending';
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One short line, only when the links do ask: the client has the password already, and a note never holds it. */
function passwordLine(v: EmailVars, lines: EmailLine[]): string {
  const linked = named(lines).filter((l) => present(l.link));
  if (!v.locked || linked.length === 0) return '';
  return linked.length === 1 ? 'The link asks for the password I shared with you.' : 'Each link asks for the password I shared with you.';
}

/** Says plainly what is still to come, so a note with one paper never reads as if it were all of it. */
function followLine(v: EmailVars): string {
  if (named(v.pair).length === 0 || v.follows.length === 0) return '';
  const words = v.follows.map((k) => `the ${k}`).join(' and ');
  return `${capital(words)} will follow in a separate email.`;
}

/** The first send's words, up to the sign-off: both papers, what starts the work, and what is asked of the client. */
const startParts = (v: EmailVars) => [
  hi(v),
  papersBlock(pairOf(v), `As discussed, ${pairPhrase(pairOf(v))}`),
  passwordLine(v, pairOf(v)),
  followLine(v),
  `As agreed, the engagement will formally begin upon receipt of:\n\n${bullets(['Your email confirmation approving the agreement', `Payment of the full invoice amount${present(v.amount) ? ` (${v.amount.trim()})` : ''}`])}`,
  'Kindly note that production will commence upon receipt of payment, and the final edited videos will be released after completion, as per the agreed scope.',
  v.note,
  'Please confirm once processed so we can proceed with scheduling and execution.',
];

const PS_RULE = '--------------------------';

/** The pricing P.S., written from the owner's plans and the client's earlier invoice. With no plans on record, it is left out. */
function pricingPS(v: EmailVars): string {
  const plans = v.plans.filter(present);
  if (plans.length === 0) return '';
  const who = present(v.clientName) ? v.clientName.trim() : 'you';
  return joined([
    PS_RULE,
    `P.S. Just to align on commercials, our standard pricing is:\n\n${bullets(plans)}`,
    present(v.firstRate) ? `The first month was at a one-time rate of ${v.firstRate.trim()}, to start the work together.` : '',
    v.planSaving,
    `We are building this as a content engine for ${who} rather than a trial, so further discounts would not be justified. From here on, all work runs on these plans. They stay as they are unless we tell you in writing first.`,
    PS_RULE,
  ]);
}

const theWork = (v: EmailVars) => (present(v.engagement) ? `the ${v.engagement.trim()}` : 'a short engagement');

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    key: 'begin',
    name: 'Agreement and invoice to start',
    when: 'The first send: the agreement and the invoice, each with its own link, and what has to happen before work begins.',
    namesPair: true,
    subject: (v) => `Agreement and invoice${present(v.engagement) ? `: ${v.engagement.trim()}` : ''}`,
    body: (v) => joined([...startParts(v), signoff(v, 'Looking forward to kicking this off.\n\nBest regards,')]),
  },
  {
    key: 'begin-pricing',
    name: 'Agreement and invoice, with a pricing P.S.',
    when: 'The same first send, when the price has moved up: your plans, and why no more discounts apply.',
    namesPair: true,
    namesPlans: true,
    subject: (v) => `Agreement and invoice${present(v.engagement) ? `: ${v.engagement.trim()}` : ''}`,
    body: (v) => joined([...startParts(v), pricingPS(v), signoff(v, `Looking forward to taking ${present(v.clientName) ? v.clientName.trim() : 'this'} to the next level.\n\nBest regards,`)]),
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
        linkLine(v),
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
    namesPair: true,
    subject: (v) => `Renewal${present(v.period) ? `: ${v.period.trim()}` : ''}`,
    body: (v) =>
      joined([
        hi(v),
        `Thank you for renewing the engagement${present(v.period) ? ` for ${v.period.trim()}` : ''}. We are excited to keep building on the work so far.`,
        papersBlock(pairOf(v), capital(pairPhrase(pairOf(v), true))),
        passwordLine(v, pairOf(v)),
        followLine(v),
        present(v.note) ? `What changes:\n\n${v.note.trim()}` : 'There is no change to the scope of work or the commercial terms.',
        'Kindly review the agreement and let me know if everything looks in order. Once confirmed, we will go ahead with the production schedule as planned.',
        signoff(v, 'Looking forward to another great stretch together.\n\nWarm regards,'),
      ]),
  },
  {
    key: 'revised-paper',
    name: 'Revised paper after a change',
    when: 'Their company name or details changed: every updated agreement and invoice, each with its own link.',
    subject: (v) => `Updated agreements and invoices${present(v.entity) ? `: ${v.entity.trim()}` : ''}`,
    body: (v) =>
      joined([
        hi(v),
        papersOr(everyOf(v), `As you asked, I have updated the paperwork ${present(v.entity) ? `to show ${v.entity.trim()}` : 'with your new details'}`),
        passwordLine(v, everyOf(v)),
        v.morePapers > 0 ? 'I can send the older ones too, if you need them.' : '',
        'Nothing else has changed: the scope, the fees and the dates stay the same.',
        v.note,
        signoff(v, 'Please check them and let me know if anything else is needed.\n\nBest regards,'),
      ]),
  },
  {
    key: 'clause-reply',
    name: 'Reply about clauses and exclusivity',
    when: 'They asked for exclusivity or lasting rights on a short engagement: what fits this deal, and the longer option.',
    subject: (v) => `The proposed clauses${present(v.engagement) ? `: ${v.engagement.trim()}` : ''}`,
    body: (v) =>
      joined([
        hi(v),
        'I have read the proposed clauses with care, and I want to be clear about what fits this deal.',
        'A limit on your category during a long-term engagement makes sense. A non-compete that runs on after the work ends needs a long-term commitment behind it. Without one the deal is out of balance, so that belongs in a formal multi-month agreement.',
        'Scripts and materials made for your brand are yours alone, and that is only fair. Our methods, our formats and what we learn along the way are how we work. We cannot sign those over for good under a short engagement.',
        'Open access to the raw footage works like a buyout, since it lets the footage be used again and again. That also needs a long-term deal behind it.',
        `If this stays ${theWork(v)}${present(v.amount) ? ` at ${v.amount.trim()}` : ''}, it goes ahead as a standard collaboration, with licensed usage and no long-term creative or competitive limits.`,
        present(v.longerTerm)
          ? `If exclusivity and rights matter most to you, we can set this up as a longer exclusive engagement: ${v.longerTerm.trim()}.`
          : 'If exclusivity and rights matter most to you, we can set this up as a longer exclusive engagement. Tell me the length you have in mind, and I will send you the numbers.',
        `That would include:\n\n${bullets([v.longerPieces, 'Exclusivity in your category during the term', 'Agreed rights in the final delivered work', 'Lasting use of the edited work', 'Lasting access to the raw footage for reuse', 'Priority scheduling and long-term content planning'])}`,
        `Or we can go ahead with ${theWork(v)} on standard licensed terms, and come back to a longer deal once we have seen the results and how we work together.`,
        linkLine(v, `the ${named(v.papers)[0]?.kind === 'invoice' ? 'invoice' : named(v.papers)[0]?.kind === 'doc' ? 'document' : 'agreement'} as it stands`),
        v.note,
        signoff(v, 'Please let me know how you would like to proceed.\n\nBest regards,'),
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
        papersOr(v.papers, 'Here is the signed agreement'),
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
        papersOr(v.papers, `I have put together the plan${present(v.period) ? ` for ${v.period.trim()}` : ''}`),
        v.note,
        'Please have a look and tell me what you would like to change or move. Once we agree, we will schedule the shoots around it.',
        signoff(v, 'Best regards,'),
      ]),
  },
  {
    key: 'report',
    name: 'Monthly report',
    when: 'A month is done: the report of what was made and where each piece stands.',
    subject: (v) => `Monthly report${present(v.period) ? `: ${v.period.trim()}` : ''}`,
    body: (v) =>
      joined([
        hi(v),
        papersOr(v.papers, `Here is the report${present(v.period) ? ` for ${v.period.trim()}` : ' for the month'}`),
        present(v.status) ? `Status of deliverables: ${v.status.trim()}` : '',
        v.note,
        'Have a look and tell me what you would like more of, or less of, next month.',
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
        linkLine(v, 'the terms'),
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
        linkLine(v, 'the invoice'),
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
        linkLine(v, 'the invoice'),
        v.note,
        signoff(v, 'I value what we are building together, and I hope this feels like a fair ask.\n\nWith best intentions,'),
      ]),
  },
  {
    key: 'portal-invite',
    name: 'Their page and a short form',
    when: 'A new client: the link to their page. The password goes in a separate message.',
    subject: (v) => `Your page with ${present(v.signStudio) ? v.signStudio.trim() : 'us'}`,
    body: (v) =>
      joined([
        hi(v),
        present(v.link ?? '') ? `Here is your page: ${(v.link ?? '').trim()}` : 'Here is the link to your page.',
        'Open it, type the password I send you separately, and fill in a short form about your brand. It takes a few minutes.',
        'Your password comes in a separate message.',
        v.note,
        signoff(v, 'Looking forward to working together.\n\nBest regards,'),
      ]),
  },
  {
    key: 'onboarding-done',
    name: 'Onboarding finished (to you)',
    when: 'Sent to you when a client finishes the form at their link.',
    subject: (v) => `${present(v.engagement) ? v.engagement.trim() : 'A client'} finished onboarding`,
    body: (v) =>
      joined([
        hi(v),
        `${present(v.engagement) ? v.engagement.trim() : 'Your client'} filled in their details and the trial brief.`,
        present(v.status) ? v.status.trim() : '',
        present(v.link ?? '') ? `Open their page: ${(v.link ?? '').trim()}` : '',
        signoff(v, 'kreators.app'),
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
        linkLine(v, 'the invoice'),
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

/** Where a client stands and what the document is, so the note offered first is the one this moment needs. */
export interface EmailMoment {
  /** The client's stage on the way from enquiry to monthly delivery (`AGENCY_STAGE_KEYS`). */
  stage?: string;
  /** An invoice that belongs to a retainer month. */
  retainerMonth?: boolean;
  /** An agreement the client has signed. */
  signed?: boolean;
  /** An invoice past its due day and not paid. */
  overdue?: boolean;
  /** An invoice that is paid. */
  paid?: boolean;
  /** The agreement's template (trial, retainer, project) or the document's kind (brief, trial_terms, retainer_proposal, monthly_report). */
  docKind?: string;
  /** A paper changed after it was emailed. */
  revised?: boolean;
  /** This send costs more than the client's first invoice, and the owner's plans are on record. */
  priceRose?: boolean;
}

const RUNNING = new Set(['retainer', 'delivery']);

/** The note a document most likely goes with, by what it is and where the client stands. The person can still pick another. */
export function suggestEmailTemplate(kind: 'invoice' | 'contract' | 'doc', ctx: EmailMoment = {}): EmailTemplateKey {
  const running = Boolean(ctx.stage && RUNNING.has(ctx.stage));
  const start: EmailTemplateKey = ctx.priceRose ? 'begin-pricing' : 'begin';
  if (kind === 'invoice') {
    if (ctx.paid) return 'payment-thanks';
    if (ctx.overdue) return 'payment-nudge';
    if (ctx.revised) return 'revised-paper';
    return ctx.retainerMonth || running ? 'monthly-invoice' : start;
  }
  if (kind === 'contract') {
    if (ctx.signed) return 'signed-copy';
    if (ctx.revised) return 'revised-paper';
    return ctx.docKind === 'retainer' && running ? 'renewal' : start;
  }
  if (ctx.revised) return 'revised-paper';
  if (ctx.docKind === 'trial_terms') return 'before-shoot';
  if (ctx.docKind === 'retainer_proposal') return running ? 'renewal' : 'plan';
  if (ctx.docKind === 'monthly_report') return 'report';
  return 'plan';
}

/** What the records already know, from which every part of a note is written. Every part is optional. */
export interface EmailFacts {
  kind: 'invoice' | 'contract' | 'doc';
  client?: { name: string; contactName: string; legalName?: string; month?: { published: number; inReview: number; open: number } } | null;
  /** The business profile: the invoice's sender (`from`), and the agreement paper's own fields, used where a part of `from` is empty. */
  profile?: { signerName: string; from: { name: string; phone: string; email: string }; brandName?: string; operatingUnder?: string; businessName?: string; phones?: string[]; emails?: string[]; formatName?: string; formatNameInline?: string } | null;
  /** Every paper of this client, newest first. Left out when the records were not read (a team member is never given a client's link). */
  papers?: EmailPaper[];
  /** The paper the note was opened from. */
  paperId?: string;
  /** Whether the client's links ask for a password. */
  locked?: boolean;
  /** The owner's plans, each price already written, and the unit they sell. */
  plans?: { units: number; feeCents: number; price: string }[];
  unit?: string;
  /** A longer deal on record: a retainer on offer or running, else the client's monthly fee and plan. */
  longer?: { months: number | null; monthly: string; pieces: number } | null;
  /** The document's title, as it is printed. */
  title?: string;
  /** The invoice number, or the document's reference. */
  number?: string;
  /** Already written: "₹30,000". */
  amount?: string;
  /** Already written: "1 May 2026". */
  dueBy?: string;
  /** Already written: "May 2026". */
  period?: string;
  /** The agreement's template or the document's kind, as in `EmailMoment.docKind`. */
  docKind?: string;
  /** An invoice that is only an advance (the advance starter's title). */
  advance?: boolean;
}

/** A value a note needs that no record holds yet, and where it is added once. */
export interface EmailGap {
  key: 'contactName' | 'signerName' | 'businessName' | 'phone' | 'email';
  /** "the client's contact name". */
  label: string;
  /** Saved on the client, or in the business profile. */
  where: 'client' | 'profile';
}

const ENGAGEMENT: Record<string, string> = Object.assign(Object.create(null), {
  trial: 'trial engagement',
  retainer: 'monthly content retainer',
  project: 'content project',
  brief: 'strategy session',
  trial_terms: 'trial engagement',
  retainer_proposal: 'monthly content retainer',
  monthly_report: 'monthly content work',
});

const first = (name: string) => name.trim().split(/\s+/)[0] ?? '';
const phones = (from: string, more: string[] | undefined) => [...new Set([from, ...(more ?? [])].map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean))];

/** What the work is called, with the owner's own format in it when the profile names one. */
function engagementName(kind: string | undefined, format: string): string {
  const base = kind ? ENGAGEMENT[kind] : undefined;
  if (!base) return '';
  if (!format) return base;
  return base.includes('content') ? base.replace('content', format) : `${format} ${base}`;
}

const SMALL_WORDS = new Set(['and', 'of', 'for', 'the', 'to', 'in', 'on', 'a', 'an']);
/** A title typed in capitals (the Trial template prints its so) reads as a name inside a sentence. */
function plainTitle(title: string): string {
  const t = title.trim();
  if (!t || /[a-z]/.test(t)) return t;
  return t
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function lineOf(p: EmailPaper, withRef = false): EmailLine {
  const link = (p.link ?? '').trim();
  if (p.kind === 'invoice') return { label: `The invoice${p.number ? ` ${p.number}` : ''}${p.amount ? ` for ${p.amount}` : ''}${p.advance ? ' (full advance)' : ''}`, link, kind: p.kind };
  const title = plainTitle(p.title);
  return { label: `${/^the\s/i.test(title) ? '' : 'The '}${title}${withRef && p.number ? ` (${p.number})` : ''}`, link, kind: p.kind };
}

/** The word for a paper the first send names. */
export type PaperWord = 'agreement' | 'invoice';

/** One of the first send's two papers that has no link to give yet, and why. The screen says it plainly and opens the way to it. */
export interface PaperGap {
  word: PaperWord;
  state: 'none' | 'draft';
  /** The draft itself, to open it. */
  id?: string;
  number?: string;
}

/** Says the gap in one line. */
export function paperGapLine(g: PaperGap, clientName: string): string {
  if (g.state === 'draft') return `The ${g.word}${g.number ? ` ${g.number}` : ''} is still a draft, so it has no link yet. The note says it will follow.`;
  return `${clientName.trim() || 'This client'} has no ${g.word} yet. The note says it will follow.`;
}

/** The order the first send picks a paper in, when it was not opened from one: what is out with the client first, a draft next. */
const PICK_ORDER = ['sent', 'signed', 'approved', 'revised', 'draft', 'paid'];
const pickRank = (status: string) => {
  const i = PICK_ORDER.indexOf(status);
  return i < 0 ? PICK_ORDER.length : i;
};
function pickPaper(papers: EmailPaper[], kind: EmailPaperKind, paperId?: string): EmailPaper | null {
  const of = papers.filter((p) => p.kind === kind && p.status !== 'void');
  return of.find((p) => p.id === paperId) ?? [...of].sort((a, b) => pickRank(a.status) - pickRank(b.status))[0] ?? null;
}

/** The most papers the note after a change of company name lists; each is two lines, so the note stays well under its limit. */
const EVERY_PAPER_MAX = 24;

/**
 * Every variable of a note, from the records: who it greets (the contact's first name and the client's team), what the work is called
 * (from the template or the kind), which papers it names and each one's link (from the client's papers), the amount, the day and the period (from the document), how the
 * work stands (from the month's counts) and the sign-off (from the business profile). What no record holds comes back in `missing`, once,
 * so the screen can ask for it a single time and save it where it belongs; a note never shows a blank for it.
 */
export function emailVarsFor(f: EmailFacts): { vars: EmailVars; missing: EmailGap[]; gaps: PaperGap[]; priceRose: boolean } {
  const v = emptyEmailVars();
  const missing: EmailGap[] = [];
  const gaps: PaperGap[] = [];
  let priceRose = false;
  const c = f.client;
  const p = f.profile;
  if (c) {
    v.clientName = c.name.trim();
    v.entity = (c.legalName ?? '').trim();
    const who = first(c.contactName);
    v.names = who ? `${who} and ${c.name.trim()} team` : `${c.name.trim()} team`;
    if (!who) missing.push({ key: 'contactName', label: "the client's contact name", where: 'client' });
    if (c.month) {
      const m = c.month;
      const bits = [m.published > 0 && `${m.published} published`, m.inReview > 0 && `${m.inReview} waiting for your review`, m.open > 0 && `${m.open} being made`].filter((x): x is string => Boolean(x));
      v.status = bits.join(', ');
    }
  }
  const papers = f.papers;
  const self = papers?.find((x) => x.id === f.paperId);
  const agreement = papers ? pickPaper(papers, 'contract', f.paperId) : null;
  const invoice = papers ? pickPaper(papers, 'invoice', f.paperId) : null;
  const format = ((p?.formatNameInline ?? '') || (p?.formatName ?? '')).trim();
  v.engagement = engagementName(f.docKind || agreement?.docKind, format) || (f.kind === 'invoice' ? (f.period ? `content work for ${f.period}` : 'content work') : plainTitle(f.title ?? '').toLowerCase());
  const title = plainTitle(f.title ?? '');
  if (self) v.papers = [lineOf(self)];
  else if (f.kind === 'invoice') v.papers = [{ label: `The invoice${f.number ? ` ${f.number}` : ''}${f.amount ? ` for ${f.amount}` : ''}${f.advance ? ' (full advance)' : ''}`, link: '', kind: 'invoice' }];
  else if (title) v.papers = [{ label: `${/^the\s/i.test(title) ? '' : 'The '}${title}`, link: '', kind: f.kind }];
  if (papers) {
    // The first send names one agreement and one invoice. One with no link yet is not named as if it could be opened: the note says it
    // will follow and the screen says why, unless it is the very paper the sheet was opened from (the sheet says that one on its own).
    const pairUp = (x: EmailPaper | null, word: PaperWord) => {
      if (x && (x.path || x.id === f.paperId)) v.pair.push(lineOf(x));
      else {
        v.follows.push(word);
        gaps.push(x ? { word, state: 'draft', id: x.id, number: x.kind === 'invoice' ? x.number : undefined } : { word, state: 'none' });
      }
    };
    pairUp(agreement, 'agreement');
    pairUp(invoice, 'invoice');
    const listed = [...papers.filter((x) => x.kind === 'contract'), ...papers.filter((x) => x.kind === 'invoice'), ...(self?.kind === 'doc' ? [self] : [])].filter((x) => x.status !== 'void' && (x.path || x.id === f.paperId));
    v.everyPaper = listed.slice(0, EVERY_PAPER_MAX).map((x) => lineOf(x, true));
    v.morePapers = Math.max(0, listed.length - EVERY_PAPER_MAX);
    // What the client first paid against this send: a lower first invoice is the P.S.'s "one-time rate".
    const earliest = papers.filter((x) => x.kind === 'invoice' && x.status !== 'draft' && x.status !== 'void').at(-1);
    if (earliest && invoice && earliest.id !== invoice.id && earliest.currency === invoice.currency && earliest.totalCents < invoice.totalCents) {
      v.firstRate = earliest.amount;
      priceRose = true;
    }
  }
  v.locked = Boolean(f.locked);
  const plural = (f.unit ?? '').trim().toLowerCase() || 'videos';
  const one = plural.replace(/s$/, '');
  const plans = (f.plans ?? []).filter((r) => r.units > 0 && r.feeCents > 0).sort((a, b) => a.units - b.units);
  v.plans = plans.map((r) => `${r.price} for ${r.units} ${r.units === 1 ? one : plural}`);
  const small = plans[0];
  const large = plans.at(-1);
  if (small && large && large.units > small.units) {
    // Whole numbers throughout: the share of the small plan's price per unit that the large plan saves.
    const percent = Math.round(100 - (100 * large.feeCents * small.units) / (small.feeCents * large.units));
    if (percent >= 1) v.planSaving = `The ${large.units} ${plural} plan costs about ${percent}% less per ${one} than the ${small.units} ${small.units === 1 ? one : plural} plan, and it gives you more consistency and scale.`;
  }
  const longer = f.longer;
  // One month is no longer deal: the note then names the monthly fee and asks for the length, as it does with none on record.
  const longerMonths = longer && longer.months && longer.months > 1 ? longer.months : null;
  if (longer && longer.monthly) v.longerTerm = longerMonths ? `${longerMonths} months at ${longer.monthly} a month` : `${longer.monthly} a month`;
  if (longer && longer.pieces > 0) v.longerPieces = `${longer.pieces} ${longer.pieces === 1 ? one : plural} a month${longerMonths ? ` (${longer.pieces * longerMonths} over ${longerMonths} months)` : ''}`;
  v.amount = f.amount || (invoice?.amount ?? '');
  v.dueBy = f.dueBy ?? '';
  v.period = f.period ?? '';
  if (p) {
    v.signName = p.signerName.trim();
    // Typed once: the invoice's sender, else the agreement paper's brand, phone and email (the same fallback as invoiceFromProfile).
    const t = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
    v.signStudio = t(p.from.name) || t(p.brandName) || t(p.operatingUnder) || t(p.businessName);
    v.signPhone = phones(p.from.phone, p.phones).join(' | ');
    v.signEmail = t(p.from.email) || t((p.emails ?? [])[0]);
    if (!v.signName) missing.push({ key: 'signerName', label: 'your name for the sign-off', where: 'profile' });
    if (!v.signStudio) missing.push({ key: 'businessName', label: 'your business name', where: 'profile' });
    if (!v.signPhone) missing.push({ key: 'phone', label: 'your phone', where: 'profile' });
    if (!v.signEmail) missing.push({ key: 'email', label: 'your email', where: 'profile' });
  }
  return { vars: v, missing, gaps, priceRose: priceRose && v.plans.length > 0 };
}

const PAPER_LINK_LINE = /^\s*https?:\/\/\S+\/[kidat]\/[A-Za-z0-9_-]{8,}\s*$/;
const PAPER_LINK = /\s*https?:\/\/[^\s/]+(?:\/[^\s/]+)*\/[kidat]\/[A-Za-z0-9_-]{8,}/g;
const escapeRe = (t: string) => t.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&');
/**
 * A note kept for other clients never carries this client's paper: each link opens it, wherever in a line it sits, and an invoice's number and amount are its
 * alone. The line asking them to open it goes too, and the server adds the right paper's link under the words when the kept note is sent. `amounts` are the
 * sums this note was filled with (`EmailVars.amount`, `firstRate`), so they come out of its sentences as well; other words are the owner's to read in the box.
 */
export function withoutPaperLinks(body: string, amounts: readonly string[] = []): string {
  let text = body
    .split('\n')
    .filter((l) => !PAPER_LINK_LINE.test(l))
    .map((l) => (/^• The invoice\b/.test(l) ? '• The invoice' : l.replace(/^(• .*?) \((?=[^)]*\d)[^)]*\)$/, '$1').replace(PAPER_LINK, '')))
    .join('\n')
    .replace(/ ?You can open and download [^\n:]* here:/g, '')
    .replace(/(?:The|Each) link asks for the password I shared with you\.\n*/g, '');
  for (const a of amounts) {
    const sum = a.trim();
    if (sum) text = text.replace(new RegExp(`(?: \\(${escapeRe(sum)}\\)|, ${escapeRe(sum)}| at ${escapeRe(sum)}| of ${escapeRe(sum)}|${escapeRe(sum)})`, 'g'), '');
  }
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/** The longest note the server will send. */
export const EMAIL_NOTE_MAX = 6000;

/** The longest subject line a note keeps. */
export const EMAIL_SUBJECT_MAX = 200;

/** An email note as it is sent or kept as the owner's own template: a one-line subject and the words, plain text. */
export interface SavedEmailNote {
  subject: string;
  message: string;
}

/**
 * The one reader for a note's subject and words, used by the email routes and by a saved note: the words keep their line breaks (any
 * Windows or old Mac line end becomes one), lose every control character but the tab and the line break, and stop at `EMAIL_NOTE_MAX`;
 * the subject is one line (control characters and line breaks become a space) up to `EMAIL_SUBJECT_MAX`. Null when there are no words.
 */
export function parseEmailNote(v: unknown): SavedEmailNote | null {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const message =
    typeof o.message === 'string'
      ? o.message
          .replace(/\r\n?/g, '\n')
          .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
          .trim()
          .slice(0, EMAIL_NOTE_MAX)
      : '';
  if (!message) return null;
  const subject = typeof o.subject === 'string' ? o.subject.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/ {2,}/g, ' ').trim().slice(0, EMAIL_SUBJECT_MAX) : '';
  return { subject, message };
}
