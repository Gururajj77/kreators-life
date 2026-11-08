-- 0121: The event attendee's way in (2026-11-07, the founder: "a flow that goes from frontend listing of events, to a landing page where sign-up
-- occurs, once that's done the onboarding of event attendees begins"). The Party event an account joined from the public event page
-- (/events/:id) before it finished the setup chat. While onboarded_at is empty and this is set, the app lets the account into what an attendee
-- needs (the event, Party, Community, Bond, Inbox, Profile and Help; ATTENDEE_PATHS in shared eventJoin.ts) and shows the bar that invites it to
-- finish setting up; everything else still sends it to the setup chat. Written by POST /party/events/:id/arrive for a public, published event
-- still to come; nothing reads it once setup is done. It names an event, not a person: in the export (as `user.attendeeEvent`), cleared by an
-- erase of progress (which sends the person back to the setup chat) and by the account delete.
ALTER TABLE users ADD COLUMN attendee_event TEXT;
