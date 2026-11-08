import { useSession } from '../lib/store';
import { BOOK_PAGE } from './content';

// Out of Books.tsx (2026-11-07), so the landing page's Books band does not bring the Books page into the first download.
/** Where "Read the course in the app" goes: the Book page for someone signed in, through sign-in for a visitor. */
export function useBookEntry(): string {
  const token = useSession((s) => s.token);
  return token ? BOOK_PAGE : `/signin?next=${encodeURIComponent(BOOK_PAGE)}`;
}
