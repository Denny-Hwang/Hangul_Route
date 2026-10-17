import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocaleStore } from '../../../store/locale-store';
import { buttonsNamed, byTestId, press, render, resetPlatform, screenTexts, setPlatform, unmount } from '../../../test-support/render';
import { WelcomeScreen } from '../WelcomeScreen';

/**
 * Welcome's ways into a class (owner decisions 2026-10-16 item 8 and 2026-10-17; review of #734):
 * - "Got a class code?" starts the class-code first run and counts as the learner's choice, as Start does.
 * - The class join link on a device with no profile lands here, not on the first-run form: the card shows the link's
 *   code, what Start does, and where to type the code in an app that already holds the learner's progress (on iOS the
 *   camera opens the browser, whose storage is not the installed app's); "I already have progress" stays beside Start.
 */

const track = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../../../platform/telemetry', () => ({ track }));

const en = getMessages('en').learner;
const navigate = vi.fn();
const parentNavigate = vi.fn();
const navigation = { navigate, getParent: () => ({ navigate: parentNavigate }) };

type Params = { classLink?: true; code?: string } | undefined;
const welcome = (params: Params) => (
  <WelcomeScreen
    navigation={navigation as unknown as React.ComponentProps<typeof WelcomeScreen>['navigation']}
    route={{ key: 'welcome', name: 'Welcome', params } as React.ComponentProps<typeof WelcomeScreen>['route']}
  />
);

beforeEach(() => {
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  // The grown-up entries are the web build's (F-APP-001 A-7): there Start says which persona chose.
  vi.stubEnv('EXPO_OS', 'web');
  setPlatform('web');
});
afterEach(() => {
  navigate.mockReset();
  parentNavigate.mockReset();
  track.mockClear();
  vi.unstubAllEnvs();
  resetPlatform();
});

describe('Welcome with no join link', () => {
  it('Got a class code? starts the class-code first run and counts as the learner choosing, as Start does', async () => {
    const renderer = await render(welcome(undefined));
    expect(byTestId(renderer.root, 'welcome-class-link')).toHaveLength(0);
    await press(byTestId(renderer.root, 'welcome-class-code')[0] as ReactTestInstance);
    expect(navigate).toHaveBeenCalledWith('CreateProfile', { firstRun: true, then: 'join' });
    expect(track).toHaveBeenCalledWith({ name: 'shell.persona_chosen', payload: { persona: 'learner', from: 'welcome' } });
    await press(buttonsNamed(renderer.root, en.welcome.cta)[0] as ReactTestInstance);
    expect(navigate).toHaveBeenLastCalledWith('CreateProfile', { firstRun: true });
    expect(track).toHaveBeenCalledTimes(2);
    await unmount(renderer);
  });
});

describe('Welcome from the class join link (a device with no profile)', () => {
  it('shows the code, what Start does and where to type it in the app; Restore stays; Start carries the code', async () => {
    const renderer = await render(welcome({ classLink: true, code: 'ABC234' }));
    const card = byTestId(renderer.root, 'welcome-class-link')[0] as ReactTestInstance;
    expect(screenTexts(card)).toEqual([en.welcome.classLink.code('ABC234'), en.welcome.classLink.next, en.welcome.classLink.inApp]);
    // The card says it already: no second "Got a class code?".
    expect(byTestId(renderer.root, 'welcome-class-code')).toHaveLength(0);
    // "I already have progress" (Restore) is still there, next to Start.
    await press(buttonsNamed(renderer.root, en.welcome.restore)[0] as ReactTestInstance);
    expect(parentNavigate).toHaveBeenCalledWith('Restore', { from: 'welcome' });
    await press(buttonsNamed(renderer.root, en.welcome.cta)[0] as ReactTestInstance);
    expect(navigate).toHaveBeenCalledWith('CreateProfile', { firstRun: true, then: 'join', code: 'ABC234' });
    await unmount(renderer);
  });

  it('a link with no valid code: no code line, and Start still opens Join a class after the profile', async () => {
    const renderer = await render(welcome({ classLink: true }));
    const card = byTestId(renderer.root, 'welcome-class-link')[0] as ReactTestInstance;
    expect(byTestId(card, 'welcome-class-link-code')).toHaveLength(0);
    expect(screenTexts(card)).toEqual([en.welcome.classLink.next, en.welcome.classLink.inApp]);
    await press(buttonsNamed(renderer.root, en.welcome.cta)[0] as ReactTestInstance);
    expect(navigate).toHaveBeenCalledWith('CreateProfile', { firstRun: true, then: 'join' });
    await unmount(renderer);
  });

  it.each(['es', 'ko'] as const)('%s: the card is in that language', async (locale) => {
    vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
    useLocaleStore.setState({ device: locale, byProfile: {} });
    const words = getMessages(locale).learner.welcome.classLink;
    const renderer = await render(welcome({ classLink: true, code: 'ABC234' }));
    expect(screenTexts(byTestId(renderer.root, 'welcome-class-link')[0] as ReactTestInstance)).toEqual([words.code('ABC234'), words.next, words.inApp]);
    await unmount(renderer);
  });
});
