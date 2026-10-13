import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = new Map<string, unknown>();
const tracked: { name: string; payload?: Record<string, unknown> }[] = [];
vi.mock('../../platform/storage', () => ({
  readJsonStrict: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
}));
vi.mock('../../platform/telemetry', () => ({
  track: vi.fn(async (e: { name: string; payload?: Record<string, unknown> }) => {
    tracked.push(e);
    return true;
  }),
}));

import { readJsonStrict, removeKey, writeJson } from '../../platform/storage';
import { markFreeEndSeen, readFreeEndSeen, resetFreeEndSessionForTests } from '../free-end-seen';
import { notifyProfileRemoved } from '../profile-removal';

beforeEach(() => {
  mem.clear();
  tracked.length = 0;
  resetFreeEndSessionForTests();
});

describe('free-end-seen (F-ENT-003 sections 3.7, 3.8, 3.16)', () => {
  it('is unset for a learner who has not seen the celebration', async () => {
    expect(await readFreeEndSeen('p1')).toBe(false);
  });

  it('marking sets the device key, sends access.free_end_reached once and reads back as seen', async () => {
    await markFreeEndSeen('p1', false);
    await markFreeEndSeen('p1', false);
    expect(mem.get('free-end-seen:p1')).toBe(true);
    expect(tracked).toEqual([{ name: 'access.free_end_reached', profileId: 'p1', payload: { freeDays: 5, placedOut: false } }]);
    expect(await readFreeEndSeen('p1')).toBe(true);
    expect(await readFreeEndSeen('p2')).toBe(false);
  });

  it('a key stored on an earlier run reads as seen', async () => {
    mem.set('free-end-seen:p1', true);
    expect(await readFreeEndSeen('p1')).toBe(true);
  });

  it('a failed write still keeps the celebration to once in this session', async () => {
    vi.mocked(writeJson).mockRejectedValueOnce(new Error('quota'));
    await expect(markFreeEndSeen('p1', true)).resolves.toBeUndefined();
    expect(await readFreeEndSeen('p1')).toBe(true);
    expect(tracked[0]?.payload).toEqual({ freeDays: 5, placedOut: true });
  });

  it('an unreadable key reads as seen (the practice card, never the celebration twice)', async () => {
    vi.mocked(readJsonStrict).mockRejectedValueOnce(new Error('io'));
    expect(await readFreeEndSeen('p1')).toBe(true);
  });

  it('a read that never answers reads as seen after the timeout (Home and Results keep their buttons)', async () => {
    vi.mocked(readJsonStrict).mockImplementationOnce(() => new Promise(() => undefined));
    expect(await readFreeEndSeen('p1', 5)).toBe(true);
  });

  it('removing a profile removes its key and forgets this session', async () => {
    await markFreeEndSeen('gone', false);
    expect(mem.get('free-end-seen:gone')).toBe(true);
    notifyProfileRemoved('gone');
    await Promise.resolve();
    expect(vi.mocked(removeKey)).toHaveBeenCalledWith('free-end-seen:gone');
    expect(mem.has('free-end-seen:gone')).toBe(false);
    expect(await readFreeEndSeen('gone')).toBe(false);
  });
});
