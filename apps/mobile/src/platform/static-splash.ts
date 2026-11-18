import type { ComponentType } from 'react';

/** Native variant of `static-splash.web.ts`: a native app has no HTML shell, so the root is registered as it is. */
export function withStaticSplashRemoved<P extends object>(Root: ComponentType<P>): ComponentType<P> {
  return Root;
}
