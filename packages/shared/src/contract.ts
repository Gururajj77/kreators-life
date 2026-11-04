import { byKey } from './core.ts';
import { money } from './money.ts';
import type { InvoiceItem } from './money.ts';
import { cleanText, emptyParty, oneOfList, packageExampleLine, parseDocStyle, tdsGrossupNote } from './invoice.ts';
import type { BusinessProfile, DocStyle, InvoiceDoc } from './invoice.ts';
import type { TagTone } from './agency.ts';

// ---------------------------------------------------------------------------
// Contract creator: agreements built from sections, with the client's answers and typed acceptance
// ---------------------------------------------------------------------------

export const CONTRACT_STATUSES = ['draft', 'sent', 'signed', 'void'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];
export const CONTRACT_STATUS_NAME: Record<ContractStatus, string> = { draft: 'Draft', sent: 'Sent', signed: 'Signed', void: 'Void' };
export const CONTRACT_STATUS_TONE: Record<ContractStatus, TagTone> = { draft: 'neutral', sent: 'info', signed: 'good', void: 'bad' };
/** A line in the thread on an invoice or an agreement: the client asking for a change, the person answering. */
export interface DocComment {
  id: string;
  author: 'me' | 'client';
  body: string;
  createdAt: string;
}
export const DOC_COMMENT_MAX = 600;
export const DOC_TYPES = ['invoice', 'contract', 'doc'] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const MAX_CONTRACT_SECTIONS = 30;
export const MAX_CONTRACT_QUESTIONS = 12;
/** The longest a section's words (its body, and the words after its questions or table) can be. The Trial agreement's "How we work" runs to about 11,000. */
export const CONTRACT_TEXT_MAX = 16000;
/** The most short answers one brief question holds (one per line of a brand guide), and the most links. */
export const MAX_CONTRACT_FIELDS = 16;
export const MAX_CONTRACT_LINKS = 10;

export type ContractSectionKind = 'text' | 'packages' | 'brief' | 'signatures';
export interface ContractQuestion {
  id: string;
  /** The question itself ("What is the primary purpose of these videos?"). Empty for a part that is only a list of fields. */
  label: string;
  options: string[];
  /** More than one option may be ticked. */
  multi: boolean;
  /** An "Other" line. */
  other: boolean;
  /** A free-text answer instead of options. */
  text: boolean;
  /** A numbered subhead drawn above it, such as "3.1 Objective". */
  heading?: string;
  /** A line under the subhead, before the question ("Please share (or attach) a simple brand guide covering the following:"). */
  intro?: string;
  /** A bold subhead of its own, such as "Brand Identity". */
  group?: string;
  /** The words before a written answer, such as "Client response:". */
  answerLabel?: string;
  /** One short labelled answer for each line, such as the lines of a brand guide. */
  fields?: string[];
  /** Links the client gives (examples of videos), between min and max. */
  links?: { min: number; max: number };
}
export interface ContractPackage {
  name: string;
  units: number;
  feeCents: number;
}
export interface ContractSection {
  id: string;
  heading: string;
  kind: ContractSectionKind;
  /** Plain paragraphs, "- " bullets and **bold**; {{name}} fills from the variables. */
  body: string;
  packages?: ContractPackage[];
  /** For a packages section: the price of each further block, and how many it holds. */
  extra?: { units: number; feeCents: number };
  unitName?: string;
  questions?: ContractQuestion[];
  /** Words drawn after the questions or the price table, in the same small markdown as the body. */
  tail?: string;
  /**
   * Whether the section is on the printed page. The agreement is its main text; a section of information (how the work runs, what happens next) or a
   * brief the client answers at the link can stay on the screen and out of the print. When it is not set, a brief is not printed and everything else is.
   */
  print?: boolean;
}
/** Whether a section goes on the printed page. */
export const sectionPrints = (s: Pick<ContractSection, 'kind' | 'print'>): boolean => s.print ?? s.kind !== 'brief';
export interface ContractDoc {
  title: string;
  subtitle: string;
  templateKey: string;
  /** What the client may do at the link, apart from reading and accepting. */
  show: { comments: boolean; download: boolean };
  /** Currency of the packages. */
  currency: string;
  vars: Record<string, string>;
  sections: ContractSection[];
  /** How the printed page looks. Older agreements have the default. */
  style?: DocStyle;
}
export interface ContractAnswer {
  picked: string[];
  other: string;
  text: string;
  /** One short answer for each of a question's fields, by the field's own words. */
  fields?: Record<string, string>;
  /** The links given, in order. */
  links?: string[];
}

/** The words that fill a contract. Where each comes from decides what the form prefills. */
export const CONTRACT_VARS = [
  { key: 'provider', label: 'Your name', from: 'profile' },
  { key: 'providerTitle', label: 'Your title', from: 'profile' },
  { key: 'providerBusiness', label: 'Your business', from: 'profile' },
  { key: 'providerAddress', label: 'Your address', from: 'profile' },
  { key: 'providerEmail', label: 'Your email', from: 'profile' },
  { key: 'providerPhone', label: 'Your phone', from: 'profile' },
  { key: 'client', label: 'Client', from: 'client' },
  { key: 'clientAddress', label: 'Client address', from: 'client' },
  { key: 'clientContact', label: 'Point of contact', from: 'client' },
  { key: 'brands', label: 'Brand or brands', from: 'typed' },
  { key: 'jurisdiction', label: 'Courts of', from: 'profile' },
  { key: 'pieces', label: 'Pieces a month', from: 'client' },
  { key: 'channels', label: 'Channels', from: 'client' },
  { key: 'hours', label: 'Hours a month', from: 'client' },
  { key: 'revisions', label: 'Changes included in each piece', from: 'client' },
  { key: 'monthlyFee', label: 'Monthly fee', from: 'client' },
  { key: 'projectWhat', label: 'What the work is', from: 'typed' },
  { key: 'deliveryDate', label: 'Delivery date', from: 'typed' },
  { key: 'trialPieces', label: 'Number of trial pieces', from: 'typed' },
  { key: 'trialFee', label: 'Trial fee, if any', from: 'typed' },
  { key: 'sessionDate', label: 'Date of the session', from: 'typed' },
  { key: 'providerBrand', label: 'Brand you operate under', from: 'profile' },
  { key: 'providerEmail2', label: 'Your second email', from: 'profile', optional: true },
  { key: 'providerPhones', label: 'Your phones', from: 'profile' },
  { key: 'providerDesignation', label: 'Your designation', from: 'profile' },
  { key: 'clientTitle', label: "Client's designation", from: 'client', optional: true },
  { key: 'brandName', label: 'Your brand name', from: 'profile', optional: true },
  { key: 'formatName', label: 'Your content format', from: 'profile', optional: true },
  { key: 'formatNameInline', label: 'Your format, inside a line', from: 'profile', optional: true },
  { key: 'pastClients', label: 'Brands you have worked with', from: 'profile', optional: true },
  { key: 'currencyWords', label: 'Currency in words', from: 'profile', optional: true },
] as const;
/** The name of a currency as an agreement writes it: "All amounts are in Indian Rupees (INR)." */
export const CURRENCY_WORDS: Record<string, string> = byKey([
  ['INR', 'Indian Rupees (INR)'],
  ['USD', 'US Dollars (USD)'],
  ['EUR', 'Euros (EUR)'],
  ['GBP', 'Pounds Sterling (GBP)'],
  ['AED', 'UAE Dirhams (AED)'],
  ['SGD', 'Singapore Dollars (SGD)'],
  ['AUD', 'Australian Dollars (AUD)'],
  ['CAD', 'Canadian Dollars (CAD)'],
]);

const uid = (p: string, i: number) => `${p}${i + 1}`;
const text = (id: string, heading: string, body: string): ContractSection => ({ id, heading, kind: 'text', body });
const question = (id: string, label: string, options: string[], opts: Partial<ContractQuestion> = {}): ContractQuestion => ({ id, label, options, multi: false, other: true, text: false, ...opts });

const CONFIDENTIALITY = 'Both parties keep non-public information from the other private. This lasts five years after the agreement ends.\n\nThis agreement follows the laws of India. Only the courts of {{jurisdiction}} may hear a dispute about it.';
const SIGNATURES = 'By signing below, both parties confirm they have read and agree to this agreement.';

// The founder's Trial Engagement Agreement, word for word (docs/DECISIONS.md, 2026-11-03). Only a person's or a company's details are
// variables, filled from the business profile and the client; {{a|b}} and {{a?..$..|b}} are the fallbacks used when a profile field is
// empty, so a sentence keeps the agreement's own shape and no name is invented. The section ids are read by TRIAL_RULES and trialPart.
const TRIAL_PARTIES = [
    "**Service Provider:** {{provider}}",
    "Proprietor, {{providerBusiness}}, operating under {{providerBrand}}",
    "{{providerAddress}}",
    "**Email:** {{providerEmail}}",
    "**Email:** {{providerEmail2}}",
    "**Phone:** {{providerPhones}}",
    "",
    "**Client:** {{client}}",
    "Address: {{clientAddress}}",
    "Brand(s) for this trial: {{brands}}",
    "Hereinafter referred to as the “Client”",
    "",
    "**Point of Contact**",
    "Name: {{clientContact}}",
    "Authorized Representative of the Client",
    "",
    "The Service Provider and the Client are collectively referred to as the “Parties”.",
  ].join('\n');
const TRIAL_PURPOSE = [
    "The trial is a short evaluation so that the Client can see the Service Provider’s {{formatNameInline|}} style of work on its own brand before committing to a paid pilot engagement.",
    "",
    "Scope, number of trial videos and any trial fee are as confirmed in writing between the Parties. Nothing in the trial creates an obligation to proceed to a pilot engagement on either side.",
  ].join('\n');
const TRIAL_BRIEF_TAIL = [
    "### 3.6 Creative Alignment",
    "",
    "To ensure the best outcome, all creative direction, branding expectations, and mandatory elements should be finalized before the shoot.",
    "",
    "Any new creative requirements or changes introduced after filming may require additional editing, revised deliverables, or a reshoot if they depend on footage that was not originally captured.",
  ].join('\n');
const TRIAL_OWNERSHIP = [
    "### 4.1 Trial Content and Usage",
    "",
    "Any content produced during the trial is created solely for evaluation and approval purposes. The Client may not publish, distribute, boost, advertise, repurpose, sublicense, or otherwise commercially use trial content unless a paid engagement is subsequently confirmed in writing. If the engagement does not proceed, all unpublished trial content must remain unused, and any published trial content must be removed upon request.",
    "",
    "### 4.2 IP and Usage Rights",
    "",
    "Unless otherwise agreed in writing, ownership and/or usage rights for content created during the trial do not transfer to the Client merely by virtue of the trial. Any commercial usage rights will be governed by the final engagement agreement.",
    "",
    "### 4.3 Competitive Conflicts",
    "",
    "Either Party may discontinue discussions if a conflict of interest or competitive overlap becomes apparent. Where the Service Provider identifies such a conflict, the Service Provider may request that trial content be removed from active use.",
  ].join('\n');
const TRIAL_AFTER = [
    "If the Client wishes to continue, this is how the pilot engagement will run.",
    "",
    "**Step 1: Trial review.** The trial videos are shared with the Client for evaluation.",
    "",
    "**Step 2: Consolidated feedback.** The Client shares feedback through one primary point of contact. Edit-level feedback is handled as described in Section 8.12.",
    "",
    "**Step 3: Package selection.** The Client chooses a package from Section 6 for a single brand.",
    "",
    "**Step 4: Pilot agreement and prepayment.** A pilot engagement agreement is signed, an invoice is raised, and the full package fee is paid in advance. Production begins on receipt of payment.",
    "",
    "**Step 5: Pre-production alignment.** Before each shoot, the Parties lock the items listed in Section 8.11. The completed brief in Section 3 is the starting point.",
    "",
    "**Step 6: Shoot, edit and delivery.** The agreed batch is produced through a planned production cycle, with review checkpoints where useful and minor revisions included.",
    "",
    "**Step 7: Usage rights.** Usage rights for the final videos transfer on full payment, on the terms of the pilot engagement agreement.",
    "",
    "Delivery timelines for the pilot are confirmed in the pilot engagement agreement once pre-production alignment is complete.",
  ].join('\n');
const TRIAL_PACKAGES_TAIL = [
    "### 6.1 Additional Videos",
    "",
    "{{packageExample}}",
    "",
    "### 6.2 One Brand Per Package",
    "",
    "Each package applies to one brand only. Packages cannot be combined, pooled or split across multiple brands, including where the Client is an agency working for several brands. Each brand requires its own package, priced separately from the table above.",
    "",
    "### 6.3 Quantities Not Listed",
    "",
    "Quantities that fall between the packages above are quoted in writing before work begins.",
    "",
    "### 6.4 Taxes",
    "",
    "Fees are exclusive of applicable taxes, including GST where applicable.",
  ].join('\n');
const TRIAL_PAYMENT = [
    "All payments are prepaid. The full package fee is due in advance, before pre-production or production begins.",
    "",
    "An invoice will be raised when the Client confirms the package and signs the pilot engagement agreement. Production begins on receipt of payment.",
    "",
    "If payment is delayed or partially paid:",
    "",
    "- Work may be paused",
    "- Delivery of edited videos and/or raw footage may be withheld",
    "- Usage rights shall remain suspended",
    "",
    "Refund and delivery guarantee terms are set out in the pilot engagement agreement.",
  ].join('\n');
const TRIAL_HOW = [
    "This section applies to the trial and to the pilot engagement unless the pilot engagement agreement says otherwise.",
    "",
    "### 8.1 What We Are Building",
    "",
    "{{brandName?$ specializes|We specialize}} in authentic, reaction-led creative using real people and real conversations.",
    "",
    "The strength of the {{formatName|}} format comes from the fact that the responses aren't scripted.",
    "",
    "The creative process is therefore about engineering the interaction, not scripting the outcome.",
    "",
    "We can control:",
    "",
    "- The objective and creative direction",
    "- Question and concept framing",
    "- How participants are approached",
    "- The setup of the interaction",
    "- The interviewer and follow-up questions",
    "- On-ground direction",
    "- Participant selection",
    "- Editing, pacing and final presentation",
    "",
    "What we cannot control is exactly how a stranger will respond in the moment.",
    "",
    "Our responsibility is to create the strongest possible conditions for interesting reactions and then identify and build around the strongest moments in post-production.",
    "",
    "### 8.2 Creative Variety",
    "",
    "One of the biggest learnings we've taken from producing {{formatName|}} campaigns across different consumer brands is that creative variety is extremely important, but variety does not necessarily mean creating a completely different production setup for every video.",
    "",
    "For a batch of five videos, we will actively avoid simply repeating the same question or interaction.",
    "",
    "Instead, we'll create variation through different creative mechanisms such as:",
    "",
    "- Guessing and reveals",
    "- A/B comparisons",
    "- Challenges",
    "- Rankings",
    "- Debates and opposing opinions",
    "- Personal experiences",
    "- Product reactions",
    "- Humour and playful interactions",
    "- Unexpected questions",
    "- Audience participation",
    "- Different follow-up structures",
    "",
    "This allows each video to have its own creative identity while keeping the overall production efficient and authentic.",
    "",
    "We have found through previous campaigns that this is a much more sustainable way to create variety than treating every video as a completely separate production.",
    "",
    "### 8.3 Engagement and Reactions",
    "",
    "We also want to clarify what we mean when we say that we're engineering engagement.",
    "",
    "A question that looks interesting on paper does not automatically create an engaging video.",
    "",
    "The complete interaction matters:",
    "",
    "**Setup → Question → Participant → Follow-up → Reaction → Edit**",
    "",
    "For example, instead of simply asking for an opinion, we can create curiosity through a prediction, create debate through an A/B choice, create humour through an unexpected challenge, or create surprise through a reveal.",
    "",
    "The interviewer then has the freedom to follow an interesting response and go deeper.",
    "",
    "Because we're working with real strangers, we cannot guarantee that a particular participant will be funny, emotional, surprising or highly reactive.",
    "",
    "What we can do is deliberately create more opportunities for those moments to happen.",
    "",
    "### 8.4 Video Length and Editing",
    "",
    "The final content will be optimized for short-form consumption.",
    "",
    "Our editing process will prioritize:",
    "",
    "- Strong opening moments",
    "- Removing unnecessary pauses and repetition",
    "- Clear context",
    "- Tight storytelling",
    "- Strong reaction moments",
    "- Appropriate pacing",
    "- Clean endings",
    "",
    "At the same time, we don't want to impose an arbitrary duration on every video if doing so removes the context or payoff that makes a particular interaction work.",
    "",
    "The goal is not simply to make the video shorter. The goal is to make it as tight and engaging as the story allows.",
    "",
    "### 8.5 Visual Quality",
    "",
    "We will maintain professional standards around:",
    "",
    "- Framing",
    "- Audio",
    "- Camera positioning",
    "- Lighting where possible",
    "- Participant presentation",
    "- Background distractions",
    "- Overall composition",
    "",
    "We also understand the importance of making the batch visually varied.",
    "",
    "However, our standard production model is built around efficient batch shooting.",
    "",
    "We can create visual variation through different participants, backgrounds, framing, interaction styles, environments and creative mechanisms without requiring every video to have a completely different production setup.",
    "",
    "If a particular concept genuinely requires a specialised location, costume, tent, large prop, custom setup or additional production requirement, that should be identified and agreed during pre-production so that we can plan for it appropriately.",
    "",
    "### 8.6 Natural Conversations",
    "",
    "One of the biggest advantages of {{formatName|this format}} is that the content feels different from a conventional scripted advertisement.",
    "",
    "We therefore want the conversations to feel spontaneous, natural and entertaining.",
    "",
    "The product can absolutely be integrated into the conversation, but we don't want to force a predetermined brand pitch onto a stranger.",
    "",
    "The objective is to make the brand/product part of an interesting interaction rather than making the interaction feel like an advertisement.",
    "",
    "### 8.7 Products and Campaign Objectives",
    "",
    "If multiple products are being featured, we're happy to plan the content across them.",
    "",
    "However, we would recommend that each video has a primary creative objective rather than trying to communicate every product, feature, benefit and CTA within every video.",
    "",
    "For example, a video could primarily be designed to:",
    "",
    "- Create curiosity",
    "- Address a specific problem",
    "- Generate product interest",
    "- Demonstrate a benefit",
    "- Build social proof",
    "- Drive consideration",
    "",
    "This gives the content a clearer purpose while allowing the overall batch to cover the wider product portfolio.",
    "",
    "### 8.8 Brand Representation",
    "",
    "Where the interviewer is representing the Client, we'll ensure that the relationship with the brand is communicated clearly.",
    "",
    "We'll align on the preferred introduction and brand positioning before the shoot so there is no ambiguity around who the interviewer is representing.",
    "",
    "### 8.9 Participant Engagement",
    "",
    "Participant participation is another important production variable.",
    "",
    "Because we're approaching people organically on the street, having a simple incentive can materially improve our ability to get people to stop, participate and spend enough time with us.",
    "",
    "If we use rewards, they should ideally be physical or immediately redeemable so that they can be shown and handed to participants on the spot.",
    "",
    "The purpose is not to influence what someone says. It is simply to improve participation and increase the pool of genuine interactions available to us.",
    "",
    "The exact incentive mechanism can be finalized during pre-production.",
    "",
    "### 8.10 Shoot-Day Flexibility",
    "",
    "Once the objective and creative direction are agreed, our team needs reasonable flexibility on the ground.",
    "",
    "With real participants, some interactions will naturally be stronger than others.",
    "",
    "If an unexpected conversation starts working particularly well, the interviewer may follow that direction, ask additional questions or adapt the interaction.",
    "",
    "That flexibility is an important part of authentic {{formatName|}} production.",
    "",
    "We would rather follow a genuinely interesting moment than force the participant back into a predetermined script.",
    "",
    "### 8.11 Pre-Production Alignment",
    "",
    "Before each shoot, we'd like to lock:",
    "",
    "- Primary objective",
    "- Product/product(s) being featured",
    "- Target audience",
    "- Core message/value proposition",
    "- Desired audience response",
    "- Required brand/product information",
    "- Mandatory requirements",
    "- Things to avoid",
    "- Any special production requirements",
    "",
    "Once these are clear, our team will take responsibility for translating them into the concepts, questions, interactions and on-ground execution.",
    "",
    "The brand provides the objective, product truth and requirements.",
    "",
    "{{brandName?$ owns|Our team owns}} the creative execution.",
    "",
    "This division is important because it allows the team to provide the right context without having to micromanage how the interaction should unfold on the street.",
    "",
    "### 8.12 Review and Revisions",
    "",
    "We're happy to collaborate closely and take feedback seriously.",
    "",
    "At the same time, we need to distinguish between an edit-level revision and a change in creative or production direction.",
    "",
    "Minor revisions such as text changes, trims, sequencing adjustments, captions and similar edit-level changes can be incorporated within the agreed process.",
    "",
    "Requests that require a fundamentally different concept, format, production setup, new footage or reshoot would need to be discussed separately before being undertaken.",
    "",
    "We would also prefer feedback to be consolidated through one primary point of contact so that the team receives one clear direction rather than multiple overlapping interpretations.",
    "",
    "### 8.13 Delivery and Workflow",
    "",
    "Our preferred workflow is to complete the agreed batch through a planned production cycle rather than repeatedly changing direction between individual videos.",
    "",
    "We can share work for review at agreed checkpoints where useful, particularly during the initial phase of the engagement, but production planning should continue against the agreed batch direction.",
    "",
    "This allows us to maintain the efficiency that makes the pricing and production model viable while still giving the team sufficient visibility into the creative direction.",
    "",
    "### 8.14 Performance Expectations",
    "",
    "We'll always optimize the content for attention, retention, engagement and the intended campaign objective.",
    "",
    "However, {{formatName|our content}} is distributed content and its final performance depends on several factors beyond production, including the platform, audience, account history, media spend, offer and distribution strategy.",
    "",
    "Therefore, we cannot guarantee specific views, virality, reach, engagement, conversions, CAC, ROAS or sales outcomes.",
    "",
    "What we can control is the creative system:",
    "",
    "**Hypothesis → Interaction → Production → Edit → Learn → Improve**",
    "",
    "The objective is to use every batch to understand what resonates and make the next batch stronger.",
    "",
    "### 8.15 Overall Approach",
    "",
    "The learnings we've taken from working across {{pastClients?brands such as $ and other|different}} consumer categories have reinforced one thing for us:",
    "",
    "The strongest {{formatName|}} campaigns don't come from simply asking more questions or making every video look completely different.",
    "",
    "They come from having a clear objective, choosing the right reaction mechanism, creating strong interactions with real people, capturing enough variety on the ground and then building the strongest moments in the edit.",
    "",
    "That's the system we'd like to bring to the Client.",
    "",
    "We're happy to move forward and are genuinely looking forward to seeing what we can create together.",
    "",
    "If the above accurately reflects our discussions and expectations from both sides, please reply with a confirmation so that we can consider this our working alignment and proceed with production planning.",
  ].join('\n');
const TRIAL_LAW = [
    "Both Parties agree to maintain confidentiality over non public information exchanged. Confidentiality obligations survive termination for five years.",
    "",
    "This Agreement shall be governed by the laws of India. Jurisdiction shall lie exclusively with the courts of {{jurisdiction}}.",
    "",
    "This Agreement, including the completed brief, constitutes the entire understanding between the Parties for the trial and supersedes all prior communications on the trial. The pilot engagement will be governed by a separate agreement.",
  ].join('\n');
/** The look of the founder's agreement: plain sans type, headings as typed, no letterhead and no page numbers. */
const TRIAL_STYLE: DocStyle = { letterhead: false, logo: '', heading: 'plain', font: 'sans', size: 'normal', accent: 'ink', page: 'a4', margin: 'normal', footer: '', pageNumbers: false, signLayout: 'side', layout: 'typed' };

export interface ContractTemplate {
  key: string;
  name: string;
  blurb: string;
  doc: ContractDoc;
}

export const CONTRACT_TEMPLATES: readonly ContractTemplate[] = [
  {
    key: 'trial',
    name: 'Trial and pilot',
    blurb: 'A short paid or free trial, a brief the client fills in, then packages for the pilot.',
    doc: {
      title: 'TRIAL ENGAGEMENT AGREEMENT',
      subtitle: 'TRIAL VIDEO, BRIEF AND PILOT ENGAGEMENT TERMS',
      templateKey: 'trial',
      show: { comments: true, download: true },
      currency: 'INR',
      vars: {},
      style: TRIAL_STYLE,
      sections: [
        { id: 'intro', heading: '', kind: 'text', print: true, body: "This Agreement is entered into on the date of acceptance by the Client. It sets out the terms of the trial, the creative brief the Client needs to complete, what happens after the trial, and the pricing for the pilot engagement that follows." },
        text('parties', '1. PARTIES', TRIAL_PARTIES),
        text('purpose', '2. PURPOSE OF THE TRIAL', TRIAL_PURPOSE),
        {
          id: 'brief',
          heading: '3. TRIAL VIDEO BRIEF',
          kind: 'brief',
          body: "Please complete this brief before the shoot. It is the starting point for all creative decisions on the trial.",
          questions: [
            question('objective', 'What is the primary purpose of these videos?', ["Organic content (value/entertainment first)", "Organic content with subtle brand awareness", "Paid ads / Performance marketing"], { heading: '3.1 Objective', multi: true }),
            question('brand', 'How prominently should the brand appear?', ["Minimal (story first)", "Subtle branding throughout", "Product visible throughout", "Product only in intro/outro", "Creator holding product"], { heading: '3.2 Brand Integration' }),
            question('response', 'After watching the video, what should the audience think, feel, or do?', [], { heading: '3.3 Desired Viewer Response', other: false, text: true, answerLabel: 'Client response:' }),
            question('musts', 'What must be included in every video?', ["Product shots", "Logo visible", "Brand mention", "CTA", "People trying the product", "Intro hook/s", "Closing statement/s", "Disclaimer(s)"], { heading: '3.4 Non-Negotiables', multi: true }),
            question('identity', '', [], { heading: '3.5 Brand Guide', intro: 'Please share (or attach) a simple brand guide covering the following:', group: 'Brand Identity', other: false, fields: ["Brand personality (3 to 5 words)", "Positive brand keywords", "Negative brand keywords", "Things to avoid"] }),
            question('editing', '', [], { group: 'Editing and Design Language', other: false, fields: ["Overall editing style (fast-paced, premium, cinematic, documentary, raw UGC, etc.)", "Typography preferences", "Brand colours", "Motion graphics style", "Caption/subtitle style", "Music direction", "Sound effects (minimal, energetic, meme-style, etc.)", "Transition style", "Preferred pacing", "Logo usage guidelines", "Product shot guidelines"] }),
            question('references', 'Please share 3 to 5 examples of videos that best represent the desired creative direction.', [], { group: 'References', other: false, links: { min: 3, max: 5 } }),
          ],
          tail: TRIAL_BRIEF_TAIL,
        },
        text('ownership', '4. TRIAL CONTENT, OWNERSHIP AND USAGE', TRIAL_OWNERSHIP),
        { ...text('after', '5. WHAT HAPPENS AFTER THE TRIAL', TRIAL_AFTER), print: false },
        {
          id: 'packages',
          heading: '6. PACKAGES AND PRICING',
          kind: 'packages',
          // The rows come from the owner's own package table (the business profile) when the agreement is made; the template has none.
          body: 'Pilot engagement packages are priced as follows. All amounts are in {{currencyWords}}.',
          unitName: 'videos',
          packages: [],
          tail: TRIAL_PACKAGES_TAIL,
        },
        text('payment', '7. PAYMENT TERMS', TRIAL_PAYMENT),
        { ...text('how', '8. HOW WE WORK: CREATIVE AND PRODUCTION ALIGNMENT', TRIAL_HOW), print: false },
        text('law', '9. CONFIDENTIALITY AND GOVERNING LAW', TRIAL_LAW),
        { id: 'sign', heading: '10. ACCEPTANCE AND SIGNATURES', kind: 'signatures', body: "By signing below, the Parties confirm that they have read and agreed to the terms of this Agreement." },
      ],
    },
  },
  {
    key: 'retainer',
    name: 'Monthly retainer',
    blurb: 'A set number of pieces and hours each month for a fixed fee, with notice to end.',
    doc: {
      title: 'Content retainer agreement',
      subtitle: 'Monthly content services',
      templateKey: 'retainer',
      show: { comments: true, download: true },
      currency: 'INR',
      vars: {},
      sections: [
        text('parties', '1. Parties', '**Service provider:** {{provider}}, {{providerTitle}}, {{providerBusiness}}\n{{providerAddress}}\nEmail: {{providerEmail}} | Phone: {{providerPhone}}\n\n**Client:** {{client}}\nAddress: {{clientAddress}}\nBrand or brands covered: {{brands}}\nPoint of contact: {{clientContact}}'),
        text('scope', '2. What is included each month', 'The service provider makes the content set out below each month, for the brand or brands named above:\n\n- Pieces a month: {{pieces}}\n- Channels: {{channels}}\n- Hours of work included a month: {{hours}}\n\nAnything beyond this is quoted in writing before it starts. Unused pieces and hours do not carry over unless both parties agree in writing.'),
        {
          id: 'fees',
          heading: '3. Fee',
          kind: 'packages',
          body: 'The monthly fee is below. It is paid in advance, on or before the first day of each month. Fees do not include taxes such as GST.',
          unitName: 'pieces',
          packages: [{ name: 'Monthly retainer', units: 8, feeCents: 0 }],
        },
        text('review', '4. Reviews and revisions', 'Each piece goes to the client\'s point of contact for review. Two rounds of small edit-level changes (text, trims, order, captions) are included for each piece. A new concept, format or new footage is quoted separately. If the client does not reply within five working days, the piece counts as approved.'),
        text('rights', '5. Ownership and use', 'The client gets the right to use each final piece on its own channels once that month\'s fee is paid. The service provider keeps ownership of raw footage, drafts and working files, and may show the finished work in its portfolio unless the client asks in writing that it does not.'),
        text('term', '6. Term and ending', 'This agreement starts on the date of the last signature and runs month to month. Either party can end it with thirty days\' notice in writing. Fees for the month in progress are not refunded. Work already paid for is delivered.'),
        text('law', '7. Confidentiality and law', CONFIDENTIALITY),
        { id: 'sign', heading: '8. Acceptance', kind: 'signatures', body: SIGNATURES },
      ],
    },
  },
  {
    key: 'project',
    name: 'One-off project',
    blurb: 'A fixed piece of work: scope, fee with an advance, revisions and rights on full payment.',
    doc: {
      title: 'Content project agreement',
      subtitle: 'One-off content project',
      templateKey: 'project',
      show: { comments: true, download: true },
      currency: 'INR',
      vars: {},
      sections: [
        text('parties', '1. Parties', '**Service provider:** {{provider}}, {{providerTitle}}, {{providerBusiness}}\n{{providerAddress}}\nEmail: {{providerEmail}} | Phone: {{providerPhone}}\n\n**Client:** {{client}}\nAddress: {{clientAddress}}\nBrand or brands: {{brands}}\nPoint of contact: {{clientContact}}'),
        text('scope', '2. The work', 'The service provider will make the following for the client:\n\n- What: {{projectWhat}}\n- How many: {{pieces}}\n- Where it will be used: {{channels}}\n- Delivery date: {{deliveryDate}}\n\nAny change to this is agreed in writing before it starts.'),
        {
          id: 'fees',
          heading: '3. Fee and payment',
          kind: 'packages',
          body: 'The fee is below. Half is due in advance and the rest on delivery of the final files, unless the parties write down another split. Fees do not include taxes such as GST. If payment is late the service provider may pause work and hold back the final files.',
          unitName: 'pieces',
          packages: [{ name: 'Project fee', units: 1, feeCents: 0 }],
        },
        text('review', '4. Revisions', 'Two rounds of small edit-level changes (text, trims, order, captions) are included. A new concept, a new format or new footage is quoted separately. The client sends feedback once, through one point of contact, in each round.'),
        text('rights', '5. Ownership and use', 'Rights to use the final work pass to the client when the full fee is paid. Until then the service provider keeps all rights. The service provider keeps raw footage and working files and may show the finished work in its portfolio unless the client asks in writing that it does not.'),
        text('law', '6. Ending, confidentiality and law', 'Either party may end this agreement in writing if the other does not meet its duties and does not fix this within seven days of being told. Work done up to that point is paid for.\n\n' + CONFIDENTIALITY),
        { id: 'sign', heading: '7. Acceptance', kind: 'signatures', body: SIGNATURES },
      ],
    },
  },
];
export const CONTRACT_TEMPLATE_BY_KEY: Record<string, ContractTemplate> = byKey(CONTRACT_TEMPLATES.map((t) => [t.key, t]));

const BLANK = '__________';
/** The line a typed agreement leaves for the client to write on by hand, as the paper does. */
const WRITE_ON = '____________________________________';
/** On a typed agreement the client's own details, while they are empty, are lines to write on (the paper's way), not left out. */
export function writeOnKeys(doc: Pick<ContractDoc, 'style'>): ReadonlySet<string> | undefined {
  return parseDocStyle(doc.style).layout === 'typed' ? new Set(CONTRACT_VARS.filter((v) => v.from !== 'profile' && !('optional' in v && v.optional)).map((v) => v.key)) : undefined;
}
/** Who reads the filled words: the owner (who also gets one notice of what is missing, `contractGapNote`) or the client. */
export type DocAudience = 'owner' | 'client';
const GONE = '\u0000';
/** A line that, once its missing words are gone, is only a label ("Email:", "**Client:**", "Point of contact: (authorised ...)"). */
const LABEL_ONLY = /^\s*(?:[-*]\s+)?(?:\*\*)?[^:]{0,80}?:(?:\*\*)?\s*(?:\([^)]*\))?\s*[.,;]?\s*$/;
function tidyPart(p: string): string | null {
  if (!p.includes(GONE)) return p;
  const s = p
    .replace(/\u0000/g, '')
    .replace(/,(\s*,)+/g, ',')
    .replace(/:(\*\*)?\s*,\s*/g, ':$1 ')
    .replace(/\s*,\s*(?=$|\()/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trimEnd();
  if (!s.trim() || LABEL_ONLY.test(s) || /^\s*(?:[-*]\s*)?[,.;|\s]*$/.test(s)) return null;
  return s;
}
/**
 * Fills {{name}} from the variables. Without an audience a missing one is a blank line to write on (the old behaviour, kept for the
 * editor's one-line previews). With one, a missing value never shows as underscores: its words go, and a line left holding only a label
 * ("Phone:") goes with them, so the client reads a clean page and the owner reads the same page plus one notice of what to add.
 */
/**
 * The "either" forms, resolved before anything else: {{key|fallback}} is the value, or the fallback words when it is empty, and
 * {{key?words with $|fallback}} is the words with the value in place of $, or the fallback. They keep a sentence in its own shape when a
 * profile field is empty ("{{brandName?$ owns|Our team owns}} the creative execution."), so nothing is invented and nothing is left blank.
 * An empty result takes one space before it with it, so "the {{formatName|}} format" reads "the format".
 */
const EITHER = /( ?)\{\{(\w+)(?:\?([^|{}]*))?\|([^{}]*)\}\}/g;
function resolveEither(body: string, vars: Record<string, string>): string {
  return body.replace(EITHER, (_m, space: string, k: string, when: string | undefined, fallback: string) => {
    const v = (vars[k] ?? '').trim();
    const out = v ? (when === undefined ? v : when.split('$').join(v)) : fallback;
    return out ? `${space}${out}` : '';
  });
}
/** A "### " subhead left with nothing under it before the next subhead or the end (its words were all missing) goes too. */
function dropBareSubheads(text: string): string {
  const lines = text.split('\n');
  const keep = lines.filter((l, i) => {
    if (!/^###\s/.test(l)) return true;
    const next = lines.slice(i + 1).find((x) => x.trim());
    return next !== undefined && !/^###\s/.test(next);
  });
  return keep.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
/**
 * Fills {{name}} from the variables. Without an audience a missing one is a blank line to write on (the old behaviour, kept for the
 * editor's one-line previews). With one, a missing value never shows as underscores: its words go, and a line left holding only a label
 * ("Phone:") goes with them, so the client reads a clean page and the owner reads the same page plus one notice of what to add.
 */
export function fillContractText(body: string, vars: Record<string, string>, audience?: DocAudience, writeOn?: ReadonlySet<string>): string {
  const has = (k: string) => Boolean(vars[k] && vars[k]!.trim());
  const either = resolveEither(body, vars);
  if (!audience) return either.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => (has(k) ? vars[k]!.trim() : BLANK));
  // `writeOn` names the blanks a typed agreement keeps as a line to write on (the client's name and address, as the paper has them).
  const raw = either.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => (has(k) ? vars[k]!.trim() : writeOn?.has(k) ? WRITE_ON : GONE));
  if (!raw.includes(GONE)) return raw;
  return dropBareSubheads(
    raw
      .split('\n')
      .map((line) => {
        if (!line.includes(GONE)) return line;
        const parts = line.split(' | ').map(tidyPart).filter((x): x is string => x !== null);
        return parts.length ? parts.join(' | ') : null;
      })
      .filter((l): l is string => l !== null)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n'),
  );
}

/** Every variable a document names (in its sections and its brief) that has no value yet, once each, in the order of CONTRACT_VARS. */
export function contractGaps(doc: Pick<ContractDoc, 'sections' | 'vars'>): { key: string; label: string; from: 'profile' | 'client' | 'typed' }[] {
  const named = new Set<string>();
  const scan = (t: string | undefined) => {
    for (const m of (t ?? '').matchAll(/\{\{(\w+)\}\}/g)) named.add(m[1]!);
  };
  for (const s of doc.sections) {
    scan(s.body);
    scan(s.tail);
    for (const q of s.questions ?? []) scan(q.label);
  }
  // A line that is fine without its value (a second email) is never a gap.
  return CONTRACT_VARS.filter((v) => !('optional' in v && v.optional) && named.has(v.key) && !(doc.vars[v.key] ?? '').trim()).map((v) => ({ key: v.key, label: v.label, from: v.from }));
}

/** The one owner-only notice a document carries in place of blanks: what is missing and where it is added once. Null when nothing is. */
export function contractGapNote(doc: Pick<ContractDoc, 'sections' | 'vars'>): string | null {
  const gaps = contractGaps(doc);
  // A price table with no rows is the owner's package table not set yet; the client's copy leaves the empty table out.
  const noPackages = doc.sections.some((s) => s.kind === 'packages' && !(s.packages ?? []).length);
  if (!gaps.length && !noPackages) return null;
  // "Client address" reads as the client's address, "Client" as the client's name.
  const of = (from: string) => gaps.filter((g) => g.from === from).map((g) => (g.label === 'Client' ? 'name' : g.label.replace(/^(Your|Client's|Client) /, '').toLowerCase()));
  const parts = [
    noPackages ? 'Your packages are not set: add them once in Settings.' : '',
    of('profile').length ? `Your business details are not set (${of('profile').join(', ')}): add them once in Settings.` : '',
    of('client').length ? `The client's ${of('client').join(', ')} ${of('client').length === 1 ? 'is' : 'are'} not set: add ${of('client').length === 1 ? 'it' : 'them'} once on the client's page.` : '',
    of('typed').length ? `Still to fill in: ${of('typed').join(', ')}.` : '',
  ].filter(Boolean);
  return `${parts.join(' ')} Your client does not see this note, and the empty lines are left out of their copy.`;
}

/** Where a variable is kept: the business profile (every paper), the client's record (every paper of theirs), or this document only. */
export type ContractVarFrom = (typeof CONTRACT_VARS)[number]['from'];
/**
 * Every variable a document's words name, the plain {{key}} and the either forms alike, once each, in the order they first appear; a
 * signature block names your name and designation. The currency in words is worked out from the document, so it is never asked for.
 */
export function contractVarsUsed(doc: Pick<ContractDoc, 'sections'>): string[] {
  const words = doc.sections.map((s) => [s.heading, s.body, ...(s.questions ?? []).map((q) => `${q.heading} ${q.intro} ${q.label}`), s.tail, s.kind === 'signatures' ? '{{provider}} {{providerDesignation}}' : ''].join(' ')).join(' ');
  const out = [...words.matchAll(/\{\{(\w+)[?|}]/g)].map((m) => m[1]!);
  return [...new Set(out)].filter((k) => k !== 'currencyWords' && CONTRACT_VARS.some((v) => v.key === k));
}
/** The same, grouped by where each is kept (profile, client, this document), each group in the order its words appear. */
export function contractVarGroups(doc: Pick<ContractDoc, 'sections'>): { from: ContractVarFrom; vars: { key: string; label: string; optional: boolean }[] }[] {
  const used = contractVarsUsed(doc).map((k) => CONTRACT_VARS.find((v) => v.key === k)!);
  return (['profile', 'client', 'typed'] as const).map((from) => ({ from, vars: used.filter((v) => v.from === from).map((v) => ({ key: v.key, label: v.label, optional: 'optional' in v })) })).filter((g) => g.vars.length);
}

/** What a client's record gives a document, beyond its name, address and contact. Every part is optional. */
export interface ContractClientFacts {
  name: string;
  address: string;
  contactName: string;
  /** The point of contact's designation, and the brand or brands for the work, when the client gave them (onboarding). */
  contactTitle?: string;
  brands?: string;
  channels?: string[];
  piecesPerMonth?: number;
  hoursPerMonth?: number;
  revisionsPerPiece?: number;
  retainerCents?: number;
  currency?: string;
}

/** The variables a new contract starts with, from the person's profile and the client's details. */
export function contractVarsFor(profile: BusinessProfile, client: ContractClientFacts | null): Record<string, string> {
  const n = (v: number | undefined) => (typeof v === 'number' && v > 0 ? String(v) : '');
  const t = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const emails = (profile.emails ?? []).map(t).filter(Boolean);
  const phones = (profile.phones ?? []).map(t).filter(Boolean);
  const currency = client?.currency || 'INR';
  return {
    provider: profile.signerName,
    providerTitle: profile.signerTitle,
    providerBusiness: t(profile.businessName) || profile.from.name,
    providerAddress: t(profile.businessAddress) || profile.from.address,
    providerEmail: emails[0] ?? profile.from.email,
    providerEmail2: emails[1] ?? '',
    providerPhone: phones[0] ?? profile.from.phone,
    providerPhones: (phones.length ? phones : [profile.from.phone.trim()]).filter(Boolean).join(' | '),
    providerBrand: t(profile.operatingUnder) || t(profile.brandName),
    // "Founder, <brand>" in the signature block, as the agreement signs it.
    // A designation typed whole ("Founder, Northlight Studio", as the settings field suggests) is kept as typed; a bare title gets the brand.
    providerDesignation: profile.signerTitle.includes(',') ? profile.signerTitle.trim() : [profile.signerTitle.trim(), t(profile.brandName)].filter(Boolean).join(', '),
    brandName: t(profile.brandName),
    formatName: t(profile.formatName),
    formatNameInline: t(profile.formatNameInline) || t(profile.formatName),
    pastClients: t(profile.pastClients),
    currencyWords: CURRENCY_WORDS[currency] ?? currency,
    client: client?.name ?? '',
    clientAddress: client?.address ?? '',
    clientContact: client?.contactName ?? '',
    clientTitle: client?.contactTitle ?? '',
    brands: client?.brands?.trim() || client?.name || '',
    jurisdiction: profile.jurisdiction,
    pieces: n(client?.piecesPerMonth),
    channels: (client?.channels ?? []).filter(Boolean).join(', '),
    hours: n(client?.hoursPerMonth),
    revisions: typeof client?.revisionsPerPiece === 'number' ? String(client.revisionsPerPiece) : '',
    monthlyFee: client?.retainerCents && client.retainerCents > 0 ? money(client.retainerCents, client.currency || 'INR') : '',
  };
}

/** The packages section a new agreement takes from the owner's own package table, when the template brings none of its own. */
export function withProfilePackages(sections: ContractSection[], profile: Pick<BusinessProfile, 'packages'>): ContractSection[] {
  const pk = profile.packages;
  if (!pk || !pk.rows.length) return sections;
  return sections.map((s) =>
    s.kind === 'packages' && !(s.packages ?? []).length
      ? { ...s, packages: pk.rows.map((r) => ({ ...r })), extra: pk.block.units > 0 ? { ...pk.block } : undefined, unitName: (pk.unit || s.unitName || 'videos').toLowerCase() }
      : s,
  );
}

/**
 * Everything a document's words are filled from: its own variables, plus what is worked out from the document itself: the currency in
 * words and the worked example under the price table (the agreement's 6.1), so a fee changed in the table changes the example with it.
 */
export function docVars(doc: Pick<ContractDoc, 'vars' | 'sections' | 'currency'>): Record<string, string> {
  const pk = doc.sections.find((s) => s.kind === 'packages' && (s.packages ?? []).length);
  const example = pk ? packageExampleLine({ unit: pk.unitName || 'videos', rows: pk.packages ?? [], block: pk.extra ?? { units: 0, feeCents: 0 } }, doc.currency) : '';
  return { ...doc.vars, currencyWords: (doc.vars.currencyWords ?? '').trim() || (CURRENCY_WORDS[doc.currency] ?? doc.currency), packageExample: example };
}

/** What each package costs a unit, in whole cents, and the price of n units counting blocks past the largest package. */
export function packageRate(p: ContractPackage): number {
  return p.units > 0 ? Math.round(p.feeCents / p.units) : 0;
}
export function priceForUnits(packages: readonly ContractPackage[], extra: { units: number; feeCents: number } | undefined, units: number): number | null {
  const sorted = [...packages].filter((p) => p.units > 0).sort((a, b) => a.units - b.units);
  const exact = sorted.find((p) => p.units === units);
  if (exact) return exact.feeCents;
  const top = sorted[sorted.length - 1];
  if (!top || !extra || extra.units <= 0 || units < top.units) return null;
  const blocks = (units - top.units) / extra.units;
  return Number.isInteger(blocks) ? top.feeCents + blocks * extra.feeCents : null;
}

export function parseContractDoc(v: unknown): ContractDoc | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const sections = Array.isArray(o.sections) ? o.sections : [];
  const kinds: readonly ContractSectionKind[] = ['text', 'packages', 'brief', 'signatures'];
  const seen = new Set<string>();
  const clean: ContractSection[] = [];
  sections.slice(0, MAX_CONTRACT_SECTIONS).forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return;
    const s = raw as Record<string, unknown>;
    let id = cleanText(s.id, 30).replace(/[^a-zA-Z0-9_-]/g, '') || uid('s', i);
    while (seen.has(id)) id = `${id}x`;
    seen.add(id);
    const kind = oneOfList(s.kind, kinds, 'text');
    const section: ContractSection = { id, heading: cleanText(s.heading, 120), kind, body: cleanText(s.body, CONTRACT_TEXT_MAX) };
    if (typeof s.print === 'boolean') section.print = s.print;
    const tail = cleanText(s.tail, CONTRACT_TEXT_MAX);
    if (tail && kind !== 'text') section.tail = tail;
    if (kind === 'packages') {
      const ps = Array.isArray(s.packages) ? s.packages : [];
      section.packages = ps
        .slice(0, 8)
        .map((p) => (p && typeof p === 'object' ? (p as Record<string, unknown>) : {}))
        .map((p) => ({ name: cleanText(p.name, 60), units: Math.max(0, Math.min(10000, Math.round(Number(p.units)) || 0)), feeCents: Math.max(0, Math.min(1_000_000_000_00, Math.round(Number(p.feeCents)) || 0)) }))
        .filter((p) => p.name);
      const e = s.extra && typeof s.extra === 'object' ? (s.extra as Record<string, unknown>) : null;
      if (e) section.extra = { units: Math.max(0, Math.min(10000, Math.round(Number(e.units)) || 0)), feeCents: Math.max(0, Math.min(1_000_000_000_00, Math.round(Number(e.feeCents)) || 0)) };
      section.unitName = cleanText(s.unitName, 20) || 'pieces';
    }
    if (kind === 'brief') {
      const qs = Array.isArray(s.questions) ? s.questions : [];
      const qseen = new Set<string>();
      section.questions = qs
        .slice(0, MAX_CONTRACT_QUESTIONS)
        .map((q, j): ContractQuestion => {
          const x = (q && typeof q === 'object' ? q : {}) as Record<string, unknown>;
          let qid = cleanText(x.id, 30).replace(/[^a-zA-Z0-9_-]/g, '') || uid('q', j);
          while (qseen.has(qid)) qid = `${qid}x`;
          qseen.add(qid);
          const out: ContractQuestion = { id: qid, label: cleanText(x.label, 400), options: (Array.isArray(x.options) ? x.options : []).map((t) => cleanText(t, 120)).filter(Boolean).slice(0, 12), multi: x.multi === true, other: x.other === true, text: x.text === true };
          const heading = cleanText(x.heading, 120);
          const intro = cleanText(x.intro, 400);
          const group = cleanText(x.group, 120);
          const answerLabel = cleanText(x.answerLabel, 60);
          const fields = (Array.isArray(x.fields) ? x.fields : []).map((t) => cleanText(t, 160)).filter(Boolean).slice(0, MAX_CONTRACT_FIELDS);
          if (heading) out.heading = heading;
          if (intro) out.intro = intro;
          if (group) out.group = group;
          if (answerLabel) out.answerLabel = answerLabel;
          if (fields.length) out.fields = [...new Set(fields)];
          const l = x.links && typeof x.links === 'object' ? (x.links as Record<string, unknown>) : null;
          if (l) {
            const max = Math.max(1, Math.min(MAX_CONTRACT_LINKS, Math.round(Number(l.max)) || 5));
            out.links = { min: Math.max(0, Math.min(max, Math.round(Number(l.min)) || 0)), max };
          }
          return out;
        })
        .filter((q) => q.label || q.heading || q.group || (q.fields ?? []).length);
    }
    clean.push(section);
  });
  const vars: Record<string, string> = {};
  const rawVars = o.vars && typeof o.vars === 'object' ? (o.vars as Record<string, unknown>) : {};
  for (const d of CONTRACT_VARS) vars[d.key] = cleanText(rawVars[d.key], 300);
  return { title: cleanText(o.title, 120) || 'Agreement', subtitle: cleanText(o.subtitle, 160), templateKey: cleanText(o.templateKey, 30) || 'custom', show: { comments: (o.show as Record<string, unknown> | undefined)?.comments !== false, download: (o.show as Record<string, unknown> | undefined)?.download !== false }, currency: cleanText(o.currency, 3).toUpperCase() || 'INR', vars, sections: clean, style: parseDocStyle(o.style) };
}

export interface AgencyContract {
  id: string;
  clientId: string | null;
  clientName: string;
  status: ContractStatus;
  doc: ContractDoc;
  /** The client link is /k/<token> once it is sent. */
  token: string | null;
  sentAt: string | null;
  signedAt: string | null;
  revisedAt: string | null;
  acceptance: { name: string; title: string; at: string } | null;
  answers: Record<string, ContractAnswer>;
  createdAt: string;
  updatedAt: string;
}
export interface ContractListItem {
  id: string;
  clientId: string | null;
  clientName: string;
  title: string;
  templateKey: string;
  status: ContractStatus;
  sentAt: string | null;
  signedAt: string | null;
  updatedAt: string;
}
/** What a client sees at their contract link. */
export interface PublicContract {
  /** The reference printed on the page, such as AGR-1A2B3C. */
  ref: string;
  sentAt: string | null;
  ownerName: string;
  status: ContractStatus;
  revisedAt: string | null;
  comments: DocComment[];
  doc: ContractDoc;
  answers: Record<string, ContractAnswer>;
  acceptance: { name: string; title: string; at: string } | null;
}

// ---------------------------------------------------------------------------
// Templates: built-in starting points, and the person's own
// ---------------------------------------------------------------------------

/** The kinds of paper a template can be made from (and a house template can be): an invoice, an agreement or another document. */
export const DOC_TEMPLATE_KINDS = ['invoice', 'contract', 'doc'] as const;
export type DocTemplateKind = (typeof DOC_TEMPLATE_KINDS)[number];
/** Every kind of own template: the three kinds of paper, and an email note the owner wrote and kept (`email`, plain subject and words). */
export const TEMPLATE_KINDS = [...DOC_TEMPLATE_KINDS, 'email'] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];
/** Up to this many of their own, for each kind. */
export const MAX_TEMPLATES = 30;
export const TEMPLATE_NAME_MAX = 60;

/** A person's own template, as the screen reads it. */
export interface AgencyTemplate {
  id: string;
  /** Your own, or a house template the team made for everyone (read only, copied into your documents). */
  scope: 'own' | 'house';
  kind: TemplateKind;
  name: string;
  /** One plain line on what is in it: "3 lines, GST 18%" or "9 sections". */
  summary: string;
  /** Only on an email note: the subject and the words it keeps. */
  email?: { subject: string; message: string };
  createdAt: string;
  updatedAt: string;
}

/** Built-in starting points for an invoice. A person's own saved ones sit beside them. */
export const INVOICE_STARTERS: readonly { key: string; name: string; blurb: string; title: string; footnote: string; items: InvoiceItem[] }[] = [
  { key: 'standard', name: 'Standard invoice', blurb: 'One line to fill in.', title: 'Invoice', footnote: '', items: [{ description: 'Services', quantity: 1, unitCents: 0 }] },
  {
    key: 'advance',
    name: 'Advance Invoice',
    blurb: 'Paid before the work starts, with a line on TDS.',
    title: 'Advance Invoice',
    footnote: tdsGrossupNote(0),
    items: [{ description: 'Package', quantity: 1, unitCents: 0 }],
  },
  { key: 'retainer', name: 'Monthly retainer', blurb: 'A fixed fee for the month.', title: 'Invoice', footnote: '', items: [{ description: 'Monthly retainer', quantity: 1, unitCents: 0 }] },
  { key: 'per-piece', name: 'Per piece', blurb: 'A price for each deliverable, and how many.', title: 'Invoice', footnote: '', items: [{ description: 'Videos', quantity: 5, unitCents: 0 }] },
];
export const INVOICE_STARTER_BY_KEY: Record<string, (typeof INVOICE_STARTERS)[number]> = byKey(INVOICE_STARTERS.map((t) => [t.key, t]));

/** What an invoice keeps when it becomes a template: everything but who it is billed to. */
export function invoiceTemplateDoc(doc: InvoiceDoc): InvoiceDoc {
  return { ...doc, to: emptyParty() };
}
/** What an agreement keeps when it becomes a template: the sections, not the names filled in. */
export function contractTemplateDoc(doc: ContractDoc): ContractDoc {
  return { ...doc, vars: {} };
}
export function templateSummary(kind: DocTemplateKind, doc: InvoiceDoc | ContractDoc, items: readonly InvoiceItem[]): string {
  if (kind === 'invoice') {
    const d = doc as InvoiceDoc;
    const bits = [`${items.length} ${items.length === 1 ? 'line' : 'lines'}`];
    if (d.gstBps > 0) bits.push(`GST ${d.gstBps / 100}%`);
    if (d.tdsBps > 0 && d.tdsMode !== 'none') bits.push(`TDS ${d.tdsBps / 100}%`);
    return bits.join(', ');
  }
  const n = (doc as ContractDoc).sections.length;
  return `${n} ${n === 1 ? 'section' : 'sections'}`;
}
