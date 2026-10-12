import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F-BILL-002 B-9 wiring checks on the screen sources (the mobile suite has no React Native renderer;
 * the words and states are tested through `planView` / `planCardView` in paywall.test.ts). These pin
 * what the screens may and may not do: the Plan screen renders only its view model, never a price,
 * never opens a URL itself, and sends Open billing through the gate destination `Billing`; the
 * Profile card opens the Plan screen without a PIN on every tier.
 */
const src = (rel: string): string => readFileSync(join(__dirname, '../..', rel), 'utf8');
const plan = src('screens/paywall/PaywallScreen.tsx');
const profile = src('screens/profile/ProfileScreen.tsx');
const pinEntry = src('screens/parent/PinEntryScreen.tsx');
const types = src('navigation/types.ts');

describe('Plan screen (screens/paywall/PaywallScreen.tsx)', () => {
  it('builds everything it shows from planView, with the platform passed in', () => {
    expect(plan).toMatch(/planView\(\s*\{[^}]*platform: Platform\.OS/);
    expect(plan).not.toMatch(/caregiver\.paywall|messages\.caregiver\.plan\b(?!\.)/);
  });

  it('holds no price, offer, promo hint or store line', () => {
    for (const banned of ['PLAN_PRICING', 'formatUsd', 'familyOffer', 'premiumBullets', 'promoHint', 'paywallBuyOnWeb', 'paywallBuyLater', 'familyOffer(', 'useLocale']) {
      expect(plan, banned).not.toContain(banned);
    }
  });

  it('never opens a URL itself: the hand-off lives in platform/billing-handoff', () => {
    expect(plan).not.toMatch(/\bLinking\b/);
    expect(plan).not.toMatch(/window\.open|openExternalUrl/);
    expect(plan).toContain("from '../../platform/billing-handoff'");
  });

  it('renders the billing block only when the view has one (web), and the two F-ENT-003 slots', () => {
    expect(plan).toMatch(/view\.billing \? \(/);
    expect(plan).toContain('<FreePlanLines');
    expect(plan).toContain('<PlanGuidanceLine');
  });

  it('Open billing asks the gate with destination Billing unless it opens directly', () => {
    expect(plan).toContain("navigation.navigate('PinEntry', { next: 'Billing' })");
    expect(plan).toMatch(/billingPressStep\(/);
    expect(plan).toContain('useFocusEffect');
  });

  it('after the gate the web asks for one more tap (HAND_OFF_NEEDS_TAP), as Sources does: no tab opens outside a tap', () => {
    expect(plan).toMatch(/import \{ HAND_OFF_NEEDS_TAP \} from '\.\.\/\.\.\/platform\/external-link'/);
    expect(plan).toMatch(/pendingBillingStep\(pending\.current, gateOpenNow\(\), HAND_OFF_NEEDS_TAP\)/);
    expect(plan).toContain('const gateDone = view.billing?.gateDone ?? null;');
    expect(plan).toMatch(/step === 'tap-again'[\s\S]{0,80}setNote\(gateDone\);\s*focusForScreenReader\(openRef\.current\);/);
    // The prompt moves focus to Open billing, so the next press is one key or tap away.
    expect(plan).toMatch(/pressableRef=\{openRef\}/);
  });

  it('sends paywall.console_opened only through billingOpenedEvent (codes only, only when billing opened)', () => {
    expect(plan).toMatch(/const event = billingOpenedEvent\(outcome, state\);\s*if \(event\) void track\(\{ \.\.\.event, profileId \}\);/);
    expect(plan).not.toContain("'paywall.console_opened'");
  });

  it('the hand-off note is a polite live region, so the prompt and any failure line are read out on the web', () => {
    expect(plan).toMatch(/accessibilityLiveRegion="polite"/);
  });

  it('the summary heading comes first and carries a11y.planStatus; the button carries the hint', () => {
    const summary = plan.indexOf('accessibilityLabel={view.summary}');
    const back = plan.indexOf('accessibilityLabel={messages.a11y.goBack}');
    expect(summary).toBeGreaterThan(-1);
    expect(back).toBeGreaterThan(summary);
    expect(plan).toContain('accessibilityHint={view.billing.hint}');
  });
});

describe('the gate destination Billing (navigation/types.ts, PinEntryScreen.tsx)', () => {
  it('is a GrownUpDestination', () => {
    expect(types).toMatch(/\| 'Billing'/);
  });

  it('opens the gate and returns to the Plan screen, which finishes the hand-off', () => {
    expect(pinEntry).toMatch(/route\.params\.next === 'Billing'\) \{\s*\/\/[^\n]*\n\s*navigation\.goBack\(\);/);
  });
});

describe('Profile plan card (screens/profile/ProfileScreen.tsx)', () => {
  it('uses planCardView and shows Plan details for every tier, straight to the Plan screen without a PIN', () => {
    expect(profile).toContain('planCardView(');
    expect(profile).toMatch(/label=\{card\.cta\}[^>]*onPress=\{\(\) => navigation\.navigate\('Paywall', \{ from: 'settings' \}\)\}/);
    expect(profile).not.toMatch(/tier !== 'premium' \? \(/);
    expect(profile).not.toMatch(/openGrownUps\('Paywall'\)/);
  });

  it('no longer reads the removed card words', () => {
    for (const gone of ['t.plan.premium', 't.plan.unlocked', 't.plan.unlock']) expect(profile, gone).not.toContain(gone);
  });
});
