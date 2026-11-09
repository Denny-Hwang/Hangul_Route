import { describe, expect, it, vi } from 'vitest';
import { ACCOUNT_QUERY_ROOT, accountQueryKey, clearAccountQueries } from '../queries';

/** F-AUTH-004 sections 7.4 and 8.1 (row NS-2; CS-N4): account queries are cancelled, then removed, then removed again. */

describe('account query keys', () => {
  it('start with "account"', () => {
    expect(ACCOUNT_QUERY_ROOT).toBe('account');
    expect(accountQueryKey('roster', 'space:a')).toEqual(['account', 'roster', 'space:a']);
  });
});

describe('clearAccountQueries', () => {
  it('cancels first, removes at once, and removes again once the cancel settled', async () => {
    const log: string[] = [];
    let settle: () => void = () => undefined;
    const client = {
      cancelQueries: vi.fn((filters: { queryKey: readonly unknown[] }) => {
        log.push(`cancel ${JSON.stringify(filters.queryKey)}`);
        return new Promise<void>((resolve) => {
          settle = resolve;
        });
      }),
      removeQueries: vi.fn((filters: { queryKey: readonly unknown[] }) => {
        log.push(`remove ${JSON.stringify(filters.queryKey)}`);
      }),
    };
    const done = clearAccountQueries(client);
    expect(log).toEqual(['cancel ["account"]', 'remove ["account"]']);
    settle();
    await done;
    expect(log).toEqual(['cancel ["account"]', 'remove ["account"]', 'remove ["account"]']);
  });

  it('a cancel that fails still removes', async () => {
    const client = { cancelQueries: vi.fn(async () => Promise.reject(new Error('x'))), removeQueries: vi.fn() };
    await clearAccountQueries(client);
    expect(client.removeQueries).toHaveBeenCalledTimes(2);
  });
});
