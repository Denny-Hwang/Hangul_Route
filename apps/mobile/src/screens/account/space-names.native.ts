import type { QueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { spaceItemsOf, type AccountSchoolPage } from '../../logic/account/account-data';
import { AccountLoadError } from '../../logic/account/homes';
import { ACCOUNT_QUERY_ROOT } from '../../logic/account/queries';
import { refusedClass } from '../../logic/account/teacher-home';

/**
 * F-AUTH-004 sections 8.3, 8.4 and 8.8 (row NS-6; design `homes.md` boards 12 and 14, D13): what an account page reads
 * of the answers this session already holds in memory (`['account', …]`, cleared with the session, CS-N4). Nothing is
 * read from storage and nothing is written.
 */

/**
 * D13: a class page is titled with the class's name. Until its roster answers, the name an earlier read of this session
 * holds: the spaces list (the Teacher home's row), or a school page's class list (a school admin is not a member of the
 * class, so the spaces list does not name it). Null when none does.
 */
export function knownSpaceName(client: Pick<QueryClient, 'getQueryData' | 'getQueriesData'>, spaceId: string): string | null {
  const listed = spaceItemsOf(client.getQueryData([ACCOUNT_QUERY_ROOT, 'spaces']))?.find((item) => item.space.id === spaceId);
  if (listed !== undefined) return listed.space.name;
  // A school page's query holds its parsed page (`schoolPageOf` ran in the read).
  for (const [, data] of client.getQueriesData<AccountSchoolPage>({ queryKey: [ACCOUNT_QUERY_ROOT, 'school'] })) {
    const row = data?.classes.find((cls) => cls.space.id === spaceId);
    if (row !== undefined) return row.space.name;
  }
  return null;
}

type Refusal = 'forbidden' | 'not_found' | 'other' | null;

const refusalOf = (error: unknown): Refusal => {
  if (error === null || error === undefined) return null;
  if (error instanceof AccountLoadError && (error.error === 'forbidden' || error.error === 'not_found')) return error.error;
  return 'other';
};

/**
 * Section 8.4 (board 14): the classes of a school page whose own page this session was refused (`403` or `404` on the
 * class's roster or class report). Kept current with the query cache, so Back from a refused class page shows its row
 * as `cantLoad`. A refusal goes when the class reads again successfully, or with the session.
 */
export function useRefusedClasses(client: QueryClient, ids: readonly string[]): ReadonlySet<string> {
  const key = ids.join('\n');
  const snapshot = useCallback((): string => {
    const cache = client.getQueryCache();
    return key
      .split('\n')
      .filter((id) => id !== '')
      .filter((id) =>
        refusedClass([
          ...cache.findAll({ queryKey: [ACCOUNT_QUERY_ROOT, 'roster', id] }).map((q) => refusalOf(q.state.error)),
          ...cache.findAll({ queryKey: [ACCOUNT_QUERY_ROOT, 'class-report', id] }).map((q) => refusalOf(q.state.error)),
        ]),
      )
      .join('\n');
  }, [client, key]);
  const subscribe = useCallback((listener: () => void) => client.getQueryCache().subscribe(listener), [client]);
  const refused = useSyncExternalStore(subscribe, snapshot, snapshot);
  return new Set(refused === '' ? [] : refused.split('\n'));
}
