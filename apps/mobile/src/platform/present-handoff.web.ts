import { pickRoot } from './app-root.web';
import { PRESENTER_MOUNTED } from './presenter-mount';

/**
 * [ Present this ] hand-off on the web (F-BROWSE-001 BR-13, section 4.6;
 * F-TCH-004 section 3.2). The presenter is a root of this same build, so
 * the link is same-origin and the deck rides only in the fragment.
 */

const PRESENTER_PATH = '/present';

/**
 * True only when a tab at `/present` really mounts `PresenterApp`: the root chooser picks the
 * presenter root for it and `index.ts` hands that root to `PresenterApp` (`presenter-mount.ts`,
 * F-TCH-004 TD1). A chosen root alone is not enough, because until PR 6 mounts `PresenterApp`
 * that root boots the learner `App`, which must never open on a classroom screen.
 */
export function presenterRootExists(mounted: boolean = PRESENTER_MOUNTED): boolean {
  return mounted && pickRoot({ pathname: PRESENTER_PATH }) === 'presenter';
}

type TabHandle = { opener: unknown } | null;

/**
 * Opens `href` (a `/present#d=…` link) in a new tab, synchronously inside
 * the tap so no pop-up blocker stops it. Not with the `noopener` feature,
 * which makes `window.open` return null even when the tab opens; the handle
 * is checked instead (null: blocked) and its `opener` cleared at once, so
 * the presenter has no handle back to All lessons and no roster hand-off
 * can reach it (no names, D12). False when nothing opened.
 */
export function openPresenter(href: string): boolean {
  if (!href.startsWith(`${PRESENTER_PATH}#`)) return false;
  const g = globalThis as { open?: (url: string, target: string) => TabHandle };
  if (typeof g.open !== 'function') return false;
  let tab: TabHandle;
  try {
    tab = g.open(href, '_blank');
  } catch {
    return false;
  }
  if (!tab) return false;
  try {
    tab.opener = null;
  } catch {
    // A browser that will not let the opener be cleared has opened the tab all the same.
  }
  return true;
}
