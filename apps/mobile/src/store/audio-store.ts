import { DeviceAudioPrefsSchema, levelOrder } from '@hangul-route/content-schema';
import { create } from 'zustand';
import type { AudioCapability, KoVoiceStatus } from '../logic/audio/capability';
import type { FallbackReason } from '../logic/audio/prompt-state';
import type { LevelOrder } from '../logic/audio/rate';
import { readJson, writeJson } from '../platform/storage';
import { track } from '../platform/telemetry';
import { activeProfileSelector, useProfileStore } from './profile-store';

/**
 * The single source of audio state (F-AUDIO-004 AD7, §3.7): the persisted
 * mute (a device preference, key `device:audio`), the learner level that
 * drives speech speed, and the capability the platform engines report.
 *
 * Replaces `ui-store.soundOn` and the engines' own in-memory `muted`. The
 * platform files read this store; they subscribe to it to stop speech when
 * the sound is switched off, so the store does not import them.
 */
export const AUDIO_PREFS_KEY = 'device:audio';

export type MuteSource = 'profile' | 'fallback_panel';

interface State {
  muted: boolean;
  hydrated: boolean;
  levelOrder: LevelOrder;
  tts: KoVoiceStatus;
  /** Any bundled clip exists (A-6). */
  clips: boolean;
  unlocked: boolean;
  lastFailure: { reason: FallbackReason; at: number } | null;
}

interface Actions {
  hydrate: () => Promise<void>;
  setMuted: (muted: boolean, source: MuteSource) => void;
  setLevelOrder: (order: LevelOrder) => void;
  setCapability: (capability: AudioCapability) => void;
  reportFailure: (reason: FallbackReason) => void;
}

export const useAudioStore = create<State & Actions>((set, get) => ({
  muted: false,
  hydrated: false,
  levelOrder: null,
  tts: { state: 'unknown' },
  clips: false,
  unlocked: false,
  lastFailure: null,

  // A missing or corrupt value means sound on, which is what every learner had
  // before this key existed (the old switch was never saved). Never writes.
  hydrate: async () => {
    const parsed = DeviceAudioPrefsSchema.safeParse(await readJson<unknown>(AUDIO_PREFS_KEY));
    set({ muted: parsed.success ? parsed.data.muted : false, hydrated: true });
  },

  setMuted: (muted, source) => {
    if (get().muted === muted) return;
    set({ muted });
    // A storage failure must never reach a game.
    writeJson(AUDIO_PREFS_KEY, { muted }).catch(() => undefined);
    void track({ name: 'audio.mute_changed', payload: { muted, source } });
  },

  setLevelOrder: (order) => set({ levelOrder: order }),

  setCapability: (capability) => set({ tts: capability.tts, clips: capability.clips, unlocked: capability.unlocked }),

  reportFailure: (reason) => set({ lastFailure: { reason, at: Date.now() } }),
}));

/**
 * Keeps `levelOrder` in step with the active profile's level (§3.3), so game
 * code never passes a level. Returns the unsubscribe function.
 */
export function bindAudioLevelToProfiles(): () => void {
  const apply = (): void => {
    const profile = activeProfileSelector(useProfileStore.getState());
    useAudioStore.getState().setLevelOrder(profile === null ? null : levelOrder(profile.ageGroup));
  };
  apply();
  return useProfileStore.subscribe(apply);
}
