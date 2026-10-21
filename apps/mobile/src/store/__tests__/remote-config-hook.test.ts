import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mem = new Map<string, unknown>();
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  readJsonStrict: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, JSON.parse(JSON.stringify(v)));
  }),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
}));
vi.mock('../../platform/app-visibility', () => ({ subscribeAppVisibility: vi.fn(() => () => undefined), isAppVisible: () => true }));
vi.mock('../../platform/sync-api', () => ({ apiBaseUrl: () => null }));
// A later row may raise a flag's built-in pct to 100 once its ramp ends; `goals` stands for such a flag here.
vi.mock('../../config/flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/flags')>();
  return { ...actual, currBuiltInPct: (flag: string) => (flag === 'goals' ? 100 : actual.currBuiltInPct(flag as never)) };
});

import { useProfileStore } from '../profile-store';
import { currFlagOn, REMOTE_CONFIG_KEY, resetRemoteConfigForTests, useCurrFlag, useRemoteConfigStore } from '../remote-config-store';

/**
 * `useCurrFlag` (F-CURR-002 section 12.2, row CM-2): a surface re-renders when the remote copy arrives or the active
 * profile changes, and a flag is never on before the stored copy has been read, so a feature the last known copy
 * turned off cannot flash on at a cold start (offline included) even when its built-in pct is 100.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const seen: boolean[] = [];
function Probe({ flag }: { flag: 'goals' | 'dailyReview' }): null {
  seen.push(useCurrFlag(flag));
  return null;
}

let renderer: ReactTestRenderer | null = null;
async function mount(flag: 'goals' | 'dailyReview'): Promise<void> {
  await act(async () => {
    renderer = TestRenderer.create(React.createElement(Probe, { flag }));
  });
}

beforeEach(() => {
  mem.clear();
  seen.length = 0;
  resetRemoteConfigForTests();
  useProfileStore.setState({ profiles: [], activeId: 'p1', hydrated: true });
});

afterEach(async () => {
  const r = renderer;
  renderer = null;
  if (r) await act(async () => r.unmount());
});

describe('useCurrFlag', () => {
  it('built-in pct 100 and a stored on:false: never on, before or after the stored copy is read', async () => {
    mem.set(REMOTE_CONFIG_KEY, { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { goals: { on: false, pct: 100 } } });
    await mount('goals');
    expect(seen.at(-1)).toBe(false);
    expect(currFlagOn('goals')).toBe(false); // the non-React form holds the same rule
    await act(async () => {
      await useRemoteConfigStore.getState().hydrate();
    });
    expect(useRemoteConfigStore.getState().hydrated).toBe(true);
    expect(seen).not.toContain(true);
  });

  it('built-in pct 100 and no stored copy: off until the store has looked, then the built-in pct', async () => {
    await mount('goals');
    expect(seen).toEqual([false]);
    await act(async () => {
      await useRemoteConfigStore.getState().hydrate();
    });
    expect(seen.at(-1)).toBe(true);
  });

  it('re-renders when refresh keeps a copy and when the active profile changes', async () => {
    await act(async () => {
      await useRemoteConfigStore.getState().hydrate();
    });
    await mount('dailyReview');
    expect(seen.at(-1)).toBe(false); // built-in pct 0
    const body = JSON.stringify({ ok: true, data: { flags: { dailyReview: { on: true, pct: 100 } } } });
    const fetchImpl = vi.fn(async () => new Response(body, { status: 200, headers: { 'cache-control': 'public, max-age=300' } })) as unknown as typeof fetch;
    await act(async () => {
      await useRemoteConfigStore.getState().refresh({ endpoint: 'https://api.test', fetchImpl, now: () => 0 });
    });
    expect(seen.at(-1)).toBe(true);

    // A 50% ramp: switching between a profile inside the bucket and one outside re-renders with each one's answer.
    await act(async () => {
      useRemoteConfigStore.setState({ cache: { v: 1, fetchedAt: 0, maxAgeS: 300, flags: { dailyReview: { on: true, pct: 50 } } } });
    });
    const answers = new Map<string, boolean>();
    for (const id of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8']) {
      await act(async () => {
        useProfileStore.setState({ activeId: id });
      });
      answers.set(id, seen.at(-1)!);
      expect(seen.at(-1), id).toBe(currFlagOn('dailyReview', id));
    }
    expect(new Set(answers.values()).size).toBe(2);
  });
});
