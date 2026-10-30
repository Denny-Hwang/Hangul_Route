import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readDecodeSprint } from '../sprint-record';

/**
 * F-CURR-002 section 7.1 F9, row CM-32: only a missing or unparsable record is "no record yet"; a failed storage read is
 * not ok, so the sprint writes nothing over a best and a sprint count it could not see.
 */

const storage = vi.hoisted(() => ({ read: vi.fn<(key: string) => Promise<unknown>>() }));
vi.mock('../../../platform/storage', () => ({
  readJsonStrict: (key: string) => storage.read(key),
  writeJson: async () => undefined,
}));

beforeEach(() => storage.read.mockReset());

describe('readDecodeSprint', () => {
  it('a stored record, or none, is ok', async () => {
    storage.read.mockResolvedValueOnce({ v: 1, sprints: 2, best: 5 });
    expect(await readDecodeSprint('p1')).toEqual({ ok: true, raw: { v: 1, sprints: 2, best: 5 } });
    storage.read.mockResolvedValueOnce(null);
    expect(await readDecodeSprint('p1')).toEqual({ ok: true, raw: null });
  });

  it('a failed read is not ok, never an empty record', async () => {
    storage.read.mockRejectedValueOnce(new Error('storage unavailable'));
    expect(await readDecodeSprint('p1')).toEqual({ ok: false });
  });
});
