import { describe, expect, it } from 'vitest';
import type { Episode } from '@hangul-route/content-schema';
import { routeCursor } from '../cursor';
import { BUNDLE_8, STAGE1_8, episode, quest, snapshotWith } from './fixtures/bundle-2026-10';

const base = { quests: BUNDLE_8.quests, episodes: BUNDLE_8.episodes };

describe('routeCursor (F-ROUTE-001 section 3.5)', () => {
  it('starts at the first Stage 1 quest', () => {
    expect(routeCursor({ ...base, snapshot: snapshotWith([]) })?.id).toBe('quest:stage1-letters-q1');
  });

  it('returns undefined at rest', () => {
    const all = BUNDLE_8.quests.map((q) => q.id);
    expect(routeCursor({ ...base, snapshot: snapshotWith(all) })).toBeUndefined();
  });

  it('skips placed-out quests', () => {
    const skip = new Set(['quest:stage1-letters-q1', 'quest:stage1-letters-q2']);
    expect(routeCursor({ ...base, snapshot: snapshotWith([]), skipQuestIds: skip })?.id).toBe('quest:stage1-letters-q3');
    expect(routeCursor({ ...base, snapshot: snapshotWith([]), skipQuestIds: new Set() })?.id).toBe('quest:stage1-letters-q1');
  });

  it('is tier-aware: an unentitled stage is never the cursor', () => {
    const snapshot = snapshotWith(STAGE1_8);
    expect(routeCursor({ ...base, snapshot })?.id).toBe('quest:stage2-life-q1');
    expect(routeCursor({ ...base, snapshot, isEntitled: (s) => s === 'stage1' })).toBeUndefined();
  });

  it('never offers a shelf story quest', () => {
    const shelf: Episode = { ...episode('stage1', 'letters', 'Shelf', ['quest:story-x']), id: 'episode:shelf-x', placement: 'shelf' };
    const quests = [quest('quest:story-x', 'X', ['story-read']), ...BUNDLE_8.quests];
    const all = BUNDLE_8.quests.map((q) => q.id);
    expect(routeCursor({ quests, episodes: [shelf, ...BUNDLE_8.episodes], snapshot: snapshotWith(all) })).toBeUndefined();
  });
});
