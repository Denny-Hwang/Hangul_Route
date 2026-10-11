import type { LayoutClass } from '@hangul-route/design-system';
import { useEffect } from 'react';
import { layoutObservedPayload, shouldEmitObserved } from '../logic/layout/orientation-guard';
import { isStandalone } from '../platform/pwa';
import { track } from '../platform/telemetry';

/** Page lifetime = session: `layout.observed` is sent once. */
let observed = false;

/**
 * `layout.observed` once per session (F-LAYOUT-001 §3.13), as soon as the
 * window size is known (the first web frame can report 0 x 0): classes only,
 * no sizes, no profile id.
 */
export function useLayoutObserved(layout: LayoutClass): void {
  const known = layout.windowWidth > 0 && layout.windowHeight > 0;
  useEffect(() => {
    if (!shouldEmitObserved(observed, layout)) return;
    observed = true;
    void track({ name: 'layout.observed', payload: { ...layoutObservedPayload(layout, isStandalone()) } });
    // Only the first known size counts; later resizes are not re-reported.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [known]);
}
