import { AFFILIATE_SHARE } from '@kreators/shared';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { SiteLayout } from './SiteLayout';

type Kind = 'terms' | 'privacy' | 'refunds' | 'contact' | 'pricing';

const TITLES: Record<Kind, { title: string; lede: string }> = {
  terms: { title: 'Terms of use', lede: 'The plain-language rules for using kreators.app. A draft for your lawyer to finish, dated 24 October 2026.' },
  privacy: { title: 'Privacy', lede: 'What we keep, why, who sees it, and how to take it with you or delete it.' },
  refunds: { title: 'Refunds and cancellations', lede: 'How money and points move back when something does not work out.' },
  contact: { title: 'Contact', lede: 'A person answers. Support tickets inside the app are fastest.' },
  pricing: { title: 'Pricing', lede: 'Free to play. Fees only when you sell.' },
};

function H({ children }: { children: ReactNode }) {
  return <h2 className="mt-lg text-[24px]">{children}</h2>;
}
function P({ children }: { children: ReactNode }) {
  return <p className="mt-xs m-0 text-[16px] font-semibold leading-relaxed text-ink-soft">{children}</p>;
}

/** Policy and information pages the payment provider and the app stores ask for before launch. */
export function Policy({ kind }: { kind: Kind }) {
  const t = TITLES[kind];
  return (
    <SiteLayout wide={false}>
      <header className="pt-lg">
        <p className="m-0 text-[14px] font-extrabold uppercase tracking-wide text-ink-mute">kreators.app</p>
        <h1 className="mt-xs text-[clamp(32px,6vw,48px)]">{t.title}</h1>
        <P>{t.lede}</P>
      </header>

      {kind === 'terms' && (
        <section>
          <H>What kreators.app is</H>
          <P>A daily game for the seven relationships of a life, with tools for people who make things: learning, paid work, brand campaigns, content rewards, events, run clubs, a shop, finance and meetups. You need to be eighteen or older. Sign-up asks for your date of birth and a phone number, and an account for anyone younger is refused.</P>
          <H>Your account</H>
          <P>You start with a session on your device and may add an email. Keep your password private. You are responsible for what happens under your account, and one person has one account.</P>
          <H>Points, rewards and money</H>
          <P>Points are earned by showing up and can be spent inside kreators.app. They are not money, cannot be cashed out, and have no value outside the app. Content rewards are paid in points after a reviewer confirms views; the pool and the rules on each reward are the whole deal. Money paid to creators through the shop goes through a payment provider under its own terms.</P>
          <H>What you make and sell</H>
          <P>You keep the rights to what you make. By selling through the shop you promise it is yours to sell, is not unlawful or hateful, and does not promise financial returns. Brands and creators agree usage rights on each campaign in writing before anything is produced.</P>
          <H>Fair play</H>
          <P>No farming points, no fake views, no scraping, no impersonation. We may remove content, hold payouts for review, or close accounts that break these rules, and we tell you why.</P>
          <H>Liability</H>
          <P>kreators.app is provided as it is. We are not liable for indirect loss, for what other members do, or for a provider's outage. Where the law does not allow this, our liability is limited to what you paid us in the last three months.</P>
          <H>Changes</H>
          <P>We will post changes here and in the app a week before they apply. Carrying on means you accept them.</P>
        </section>
      )}

      {kind === 'privacy' && (
        <section>
          <H>What we keep</H>
          <P>Your profile (name, page name, bio, skills, interests, city), your pillars and daily logs, wellbeing and journal entries, orders, bookings, finance entries, messages in circles, and the events your device sends while you use the app.</P>
          <H>Who sees what</H>
          <P>Your journal and wellbeing numbers are never shown to brands, staff, the leaderboard or Club selection. Your public page shows only what you put on it. Staff see what their permission covers. A circle sees your alias until you choose to reveal.</P>
          <H>Position</H>
          <P>If you share your position for nearby matching it is rounded, stored on the server only, used to keep tables within twenty kilometres, and never shown to anyone.</P>
          <H>Payments and KYC</H>
          <P>Card and bank details go to the payment provider, not to us. For payouts we keep your legal name, the last four digits of your PAN and bank account, your IFSC and address.</P>
          <H>Your rights</H>
          <P>
            Export everything we hold as one file, or delete your account, from You, Account. Deleting removes your personal details and your logs; money records stay anonymised for the books, as the law requires. Questions go to the{' '}
            <Link to="/contact" className="underline underline-offset-4">
              contact page
            </Link>
            .
          </P>
          <H>Cookies and storage</H>
          <P>We use one cookie for tracked links (thirty days) and your device's storage for your session and theme. No third-party advertising trackers.</P>
          <H>The content strategist</H>
          <P>Content keeps a folder per brand: the links you add, what research brought back from them, and the pieces written from that. When a writing model is connected, that folder's research and your brief go to Anthropic to be written up, and nothing else about you goes with it: never your journal, your wellbeing logs or your customers. Research goes out through Agent Reach, a read-only tool that never posts or logs in for you. Folders are yours alone, come with your export, and go with your account.</P>
          <H>The assistant</H>
          <P>The assistant's tap flows stay inside the app. When you type to it with a plan, what you type, the chat so far and what it looks up to do the job go to a language model through OpenRouter. That can be your tasks and money. While we try models out you can pick one in the assistant. Some keep nothing, and only those may read your journal (when you ask about it) and your trackers. Free ones may keep what is sent to them, so they never get your journal or trackers, and the assistant tells you so when one is picked. The assistant acts as you, on your own things, with the same limits as a tap. It keeps a list of what it did, with an Undo: plain labels, never your journal text. The list comes with your export and goes with your account, and the credits each message used show in your history.</P>
        </section>
      )}

      {kind === 'refunds' && (
        <section>
          <H>Purchases in points</H>
          <P>The creator you bought from can refund any order in full from their shop; the points come straight back to you. Ask them first through their page or a priority DM.</P>
          <H>Purchases in money</H>
          <P>Refunds go back to the card or account you paid with through the payment provider, usually within five to seven working days of the creator or our team issuing them.</P>
          <H>Sessions</H>
          <P>You can move a booking to another open slot up to two hours before it starts. Cancel before then and ask the creator for a refund; no-shows are at the creator's discretion.</P>
          <H>Events and circles</H>
          <P>Cancel an event RSVP any time before it starts and your points come back. Circle signups can be withdrawn until the tables are set, thirty-six hours before.</P>
          <H>Content rewards and payouts</H>
          <P>A rejected submission can be disputed once; a reviewer looks again. Payouts already released are final.</P>
          <H>Something else</H>
          <P>Write to the team from Help inside the app and a person will answer.</P>
        </section>
      )}

      {kind === 'contact' && (
        <section>
          <H>Support</H>
          <P>
            Open Help inside the app and write to the team; replies land in your inbox. Signed out, email <span className="select-all font-extrabold text-ink">hello@kreators.life</span>.
          </P>
          <H>Brands and partners</H>
          <P>
            Create your organization from Army after signing in, or email <span className="select-all font-extrabold text-ink">brands@kreators.life</span>.
          </P>
          <H>Business address</H>
          <P>kreators.app, registered address to be added once the entity is set up.</P>
        </section>
      )}

      {kind === 'pricing' && (
        <section>
          <div className="mt-lg grid gap-sm md:grid-cols-3">
            {[
              ['Play', 'Free', 'The whole game, the dashboard, circles, events and learning. Always free.'],
              ['Sell', '5% of each sale', 'Downloads, courses, sessions, memberships and everything in the shop. The fee is taken from each sale; nothing up front. Creators who refer others earn a share of ' + Math.round(AFFILIATE_SHARE * 100) + '% on referred sales.'],
              ['Brands', 'Per campaign', 'Campaign scoping and content-reward pools are priced per brief. Write to brands@kreators.life.'],
            ].map(([name, price, blurb]) => (
              <div key={name} className="rounded-card bg-card p-md shadow-toy-soft">
                <p className="m-0 text-[14px] font-extrabold uppercase tracking-wide text-ink-mute">{name}</p>
                <p className="mt-xs m-0 font-display text-[32px] font-extrabold leading-none">{price}</p>
                <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">{blurb}</p>
              </div>
            ))}
          </div>
          <P>Money checkout runs in test mode until payments are switched on; points work today. Taxes on our fee are shown on every creator invoice.</P>
        </section>
      )}
    </SiteLayout>
  );
}
