import type { Profile } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// [GU] AMENDMENTS-GUEST-FIRST-LESSON row GU-5 (sections 6.1, 9.1, CS-G4): the launch with the `try=1` intent on a
// device with learner profiles opens "Who is using this?" with the trigger `try`, and never selects, creates or opens
// a profile; with `who=1` and `try=1` it opens once with the trigger `return` and the try tile; a join wins.

const disk = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => (disk.has(key) ? disk.get(key) : null)),
  readJsonExact: vi.fn(async (key: string) => (disk.has(key) ? disk.get(key) : null)),
  readJsonExactFresh: vi.fn(async (key: string) => (disk.has(key) ? disk.get(key) : null)),
  writeJson: vi.fn(async (key: string, value: unknown) => void disk.set(key, value)),
}));
const boot = vi.hoisted(() => ({ intent: null as null | { kind: string; code?: string | null; try?: true } }));
vi.mock('../../platform/app-root', () => ({
  peekBootIntent: () => boot.intent,
  consumeBootIntent: () => {
    boot.intent = null;
  },
}));
vi.mock('../../platform/app-visibility', () => ({ subscribeAppVisibility: () => () => undefined }));
const handoff = vi.hoisted(() => ({ code: null as string | null }));
vi.mock('../../platform/join-handoff', () => ({
  takeJoinHandoff: () => {
    const code = handoff.code;
    handoff.code = null;
    return code;
  },
  hasJoinHandoff: () => handoff.code !== null,
}));
vi.mock('../../platform/device-uses', () => ({ readDeviceUses: vi.fn(async () => []) }));

import { flags } from '../../config/flags';
import { useAccountStore } from '../account-store';
import { resetProfileLocks } from '../profile-locks';
import { useProfileStore } from '../profile-store';
import { chooserLaunchParams, chooserLaunchTrigger, heldJoin, resetChooserState, takeBatchLaunchChooser } from '../who-chooser';

const learner = (id: string): Profile => ({
  id,
  displayName: id.slice(8),
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  role: 'learner',
  createdAt: '2026-10-01T00:00:00.000Z',
  learnerType: 'child',
});

beforeEach(() => {
  disk.clear();
  boot.intent = null;
  handoff.code = null;
  resetChooserState();
  resetProfileLocks();
  flags.whoChooserEnabled = true;
  flags.guestLessonEnabled = true;
  flags.multiJoinEnabled = false;
  useProfileStore.setState({ profiles: [learner('profile:mina'), learner('profile:jun')], activeId: 'profile:mina', hydrated: true });
  useAccountStore.setState({ parentPinHash: 'h' });
});

afterEach(() => {
  flags.whoChooserEnabled = false;
  flags.guestLessonEnabled = false;
  flags.multiJoinEnabled = false;
});

describe('chooserLaunchTrigger with try=1 (section 6.1)', () => {
  it('two profiles: the trigger try, the intent taken, nobody selected (CS-G4)', async () => {
    boot.intent = { kind: 'try' };
    expect(await chooserLaunchTrigger()).toBe('try');
    expect(boot.intent).toBeNull();
    expect(useProfileStore.getState().activeId).toBe('profile:mina');
    expect(chooserLaunchParams('try')).toEqual({ trigger: 'try' });
  });

  it('one profile, not shared, no PIN: still the chooser (OQ-G9 default), so a visitor never plays inside it', async () => {
    useProfileStore.setState({ profiles: [learner('profile:mina')] });
    useAccountStore.setState({ parentPinHash: null });
    boot.intent = { kind: 'try' };
    expect(await chooserLaunchTrigger()).toBe('try');
  });

  it('a locked active profile changes nothing: try', async () => {
    disk.set('profiles:locks', { v: 1, ids: ['profile:mina'] });
    boot.intent = { kind: 'try' };
    expect(await chooserLaunchTrigger()).toBe('try');
  });

  it('a held class code wins: join on a shared device, and the try tile never shows (CS-G4)', async () => {
    handoff.code = 'FAM234';
    boot.intent = { kind: 'try' };
    expect(await chooserLaunchTrigger(1_000)).toBe('join');
    expect(heldJoin(1_000)).toEqual({ code: 'FAM234' });
    expect(boot.intent).toBeNull();
  });

  it('Who is joining? takes the launch (OA-D20): no chooser now, the deferred one is a launch, and try is taken', async () => {
    flags.multiJoinEnabled = true;
    handoff.code = 'FAM234';
    boot.intent = { kind: 'try' };
    expect(await chooserLaunchTrigger(1_000)).toBeNull();
    expect(takeBatchLaunchChooser()).toBe('launch');
    expect(boot.intent).toBeNull();
  });

  it('a held hand-off on a single, unshared profile: no chooser, the intent left for the launch to drop', async () => {
    useProfileStore.setState({ profiles: [learner('profile:mina')] });
    useAccountStore.setState({ parentPinHash: null });
    handoff.code = 'FAM234';
    boot.intent = { kind: 'try' };
    expect(await chooserLaunchTrigger()).toBeNull();
    expect(boot.intent).toEqual({ kind: 'try' });
  });

  it('the guest switch off: try is not a trigger (an ordinary launch on a shared device; the intent is taken)', async () => {
    flags.guestLessonEnabled = false;
    boot.intent = { kind: 'try' };
    expect(await chooserLaunchTrigger()).toBe('launch');
    expect(boot.intent).toBeNull();
    useProfileStore.setState({ profiles: [learner('profile:mina')] });
    useAccountStore.setState({ parentPinHash: null });
    boot.intent = { kind: 'try' };
    expect(await chooserLaunchTrigger()).toBeNull();
    // Left for the launch's guest step, which takes and drops it.
    expect(boot.intent).toEqual({ kind: 'try' });
  });

  it('the chooser switch off: nothing read or taken', async () => {
    flags.whoChooserEnabled = false;
    boot.intent = { kind: 'try' };
    expect(await chooserLaunchTrigger()).toBeNull();
    expect(boot.intent).toEqual({ kind: 'try' });
  });

  it('who=1 with try=1: the chooser once, trigger return, with the try tile; without the guest switch no tile', async () => {
    boot.intent = { kind: 'who', try: true };
    expect(await chooserLaunchTrigger()).toBe('return');
    expect(chooserLaunchParams('return')).toEqual({ trigger: 'return', try: true });
    flags.guestLessonEnabled = false;
    boot.intent = { kind: 'who', try: true };
    expect(await chooserLaunchTrigger()).toBe('return');
    expect(chooserLaunchParams('return')).toEqual({ trigger: 'return' });
  });

  it('a plain launch carries no try', async () => {
    expect(await chooserLaunchTrigger()).toBe('launch');
    expect(chooserLaunchParams('launch')).toEqual({ trigger: 'launch' });
  });
});
