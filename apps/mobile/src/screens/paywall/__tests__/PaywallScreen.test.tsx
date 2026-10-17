import type { Profile, TierSource } from '@hangul-route/content-schema';
import { LOCALES, findBannedWord, getMessages, type UiLocale } from '@hangul-route/i18n';
import React, { useEffect } from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '../../../store/account-store';
import { flags } from '../../../config/flags';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { useTierStore } from '../../../store/tier-store';
import { useUiStore } from '../../../store/ui-store';
import { PRICE, PURCHASE } from '../../../test-support/__tests__/copy-words';
import {
  buttonsNamed,
  byTestId,
  hostNodes,
  press,
  render,
  resetPlatform,
  screenTexts,
  setPlatform,
  textOf,
  unmount,
  type RenderPlatform,
} from '../../../test-support/render';
import { PaywallScreen } from '../PaywallScreen';

/**
 * F-BILL-002 B-13 (section 11; sections 4.7 and 4.8; wireframe billing/plan-status): the learner
 * Plan screen, rendered through react-native-web. Every state on web, iOS and Android, for both
 * audiences: no price, no purchase or banned learner word; native renders no URL-opening control and
 * no word about the web; the web renders one Open billing button that goes through the gate with the
 * destination `Billing`; the free slot reads "Stage 1 is always free." and the guidance slot is empty.
 */

const billing = vi.hoisted(() => ({ openBilling: vi.fn() }));
const telemetry = vi.hoisted(() => ({ track: vi.fn(async () => undefined) }));
const network = vi.hoisted(() => ({ online: true }));

vi.mock('@react-navigation/native', () => ({
  // A screen that mounts is a screen in focus.
  useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
}));
vi.mock('../../../platform/billing-handoff', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../platform/billing-handoff')>()),
  openBilling: billing.openBilling,
}));
// The browser's network state (the web build's `online.web.ts`); online unless a test says not.
vi.mock('../../../platform/online', () => ({
  isOnline: () => network.online,
  subscribeOnline: () => () => undefined,
}));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../platform/telemetry')>()),
  track: telemetry.track,
}));

const PLATFORMS: readonly RenderPlatform[] = ['web', 'ios', 'android'];
const AUDIENCES = ['family', 'self'] as const;
type Audience = (typeof AUDIENCES)[number];

const family: TierSource = { kind: 'family', spaceId: 'space:f', name: 'Kim family' };
const klass: TierSource = { kind: 'class', spaceId: 'space:c', name: 'Sunday Class A' };
const school: TierSource = { kind: 'school', spaceId: 'space:s', name: 'Maple School' };

/** Every tier and source the inbox can hand the screen (section 4.7's rows). */
interface TierCase {
  key: string;
  tier: 'free' | 'premium';
  source: TierSource | null;
}
const FREE: TierCase = { key: 'free', tier: 'free', source: null };
const PREMIUM_FAMILY: TierCase = { key: 'premium-family', tier: 'premium', source: family };
const PREMIUM_LEGACY: TierCase = { key: 'premium-legacy', tier: 'premium', source: null };
const COVERED_CLASS: TierCase = { key: 'covered-class', tier: 'premium', source: klass };
const COVERED_SCHOOL: TierCase = { key: 'covered-school', tier: 'premium', source: school };
const TIERS: readonly TierCase[] = [FREE, PREMIUM_FAMILY, PREMIUM_LEGACY, COVERED_CLASS, COVERED_SCHOOL];

/** Section 4.8 rule 1: no native string mentions the web, a website or buying elsewhere. */
const DENY: Record<UiLocale, readonly string[]> = {
  en: ['web', 'website', 'browser', 'hangulroute.com', 'billing page', 'console'],
  es: ['web', 'sitio', 'navegador', 'hangulroute.com', 'página de facturación', 'consola'],
  ko: ['웹', '사이트', '브라우저', 'hangulroute.com', '결제 페이지', '콘솔'],
};

const LEARNER_ID = 'profile:mina';

function learner(audience: Audience): Profile {
  return {
    id: LEARNER_ID,
    displayName: 'Mina',
    ageGroup: '8-9',
    avatar: 'hoya-orange',
    role: 'learner',
    createdAt: '2026-10-01T00:00:00.000Z',
    learnerType: audience === 'family' ? 'child' : 'self',
  };
}

/** The device: one learner, a grown-up PIN (so the gate asks), no open grown-up session. */
function seed(audience: Audience, tier: TierCase, locale: UiLocale = 'en', pin: string | null = 'pin-hash'): void {
  // es and ko are hidden at launch (LOCALE_STATUS), and a hidden stored locale falls back to English;
  // the QA switch shows them, so the screen really renders in `locale` (`expectLocale` checks it).
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  useProfileStore.setState({ profiles: [learner(audience)], activeId: LEARNER_ID });
  useAccountStore.setState({ parentPinHash: pin, subscription: null });
  useUiStore.setState({ parentGateOpenedAt: null });
  useLocaleStore.setState({ device: locale, byProfile: {} });
  useTierStore.setState({
    byLearner: { [LEARNER_ID]: { tier: tier.tier, source: tier.source, validUntil: null, fetchedAt: '2026-10-14T00:00:00.000Z' } },
    spaceMembers: {},
  });
}

function nav(): { navigate: ReturnType<typeof vi.fn>; goBack: ReturnType<typeof vi.fn> } {
  return { navigate: vi.fn(), goBack: vi.fn() };
}

async function renderPlan(navigation = nav()): Promise<{ root: ReactTestInstance; done: () => Promise<void>; navigation: ReturnType<typeof nav> }> {
  const renderer = await render(<PaywallScreen navigation={navigation as never} route={{ key: 'Paywall', name: 'Paywall', params: { from: 'settings' } } as never} />);
  return { root: renderer.root, done: () => unmount(renderer), navigation };
}

/** Whole-word match in en and es, substring in ko (as the copy checks read words). */
function hasWord(text: string, word: string, locale: UiLocale): boolean {
  const lower = text.toLowerCase();
  if (locale === 'ko') return lower.includes(word);
  return new RegExp(`(^|[^a-zà-ɏ])${word.replace(/\./g, '\\.')}([^a-zà-ɏ]|$)`).test(lower);
}

beforeEach(() => {
  billing.openBilling.mockReset();
  billing.openBilling.mockResolvedValue({ kind: 'browser', outcome: 'opened', url: 'https://hangulroute.com/teach/billing' });
  telemetry.track.mockClear();
  network.online = true;
});

afterEach(() => {
  resetPlatform();
  flags.grownUpHomeEnabled = GROWN_UP_HOME;
});

const GROWN_UP_HOME = flags.grownUpHomeEnabled;

/** The screen rendered in `locale`: its heading is that locale's "Plan". */
function expectLocale(texts: readonly string[], locale: UiLocale, key: string): void {
  expect(texts, `${key}: heading in ${locale}`).toContain(getMessages(locale).caregiver.plan.title);
}

/** Every string on the screen passes the price, purchase and banned learner word checks in `locale`. */
function expectLearnerCopy(texts: readonly string[], locale: UiLocale, key: string): void {
  for (const text of texts) {
    expect(text, `${key}: ${text}`).not.toMatch(PRICE);
    expect(text, `${key}: ${text}`).not.toMatch(PURCHASE[locale]);
    expect(findBannedWord(text, locale, 'learner'), `${key}: ${text}`).toBeNull();
  }
}

describe('PaywallScreen: every state, platform and audience (F-BILL-002 section 11, B-13)', () => {
  for (const platform of PLATFORMS) {
    for (const audience of AUDIENCES) {
      for (const tier of TIERS) {
        it(`${platform} / ${audience} / ${tier.key}: no price, no purchase word, no banned learner word, in every locale`, async () => {
          for (const locale of LOCALES) {
            setPlatform(platform);
            seed(audience, tier, locale);
            const { root, done } = await renderPlan();
            const texts = screenTexts(root);
            expectLocale(texts, locale, locale);
            expectLearnerCopy(texts, locale, locale);
            await done();
          }
        });
      }
    }
  }

  it('the heading is "Plan" and the state title follows the tier and the audience', async () => {
    const cases: ReadonlyArray<[Audience, TierCase, string]> = [
      ['family', FREE, 'Mina is on the free plan.'],
      ['self', FREE, "You're on the free plan."],
      ['family', PREMIUM_FAMILY, 'Mina has the full route.'],
      ['self', PREMIUM_LEGACY, 'You have the full route.'],
      ['family', COVERED_CLASS, 'Mina is covered by Sunday Class A.'],
      ['self', COVERED_SCHOOL, "You're covered by Maple School."],
    ];
    for (const [audience, tier, title] of cases) {
      setPlatform('web');
      seed(audience, tier);
      const { root, done } = await renderPlan();
      const texts = screenTexts(root);
      expect(texts).toContain('Plan');
      expect(texts, `${audience} / ${tier.key}`).toContain(title);
      await done();
    }
  });
});

describe('PaywallScreen on native builds (section 4.8)', () => {
  for (const platform of ['ios', 'android'] as const) {
    it(`${platform}: no URL-opening control and no Open billing, in every state and audience`, async () => {
      for (const audience of AUDIENCES) {
        for (const tier of TIERS) {
          setPlatform(platform);
          seed(audience, tier);
          const { root, done } = await renderPlan();
          const key = `${platform} / ${audience} / ${tier.key}`;
          expect(hostNodes(root, (n) => n.props.href !== undefined), key).toHaveLength(0);
          expect(byTestId(root, 'plan-open-billing'), key).toHaveLength(0);
          expect(buttonsNamed(root, 'Open billing'), key).toHaveLength(0);
          // The only button is the way back, "Back to ..." (the top-left Back is the route's ScreenHeader, drawn by the
          // app's header slot, AMENDMENTS-DISPLAY-NAV section 7.1).
          const buttons = hostNodes(root, (n) => n.props.role === 'button');
          expect(buttons, key).toHaveLength(1);
          await done();
        }
      }
    });

    it(`${platform}: no word about the web, a website or a billing page, in every state, audience and locale`, async () => {
      for (const locale of LOCALES) {
        for (const audience of AUDIENCES) {
          for (const tier of TIERS) {
            setPlatform(platform);
            seed(audience, tier, locale);
            const { root, done } = await renderPlan();
            const key = `${locale} / ${platform} / ${audience} / ${tier.key}`;
            const texts = screenTexts(root);
            expectLocale(texts, locale, key);
            for (const text of texts) {
              for (const word of DENY[locale]) expect(hasWord(text, word, locale), `${key}: "${word}" in "${text}"`).toBe(false);
            }
            expectLearnerCopy(texts, locale, key);
            await done();
          }
        }
      }
    });
  }
});

describe('PaywallScreen on the web (section 4.7)', () => {
  it('renders one Open billing button, under its caption, in every state and audience', async () => {
    for (const audience of AUDIENCES) {
      for (const tier of TIERS) {
        setPlatform('web');
        seed(audience, tier);
        const { root, done } = await renderPlan();
        const key = `${audience} / ${tier.key}`;
        const open = byTestId(root, 'plan-open-billing');
        expect(open, key).toHaveLength(1);
        expect(open[0]?.props.role, key).toBe('button');
        // Its name and label, then the hidden copy of its hint the design system adds on the web.
        expect([...new Set(screenTexts(open[0] as ReactTestInstance))], key).toEqual(['Open billing', 'Opens the billing page']);
        expect(buttonsNamed(root, 'Open billing'), key).toHaveLength(1);
        expect(screenTexts(root), key).toContain(
          audience === 'family' ? 'Plans and receipts are on the billing page for grown-ups.' : 'Your plan and receipts are on the billing page.',
        );
        // Open billing is a button, never a link to a URL.
        expect(hostNodes(root, (n) => n.props.href !== undefined), key).toHaveLength(0);
        await done();
      }
    }
  });

  it('Open billing goes through the gate with the destination Billing when the device needs a PIN, for both audiences', async () => {
    for (const audience of AUDIENCES) {
      for (const tier of TIERS) {
        const key = `${audience} / ${tier.key}`;
        setPlatform('web');
        seed(audience, tier);
        const { root, done, navigation } = await renderPlan();
        await press(byTestId(root, 'plan-open-billing')[0] as ReactTestInstance);
        expect(navigation.navigate, key).toHaveBeenCalledTimes(1);
        expect(navigation.navigate, key).toHaveBeenCalledWith('PinEntry', { next: 'Billing' });
        expect(billing.openBilling, key).not.toHaveBeenCalled();
        await done();
      }
    }
  });

  it('Open billing opens billing directly on a self-only device with no PIN (F-LEARN-001 L7), without the PIN screen', async () => {
    setPlatform('web');
    seed('self', FREE, 'en', null);
    const { root, done, navigation } = await renderPlan();
    await press(byTestId(root, 'plan-open-billing')[0] as ReactTestInstance);
    expect(billing.openBilling).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).not.toHaveBeenCalledWith('PinEntry', expect.anything());
    await done();
  });
});

describe('PaywallScreen on the web: offline and a hand-off that did not open (section 4.7)', () => {
  it('offline with the same-tab hand-off: Open billing is disabled, says it needs the internet, and a press goes nowhere', async () => {
    for (const locale of LOCALES) {
      for (const audience of AUDIENCES) {
        for (const tier of TIERS) {
          const key = `${locale} / ${audience} / ${tier.key}`;
          setPlatform('web');
          flags.grownUpHomeEnabled = true;
          network.online = false;
          seed(audience, tier, locale);
          const { root, done, navigation } = await renderPlan();
          const needsInternet = getMessages(locale).learner.welcome.grownUps.needsInternet;
          const open = byTestId(root, 'plan-open-billing');
          expect(open, key).toHaveLength(1);
          expect(open[0]?.props['aria-disabled'], key).toBe(true);
          expect(byTestId(root, 'plan-open-billing-offline').map(textOf), key).toEqual([needsInternet]);
          expect(screenTexts(open[0] as ReactTestInstance), key).toContain(needsInternet);
          if (open[0]?.props.onClick !== undefined) await press(open[0] as ReactTestInstance);
          expect(navigation.navigate, key).not.toHaveBeenCalled();
          expect(billing.openBilling, key).not.toHaveBeenCalled();
          expectLocale(screenTexts(root), locale, key);
          expectLearnerCopy(screenTexts(root), locale, key);
          await done();
        }
      }
    }
  });

  it('a hand-off that did not open shows its note, which passes the learner copy checks', async () => {
    for (const locale of LOCALES) {
      for (const outcome of ['failed', 'offline'] as const) {
        const key = `${locale} / ${outcome}`;
        billing.openBilling.mockResolvedValue({ kind: 'browser', outcome, url: 'https://hangulroute.com/teach/billing' });
        setPlatform('web');
        seed('self', FREE, locale, null);
        const { root, done } = await renderPlan();
        const before = screenTexts(root);
        await press(byTestId(root, 'plan-open-billing')[0] as ReactTestInstance);
        expect(billing.openBilling, key).toHaveBeenCalledTimes(1);
        const added = screenTexts(root).filter((text) => !before.includes(text));
        expect(added, key).toHaveLength(1);
        expect(added[0], key).toContain(getMessages(locale).caregiver.plan.openFailed('https://hangulroute.com/teach/billing'));
        expectLearnerCopy(screenTexts(root), locale, key);
        billing.openBilling.mockClear();
        await done();
      }
    }
  });
});

describe('PaywallScreen slots for F-ENT-003 (section 4.7)', () => {
  it('the free slot renders "Stage 1 is always free." by default, and nothing outside the free state', async () => {
    for (const platform of PLATFORMS) {
      for (const audience of AUDIENCES) {
        for (const tier of TIERS) {
          setPlatform(platform);
          seed(audience, tier);
          const { root, done } = await renderPlan();
          const key = `${platform} / ${audience} / ${tier.key}`;
          const slot = byTestId(root, 'plan-free-slot');
          if (tier.tier === 'free') {
            expect(slot, key).toHaveLength(1);
            expect(textOf(slot[0] as ReactTestInstance), key).toBe('Stage 1 is always free.');
            expect(getMessages('en').caregiver.plan.free.open).toBe('Stage 1 is always free.');
          } else {
            expect(slot, key).toHaveLength(0);
          }
          await done();
        }
      }
    }
  });

  it('the guidance slot renders nothing by default, in every state', async () => {
    for (const platform of PLATFORMS) {
      for (const audience of AUDIENCES) {
        for (const tier of TIERS) {
          setPlatform(platform);
          seed(audience, tier);
          const { root, done } = await renderPlan();
          expect(byTestId(root, 'plan-guidance'), `${platform} / ${audience} / ${tier.key}`).toHaveLength(0);
          await done();
        }
      }
    }
  });
});
