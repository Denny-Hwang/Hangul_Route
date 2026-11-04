import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readAttention, useApprovalsWaiting, type ApprovalCounts, type ApprovalsOptions } from '@/components/console/MovesEntry';
import { resetTransferLockForTests } from '@/lib/console/transfer-lock';

/**
 * AMENDMENTS-GROWNUP-UX GX-D5, section 3.4: `useApprovalsWaiting` counts everything that waits for a space's answer —
 * re-links (whatever CLASS_TRANSFER says), transfers whose own step waits, and teacher moves into the class (missing
 * before GX-1) — reads on mount, on focus and on `refreshKey`, and never on a timer.
 */
type Result = { ok: true; data: unknown } | { ok: false; error: string; status: number };
const ok = (data: unknown): Result => ({ ok: true, data });
const NOW = new Date('2026-10-31T12:00:00.000Z');
const later = new Date(NOW.getTime() + 5 * 60_000).toISOString();

const calls: Array<{ name: string; id: string }> = [];
const state = { relinkFails: false };
const read = (name: string, answer: () => Result) => async (id: string) => {
  calls.push({ name, id });
  return answer();
};
const api = {
  relinkRequests: read('relinkRequests', () => (state.relinkFails ? { ok: false, error: 'network', status: 0 } : ok([{ id: 'relink:a', learnerId: 'profile:a', learnerName: 'A', deviceId: 'd', platform: null, requestedAt: NOW.toISOString(), expiresAt: later, status: 'pending' }]))),
  transferRequests: read('transferRequests', () =>
    ok({ requests: [{ id: 't1', role: 'destination', status: 'requested', steps: { learner: 'yes', source: 'yes', destination: 'waiting' } }, { id: 't2', role: 'destination', status: 'requested', steps: { learner: 'yes', source: 'yes', destination: 'yes' } }] }),
  ),
  classMoves: read('classMoves', () =>
    ok({
      outgoing: [],
      incoming: [
        { id: 'move:1', kind: 'accept', status: 'waiting', from: { name: 'Class C' }, learner: { alias: 'J. K.', avatar: 'bear', level: '5-7' }, createdAt: NOW.toISOString(), at: null },
        { id: 'move:2', kind: 'direct', status: 'waiting', from: { name: 'Class C' }, learner: null, createdAt: NOW.toISOString(), at: null },
      ],
    }),
  ),
} as unknown as Parameters<typeof useApprovalsWaiting>[0];

const listeners = new Set<() => void>();
const fakeDocument = {
  visibilityState: 'visible',
  addEventListener: (type: string, l: () => void) => {
    if (type === 'visibilitychange') listeners.add(l);
  },
  removeEventListener: (type: string, l: () => void) => {
    if (type === 'visibilitychange') listeners.delete(l);
  },
};

let latest: Record<string, ApprovalCounts> = {};
function Probe({ ids, refreshKey = 0, options }: { ids: string[]; refreshKey?: number; options?: ApprovalsOptions }): null {
  latest = useApprovalsWaiting(api, ids, refreshKey, options);
  return null;
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(NOW);
  vi.stubGlobal('document', fakeDocument);
  vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
  resetTransferLockForTests();
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  calls.length = 0;
  listeners.clear();
  latest = {};
  state.relinkFails = false;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetTransferLockForTests();
});

async function mount(el: JSX.Element): Promise<void> {
  await act(async () => {
    mounted = create(el);
  });
}

const count = (name: string): number => calls.filter((c) => c.name === name).length;

describe('useApprovalsWaiting (section 3.4)', () => {
  it('counts re-links, transfers whose own step waits and teacher moves to accept', async () => {
    await mount(<Probe ids={['space:a']} />);
    expect(latest).toEqual({ 'space:a': { relinks: 1, moves: 2, all: 3 } });
  });

  it('class moves off with one pending re-link: the count is 1 and no move is asked for', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'off');
    await mount(<Probe ids={['space:a']} />);
    expect(latest).toEqual({ 'space:a': { relinks: 1, moves: 0, all: 1 } });
    expect(count('transferRequests') + count('classMoves')).toBe(0);
  });

  it('class moves off and re-links not asked: no read at all', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'off');
    await mount(<Probe ids={['space:a']} options={{ relinks: false }} />);
    expect(calls).toEqual([]);
    expect(latest).toEqual({});
  });

  it('options leave out the re-link read and the teacher-move read (a family has none)', async () => {
    await mount(<Probe ids={['space:a']} options={{ relinks: false, classMoves: false }} />);
    expect(calls.map((c) => c.name)).toEqual(['transferRequests']);
    expect(latest).toEqual({ 'space:a': { relinks: 0, moves: 1, all: 1 } });
  });

  it('a failed read counts as nothing waiting, never a guess', async () => {
    state.relinkFails = true;
    await mount(<Probe ids={['space:a']} />);
    expect(latest['space:a']?.relinks).toBe(0);
  });

  it('refreshKey reads again; without one there is no timer: 10 minutes in view ask nothing more', async () => {
    await mount(<Probe ids={['space:a']} />);
    const first = calls.length;
    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(calls.length).toBe(first);
    await act(async () => {
      mounted?.update(<Probe ids={['space:a']} refreshKey={1} />);
    });
    expect(calls.length).toBe(first * 2);
  });

  it('reads again when the tab comes back into view (at most every 30 s)', async () => {
    await mount(<Probe ids={['space:a']} />);
    const first = calls.length;
    vi.setSystemTime(NOW.getTime() + 31_000);
    await act(async () => {
      for (const l of [...listeners]) l();
    });
    expect(calls.length).toBe(first * 2);
  });

  it('a space with a readable GX-W attention asks nothing; the moves part still follows the flag', async () => {
    await mount(<Probe ids={['space:a', 'space:b']} options={{ attention: { 'space:a': { relinks: 2, moves: 1, relinkExpiresAt: later } } }} />);
    expect(latest['space:a']).toEqual({ relinks: 2, moves: 1, all: 3 });
    expect(calls.every((c) => c.id === 'space:b')).toBe(true);
    act(() => mounted?.unmount());
    calls.length = 0;
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'off');
    await mount(<Probe ids={['space:a']} options={{ attention: { 'space:a': { relinks: 2, moves: 1 } } }} />);
    expect(latest['space:a']).toEqual({ relinks: 2, moves: 0, all: 2 });
    expect(calls).toEqual([]);
  });

  it('readAttention is lenient', () => {
    expect(readAttention({ relinks: 1, moves: 0 })).toEqual({ relinks: 1, moves: 0 });
    expect(readAttention({ relinks: 1.7, moves: 2 })).toEqual({ relinks: 1, moves: 2 });
    expect(readAttention({ relinks: -1, moves: 0 })).toBeNull();
    expect(readAttention({ relinks: '1', moves: 0 })).toBeNull();
    expect(readAttention([1, 2])).toBeNull();
    expect(readAttention(null)).toBeNull();
  });
});
