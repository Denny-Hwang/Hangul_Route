import { currentQuestion, startRun, type PlacementConfig } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
const failWrites = vi.hoisted(() => ({ on: false }));
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    if (failWrites.on) throw new Error('storage full');
    mem.set(k, JSON.parse(JSON.stringify(v)));
  }),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
}));

import { PLACEMENT_BANK } from '../../content/placement.generated';
import { RESUME_WINDOW_MS } from '../../logic/placement/flow';
import { writeJson } from '../../platform/storage';
import { usePlacementRunStore } from '../placement-run-store';

const T0 = 1_760_000_000_000;
const config: PlacementConfig = {
  mode: 'standard',
  revealMode: 'tap',
  audio: true,
  visual: true,
  takeMyTime: false,
  seed: 42,
  exclude: [],
  resolvesPicture: () => true,
};
const CTX = { testLocale: 'en', source: 'home' } as const;

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

function answerFirst(profileId: string, nowMs: number) {
  const store = usePlacementRunStore.getState();
  const question = currentQuestion(store.active[profileId]?.run as never);
  const option = question?.options[0]?.id as string;
  return store.apply(profileId, { type: 'answer', optionId: option }, nowMs);
}

beforeEach(() => {
  mem.clear();
  failWrites.on = false;
  vi.mocked(writeJson).mockClear();
  usePlacementRunStore.setState({ active: {}, ui: {} });
});

describe('placement-run-store (F-PLC-001 section 3.1 step 8, section 3.8)', () => {
  it('saves the run when it begins and after every answer', async () => {
    const store = usePlacementRunStore.getState();
    store.begin('p1', CTX, startRun(PLACEMENT_BANK, config, T0), T0);
    await settle();
    expect(mem.get('placement-run:p1')).toMatchObject({ version: 1, savedAtMs: T0, testLocale: 'en', source: 'home' });
    answerFirst('p1', T0 + 1_000);
    await settle();
    expect((mem.get('placement-run:p1') as { run: { responses: unknown[] } }).run.responses).toHaveLength(1);
    expect((mem.get('placement-run:p1') as { savedAtMs: number }).savedAtMs).toBe(T0 + 1_000);
    usePlacementRunStore.getState().apply('p1', { type: 'notSure' }, T0 + 2_000);
    await settle();
    expect((mem.get('placement-run:p1') as { run: { responses: unknown[] } }).run.responses).toHaveLength(2);
  });

  it('events that record nothing (touch, tick) do not write', async () => {
    usePlacementRunStore.getState().begin('p1', CTX, startRun(PLACEMENT_BANK, config, T0), T0);
    await settle();
    vi.mocked(writeJson).mockClear();
    const after = usePlacementRunStore.getState().apply('p1', { type: 'touch' }, T0 + 10);
    await settle();
    expect(after?.lastTouchMs).toBe(T0 + 10);
    expect(writeJson).not.toHaveBeenCalled();
  });

  it('apply without an active run does nothing', () => {
    expect(usePlacementRunStore.getState().apply('nobody', { type: 'notSure' }, T0)).toBeNull();
  });

  it('resumes within 24 hours at the same question with the same options', async () => {
    usePlacementRunStore.getState().begin('p1', { ...CTX, motivation: 'curious' }, startRun(PLACEMENT_BANK, config, T0), T0);
    answerFirst('p1', T0 + 1_000);
    await settle();
    const before = currentQuestion(usePlacementRunStore.getState().active['p1']?.run as never);
    usePlacementRunStore.setState({ active: {}, ui: {} });
    const resumed = await usePlacementRunStore.getState().resume('p1', T0 + RESUME_WINDOW_MS, PLACEMENT_BANK.version);
    expect(resumed?.motivation).toBe('curious');
    expect(currentQuestion(resumed?.run as never)).toEqual(before);
    expect(usePlacementRunStore.getState().active['p1']).toEqual(resumed);
  });

  it('discards a stale run or one from another bank version silently', async () => {
    usePlacementRunStore.getState().begin('p1', CTX, startRun(PLACEMENT_BANK, config, T0), T0);
    await settle();
    expect(await usePlacementRunStore.getState().resume('p1', T0 + RESUME_WINDOW_MS + 1, PLACEMENT_BANK.version)).toBeNull();
    expect(mem.has('placement-run:p1')).toBe(false);
    usePlacementRunStore.getState().begin('p2', CTX, startRun(PLACEMENT_BANK, config, T0), T0);
    await settle();
    expect(await usePlacementRunStore.getState().resume('p2', T0 + 1, PLACEMENT_BANK.version + 1)).toBeNull();
    expect(mem.has('placement-run:p2')).toBe(false);
    expect(await usePlacementRunStore.getState().resume('p3', T0, PLACEMENT_BANK.version)).toBeNull();
  });

  it('a finished run is cleared from memory and storage', async () => {
    usePlacementRunStore.getState().begin('p1', CTX, startRun(PLACEMENT_BANK, config, T0), T0);
    const finished = usePlacementRunStore.getState().apply('p1', { type: 'quit', by: 'learner' }, T0 + 5);
    expect(finished?.stop).toBe('quit');
    usePlacementRunStore.getState().discard('p1');
    await settle();
    expect(usePlacementRunStore.getState().active['p1']).toBeUndefined();
    expect(mem.has('placement-run:p1')).toBe(false);
  });

  it('a failed storage write keeps the run in memory for the session', async () => {
    failWrites.on = true;
    usePlacementRunStore.getState().begin('p1', CTX, startRun(PLACEMENT_BANK, config, T0), T0);
    answerFirst('p1', T0 + 1_000);
    await settle();
    expect(usePlacementRunStore.getState().active['p1']?.run.responses).toHaveLength(1);
    expect(mem.has('placement-run:p1')).toBe(false);
  });

  it('placement-ui records the fork decline and the Home dismissal', async () => {
    const store = usePlacementRunStore.getState();
    expect(await store.loadUi('p1')).toEqual({});
    store.markDeclined('p1', '2026-10-01T00:00:00Z');
    store.markDismissed('p1', '2026-10-02T00:00:00Z');
    await settle();
    expect(mem.get('placement-ui:p1')).toEqual({ declinedAt: '2026-10-01T00:00:00Z', dismissedAt: '2026-10-02T00:00:00Z' });
    usePlacementRunStore.setState({ active: {}, ui: {} });
    expect(await usePlacementRunStore.getState().loadUi('p1')).toEqual({
      declinedAt: '2026-10-01T00:00:00Z',
      dismissedAt: '2026-10-02T00:00:00Z',
    });
    mem.set('placement-ui:p9', { declinedAt: 7 });
    expect(await usePlacementRunStore.getState().loadUi('p9')).toEqual({});
  });
});
