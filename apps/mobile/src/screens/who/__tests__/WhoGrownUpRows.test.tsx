import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-4b, section 20 (sections 5.3, 6.1 items 4 and 5, 7.1, 12; CS-1, CS-7):
 * the chooser's grown-up rows on the web come from `deviceUses` (Family, Teacher, School, in that order), Sign in as
 * a grown-up shows when no use is known, native shows only the Grown-up area, offline rows are disabled with Needs the
 * internet while the Grown-up area stays enabled, a use row asks the PIN (`GrownUpUse`) and sends `who.picked` with
 * its use, a self-only device without a PIN hands off at once with `via: 'chooser'`, and no row names the account.
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
const uses = vi.hoisted(() => ({ value: [] as string[] }));
vi.mock('../../../platform/device-uses', () => ({ readDeviceUses: vi.fn(async () => [...uses.value]) }));
const net = vi.hoisted(() => ({ online: true }));
vi.mock('../../../platform/online', () => ({ isOnline: () => net.online, subscribeOnline: () => () => undefined }));
const handoff = vi.hoisted(() => ({ opened: [] as { via: string; target?: string }[], result: 'opened' as 'opened' | 'pin' }));
vi.mock('../../../platform/grown-up-handoff', () => ({
  openGrownUpArea: vi.fn(async (request: { via: string; target?: string }) => {
    handoff.opened.push(request);
    return handoff.result;
  }),
  continueToGrownUpPage: vi.fn(),
  clearGrownUpTab: vi.fn(),
}));

import { useAccountStore } from '../../../store/account-store';
import { useLocaleStore } from '../../../store/locale-store';
import { useProfileStore } from '../../../store/profile-store';
import { useUiStore } from '../../../store/ui-store';
import { refreshKnownUses, resetChooserState } from '../../../store/who-chooser';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { WhoIsUsingScreen } from '../WhoIsUsingScreen';

const en = getMessages('en');
const w = en.learner.who;
const zone = en.caregiver.audience.family.zoneLabel;
const needsInternet = en.learner.welcome.grownUps.needsInternet;

const learner = (id: string, displayName: string, learnerType: 'child' | 'self' = 'child'): Profile => ({
  id,
  displayName,
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  role: 'learner',
  createdAt: '2026-10-01T00:00:00.000Z',
  learnerType,
});

function fakeNavigation() {
  const routes = [{ key: 'who-1', name: 'WhoIsUsing', params: { trigger: 'launch' } }];
  return {
    getState: () => ({ index: 0, routes }),
    goBack: vi.fn(),
    reset: vi.fn(),
    navigate: vi.fn(),
    setOptions: vi.fn(),
    addListener: vi.fn(() => () => undefined),
  };
}

async function renderChooser() {
  const navigation = fakeNavigation();
  const r = await render(<WhoIsUsingScreen navigation={navigation as never} route={{ key: 'who-1', name: 'WhoIsUsing', params: { trigger: 'launch' } } as never} />);
  // The uses read on opening lands.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { r, navigation };
}

/** The rows in reading order, by test id. */
const rowIds = (root: ReactTestInstance): string[] =>
  byTestId(root, 'who-rows')
    .flatMap((node) => node.findAll((n) => typeof n.props.testID === 'string' && /^who-row-[a-z]+$/.test(n.props.testID)))
    .map((n) => n.props.testID as string)
    .filter((id, i, all) => all.indexOf(id) === i);

/** The row's host button (react-native-web's DOM-like node). */
const row = (root: ReactTestInstance, use: string): ReactTestInstance => {
  const [node] = byTestId(root, `who-row-${use}`);
  if (!node) throw new Error(`no row ${use}`);
  return node;
};
/** What the row shows and reads out: its label, its accessible name and its caption (the hint). */
const rowTexts = (root: ReactTestInstance, use: string): string[] => screenTexts(row(root, use));

beforeEach(() => {
  setPlatform('web');
  tracked.length = 0;
  handoff.opened.length = 0;
  handoff.result = 'opened';
  uses.value = [];
  net.online = true;
  resetChooserState();
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useProfileStore.setState({ profiles: [learner('profile:mina', 'Mina'), learner('profile:jun', 'Jun')], activeId: 'profile:mina', hydrated: true, activeSince: Date.now() });
  useAccountStore.setState({ parentPinHash: 'pin-hash', pinResetRequestedAt: null });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
});

describe('the grown-up rows on the chooser (row OA-4b)', () => {
  it('web: the rows come from deviceUses in the order Family, Teacher, School, then the Grown-up area', async () => {
    uses.value = ['school', 'family', 'teacher'];
    const { r } = await renderChooser();
    expect(rowIds(r.root)).toEqual(['who-row-family', 'who-row-teacher', 'who-row-school', 'who-row-area']);
    for (const label of [w.use.family, w.use.teacher, w.use.school]) expect(buttonsNamed(r.root, en.a11y.who.grownUpRow(label))).toHaveLength(1);
    expect(buttonsNamed(r.root, en.a11y.who.grownUpRow(zone))).toHaveLength(1);
    expect(screenTexts(r.root)).not.toContain(w.use.signIn);
  });

  it('web with no known use: Sign in as a grown-up, then the Grown-up area', async () => {
    const { r } = await renderChooser();
    expect(rowIds(r.root)).toEqual(['who-row-signin', 'who-row-area']);
    expect(buttonsNamed(r.root, en.a11y.who.grownUpRow(w.use.signIn))).toHaveLength(1);
  });

  it('the uses read at launch show from the first frame; a use written since is picked up on opening', async () => {
    uses.value = ['family'];
    await refreshKnownUses();
    uses.value = ['family', 'teacher'];
    const { r } = await renderChooser();
    expect(rowIds(r.root)).toEqual(['who-row-family', 'who-row-teacher', 'who-row-area']);
    // One who.shown, sent once the opening read landed: it counts the rows that show (Family, Teacher, Grown-up area).
    expect(tracked.filter((e) => e.name === 'who.shown').map((e) => e.payload?.grownUps)).toEqual([3]);
  });

  it('native: only the Grown-up area, whatever is known', async () => {
    setPlatform('ios');
    uses.value = ['family', 'teacher'];
    const { r } = await renderChooser();
    expect(rowIds(r.root)).toEqual(['who-row-area']);
  });

  it('offline: Family, Teacher, School and Sign in are disabled with Needs the internet; the Grown-up area stays enabled', async () => {
    net.online = false;
    uses.value = ['family', 'teacher', 'school'];
    const { r, navigation } = await renderChooser();
    for (const use of ['family', 'teacher', 'school']) {
      const node = row(r.root, use);
      expect(node.props['aria-disabled'], use).toBe(true);
      expect(rowTexts(r.root, use), use).toContain(needsInternet);
      await press(node);
    }
    expect(navigation.navigate).not.toHaveBeenCalled();
    // The web reads the reason too: the caption is the disabled row's description (aria-describedby), not its name.
    const family = row(r.root, 'family');
    const describedBy = family.props['aria-describedby'] as string;
    expect(describedBy).toEqual(expect.any(String));
    const [described] = r.root.findAll((n) => typeof n.type === 'string' && (n.props.id === describedBy || n.props.nativeID === describedBy));
    expect(described && screenTexts(described)).toContain(needsInternet);
    expect(family.props.accessibilityLabel ?? family.props['aria-label']).not.toContain(needsInternet);
    expect(row(r.root, 'area').props['aria-disabled']).not.toBe(true);
    expect(row(r.root, 'area').props['aria-describedby']).toBeUndefined();
    expect(rowTexts(r.root, 'area')).not.toContain(needsInternet);
    await press(row(r.root, 'area'));
    expect(navigation.navigate).toHaveBeenCalledWith('PinEntry', { next: 'ParentDashboard' });
    await cleanup();

    uses.value = [];
    const again = await renderChooser();
    expect(row(again.r.root, 'signin').props['aria-disabled']).toBe(true);
    expect(rowTexts(again.r.root, 'signin')).toContain(needsInternet);
  });

  it.each(['family', 'teacher', 'school'] as const)('%s asks the PIN (GrownUpUse, verify only) and sends who.picked with its use (CS-1)', async (use) => {
    uses.value = ['family', 'teacher', 'school'];
    // A session opened before the chooser does not count: the chooser closed it on arrival.
    useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: Date.now() });
    const { r, navigation } = await renderChooser();
    await press(row(r.root, use));
    expect(navigation.navigate).toHaveBeenCalledWith('PinEntry', { next: 'GrownUpUse', use });
    expect(handoff.opened).toEqual([]);
    expect(tracked.filter((e) => e.name === 'who.picked').map((e) => e.payload)).toEqual([{ kind: 'grown_up', use }]);
  });

  it('Sign in as a grown-up asks the PIN too, with the use signin', async () => {
    const { r, navigation } = await renderChooser();
    await press(row(r.root, 'signin'));
    expect(navigation.navigate).toHaveBeenCalledWith('PinEntry', { next: 'GrownUpUse', use: 'signin' });
    expect(tracked.filter((e) => e.name === 'who.picked').map((e) => e.payload)).toEqual([{ kind: 'grown_up', use: 'signin' }]);
  });

  it('a self-only device without a PIN (marker none): no lock glyph, and the row hands off at once with via chooser', async () => {
    useProfileStore.setState({ profiles: [learner('profile:me', 'Me', 'self')], activeId: 'profile:me' });
    useAccountStore.setState({ parentPinHash: null });
    uses.value = ['teacher'];
    const { r, navigation } = await renderChooser();
    // Named by its label alone: no PIN guards it.
    expect(buttonsNamed(r.root, w.use.teacher)).toHaveLength(1);
    await press(row(r.root, 'teacher'));
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(handoff.opened).toEqual([{ via: 'chooser', target: '/teach?persona=teacher' }]);
    expect(tracked.find((e) => e.name === 'parent.gate.opened')?.payload).toEqual(expect.objectContaining({ dest: 'use', via: 'open' }));
  });

  it('marker none, but the hand-off still asks a PIN (a stale device marker): the PIN screen opens, never a dead tap', async () => {
    useProfileStore.setState({ profiles: [learner('profile:me', 'Me', 'self')], activeId: 'profile:me' });
    useAccountStore.setState({ parentPinHash: null });
    uses.value = ['school'];
    handoff.result = 'pin';
    const { r, navigation } = await renderChooser();
    await press(row(r.root, 'school'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(handoff.opened).toEqual([{ via: 'chooser', target: '/teach?focus=school' }]);
    expect(navigation.navigate).toHaveBeenCalledWith('PinEntry', { next: 'GrownUpUse', use: 'school' });
  });

  it('a device with child profiles and no PIN yet (nopin): the use rows ask the PIN screen, which sends to sign-in (CS-4)', async () => {
    useAccountStore.setState({ parentPinHash: null });
    uses.value = ['family'];
    const { r, navigation } = await renderChooser();
    // No PIN exists yet, so the name does not announce one; only the Grown-up area carries the nopin caption.
    expect(buttonsNamed(r.root, w.use.family)).toHaveLength(1);
    expect(rowTexts(r.root, 'family')).not.toContain(w.nopinCaption);
    expect(rowTexts(r.root, 'area')).toContain(w.nopinCaption);
    await press(row(r.root, 'family'));
    expect(navigation.navigate).toHaveBeenCalledWith('PinEntry', { next: 'GrownUpUse', use: 'family' });
  });

  it('CS-7: the rows show the generic labels only, never an account name or email', async () => {
    uses.value = ['family', 'teacher', 'school'];
    const { r } = await renderChooser();
    const labels = [w.use.family, w.use.teacher, w.use.school, zone];
    const allowed = new Set([...labels, ...labels.map((label) => en.a11y.who.grownUpRow(label))]);
    const shown = byTestId(r.root, 'who-rows').flatMap((node) => screenTexts(node));
    expect(shown.length).toBeGreaterThan(0);
    for (const text of shown) expect(allowed.has(text), text).toBe(true);
    for (const text of screenTexts(r.root)) expect(text).not.toMatch(/@|Ms Kim|acct|sp_/);
  });
});
