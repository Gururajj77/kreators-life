import { useMutation } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { Button } from '../components/Button';
import { api } from '../lib/api';
import { SiteLayout } from '../site/SiteLayout';

/** The page behind the unsubscribe link in a marketing email: one tap, no sign-in, and it says what it did. */
export function Unsubscribe() {
  const { token = '' } = useParams();
  const stop = useMutation({ mutationFn: () => api.unsubscribe(token) });
  return (
    <SiteLayout wide={false}>
      <header className="pt-lg">
        <p className="m-0 type-eyebrow text-ink-mute">kreators.app</p>
        <h1 className="type-hook mt-sm text-display-1">Unsubscribe</h1>
        <p className="mt-xs m-0 text-pretty text-prose text-ink-soft">
          {stop.isSuccess ? 'Done. You will not get news and offers from kreators.app by email any more. Receipts and password emails still reach you, since you need them.' : 'Stop news and offers by email from kreators.app. Receipts and password emails still reach you.'}
        </p>
      </header>
      {!stop.isSuccess && (
        <div className="mt-md">
          <Button onClick={() => stop.mutate()} disabled={stop.isPending}>
            {stop.isPending ? 'Stopping' : 'Unsubscribe'}
          </Button>
        </div>
      )}
      {stop.isError && (
        <p role="alert" className="mt-sm m-0 text-subhead">
          That link did not work. It may be old. You can also turn this off under Profile, Privacy choices.
        </p>
      )}
      <p className="mt-md m-0 text-subhead">
        <Link to="/" className="underline underline-offset-4">
          Back to kreators.app
        </Link>
      </p>
    </SiteLayout>
  );
}
