import type { AvatarKind, Profile } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { readJson, writeJson } from '../platform/storage';

const KEY = 'profiles';
const ACTIVE_KEY = 'profiles:active';

interface State {
  profiles: Profile[];
  activeId: string | null;
  hydrated: boolean;
}

interface Actions {
  hydrate: () => Promise<void>;
  createProfile: (input: { displayName: string; ageGroup: Profile['ageGroup']; avatar: AvatarKind }) => Profile;
  setActive: (id: string) => void;
  remove: (id: string) => void;
  setParentPin: (pinHash: string) => void;
}

function persist(state: Pick<State, 'profiles' | 'activeId'>): void {
  void writeJson(KEY, state.profiles);
  void writeJson(ACTIVE_KEY, state.activeId);
}

function id(): string {
  return `profile:${Math.random().toString(36).slice(2, 10)}`;
}

export const useProfileStore = create<State & Actions>((set, get) => ({
  profiles: [],
  activeId: null,
  hydrated: false,

  hydrate: async () => {
    const profiles = (await readJson<Profile[]>(KEY)) ?? [];
    const activeId = await readJson<string | null>(ACTIVE_KEY);
    set({ profiles, activeId: activeId ?? null, hydrated: true });
  },

  createProfile: ({ displayName, ageGroup, avatar }) => {
    const now = new Date().toISOString();
    const next: Profile = {
      id: id() as Profile['id'],
      displayName,
      ageGroup,
      avatar,
      createdAt: now,
      lastActiveAt: now,
    };
    const profiles = [...get().profiles, next];
    set({ profiles, activeId: next.id });
    persist({ profiles, activeId: next.id });
    return next;
  },

  setActive: (newId) => {
    const profiles = get().profiles.map((p) =>
      p.id === newId ? { ...p, lastActiveAt: new Date().toISOString() } : p,
    );
    set({ profiles, activeId: newId });
    persist({ profiles, activeId: newId });
  },

  remove: (delId) => {
    const profiles = get().profiles.filter((p) => p.id !== delId);
    const activeId = get().activeId === delId ? (profiles[0]?.id ?? null) : get().activeId;
    set({ profiles, activeId });
    persist({ profiles, activeId });
  },

  setParentPin: (pinHash) => {
    const profiles = get().profiles.map((p) => ({ ...p, parentPinHash: pinHash }));
    set({ profiles });
    persist({ profiles, activeId: get().activeId });
  },
}));

export function activeProfileSelector(state: State): Profile | null {
  return state.profiles.find((p) => p.id === state.activeId) ?? null;
}
