import type { GuestRecord, Profile } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON row GU-5, section 19 (component tests): the chooser's guest tiles (section 9.1).
 * A live guest shows its own tile with no progress keys (CS-G5); the try tile only on a chooser the site opened (the
 * `try` trigger, or `return` with `try`); a held class code shows none (CS-G4); the switch off shows none; a pick
 * starts or resumes the guest run, closes the grown-up session (CS-G3) and selects nobody (no `profile.switch`).
 */
vi.mock('@react-navigation/native', () => ({ useFocusEffect: (effect: () => void) => (React as typeof import('react')).useEffect(effect, []) }));
const tracked = vi.hoisted(() => [] as { name: string; payload?: Record<string, unknown> }[]);
vi.mock('../../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string }) => {
    tracked.push(event);
    return true;
  }),
}));
vi.mock('../../../platform/grown-up-tab', () => ({ endGrownUpTab: () => undefined }));
// The guest's screen chunk is not fetched in the node lane.
vi.mock('../../../navigation/guest', () => ({ preloadGuestStack: vi.fn() }));
const run = vi.hoisted(() => ({ calls: 0, route: { screen: 'QuestPlayer', params: { questId: 'q1', episodeId: 'e1' } } as unknown }));
vi.mock('../../../store/guest-launch', () => ({
  startGuestFromChooser: vi.fn(async () => {
    run.calls += 1;
    return run.route;
  }),
}));

import { flags } from '../../../config/flags';
import { useAccountStore } from '../../../store/account-store';
import { useGuestStore } from '../../../store/guest-store';
import { useLocaleStore } from '../../../store/locale-store';
import { resetProfileLocks } from '../../../store/profile-locks';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { useUiStore } from '../../../store/ui-store';
import { holdJoin, resetChooserState } from '../../../store/who-chooser';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { WhoIsUsingScreen } from '../WhoIsUsingScreen';

const en = getMessages('en');

const learner = (id: string, displayName: string): Profile => ({
  id,
  displayName,
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  role: 'learner',
  createdAt: '2026-10-01T00:00:00.000Z',
  learnerType: 'child',
});
const GUEST: GuestRecord = { v: 1, id: 'profile:guest001', startedAt: '2026-10-22T10:00:00.000Z', lastAt: '2026-10-22T10:05:00.000Z', via: 'site', questDone: true };

function fakeNavigation() {
  const nav = {
    state: { index: 0, routes: [{ key: 'who-1', name: 'WhoIsUsing' }] },
    getState: () => nav.state,
    goBack: vi.fn(),
    reset: vi.fn(),
    navigate: vi.fn(),
    dispatch: vi.fn(),
    setOptions: vi.fn(),
    addListener: vi.fn(() => () => undefined),
  };
  return nav;
}

type Params = { trigger: 'launch' | 'return' | 'resume' | 'join' | 'manual' | 'try'; try?: true };

/** A tile's strings: its accessible name, then (after the cub's own name on a guest tile) the label and the line. */
function expectTile(texts: string[], name: string, label: string, line: string): void {
  expect(texts[0]).toBe(name);
  expect(texts.slice(-2)).toEqual([label, line]);
  expect(texts.length).toBeLessThanOrEqual(4);
}

async function renderChooser(params: Params) {
  const navigation = fakeNavigation();
  const r = await render(<WhoIsUsingScreen navigation={navigation as never} route={{ key: 'who-1', name: 'WhoIsUsing', params } as never} />);
  return { r, navigation };
}

beforeEach(() => {
  setPlatform('ios');
  tracked.length = 0;
  run.calls = 0;
  resetChooserState();
  resetProfileLocks();
  flags.guestLessonEnabled = true;
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useProfileStore.setState({ profiles: [learner('profile:mina', 'Mina'), learner('profile:jun', 'Jun')], activeId: 'profile:mina', hydrated: true, activeSince: Date.now() });
  useAccountStore.setState({ parentPinHash: 'pin-hash', pinHashReadFailed: false, pinResetRequestedAt: null });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null, gateReturnPending: false });
  useGuestStore.setState({ record: null, running: false, hydrated: true, memoryOnly: false });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
  flags.guestLessonEnabled = false;
});

describe('the chooser guest tiles (section 9.1)', () => {
  it('a live guest: its own tile after Add a learner, First quest and Not saved yet, no progress (CS-G5)', async () => {
    useGuestStore.setState({ record: GUEST });
    // The guest's quest results are stored under its id: none of them may reach the tile.
    useProgressStore.setState({
      byProfile: { [GUEST.id]: { ...useProgressStore.getState().ensure(GUEST.id), cards: [{ cardId: 'card-x', unlockedAt: '2026-10-22T10:04:00.000Z' }] } as never },
    });
    for (const trigger of ['launch', 'resume', 'manual', 'try', 'return'] as const) {
      const { r } = await renderChooser({ trigger });
      const tile = byTestId(r.root, 'who-guest');
      expect(tile.length, trigger).toBeGreaterThan(0);
      expect(byTestId(r.root, 'who-try'), trigger).toHaveLength(0);
      expectTile(screenTexts(tile[0]!), en.a11y.who.guest, en.learner.who.guest, en.learner.who.guestCaption);
      expect(buttonsNamed(r.root, en.a11y.who.guest)).toHaveLength(1);
      // After Add a learner, and the last tile of the grid.
      const grid = byTestId(r.root, 'who-tiles')[0]!;
      const ids = grid
        .findAll((n) => typeof n.type === 'string' && typeof n.props['data-testid'] === 'string' && /^who-(tile-\d+|add|guest|try)$/.test(n.props['data-testid']))
        .map((n) => n.props['data-testid'] as string);
      expect(ids.filter((id, i) => ids.indexOf(id) === i)).toEqual(['who-tile-0', 'who-tile-1', 'who-add', 'who-guest']);
      // No progress, no lock, no tint, no PIN on the tile.
      const progressKeys = ['stars', 'cards', 'level', 'streak', 'progress', 'space', 'lastActiveAt', 'ageGroup', 'lastAt', 'questDone'];
      const offending = tile[0]!.findAll((n) => typeof n.type !== 'string' && Object.keys(n.props).some((k) => progressKeys.includes(k)));
      expect(offending).toEqual([]);
      expect(byTestId(r.root, 'who-guest-lock')).toHaveLength(0);
      for (const text of screenTexts(tile[0]!)) expect(text).not.toMatch(/\bstars?\b|\bcards?\b|\d|level|streak/i);
      await cleanup();
    }
  });

  it('no live guest: Try the first quest only for the try trigger, or return with try (OQ-G8)', async () => {
    for (const params of [{ trigger: 'try' }, { trigger: 'return', try: true }] as Params[]) {
      const { r } = await renderChooser(params);
      const tile = byTestId(r.root, 'who-try');
      expect(tile.length, params.trigger).toBeGreaterThan(0);
      expect(screenTexts(tile[0]!)).toEqual([en.a11y.who.try, en.learner.who.try, en.learner.who.trySub]);
      // One accessible name, the whole sentence, never label and line joined (D11).
      expect(buttonsNamed(r.root, en.a11y.who.try)).toHaveLength(1);
      await cleanup();
    }
    for (const trigger of ['launch', 'return', 'resume', 'manual'] as const) {
      const { r } = await renderChooser({ trigger });
      expect(byTestId(r.root, 'who-try'), trigger).toHaveLength(0);
      expect(byTestId(r.root, 'who-guest'), trigger).toHaveLength(0);
      await cleanup();
    }
  });

  it('who.shown carries the trigger try', async () => {
    await renderChooser({ trigger: 'try' });
    await vi.waitFor(() => expect(tracked.find((e) => e.name === 'who.shown')?.payload).toMatchObject({ trigger: 'try', learners: '2' }));
  });

  it('a held class code shows no try tile and no guest tile: joining needs a profile (CS-G4)', async () => {
    holdJoin('ABC234');
    const { r } = await renderChooser({ trigger: 'join' });
    expect(byTestId(r.root, 'who-try')).toHaveLength(0);
    expect(byTestId(r.root, 'who-guest')).toHaveLength(0);
    await cleanup();
    useGuestStore.setState({ record: GUEST });
    const again = await renderChooser({ trigger: 'try' });
    expect(byTestId(again.r.root, 'who-try')).toHaveLength(0);
    expect(byTestId(again.r.root, 'who-guest')).toHaveLength(0);
  });

  it('the guest switch off: no guest tile, even with a live guest or the try trigger', async () => {
    flags.guestLessonEnabled = false;
    useGuestStore.setState({ record: GUEST });
    const { r } = await renderChooser({ trigger: 'try' });
    expect(byTestId(r.root, 'who-guest')).toHaveLength(0);
    expect(byTestId(r.root, 'who-try')).toHaveLength(0);
  });

  it('Try the first quest: who.picked try, the Guest stack alone on the root, the session closed, nobody selected (CS-G3, CS-G4)', async () => {
    const { r, navigation } = await renderChooser({ trigger: 'try' });
    useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: Date.now() });
    await press(byTestId(r.root, 'who-try')[0]!);
    await vi.waitFor(() => expect(navigation.dispatch).toHaveBeenCalled());
    expect(run.calls).toBe(1);
    expect(navigation.dispatch).toHaveBeenCalledWith({ type: 'RESET', payload: { index: 0, routes: [{ name: 'Guest', params: run.route }] } });
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
    expect(useProfileStore.getState().activeId).toBe('profile:mina');
    expect(tracked.filter((e) => e.name === 'who.picked').map((e) => e.payload)).toEqual([{ kind: 'try' }]);
    expect(tracked.filter((e) => e.name === 'profile.switch')).toEqual([]);
  });

  it('the guest tile: who.picked guest and the run resumed; a second tap while it opens does nothing', async () => {
    useGuestStore.setState({ record: GUEST });
    run.route = { screen: 'GuestLater' };
    const { r, navigation } = await renderChooser({ trigger: 'launch' });
    const tile = byTestId(r.root, 'who-guest')[0]!;
    await press(tile);
    await press(tile);
    await vi.waitFor(() => expect(navigation.dispatch).toHaveBeenCalledTimes(1));
    expect(run.calls).toBe(1);
    expect(tracked.filter((e) => e.name === 'who.picked').map((e) => e.payload)).toEqual([{ kind: 'guest' }]);
    expect(tracked.filter((e) => e.name === 'profile.switch')).toEqual([]);
  });

  it('the tiles never truncate: no line clamp on a label or line, the tile grows (minHeight only), in en, es and ko', async () => {
    useGuestStore.setState({ record: null });
    for (const locale of ['en', 'es', 'ko'] as UiLocale[]) {
      useLocaleStore.setState({ device: locale, byProfile: {} });
      const m = getMessages(locale);
      for (const params of [{ trigger: 'try' }] as Params[]) {
        const { r } = await renderChooser(params);
        const tile = byTestId(r.root, 'who-try')[0]!;
        expect(screenTexts(tile)).toEqual([m.a11y.who.try, m.learner.who.try, m.learner.who.trySub]);
        const clamped = tile.findAll((n) => typeof n.type === 'string' && (n.props.numberOfLines !== undefined || n.props.ellipsizeMode !== undefined));
        expect(clamped, locale).toEqual([]);
        await cleanup();
      }
      useGuestStore.setState({ record: GUEST });
      const { r } = await renderChooser({ trigger: 'manual' });
      const tile = byTestId(r.root, 'who-guest')[0]!;
      expectTile(screenTexts(tile), m.a11y.who.guest, m.learner.who.guest, m.learner.who.guestCaption);
      expect(tile.findAll((n) => typeof n.type === 'string' && n.props.numberOfLines !== undefined)).toEqual([]);
      const style = [tile.props.style].flat(4).reduce((acc, s) => ({ ...acc, ...(s as object) }), {} as Record<string, unknown>);
      expect(style.height).toBeUndefined();
      // react-native-web writes it out in px: at least touchTarget.hero.
      expect(Number.parseFloat(String(style.minHeight))).toBeGreaterThanOrEqual(96);
      await cleanup();
      useGuestStore.setState({ record: null });
    }
  });
});
