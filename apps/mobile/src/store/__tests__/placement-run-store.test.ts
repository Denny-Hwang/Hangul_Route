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
    const offer = await usePlacementRunStore.getState().resume('p1', T0 + RESUME_WINDOW_MS, PLACEMENT_BANK.version);
    expect(offer?.kind).toBe('continue');
    const resumed = offer?.saved;
    expect(resumed?.motivation).toBe('curious');
    expect(currentQuestion(resumed?.run as never)).toEqual(before);
    expect(usePlacementRunStore.getState().active['p1']).toEqual(resumed);
  });

  it('a Standard run resumed hours later keeps going: time away never uses up the backstop', async () => {
    usePlacementRunStore.getState().begin('p1', CTX, startRun(PLACEMENT_BANK, config, T0), T0);
    answerFirst('p1', T0 + 1_000);
    await settle();
    usePlacementRunStore.setState({ active: {}, ui: {} });
    const later = T0 + 2 * 60 * 60 * 1000;
    const offer = await usePlacementRunStore.getState().resume('p1', later, PLACEMENT_BANK.version);
    expect(offer?.saved.run.lastTouchMs).toBe(later);
    const next = answerFirst('p1', later + 3_000);
    expect(next?.stop).toBeNull();
    expect(next?.pause).toBeNull();
    expect(next?.responses.at(-1)?.ms).toBe(3_000);
  });

  it('a run that stopped before its result was recorded is offered to finish, not removed', async () => {
    usePlacementRunStore.getState().begin('p1', CTX, startRun(PLACEMENT_BANK, config, T0), T0);
    answerFirst('p1', T0 + 1_000);
    usePlacementRunStore.getState().apply('p1', { type: 'quit', by: 'learner' }, T0 + 2_000);
    await settle();
    // The app closes before finishRun / recordPlacement / discard.
    usePlacementRunStore.setState({ active: {}, ui: {} });
    const offer = await usePlacementRunStore.getState().resume('p1', T0 + 3 * RESUME_WINDOW_MS, PLACEMENT_BANK.version + 1);
    expect(offer?.kind).toBe('finish');
    expect(offer?.saved.run.stop).toBe('quit');
    expect(offer?.saved.savedAtMs).toBe(T0 + 2_000);
    expect(mem.has('placement-run:p1')).toBe(true);
    usePlacementRunStore.getState().discard('p1');
    await settle();
    expect(mem.has('placement-run:p1')).toBe(false);
  });

  it('the run in memory wins over storage', async () => {
    usePlacementRunStore.getState().begin('p1', CTX, startRun(PLACEMENT_BANK, config, T0), T0);
    answerFirst('p1', T0 + 1_000);
    const offer = await usePlacementRunStore.getState().resume('p1', T0 + 5_000, PLACEMENT_BANK.version);
    expect(offer?.saved.run.responses).toHaveLength(1);
    // A stale run held in memory is not offered, and storage is left alone.
    expect(await usePlacementRunStore.getState().resume('p1', T0 + 2 * RESUME_WINDOW_MS, PLACEMENT_BANK.version)).toBeNull();
  });

  it('a run begun while a resume read is in flight is neither replaced nor removed', async () => {
    const old = startRun(PLACEMENT_BANK, { ...config, seed: 1 }, T0);
    mem.set('placement-run:p1', { version: 1, savedAtMs: T0, testLocale: 'en', source: 'home', run: old });
    const pending = usePlacementRunStore.getState().resume('p1', T0 + RESUME_WINDOW_MS + 1, PLACEMENT_BANK.version);
    const fresh = startRun(PLACEMENT_BANK, { ...config, seed: 2 }, T0 + RESUME_WINDOW_MS + 1);
    usePlacementRunStore.getState().begin('p1', CTX, fresh, T0 + RESUME_WINDOW_MS + 1);
    const offer = await pending;
    await settle();
    expect(offer?.saved.run.config.seed).toBe(2);
    expect(usePlacementRunStore.getState().active['p1']?.run.config.seed).toBe(2);
    expect((mem.get('placement-run:p1') as { run: { config: { seed: number } } }).run.config.seed).toBe(2);
  });

  it('a discard while a resume read is in flight wins', async () => {
    usePlacementRunStore.getState().begin('p1', CTX, startRun(PLACEMENT_BANK, config, T0), T0);
    await settle();
    usePlacementRunStore.setState({ active: {}, ui: {} });
    const pending = usePlacementRunStore.getState().resume('p1', T0 + 1_000, PLACEMENT_BANK.version);
    usePlacementRunStore.getState().discard('p1');
    expect(await pending).toBeNull();
    expect(usePlacementRunStore.getState().active['p1']).toBeUndefined();
  });

  it('discards a stale run or one from another bank version silently', async () => {
    usePlacementRunStore.getState().begin('p1', CTX, startRun(PLACEMENT_BANK, config, T0), T0);
    usePlacementRunStore.getState().begin('p2', CTX, startRun(PLACEMENT_BANK, config, T0), T0);
    await settle();
    usePlacementRunStore.setState({ active: {}, ui: {} });
    expect(await usePlacementRunStore.getState().resume('p1', T0 + RESUME_WINDOW_MS + 1, PLACEMENT_BANK.version)).toBeNull();
    expect(mem.has('placement-run:p1')).toBe(false);
    await settle();
    expect(await usePlacementRunStore.getState().resume('p2', T0 + 1, PLACEMENT_BANK.version + 1)).toBeNull();
    expect(mem.has('placement-run:p2')).toBe(false);
    expect(await usePlacementRunStore.getState().resume('p3', T0, PLACEMENT_BANK.version)).toBeNull();
  });

  it('a stop with no answer offers nothing and is removed', async () => {
    usePlacementRunStore.getState().begin('p1', CTX, startRun(PLACEMENT_BANK, config, T0), T0);
    usePlacementRunStore.getState().apply('p1', { type: 'quit', by: 'learner' }, T0 + 5);
    await settle();
    usePlacementRunStore.setState({ active: {}, ui: {} });
    expect(await usePlacementRunStore.getState().resume('p1', T0 + 10, PLACEMENT_BANK.version)).toBeNull();
    await settle();
    expect(mem.has('placement-run:p1')).toBe(false);
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
    await store.markDeclined('p1', '2026-10-01T00:00:00Z');
    await store.markDismissed('p1', '2026-10-02T00:00:00Z');
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

  it('a mark before loadUi keeps the other stored timestamp', async () => {
    mem.set('placement-ui:p1', { declinedAt: '2026-10-01T00:00:00Z' });
    await usePlacementRunStore.getState().markDismissed('p1', '2026-10-02T00:00:00Z');
    await settle();
    expect(mem.get('placement-ui:p1')).toEqual({ declinedAt: '2026-10-01T00:00:00Z', dismissedAt: '2026-10-02T00:00:00Z' });
    mem.set('placement-ui:p2', { dismissedAt: '2026-10-02T00:00:00Z' });
    await Promise.all([
      usePlacementRunStore.getState().markDeclined('p2', '2026-10-03T00:00:00Z'),
      usePlacementRunStore.getState().markDismissed('p2', '2026-10-04T00:00:00Z'),
    ]);
    await settle();
    expect(usePlacementRunStore.getState().ui['p2']).toEqual({ declinedAt: '2026-10-03T00:00:00Z', dismissedAt: '2026-10-04T00:00:00Z' });
  });
});
