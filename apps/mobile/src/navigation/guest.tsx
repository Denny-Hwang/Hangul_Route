import { Screen } from '@hangul-route/design-system';
import React, { Suspense, lazy } from 'react';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 6.2 and 7.1, F-CURR-002 section 10 (row GU-3): the `Guest` route of the
 * root stack. The stack itself (`navigation/guest-chunk.tsx`: the guest's quest player, its games, Results, the card
 * page and the Not now card) is a chunk of its own, loaded the first time a guest run opens, so the learner's start
 * bundle does not grow by it. Until it is in (one request, or the precache), a blank canvas, as before the first screen:
 * Welcome never shows first. A failed load reaches the app's crash screen, whose Try again asks again.
 */
const load = (): Promise<{ default: React.ComponentType }> => import('./guest-chunk');
const LazyGuestStack = lazy(load);

export function GuestStack(): React.ReactElement {
  return (
    <Suspense fallback={<Screen tone="canvas">{null}</Screen>}>
      <LazyGuestStack />
    </Suspense>
  );
}

/** Starts loading the chunk ahead of the tap that needs it (Welcome's waiting card). Never throws. */
export function preloadGuestStack(): void {
  load().catch(() => undefined);
}
