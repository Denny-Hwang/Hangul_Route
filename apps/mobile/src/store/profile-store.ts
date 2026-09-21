import type { AvatarKind, Profile } from '@hangul-route/content-schema';
import { create } from 'zustand';
import {
  activeProfile,
  createProfile as createProfileReducer,
  removeProfile as removeProfileReducer,
  setActiveProfile,
  type Clock,
  type CreateProfileInput,
  type ProfileSet,
} from '../logic/profiles/profile-model';
import { readJson, writeJson } from '../platform/storage';

/**
 * Persistence shell over the pure reducers in `logic/profiles/profile-model`
 * (F-PROF-001). Decisions — validation, id shape, active-profile handling —
 * live in the logic layer; this module only holds and persists the result.
 */

const KEY = 'profiles';
const ACTIVE_KEY = 'profiles:active';

interface State extends ProfileSet {
  hydrated: boolean;
}

interface Actions {
  hydrate: () => Promise<void>;
  createProfile: (input: {
    displayName: string;
    ageGroup: Profile['ageGroup'];
    avatar: AvatarKind;
    role?: CreateProfileInput['role'];
  }) => Profile;
  setActive: (id: string) => void;
  remove: (id: string) => void;
  setParentPin: (pinHash: string) => void;
  /** Restore paths add a profile that already exists elsewhere (keeps its id). */
  adoptProfile: (profile: Profile) => void;
}

function persist(set: ProfileSet): void {
  void writeJson(KEY, set.profiles);
  void writeJson(ACTIVE_KEY, set.activeId);
}

const clock: Clock = {
  now: () => Date.now(),
  nextId: () => Math.random().toString(36).slice(2, 10),
};

export const useProfileStore = create<State & Actions>((set, get) => ({
  profiles: [],
  activeId: null,
  hydrated: false,

  hydrate: async () => {
    const profiles = (await readJson<Profile[]>(KEY)) ?? [];
    const activeId = await readJson<string | null>(ACTIVE_KEY);
    set({ profiles, activeId: activeId ?? null, hydrated: true });
  },

  createProfile: (input) => {
    const { profiles, activeId } = get();
    const result = createProfileReducer({ profiles, activeId }, input, clock);
    set(result.set);
    persist(result.set);
    return result.created;
  },

  setActive: (id) => {
    const { profiles, activeId } = get();
    const next = setActiveProfile({ profiles, activeId }, id, Date.now());
    set(next);
    persist(next);
  },

  remove: (id) => {
    const { profiles, activeId } = get();
    const next = removeProfileReducer({ profiles, activeId }, id);
    set(next);
    persist(next);
  },

  adoptProfile: (profile) => {
    const { profiles, activeId } = get();
    if (profiles.some((p) => p.id === profile.id)) return;
    const next = { profiles: [...profiles, profile], activeId: activeId ?? profile.id };
    set(next);
    persist(next);
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
