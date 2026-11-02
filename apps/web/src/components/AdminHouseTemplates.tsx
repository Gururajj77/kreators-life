import { DEFAULT_PAGE_SIZE, pageQuery, type HouseTemplate, type Page, type PageSize } from '@kreators/shared';
import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../lib/api';
import { DataTable } from './DataTable';

const KIND_NAME: Record<string, string> = { invoice: 'Invoice', contract: 'Agreement', doc: 'Document' };
const day = (iso: string) => new Date(iso).toLocaleDateString('en-CA');

/**
 * Admin, Agency house templates. The starting points the super admin made for everyone who uses Agency. Here they are listed, renamed,
 * retired and brought back; a new one is made from the admin's own invoice, agreement or document with "Save as house template" (so it
 * starts from real, finished paper). Everyone else only reads them in the template picker and copies one into their own documents.
 */
export function AdminHouseTemplates({ adminKey }: { adminKey: string }) {
  const [rows, setRows] = useState<HouseTemplate[] | null>(null);
  const [page, setPage] = useState<Page | undefined>(undefined);
  const [ask, setAsk] = useState<{ page: number; size: PageSize }>({ page: 1, size: DEFAULT_PAGE_SIZE });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    void load({ page: 1, size: ask.size });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Starting points for every Agency user, shown beside the built-in ones with a House template badge. They are read only for everyone else: a person copies one into their own documents and can restyle their copy. To make one, open your own invoice, agreement or document in Agency and tap "Save as house template". It never keeps who it was made for, and keeps your business details only if you ticked that box.</p>
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
          empty={rows === null ? 'Loading' : 'No house templates yet.'}
          columns={[
            { key: 'name', label: 'Name', get: (r) => r.name, wrap: true, edit: { kind: 'text', onEdit: (r, v) => change(r, { name: String(v) }) } },
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
