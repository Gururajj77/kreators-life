import { useState } from 'react';
import { ChatActions } from './Chat';
import { InterestPicker } from './InterestPicker';
import { useMe } from '../lib/queries';
import { useSeedOnce } from '../lib/useSeed';
import { FIELD } from '../lib/ui';

/**
 * Your interests and a little about you, filled in at the end of a chat: what you are into (up to ten, picked
 * with InterestPicker), your city, and a line about yourself. The same fields as Profile, filled in with what is
 * there already; the chat saves them through PATCH /me. "Not now" sends nothing.
 */
export function ProfileCard({ onSend, full = false }: { onSend: (value: Record<string, string>, label: string) => void; full?: boolean }) {
  const u = useMe().data?.user;
  const [interests, setInterests] = useState<string[]>(u?.interests ?? []);
  const [city, setCity] = useState(u?.city ?? '');
  const [bio, setBio] = useState(u?.bio ?? '');
  // The profile can arrive after the card is drawn: fill what is still empty, once.
  useSeedOnce(u, (p) => {
    setInterests((i) => (i.length ? i : p.interests));
    setCity((c) => c || p.city);
    setBio((b) => b || p.bio);
  });
  const said = [interests.length ? `Into ${interests.join(', ')}` : '', city.trim() ? `in ${city.trim()}` : ''].filter(Boolean).join(', ');
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <InterestPicker legend="What are you into? Pick up to ten" value={interests} onChange={setInterests} />
      <label className="mt-sm block">
        <span className="block text-[14px] font-bold">Your city</span>
        <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} placeholder="Bengaluru" autoComplete="address-level2" className={FIELD} />
      </label>
      <label className="mt-sm block">
        <span className="block text-[14px] font-bold">A line about you, if you like</span>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} rows={2} placeholder="I make short films and love long walks." className={`${FIELD} resize-none`} />
      </label>
      <ChatActions
        full={full}
        skip="Not now"
        onSkip={() => onSend({ skip: '1' }, 'Not now')}
        next="Save to my profile"
        ready={interests.length > 0 || city.trim().length > 0 || bio.trim().length > 0}
        onNext={() => onSend({ interests: JSON.stringify(interests), city: city.trim(), bio: bio.trim() }, said || 'Saved a line about me')}
      />
    </div>
  );
}
