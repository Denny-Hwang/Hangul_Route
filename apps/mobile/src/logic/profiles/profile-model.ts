import type { AvatarKind, Profile, ProfileRole } from '@hangul-route/content-schema';

/**
 * Pure profile CRUD + storage-key namespacing — F-PROF-001 §3.2, §3.3.
 *
 * The zustand store (`src/store/profile-store.ts`) is a thin persistence shell
 * over these reducers; all decisions live here so they are testable without a
 * store or AsyncStorage.
 */

export const NAME_MIN = 1;
export const NAME_MAX = 12;

export interface ProfileSet {
  profiles: Profile[];
  activeId: string | null;
}

export interface CreateProfileInput {
  displayName: string;
  ageGroup: Profile['ageGroup'];
  avatar: AvatarKind;
  role?: ProfileRole;
}

export interface Clock {
  now: () => number;
  /** Injected so ids are deterministic under test. */
  nextId: () => string;
}

export type NameError = 'too-short' | 'too-long' | 'non-latin';

/**
 * Learner names are free text but must stay renderable in an English UI
 * (§3.2): no emoji, no Korean/Chinese. Latin letters, digits, spaces,
 * apostrophes and hyphens only.
 */
export function validateDisplayName(raw: string): NameError | null {
  const name = raw.trim();
  if (name.length < NAME_MIN) return 'too-short';
  if (name.length > NAME_MAX) return 'too-long';
  if (!/^[A-Za-z0-9 '-]+$/.test(name)) return 'non-latin';
  return null;
}

export function makeProfileId(seed: string): string {
  return `profile:${seed}`;
}

export function createProfile(
  set: ProfileSet,
  input: CreateProfileInput,
  clock: Clock,
): { set: ProfileSet; created: Profile } {
  const nameError = validateDisplayName(input.displayName);
  if (nameError !== null) {
    throw new Error(`Invalid display name: ${nameError}`);
  }
  const iso = new Date(clock.now()).toISOString();
  const created: Profile = {
    id: makeProfileId(clock.nextId()),
    displayName: input.displayName.trim(),
    ageGroup: input.ageGroup,
    avatar: input.avatar,
    role: input.role ?? 'learner',
    createdAt: iso,
    lastActiveAt: iso,
  };
  return {
    set: { profiles: [...set.profiles, created], activeId: created.id },
    created,
  };
}

export function setActiveProfile(set: ProfileSet, id: string, now: number): ProfileSet {
  if (!set.profiles.some((p) => p.id === id)) return set;
  const iso = new Date(now).toISOString();
  return {
    profiles: set.profiles.map((p) => (p.id === id ? { ...p, lastActiveAt: iso } : p)),
    activeId: id,
  };
}

export function removeProfile(set: ProfileSet, id: string): ProfileSet {
  const profiles = set.profiles.filter((p) => p.id !== id);
  const activeId = set.activeId === id ? (profiles[0]?.id ?? null) : set.activeId;
  return { profiles, activeId };
}

export function renameProfile(set: ProfileSet, id: string, displayName: string): ProfileSet {
  const nameError = validateDisplayName(displayName);
  if (nameError !== null) {
    throw new Error(`Invalid display name: ${nameError}`);
  }
  return {
    ...set,
    profiles: set.profiles.map((p) =>
      p.id === id ? { ...p, displayName: displayName.trim() } : p,
    ),
  };
}

export function learners(set: ProfileSet): Profile[] {
  return set.profiles.filter((p) => p.role === 'learner');
}

export function parentProfile(set: ProfileSet): Profile | null {
  return set.profiles.find((p) => p.role === 'parent') ?? null;
}

export function activeProfile(set: ProfileSet): Profile | null {
  return set.profiles.find((p) => p.id === set.activeId) ?? null;
}

/**
 * Onboarding order is forced (§3.2): the parent profile is created first, and
 * a device is not set up until at least one learner exists.
 */
export type OnboardingStep = 'create-parent' | 'create-learner' | 'done';

export function nextOnboardingStep(set: ProfileSet): OnboardingStep {
  if (parentProfile(set) === null) return 'create-parent';
  if (learners(set).length === 0) return 'create-learner';
  return 'done';
}

// --- storage-key namespacing (§3.3 data isolation) --------------------------

export const PROFILE_KEY_PREFIX = 'p';

/**
 * Every per-learner write goes through this — Journey, Library history,
 * Companion state, ReviewAttempt, HomeworkAssignment. Two profiles can never
 * collide because the id is part of the key, not part of the value.
 */
export function scopedKey(profileId: string, key: string): string {
  if (!profileId) throw new Error('scopedKey requires a profileId (F-PROF-001 §3.3)');
  return `${PROFILE_KEY_PREFIX}/${profileId}/${key}`;
}

export function isScopedKey(key: string): boolean {
  return new RegExp(`^${PROFILE_KEY_PREFIX}/profile:[^/]+/.+`).test(key);
}

/** Parse a scoped key back into its parts; null when the key is unscoped. */
export function parseScopedKey(key: string): { profileId: string; key: string } | null {
  const m = key.match(new RegExp(`^${PROFILE_KEY_PREFIX}/(profile:[^/]+)/(.+)$`));
  return m ? { profileId: m[1] as string, key: m[2] as string } : null;
}

/** Keys belonging to a profile — used to wipe one profile without touching others. */
export function keysForProfile(allKeys: string[], profileId: string): string[] {
  return allKeys.filter((k) => parseScopedKey(k)?.profileId === profileId);
}
