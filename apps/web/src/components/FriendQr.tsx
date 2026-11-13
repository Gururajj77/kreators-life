import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useCopy } from '../lib/clipboard';
import { friendAddPath } from '../lib/friendAdd';
import { keys, useMe } from '../lib/queries';
import { Button } from './Button';
import { ConfirmDelete } from './ConfirmDelete';
import { MoreMenu } from './MoreMenu';

/**
 * My QR code (2026-11-07, the founder: "a space for QR code that can be used to connect with each other attached to the username and unique Id
 * number"): the link to your own page with your friend code (`/u/<handle>?add=<code>`, lib/friendAdd.ts), drawn on this device by the `qrcode`
 * package as a picture (a data: URL, which the CSP already allows; no other site is asked), your @username and friend code under it, Copy link,
 * Share where the browser has it, and Make a new code (asked first) for a code that has spread too far. A scan opens your page with one Add
 * friend, a request you still say yes to. On Profile (`/you#qr`), in Bond (a fold under your friend code) and on an event's page for its guests.
 */
export function FriendQr({ renew = true }: { /** False where the card is a quick show (an event), so Make a new code lives on Profile and in Bond. */ renew?: boolean }) {
  const me = useMe();
  const qc = useQueryClient();
  const user = me.data?.user;
  const handle = user?.handle ?? '';
  const code = user?.friendCode ?? '';
  const url = handle && code ? `${window.location.origin}${friendAddPath(handle, code)}` : '';
  const { copy, said } = useCopy();
  const [qr, setQr] = useState<{ for: string; src: string } | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [shared, setShared] = useState<string | null>(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const fresh = useMutation({
    mutationFn: () => api.newFriendCode(),
    onSuccess: () => {
      setAsking(false);
      void qc.invalidateQueries({ queryKey: keys.me });
    },
  });
  useEffect(() => {
    if (!url || qr?.for === url) return;
    let gone = false;
    setQrError(null);
    // Drawn twice the size it shows, so it stays sharp on a phone's screen; margin 2 keeps the quiet edge scanners need inside the white tile.
    void import('qrcode')
      .then((QRCode) => QRCode.toDataURL(url, { margin: 2, width: 448, errorCorrectionLevel: 'M' }))
      .then((src) => {
        if (!gone) setQr({ for: url, src });
      })
      .catch(() => {
        if (!gone) setQrError('Could not draw the code.');
      });
    return () => {
      gone = true;
    };
  }, [url, qr?.for]);

  const share = async () => {
    try {
      await navigator.share({ title: 'Add me on kreators.app', text: `I'm @${handle} on kreators.app.`, url });
    } catch (e) {
      // Closing the share sheet is not a failure.
      if (!(e instanceof DOMException && e.name === 'AbortError')) setShared('Could not share. Copy the link instead.');
    }
  };

  if (!user) return null;
  const ready = qr?.for === url ? qr.src : null;
  // The friend code as boxes, split in two halves with a dash between (the founder's reference, 2026-11-13: a code read out box by box).
  const half = Math.ceil(code.length / 2);
  const halves = [code.slice(0, half), code.slice(half)].filter(Boolean);
  return (
    <div className="flex w-full flex-col gap-md rounded-card bg-card p-md shadow-toy-soft">
      {/* The panel across the card's whole width (the founder, 2026-11-13: "full width on desktop too"), on a quiet wash with a hairline,
          the code raised on its white tile in the middle, then the friend code under it. */}
      <div className="flex flex-col items-center gap-md rounded-inner border border-line px-xs py-lg sm:px-md" style={{ background: 'var(--fill-2)' }}>
        {/* The code is always dark on white, in both themes, since a scanner needs that; the tile around it is the white. */}
        <div className="flex size-[240px] max-w-full items-center justify-center rounded-tile bg-white p-xs shadow-toy-soft lg:size-[288px]">
          {ready ? (
            <img src={ready} width={224} height={224} alt={`QR code for your page, @${handle}`} className="block size-[224px] max-w-full lg:size-[272px]" />
          ) : qrError ? (
            <p className="m-0 text-subhead text-ink-fixed">{qrError}</p>
          ) : (
            <p role="status" className="m-0 text-subhead text-ink-fixed">
              Drawing the code
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-xs text-center">
          <p className="m-0 text-headline [overflow-wrap:anywhere]">@{handle}</p>
          <p className="m-0 text-footnote text-ink-soft">A scan opens your page with Add friend. You still say yes.</p>
        </div>
        <div className="flex flex-col items-center gap-sm">
          <p className="m-0 text-subhead font-semibold">Friend code</p>
          {/* Read as one code; the boxes are drawn for the eye only. Smaller under sm, so all eight fit a 360px phone on one line. */}
          <p className="m-0 flex flex-wrap items-center justify-center gap-xs">
            <span className="sr-only">{code}</span>
            {halves.map((part, h) => (
              <span key={h} aria-hidden className="contents">
                {h > 0 && <span className="block h-[2px] w-[12px] rounded-pill bg-ink-mute" />}
                <span className="flex gap-xs">
                  {[...part].map((ch, i) => (
                    <span
                      key={i}
                      className="flex h-[36px] w-[24px] items-center justify-center rounded-[8px] border border-line bg-card font-mono text-headline type-figure shadow-toy-soft sm:h-[44px] sm:w-[36px] sm:rounded-[12px] sm:text-title3"
                    >
                      {ch}
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </p>
        </div>
      </div>
      <div className="flex w-full items-center gap-xs">
        {/* Clipboard blocked: `said` says so, and the code and username are on screen to read out. */}
        <Button variant="outline" className="flex-1" onClick={() => void copy(url)}>
          {said === 'Copied' ? 'Copied' : 'Copy link'}
        </Button>
        {canShare && (
          <Button variant="outline" className="flex-1" onClick={() => void share()}>
            Share
          </Button>
        )}
        {renew && <MoreMenu label="More about your QR code" items={[{ key: 'fresh', label: 'Make a new code', destructive: true, onSelect: () => { fresh.reset(); setAsking(true); } }]} />}
      </div>
      {((said && said !== 'Copied') || shared) && (
        <p role="status" className="m-0 text-caption text-ink-soft">
          {said && said !== 'Copied' ? said : shared}
        </p>
      )}
      {renew && (
        <ConfirmDelete
          open={asking}
          title="Make a new friend code?"
          body="Your old code, and every QR code made from it, stops working. Requests already sent stay."
          pending={fresh.isPending}
          failed={fresh.isError}
          onYes={() => fresh.mutate()}
          onClose={() => setAsking(false)}
          yes="Yes, make a new one"
          keep="Keep this one"
        />
      )}
    </div>
  );
}
