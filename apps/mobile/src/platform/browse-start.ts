import type { BrowsePass } from '@hangul-route/content-schema';
import { readBootFragment, type BootFragment } from '../logic/browse/boot';
import type { ResolvedPass } from '../logic/browse/pass';
import { clearGrownUpSession } from './browse';
import { resolveSessionNow } from './browse-boot';
import { canGoBack, takeFragment } from './browse-env';
import { applyBrowseFences } from './browse-fences';

/**
 * The browse root's first step, during its first render (F-BROWSE-001
 * sections 4.1, 4.3, 4.4 and 4.10; BR-6). The order is the contract:
 *
 * 1. the storage write fence, the telemetry fence and the browse telemetry
 *    queue (BD3), before anything can write or send;
 * 2. the link's fragment, taken out of the address;
 * 3. the grown-up unlock and the console session of this tab are removed when
 *    the tab has no earlier page to go back to (`canGoBack` false: a new tab,
 *    which `window.open` gives a copy of `sessionStorage`, or an address typed
 *    in). BD1 keeps both only so [ Close ] lands on the console page that
 *    opened All lessons in this tab; a tab that cannot go back there keeps
 *    nothing (BR-6 review; F-APP-001 section 3.9 as amended by BR-0b);
 * 4. the session pass, read synchronously, before first paint.
 *
 * Nothing here sends an event: `browse.opened` waits for the resolved pass.
 */
export interface BrowseStart {
  fragment: BootFragment;
  /** The session pass resolved before first paint, when it is active. */
  fast: { session: BrowsePass; resolved: ResolvedPass } | null;
}

export function startBrowse(now: number): BrowseStart {
  applyBrowseFences();
  const fragment = readBootFragment(takeFragment());
  if (!canGoBack()) clearGrownUpSession();
  return { fragment, fast: resolveSessionNow(now) };
}
