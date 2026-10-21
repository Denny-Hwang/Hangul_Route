import type { Profile } from '@hangul-route/content-schema';
import { LOCALES, findBannedWord, getMessages, type UiLocale } from '@hangul-route/i18n';
import React, { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubscriptionState } from '../../../logic/entitlement';
import { useAccountStore } from '../../../store/account-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { useTierStore } from '../../../store/tier-store';
import { useUiStore } from '../../../store/ui-store';
import { PRICE, PURCHASE } from '../../../test-support/__tests__/copy-words';
import { render, resetPlatform, screenTexts, setPlatform, unmount, type RenderPlatform } from '../../../test-support/render';
import { PaywallScreen } from '../PaywallScreen';

/**
 * AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-8 (section 10.5, section 20 component row): on a device whose
 * legacy subscription recorded 4 learners, a 5th new learner's Plan screen shows the existing calm
 * free-plan line, in every locale and on every platform, with no price, purchase or banned word and no
 * new string; a recorded learner keeps "has the full route".
 */

vi.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
}));
vi.mock('../../../platform/billing-handoff', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../platform/billing-handoff')>()),
  openBilling: vi.fn(),
}));
vi.mock('../../../platform/online', () => ({ isOnline: () => true, subscribeOnline: () => () => undefined }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../platform/telemetry')>()),
  track: vi.fn(async () => undefined),
}));

const PLATFORMS: readonly RenderPlatform[] = ['web', 'ios', 'android'];
const ACTIVE: SubscriptionState = { status: 'active', plan: 'yearly', expiresAt: '2099-01-01T00:00:00.000Z' };
const NAMES = ['Ana', 'Bo', 'Cy', 'Dee', 'Eun'] as const;

const learner = (name: string, n: number): Profile => ({
  id: `profile:${name.toLowerCase()}`,
  displayName: name,
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  role: 'learner',
  createdAt: `2026-10-0${n}T00:00:00.000Z`,
  learnerType: 'child',
});
const FIVE = NAMES.map((name, i) => learner(name, i + 1));

/** Four learners recorded by the legacy subscription, then a 5th made later; `active` is the one on the Plan screen. */
function seed(active: Profile, locale: UiLocale): void {
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  useProfileStore.setState({ profiles: FIVE, activeId: active.id, hydrated: true });
  useAccountStore.setState({
    parentPinHash: 'pin-hash',
    subscription: ACTIVE,
    subscriptionCovers: { v: 1, ids: FIVE.slice(0, 4).map((p) => p.id), at: '2026-10-21T00:00:00.000Z' },
    hydrated: true,
  });
  useUiStore.setState({ parentGateOpenedAt: null });
  useLocaleStore.setState({ device: locale, byProfile: {} });
  useTierStore.setState({ byLearner: {}, spaceMembers: {} });
}

async function planTexts(): Promise<string[]> {
  const renderer = await render(
    <PaywallScreen navigation={{ navigate: vi.fn(), goBack: vi.fn() } as never} route={{ key: 'Paywall', name: 'Paywall', params: { from: 'settings' } } as never} />,
  );
  const texts = screenTexts(renderer.root);
  await unmount(renderer);
  return texts;
}

beforeEach(() => {
  useAccountStore.setState({ subscriptionCovers: null });
});

afterEach(() => {
  resetPlatform();
  vi.unstubAllEnvs();
  useAccountStore.setState({ subscription: null, subscriptionCovers: null });
});

describe('PaywallScreen: the legacy subscription capped like a family (OA-8)', () => {
  it('a 5th new learner reads the calm free-plan line; a recorded learner keeps the full route', async () => {
    setPlatform('ios');
    seed(FIVE[4] as Profile, 'en');
    expect(await planTexts()).toContain('Eun is on the free plan.');
    seed(FIVE[3] as Profile, 'en');
    expect(await planTexts()).toContain('Dee has the full route.');
  });

  for (const platform of PLATFORMS) {
    it(`${platform}: the 5th learner's line comes from the dictionary in every locale, with no price, purchase or banned word`, async () => {
      for (const locale of LOCALES) {
        setPlatform(platform);
        seed(FIVE[4] as Profile, locale);
        const texts = await planTexts();
        const m = getMessages(locale).caregiver.plan;
        expect(texts, `${platform} / ${locale}`).toContain(m.free.title.family('Eun'));
        expect(texts, `${platform} / ${locale}`).not.toContain(m.full.title.family('Eun'));
        for (const text of texts) {
          expect(text, `${platform} / ${locale}: ${text}`).not.toMatch(PRICE);
          expect(text, `${platform} / ${locale}: ${text}`).not.toMatch(PURCHASE[locale]);
          expect(findBannedWord(text, locale, 'learner'), `${platform} / ${locale}: ${text}`).toBeNull();
        }
      }
    });
  }
});
