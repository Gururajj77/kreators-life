import { AFFILIATE_SHARE, CONSENT_PURPOSES, LEGAL_VERSION, MIN_AGE, PAID_PLANS, PAYMENTS_LIVE, PLAN_DAYS, PLANS, RETENTION } from '@kreators/shared';
import { A, Bullets, Fact, Grid, H, LegalPage, Mail, P, Strong, contactEmail, useBusiness, versionDate } from './legalBits';

type Kind = 'terms' | 'privacy' | 'refunds' | 'contact' | 'pricing';

const VERSION_LINE = `Version ${LEGAL_VERSION}, in force from ${versionDate()}. Earlier versions are available if you write to the contact address.`;

const TITLES: Record<Kind, { title: string; lede: string }> = {
  terms: { title: 'Terms of use', lede: `The plain-language rules for using kreators.app. ${VERSION_LINE}` },
  privacy: { title: 'Privacy', lede: `What we keep, why, who sees it, and how to take it with you or delete it. ${VERSION_LINE}` },
  refunds: { title: 'Refunds and cancellations', lede: 'How money and points move back when something does not work out.' },
  contact: { title: 'Contact', lede: 'A person answers. Support tickets inside the app are fastest.' },
  pricing: { title: 'Pricing', lede: 'Free to start, free to stay. A fee when you sell, and a plan if you want the assistant to type for you.' },
};

/** Why we handle each kind of data, and the legal ground for it, in plain words. */
const BASES: [string, string, string][] = [
  ['Running your account and the app: profile, pillars, tasks, logs, trackers, circles, events, Agency', 'You asked us for the service, and this is how it works.', 'Contract'],
  ['Your date of birth and phone number', 'To keep anyone under eighteen out, and to reach you about your account.', 'Legitimate interests, and the law where it sets an age'],
  ['Orders, bookings, payouts, invoices and money records', 'To take payment, pay creators and keep the books.', 'Contract, and legal duty for the records'],
  ['Emails you need: receipts, password resets, payout notices', 'To do what you asked.', 'Contract'],
  ['Sign-in sessions, device limit, rate limits and the app log', 'To keep accounts safe, stop abuse and find faults.', 'Legitimate interests'],
  ['The assistant and the writing in Content, when you use them', 'To do the job you typed. Only what the job needs is sent.', 'Contract'],
  ['Click counts on tracked links (an address hash, never the address)', 'So a creator can see which link worked.', 'Legitimate interests'],
  ['The tracked-link cookie, videos from YouTube and Vimeo, and news and offers by email', 'These are your choices, and none is needed to use the app.', 'Consent'],
  ['Your public page, leaderboard place and coach sharing', 'Only what you switch on is shown.', 'Your choice, which you can withdraw'],
];

/** Policy and information pages the payment provider and the app stores ask for before launch. */
export function Policy({ kind }: { kind: Kind }) {
  const t = TITLES[kind];
  const { business, loading } = useBusiness();
  const email = contactEmail(business);
  return (
    <LegalPage title={t.title} lede={t.lede} wide={kind === 'pricing'}>
      {kind === 'terms' && (
        <>
          <H>What kreators.app is</H>
          <P>A daily game for the seven relationships of a life, with tools for people who make things: learning, paid work, brand campaigns, content rewards, client work with invoices and agreements, events, run clubs, a shop, finance and meetups.</P>
          <H>Who may use it</H>
          <P>You need to be {MIN_AGE} or older. Sign-up asks for your date of birth and a phone number, and an account for anyone younger is refused. If we learn that an account belongs to someone under {MIN_AGE}, we close it.</P>
          <H>Your account</H>
          <P>You start with a session on your device and may add an email. Keep your password private. You are responsible for what happens under your account, and one person has one account. You can end your account at any time from You, Account: it deletes your personal details and your logs at once, and money records stay without your name, as the law asks.</P>
          <H>Your content and the licence you give us</H>
          <P>What you write, upload or post stays yours. To run the service, you give us a licence to store it, show it to the people you chose, copy it as the system needs and, where you put it on a public page, display it there. The licence is only for running kreators.app, it is not exclusive, and it ends when you delete the content or your account, except for copies that other people already made by sharing it. We do not use what you write to train AI models.</P>
          <H>Who owns what the app helps you make</H>
          <P>You do. That includes text that the assistant or the writing tool drafts for you. In some countries a text made by a machine may not be protected by copyright, so check before you rely on that. You are responsible for checking a draft before you use it.</P>
          <H>Points, rewards and money</H>
          <P>Points are earned by showing up and can be spent inside kreators.app. They are not money, cannot be cashed out, and have no value outside the app. Content rewards are paid in points after a reviewer confirms views; the pool and the rules on each reward are the whole deal. Money paid to creators through the shop goes through a payment provider under its own terms.</P>
          <H>Pricing and billing</H>
          <P>
            Play is free. When you sell through the shop, the fee is 5% of each sale. A plan for the assistant ({PAID_PLANS.map((k) => `${PLANS[k].name} US$${PLANS[k].priceCents / 100}`).join(', ')}) lasts {PLAN_DAYS} days and does not renew by itself. When it ends, you pick again if you want one. The price shown is the price charged, and any tax is shown before you pay. See <A to="/pricing">Pricing</A>.
          </P>
          <H>Refunds</H>
          <P>
            How refunds work, including your right to change your mind if you live in the EU or the UK, is on the <A to="/refunds">refunds page</A>.
          </P>
          <H>What you make and sell</H>
          <P>You keep the rights to what you make. By selling through the shop you promise it is yours to sell, is not unlawful or hateful, and does not promise financial returns. Brands and creators agree usage rights on each campaign in writing before anything is produced.</P>
          <H>Invoices and agreements</H>
          <P>Agency lets you make invoices and agreements for your own clients. They are your documents, not ours, and you are responsible for what is in them and for the tax on them. The agreement templates are a starting point, not legal advice: have a lawyer read one before you rely on it. When a client types their name to accept, that is typed acceptance, not a certified electronic signature. We take no part of what you invoice.</P>
          <H>Acceptable use</H>
          <P>No farming points, no fake views, no scraping, no impersonation, no posting what you do not have the right to post, no harassing people and no breaking the law. If these rules are broken we may remove content, hold payouts for review, or close the account, and we tell you why. If you think we got it wrong, write to the team through Help inside the app and a person will look again.</P>
          <H>Copyright</H>
          <P>
            If you think something here copies your work, or we took down something of yours by mistake, see the <A to="/copyright">copyright page</A>.
          </P>
          <H>Our limits</H>
          <P>kreators.app is provided as it is. We are not liable for indirect loss, for what other members do, or for a provider's outage. Where the law allows it, our liability is limited to what you paid us in the last three months. Nothing in these terms takes away rights you have by law, and nothing limits our liability for death, personal injury, fraud or anything else the law does not let us limit.</P>
          <H>Changes</H>
          <P>When we change these terms we give the new text a new version number and date, show a notice in the app once, and keep the old text available on request. The new terms apply from the date shown on them. If you do not agree, you can delete your account.</P>
          <H>A draft for review</H>
          <P>These terms are a plain-language draft. A lawyer still has to review them for each country where kreators.app is offered, and they may change after that review.</P>
        </>
      )}

      {kind === 'privacy' && (
        <>
          <H>Who we are</H>
          {business?.name ? (
            <P>
              kreators.app is run by <Strong>{business.name}</Strong>
              {business.address ? `, ${business.address.replace(/\n+/g, ', ')}` : ''}. We decide why and how your personal data is used. For anything about your data, write to <Mail address={email} />, which is also our privacy contact.
            </P>
          ) : (
            <P>
              {loading ? 'Loading the business details.' : 'The business that runs kreators.app is being set up, and its legal name and address will be listed on the contact page.'} Until then, for anything about your data, write to <Mail address={email} />, which is also our privacy contact.
            </P>
          )}
          <H>What we keep</H>
          <P>Your profile (name, page name, bio, skills, interests, city), your date of birth and phone number, your pillars and daily logs, wellbeing and journal entries, orders, bookings, finance entries, the clients, deliverables, time, invoices and agreements you keep in Agency, the reviews you write and plan, messages in circles, and the events your device sends while you use the app.</P>
          <H>Why we use it, and on what ground</H>
          <P>Privacy law asks us to name a ground for each use. These are ours.</P>
          <Grid label="Why we use your data" head={['What', 'Why', 'Ground']} rows={BASES.map(([a, b, c]) => [a, b, c])} />
          <H>Who sees what</H>
          <P>Your journal and wellbeing numbers are never shown to brands, staff, the leaderboard or Club selection. Your public page shows only what you put on it. Staff see what their permission covers. A circle sees your alias until you choose to reveal.</P>
          <P>Your Discover answers and results are private to you. They never reach brands, staff, the leaderboard or a life coach. You choose whether they shape your next steps on Home (plain rules, no AI, on until you switch it off), and whether the assistant may read a short summary of them (off until you switch it on, and only a model that keeps no data can read it). You can delete a result at any time.</P>
          <H>Who gets it</H>
          <P>
            We use a few companies to run the service, such as our hosting, email and payment providers. Each one is listed, with what it does, what data it gets and where, on the <A to="/subprocessors">subprocessors page</A>. They act on our instructions. We do not give your data to anyone else, except when the law makes us or when you ask us to, for example when you share a page.
          </P>
          <H>Transfers to other countries</H>
          <P>The companies on that page work in other countries, including the United States and India. When your data leaves your country, we rely on contract terms with them, such as the EU standard contractual clauses where the law asks for them. We do not claim any certification, for ourselves or for them.</P>
          <H>How long we keep it</H>
          <P>This is how long we keep each kind of thing. A daily tidy-up removes what has expired.</P>
          <Grid label="How long we keep each kind of data" head={['What', 'How long', 'Why']} rows={RETENTION.map((r) => [r.category, r.keep, r.why])} />
          <H>Your rights</H>
          <P>You can ask to see what we hold, have it corrected, have it deleted, take a copy that a computer can read, object to a use that rests on our legitimate interests, or take back a consent. You can also complain to your data protection authority.</P>
          <Bullets
            items={[
              <>Export everything as one file, or delete your account: You, Account.</>,
              <>Change your three optional choices (below): Profile, Privacy choices.</>,
              <>Anything else: the <A to="/contact">contact page</A>, or Help inside the app. We reply within one month.</>,
            ]}
          />
          <P>Deleting removes your personal details and your logs. Money records stay without your name for the years the law asks, as the table shows.</P>
          <H>Your three choices</H>
          <P>The app asks you once, and you can change each answer at any time under Profile, Privacy choices. Nothing here is needed to use the app, and the answer starts as no.</P>
          <Bullets
            items={CONSENT_PURPOSES.map((p) => (
              <>
                <Strong>{p.name}.</Strong> {p.line}
              </>
            ))}
          />
          <H>Cookies and storage</H>
          <P>We set one optional cookie, called kl_click, when you follow a tracked link. It lasts thirty days and tells the creator which link brought you. In the EU, the rest of the EEA, the UK and Switzerland we set it only after your yes. Everywhere, it stays off if you say no or if your browser sends Global Privacy Control.</P>
          <P>Your sign-in session, your theme and your privacy choices are kept on your device, because the app cannot work without them. There are no third-party advertising trackers.</P>
          <H>Do Not Track and Global Privacy Control</H>
          <P>We honour Global Privacy Control as a no to the link cookie. We do not follow you across other sites, so a Do Not Track signal changes nothing about how we treat you.</P>
          <H>Selling and sharing</H>
          <P>We do not sell your personal information, and we do not share it for advertising on other sites.</P>
          <H>Automated decisions</H>
          <P>We make no decision about you by machine that has a legal effect or a similar big one. The assistant, Discover and the daily brief only give suggestions. Some rules run by themselves, such as points limits and sign-in limits. If one gets something wrong, write to us and a person will look again.</P>
          <H>Children</H>
          <P>kreators.app is for people aged {MIN_AGE} and over. If we learn that an account belongs to someone under {MIN_AGE}, we delete it.</P>
          <H>AI</H>
          <P>We never use what you write to train AI models. Companies that run the assistant or the writing tool get only what the job needs. The assistant tells you which models keep data. Free models may keep what is sent to them, so they never receive your journal or your trackers.</P>
          <H>Security</H>
          <P>Passwords are stored as salted hashes, never as text. Connections use HTTPS. Staff powers are limited by role, and changes to roles are logged. No system is perfectly safe, so we cannot promise that nothing will go wrong. If a breach puts your data at risk, we will tell you and the authority where the law asks.</P>
          <H>California notice at collection</H>
          <P>We collect identifiers, account details, content you add, order records and use of the app, for the reasons in the table above. We do not sell or share personal information, and you can ask to know, correct or delete what we hold, as described under Your rights.</P>
          <H>Agency and your clients</H>
          <P>What you keep about your clients is yours, and only you see it. You decide what to do with it, and we process it for you. A client sees only the page you share with them, and only the parts you switch on. Their page never carries your fees, your private notes, your time line by line or your other clients, whatever you switch on. A client can type a comment, an answer to a brief and their name to accept; those are kept with that invoice or agreement and shown to you. An invoice or an agreement opens only from its own long link, which a fresh link replaces. Your bank and tax details live on your own account and appear only on an invoice you choose to send, where you can switch them off. If you delete your account, your clients and agreements go, and an invoice stays for the books with its totals, but not who it was for, its lines, your bank details or its link. Business metrics in Reviews are for your eyes only.</P>
          <H>The calendar link</H>
          <P>If you switch on the private calendar link, anyone with that address can read the title, pillar and priority of your open tasks that have a day, and the reviews you planned, with their times. It never carries notes, your journal, your mood or anything from a tracker. It only shows your tasks; nothing changes them from a calendar. Make a fresh link or switch it off and the old address stops at once.</P>
          <H>Life coaches</H>
          <P>A life coach is someone our team chose. A coach sees nothing of yours until you say yes, and then only the parts you switch on: daily check-ins and tasks, your pillars, your routine and contract, your life map answers, and your wellbeing numbers and saved reviews. A coach never sees your journal, the notes you add to your trackers, your money or your Companion chats. You can switch a part off or end the coaching at any time, from your Profile tab, and the coach loses sight of it at once. Every ask, note and task a coach adds is kept in a change log you can read. It all comes with your export and goes with your account.</P>
          <H>Position</H>
          <P>If you share your position for nearby matching it is rounded, stored on the server only, used to keep tables within twenty kilometres, and never shown to anyone.</P>
          <H>Payments and KYC</H>
          <P>Card and bank details go to the payment provider, not to us. For payouts we keep your legal name, the last four digits of your PAN and bank account, your IFSC and address.</P>
          <H>The content strategist</H>
          <P>Content keeps a folder per brand: the links you add, what research brought back from them, and the pieces written from that. When a writing model is connected, that folder's research and your brief go to Anthropic to be written up, and nothing else about you goes with it: never your journal, your wellbeing logs or your customers. Research goes out through Agent Reach, a read-only tool that never posts or logs in for you. Folders are yours alone, come with your export, and go with your account.</P>
          <H>The assistant</H>
          <P>The assistant's tap flows stay inside the app. When you type to it with a plan, what you type, the chat so far and what it looks up to do the job go to a language model through OpenRouter. That can be your tasks and money. While we try models out you can pick one in the assistant. Some keep nothing, and only those may read your journal (when you ask about it) and your trackers. Free ones may keep what is sent to them, so they never get your journal or trackers, and the assistant tells you so when one is picked. The assistant acts as you, on your own things, with the same limits as a tap. It keeps a list of what it did, with an Undo: plain labels, never your journal text. The list comes with your export and goes with your account, and the credits each message used show in your history.</P>
          <H>Changes to this page</H>
          <P>When we change it, the version number and date at the top change, and the app shows you a one-time notice. Earlier versions are available if you write to the contact address.</P>
        </>
      )}

      {kind === 'refunds' && (
        <>
          <H>Purchases in points</H>
          <P>The creator you bought from can refund any order in full from their shop. The points come back to you at once. Ask them first through their page or a priority DM.</P>
          <H>Purchases in money</H>
          <P>Refunds go back to the card or account you paid with through the payment provider, usually within five to seven working days of the creator or our team issuing them.</P>
          <H>Your right to change your mind (EU and UK)</H>
          <P>If you live in the EU or the UK and buy something from a distance, you can withdraw within 14 days, without giving a reason. For goods, the 14 days start the day you receive them. For everything else, they start the day you buy.</P>
          <P>There is one exception for digital content and services. The right ends once we start supplying them, if you gave your clear consent for us to start at once and you acknowledged at checkout that you lose the right. If you ask for a service to start inside the 14 days and then withdraw, you pay for the part already used.</P>
          <H>How to withdraw</H>
          <P>
            Write to us from Help inside the app, or through the <A to="/contact">contact page</A>, and say which order it is about. We confirm in writing that we received your request. For now, that Help form is our online withdrawal function. You do not need a special form or a reason.
          </P>
          <H>How long a refund takes</H>
          <P>We refund you without delay, and within 14 days of learning that you withdrew. Money goes back the way you paid. Refunds in points are instant.</P>
          <H>Sessions</H>
          <P>You can move a booking to another open slot up to two hours before it starts. Cancel before then and ask the creator for a refund; no-shows are at the creator's discretion.</P>
          <H>Events and circles</H>
          <P>Cancel an event RSVP any time before it starts and your points come back. Circle signups can be withdrawn until the tables are set, thirty-six hours before.</P>
          <H>Plans</H>
          <P>A plan lasts {PLAN_DAYS} days and does not renew by itself, so there is nothing to cancel. Credits left from the plan end with it. Top-up credits stay until you use them.</P>
          <H>Content rewards and payouts</H>
          <P>A rejected submission can be disputed once; a reviewer looks again. Payouts already released are final.</P>
          <H>Something else</H>
          <P>Write to the team from Help inside the app and a person will answer. Nothing on this page takes away rights you have by law.</P>
        </>
      )}

      {kind === 'contact' && (
        <>
          <H>The business</H>
          <div className="mt-sm grid gap-sm md:grid-cols-2">
            <Fact label="Legal name" value={business?.name} unset={loading ? 'Loading.' : 'Being set up.'} />
            <Fact label="Registered address" value={business?.address} unset={loading ? 'Loading.' : 'Being set up.'} />
            <Fact label="Email" value={email} unset="" />
            <Fact label="Registration number" value={business?.registration} unset="" optional />
            <Fact label="Tax number" value={business?.vat} unset="" optional />
          </div>
          {!loading && !business?.email && <P>This is our support address until the business email is set.</P>}
          <H>Support</H>
          <P>
            Open Help inside the app and write to the team; replies land in your inbox. Signed out, email <Mail address={email} />.
          </P>
          <H>Privacy</H>
          <P>
            For your data and your rights, write to <Mail address={email} /> and say it is about privacy. We reply within one month. The <A to="/privacy">privacy page</A> says what you can ask for.
          </P>
          <H>Copyright</H>
          <P>
            To report a copied work, or to answer a notice, use the <A to="/copyright">copyright page</A>, which names our designated agent.
          </P>
          <H>Brands and partners</H>
          <P>
            Create your organization from Army after signing in, or email <Mail address={email} />.
          </P>
        </>
      )}

      {kind === 'pricing' && (
        <>
          <div className="mt-lg grid gap-sm md:grid-cols-3">
            {[
              ['Play', 'Free', 'The daily game, your seven pillars, every app you switch on, Agency for your clients, circles, events and learning. Free to start, free to stay.'],
              ['Sell', '5% of each sale', 'Downloads, courses, sessions, memberships and everything in the shop. The fee is taken from each sale; nothing up front. Creators who refer others earn a share of ' + Math.round(AFFILIATE_SHARE * 100) + '% on referred sales.'],
              ['Assistant', `From US$${PLANS.pro.priceCents / 100}`, `Typing to the assistant, so it does things for you, needs a plan: ${PAID_PLANS.map((k) => `${PLANS[k].name} US$${PLANS[k].priceCents / 100}`).join(', ')}, each for ${PLAN_DAYS} days. Credits do not carry over. Its tap flows stay free.${PAYMENTS_LIVE ? '' : ' Plans are not on sale yet, so nothing is charged.'}`],
              ['Brands', 'Per campaign', `Campaign scoping and content-reward pools are priced per brief. Write to ${email}.`],
            ].map(([name, price, blurb], i) => (
              <div key={name} className={`rounded-card bg-card p-md shadow-toy-soft ${i === 3 ? 'md:col-span-3' : ''}`}>
                <p className="m-0 type-eyebrow text-ink-mute">{name}</p>
                <p className="mt-xs m-0 type-hook text-[36px]">{price}</p>
                <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">{blurb}</p>
              </div>
            ))}
          </div>
          <P>Plans do not renew by themselves. When one ends after {PLAN_DAYS} days, the credits left from the plan end with it, top-up credits stay until you use them, and nothing more is charged unless you pick a plan again. The price shown is the price charged, and any tax is shown before you pay.</P>
          <P>Money checkout runs in test mode until payments are switched on; points work today. Taxes on our fee are shown on every creator invoice. Agency is free, and we take nothing from the invoices you make in it. See also <A to="/refunds">Refunds</A>.</P>
        </>
      )}
    </LegalPage>
  );
}
