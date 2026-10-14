import type { Profile, TierSource } from '@hangul-route/content-schema';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '../../../store/account-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { useTierStore } from '../../../store/tier-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, press, render, resetPlatform, screenTexts, setPlatform, unmount, type RenderPlatform } from '../../../test-support/render';
import { ProfileScreen } from '../ProfileScreen';

/**
 * F-BILL-002 B-13 (section 11; sections 4.7 and 6.3; mock design/screens/billing/plan-status.md):
 * the Profile plan card, rendered through react-native-web. Plan details shows for the free, full
 * route and covered tiers and opens the Plan screen straight away, with no PIN, even on a device
 * whose other grown-up rows go through the gate; the card says "Full route" or "Free plan", never
 * "Premium" or "unlock".
 */

const navigation = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }));

vi.mock('@react-navigation/native', () => ({ useNavigation: () => navigation }));

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
const FREE: TierCase = { key: 'free', tier: 'free', source: null, title: 'Free plan', note: 'Stage 1 is free. More stages are on the way.', pill: 'Free' };
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
function seed(audience: Audience, tier: TierCase): void {
  useProfileStore.setState({ profiles: [learner(audience)], activeId: LEARNER_ID });
  useAccountStore.setState({ parentPinHash: 'pin-hash', subscription: null });
  useUiStore.setState({ parentGateOpenedAt: null });
  useLocaleStore.setState({ device: 'en', session: null, byProfile: {} });
  useTierStore.setState({
    byLearner: { [LEARNER_ID]: { tier: tier.tier, source: tier.source, validUntil: null, fetchedAt: '2026-10-14T00:00:00.000Z' } },
    spaceMembers: {},
  });
}

beforeEach(() => {
  navigation.navigate.mockReset();
  navigation.goBack.mockReset();
});

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
    it(`${tier.key}: the card says "${tier.title}", "${tier.note}" and "${tier.pill}", never "Premium" or "unlock"`, async () => {
      for (const platform of PLATFORMS) {
        setPlatform(platform);
        seed('family', tier);
        const renderer = await render(<ProfileScreen />);
        const texts = screenTexts(renderer.root);
        expect(texts, platform).toContain(tier.title);
        expect(texts, platform).toContain(tier.note);
        expect(texts, platform).toContain(tier.pill);
        expect(texts, platform).not.toContain(tier.tier === 'free' ? 'Full route' : 'Free plan');
        for (const text of texts) {
          expect(text, `${platform}: ${text}`).not.toMatch(/premium/i);
          expect(text, `${platform}: ${text}`).not.toMatch(/\bunlock/i);
          expect(text, `${platform}: ${text}`).not.toMatch(/\bbuy\b/i);
        }
        await unmount(renderer);
      }
    });
  }
});
