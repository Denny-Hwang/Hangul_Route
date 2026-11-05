import type { ProgressSnapshot } from '@hangul-route/content-schema';
import type { ReactElement } from 'react';
import { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The switch as BL-10 will set it: the blend pieces on.
vi.mock('../../../config/flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../config/flags')>();
  return { ...actual, flags: { ...actual.flags, routeBlendEnabled: true } };
});

import { blendedMeta } from '../../../logic/homework/__tests__/curriculum-fixture';
import type { DeriveSource } from '../../../logic/homework/plan-derivation';
import type { BlendHome } from '../../../logic/route/blend-view';
import { setPracticePlacer, type PracticePlacer } from '../../../logic/route/practice-days';
import { cleanup, render } from '../../../test-support/render';
import { useRouteBlendHome } from '../use-route-blend';

/**
 * Home's Refresh on a fresh launch (AMENDMENTS-ROUTE-CLASS-BLEND section 9.4, row BL-8): Home computes Refresh before
 * the practice-days chunk is in. When every derived homework item is already done, loading the placer writes no new
 * snapshot, so nothing Home passes in changes. Refresh must still move to the learner's own day once the placer is in.
 */

afterEach(async () => {
  await cleanup();
  setPracticePlacer(null);
});

const TODAY = '2026-11-10';
/** A Thursday class whose Refresh sits on the class's Sunday; the learner practices on Tuesday. */
const SOURCE: DeriveSource = {
  id: 'plan:thu',
  kind: 'class',
  assignedAt: '2026-11-01T00:00:00.000Z',
  items: [],
  meta: blendedMeta({ startDate: '2026-11-02', weeks: 2, lectureDays: ['thu'], practiceDays: ['fri', 'sun', 'tue'], refresh: [{ date: '2026-11-08', cellIds: ['episode:x'] }] }),
};
const SOURCES: readonly DeriveSource[] = [SOURCE];
// Every derived homework item done: loading the placer changes no homework, so no new snapshot is written.
const SNAPSHOT = {
  quests: [],
  placements: [],
  homework: [],
  practiceDays: [{ planId: 'plan:thu', days: ['tue'], updatedAt: '2026-11-01T00:00:00.000Z' }],
} as unknown as ProgressSnapshot;

/** Stands in for the chunk's placer: the learner's Refresh lands on their Tuesday. */
const placer: PracticePlacer = (source) => ({ ...source, meta: { ...source.meta!, refresh: [{ date: TODAY, cellIds: ['episode:x'] }] } });

const seen: BlendHome[] = [];
const isQuestOpen = (): boolean => true;
function Probe(): ReactElement | null {
  seen.push(useRouteBlendHome('profile:a', SNAPSHOT, SOURCES, TODAY, isQuestOpen));
  return null;
}

describe('useRouteBlendHome', () => {
  it('moves Refresh to the learner\'s day when the placer comes in, with the same snapshot and sources', async () => {
    seen.length = 0;
    await render(<Probe />);
    // Before the chunk: the class's own Refresh day (Sunday), so nothing today.
    expect(seen.at(-1)?.refresh).toBeNull();
    await act(async () => {
      setPracticePlacer(placer);
    });
    expect(seen.at(-1)?.refresh).toEqual({ kind: 'daily-review' });
  });
});
