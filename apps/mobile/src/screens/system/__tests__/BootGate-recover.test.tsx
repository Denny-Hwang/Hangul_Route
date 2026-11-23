import { getMessages } from '@hangul-route/i18n';
import { useState } from 'react';
import { Text } from 'react-native';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.6 (row DP-1d; tests 10 and 12 of section 6): at boot, a profile list whose
 * bytes do not parse and were kept offers A grown-up can help; after the grown-up gate, the RecoverRecord sheet's Start
 * fresh writes the empty list once (`recoverProfileList`, the real store over an in-memory storage that keeps raw
 * strings), every store is read again, and the app opens (Welcome, as on a new device) with the post-hydrate chain
 * run once. Not now writes nothing and keeps the screen.
 */
const disk = vi.hoisted(() => new Map<string, string>());
const parseRaw = (key: string): unknown => {
  const raw = disk.get(key);
  return raw === undefined || raw === '' ? null : (JSON.parse(raw) as unknown);
};
vi.mock('../../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => {
    try {
      return parseRaw(key);
    } catch {
      return null;
    }
  }),
  readJsonStrict: vi.fn(async (key: string) => {
    try {
      return parseRaw(key);
    } catch {
      return null;
    }
  }),
  readJsonExact: vi.fn(async (key: string) => parseRaw(key)),
  readJsonExactFresh: vi.fn(async (key: string) => parseRaw(key)),
  writeJson: vi.fn(async (key: string, value: unknown) => void disk.set(key, JSON.stringify(value))),
  removeKey: vi.fn(async (key: string) => void disk.delete(key)),
  listKeys: vi.fn(async () => [...disk.keys()]),
  keepRawCopy: vi.fn(async (from: string, to: string) => {
    const raw = disk.get(from);
    if (raw === undefined || raw === '') return false;
    try {
      JSON.parse(raw);
      return false;
    } catch {
      if (!disk.has(to)) disk.set(to, raw);
      return true;
    }
  }),
  updateJson: vi.fn(async () => false),
  setWriteFence: vi.fn(),
}));
vi.mock('../../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../../../platform/screen-reader', () => ({ announceForScreenReader: vi.fn(), focusForScreenReader: vi.fn() }));
vi.mock('../../../platform/profiles-channel', () => ({ postProfilesChanged: vi.fn(), subscribeProfilesChanged: vi.fn(() => () => undefined) }));
const sheet = vi.hoisted(() => ({ answer: null as null | ((yes: boolean) => void), asked: 0 }));
vi.mock('../../../platform/dialog', () => ({
  confirm: vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        sheet.asked += 1;
        sheet.answer = resolve;
      }),
  ),
}));
/** The hold's stack, with a stand-in navigation the test drives (the PIN screen is `PinEntryScreen.test.tsx`'s). */
const nav = vi.hoisted(() => ({ opened: [] as unknown[], focus: [] as (() => void)[] }));
vi.mock('../../../navigation/recover-stack', async () => {
  const { RecoverHoldScreen } = await import('../RecoverHoldScreen');
  const navigation = {
    navigate: (name: string, params: unknown) => void nav.opened.push({ name, params }),
    addListener: (_type: string, listener: () => void) => {
      nav.focus.push(listener);
      return () => void nav.focus.splice(nav.focus.indexOf(listener), 1);
    },
  };
  return { RecoverStack: (props: { onTryAgain: () => Promise<boolean>; onStartFresh: () => Promise<boolean> }) => <RecoverHoldScreen navigation={navigation} {...props} /> };
});

import { useAccountStore } from '../../../store/account-store';
import { useProfileStore } from '../../../store/profile-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, press, render, screenTexts } from '../../../test-support/render';
import { BootGate } from '../BootGate';
import { resetReadFailedTriesForTests } from '../ProgressReadFailedScreen';

const m = getMessages('en').learner.progressReadFailed;
const WELCOME = 'Welcome (the navigator)';
const DAMAGED = '[{"id":"profile:mina","displayName":"Mi';

const flush = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

function Harness({ rereadAll, onOpen }: { rereadAll: () => Promise<void>; onOpen: () => void }) {
  const [opened, setOpened] = useState<{ chooseLearner: boolean } | null>(null);
  const [firstRead] = useState(() => useProfileStore.getState().hydrate());
  return (
    <BootGate
      firstRead={firstRead}
      rereadAll={rereadAll}
      settle={async () => undefined}
      opened={opened}
      onOpen={(open) => {
        setOpened(open);
        onOpen();
      }}
    >
      {() => <Text>{`${WELCOME}: ${useProfileStore.getState().profiles.length} learners`}</Text>}
    </BootGate>
  );
}

/** Boots on damaged list bytes, presses A grown-up can help, and comes back from a correct PIN to the sheet. */
async function toTheSheet() {
  const onOpen = vi.fn();
  const rereadAll = vi.fn(() => useProfileStore.getState().hydrate());
  const r = await render(<Harness rereadAll={rereadAll} onOpen={onOpen} />);
  await flush();
  expect(screenTexts(r.root)).toContain(m.title);
  await press(buttonsNamed(r.root, m.grownUpHelp)[0] as ReactTestInstance);
  expect(nav.opened).toEqual([{ name: 'PinEntry', params: { next: 'RecoverRecord' } }]);
  // The PIN screen accepted the PIN and went back (PinEntry's `back()`): gate open, one return marked.
  useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: Date.now(), gateReturnPending: true });
  await act(async () => {
    for (const listener of [...nav.focus]) listener();
  });
  expect(sheet.asked).toBe(1);
  return { r, onOpen, rereadAll };
}

beforeEach(async () => {
  resetReadFailedTriesForTests();
  disk.clear();
  nav.opened.length = 0;
  sheet.answer = null;
  sheet.asked = 0;
  disk.set('profiles', DAMAGED);
  disk.set('progress:profile:mina', '{"profileId":"profile:mina"}');
  useProfileStore.setState({ profiles: [], activeId: null, hydrated: false, loadFailed: null, listCopyKept: false });
  useAccountStore.setState({ parentPinHash: 'h:1234', pinHashReadFailed: false });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null, lastPinTypedAt: null, gateReturnPending: false });
  await flush();
});

describe('[DP] BootGate: Start fresh on this device (section 3.6)', () => {
  it('Start fresh: the empty list is written once, every store is read again, and the app opens with the chain run once', async () => {
    const { r, onOpen, rereadAll } = await toTheSheet();
    expect(disk.get('profiles-corrupt')).toBe(DAMAGED);
    await act(async () => sheet.answer?.(true));
    await flush();
    expect(JSON.parse(disk.get('profiles') as string)).toEqual([]);
    // Kept, word for word; per-profile keys untouched (learners come back through Restore).
    expect(disk.get('profiles-corrupt')).toBe(DAMAGED);
    expect(disk.get('progress:profile:mina')).toBe('{"profileId":"profile:mina"}');
    expect(rereadAll).toHaveBeenCalledTimes(1);
    expect(screenTexts(r.root)).toContain(`${WELCOME}: 0 learners`);
    expect(onOpen).toHaveBeenCalledTimes(1);
    // The session the PIN opened ended with the action.
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
  });

  it('Not now: nothing is written, the screen stays and the chain waits', async () => {
    const { r, onOpen, rereadAll } = await toTheSheet();
    await act(async () => sheet.answer?.(false));
    await flush();
    expect(disk.get('profiles')).toBe(DAMAGED);
    expect(rereadAll).not.toHaveBeenCalled();
    expect(screenTexts(r.root)).toContain(m.title);
    expect(buttonsNamed(r.root, m.grownUpHelp)).toHaveLength(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('bytes that read again before the confirm are never written over; the app opens on the list that is there', async () => {
    const { r, onOpen } = await toTheSheet();
    disk.set('profiles', JSON.stringify([{ id: 'profile:bo', displayName: 'Bo', ageGroup: '8-9', avatar: 'hoya-pink', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z' }]));
    await act(async () => sheet.answer?.(true));
    await flush();
    expect(JSON.parse(disk.get('profiles') as string)).toHaveLength(1);
    // Nothing was written: the screen stays until Try again reads the list.
    expect(screenTexts(r.root)).toContain(m.title);
    expect(onOpen).not.toHaveBeenCalled();
    await press(buttonsNamed(r.root, m.tryAgain)[0] as ReactTestInstance);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    await flush();
    expect(screenTexts(r.root)).toContain(`${WELCOME}: 1 learners`);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
