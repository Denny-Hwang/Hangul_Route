import type { Profile } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS sections 3.4 and 3.5 (row DP-1c; test 12 of section 6, the store half): the boot
 * decides from store state, not from a thrown error; Try again reruns `hydrateLearnerData` in full for the list and
 * the one `progress.hydrate` for a learner; Choose another learner needs 2 or more learner profiles.
 */
vi.mock('../../platform/storage', async () => (await import('../../test-support/storage-transactions')).withTransactions({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async () => null),
  readJsonExactFresh: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
}));
vi.mock('../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../../platform/locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: () => {} }));
vi.mock('../../platform/device', () => ({ getDeviceId: vi.fn(async () => 'device-test') }));

import { flags } from '../../config/flags';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import { chooseAnotherOffered, chooserAfterHold, readHold, tryReadAgain } from '../read-failed';

const learner = (id: string): Profile => ({ id, displayName: id, ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: 't' });
const chooserFlag = flags.whoChooserEnabled;

beforeEach(() => {
  useProfileStore.setState({ profiles: [learner('p:a')], activeId: 'p:a', hydrated: true, loadFailed: null, listCopyKept: false });
  useProgressStore.setState({ loadFailedFor: new Set(), hydratedFor: new Set(['p:a']) });
  flags.whoChooserEnabled = true;
});

afterEach(() => {
  flags.whoChooserEnabled = chooserFlag;
  vi.restoreAllMocks();
});

describe('readHold: from store state', () => {
  it('nothing held when the list and the active learner were read', () => {
    expect(readHold()).toBeNull();
  });

  it('a list that could not be read holds the list variant, with its cause and whether a copy was kept', () => {
    useProfileStore.setState({ hydrated: false, profiles: [], activeId: null, loadFailed: 'parse', listCopyKept: true });
    expect(readHold()).toEqual({ variant: 'list', cause: 'parse', kept: true });
    useProfileStore.setState({ loadFailed: 'read', listCopyKept: false });
    expect(readHold()).toEqual({ variant: 'list', cause: 'read', kept: false });
  });

  it('the active learner in loadFailedFor holds the learner variant', () => {
    useProgressStore.setState({ loadFailedFor: new Set(['p:a']), hydratedFor: new Set() });
    expect(readHold()).toEqual({ variant: 'learner', profileId: 'p:a' });
  });

  it('a learner who is not active holds nothing (the chooser marks nothing)', () => {
    useProfileStore.setState({ profiles: [learner('p:a'), learner('p:b')], activeId: 'p:a' });
    useProgressStore.setState({ loadFailedFor: new Set(['p:b']) });
    expect(readHold()).toBeNull();
    useProfileStore.setState({ activeId: null });
    expect(readHold()).toBeNull();
  });
});

describe('tryReadAgain (Try again)', () => {
  it('list: reruns hydrateLearnerData in full, and the hold goes when the list reads', async () => {
    useProfileStore.setState({ hydrated: false, profiles: [], activeId: null, loadFailed: 'read' });
    const hydrate = vi.spyOn(useProgressStore.getState(), 'hydrate');
    const rereadAll = vi.fn(async () => {
      useProfileStore.setState({ hydrated: true, profiles: [learner('p:a')], activeId: 'p:a', loadFailed: null });
    });
    await expect(tryReadAgain({ variant: 'list', cause: 'read', kept: false }, rereadAll)).resolves.toBeNull();
    expect(rereadAll).toHaveBeenCalledTimes(1);
    expect(hydrate).not.toHaveBeenCalled();
  });

  it('list: a list that reads but an active learner whose progress does not moves to the learner variant', async () => {
    useProfileStore.setState({ hydrated: false, profiles: [], activeId: null, loadFailed: 'read' });
    const rereadAll = vi.fn(async () => {
      useProfileStore.setState({ hydrated: true, profiles: [learner('p:a')], activeId: 'p:a', loadFailed: null });
      useProgressStore.setState({ loadFailedFor: new Set(['p:a']), hydratedFor: new Set() });
    });
    await expect(tryReadAgain({ variant: 'list', cause: 'read', kept: false }, rereadAll)).resolves.toEqual({ variant: 'learner', profileId: 'p:a' });
  });

  it('list: a rejected hydrate of another store is ignored; the hold is read from state', async () => {
    useProfileStore.setState({ hydrated: false, profiles: [], activeId: null, loadFailed: 'parse', listCopyKept: false });
    const rereadAll = vi.fn(async () => {
      throw new Error('the account record');
    });
    await expect(tryReadAgain({ variant: 'list', cause: 'parse', kept: false }, rereadAll)).resolves.toEqual({ variant: 'list', cause: 'parse', kept: false });
  });

  it('learner: reruns that one learner progress hydrate, never the full read', async () => {
    useProgressStore.setState({ loadFailedFor: new Set(['p:a']), hydratedFor: new Set() });
    const hydrate = vi.fn(async (id: string) => {
      useProgressStore.setState((s) => ({ loadFailedFor: new Set([...s.loadFailedFor].filter((x) => x !== id)), hydratedFor: new Set([...s.hydratedFor, id]) }));
    });
    useProgressStore.setState({ hydrate });
    const rereadAll = vi.fn(async () => undefined);
    await expect(tryReadAgain({ variant: 'learner', profileId: 'p:a' }, rereadAll)).resolves.toBeNull();
    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(hydrate).toHaveBeenCalledWith('p:a');
    expect(rereadAll).not.toHaveBeenCalled();
  });

  it('learner: a read that fails again keeps the hold', async () => {
    useProgressStore.setState({ loadFailedFor: new Set(['p:a']), hydratedFor: new Set(), hydrate: vi.fn(async () => undefined) });
    await expect(tryReadAgain({ variant: 'learner', profileId: 'p:a' })).resolves.toEqual({ variant: 'learner', profileId: 'p:a' });
  });
});

describe('chooseAnotherOffered', () => {
  it('needs 2 or more learner profiles and the chooser', () => {
    expect(chooseAnotherOffered()).toBe(false);
    useProfileStore.setState({ profiles: [learner('p:a'), learner('p:b')] });
    expect(chooseAnotherOffered()).toBe(true);
    flags.whoChooserEnabled = false;
    expect(chooseAnotherOffered()).toBe(false);
  });

  it('a legacy grown-up row is not a second learner', () => {
    useProfileStore.setState({ profiles: [learner('p:a'), { ...learner('p:g'), role: 'parent' } as Profile] });
    expect(chooseAnotherOffered()).toBe(false);
  });
});

describe('chooserAfterHold (RootNavigator after Choose another learner)', () => {
  it('opens the chooser as manual when the launch opens none', () => {
    expect(chooserAfterHold(null, true, false)).toBe('manual');
    expect(chooserAfterHold(null, false, false)).toBeNull();
  });

  it('a launch chooser wins; Who is joining? (a hand-off pending) shows its own chooser after', () => {
    expect(chooserAfterHold('launch', true, false)).toBe('launch');
    expect(chooserAfterHold(null, true, true)).toBeNull();
  });

  it('none with the chooser switched off', () => {
    flags.whoChooserEnabled = false;
    expect(chooserAfterHold(null, true, false)).toBeNull();
  });
});
