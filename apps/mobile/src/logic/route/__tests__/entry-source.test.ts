import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F-PLAN-002 P2-8b: with `flags.routeEnabled` on by default, the learner entries to the weekly plan
 * (Home's plan slot: the prompt, the Hoya check-in and the moved line; the Profile row) follow
 * `routeEnabledFor(locale)`, so a UI locale whose `learner.weeklyPlan` words have no signed review
 * never shows them (en only). The stack keeps registering the screens on the raw flag, as reports do.
 */
const src = (rel: string): string => readFileSync(join(__dirname, '../../..', rel), 'utf8');
const slot = src('screens/route/PlanPromptCard.tsx');
const profile = src('screens/profile/ProfileScreen.tsx');
const root = src('navigation/root.tsx');

describe('weekly plan entries follow routeEnabledFor(locale) (P2-8b)', () => {
  it("Home's plan slot reads the locale switch, never the raw flag", () => {
    expect(slot).toContain('routeEnabledFor(useLocale())');
    expect(slot).not.toContain('flags.routeEnabled');
  });

  it('the Profile row reads the locale switch, never the raw flag', () => {
    expect(profile).toContain('routeEnabledFor(locale)');
    expect(profile).not.toContain('flags.routeEnabled');
  });

  it('the stack registers the plan screens on the flag', () => {
    for (const name of ['RouteProposal', 'RouteSetup', 'RoutePreview', 'RouteOverview']) {
      expect(root).toMatch(new RegExp(`\\{flags\\.routeEnabled \\? <Stack\\.Screen name="${name}"`));
    }
  });
});
