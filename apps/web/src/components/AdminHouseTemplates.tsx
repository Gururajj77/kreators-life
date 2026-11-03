import { DEFAULT_PAGE_SIZE, pageQuery, type ContractDoc, type HouseTemplate, type Invoice, type InvoiceDoc, type InvoiceItem, type Page, type PageSize } from '@kreators/shared';
import { Building2, PencilLine } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { adminApi } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useAutosave } from '../lib/useAutosave';
import { SaveLine } from '../screens/AgencyContract';
import { Button } from './Button';
import { ContractView } from './ContractView';
import { DataTable } from './DataTable';
import { InvoiceView } from './InvoiceView';
import { MoreMenu } from './MoreMenu';
import { BackLink } from './PageHeader';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';
import { FIELD } from '../lib/ui';

const KIND_NAME: Record<string, string> = { invoice: 'Invoice', contract: 'Agreement', doc: 'Document' };
const day = (iso: string) => new Date(iso).toLocaleDateString('en-CA');

/**
 * Admin, Agency house templates. The starting points the super admin made for everyone who uses Agency, listed, then opened as paper
 * (`?tpl=<id>`) and edited in place like any document of their own, saved as you go. A new one is made from the admin's own invoice,
 * agreement or document with "Save as house template". It never carries who a document was for.
 */
export function AdminHouseTemplates({ adminKey }: { adminKey: string }) {
  const [params, setParams] = useSearchParams();
  const tpl = params.get('tpl');
  const [rows, setRows] = useState<HouseTemplate[] | null>(null);
  const [page, setPage] = useState<Page | undefined>(undefined);
  const [ask, setAsk] = useState<{ page: number; size: PageSize }>({ page: 1, size: DEFAULT_PAGE_SIZE });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openTpl = (id: string | null) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (id) n.set('tpl', id);
        else n.delete('tpl');
        return n;
      },
      { preventScrollReset: false },
    );

  const load = useCallback(
    async (next = ask) => {
      setBusy(true);
      setError(null);
      try {
        const r = await adminApi.houseTemplates(adminKey, pageQuery(next.page, next.size));
        setRows(r.templates);
        setPage(r.page);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the house templates.');
      } finally {
        setBusy(false);
      }
    },
    [adminKey, ask],
  );
  useEffect(() => {
    if (!tpl) void load({ page: 1, size: ask.size });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tpl]);

  if (tpl) return <HouseTemplatePaper adminKey={adminKey} id={tpl} onBack={() => openTpl(null)} />;

  const change = async (row: HouseTemplate, body: { name?: string; status?: 'active' | 'retired' }) => {
    setError(null);
    try {
      await adminApi.houseTemplateUpdate(adminKey, row.id, body);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    }
  };

  return (
    <section className="mt-md" aria-labelledby="house-templates-heading">
      <h2 id="house-templates-heading" className="text-[24px]">
        Agency house templates
      </h2>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Starting points every Agency user can copy.</p>
      {error && (
        <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          {error}
        </p>
      )}
      <div className="mt-sm">
        <DataTable<HouseTemplate>
          rows={rows ?? []}
          page={page}
          onPage={(p, size) => {
            const next = { page: p, size };
            setAsk(next);
            void load(next);
          }}
          rowKey={(r) => r.id}
          label="House templates"
          search={false}
          busy={busy}
          empty={rows === null ? 'Loading' : 'No house templates yet. Open your own paper in Agency and choose Save as house template.'}
          columns={[
            {
              key: 'name',
              label: 'Name',
              get: (r) => r.name,
              wrap: true,
              render: (r) => (
                <button type="button" className="min-h-[44px] text-left text-[16px] font-bold underline underline-offset-2" onClick={() => openTpl(r.id)}>
                  {r.name}
                </button>
              ),
            },
            { key: 'kind', label: 'Kind', get: (r) => KIND_NAME[r.kind] ?? r.kind, filter: true },
            { key: 'summary', label: 'Holds', get: (r) => r.summary, wrap: true },
            { key: 'business', label: 'Business details', get: (r) => (r.includeBusiness ? 'Included' : 'Not included'), filter: true },
            { key: 'active', label: 'Active', get: (r) => r.status === 'active', filter: true, edit: { kind: 'toggle', onEdit: (r, v) => change(r, { status: v ? 'active' : 'retired' }) } },
            { key: 'updated', label: 'Changed', get: (r) => day(r.updatedAt), wide: true },
          ]}
        />
      </div>
    </section>
  );
}

type Paper = { contract: ContractDoc | null; invoice: InvoiceDoc | null; items: InvoiceItem[] };

/** One house template as its paper: back, the name, Active or Retired with the save line, one action (Retire or Bring back) and More. */
function HouseTemplatePaper({ adminKey, id, onBack }: { adminKey: string; id: string; onBack: () => void }) {
  const [meta, setMeta] = useState<HouseTemplate | null>(null);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rename, setRename] = useState<string | null>(null);
  const read = useCallback(async () => {
    try {
      const r = await adminApi.houseTemplate(adminKey, id);
      const p = { contract: r.contract, invoice: r.invoice, items: r.items };
      setMeta(r.template);
      setPaper(p);
      return { p, at: r.template.updatedAt };
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open that template.');
      return null;
    }
  }, [adminKey, id]);
  const auto = useAutosave<Paper>({
    value: paper,
    save: async (p, version) => {
      const r = await adminApi.houseTemplateUpdate(adminKey, id, { body: (p.contract ?? p.invoice)!, ...(p.invoice ? { items: p.items } : {}), ifUpdatedAt: version });
      setMeta((m) => (m ? { ...m, updatedAt: r.updatedAt } : m));
      return r.updatedAt;
    },
    restore: setPaper,
    onConflict: () => {
      void read().then((r) => r && auto.reset(r.p, r.at));
    },
    enabled: Boolean(meta),
  });
  useEffect(() => {
    void read().then((r) => r && auto.reset(r.p, r.at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const patch = async (body: { status?: 'active' | 'retired'; includeBusiness?: boolean; name?: string }) => {
    setError(null);
    try {
      await auto.flush();
      const r = await adminApi.houseTemplateUpdate(adminKey, id, { ...body, ifUpdatedAt: auto.version.current });
      const fresh = await read();
      if (fresh) auto.reset(fresh.p, r.updatedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    }
  };
  if (!meta || !paper) {
    return (
      <section className="mt-md">
        <BackLink to="/admin?tab=agencyhouse">House templates</BackLink>
        <p role={error ? 'alert' : 'status'} className="mt-sm m-0 text-[16px] font-semibold text-ink-soft">
          {error ?? 'Opening the template'}
        </p>
      </section>
    );
  }
  const invoice: Invoice | null = paper.invoice
    ? { id, number: 'KR-0000', ownerName: '', ownerHandle: null, clientName: '', clientEmail: '', items: paper.items, totalCents: 0, currency: 'INR', status: 'draft', issueDate: todayLocal(), dueDate: null, note: '', token: '', paidAt: null, createdAt: meta.createdAt, doc: paper.invoice, agencyClientId: null, revisedAt: null }
    : null;
  return (
    <section className="mt-md" aria-labelledby="house-paper-heading">
      <header className="no-print">
        <button type="button" onClick={onBack} className="min-h-[44px] text-[14px] font-bold text-ink-soft underline underline-offset-2">
          House templates
        </button>
        <h2 id="house-paper-heading" className="text-[30px]">
          {meta.name}
        </h2>
        <div className="mt-xs flex flex-wrap items-center gap-sm">
          <StatusTag tone={meta.status === 'active' ? 'good' : 'neutral'}>{meta.status === 'active' ? 'Active' : 'Retired'}</StatusTag>
          <SaveLine words={auto.words} canUndo={auto.canUndo} onUndo={auto.undo} />
        </div>
        <div className="mt-md flex flex-wrap items-center gap-xs">
          <Button onClick={() => void patch({ status: meta.status === 'active' ? 'retired' : 'active' })}>{meta.status === 'active' ? 'Retire' : 'Bring back'}</Button>
          <MoreMenu
            label="More for this template"
            items={[
              { key: 'rename', label: 'Rename', icon: PencilLine, onSelect: () => setRename(meta.name) },
              { key: 'business', label: 'Include my business details', icon: Building2, hint: meta.includeBusiness ? 'On' : 'Off', onSelect: () => void patch({ includeBusiness: !meta.includeBusiness }) },
            ]}
          />
        </div>
        {error && (
          <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {error}
          </p>
        )}
      </header>
      <div className="mt-md">
        {paper.contract && <ContractView audience="owner" kind={meta.kind === 'doc' ? 'document' : 'agreement'} doc={paper.contract} onDocChange={(contract) => setPaper((p) => (p ? { ...p, contract } : p))} />}
        {invoice && (
          <InvoiceView
            invoice={invoice}
            owner
            editor={{
              setDoc: (patchDoc) => setPaper((p) => (p && p.invoice ? { ...p, invoice: { ...p.invoice, ...patchDoc } } : p)),
              setMeta: () => undefined,
              setItems: (items) => setPaper((p) => (p ? { ...p, items } : p)),
            }}
          />
        )}
      </div>
      <Sheet open={rename !== null} onClose={() => setRename(null)} title="Rename">
        <label className="block text-[14px] font-bold" htmlFor="house-name">
          Name
        </label>
        <input id="house-name" value={rename ?? ''} maxLength={60} onChange={(e) => setRename(e.target.value)} className={FIELD} />
        <div className="mt-md flex flex-wrap gap-xs pb-xl">
          <Button
            onClick={() => {
              const name = (rename ?? '').trim();
              setRename(null);
              if (name) void patch({ name });
            }}
          >
            Save
          </Button>
          <Button variant="ghost" onClick={() => setRename(null)}>
            Cancel
          </Button>
        </div>
      </Sheet>
    </section>
  );
}
