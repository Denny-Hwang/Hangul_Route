import type { Profile } from '@hangul-route/content-schema';
import { LOCALES, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Always show the letters on Profile's Sound card (AMENDMENTS-AUDIO-CANT-HEAR row CH-2, section 6 test 23; design/screens/
 * audio-cant-hear/README.md "Always show the letters" and Q6): a second device switch under the Sound switch and its how-to
 * button, named by its label only, with the pill hidden from a screen reader; and the Sound switch no longer says its
 * state twice.
 */
const navigation = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }));
vi.mock('@react-navigation/native', () => ({ useNavigation: () => navigation, useFocusEffect: () => undefined }));
const writes = vi.hoisted(() => [] as unknown[]);
vi.mock('../../../platform/storage', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  writeJson: vi.fn(async (key: string, value: unknown) => {
    if (key === 'device:audio') writes.push(value);
  }),
}));

import { useAccountStore } from '../../../store/account-store';
import { useAudioStore } from '../../../store/audio-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { useUiStore } from '../../../store/ui-store';
import { byTestId, cleanup, press, render, resetPlatform, setPlatform, textOf } from '../../../test-support/render';
import { ProfileScreen } from '../ProfileScreen';

const mina: Profile = {
  id: 'profile:mina',
  displayName: 'Mina',
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  role: 'learner',
  createdAt: '2026-10-01T00:00:00.000Z',
  learnerType: 'child',
};
const initial = useAudioStore.getState();

function seed(locale: UiLocale = 'en'): void {
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  setPlatform('web');
  writes.length = 0;
  useLocaleStore.setState({ device: locale, byProfile: {} });
  useProfileStore.setState({ profiles: [mina], activeId: mina.id });
  useAccountStore.setState({ parentPinHash: 'pin-hash' });
  useUiStore.setState({ parentGateOpenedAt: null });
  useAudioStore.setState({ ...initial, muted: false, showLetters: false, tts: { state: 'ready', voiceId: 'v', voiceName: 'Yuna', local: true, quality: 'standard' } });
}

beforeEach(() => seed());
afterEach(async () => {
  await cleanup();
  resetPlatform();
  vi.unstubAllEnvs();
  useAudioStore.setState(initial, true);
});

const row = (root: ReactTestInstance): ReactTestInstance => byTestId(root, 'profile-always-show-letters')[0] as ReactTestInstance;

describe('the Always show the letters switch (CH-2)', () => {
  it('is a switch in the Sound card, under the Sound switch, named by its label only', async () => {
    const r = await render(<ProfileScreen />);
    const t = getMessages('en').learner.audio;
    expect(row(r.root).props.role).toBe('switch');
    expect(row(r.root).props['aria-label']).toBe(t.alwaysShowLetters);
    expect(row(r.root).props['aria-checked']).toBe(false);
    expect(row(r.root).props['aria-label']).not.toMatch(/\b(on|off)\b/i);
    const mine = byTestId(r.root, 'profile-group-mine')[0] as ReactTestInstance;
    const order = mine.findAll((n) => typeof n.type === 'string' && n.props.role === 'switch').map((n) => String(n.props['aria-label']));
    expect(order[0]).toMatch(/^Sound/);
    expect(order[1]).toBe('Always show the letters');
  });

  it('its pill says Off, then On, for the eye, and is hidden from a screen reader', async () => {
    const r = await render(<ProfileScreen />);
    const t = getMessages('en').learner.profile.sound;
    expect(textOf(row(r.root))).toContain(t.off);
    const hidden = row(r.root).findAll((n) => typeof n.type === 'string' && n.props['aria-hidden'] === true);
    expect(hidden.length).toBeGreaterThan(0);
    await press(row(r.root));
    expect(textOf(row(r.root))).toContain(t.on);
    expect(row(r.root).props['aria-checked']).toBe(true);
  });

  it('a tap turns it on and off and saves it with the mute; it is 64 tall at least', async () => {
    const r = await render(<ProfileScreen />);
    expect(Number.parseInt(String(row(r.root).props.style.minHeight), 10)).toBeGreaterThanOrEqual(64);
    await press(row(r.root));
    expect(useAudioStore.getState().showLetters).toBe(true);
    expect(writes.at(-1)).toEqual({ muted: false, showLetters: true });
    await press(row(r.root));
    expect(useAudioStore.getState().showLetters).toBe(false);
    expect(writes.at(-1)).toEqual({ muted: false, showLetters: false });
  });

  it('is shown on with the saved value, and the Sound switch keeps it when sound is turned off', async () => {
    useAudioStore.setState({ showLetters: true });
    const r = await render(<ProfileScreen />);
    expect(row(r.root).props['aria-checked']).toBe(true);
    const sound = byTestId(r.root, 'profile-group-mine')[0]!.findAll((n) => typeof n.type === 'string' && n.props.role === 'switch')[0] as ReactTestInstance;
    await press(sound);
    expect(useAudioStore.getState()).toMatchObject({ muted: true, showLetters: true });
    expect(writes.at(-1)).toEqual({ muted: true, showLetters: true });
  });

  it('is there with no Korean voice too, after the how-to button', async () => {
    useAudioStore.setState({ tts: { state: 'none', reason: 'no_korean_voice' } });
    const r = await render(<ProfileScreen />);
    const mine = byTestId(r.root, 'profile-group-mine')[0] as ReactTestInstance;
    const ids = mine.findAll((n) => typeof n.type === 'string' && ['sound-how-to-add', 'profile-always-show-letters'].includes(String(n.props['data-testid']))).map((n) => n.props['data-testid']);
    expect(ids).toEqual(['sound-how-to-add', 'profile-always-show-letters']);
  });

  it.each(LOCALES)('%s: the label is the dictionary string, not hard-coded', async (locale) => {
    seed(locale);
    const r = await render(<ProfileScreen />);
    expect(row(r.root).props['aria-label']).toBe(getMessages(locale).learner.audio.alwaysShowLetters);
  });
});

describe('the Sound switch no longer says its state twice (design pass Q6)', () => {
  it('its name is the word Sound and the voice line; the state is the switch\'s own', async () => {
    const r = await render(<ProfileScreen />);
    const sound = byTestId(r.root, 'profile-group-mine')[0]!.findAll((n) => typeof n.type === 'string' && n.props.role === 'switch')[0] as ReactTestInstance;
    expect(sound.props['aria-label']).toBe('Sound. Korean voice ready.');
    expect(sound.props['aria-checked']).toBe(true);
  });
});
