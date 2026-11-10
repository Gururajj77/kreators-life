import { INVITE_BATCH_MAX, INVITE_EXPIRY_CHOICES, INVITE_EXPIRY_DEFAULT, INVITE_LABEL_MAX, type InviteExpiry } from '@kreators/shared/invites';
import { useEffect, useState, type FormEvent } from 'react';
import { expiryWords, type MakeInvites } from '../lib/inviteApi';
import { FIELD, SELECT_SM } from '../lib/ui';
import { Button } from './Button';
import { ErrorLine } from './ErrorLine';

const COUNTS = Array.from({ length: INVITE_BATCH_MAX }, (_, i) => i + 1);

/**
 * Make codes (2026-11-10): how many, a private label (who they are for), and how long they stay open. The same form on Profile's Invite
 * people and in Admin, Invites; `solid` makes its button the screen's one solid button (Admin), outline elsewhere.
 */
export function MakeInvitesForm({ onMake, solid = false }: { onMake: (body: MakeInvites) => Promise<void>; solid?: boolean }) {
  const [count, setCount] = useState(1);
  const [label, setLabel] = useState('');
  const [days, setDays] = useState<InviteExpiry>(INVITE_EXPIRY_DEFAULT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onMake({ count, ...(label.trim() ? { label: label.trim() } : {}), days });
      setLabel('');
      setCount(1);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="flex flex-col gap-md" onSubmit={(e) => void send(e)}>
      <label className="block">
        <span className="block text-subhead font-semibold">Who it is for</span>
        <span className="block text-caption text-ink-soft">Optional. Only you see it.</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={INVITE_LABEL_MAX} className={FIELD} />
      </label>
      <div className="flex flex-wrap gap-md">
        <label className="flex min-w-0 flex-[1_1_10rem] flex-col gap-xs">
          <span className="text-subhead font-semibold">How many</span>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={`w-full ${SELECT_SM}`}>
            {COUNTS.map((n) => (
              <option key={n} value={n}>
                {n === 1 ? 'One code' : `${n} codes`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-[1_1_10rem] flex-col gap-xs">
          <span className="text-subhead font-semibold">Open for</span>
          <select value={String(days)} onChange={(e) => setDays(INVITE_EXPIRY_CHOICES.find((d) => String(d) === e.target.value) ?? null)} className={`w-full ${SELECT_SM}`}>
            {INVITE_EXPIRY_CHOICES.map((d) => (
              <option key={String(d)} value={String(d)}>
                {expiryWords(d)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ErrorLine e={error} />
      <Button type="submit" variant={solid ? 'primary' : 'outline'} full disabled={busy}>
        {busy ? 'Making' : count === 1 ? 'Make the code' : `Make ${count} codes`}
      </Button>
    </form>
  );
}

/** A code's link as a QR code, drawn on this device like My QR code (components/FriendQr.tsx), dark on a white tile in both themes. */
export function InviteQr({ link, code }: { link: string; code: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let gone = false;
    void import('qrcode')
      .then((QRCode) => QRCode.toDataURL(link, { margin: 2, width: 384, errorCorrectionLevel: 'M' }))
      .then((s) => !gone && setSrc(s))
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
    };
  }, [link]);
  return (
    <div className="flex size-[200px] max-w-full items-center justify-center rounded-tile bg-white p-xs">
      {src ? (
        <img src={src} width={192} height={192} alt={`QR code for invite ${code}`} className="block size-[192px] max-w-full" />
      ) : (
        <p role="status" className="m-0 text-subhead text-ink-fixed">
          {failed ? 'Could not draw the code.' : 'Drawing the code'}
        </p>
      )}
    </div>
  );
}
