import { DOC_ACCENTS, DOC_FONTS, DOC_FOOTER_MAX, DOC_HEADINGS,
  DOC_LAYOUTS, DOC_MARGINS, DOC_PAGES, DOC_SIGN_LAYOUTS, DOC_SIZES, DOC_STYLE_NAMES, docStyleSummary, emptyProfile, parseDocStyle, type DocStyle } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { shrinkImage } from '../lib/shrink';
import { Button } from './Button';
import { Chips, Field, LABEL, SummaryCard } from './InvoiceView';
import { Sheet } from './Sheet';
import { Toggle } from './Toggle';

const opts = <K extends keyof typeof DOC_STYLE_NAMES>(group: K, keys: readonly string[]) => keys.map((k) => ({ value: k, name: (DOC_STYLE_NAMES[group] as Record<string, string>)[k] ?? k }));

/** The summary card every editor shows for the page's look. */
export function DocStyleCard({ style, disabled, onEdit, row = false }: { style: DocStyle; disabled?: boolean; onEdit: () => void; /** One line of an inset list instead of a card. */ row?: boolean }) {
  return <SummaryCard row={row} title="Document style" disabled={disabled} onEdit={onEdit} summary={docStyleSummary(parseDocStyle(style))} />;
}

/**
 * Edit how a document looks on paper: letterhead and logo, numbered or plain headings, font, size, the colour of the thin rules, page
 * size, margins, the footer line, page numbers and how the signature blocks sit. Each choice is a key the page maps to a value in code.
 * "Make this my default" keeps the look in the business profile, so every new document starts with it.
 */
export function DocStyleSheet({ open, onClose, value, onChange, disabled = false, asDefault = false, title = 'Document style', before }: { open: boolean; onClose: () => void; value: DocStyle; onChange: (s: DocStyle) => void; disabled?: boolean; /** In Agency settings: the one button saves the look as the default for new documents. */ asDefault?: boolean; title?: string; /** Choices that come first in the same sheet (an invoice's design and its two lines), so the whole look is one place. */ before?: ReactNode }) {
  const qc = useQueryClient();
  const s = parseDocStyle(value);
  const set = (patch: Partial<DocStyle>) => onChange(parseDocStyle({ ...s, ...patch }));
  const settings = useAuthed(['agency', 'settings'], () => api.agency(), open);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const makeDefault = useMutation({
    mutationFn: () => api.agencySettings({ profile: { ...(settings.data?.settings.profile ?? emptyProfile()), docStyle: s } }),
    onSuccess: async () => {
      setMsg('Saved. New documents will start with this look.');
      await qc.invalidateQueries({ queryKey: ['agency'] });
      if (asDefault) onClose();
    },
    onError: (e: Error) => setMsg(e.message),
  });
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMsg('');
    try {
      const { url } = await api.uploadMedia(await shrinkImage(file));
      // The picture's address ends in its id; the document keeps only that.
      set({ logo: url.split('/').pop() ?? '' });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'That picture did not upload.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <fieldset disabled={disabled} className="m-0 grid gap-sm border-0 p-0 pb-xl">
        <p className="m-0 text-[14px] font-semibold text-ink-soft">How this document looks on paper and as a PDF. The preview changes as you choose.</p>
        {before}
        <div>
          <span className={LABEL}>Layout</span>
          <Chips label="Layout" options={opts('layout', DOC_LAYOUTS)} value={s.layout ?? 'legal'} onChange={(v) => set({ layout: v as DocStyle['layout'] })} />
          <p className="mt-xs m-0 text-[12px] font-semibold text-ink-mute">Typed is plain type with headings as you typed them, like a typed agreement.</p>
        </div>
        <Toggle on={s.letterhead} onChange={(on) => set({ letterhead: on })} label="Letterhead" hint="Your business name and address at the top of the first page." />
        {s.letterhead && (
          <div>
            <span className={LABEL}>Logo</span>
            <div className="mt-xs flex flex-wrap items-center gap-xs">
              {s.logo && <img src={`/api/public/media/${s.logo}`} alt="Your logo" className="max-h-[48px] max-w-[120px] object-contain" />}
              <label className="toy toy-soft inline-flex min-h-[44px] cursor-pointer items-center rounded-pill border-2 border-line bg-card px-md text-[14px] font-bold">
                {busy ? 'Uploading' : s.logo ? 'Change the logo' : 'Add a logo'}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="sr-only" disabled={busy} onChange={(e) => void upload(e.target.files?.[0])} />
              </label>
              {s.logo && (
                <Button size="sm" variant="ghost" onClick={() => set({ logo: '' })}>
                  Remove
                </Button>
              )}
            </div>
            <p className="mt-xs m-0 text-[12px] font-semibold text-ink-mute">Without a logo the letterhead is text only.</p>
          </div>
        )}
        <div>
          <span className={LABEL}>Headings</span>
          <Chips label="Headings" options={opts('heading', DOC_HEADINGS)} value={s.heading} onChange={(v) => set({ heading: v as DocStyle['heading'] })} />
        </div>
        <div>
          <span className={LABEL}>Font</span>
          <Chips label="Font" options={opts('font', DOC_FONTS)} value={s.font} onChange={(v) => set({ font: v as DocStyle['font'] })} />
        </div>
        <div>
          <span className={LABEL}>Size</span>
          <Chips label="Size" options={opts('size', DOC_SIZES)} value={s.size} onChange={(v) => set({ size: v as DocStyle['size'] })} />
        </div>
        <div>
          <span className={LABEL}>Colour of the rules and headings</span>
          <Chips label="Colour of the rules and headings" options={opts('accent', DOC_ACCENTS)} value={s.accent} onChange={(v) => set({ accent: v as DocStyle['accent'] })} />
        </div>
        <div>
          <span className={LABEL}>Page</span>
          <Chips label="Page" options={opts('page', DOC_PAGES)} value={s.page} onChange={(v) => set({ page: v as DocStyle['page'] })} />
        </div>
        <div>
          <span className={LABEL}>Margins</span>
          <Chips label="Margins" options={opts('margin', DOC_MARGINS)} value={s.margin} onChange={(v) => set({ margin: v as DocStyle['margin'] })} />
        </div>
        <Field id="doc-footer" label="Line at the foot of every page" value={s.footer} onChange={(v) => set({ footer: v })} max={DOC_FOOTER_MAX} placeholder="Your business name, address, GSTIN" />
        <Toggle on={s.pageNumbers} onChange={(on) => set({ pageNumbers: on })} label="Page numbers" hint="“Page 1 of 3” at the foot of every page." />
        <div>
          <span className={LABEL}>Signature blocks</span>
          <Chips label="Signature blocks" options={opts('signLayout', DOC_SIGN_LAYOUTS)} value={s.signLayout} onChange={(v) => set({ signLayout: v as DocStyle['signLayout'] })} />
        </div>
        <p className="m-0 text-[12px] font-semibold text-ink-mute">The running title and page numbers appear in Chrome and Edge. Other browsers print the page without them.</p>
        {msg && (
          <p role="status" className="m-0 text-[14px] font-bold">
            {msg}
          </p>
        )}
        <div className="flex flex-wrap gap-xs">
          {asDefault ? (
            <>
              <Button onClick={() => makeDefault.mutate()} disabled={makeDefault.isPending || !settings.data}>
                {makeDefault.isPending ? 'Saving' : 'Save as my default'}
              </Button>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onClose}>Done</Button>
              <Button variant="outline" onClick={() => makeDefault.mutate()} disabled={makeDefault.isPending || !settings.data}>
                {makeDefault.isPending ? 'Saving' : 'Make this my default'}
              </Button>
            </>
          )}
        </div>
      </fieldset>
    </Sheet>
  );
}
