import type { Profile, TierSource } from '@hangul-route/content-schema';
import { LOCALES, getMessages, type UiLocale } from '@hangul-route/i18n';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { planCardView } from '../../../logic/paywall';
import { useAccountStore } from '../../../store/account-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { useTierStore } from '../../../store/tier-store';
import { useUiStore } from '../../../store/ui-store';
import { PURCHASE } from '../../../test-support/__tests__/copy-words';
import { buttonsNamed, byTestId, press, render, resetPlatform, screenTexts, setPlatform, unmount, type RenderPlatform } from '../../../test-support/render';
import { ProfileScreen } from '../ProfileScreen';

/**
 * F-BILL-002 B-13 (section 11; sections 4.7 and 6.3; mock design/screens/billing/plan-status.md):
 * the Profile plan card, rendered through react-native-web. Plan details shows for the free, full
 * route and covered tiers and opens the Plan screen straight away, with no PIN, even on a device
 * whose other grown-up rows go through the gate; the card says "Full route" or "Free plan", never
 * "Premium" or "unlock".
 */

const navigation = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }));

vi.mock('@react-navigation/native', () => ({ useNavigation: () => navigation, useFocusEffect: () => undefined }));

const PLATFORMS: readonly RenderPlatform[] = ['web', 'ios', 'android'];
const AUDIENCES = ['family', 'self'] as const;
type Audience = (typeof AUDIENCES)[number];

const family: TierSource = { kind: 'family', spaceId: 'space:f', name: 'Kim family' };
const klass: TierSource = { kind: 'class', spaceId: 'space:c', name: 'Sunday Class A' };
const school: TierSource = { kind: 'school', spaceId: 'space:s', name: 'Maple School' };

/** The free, full-route (Family Plan and legacy) and covered (class, school) tiers, with the card each shows. */
interface TierCase {
  key: string;
  tier: 'free' | 'premium';
  source: TierSource | null;
  title: string;
  note: string;
  pill: string;
}
// Content gating is off in this build, so the free card says everything is open (owner request 2026-10-16, item 8).
const FREE: TierCase = { key: 'free', tier: 'free', source: null, title: 'Free plan', note: 'Everything is open right now.', pill: 'Free' };
const TIERS: readonly TierCase[] = [
  FREE,
  { key: 'premium-family', tier: 'premium', source: family, title: 'Full route', note: 'Everything is open, from Kim family.', pill: 'Active' },
  { key: 'premium-legacy', tier: 'premium', source: null, title: 'Full route', note: 'Everything is open.', pill: 'Active' },
  { key: 'covered-class', tier: 'premium', source: klass, title: 'Full route', note: 'Everything is open, from Sunday Class A.', pill: 'Active' },
  { key: 'covered-school', tier: 'premium', source: school, title: 'Full route', note: 'Everything is open, from Maple School.', pill: 'Active' },
];

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

/** The device: one learner, a grown-up PIN (so the gated rows ask for it), no open grown-up session. */
function seed(audience: Audience, tier: TierCase, locale: UiLocale = 'en'): void {
  // es and ko are hidden at launch (LOCALE_STATUS) and fall back to English; the QA switch shows them.
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  useProfileStore.setState({ profiles: [learner(audience)], activeId: LEARNER_ID });
  useAccountStore.setState({ parentPinHash: 'pin-hash', subscription: null });
  useUiStore.setState({ parentGateOpenedAt: null });
  useLocaleStore.setState({ device: locale, byProfile: {} });
  useTierStore.setState({
    byLearner: { [LEARNER_ID]: { tier: tier.tier, source: tier.source, validUntil: null, fetchedAt: '2026-10-14T00:00:00.000Z' } },
    spaceMembers: {},
  });
}

beforeEach(() => {
  navigation.navigate.mockReset();
  navigation.goBack.mockReset();
});

/** Opens Profile's "For grown-ups" group, collapsed on arrival (owner request 2026-10-16, item 8). */
async function openGrownUps(root: ReactTestInstance): Promise<void> {
  const toggle = byTestId(root, 'profile-group-grown-ups-toggle')[0] as ReactTestInstance;
  expect(toggle.props['aria-expanded']).toBe(false);
  await press(toggle);
}

afterEach(() => {
  resetPlatform();
});

describe('ProfileScreen plan card (F-BILL-002 section 11, B-13)', () => {
  for (const platform of PLATFORMS) {
    for (const audience of AUDIENCES) {
      for (const tier of TIERS) {
        it(`${platform} / ${audience} / ${tier.key}: Plan details opens the Plan screen without a PIN`, async () => {
          setPlatform(platform);
          seed(audience, tier);
          const renderer = await render(<ProfileScreen />);
          expect(buttonsNamed(renderer.root, 'Plan details')).toHaveLength(0);
          await openGrownUps(renderer.root);
          const details = buttonsNamed(renderer.root, 'Plan details');
          expect(details).toHaveLength(1);
          await press(details[0] as ReactTestInstance);
          expect(navigation.navigate).toHaveBeenCalledTimes(1);
          expect(navigation.navigate).toHaveBeenCalledWith('Paywall', { from: 'settings' });
          expect(navigation.navigate).not.toHaveBeenCalledWith('PinEntry', expect.anything());
          await unmount(renderer);
        });
      }
    }
  }

  it('a gated row on the same device still asks for the PIN (so the plan card is the one that skips it)', async () => {
    setPlatform('web');
    seed('family', FREE);
    const renderer = await render(<ProfileScreen />);
    const add = buttonsNamed(renderer.root, '+ Add a profile');
    expect(add.length).toBeGreaterThan(0);
    await press(add[0] as ReactTestInstance);
    expect(navigation.navigate).toHaveBeenCalledWith('PinEntry', { next: 'AddProfile' });
    await unmount(renderer);
  });

  for (const tier of TIERS) {
    it(`${tier.key}: the card says "${tier.title}", "${tier.note}" and "${tier.pill}", never "Premium" or "unlock", for both audiences and in every locale`, async () => {
      for (const platform of PLATFORMS) {
        for (const audience of AUDIENCES) {
          for (const locale of LOCALES) {
            const key = `${platform} / ${audience} / ${locale}`;
            const card = planCardView(tier.tier, tier.source, getMessages(locale).learner.profile.plan, false);
            if (locale === 'en') expect([card.title, card.note, card.pill], key).toEqual([tier.title, tier.note, tier.pill]);
            const other = planCardView(tier.tier === 'free' ? 'premium' : 'free', null, getMessages(locale).learner.profile.plan, false);
            setPlatform(platform);
            seed(audience, tier, locale);
            const renderer = await render(<ProfileScreen />);
            await openGrownUps(renderer.root);
            const texts = screenTexts(renderer.root);
            expect(texts, key).toContain(card.title);
            expect(texts, key).toContain(card.note);
            expect(texts, key).toContain(card.pill);
            expect(texts, key).not.toContain(other.title);
            for (const text of texts) {
              expect(text, `${key}: ${text}`).not.toMatch(/premium/i);
              expect(text, `${key}: ${text}`).not.toMatch(/\bunlock/i);
              expect(text, `${key}: ${text}`).not.toMatch(/\bbuy\b/i);
            }
            for (const line of [card.title, card.note, card.pill]) expect(line, key).not.toMatch(PURCHASE[locale]);
            await unmount(renderer);
          }
        }
      }
    });
  }
});

describe('ProfileScreen open-source notices link (owner decision 2026-10-14)', () => {
  afterEach(() => resetPlatform());

  it.each(PLATFORMS)('%s: the foot of the screen links the open-source notices, for both audiences', async (platform) => {
    for (const audience of AUDIENCES) {
      setPlatform(platform);
      seed(audience, FREE);
      const renderer = await render(<ProfileScreen />);
      await openGrownUps(renderer.root);
      const links = byTestId(renderer.root, 'profile-licenses-link');
      expect(links, audience).toHaveLength(1);
      expect(links[0]!.props['aria-label']).toBe(getMessages('en').learner.profile.licenses.label);
      await unmount(renderer);
    }
  });

  it.each(PLATFORMS)('%s: leaving the app for the notices goes through the grown-up gate on a device with a PIN (F-STORY-002 section 3.8)', async (platform) => {
    for (const audience of AUDIENCES) {
      navigation.navigate.mockReset();
      setPlatform(platform);
      seed(audience, FREE);
      const renderer = await render(<ProfileScreen />);
      await openGrownUps(renderer.root);
      await press(byTestId(renderer.root, 'profile-licenses-link')[0] as ReactTestInstance);
      expect(navigation.navigate, audience).toHaveBeenCalledWith('PinEntry', { next: 'ExternalLink', url: expect.stringMatching(/\/licenses$/) });
      await unmount(renderer);
    }
  });
});

describe('ProfileScreen groups (owner request 2026-10-16, item 8)', () => {
  afterEach(() => resetPlatform());

  it.each(PLATFORMS)('%s: My settings is open, For grown-ups starts collapsed and opens on a tap; one filled button', async (platform) => {
    for (const locale of LOCALES) {
      setPlatform(platform);
      seed('family', FREE, locale);
      const t = getMessages(locale).learner.profile;
      const renderer = await render(<ProfileScreen />);
      const mine = byTestId(renderer.root, 'profile-group-mine');
      expect(mine, locale).toHaveLength(1);
      expect(screenTexts(mine[0] as ReactTestInstance), locale).toContain(t.groups.mine);
      expect(screenTexts(mine[0] as ReactTestInstance), locale).toContain(t.sound.label);
      const grown = byTestId(renderer.root, 'profile-group-grown-ups')[0] as ReactTestInstance;
      expect(screenTexts(grown), locale).toContain(t.groups.grownUps);
      // Collapsed: the classes card, the plan card, backup and the grown-up area are not drawn yet.
      expect(byTestId(grown, 'spaces-card'), locale).toHaveLength(0);
      expect(byTestId(grown, 'profile-grown-up-area'), locale).toHaveLength(0);
      await openGrownUps(renderer.root);
      expect(byTestId(renderer.root, 'profile-group-grown-ups-toggle')[0]?.props['aria-expanded']).toBe(true);
      // Classes and family comes first in the group, before the plan card and the grown-up area.
      const order = screenTexts(byTestId(renderer.root, 'profile-group-grown-ups')[0] as ReactTestInstance);
      const zone = getMessages(locale).caregiver.audience.family.zoneLabel;
      expect(order.indexOf(getMessages(locale).caregiver.spaces.title), locale).toBeGreaterThan(-1);
      expect(order.indexOf(getMessages(locale).caregiver.spaces.title), locale).toBeLessThan(order.indexOf(t.plan.details.cta));
      expect(order.indexOf(t.plan.details.cta), locale).toBeLessThan(order.indexOf(zone));
      await unmount(renderer);
    }
  });
});
