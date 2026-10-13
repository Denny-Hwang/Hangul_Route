import type { AdultPersona } from '@hangul-route/content-schema';
import React, { createContext, useContext } from 'react';
import type { BrowseBundle } from '../../logic/browse/bundle';
import type { ResolvedPass } from '../../logic/browse/pass';

/**
 * What every All lessons screen knows about this visit (F-BROWSE-001 sections
 * 4.1 to 4.3): the pass the root resolved, the one `BrowseBundle` it built,
 * the effective content switch read once at boot, the last grown-up persona
 * (a persona code, never a name) and whether the device is online. No learner
 * is ever part of it.
 */
export interface BrowseSession {
  /** The active pass; `null` while the Access screen is the only screen. */
  pass: Extract<ResolvedPass, { status: 'active' }> | null;
  bundle: BrowseBundle;
  /** `gatingActive(flags, bundleOs())`, never the raw flag (BD6). */
  gatingEnabled: boolean;
  lastPersona: AdultPersona | null;
  online: boolean;
}

const BrowseSessionContext = createContext<BrowseSession | null>(null);

export function BrowseSessionProvider({ value, children }: { value: BrowseSession; children: React.ReactNode }): React.ReactElement {
  return <BrowseSessionContext.Provider value={value}>{children}</BrowseSessionContext.Provider>;
}

/** The visit, for a screen of the browse stack; `BrowseApp` always provides it. */
export function useBrowseSession(): BrowseSession {
  const session = useContext(BrowseSessionContext);
  if (session === null) throw new Error('useBrowseSession outside BrowseApp');
  return session;
}
