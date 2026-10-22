import { lazy } from 'react';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 9.2, F-CURR-002 section 10 (row GU-5): the grown-up side of an unsaved
 * first quest (People on this device's first-quest row, the guest-only gate on PIN setup) is a chunk of its own
 * (`guest-keep-chunk.tsx`), loaded only when a live record is kept on the device, so the start bundle does not grow by
 * it. Both parts come from the one literal `import()` below; the post-build check holds the chunk (`SCREEN_CHUNKS`).
 */
const load = () => import('./guest-keep-chunk');

/** People on this device's first-quest row with Keep as a learner and Remove the first quest. */
export const GuestPeopleRow = lazy(() => load().then((m) => ({ default: m.GuestPeopleRow })));

/** The guest-only gate's line and Remove the first quest on PIN setup. */
export const GuestOnlyGateBox = lazy(() => load().then((m) => ({ default: m.GuestOnlyGateBox })));
