import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
}));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
const visibility = vi.hoisted(() => ({ listeners: new Set<(visible: boolean) => void>() }));
vi.mock('../../platform/app-visibility', () => ({
  isAppVisible: () => true,
  subscribeAppVisibility: (listener: (visible: boolean) => void) => {
    visibility.listeners.add(listener);
    return () => visibility.listeners.delete(listener);
  },
}));

import { holdLearnerSession } from '../learner-session';
import { useProgressStore } from '../progress-store';

const emit = (visible: boolean): void => [...visibility.listeners].forEach((l) => l(visible));
const sessions = (): Array<{ id: string; durationSeconds?: number; endedAt?: string }> => useProgressStore.getState().byProfile['p1']?.sessions ?? [];

/**
 * F-REPORT-001 section 3.3.2 (RP-3b): the store and the app-visibility
 * wrapper together. Background or a hidden page ends the open session with
 * its elapsed time; visible again while the screen is mounted begins a new
 * one; a story opened inside a quest joins the quest's session.
 */
describe('store/learner-session (F-REPORT-001 section 3.3.2)', () => {
  beforeEach(() => {
    visibility.listeners.clear();
    useProgressStore.setState({ byProfile: {}, hydratedFor: new Set(['p1']), pendingFor: new Set(), pendingVocabEvents: {}, openSession: null });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-12T09:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('hidden ends the session with its elapsed time and visible begins a new one', () => {
    const release = holdLearnerSession('p1', { owner: 'story:s', streak: false });
    vi.setSystemTime(new Date('2026-10-12T09:02:00.000Z'));
    emit(false);
    expect(sessions()).toMatchObject([{ durationSeconds: 120 }]);
    expect(useProgressStore.getState().openSession).toBeNull();
    vi.setSystemTime(new Date('2026-10-12T10:00:00.000Z'));
    emit(true);
    expect(sessions()).toHaveLength(2);
    vi.setSystemTime(new Date('2026-10-12T10:00:30.000Z'));
    release();
    expect(sessions()[1]).toMatchObject({ id: 'session:time:2026-10-12T10:00:00.000Z', durationSeconds: 30 });
    expect(visibility.listeners.size).toBe(0);
  });

  it('a story inside a quest joins the quest session; leaving the story ends nothing', () => {
    const quest = holdLearnerSession('p1', { owner: 'quest:q', streak: true });
    const story = holdLearnerSession('p1', { owner: 'story:s', streak: false });
    story();
    expect(sessions()).toHaveLength(1);
    expect(useProgressStore.getState().openSession?.owner).toBe('quest:q');
    quest();
    expect(sessions()[0]?.endedAt).toBeDefined();
  });
});
