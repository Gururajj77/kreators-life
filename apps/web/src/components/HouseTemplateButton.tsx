import { TEMPLATE_NAME_MAX, type DocTemplateKind } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { adminApi } from '../lib/api';
import { useMe } from '../lib/queries';
import { Button } from './Button';
import { Field } from './InvoiceView';
import { Sheet } from './Sheet';
import { Toggle } from './Toggle';

/** Whether the person signed in is the super admin, the only one who makes a house template. */
export function useSuperAdmin(): boolean {
  return useMe().data?.user.role === 'admin';
}

/**
 * "Save as house template": only the super admin sees it, on any invoice, agreement or other document. A house template is read only for
 * everyone else, who copy it into their own documents. It never keeps who the document was for, and keeps the admin's own business
 * details (sender, bank, tax numbers, logo, footer) only when "include my business details" is ticked. The document pages open this
 * sheet from their More menu.
 */
export function HouseTemplateSheet({ open, onClose, kind, fromId, defaultName, beforeSave }: { open: boolean; onClose: () => void; kind: DocTemplateKind; fromId: string; defaultName: string; beforeSave?: () => Promise<unknown> }) {
  const qc = useQueryClient();
  const admin = useSuperAdmin();
  const [name, setName] = useState('');
  const [include, setInclude] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    if (!open) return;
    setName(defaultName.slice(0, TEMPLATE_NAME_MAX));
    setInclude(false);
    setMsg('');
    // The suggested name is made each time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const make = useMutation({
    mutationFn: async () => {
      if (beforeSave) await beforeSave();
      return adminApi.houseTemplateAdd('', { kind, name: name.trim(), fromId, includeBusiness: include });
    },
    onSuccess: async () => {
      setMsg('Saved. Every Agency user can now start from it.');
      await qc.invalidateQueries({ queryKey: ['agency', 'templates'] });
    },
    onError: (e: Error) => setMsg(e.message),
  });
  if (!admin) return null;
  return (
    <Sheet open={open} onClose={onClose} title="Save as house template">
      <div className="grid gap-sm pb-xl">
        <p className="m-0 text-subhead text-ink-soft">A house template shows to everyone who uses Agency, in the same list as the built-in ones. They cannot change it; they copy it into their own documents and can restyle their copy. It never keeps who this was made for.</p>
        <Field id="house-name" label="Template name" value={name} onChange={setName} max={TEMPLATE_NAME_MAX} />
        <Toggle on={include} onChange={setInclude} label="Include my business details" hint="Your name, address, bank, tax numbers, logo and footer. Leave this off so each person's own details fill in." />
        {msg && (
          <p role="status" className="m-0 text-subhead">
            {msg}
          </p>
        )}
        <div className="flex flex-wrap gap-xs">
          <Button onClick={() => make.mutate()} disabled={!name.trim() || make.isPending}>
            {make.isPending ? 'Saving' : 'Save the house template'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/** The same, as a button of its own, for a place with room for it. */
export function HouseTemplateButton(props: { kind: DocTemplateKind; fromId: string; defaultName: string; beforeSave?: () => Promise<unknown> }) {
  const admin = useSuperAdmin();
  const [open, setOpen] = useState(false);
  if (!admin) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Save as house template
      </Button>
      <HouseTemplateSheet open={open} onClose={() => setOpen(false)} {...props} />
    </>
  );
}
