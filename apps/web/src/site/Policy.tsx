import { AFFILIATE_SHARE, CONSENT_PURPOSES, LEGAL_VERSION, MIN_AGE, PAID_PLANS, PAYMENTS_LIVE, PLAN_CURRENCY, PLAN_DAYS, PLANS, RETENTION, money } from '@kreators/shared';
import { A, ActionLink, StartLink, Bullets, Fact, Grid, Grievance, H, LegalPage, Mail, NOT_SET, P, Strong, contactEmail, useBusiness, versionDate } from './legalBits';

type Kind = 'terms' | 'privacy' | 'refunds' | 'contact' | 'pricing';

/** The plans with their prices, from the one list in shared, in the plan's own currency. */
const PLAN_PRICES = PAID_PLANS.map((k) => `${PLANS[k].name} ${money(PLANS[k].priceCents, PLAN_CURRENCY)}`).join(', ');
const RUPEE_LINE = 'Prices are in Indian rupees. GST is added where it applies and shown before you pay.';

const VERSION_LINE = `Version ${LEGAL_VERSION}, in force from ${versionDate()}.`;

/** Each page's title, a one-line lede, the version line where there is one, its one action, and whether it is a reading page. */
const TITLES: Record<Kind, { title: string; lede: string; note?: string; action: [string, string] | null; reading: boolean }> = {
  terms: { title: 'Terms of use', lede: 'The plain-language rules for using kreators.app.', note: VERSION_LINE, action: ['/contact', 'Questions? Write to us'], reading: true },
  privacy: { title: 'Privacy', lede: 'What we keep, who sees it, and how to take it or delete it.', note: VERSION_LINE, action: ['/contact', 'Ask about your data'], reading: true },
  refunds: { title: 'Refunds and cancellations', lede: 'How money and points come back when something goes wrong.', action: ['/contact', 'Ask for a refund'], reading: true },
  contact: { title: 'Contact', lede: 'A person answers. Help inside the app is fastest.', action: null, reading: false },
  pricing: { title: 'Pricing', lede: 'Free to start, free to stay. A fee when you sell, and a plan for the assistant.', action: ['/start', 'Start free'], reading: false },
};

/**
 * Why we handle each kind of data, and the ground for it, in plain words. India comes first: under the DPDP Act a use rests on your consent
 * or on a use the Act allows (such as one you asked for, or a legal duty). The last column is the GDPR ground, only for people in the EU and UK.
 */
const BASES: [string, string, string, string][] = [
  ['Running your account and the app: profile, pillars, tasks, logs, trackers, circles, events, Agency', 'You asked us for the service, and this is how it works.', 'Consent, given when you sign up', 'Contract'],
  ['Your date of birth and phone number', 'To keep anyone under eighteen out, and to reach you about your account.', 'Consent, given when you sign up', 'Legitimate interests, and the law where it sets an age'],
  ['Orders, bookings, payouts, invoices and money records', 'To take payment, pay creators and keep the books.', 'A use you asked for, and a legal duty for the records', 'Contract, and legal duty for the records'],
  ['Emails you need: receipts, password resets, payout notices', 'To do what you asked.', 'A use you asked for', 'Contract'],
  ['Sign-in sessions, device limit, rate limits and the app log', 'To keep accounts safe, to stop abuse and to find faults.', 'Consent, given when you sign up', 'Legitimate interests'],
  ['The assistant and the writing in Content, when you use them', 'To do the job you typed. Only what the job needs is sent.', 'A use you asked for', 'Contract'],
  ['Click counts on tracked links (an address hash, never the address)', 'So a creator can see which link worked.', 'Consent', 'Legitimate interests'],
  ['The tracked-link cookie, videos from YouTube and Vimeo, and news and offers by email', 'These are your choices, and none is needed to use the app.', 'Consent', 'Consent'],
  ['Your public page, leaderboard place and coach sharing', 'Only what you switch on is shown.', 'Consent, which you can take back', 'Your choice, which you can withdraw'],
];

/** Policy and information pages the payment provider and the app stores ask for before launch. */
export function Policy({ kind }: { kind: Kind }) {
  const t = TITLES[kind];
  const { business, loading } = useBusiness();
  const email = contactEmail(business);
  return (
    <LegalPage
      title={t.title}
      lede={t.lede}
      note={t.note}
      action={t.action ? t.action[0] === '/start' ? <StartLink /> : <ActionLink to={t.action[0]}>{t.action[1]}</ActionLink> : undefined}
      reading={t.reading}
      wide={kind === 'pricing'}
    >
      {kind === 'terms' && (
        <>
          <H>What kreators.app is</H>
          <P>A daily game for the seven relationships of a life, with tools for people who make things: learning, paid work, brand campaigns, content rewards, client work with invoices and agreements, events, run clubs, a shop, finance and meetups.</P>
          <H>Who may use it</H>
          <P>You need to be {MIN_AGE} or older. Sign-up asks for your date of birth and a phone number, and an account for anyone younger is refused. If we learn that an account belongs to someone under {MIN_AGE}, we close it.</P>
          <H>Your account</H>
          <P>You start with a session on your device and may add an email. Keep your password private. You are responsible for what happens under your account, and one person has one account. You can end your account at any time from Profile, Account: it deletes your personal details and your logs at once, and money records stay without your name, as the law asks.</P>
          <H>Your content and the licence you give us</H>
          <P>What you write, upload or post stays yours. To run the service, you give us a licence to store it, show it to the people you chose, copy it as the system needs and, where you put it on a public page, display it there. The licence is only for running kreators.app, it is not exclusive, and it ends when you delete the content or your account, except for copies that other people already made by sharing it. We do not use what you write to train AI models.</P>
          <H>Who owns what the app helps you make</H>
          <P>You do. That includes text that the assistant or the writing tool drafts for you. In some countries a text made by a machine may not be protected by copyright, so check before you rely on that. You are responsible for checking a draft before you use it.</P>
          <H>Points, rewards and money</H>
          <P>Points are earned by showing up and can be spent inside kreators.app. They are not money, cannot be cashed out, and have no value outside the app. Content rewards are paid in points after a reviewer confirms views; the pool and the rules on each reward are the whole deal. Money paid to creators through the shop goes through a payment provider under its own terms.</P>
          <H>Pricing and billing</H>
          <P>
            Play is free. When you sell through the shop, the fee is 5% of each sale. A plan for the assistant ({PLAN_PRICES}) lasts {PLAN_DAYS} days and does not renew by itself. When it ends, you pick again if you want one. {RUPEE_LINE} The price shown is the price charged. See <A to="/pricing">Pricing</A>.
          </P>
          <H>Refunds</H>
          <P>
            How refunds work, including your right to change your mind if you live in the EU or the UK, is on the <A to="/refunds">refunds page</A>.
          </P>
          <H>What you make and sell</H>
          <P>You keep the rights to what you make. By selling through the shop you promise it is yours to sell, is not unlawful or hateful, and does not promise financial returns. Brands and creators agree usage rights on each campaign in writing before anything is produced.</P>
          <H>Wellbeing, not medical care</H>
          <P>Mood, sleep, stress, breathing, the Companion, journal prompts and Discover help you look at your days and how you feel. They are not medical care, a diagnosis or a treatment. If you are worried about your health, talk to a doctor or another trained person. Do not wait to get help because of something you read here.</P>
          <H>Money tools, not advice</H>
          <P>Finance, the tax sums in Agency and the money numbers in reviews help you keep track. They are not financial, tax or investment advice. Check with an accountant or another adviser before you rely on them.</P>
          <H>Invoices and agreements</H>
          <P>Agency lets you make invoices and agreements for your own clients. They are your documents, not ours, and you are responsible for what is in them and for the tax on them. The agreement templates are a starting point, not legal advice: have a lawyer read one before you rely on it. When a client types their name to accept, that is typed acceptance, not a certified electronic signature. We take nothing from what you invoice.</P>
          <H>Acceptable use</H>
          <P>No farming points, no fake views, no scraping, no impersonation, no posting what you do not have the right to post, no harassing people and no breaking the law. If these rules are broken we may remove content, hold payouts for review, or close the account, and we tell you why. If you think we got it wrong, write to the team through Help inside the app and a person will look again.</P>
          <P>Posts, replies, chat lines and coach notes are the views of the people who wrote them, not of kreators.app. Do not post anything meant to put down a religion, a community, a company or a person.</P>
          <H>Complaints</H>
          <P>
            For a complaint about the app, about something posted here or about your data, write first to our Grievance Officer, named on the <A to="/contact">contact page</A>. A person will look at it.
          </P>
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
              {/* While the details load, the not-set sentence holds its box unseen (screen readers hear Loading), so the sections under it do not move. */}
              {loading && <span className="sr-only">Loading the business details.</span>}
              <span className={loading ? 'invisible' : undefined} aria-hidden={loading || undefined}>
                The legal name and address of the business that runs kreators.app are not set yet. They will be listed on the contact page. Until then, for anything about your data, write to <Mail address={email} />, which is also our privacy contact.
              </span>
            </P>
          )}
          <H>What we keep</H>
          <P>Your profile (name, page name, bio, skills, interests, city), your date of birth and phone number, your pillars and daily logs, wellbeing and journal entries, orders, bookings, finance entries, the clients, deliverables, time, invoices and agreements you keep in Agency, the reviews you write and plan, messages in circles, and the events your device sends while you use the app.</P>
          <H>Why we use it, and on what ground</H>
          <P>The law asks us to name a ground for each use. In India, under the Digital Personal Data Protection Act 2023, a use rests on your consent or on a use the Act allows, such as one you asked for or a legal duty.</P>
          <Grid label="Why we use your data" head={['What', 'Why', 'Ground in India', 'Ground in the EU and UK']} rows={BASES.map(([a, b, c, d]) => [a, b, c, d])} />
          <H>Who sees what</H>
          <P>Your journal and wellbeing numbers are never shown to brands, staff, the leaderboard or Club selection. Your public page shows only what you put on it. Staff see what their permission covers. A circle sees your alias until you choose to reveal.</P>
          <P>Your Discover answers and results are private to you. They never reach brands, staff, the leaderboard or a life coach. You choose whether they shape your next steps on Home (plain rules, no AI, on until you switch it off), and whether the assistant may read a short summary of them (off until you switch it on, and only a model that keeps no data can read it). You can delete a result at any time.</P>
          <H>Who gets it</H>
          <P>
            We use a few companies to run the service, such as our hosting, email and payment providers. Each one is listed, with what it does, what data it gets and where, on the <A to="/subprocessors">subprocessors page</A>. They act on our instructions. We do not give your data to anyone else, except when the law makes us or when you ask us to, for example when you share a page.
          </P>
          <H>Where your data is held</H>
          <P>Your data is held and processed in India and abroad, by the companies on the <A to="/subprocessors">subprocessors page</A>. India's government may bar sending data to some countries, and we follow that. For people in the EU and the UK, when data leaves, we rely on contract terms such as the EU standard contractual clauses. We do not claim any certification, for ourselves or for them.</P>
          <H>How long we keep it</H>
          <P>A daily tidy-up removes what has expired.</P>
          <Grid label="How long we keep each kind of data" head={['What', 'How long', 'Why']} rows={RETENTION.map((r) => [r.category, r.keep, r.why])} />
          <H>If you live in India</H>
          <P>Under the Digital Personal Data Protection Act 2023 you are the data principal, and we are the data fiduciary. This page is our notice to you, in English: it says what we collect, why, and how to use your rights.</P>
          <Bullets
            items={[
              <>
                <Strong>A summary of your data.</Strong> What we hold, what we do with it, and who we shared it with. Export everything as one file from Profile, Account.
              </>,
              <>
                <Strong>Fix it.</Strong> Correct, complete or update what we hold. Most of it you can change yourself under Profile.
              </>,
              <>
                <Strong>Erase it.</Strong> Delete your account from Profile, Account. Money records stay without your name, as the table shows.
              </>,
              <>
                <Strong>Take back a consent.</Strong> It is as easy as giving it: Profile, Privacy choices, one tap each.
              </>,
              <>
                <Strong>Name someone to act for you.</Strong> If you die or cannot act, a person you name can use these rights for you. Tell our Grievance Officer who it is.
              </>,
              <>
                <Strong>Complain.</Strong> Write first to our Grievance Officer, below. If you are not happy with the answer, you may go to the Data Protection Board of India.
              </>,
            ]}
          />
          <Grievance business={business} loading={loading} />
          <H>If you live in the EU or the UK</H>
          <P>You can ask to see what we hold, have it corrected, have it deleted, take a copy that a computer can read, object to a use that rests on our legitimate interests, or take back a consent. You can also complain to your data protection authority.</P>
          <Bullets
            items={[
              <>Export everything as one file, or delete your account: Profile, Account.</>,
              <>Change your three optional choices (below): Profile, Privacy choices.</>,
              <>Anything else: the <A to="/contact">contact page</A>, or Help inside the app. We reply within the time the law sets.</>,
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
          <P>We set one optional cookie, called kl_click, when you follow a tracked link. It lasts thirty days and tells the creator which link brought you. In India, the EU, the rest of the EEA, the UK and Switzerland we set it only after your yes. Everywhere, it stays off if you say no or if your browser sends Global Privacy Control.</P>
          <P>Your sign-in session, your theme and your privacy choices are kept on your device, because the app cannot work without them. There are no third-party advertising trackers.</P>
          <H>Do Not Track and Global Privacy Control</H>
          <P>We honour Global Privacy Control as a no to the link cookie, even if you said yes before. We do not follow you across other sites, so a Do Not Track signal changes nothing about how we treat you.</P>
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
          <H>If you live elsewhere</H>
          <P>The rights above are open to everyone: write to us and we will help, wherever you live.</P>
          <P>
            <Strong>California notice at collection.</Strong> We collect identifiers, account details, content you add, order records and use of the app, for the reasons in the table above. We do not sell or share personal information, and you can ask to know, correct or delete what we hold, as described above.
          </P>
          <H>Changes to this page</H>
          <P>When we change it, the version number and date at the top change, and the app shows you a one-time notice. Earlier versions are available if you write to the contact address.</P>
        </>
      )}

      {kind === 'refunds' && (
        <>
          <H>Purchases in points</H>
          <P>The creator you bought from can refund any order in full from their shop. The points come back to you at once. Ask them first through their page or a priority DM.</P>
          <H>Purchases in money</H>
          <P>Money refunds go back the way you paid, by UPI, card or bank, through Razorpay, our payment provider. That usually takes five to seven working days from when the creator or our team issues the refund.</P>
          <H>If a refund goes wrong</H>
          <P>
            Write to the team from Help inside the app. If that does not settle it, write to our Grievance Officer, named on the <A to="/contact">contact page</A>.
          </P>
          <H>If you live in the EU or the UK: changing your mind</H>
          <P>If you live in the EU or the UK and buy something from a distance, you can withdraw within 14 days, without giving a reason. For goods, the 14 days start the day you receive them. For everything else, they start the day you buy.</P>
          <P>There is one exception for digital content and services. The right ends once we start supplying them, if you gave your clear consent for us to start at once and you acknowledged at checkout that you lose the right. If you ask for a service to start inside the 14 days and then withdraw, you pay for the part already used.</P>
          <H>How to withdraw (EU and UK)</H>
          <P>
            Write to us from Help inside the app, or through the <A to="/contact">contact page</A>, and say which order it is about. We confirm in writing that we received your request. For now, that Help form is our online withdrawal function. You do not need a special form or a reason.
          </P>
          <H>How long a withdrawal refund takes (EU and UK)</H>
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
          {/* Three to five facts, some optional: an odd last one takes the whole row, so none sits alone beside a hole. */}
          <div className="mt-sm grid gap-sm md:grid-cols-2 md:[&>:last-child:nth-child(odd)]:col-span-2">
            <Fact label="Legal name" value={business?.name} unset={loading ? 'Loading.' : NOT_SET} />
            <Fact label="Registered address" value={business?.address} unset={loading ? 'Loading.' : NOT_SET} />
            <Fact label="Email" value={email} unset="" />
            <Fact label="CIN or registration number" value={business?.registration} unset="" optional />
            <Fact label="GSTIN or tax number" value={business?.vat} unset="" optional />
          </div>
          {!loading && !business?.email && <P>This is our support address until the business email is set.</P>}
          <H>Support</H>
          <P>
            Open Help inside the app and write to the team; replies land in your inbox. Signed out, email <Mail address={email} />.
          </P>
          <H>Grievance Officer</H>
          <P>For a complaint about your data, about something posted here, or about the app, write first to our Grievance Officer.</P>
          <Grievance business={business} loading={loading} />
          <H>Privacy</H>
          <P>
            For your data and your rights, write to <Mail address={email} /> and say it is about privacy. The <A to="/privacy">privacy page</A> says what you can ask for.
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
          {/* Two across on a tablet (three narrow cells broke "5% of each sale" and left Free a half-empty box beside the long Assistant
              cell), with the Assistant and Brands each across the row; three across on a laptop. */}
          <div className="mt-lg grid gap-sm md:grid-cols-2 lg:grid-cols-3">
            {[
              ['Play', 'Free', 'The daily game, your seven pillars and every app you switch on, Agency included.'],
              ['Sell', '5% of each sale', `In the shop, with nothing up front. Refer a creator and earn ${Math.round(AFFILIATE_SHARE * 100)}% of their referred sales.`],
              ['Assistant', `From ${money(PLANS.pro.priceCents, PLAN_CURRENCY)}`, `Typing to it needs a plan: ${PLAN_PRICES}, each for ${PLAN_DAYS} days. Tapping its ready-made choices stays free.${PAYMENTS_LIVE ? '' : ' Plans are not on sale yet.'}`],
              ['Brands', 'Per campaign', `Campaigns and content-reward pools are priced per brief. Write to ${email}.`],
            ].map(([name, price, blurb], i) => (
              <div key={name} className={`rounded-card bg-card p-md shadow-toy-soft ${['', '', 'md:col-span-2 lg:col-span-1', 'md:col-span-2 lg:col-span-3'][i]}`}>
                <p className="m-0 type-eyebrow text-ink-mute">{name}</p>
                <p className="mt-xs m-0 type-hook text-display-3">{price}</p>
                <p className="mt-sm m-0 text-subhead text-ink-soft">{blurb}</p>
              </div>
            ))}
          </div>
          <H>The fine print</H>
          <Bullets
            items={[
              'Plans do not renew by themselves, so nothing more is charged unless you pick one again.',
              `When a plan ends after ${PLAN_DAYS} days, its credits end with it. Top-up credits stay until you use them.`,
              `${RUPEE_LINE} The price shown is the price charged.`,
              'Money checkout runs in test mode until payments are switched on; points work today.',
              'Taxes on our fee are shown on every creator invoice.',
              'We take nothing from the invoices you make in Agency.',
              <>
                See also <A to="/refunds" hit>Refunds</A>.
              </>,
            ]}
          />
        </>
      )}
    </LegalPage>
  );
}
