import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, unknown>();
let failRead = false;
vi.mock('../../../platform/storage', () => ({
  readJsonStrict: vi.fn(async (k: string) => {
    if (failRead) throw new Error('storage down');
    return store.has(k) ? store.get(k) : null;
  }),
  writeJson: vi.fn(async (k: string, v: unknown) => void store.set(k, v)),
  removeKey: vi.fn(async (k: string) => void store.delete(k)),
}));

const { KEPT_WEEKS, doneWeeksOf, markWeekDone, readDoneWeeks } = await import('../done-weeks');
const { WEEK_DROP_KEY } = await import('../../../store/week-drop-store');

/*
 * The done marks of "This week in Korea" on this device (F-CURR-002 §5.7, row CM-48; wireframe A2 and D): only the
 * Home card reads them; never counted, never shown as a list, never sent.
 */

beforeEach(() => {
  store.clear();
  failRead = false;
});

describe('done weeks', () => {
  it('marks a week once, keeps the newest weeks only, and reads them back sorted', async () => {
    await markWeekDone('p1', '2026-11-02');
    await markWeekDone('p1', '2026-10-26');
    await markWeekDone('p1', '2026-11-02');
    expect(await readDoneWeeks('p1')).toEqual(['2026-10-26', '2026-11-02']);
    expect(store.get(WEEK_DROP_KEY('p1'))).toEqual(['2026-10-26', '2026-11-02']);
    expect(await readDoneWeeks('p2')).toEqual([]);
    const many = Array.from({ length: KEPT_WEEKS + 5 }, (_, i) => `2030-01-${String((i % 28) + 1).padStart(2, '0')}`).map((d, i) => `${2030 + Math.floor(i / 28)}${d.slice(4)}`);
    expect(doneWeeksOf(many)).toHaveLength(KEPT_WEEKS);
  });

  it('reads a damaged value as no week, and never writes over a value it could not read', async () => {
    store.set(WEEK_DROP_KEY('p1'), { not: 'a list' });
    expect(await readDoneWeeks('p1')).toEqual([]);
    expect(doneWeeksOf(['x', 3, '2026-11-02'])).toEqual(['2026-11-02']);
    failRead = true;
    expect(await readDoneWeeks('p1')).toEqual([]);
    await markWeekDone('p1', '2026-11-02');
    expect(store.get(WEEK_DROP_KEY('p1'))).toEqual({ not: 'a list' });
  });
});
