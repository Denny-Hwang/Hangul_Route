import type { AvatarKind, LearnerType, Profile } from '@hangul-route/content-schema';
import { create } from 'zustand';
import {
  activeProfile,
  createProfile as createProfileReducer,
  removeProfile as removeProfileReducer,
  setActiveProfile,
  updateProfile as updateProfileReducer,
  type Clock,
  type CreateProfileInput,
  type ProfilePatch,
  type ProfileSet,
} from '../logic/profiles/profile-model';
import { closesSession } from '../logic/profiles/session';
import { changedServerFields, hasFields, serverProfileChanges, type ServerLearnerFields } from '../logic/sync/learner-profile';
import { readJson, writeJson } from '../platform/storage';
import { closeGrownUpSession } from './grown-up-session';
import { notifyProfileEdited } from './profile-edits';
import { notifyProfileRemoved } from './profile-removal';

/**
 * Persistence shell over the pure reducers in `logic/profiles/profile-model`
 * (F-PROF-001). Decisions — validation, id shape, active-profile handling —
 * live in the logic layer; this module only holds and persists the result.
 */

/** The profile list (`hr:profiles`); the device gate marker writer reads it raw to confirm a `none` marker. */
export const PROFILES_KEY = 'profiles';
const ACTIVE_KEY = 'profiles:active';

interface State extends ProfileSet {
  hydrated: boolean;
  /**
   * [OA] When the active learner's session on this device began (epoch ms, in memory only): the app start, then
   * every change of learner. `profile.switch` buckets the minutes since (`minutesIn`, G1).
   */
  activeSince: number;
}

interface Actions {
  hydrate: () => Promise<void>;
  createProfile: (input: {
    displayName: string;
    ageGroup: Profile['ageGroup'];
    avatar: AvatarKind;
    role?: CreateProfileInput['role'];
    learnerType?: LearnerType;
  }) => Profile;
  /**
   * Changes name, level, avatar or who-is-learning; throws on an invalid value, ignores an unknown id. A change to a
   * learner's name, level or avatar is announced (`profile-edits`) so the sync store sends it to the server.
   */
  updateProfile: (id: string, patch: ProfilePatch) => void;
  /**
   * Takes the server's name, level and avatar for a learner (inbox pull, restore). Only values that differ and pass
   * the local rules apply; nothing is announced, so the change is never sent back. Returns whether anything changed.
   */
  applyServerProfile: (id: string, server: ServerLearnerFields) => boolean;
  setActive: (id: string) => void;
  remove: (id: string) => void;
  setParentPin: (pinHash: string) => void;
  /** Restore paths add a profile that already exists elsewhere (keeps its id). */
  adoptProfile: (profile: Profile) => void;
}

function persist(set: ProfileSet): void {
  void writeJson(PROFILES_KEY, set.profiles);
  void writeJson(ACTIVE_KEY, set.activeId);
}

/**
 * [OA] OA-D5b (1), CS-15: every write of a new profile set goes through here. When the active learner changes (a
 * Profile tile, a new learner made active, the active learner removed, a restored learner adopted, any later writer),
 * the session clock restarts and the grown-up session ends, from any surface.
 */
function commitSet(
  set: (partial: Partial<State>) => void,
  prevActiveId: string | null,
  next: ProfileSet,
  now: number = Date.now(),
): void {
  const changed = closesSession(prevActiveId, next.activeId);
  set(changed ? { ...next, activeSince: now } : next);
  persist(next);
  if (changed) closeGrownUpSession();
}

const clock: Clock = {
  now: () => Date.now(),
  nextId: () => Math.random().toString(36).slice(2, 10),
};

export const useProfileStore = create<State & Actions>((set, get) => ({
  profiles: [],
  activeId: null,
  hydrated: false,
  activeSince: Date.now(),

  hydrate: async () => {
    const profiles = (await readJson<Profile[]>(PROFILES_KEY)) ?? [];
    const activeId = await readJson<string | null>(ACTIVE_KEY);
    set({ profiles, activeId: activeId ?? null, hydrated: true, activeSince: Date.now() });
  },

  createProfile: (input) => {
    const { profiles, activeId } = get();
    const result = createProfileReducer({ profiles, activeId }, input, clock);
    commitSet(set, activeId, result.set);
    return result.created;
  },

  updateProfile: (id, patch) => {
    const { profiles, activeId } = get();
    const next = updateProfileReducer({ profiles, activeId }, id, patch);
    if (next.profiles === profiles) return;
    set(next);
    persist(next);
    const before = profiles.find((p) => p.id === id);
    const after = next.profiles.find((p) => p.id === id);
    if (!before || !after || after.role !== 'learner') return;
    // Only what the server keeps (never who-is-learning, the PIN or consent, F-LEARN-001 L2).
    const changed = changedServerFields(before, after);
    if (hasFields(changed)) notifyProfileEdited(id, changed);
  },

  applyServerProfile: (id, server) => {
    const { profiles, activeId } = get();
    const current = profiles.find((p) => p.id === id);
    if (!current) return false;
    const changes = serverProfileChanges(current, server);
    if (!hasFields(changes)) return false;
    const next = { profiles: profiles.map((p) => (p.id === id ? { ...p, ...changes } : p)), activeId };
    set(next);
    persist(next);
    return true;
  },

  setActive: (id) => {
    const { profiles, activeId } = get();
    const now = Date.now();
    // [OA] OA-D5b (1): every change of learner, from any surface, ends the grown-up session (always on, CS-15).
    commitSet(set, activeId, setActiveProfile({ profiles, activeId }, id, now), now);
  },

  remove: (id) => {
    const { profiles, activeId } = get();
    commitSet(set, activeId, removeProfileReducer({ profiles, activeId }, id));
    notifyProfileRemoved(id);
  },

  adoptProfile: (profile) => {
    const { profiles, activeId } = get();
    if (profiles.some((p) => p.id === profile.id)) return;
    commitSet(set, activeId, { profiles: [...profiles, profile], activeId: activeId ?? profile.id });
  },

  setParentPin: (pinHash) => {
    const profiles = get().profiles.map((p) => ({ ...p, parentPinHash: pinHash }));
    const next = { profiles, activeId: get().activeId };
    set(next);
    persist(next);
  },
}));

export function activeProfileSelector(state: State): Profile | null {
  return activeProfile(state);
}
