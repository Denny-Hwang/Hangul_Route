import type { TierSource } from '@hangul-route/content-schema';
import { LOCALES, findBannedWord, getMessages, type UiLocale } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import * as paywall from '../paywall';
import {
  billingNote,
  billingPressStep,
  consoleBillingUrl,
  pendingBillingStep,
  planCardView,
  planTexts,
  planView,
  paywallState,
  type PlanView,
} from '../paywall';
import type { DeviceAudience } from '../profiles/learner-type';

/**
 * F-BILL-002 B-9 (sections 4.7, 4.8, 6.2, 6.3, wireframe billing/plan-status, mock
 * design/screens/billing/plan-status.md): the status-only learner Plan screen and the Profile
 * plan card, as view models. The screen renders only what these return, so a scan of
 * `planTexts` is a scan of everything the screen can show.
 */

const en = getMessages('en');
const family: TierSource = { kind: 'family', spaceId: 'space:f', name: 'Kim family' };
const klass: TierSource = { kind: 'class', spaceId: 'space:c', name: 'Sunday Class A' };
const school: TierSource = { kind: 'school', spaceId: 'space:s', name: 'Maple School' };

const AUDIENCES: readonly DeviceAudience[] = ['family', 'self'];
const PLATFORMS = ['web', 'ios', 'android'] as const;
/** Every tier and source the inbox can hand the screen (section 4.7's rows). */
const TIERS: ReadonlyArray<{ tier: 'free' | 'premium'; source: TierSource | null }> = [
  { tier: 'free', source: null },
  { tier: 'premium', source: family },
  { tier: 'premium', source: null },
  { tier: 'premium', source: klass },
  { tier: 'premium', source: school },
];

function everyView(locale: UiLocale = 'en'): Array<{ key: string; platform: string; view: PlanView }> {
  const m = getMessages(locale);
  return PLATFORMS.flatMap((platform) =>
    AUDIENCES.flatMap((audience) =>
      TIERS.map(({ tier, source }) => ({
        key: `${locale}:${platform}:${audience}:${tier}:${source?.kind ?? 'none'}`,
        platform,
        view: planView({ tier, source, audience, name: 'Mina', platform }, m),
      })),
    ),
  );
}

describe('paywallState (F-ENT-001 §3.5, unchanged)', () => {
  it('picks covered / premium / free from the tier and its source', () => {
    expect(paywallState('free', null)).toBe('free');
    expect(paywallState('free', klass)).toBe('free');
    expect(paywallState('premium', null)).toBe('premium');
    expect(paywallState('premium', family)).toBe('premium');
    expect(paywallState('premium', klass)).toBe('covered');
    expect(paywallState('premium', school)).toBe('covered');
  });
});

describe('planView: the words per state, source and audience (§4.7, §6.2)', () => {
  const p = en.caregiver.plan;
  const view = (tier: 'free' | 'premium', source: TierSource | null, audience: DeviceAudience, name: string | null = 'Mina'): PlanView =>
    planView({ tier, source, audience, name, platform: 'ios' }, en);

  it('covered by a class or school: the space by name, Hoya cheering, no slot', () => {
    const v = view('premium', klass, 'family');
    expect(v).toMatchObject({ state: 'covered', pose: 'cheering', title: 'Mina is covered by Sunday Class A.', lines: ['Everything is open while they are in it.'], freeSlotLine: null, guidanceSlot: false });
    expect(view('premium', school, 'self')).toMatchObject({ title: "You're covered by Maple School.", lines: ['Everything is open while you are in it.'] });
  });

  it('covered with no space name falls back to "the class"', () => {
    expect(view('premium', { ...klass, name: '' }, 'family').title).toBe('Mina is covered by the class.');
    expect(view('premium', { ...klass, name: '  ' }, 'self').title).toBe("You're covered by the class.");
  });

  it('full route from the family plan, and with no source (legacy subscription): the guidance slot follows', () => {
    expect(view('premium', family, 'family')).toMatchObject({ state: 'premium', pose: 'cheering', title: 'Mina has the full route.', lines: ["From your family's Family Plan."], freeSlotLine: null, guidanceSlot: true });
    expect(view('premium', family, 'self')).toMatchObject({ title: 'You have the full route.', lines: ['From your Family Plan.'] });
    expect(view('premium', null, 'family')).toMatchObject({ title: 'Mina has the full route.', lines: ['Everything is open.'], guidanceSlot: true });
    expect(view('premium', null, 'self')).toMatchObject({ title: 'You have the full route.', lines: ['Everything is open.'] });
  });

  it('free: Hoya idle, the free slot holds "Stage 1 is always free." until F-ENT-003 fills it', () => {
    expect(view('free', null, 'family')).toMatchObject({ state: 'free', pose: 'idle', title: 'Mina is on the free plan.', lines: [], freeSlotLine: 'Stage 1 is always free.', guidanceSlot: false });
    expect(view('free', null, 'self').title).toBe("You're on the free plan.");
  });

  it('the summary is a11y.planStatus with the Profile card state word; the name falls back to "Your learner"', () => {
    expect(view('free', null, 'family').summary).toBe('Mina: Free plan.');
    expect(view('premium', family, 'family').summary).toBe('Mina: Full route.');
    expect(view('premium', klass, 'self').summary).toBe('Mina: Full route.');
    const nameless = view('free', null, 'family', null);
    expect(nameless.title).toBe('Your learner is on the free plan.');
    expect(nameless.summary).toBe('Your learner: Free plan.');
    expect(view('free', null, 'family', '   ').title).toBe('Your learner is on the free plan.');
  });

  it('names the screen "Plan" and keeps Back to journey', () => {
    const v = view('free', null, 'family');
    expect(v.heading).toBe(p.title);
    expect(v.back).toBe('Back to journey');
  });
});

describe('Open billing is web only (§4.7, §4.8)', () => {
  it('the web gets the caption per audience, the button and its hint on every state', () => {
    for (const { key, platform, view } of everyView()) {
      if (platform !== 'web') continue;
      expect(view.billing, key).not.toBeNull();
      expect(view.billing?.cta, key).toBe('Open billing');
      expect(view.billing?.hint, key).toBe('Opens the billing page');
    }
    const web = (audience: DeviceAudience): PlanView => planView({ tier: 'free', source: null, audience, name: 'Mina', platform: 'web' }, en);
    expect(web('family').billing?.caption).toBe('Plans and receipts are on the billing page for grown-ups.');
    expect(web('self').billing?.caption).toBe('Your plan and receipts are on the billing page.');
  });

  it('native builds get no billing block at all', () => {
    for (const { key, platform, view } of everyView()) if (platform !== 'web') expect(view.billing, key).toBeNull();
  });

  it('a native build renders no deny-list word, in every state, audience and locale (§4.8 rule 1)', () => {
    const DENY: Record<UiLocale, readonly string[]> = {
      en: ['web', 'website', 'browser', 'hangulroute.com', 'billing page', 'console'],
      es: ['web', 'sitio', 'navegador', 'hangulroute.com', 'página de facturación', 'consola'],
      ko: ['웹', '사이트', '브라우저', 'hangulroute.com', '결제 페이지', '콘솔'],
    };
    for (const locale of LOCALES) {
      for (const { key, platform, view } of everyView(locale)) {
        if (platform === 'web') continue;
        const text = planTexts(view).join(' \n ').toLowerCase();
        for (const word of DENY[locale]) {
          const hit = locale === 'ko' ? text.includes(word) : new RegExp(`(^|[^a-zà-ɏ])${word.replace(/\./g, '\\.')}([^a-zà-ɏ]|$)`).test(text);
          expect(hit, `${key}: "${word}"`).toBe(false);
        }
      }
    }
  });

  it('no state shows a price, an amount, a purchase word or a banned learner word, on any platform or locale', () => {
    const PURCHASE: Record<UiLocale, RegExp> = {
      en: /\b(premium|price|buy|buying|pay|payment|purchase|unlock|unlocks|unlocked|trial|offer|promo|terms|lifetime)\b/i,
      es: /\b(premium|precio|compra|comprar|paga|pagar|desbloquea|prueba|oferta|promo)\b/i,
      ko: /프리미엄|가격|구매|결제하|결제해|체험|잠금 해제|할인/,
    };
    for (const locale of LOCALES) {
      for (const { key, view } of everyView(locale)) {
        for (const text of planTexts(view)) {
          expect(text, key).not.toMatch(/[$€£₩]|\d+[.,]\d{2}|\bUSD\b/);
          expect(text, key).not.toMatch(PURCHASE[locale]);
          expect(findBannedWord(text, locale, 'learner'), `${key}: ${text}`).toBeNull();
        }
      }
    }
  });

  it('planTexts lists every string the view carries', () => {
    const v = planView({ tier: 'free', source: null, audience: 'family', name: 'Mina', platform: 'web' }, en);
    expect(planTexts(v)).toEqual([
      'Plan',
      'Mina: Free plan.',
      'Mina is on the free plan.',
      'Stage 1 is always free.',
      'Plans and receipts are on the billing page for grown-ups.',
      'Open billing',
      'Opens the billing page',
      'Back to journey',
    ]);
    const native = planView({ tier: 'premium', source: klass, audience: 'self', name: 'Rio', platform: 'android' }, en);
    expect(planTexts(native)).toEqual(['Plan', 'Rio: Full route.', "You're covered by Sunday Class A.", 'Everything is open while you are in it.', 'Back to journey']);
  });
});

describe('Open billing through the gate (§4.7: destination Billing)', () => {
  it('opens inside the tap when the gate opens directly, else asks the gate first', () => {
    expect(billingPressStep(true)).toBe('open');
    expect(billingPressStep(false)).toBe('gate');
  });

  it('back on the Plan screen: opens once the gate is through, drops a cancelled gate, ignores a plain return', () => {
    expect(pendingBillingStep(false, true)).toBe('none');
    expect(pendingBillingStep(false, false)).toBe('none');
    expect(pendingBillingStep(true, true)).toBe('open');
    expect(pendingBillingStep(true, false)).toBe('drop');
  });

  it('a hand-off that did not open shows the address to type; an opened one shows nothing', () => {
    const url = 'https://hangulroute.com/teach/billing';
    expect(billingNote('opened', url, en)).toBeNull();
    expect(billingNote('failed', url, en)).toBe('Open https://hangulroute.com/teach/billing in a browser.');
    expect(billingNote('offline', url, en)).toBe('Open https://hangulroute.com/teach/billing in a browser.');
  });

  it("keeps today's target: the console billing page (B-9b moves it to the app host)", () => {
    expect(consoleBillingUrl({})).toBe('https://hangulroute.com/teach/billing');
    expect(consoleBillingUrl({ EXPO_PUBLIC_CONSOLE_URL: 'https://staging.example/ ' })).toBe('https://staging.example/teach/billing');
    expect(consoleBillingUrl()).toMatch(/\/teach\/billing$/);
  });
});

describe('planCardView: the Profile plan card for every tier (§4.7, §6.3)', () => {
  const card = en.learner.profile.plan;

  it('free: Free plan, the free note, the Free pill, Plan details', () => {
    expect(planCardView('free', null, card)).toEqual({ title: 'Free plan', note: 'Stage 1 is free. More stages are on the way.', pill: 'Free', tone: 'neutral', cta: 'Plan details' });
  });

  it('full route: Full route, "Everything is open" with the source when it has a name, the Active pill', () => {
    expect(planCardView('premium', klass, card)).toEqual({ title: 'Full route', note: 'Everything is open, from Sunday Class A.', pill: 'Active', tone: 'success', cta: 'Plan details' });
    expect(planCardView('premium', family, card).note).toBe('Everything is open, from Kim family.');
    expect(planCardView('premium', null, card).note).toBe('Everything is open.');
    expect(planCardView('premium', { ...school, name: '' }, card).note).toBe('Everything is open.');
  });

  it('never says Premium, unlock or buy, in any locale (§4.8 rule 2)', () => {
    for (const locale of LOCALES) {
      const c = getMessages(locale).learner.profile.plan;
      for (const v of [planCardView('free', null, c), planCardView('premium', klass, c), planCardView('premium', null, c)]) {
        for (const text of [v.title, v.note, v.pill, v.cta]) {
          expect(text, locale).not.toMatch(/premium|unlock|\bbuy\b|desbloque|프리미엄|잠금 해제|구매/i);
          expect(findBannedWord(text, locale, 'learner'), `${locale}: ${text}`).toBeNull();
        }
      }
    }
  });
});

describe('the price-bearing paywall helpers are gone (§4.7 "Removed from the learner side")', () => {
  it('exports no offer, price or bullets builder', () => {
    expect('familyOffer' in paywall).toBe(false);
    expect('premiumBullets' in paywall).toBe(false);
  });
});
