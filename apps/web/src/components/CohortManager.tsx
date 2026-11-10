import type { ConnectPerson } from '@kreators/shared/connect';
import { useRef, useState } from 'react';
import { connectApi } from '../lib/connectApi';
import { Button } from './Button';
import { PersonField } from './ConnectPersonField';
import { ErrorLine } from './ErrorLine';
import { Fold } from './Fold';
import { Section } from './Section';

/**
 * Who runs a cohort, and the team's way to change it (2026-11-10, the founder: "the team can change a cohort's manager"), on the cohort
 * page for an admin, or staff with Cohorts on a public program (the server's `canSetManager`, the same rule the route checks). The change
 * is PATCH /school/cohorts/:id/manager: the new and the old manager are told, and it is audited. Connect people does the same.
 */
export function CohortManager({ cohortId, managerId, managerName, onChanged }: { cohortId: string; managerId: string | null; managerName: string | null; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState('');
  const [person, setPerson] = useState<ConnectPerson | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [said, setSaid] = useState('');
  // A double tap or two Enters before the button shows it is busy sends once.
  const saving = useRef(false);
  const save = async () => {
    if (!person || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      // The manager this page shows goes with it: a change someone made since is refused, and the page reads it again.
      const r = await connectApi.setCohortManager(cohortId, person.id, managerId);
      setSaid(`${r.managerName} runs it now. Both managers were told.`);
      setWho('');
      setOpen(false);
      onChanged();
    } catch (e) {
      setError(e);
      // Changed somewhere else: read the page again, so the line above names who runs it now.
      onChanged();
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <Section id="cohort-manager-heading" title="Who runs it" lede={managerName ? `${managerName} runs this cohort.` : 'Nobody runs this cohort yet.'}>
      <Fold title="Change the manager" open={open} onOpenChange={setOpen}>
        <form
          className="grid gap-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <PersonField door={null} label="New manager" value={who} onChange={setWho} onFound={setPerson} />
          <ErrorLine e={error} />
          <div className="flex justify-end">
            <Button type="submit" variant="outline" disabled={!person || busy}>
              Make them the manager
            </Button>
          </div>
        </form>
      </Fold>
      {said && (
        <p role="status" className="mt-xs m-0 text-subhead font-semibold">
          {said}
        </p>
      )}
    </Section>
  );
}
