import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { SearchBox } from '../components/SearchBox';

/** The search page: the same box as on Home, with the keyboard already open. Results land under it. */
export function Search() {
  return (
    <Screen columns={false}>
      <header className="pt-lg">
        <BackLink to="/home">Home</BackLink>
        <h1 className="text-large-title">Search</h1>
        <div className="mt-md">
          <SearchBox placeholder="Tasks, journals, knowledge, products, people" autoFocus />
        </div>
      </header>
    </Screen>
  );
}
