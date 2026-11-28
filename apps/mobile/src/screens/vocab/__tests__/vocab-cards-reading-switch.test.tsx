import type { Profile, ProgressSnapshot } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { snapshotWith } from '../../../logic/stage1/__tests__/fixtures';
import { KO_VOICE, createAudioRig, type AudioRig } from '../../../test-support/audio-rig';

/**
 * AMENDMENTS-ROMANIZATION-FADE section 3.10 and OD-RF-5 (row RF-2): the Words cards switch stays a two-state switch. It
 * shows **On** while the screen's resolved mode is `tap` and stores an explicit choice, `tap` (On) or `always` (Off), through
 * `setRomanizationChoice`; going back to As I learn is Profile's. Switching Off on As I learn in phase `all` therefore
 * stores Always for every surface (the trade-off OD-RF-5 accepted).
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));
vi.mock('../../../platform/storage', async (importOriginal) => ({ ...(await importOriginal<object>()), writeJson: vi.fn(async () => undefined) }));
vi.mock('@react-navigation/native', async () => {
  const { createContext, useEffect } = await import('react');
  return {
    NavigationContext: createContext(undefined),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useNavigation: () => ({ goBack: () => undefined, navigate: () => undefined }),
  };
});

import { VocabCardsScreen } from '../VocabCardsScreen';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { byTestId, cleanup, press, render } from '../../../test-support/render';

const ID = 'profile:mina';
const learner: Profile = { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' };
const WORD_BUILDER_DONE: ProgressSnapshot = { ...snapshotWith([]), testedOut: { 'episode:stage2-letters': '2026-11-01T00:00:00.000Z' } };

function seed(settings: Record<string, unknown> | undefined, snapshot: ProgressSnapshot): void {
  useProfileStore.setState({ profiles: [learner], activeId: ID, hydrated: true });
  useLocaleStore.setState({ byProfile: settings === undefined ? {} : { [ID]: settings as never }, screenReader: false, device: 'en' });
  useProgressStore.setState({ byProfile: { [ID]: snapshot } });
}

const open = async () => {
  const navigation = { goBack: vi.fn(), navigate: vi.fn(), replace: vi.fn(), setOptions: vi.fn(), addListener: vi.fn(() => () => undefined) };
  const route = { key: 'VocabCards-1', name: 'VocabCards' as const, params: { topicKey: 'food' } };
  return render(<VocabCardsScreen route={route as never} navigation={navigation as never} />);
};
const switchOf = (root: Awaited<ReturnType<typeof open>>['root']) => {
  const found = byTestId(root, 'vocab-cards-reading-practice');
  expect(found).toHaveLength(1);
  return found[0]!;
};

beforeEach(() => {
  rig.current = createAudioRig({ voices: [KO_VOICE] });
});
afterEach(async () => {
  await cleanup();
});

describe('Words cards reading switch (OD-RF-5)', () => {
  it('on a profile on As I learn in phase letters it is Off; On stores Only when I tap, Off stores Always', async () => {
    seed(undefined, snapshotWith([]));
    const r = await open();
    expect(switchOf(r.root).props['aria-checked']).toBe(false);
    await press(switchOf(r.root));
    expect(switchOf(r.root).props['aria-checked']).toBe(true);
    expect(useLocaleStore.getState().byProfile[ID]).toEqual({ romanizationMode: 'tap', romanizationChoice: 'tap' });
    await press(switchOf(r.root));
    expect(switchOf(r.root).props['aria-checked']).toBe(false);
    // Off is an explicit Always, not a return to As I learn
    expect(useLocaleStore.getState().byProfile[ID]).toEqual({ romanizationMode: 'always', romanizationChoice: 'always' });
  });

  it('on As I learn in phase all it shows On (the screen folds), and Off stores Always for every surface', async () => {
    seed({ romanizationMode: 'always' }, WORD_BUILDER_DONE);
    const r = await open();
    expect(switchOf(r.root).props['aria-checked']).toBe(true);
    await press(switchOf(r.root));
    expect(switchOf(r.root).props['aria-checked']).toBe(false);
    expect(useLocaleStore.getState().byProfile[ID]).toMatchObject({ romanizationChoice: 'always', romanizationMode: 'always' });
  });

  it('a legacy stored tap shows On', async () => {
    seed({ romanizationMode: 'tap' }, snapshotWith([]));
    const r = await open();
    expect(switchOf(r.root).props['aria-checked']).toBe(true);
  });
});
