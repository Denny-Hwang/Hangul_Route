import { pickRoot } from './app-root.web';
import { PRESENTER_PATH } from './presenter.web';

/**
 * [ Present this ] hand-off on the web (F-BROWSE-001 BR-13, section 4.6;
 * F-TCH-004 section 3.2). The presenter is a root of this same build, so
 * the link is same-origin and the deck rides only in the fragment.
 */

/**
 * True when a tab at `/present` boots the presenter: the root chooser picks the presenter root for
 * it, and `index.ts` hands that root to `PresenterApp` (F-TCH-004 PR 6, #591; the presenter
 * isolation e2e opens `/present` on the release build and finds the presenter, not the learner app).
 */
export function presenterRootExists(): boolean {
  return pickRoot({ pathname: PRESENTER_PATH }) === 'presenter';
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
