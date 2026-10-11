import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
const tracked = vi.hoisted(() => [] as Array<{ name: string; payload?: Record<string, unknown> }>);
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));
vi.mock('../../platform/telemetry', () => ({
  track: vi.fn(async (e: { name: string; payload?: Record<string, unknown> }) => {
    tracked.push(e);
    return true;
  }),
}));

import { writeJson } from '../../platform/storage';
import { AUDIO_PREFS_KEY, bindAudioLevelToProfiles, useAudioStore } from '../audio-store';
import { useProfileStore } from '../profile-store';

const initial = useAudioStore.getState();

beforeEach(() => {
  mem.clear();
  tracked.length = 0;
  vi.mocked(writeJson).mockClear();
  useAudioStore.setState({ ...initial, muted: false, hydrated: false, levelOrder: null, lastFailure: null, unlocked: false, clips: false, tts: { state: 'unknown' } });
});

describe('audio-store: device:audio (F-AUDIO-004 AD7, §3.7)', () => {
  it('uses the key device:audio', () => {
    expect(AUDIO_PREFS_KEY).toBe('device:audio');
  });

  it('hydrate reads a saved mute', async () => {
    mem.set('device:audio', { muted: true });
    await useAudioStore.getState().hydrate();
    expect(useAudioStore.getState()).toMatchObject({ muted: true, hydrated: true });
  });

  it('a missing value means sound on (every learner who updates from before this key existed)', async () => {
    await useAudioStore.getState().hydrate();
    expect(useAudioStore.getState()).toMatchObject({ muted: false, hydrated: true });
  });

  it('a corrupt value means sound on and is not overwritten by hydrate', async () => {
    for (const bad of ['yes', 7, { muted: 'true' }, [], { muted: null }]) {
      mem.set('device:audio', bad);
      useAudioStore.setState({ muted: true, hydrated: false });
      await useAudioStore.getState().hydrate();
      expect(useAudioStore.getState().muted, JSON.stringify(bad)).toBe(false);
    }
    expect(writeJson).not.toHaveBeenCalled();
    expect(mem.get('device:audio')).toEqual({ muted: null });
  });

  it('an object without the field means sound on; unknown extra fields are ignored', async () => {
    mem.set('device:audio', {});
    await useAudioStore.getState().hydrate();
    expect(useAudioStore.getState().muted).toBe(false);
    mem.set('device:audio', { muted: true, volume: 0.4 });
    await useAudioStore.getState().hydrate();
    expect(useAudioStore.getState().muted).toBe(true);
  });

  it('hydrate never writes, so an upgrade leaves every saved key as it was', async () => {
    mem.set('profiles', [{ id: 'profile:a' }]);
    mem.set('settings:profile:a', { romanizationMode: 'always' });
    mem.set('progress:profile:a', { cards: [] });
    const before = JSON.stringify([...mem.entries()]);
    await useAudioStore.getState().hydrate();
    expect(JSON.stringify([...mem.entries()])).toBe(before);
    expect(writeJson).not.toHaveBeenCalled();
  });

  it('setMuted persists, and a restart reads it back', async () => {
    useAudioStore.getState().setMuted(true, 'profile');
    expect(useAudioStore.getState().muted).toBe(true);
    expect(writeJson).toHaveBeenCalledWith('device:audio', { muted: true });
    // restart: a fresh store state reads the saved value
    useAudioStore.setState({ muted: false, hydrated: false });
    await useAudioStore.getState().hydrate();
    expect(useAudioStore.getState().muted).toBe(true);
  });

  it('a failing write never throws into a game', async () => {
    vi.mocked(writeJson).mockRejectedValueOnce(new Error('quota'));
    expect(() => useAudioStore.getState().setMuted(true, 'profile')).not.toThrow();
    await Promise.resolve();
    expect(useAudioStore.getState().muted).toBe(true);
  });

  it('setMuted tracks audio.mute_changed with its source, only on a change', () => {
    useAudioStore.getState().setMuted(true, 'profile');
    useAudioStore.getState().setMuted(true, 'profile');
    useAudioStore.getState().setMuted(false, 'fallback_panel');
    expect(tracked).toEqual([
      { name: 'audio.mute_changed', payload: { muted: true, source: 'profile' } },
      { name: 'audio.mute_changed', payload: { muted: false, source: 'fallback_panel' } },
    ]);
  });

  it('setLevelOrder, setCapability and reportFailure keep what the platform tells the store', () => {
    const s = useAudioStore.getState();
    s.setLevelOrder(2);
    expect(useAudioStore.getState().levelOrder).toBe(2);
    s.setCapability({ tts: { state: 'none', reason: 'no_korean_voice' }, clips: false, unlocked: true });
    expect(useAudioStore.getState()).toMatchObject({ tts: { state: 'none', reason: 'no_korean_voice' }, clips: false, unlocked: true });
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    s.reportFailure('no_voice');
    expect(useAudioStore.getState().lastFailure).toEqual({ reason: 'no_voice', at: 1234 });
    vi.restoreAllMocks();
  });
});

describe('bindAudioLevelToProfiles (§3.3: the level reaches the player without game code)', () => {
  beforeEach(() => {
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: false });
  });

  const profile = (id: string, ageGroup: '5-7' | '8-9' | '10-11') => ({ id, displayName: id, ageGroup, avatar: 'hoya-orange' as const, role: 'learner' as const, createdAt: 't' });

  it('follows the active profile level and clears when there is none', () => {
    const off = bindAudioLevelToProfiles();
    expect(useAudioStore.getState().levelOrder).toBeNull();
    useProfileStore.setState({ profiles: [profile('profile:a', '5-7'), profile('profile:b', '10-11')], activeId: 'profile:a' });
    expect(useAudioStore.getState().levelOrder).toBe(0);
    useProfileStore.setState({ activeId: 'profile:b' });
    expect(useAudioStore.getState().levelOrder).toBe(2);
    useProfileStore.setState({ profiles: [], activeId: null });
    expect(useAudioStore.getState().levelOrder).toBeNull();
    off();
    useProfileStore.setState({ profiles: [profile('profile:a', '5-7')], activeId: 'profile:a' });
    expect(useAudioStore.getState().levelOrder).toBeNull();
  });

  it('applies the level that is already active when it binds', () => {
    useProfileStore.setState({ profiles: [profile('profile:a', '8-9')], activeId: 'profile:a' });
    const off = bindAudioLevelToProfiles();
    expect(useAudioStore.getState().levelOrder).toBe(1);
    off();
  });
});
