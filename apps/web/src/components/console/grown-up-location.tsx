'use client';

import { createContext, useContext } from 'react';

/**
 * The path and query of the grown-up page as the App Router has committed them (F-APP-001 section
 * 3.8). `GrownUpGate` reads `usePathname` / `useSearchParams` and provides them here, so the adult
 * frame never reads `window.location` during a render that runs before the router commits a new
 * query (a client navigation from `?id=a` to `?id=b` on a page that stays mounted).
 */
export interface GrownUpLocation {
  pathname: string;
  search: string;
}

export const GrownUpLocationContext = createContext<GrownUpLocation | null>(null);

/** The committed location, or null outside `GrownUpGate` (tests that render a page alone). */
export function useGrownUpLocation(): GrownUpLocation | null {
  return useContext(GrownUpLocationContext);
}
