import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F-BILL-002 B-9 wiring checks on the screen sources (the mobile suite has no React Native renderer;
 * the words and states are tested through `planView` / `planCardView` in paywall.test.ts, the steps
 * through `pendingBillingStep` / `billingPressStep` / `billingOpenedEvent`, and the behaviour by
 * e2e/web/plan-screen.spec.ts). These pin what the screens may and may not do: the Plan screen
 * renders only its view model, never a price, never opens a URL itself, and sends Open billing
 * through the gate destination `Billing`; the Profile card opens the Plan screen without a PIN on
 * every tier. They check identifiers and imports only, never layout or line breaks, so a formatter
 * reflow does not break them. The section 11 render tests follow once the suite has a renderer.
 */
const nav = (route: string, params: string): RegExp => new RegExp(`navigate\\(\\s*'${route}',\\s*\\{\\s*${params}\\s*\\}\\s*\\)`);
const src = (rel: string): string => readFileSync(join(__dirname, '../..', rel), 'utf8');
const plan = src('screens/paywall/PaywallScreen.tsx');
const profile = src('screens/profile/ProfileScreen.tsx');
const pinEntry = src('screens/parent/PinEntryScreen.tsx');
const types = src('navigation/types.ts');

describe('Plan screen (screens/paywall/PaywallScreen.tsx)', () => {
  it('builds everything it shows from planView, with the platform passed in', () => {
    expect(plan).toContain('planView(');
    expect(plan).toMatch(/platform:\s*Platform\.OS/);
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
    expect(plan).toMatch(/view\.billing\s*\?/);
    expect(plan).toContain('<FreePlanLines');
    expect(plan).toContain('<PlanGuidanceLine');
  });

  it('Open billing asks the gate with destination Billing unless it opens directly', () => {
    expect(plan).toMatch(nav('PinEntry', "next:\\s*'Billing'"));
    expect(plan).toMatch(/billingPressStep\(/);
    expect(plan).toContain('useFocusEffect');
  });

  it('after the gate the web asks for one more tap (HAND_OFF_NEEDS_TAP), as Sources does: no tab opens outside a tap', () => {
    expect(plan).toContain("from '../../platform/external-link'");
    expect(plan).toContain('HAND_OFF_NEEDS_TAP');
    expect(plan).toContain('pendingBillingStep(');
    expect(plan).toContain("'tap-again'");
    expect(plan).toContain('view.billing?.gateDone');
    expect(plan).toContain('setNote(gateDone)');
    expect(plan).toContain('focusForScreenReader(openRef.current)');
    // The prompt moves focus to Open billing, so the next press is one key or tap away.
    expect(plan).toMatch(/pressableRef=\{openRef\}/);
  });

  it('sends paywall.console_opened only through billingHandOffStep / billingOpenedEvent (codes only, only when billing opened)', () => {
    expect(plan).toContain('billingHandOffStep(');
    expect(plan).not.toContain("'paywall.console_opened'");
  });

  it('reads the gate through the one shared store helper, not a copy of its own (B-9 review)', () => {
    expect(plan).toContain("import { gateOpensDirectlyNow } from '../../store/gate-now'");
    expect(plan).not.toMatch(/function gateOpenNow|isParentSessionValid/);
  });

  it('the hand-off note is a polite live region, so the prompt and any failure line are read out on the web', () => {
    expect(plan).toContain('accessibilityLiveRegion="polite"');
  });

  it('the summary heading comes first and carries a11y.planStatus; the button carries the hint', () => {
    const summary = plan.indexOf('accessibilityLabel={view.summary}');
    const back = plan.indexOf('accessibilityLabel={messages.a11y.goBack}');
    expect(summary).toBeGreaterThan(-1);
    expect(back).toBeGreaterThan(summary);
    expect(plan).toMatch(/accessibilityHint=\{offline \? needsInternet : view\.billing\.hint\}/);
  });

  it('F-APP-001 A-7: offline with the entries on, Open billing is disabled with "Needs the internet" (sections 3.6, 3.12)', () => {
    // The entries are on exactly where billing opens in this tab (web, flag on: billingOpensSameTab).
    expect(plan).toMatch(/planOpenBlocked\(sameTab, online\)/);
    expect(plan).toContain('disabled={offline}');
    expect(plan).toContain('messages.learner.welcome.grownUps.needsInternet');
    expect(plan).toMatch(/if \(offline\) return;/);
  });
});

describe('Plan screen same-tab billing hand-off (F-BILL-002 B-9b)', () => {
  it('asks platform/billing-handoff whether billing opens in this tab (flag on, web) and passes it to openBilling', () => {
    expect(plan).toMatch(/import \{[^}]*\bbillingOpensSameTab\b[^}]*\} from '\.\.\/\.\.\/platform\/billing-handoff'/);
    expect(plan).toMatch(/const sameTab = billingOpensSameTab\(\)/);
    expect(plan).toContain('openBilling(sameTab)');
  });

  it('never calls openGrownUpArea itself: the branch lives in billing-handoff', () => {
    expect(plan).not.toContain('openGrownUpArea');
    expect(plan).not.toContain("from '../../platform/grown-up-handoff'");
  });

  it('back from the Billing gate, a same-tab hand-off needs no extra tap (no new tab to be blocked)', () => {
    expect(plan).toMatch(/pendingBillingStep\(\s*pending\.current,\s*gateOpensDirectlyNow\(\),\s*HAND_OFF_NEEDS_TAP && !sameTab\s*\)/);
  });

  it('acts on what the hand-off reported through billingHandOffStep, and a stale PIN opens the GrownUpArea PIN screen for billing', () => {
    expect(plan).toContain('billingHandOffStep(');
    expect(plan).toMatch(nav('PinEntry', "next:\\s*'Billing'"));
    expect(plan).toMatch(/navigate\(\s*'PinEntry',\s*grownUpPinParams\(BILLING_HANDOFF\)\s*\)/);
  });

  it('a second press while a hand-off is under way does nothing (B-9b review: openGrownUpArea waits up to 1 s for its event)', () => {
    expect(plan).toMatch(/const busy = useRef\(false\)/);
    expect(plan).toMatch(/if \(busy\.current\) return;\s*busy\.current = true;/);
    expect(plan).toMatch(/finally\s*\{\s*busy\.current = false;\s*\}/);
  });

  it('back from the gate while offline with the flag on, the waiting hand-off does not start (the live network state)', () => {
    expect(plan).toContain("import { isOnline } from '../../platform/online'");
    expect(plan).toMatch(/if \(planOpenBlocked\(sameTab, isOnline\(\)\)\) return;/);
  });
});

describe('the gate destination Billing (navigation/types.ts, PinEntryScreen.tsx)', () => {
  it('is a GrownUpDestination', () => {
    expect(types).toMatch(/\| 'Billing'/);
  });

  it('opens the gate and returns to the Plan screen, which finishes the hand-off', () => {
    const branch = pinEntry.indexOf("=== 'Billing'");
    expect(branch).toBeGreaterThan(-1);
    // The first navigation call after the Billing branch is goBack: the Plan screen finishes the hand-off.
    expect(pinEntry.slice(branch).match(/navigation\.(\w+)\(/)?.[1]).toBe('goBack');
  });
});

describe('Profile plan card (screens/profile/ProfileScreen.tsx)', () => {
  it('uses planCardView and shows Plan details for every tier, straight to the Plan screen without a PIN', () => {
    expect(profile).toContain('planCardView(');
    expect(profile).toContain('label={card.cta}');
    expect(profile).toMatch(nav('Paywall', "from:\\s*'settings'"));
    expect(profile).not.toMatch(/tier !== 'premium' \? \(/);
    expect(profile).not.toMatch(/openGrownUps\('Paywall'\)/);
  });

  it('no longer reads the removed card words', () => {
    for (const gone of ['t.plan.premium', 't.plan.unlocked', 't.plan.unlock']) expect(profile, gone).not.toContain(gone);
  });
});
