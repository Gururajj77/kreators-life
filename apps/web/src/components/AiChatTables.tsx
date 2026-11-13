import { useQueryClient } from '@tanstack/react-query';
import { lazyNamed } from '../lib/lazy';
import { keys, useMe } from '../lib/queries';
import { Fold } from './Fold';
import { Section } from './Section';
import { SkeletonList } from './Skeleton';
import { Suspense } from 'react';
import { useAiChatOn } from './TableSwitches';

const AiTablesShare = lazyNamed(() => import('./AiTablesShare'), 'AiTablesShare');

/**
 * Profile, "AI chat" (2026-11-14, the founder: "give one toggle for ai chat access just next to coach button too and even in profile section"):
 * the tables the assistant and the Companion may read, in one closed fold, the same yes as Show to AI chat at the top of each table. Shown
 * while either AI chat is on for the person; the list and the registry download only when the fold opens.
 */
export function AiChatTables() {
  const qc = useQueryClient();
  const me = useMe();
  const on = useAiChatOn();
  if (!on || !me.data) return null;
  const shared = me.data.user.aiTables ?? [];
  return (
    <Section id="ai-chat" title="AI chat" lede="Pick the tables the assistant and the Companion may read.">
      <Fold id="ai-tables" title="Tables AI chat can read" hint={`${shared.length} shared`}>
        <div className="pt-sm">
          <Suspense fallback={<SkeletonList count={1} lines={2} label="Loading the tables" />}>
            <AiTablesShare shared={shared} onSaved={() => void qc.invalidateQueries({ queryKey: keys.me })} />
          </Suspense>
        </div>
      </Fold>
    </Section>
  );
}
