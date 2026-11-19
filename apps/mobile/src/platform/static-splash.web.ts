import { createElement, useLayoutEffect, type ComponentType } from 'react';

/**
 * The static splash of the HTML shell (AMENDMENTS-FINISH-2026-11 FN-2, `scripts/pwa/static-splash.mjs`): painted with
 * the HTML before the start bundle runs, and removed here, in the layout effect of the app's first commit, so the
 * splash and the first frame swap in one paint (no blank frame between them). Every root the shell boots goes
 * through `withStaticSplashRemoved` in `index.ts`: the learner app, the presenter and All lessons (and the grown-up
 * bounce, which mounts nothing).
 */
export const STATIC_SPLASH_ID = 'hr-splash';

interface DocumentLike {
  getElementById: (id: string) => { remove: () => void } | null;
}

/** Removes the splash; a page without one (native-like test hosts, a second call) is left as it is. Never throws. */
export function removeStaticSplash(doc: DocumentLike | undefined = (globalThis as { document?: DocumentLike }).document): void {
  try {
    doc?.getElementById(STATIC_SPLASH_ID)?.remove();
  } catch {
    // Cosmetic: a splash left behind must never stop the app.
  }
}

/** `Root`, drawn as it is, with the splash removed once its first commit is in the DOM. */
export function withStaticSplashRemoved<P extends object>(Root: ComponentType<P>): ComponentType<P> {
  function StaticSplashRemoved(props: P) {
    useLayoutEffect(() => {
      removeStaticSplash();
    }, []);
    return createElement(Root, props);
  }
  StaticSplashRemoved.displayName = `StaticSplashRemoved(${Root.displayName ?? Root.name ?? 'Root'})`;
  return StaticSplashRemoved;
}
