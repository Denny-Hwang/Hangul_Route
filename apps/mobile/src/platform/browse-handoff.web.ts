import { BROWSE_PASS_SESSION_KEY, BrowsePassSchema, buildBrowseUrl, type BrowsePass, type BrowseTarget, type Tier } from '@hangul-route/content-schema';
import type { UiLocale } from '@hangul-route/i18n';
import { activeLocale, useLocaleStore } from '../store/locale-store';
import { useProfileStore } from '../store/profile-store';
import { accessTier } from '../store/tier-store';
import { sessionArea, type SessionArea } from './grown-up-handoff.web';

/**
 * The gate hand-off into All lessons (F-BROWSE-001 section 4.3, BR-12a), web only: the learner app, after the
 * PIN, writes a gate pass into this tab's `sessionStorage['hr:browse:pass']` synchronously and only then leaves
 * for `/browse` **in the same tab**. Callers: [ Open all lessons ] on the parent dashboard (no target) and the
 * [ Preview lessons ] rows of the in-app report and the grown-up read-only Learning Route page (a stage target).
 * The pass source and the fragment source are always `'gate'`, whatever screen called it; the address carries
 * content ids and the source only (BD7), never a profile, a scope or a locale.
 *
 * This module runs in the learner app and reads learner stores (the gate rule needs each profile's access tier),
 * so it sits outside the browse isolation scan (`browse-isolation.test.ts` skips `browse-handoff*`). Native builds
 * use the stub (`browse-handoff.ts`, section 4.14).
 */
export interface GateHandoffEnv {
  now: () => number;
  area: () => SessionArea | null;
  /** The access tier of every learner profile on this device (`accessTier`, F-ENT-003). */
  tiers: () => Tier[];
  /** The learner app's UI locale, carried in the pass so All lessons opens in it. */
  locale: () => UiLocale;
  origin: () => string;
  assign: (url: string) => void;
}

/** The gate rule (section 4.2, BD8): `full` when any profile on the device has premium access, else `sampler`. */
export function gateScopeOf(tiers: readonly Tier[]): BrowsePass['scope'] {
  return tiers.includes('premium') ? 'full' : 'sampler';
}

function browserEnv(): GateHandoffEnv {
  return {
    now: () => Date.now(),
    area: sessionArea,
    tiers: () => {
      const now = new Date();
      return useProfileStore.getState().profiles.map((p) => accessTier(p.id, now));
    },
    locale: () => activeLocale(useLocaleStore.getState()),
    origin: () => (globalThis as { location?: { origin?: string } }).location?.origin ?? '',
    assign: (url) => {
      (globalThis as { location?: { assign: (to: string) => void } }).location?.assign(url);
    },
  };
}

/**
 * `openBrowseFromGate(target?)`: writes `BrowsePass { scope: <gate rule>, source: 'gate', issuedAt: now, seen: now,
 * uiLocale }`, then `location.assign(buildBrowseUrl(origin, { target, source: 'gate' }))`: `/browse#s=gate` with no
 * target, `/browse#t=<target>&s=gate` with one. Returns `false` and stays put when the pass cannot be written
 * (missing or blocked storage), since All lessons would only show its Access screen without it.
 */
export function openBrowseFromGate(target?: BrowseTarget, env: GateHandoffEnv = browserEnv()): boolean {
  const now = env.now();
  const parsed = BrowsePassSchema.safeParse({ v: 1, scope: gateScopeOf(env.tiers()), source: 'gate', issuedAt: now, seen: now, uiLocale: env.locale() });
  if (!parsed.success) return false;
  const area = env.area();
  if (area === null) return false;
  try {
    area.setItem(BROWSE_PASS_SESSION_KEY, JSON.stringify(parsed.data));
  } catch {
    return false;
  }
  env.assign(buildBrowseUrl(env.origin(), target === undefined ? { source: 'gate' } : { target, source: 'gate' }));
  return true;
}
