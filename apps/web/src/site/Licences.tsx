import { useEffect, useState } from 'react';
import { Fold } from '../components/Fold';
import { H, LegalPage, P } from './legalBits';

interface Pkg {
  name: string;
  version: string;
  license: string;
  repository: string;
  text: string;
}
interface Licences {
  generatedAt: string;
  packages: Pkg[];
}

const FONTS = ['Urbanist', 'Fraunces', 'JetBrains Mono'];

/** The open-source packages that ship with the web app, read at run time from the list `node scripts/licences.mjs` writes. */
export function Licences() {
  const [data, setData] = useState<Licences | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetch('/licences.json')
      .then((r) => (r.ok ? (r.json() as Promise<Licences>) : Promise.reject(new Error('missing'))))
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);
  return (
    <LegalPage title="Open-source licences" lede="kreators.app is built on work that other people shared. Here is what is in the app, and the licence it came under.">
      <H>Packages</H>
      {!data && !failed && <P>Loading the list.</P>}
      {failed && <P>The list did not load. Try again in a moment.</P>}
      {data && (
        <>
          <P>
            {data.packages.length} packages ship with the web app. This list was made on {new Date(data.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. Open one to read its licence.
          </P>
          <div className="mt-sm grid gap-xs">
            {data.packages.map((p) => (
              <Fold key={`${p.name}@${p.version}`} title={p.name} hint={`${p.version} · ${p.license || 'no licence named'}`}>
                <div className="rounded-tile bg-card p-sm">
                  {p.repository && <p className="m-0 break-all text-[12px] font-semibold text-ink-mute">{p.repository}</p>}
                  {p.text ? <pre className="mt-xs m-0 max-h-[320px] overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-ink-soft">{p.text}</pre> : <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">This package does not ship a licence file. Its licence is named above.</p>}
                </div>
              </Fold>
            ))}
          </div>
        </>
      )}
      <H>Fonts</H>
      <P>
        The type is {FONTS.join(', ')}. Each is under the SIL Open Font License, version 1.1. That licence covers the font files only, not the rest of the app. The fonts are free to use, copy and share, but not to sell on their own. The full text is at openfontlicense.org.
      </P>
      <H>Animation</H>
      <P>The animation library GSAP is used under its free standard licence, which is at gsap.com/standard-license.</P>
      <H>Our own work</H>
      <P>The icons, the illustrations and the seven characters are our own. The sounds are made in your browser as you listen, from no audio files.</P>
    </LegalPage>
  );
}
