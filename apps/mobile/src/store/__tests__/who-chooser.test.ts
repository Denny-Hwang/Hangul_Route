import { CHOOSER_RESUME_MS, GROWN_UP_BACKGROUND_MS, JOIN_HANDOFF_MS, type Profile } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-4a (section 6.2, OA-D6, OA-D20; CS-5, CS-19): the chooser's triggers
// at run time: the launch decision with the boot intents and a held join, the resume rule, the held code.

const disk = vi.hoisted(() => new Map<string, unknown>());
const failRead = vi.hoisted(() => ({ on: false }));
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (key: string) => (disk.has(key) ? disk.get(key) : null)),
  readJsonExact: vi.fn(async (key: string) => {
    if (failRead.on) throw new Error('read failed');
    return disk.has(key) ? disk.get(key) : null;
  }),
  writeJson: vi.fn(async (key: string, value: unknown) => void disk.set(key, value)),
}));
const boot = vi.hoisted(() => ({ intent: null as null | { kind: string; code?: string | null; next?: string } }));
vi.mock('../../platform/app-root', () => ({
  peekBootIntent: () => boot.intent,
  consumeBootIntent: () => {
    boot.intent = null;
  },
}));
// The native `AppState` wrapper is not loaded in the node lane; the resume rule takes its subscribe as a dependency.
vi.mock('../../platform/app-visibility', () => ({ subscribeAppVisibility: () => () => undefined }));
const handoff = vi.hoisted(() => ({ code: null as string | null }));
vi.mock('../../platform/join-handoff', () => ({
  takeJoinHandoff: () => {
    const code = handoff.code;
    handoff.code = null;
    return code;
  },
}));

import { flags } from '../../config/flags';
import { useAccountStore } from '../account-store';
import { useProfileStore } from '../profile-store';
import { useProgressStore } from '../progress-store';
import {
  activeProfileLocked,
  anyProfileLocked,
  bindChooserResume,
  chooserLaunchTrigger,
  deviceShared,
  heldJoin,
  holdJoin,
  persistLeaving,
  readProfileLocks,
  resetChooserState,
  switchOffered,
  takeHeldJoin,
  whoMarker,
  whoReturnTrigger,
} from '../who-chooser';

const learner = (id: string, learnerType: 'child' | 'self' = 'child'): Profile => ({
  id,
  displayName: id.slice(8),
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  role: 'learner',
  createdAt: '2026-10-01T00:00:00.000Z',
  learnerType,
});

const two = [learner('profile:mina'), learner('profile:jun')];

beforeEach(() => {
  disk.clear();
  failRead.on = false;
  boot.intent = null;
  handoff.code = null;
  resetChooserState();
  flags.whoChooserEnabled = true;
  useProfileStore.setState({ profiles: two, activeId: 'profile:mina', hydrated: true });
  useAccountStore.setState({ parentPinHash: 'h' });
});

afterEach(() => {
  flags.whoChooserEnabled = false;
});

describe('the device as the chooser reads it', () => {
  it('the marker code follows the gate: pin, nopin, none', () => {
    expect(whoMarker()).toBe('pin');
    useAccountStore.setState({ parentPinHash: null });
    expect(whoMarker()).toBe('nopin');
    useProfileStore.setState({ profiles: [learner('profile:me', 'self')] });
    expect(whoMarker()).toBe('none');
  });

  it('two learners are shared; one is not; grown-up device roles are not learners', () => {
    expect(deviceShared()).toBe(true);
    useProfileStore.setState({ profiles: [learner('profile:mina'), { ...learner('profile:mom'), role: 'parent' }] });
    expect(deviceShared()).toBe(false);
  });

  it('reads the locks: missing is none, a broken record or a failed read is unread (fail closed)', async () => {
    expect(await readProfileLocks()).toEqual([]);
    disk.set('profiles:locks', { v: 1, ids: ['profile:mina', 'profile:mina'] });
    expect(await readProfileLocks()).toEqual(['profile:mina']);
    disk.set('profiles:locks', { v: 9 });
    expect(await readProfileLocks()).toBe('unread');
    failRead.on = true;
    expect(await readProfileLocks()).toBe('unread');
  });

  it('switchOffered: the flag on and 2 or more learners', () => {
    expect(switchOffered(2)).toBe(true);
    expect(switchOffered(1)).toBe(false);
    flags.whoChooserEnabled = false;
    expect(switchOffered(5)).toBe(false);
  });
});

describe('chooserLaunchTrigger (section 6.2)', () => {
  it('the flag off: no chooser, and no intent or hand-off is taken', async () => {
    flags.whoChooserEnabled = false;
    boot.intent = { kind: 'who' };
    handoff.code = 'ABC234';
    expect(await chooserLaunchTrigger()).toBeNull();
    expect(boot.intent).toEqual({ kind: 'who' });
    expect(handoff.code).toBe('ABC234');
  });

  it('no profile: no chooser', async () => {
    useProfileStore.setState({ profiles: [], activeId: null });
    expect(await chooserLaunchTrigger()).toBeNull();
  });

  it('a shared device opens it at launch; a single learner does not', async () => {
    expect(await chooserLaunchTrigger()).toBe('launch');
    useProfileStore.setState({ profiles: [learner('profile:mina')] });
    expect(await chooserLaunchTrigger()).toBeNull();
  });

  it('a locked active profile opens it at every launch (CS-19); a lock without a PIN is void', async () => {
    useProfileStore.setState({ profiles: [learner('profile:mina')] });
    disk.set('profiles:locks', { v: 1, ids: ['profile:mina'] });
    expect(await chooserLaunchTrigger()).toBe('launch');
    expect(activeProfileLocked()).toBe(true);
    useAccountStore.setState({ parentPinHash: null });
    expect(await chooserLaunchTrigger()).toBeNull();
  });

  it('locks that cannot be read count every profile as locked while a PIN exists', async () => {
    useProfileStore.setState({ profiles: [learner('profile:mina')] });
    failRead.on = true;
    expect(await chooserLaunchTrigger()).toBe('launch');
  });

  it('the class join link on a shared device: the code is held, the intent taken, the trigger join (OA-D20)', async () => {
    boot.intent = { kind: 'join', code: 'ABC234' };
    expect(await chooserLaunchTrigger(1_000)).toBe('join');
    expect(boot.intent).toBeNull();
    expect(heldJoin(1_000)).toEqual({ code: 'ABC234' });
  });

  it('the family home hand-off code on a shared device is moved into memory too', async () => {
    handoff.code = 'FAM234';
    expect(await chooserLaunchTrigger(1_000)).toBe('join');
    expect(handoff.code).toBeNull();
    expect(heldJoin(1_000)).toEqual({ code: 'FAM234' });
  });

  it('on a single-learner device the join stays for Join as today, and the hand-off is not taken', async () => {
    useProfileStore.setState({ profiles: [learner('profile:mina')] });
    boot.intent = { kind: 'join', code: 'ABC234' };
    handoff.code = 'FAM234';
    expect(await chooserLaunchTrigger()).toBeNull();
    expect(boot.intent).toEqual({ kind: 'join', code: 'ABC234' });
    expect(handoff.code).toBe('FAM234');
  });

  it('who=1 is taken and opens it as return, with one learner too', async () => {
    useProfileStore.setState({ profiles: [learner('profile:mina')] });
    boot.intent = { kind: 'who' };
    expect(await chooserLaunchTrigger()).toBe('return');
    expect(boot.intent).toBeNull();
  });

  it('who=1 with a held hand-off code: the join wins, the chooser shows once as join', async () => {
    boot.intent = { kind: 'who' };
    handoff.code = 'FAM234';
    expect(await chooserLaunchTrigger()).toBe('join');
    expect(boot.intent).toBeNull();
  });

  it('a gate intent stays for its PIN screen over the chooser (CS-5)', async () => {
    boot.intent = { kind: 'grown-up', next: '/parent' };
    expect(await chooserLaunchTrigger()).toBe('launch');
    expect(boot.intent).toEqual({ kind: 'grown-up', next: '/parent' });
  });

  it('whoReturnTrigger: the late who=1 hand-off, off with the flag', () => {
    expect(whoReturnTrigger()).toBe('return');
    holdJoin('ABC234');
    expect(whoReturnTrigger()).toBe('join');
    flags.whoChooserEnabled = false;
    expect(whoReturnTrigger()).toBeNull();
  });
});

describe('the held join code', () => {
  it('lives 30 minutes, is taken once, and is dropped when stale or from the future', () => {
    holdJoin('ABC234', 1_000);
    expect(heldJoin(1_000 + JOIN_HANDOFF_MS - 1)).toEqual({ code: 'ABC234' });
    expect(takeHeldJoin(1_000 + 5)).toEqual({ code: 'ABC234' });
    expect(heldJoin(1_000 + 5)).toBeNull();
    holdJoin(null, 1_000);
    expect(heldJoin(1_000 + JOIN_HANDOFF_MS)).toBeNull();
    holdJoin('ABC234', 5_000);
    expect(heldJoin(4_000)).toBeNull();
    expect(takeHeldJoin()).toBeNull();
  });
});

describe('bindChooserResume (section 6.2)', () => {
  function harness(route: { name: string; params?: unknown } | null = { name: 'Main' }) {
    let listener: (visible: boolean) => void = () => undefined;
    let now = 0;
    const nav = {
      isReady: vi.fn(() => true),
      getCurrentRoute: vi.fn(() => route ?? undefined),
      navigate: vi.fn(),
      getRootState: vi.fn(() => (route === null ? undefined : { routes: [{ name: 'Main' }, route] })),
      dispatch: vi.fn(),
    };
    const off = bindChooserResume(nav, {
      subscribe: (l) => {
        listener = l;
        return () => undefined;
      },
      now: () => now,
      flag: () => flags.whoChooserEnabled,
    });
    const away = (ms: number): void => {
      listener(false);
      now += ms;
      listener(true);
    };
    return { nav, away, off };
  }

  it('a shared device back after 30 minutes opens the chooser over the screen, a shorter break does not', () => {
    const { nav, away, off } = harness({ name: 'QuestPlayer', params: {} });
    away(CHOOSER_RESUME_MS - 1);
    expect(nav.navigate).not.toHaveBeenCalled();
    away(CHOOSER_RESUME_MS);
    expect(nav.navigate).toHaveBeenCalledWith('WhoIsUsing', { trigger: 'resume' });
    expect(typeof off).toBe('function');
  });

  it('a locked active profile: after 5 minutes (CS-19)', async () => {
    useProfileStore.setState({ profiles: [learner('profile:mina')] });
    disk.set('profiles:locks', { v: 1, ids: ['profile:mina'] });
    await chooserLaunchTrigger();
    const { nav, away } = harness();
    away(GROWN_UP_BACKGROUND_MS);
    expect(nav.navigate).toHaveBeenCalledWith('WhoIsUsing', { trigger: 'resume' });
  });

  it('never over itself, a PIN screen or onboarding; never with the flag off or before the navigator is ready', () => {
    for (const name of ['WhoIsUsing', 'PinEntry', 'PinReset', 'Onboarding']) {
      const { nav, away } = harness({ name });
      away(CHOOSER_RESUME_MS);
      expect(nav.navigate, name).not.toHaveBeenCalled();
    }
    const nothing = harness(null);
    nothing.away(CHOOSER_RESUME_MS);
    expect(nothing.nav.navigate).not.toHaveBeenCalled();
    flags.whoChooserEnabled = false;
    const off = harness();
    off.away(CHOOSER_RESUME_MS);
    expect(off.nav.navigate).not.toHaveBeenCalled();
    flags.whoChooserEnabled = true;
    const early = harness();
    early.nav.isReady.mockReturnValue(false);
    early.away(CHOOSER_RESUME_MS);
    expect(early.nav.navigate).not.toHaveBeenCalled();
  });

  it("the PIN screen a closed session left for the Grown-up area gives way to the chooser; any other PIN screen stays", () => {
    const pin = { name: 'PinEntry', params: { next: 'ParentDashboard' } };
    const { nav, away } = harness(pin);
    away(CHOOSER_RESUME_MS - 1);
    expect(nav.dispatch).not.toHaveBeenCalled();
    away(CHOOSER_RESUME_MS);
    expect(nav.navigate).not.toHaveBeenCalled();
    expect(nav.dispatch).toHaveBeenCalledWith({
      type: 'RESET',
      payload: { index: 1, routes: [{ name: 'Main' }, { name: 'WhoIsUsing', params: { trigger: 'resume' } }] },
    });
    for (const params of [{ next: 'AddProfile' }, { next: 'ParentDashboard', mode: 'change' }, { next: 'CancelReset' }]) {
      const other = harness({ name: 'PinEntry', params });
      other.away(CHOOSER_RESUME_MS);
      expect(other.nav.dispatch, JSON.stringify(params)).not.toHaveBeenCalled();
      expect(other.nav.navigate).not.toHaveBeenCalled();
    }
  });

  it('a shown without a hidden first counts no time', () => {
    let listener: (visible: boolean) => void = () => undefined;
    const nav = { isReady: () => true, getCurrentRoute: () => ({ name: 'Main' }), navigate: vi.fn(), getRootState: () => undefined, dispatch: vi.fn() };
    bindChooserResume(nav, { subscribe: (l) => ((listener = l), () => undefined), now: () => 10 * CHOOSER_RESUME_MS, flag: () => true });
    listener(true);
    expect(nav.navigate).not.toHaveBeenCalled();
  });
});

describe('a resume with a Grown-up area page in front, both rules bound in App order (OA-D6, OA-D16)', () => {
  it('the background rule closes the session first; the chooser still ends up in front and the area is off the stack', async () => {
    const { bindGrownUpBackgroundRule } = await import('../../screens/parent/use-gate-lapse');
    const { leaveGrownUpAreaOnClose } = await import('../../navigation/grown-up-area-exit');
    const { useUiStore } = await import('../ui-store');
    type R = { name: string; params?: unknown };
    let stack: R[] = [{ name: 'Main' }, { name: 'ParentDashboard' }];
    const nav = {
      isReady: () => true,
      getCurrentRoute: () => stack[stack.length - 1],
      getRootState: () => ({ routes: stack }),
      navigate: (name: 'WhoIsUsing', params: unknown) => void (stack = [...stack, { name, params }]),
      dispatch: (action: { type: 'RESET'; payload: { routes: R[] } }) => void (stack = [...action.payload.routes]),
    };
    const listeners: ((visible: boolean) => void)[] = [];
    let now = 0;
    const subscribe = (l: (visible: boolean) => void) => (listeners.push(l), () => undefined);
    useUiStore.setState({ parentGateOpenedAt: 0, lastPinVerifiedAt: null });
    // App.tsx: the background rule in the mount effect, then (onReady) the area leave and the chooser resume.
    const closed = new Set<() => void>();
    // As closeGrownUpSession: the session ends, then the listeners (the area leave) hear it.
    const close = (): void => {
      useUiStore.setState({ parentGateOpenedAt: null });
      for (const c of [...closed]) c();
    };
    const offBackground = bindGrownUpBackgroundRule({ subscribe, now: () => now, close, sessionOpen: () => useUiStore.getState().parentGateOpenedAt !== null });
    const offLeave = leaveGrownUpAreaOnClose(nav, () => false, (l) => (closed.add(l), () => closed.delete(l)));
    const offResume = bindChooserResume(nav, { subscribe, now: () => now, flag: () => true });
    const emit = (visible: boolean) => {
      for (const l of listeners) l(visible);
    };
    emit(false);
    now += CHOOSER_RESUME_MS + 60_000;
    emit(true);
    expect(stack.map((r) => r.name)).toEqual(['Main', 'WhoIsUsing']);
    expect(stack[1]?.params).toEqual({ trigger: 'resume' });
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    offBackground();
    offLeave();
    offResume();
  });
});

describe('anyProfileLocked (who.shown anyLocked)', () => {
  it('false with no locks or no PIN, true with a lock, every profile while the locks are unreadable', async () => {
    expect(anyProfileLocked()).toBe(false);
    disk.set('profiles:locks', { v: 1, ids: ['profile:jun'] });
    await chooserLaunchTrigger();
    expect(anyProfileLocked()).toBe(true);
    useAccountStore.setState({ parentPinHash: null });
    expect(anyProfileLocked()).toBe(false);
    useAccountStore.setState({ parentPinHash: 'h' });
    disk.delete('profiles:locks');
    failRead.on = true;
    await chooserLaunchTrigger();
    expect(anyProfileLocked()).toBe(true);
  });
});

describe('persistLeaving', () => {
  it('ends and saves the open practice session; with none open it does nothing', () => {
    useProgressStore.getState().beginSession('profile:mina', { owner: 'quest', streak: true });
    expect(useProgressStore.getState().openSession).not.toBeNull();
    persistLeaving();
    expect(useProgressStore.getState().openSession).toBeNull();
    expect(() => persistLeaving()).not.toThrow();
  });
});
