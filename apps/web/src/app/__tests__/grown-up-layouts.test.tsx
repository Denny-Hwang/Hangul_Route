import { describe, expect, it } from 'vitest';
import { GrownUpLayout } from '@/components/console/GrownUpLayout';
import * as accountLayout from '../(console)/account/layout';
import * as parentLayout from '../(console)/parent/layout';
import * as signinLayout from '../(console)/signin/layout';
import * as startLayout from '../(console)/start/layout';
import * as teachLayout from '../(console)/teach/layout';

/**
 * F-APP-001 section 3.7: every grown-up page uses the one shared layout (`LocaleProvider`,
 * `ConsoleAuthProvider`, `GrownUpLock`). Each grown-up prefix of the console holds a layout that
 * renders `GrownUpLayout`, so a page added under it (A-5c `/account/billing`) is never served
 * without the sign-in check and the lock, and never without its locale.
 */
const LAYOUTS = [
  ['/signin', signinLayout],
  ['/start', startLayout],
  ['/teach', teachLayout],
  ['/parent', parentLayout],
  ['/account', accountLayout],
] as const;

describe('grown-up layouts', () => {
  it.each(LAYOUTS)('%s renders the shared grown-up layout and is not indexed', (_prefix, mod) => {
    const element = mod.default({ children: null }) as { type: unknown };
    expect(element.type).toBe(GrownUpLayout);
    expect(mod.metadata?.robots).toEqual({ index: false, follow: false });
  });

  // app-first-run (2026-10-21): the static title is what a tab shows before the client sets the localized
  // `console.docTitle`, and what a Spanish or Korean grown-up's tab showed for good on a slow load. It names no
  // English-only "Console"; /signin keeps its own title (the OA rows own that page).
  it.each(LAYOUTS.filter(([prefix]) => prefix !== '/signin'))('%s has the neutral static title', (_prefix, mod) => {
    expect(mod.metadata?.title).toBe('Hangul Route');
    expect(String(mod.metadata?.title)).not.toMatch(/console/i);
  });
});
