/**
 * F-AUTH-004 sections 7.4 and 8.1 (row NS-2; CS-N4, ND-10): the account pages are cached in memory only, under keys
 * that start with `['account', ...]`, and are forgotten when the grown-up session closes. Pure over the part of
 * `@tanstack/react-query`'s `QueryClient` it needs; row NS-4 calls `clearAccountQueries` from the session close.
 */

/** The first part of every account query key. */
export const ACCOUNT_QUERY_ROOT = 'account';

/** An account query key: `['account', ...parts]`. */
export function accountQueryKey(...parts: readonly (string | number)[]): readonly (string | number)[] {
  return [ACCOUNT_QUERY_ROOT, ...parts];
}

export interface AccountQueryClient {
  cancelQueries: (filters: { queryKey: readonly unknown[] }) => Promise<void>;
  removeQueries: (filters: { queryKey: readonly unknown[] }) => void;
}

/**
 * Cancels every account query (aborting its request) and removes them all at once, then removes again once the
 * cancel settled, so an answer already on its way cannot put a page back into the cache. Resolves when done.
 */
export async function clearAccountQueries(client: AccountQueryClient): Promise<void> {
  const filters = { queryKey: [ACCOUNT_QUERY_ROOT] };
  const cancelled = client.cancelQueries(filters).catch(() => undefined);
  client.removeQueries(filters);
  await cancelled;
  client.removeQueries(filters);
}
