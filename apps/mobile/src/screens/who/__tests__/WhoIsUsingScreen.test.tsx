import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-4a, section 20 (component tests): "Who is using this?" shows no
 * progress (CS-6), swallows every back (CS-5), closes the grown-up session on arrival (CS-2), returns to the screen
 * under it when the same learner is picked, persists a quest under it before a grown-up row, shows the pending
 * 24-hour wait with Cancel the wait (CS-21), and keeps a learner another tab added through a pick here (CS-16).
 */
vi.mock('@react-navigation/native', () => ({ useFocusEffect: (effect: () => void) => (React as typeof import('react')).useEffect(effect, []) }));
const tracked = vi.hoisted(() => [] as { name: string; payload?: Record<string, unknown> }[]);
vi.mock('../../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string }) => {
    tracked.push(event);
    return true;
  }),
}));
const tab = vi.hoisted(() => ({ ended: 0 }));
vi.mock('../../../platform/grown-up-tab', () => ({ endGrownUpTab: () => void (tab.ended += 1) }));

import { useAccountStore } from '../../../store/account-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { useUiStore } from '../../../store/ui-store';
import { holdJoin, resetChooserState } from '../../../store/who-chooser';
import { readJson, writeJson } from '../../../platform/storage';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { WhoIsUsingScreen } from '../WhoIsUsingScreen';

const en = getMessages('en');
const w = en.learner.who;

const learner = (id: string, displayName: string, avatar: Profile['avatar'] = 'hoya-orange'): Profile => ({
  id,
  displayName,
  ageGroup: '8-9',
  avatar,
  role: 'learner',
  createdAt: '2026-10-01T00:00:00.000Z',
  learnerType: 'child',
});

interface FakeRoute {
  key: string;
  name: string;
  params?: unknown;
}

function fakeNavigation(routes: FakeRoute[]) {
  const listeners = new Map<string, ((event: { data: { action: { type: string } }; preventDefault: () => void }) => void)[]>();
  const nav = {
    state: { index: routes.length - 1, routes },
    getState: () => nav.state,
    goBack: vi.fn(() => {
      let prevented = false;
      for (const l of listeners.get('beforeRemove') ?? []) l({ data: { action: { type: 'GO_BACK' } }, preventDefault: () => void (prevented = true) });
      return prevented;
    }),
    reset: vi.fn((state: { index: number; routes: FakeRoute[] }) => {
      nav.state = state;
    }),
    navigate: vi.fn(),
    setOptions: vi.fn(),
    addListener: vi.fn((type: string, listener: (event: { data: { action: { type: string } }; preventDefault: () => void }) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      return () => listeners.set(type, (listeners.get(type) ?? []).filter((l) => l !== listener));
    }),
    /** The Android hardware back, the browser back and the visible Back all reach `beforeRemove` with a back action. */
    hardwareBack: (type = 'GO_BACK'): boolean => {
      let prevented = false;
      for (const l of listeners.get('beforeRemove') ?? []) l({ data: { action: { type } }, preventDefault: () => void (prevented = true) });
      return prevented;
    },
  };
  return nav;
}

const CHOOSER = { key: 'who-1', name: 'WhoIsUsing', params: { trigger: 'manual' } };

async function renderChooser(routes: FakeRoute[] = [CHOOSER], trigger: 'launch' | 'resume' | 'manual' | 'join' = 'manual') {
  const navigation = fakeNavigation(routes);
  const r = await render(<WhoIsUsingScreen navigation={navigation as never} route={{ key: 'who-1', name: 'WhoIsUsing', params: { trigger } } as never} />);
  return { r, navigation };
}

beforeEach(() => {
  setPlatform('ios');
  tracked.length = 0;
  tab.ended = 0;
  resetChooserState();
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useProfileStore.setState({
    profiles: [learner('profile:mina', 'Mina'), learner('profile:jun', 'Jun'), learner('profile:sora', 'Sora', 'hoya-blue')],
    activeId: 'profile:mina',
    hydrated: true,
    activeSince: Date.now() - 30_000,
  });
  useAccountStore.setState({ parentPinHash: 'pin-hash', pinResetRequestedAt: null });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
});

describe('Who is using this? (row OA-4a)', () => {
  it('shows the learners by name, Add a learner and the Grown-up area, and no progress at all (CS-6)', async () => {
    // Each learner has progress on record: none of it may reach the chooser.
    useProgressStore.setState({
      byProfile: {
        'profile:mina': { ...useProgressStore.getState().ensure('profile:mina'), cards: [{ cardId: 'card-x', unlockedAt: '2026-10-02T00:00:00.000Z' }] } as never,
      },
    });
    const { r } = await renderChooser();
    const texts = screenTexts(r.root);
    expect(texts).toEqual(expect.arrayContaining([w.title, w.learning, w.grownUps, 'Mina', 'Jun', 'Sora', en.caregiver.audience.family.zoneLabel]));
    expect(buttonsNamed(r.root, en.a11y.who.tile('Mina'))).toHaveLength(1);
    expect(buttonsNamed(r.root, en.a11y.who.grownUpRow(en.caregiver.audience.family.zoneLabel))).toHaveLength(1);
    const forbidden = /\bstars?\b|★|\bcards?\b|\blevel|streak|\bclass|family:|last played|\d+ (day|min)|Stage|Reading level/i;
    const tileTexts = byTestId(r.root, 'who-tiles').flatMap((node) => screenTexts(node));
    for (const text of tileTexts) expect(text, text).not.toMatch(forbidden);
    // No progress key reaches any component of the tree.
    const progressKeys = ['stars', 'cards', 'level', 'streak', 'progress', 'space', 'lastActiveAt', 'ageGroup'];
    // (`Heading`'s `level` is its type size, not a learner's level.)
    const offending = r.root.findAll(
      (node) =>
        typeof node.type !== 'string' &&
        (node.type as { name?: string }).name !== 'Heading' &&
        Object.keys(node.props).some((key) => progressKeys.includes(key)),
    );
    expect(offending.map((node) => String((node.type as { name?: string }).name))).toEqual([]);
    expect(tracked.find((e) => e.name === 'who.shown')?.payload).toEqual({ trigger: 'manual', learners: '3-4', grownUps: 1, anyLocked: false, resetPending: false });
  });

  it('two learners on one cub get two theme tints; the third keeps the plain plate', async () => {
    const { r } = await renderChooser();
    const plate = (i: number) => (byTestId(r.root, `who-tile-${i}-plate`)[0]!.props.style as Record<string, unknown>[] | Record<string, unknown>);
    const bg = (i: number): unknown => [plate(i)].flat(4).map((s) => (s as { backgroundColor?: unknown })?.backgroundColor).find(Boolean);
    expect(new Set([bg(0), bg(1), bg(2)]).size).toBe(3);
  });

  it('arriving closes the grown-up session, clears the tab and tells the other tabs (CS-2)', async () => {
    useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: Date.now() });
    await renderChooser();
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
    expect(tab.ended).toBe(1);
  });

  it('swallows every back: the Android hardware back, the browser back and a pop (CS-5)', async () => {
    const { navigation } = await renderChooser([{ key: 'main', name: 'Main' }, CHOOSER]);
    expect(navigation.hardwareBack('GO_BACK')).toBe(true);
    expect(navigation.hardwareBack('POP')).toBe(true);
    expect(navigation.setOptions).toHaveBeenCalledWith({ gestureEnabled: false });
  });

  it('picking the learner who was playing goes back to the screen under it, which continues', async () => {
    const quest = { key: 'quest', name: 'QuestPlayer', params: { questId: 'q', episodeId: 'e' } };
    const { r, navigation } = await renderChooser([{ key: 'main', name: 'Main' }, quest, CHOOSER], 'resume');
    await press(buttonsNamed(r.root, en.a11y.who.tile('Mina'))[0] as ReactTestInstance);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.goBack.mock.results[0]!.value).toBe(false);
    expect(navigation.reset).not.toHaveBeenCalled();
    expect(useProfileStore.getState().activeId).toBe('profile:mina');
    expect(tracked.filter((e) => e.name === 'profile.switch')).toHaveLength(0);
    expect(tracked.find((e) => e.name === 'who.picked')?.payload).toEqual({ kind: 'learner' });
  });

  it('picking another learner over a quest persists it first, then lands on Home with that learner', async () => {
    const sessionId = useProgressStore.getState().beginSession('profile:mina', { owner: 'quest', streak: true });
    expect(useProgressStore.getState().openSession).not.toBeNull();
    const quest = { key: 'quest', name: 'QuestPlayer', params: { questId: 'q', episodeId: 'e' } };
    const { r, navigation } = await renderChooser([{ key: 'main', name: 'Main' }, quest, CHOOSER], 'resume');
    await press(buttonsNamed(r.root, en.a11y.who.tile('Jun'))[0] as ReactTestInstance);
    expect(sessionId).not.toBeNull();
    expect(useProgressStore.getState().openSession).toBeNull();
    expect(useProfileStore.getState().activeId).toBe('profile:jun');
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    expect(tracked.find((e) => e.name === 'profile.switch')?.payload).toEqual({ via: 'chooser', trigger: 'resume', locked: false, minutesIn: '0-2' });
  });

  it('the same learner over a grown-up page lands on Home: a learner never returns there without the PIN', async () => {
    const { r, navigation } = await renderChooser([{ key: 'main', name: 'Main' }, { key: 'dash', name: 'ParentDashboard' }, CHOOSER], 'resume');
    await press(buttonsNamed(r.root, en.a11y.who.tile('Mina'))[0] as ReactTestInstance);
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
  });

  it('a grown-up row over a quest persists the quest, leaves only the chooser over Home, then asks the PIN', async () => {
    useProgressStore.getState().beginSession('profile:mina', { owner: 'quest', streak: true });
    const quest = { key: 'quest', name: 'QuestPlayer', params: { questId: 'q', episodeId: 'e' } };
    const { r, navigation } = await renderChooser([{ key: 'main', name: 'Main' }, quest, CHOOSER], 'resume');
    await press(byTestId(r.root, 'who-row-area')[0] as ReactTestInstance);
    expect(useProgressStore.getState().openSession).toBeNull();
    expect(navigation.reset).toHaveBeenCalledWith({ index: 1, routes: [{ name: 'Main' }, { key: 'who-1', name: 'WhoIsUsing', params: { trigger: 'resume' } }] });
    expect(navigation.navigate).toHaveBeenLastCalledWith('PinEntry', { next: 'ParentDashboard' });
    expect(tracked.find((e) => e.name === 'who.picked')?.payload).toEqual({ kind: 'grown_up', use: 'area' });
    // The learner did not change.
    expect(useProfileStore.getState().activeId).toBe('profile:mina');
  });

  it('at launch (nothing under it) a grown-up row only asks the PIN', async () => {
    const { r, navigation } = await renderChooser([CHOOSER], 'launch');
    await press(byTestId(r.root, 'who-row-area')[0] as ReactTestInstance);
    expect(navigation.reset).not.toHaveBeenCalled();
    expect(navigation.navigate).toHaveBeenLastCalledWith('PinEntry', { next: 'ParentDashboard' });
  });

  it('nopin: the Grown-up area row carries the caption as its hint, named by its label alone', async () => {
    useAccountStore.setState({ parentPinHash: null });
    const { r } = await renderChooser();
    expect(screenTexts(r.root)).toContain(w.nopinCaption);
    expect(buttonsNamed(r.root, en.caregiver.audience.family.zoneLabel)).toHaveLength(1);
  });

  it('a self-only device without a PIN: the row has no lock and opens the area directly', async () => {
    useProfileStore.setState({ profiles: [{ ...learner('profile:me', 'Sam'), learnerType: 'self' }], activeId: 'profile:me' });
    useAccountStore.setState({ parentPinHash: null });
    const { r, navigation } = await renderChooser();
    await press(byTestId(r.root, 'who-row-area')[0] as ReactTestInstance);
    expect(navigation.navigate).toHaveBeenLastCalledWith('ParentDashboard');
    // The marker code comes from the device gate marker store, which this render does not bind.
    expect(tracked.find((e) => e.name === 'parent.gate.opened')?.payload).toMatchObject({ dest: 'area', via: 'open' });
  });

  it('Add a learner goes through the gate', async () => {
    const { r, navigation } = await renderChooser();
    await press(byTestId(r.root, 'who-add')[0] as ReactTestInstance);
    expect(navigation.navigate).toHaveBeenLastCalledWith('PinEntry', { next: 'AddProfile' });
    expect(tracked.find((e) => e.name === 'who.picked')?.payload).toEqual({ kind: 'add' });
  });

  it('a running Forgot PIN wait: the pending line and Cancel the wait, which asks the PIN to stop it (CS-21)', async () => {
    useAccountStore.setState({ pinResetRequestedAt: new Date(Date.now() - 60 * 60_000).toISOString() });
    const { r, navigation } = await renderChooser();
    const [line] = byTestId(r.root, 'who-reset-pending');
    expect(screenTexts(line as ReactTestInstance).join(' ')).toMatch(/^A new grown-up PIN can be set after .+\. Enter the PIN to cancel\./);
    expect(tracked.find((e) => e.name === 'who.shown')?.payload).toMatchObject({ resetPending: true });
    // The line comes before the rows, and no live region carries it.
    expect(r.root.findAll((n) => n.props['aria-live'] !== undefined && screenTexts(n).some((t) => t.includes('grown-up PIN can be set')))).toEqual([]);
    await press(buttonsNamed(r.root, w.resetCancel)[0] as ReactTestInstance);
    expect(navigation.navigate).toHaveBeenLastCalledWith('PinEntry', { next: 'CancelReset' });
    expect(tracked.find((e) => e.name === 'who.picked' && e.payload?.kind === 'cancel_reset')).toBeDefined();
  });

  it('no wait, or no PIN to cancel one with: no pending line', async () => {
    let { r } = await renderChooser();
    expect(byTestId(r.root, 'who-reset-pending')).toHaveLength(0);
    await cleanup();
    useAccountStore.setState({ parentPinHash: null, pinResetRequestedAt: new Date().toISOString() });
    ({ r } = await renderChooser());
    expect(byTestId(r.root, 'who-reset-pending')).toHaveLength(0);
  });

  it('a held join code: the caption, and the picked learner gets Join prefilled (OA-D20)', async () => {
    holdJoin('ABC234');
    const { r, navigation } = await renderChooser([CHOOSER], 'join');
    expect(screenTexts(r.root)).toContain(w.joinCaption);
    await press(buttonsNamed(r.root, en.a11y.who.tile('Jun'))[0] as ReactTestInstance);
    expect(useProfileStore.getState().activeId).toBe('profile:jun');
    expect(navigation.reset).toHaveBeenCalledWith({ index: 1, routes: [{ name: 'Main' }, { name: 'JoinSpace', params: { code: 'ABC234' } }] });
  });

  it('a learner added in another tab survives a pick here (CS-16)', async () => {
    const { r } = await renderChooser();
    // Another tab adds Leo to the stored list.
    await writeJson('profiles', [...useProfileStore.getState().profiles, learner('profile:leo-tab', 'Leo', 'hoya-green')]);
    await press(buttonsNamed(r.root, en.a11y.who.tile('Jun'))[0] as ReactTestInstance);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const stored = (await readJson<Profile[]>('profiles')) ?? [];
    expect(stored.map((p) => p.id)).toContain('profile:leo-tab');
    expect(await readJson('profiles:active')).toBe('profile:jun');
  });
});
