import {
  CHOOSER_NAME_ORDER_FROM,
  CHOOSER_RESUME_MS,
  GROWN_UP_BACKGROUND_MS,
  type GrownUpUse,
  type ThemeKey,
  type UiLocale,
} from '@hangul-route/content-schema';
import { compareNames } from '@hangul-route/i18n';

/**
 * [OA] "Who is using this?", the device's one chooser (AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 6.1 to 6.4,
 * OA-D1, OA-D6, OA-D17, OA-D20, OA-D21; row OA-4a). Pure: every input is passed in (profiles, locks, the uses known
 * on the device, the device gate marker, the clock), so each rule is unit-tested. The screen
 * (`screens/who/WhoIsUsingScreen.tsx`) and the triggers (`store/who-chooser.ts`) only read and act on the answers.
 */

/** The device gate marker as a code (`logic/profiles/gate-events.ts` `markerCode`). */
export type WhoMarker = 'none' | 'pin' | 'nopin';

/** Why the chooser opened (section 6.2): the `trigger` of `who.shown` and of `profile.switch` with `via: 'chooser'`. */
export type WhoTrigger = 'launch' | 'return' | 'resume' | 'join' | 'manual';

/** A learner profile as the chooser reads it: its id, name, cub, and its place in creation order (the list order). */
export interface WhoProfile {
  id: string;
  displayName: string;
  avatar: string;
}

/**
 * Section 6.2 and OA-D6: a device is **shared** when it holds 2 or more learner profiles, any locked profile, or any
 * known grown-up use. A device whose marker is `none` (self-only, no PIN) with a single learner profile is not made
 * shared by a known use alone, so a lone adult learner who also teaches is not asked at every launch. A lock on an id
 * that is not a profile here (a stray id, section 13.2) counts for nothing. No profile is never shared.
 */
export function isSharedDevice(input: {
  profiles: readonly { id: string }[];
  locks: readonly string[];
  uses: readonly GrownUpUse[];
  marker: WhoMarker;
}): boolean {
  const { profiles, locks, uses, marker } = input;
  if (profiles.length === 0) return false;
  if (profiles.length >= 2) return true;
  const ids = new Set(profiles.map((p) => p.id));
  if (locks.some((id) => ids.has(id))) return true;
  if (uses.length === 0) return false;
  return marker !== 'none';
}

/**
 * The moments the chooser may open (section 6.2): the app start, the `who=1` boot intent (the console's Learner app
 * exit, `return`), a return from the background (`resume`) and a Switch someone pressed (`manual`).
 */
export type ChooserEvent = 'launch' | 'return' | 'resume' | 'manual';

/**
 * Whether the chooser opens, and with which trigger code, or `null` for not at all (section 6.2, OA-D6, OA-D20).
 *
 * - The flag off (`EXPO_PUBLIC_WHO_CHOOSER`, section 16): never; `who=1` is ignored too.
 * - No profile: never (Welcome and onboarding as today).
 * - `launch`: a shared device, or a locked active profile (CS-19). A join code held at boot on a shared device opens
 *   it as `join` (the caption **Pick who is joining.**); on an unshared device the join opens Join as today (`null`).
 * - `return` (`who=1`): with at least one profile. A join held at the same time wins (OA-D20): `join` on a shared
 *   device, else `null` so Join opens as today; the chooser is never shown twice.
 * - `resume`: a shared device back after `CHOOSER_RESUME_MS` (30 min) in the background, or a locked active profile
 *   back after `GROWN_UP_BACKGROUND_MS` (5 min). A clock that ran backwards counts no time (section 12).
 * - `manual`: always (Home Switch, the Profile row, Switch user).
 */
export function chooserTrigger(input: {
  event: ChooserEvent;
  shared: boolean;
  activeLocked: boolean;
  profiles: number;
  backgroundMs: number;
  joinHeld: boolean;
  flag: boolean;
}): WhoTrigger | null {
  const { event, shared, activeLocked, profiles, backgroundMs, joinHeld, flag } = input;
  if (!flag || profiles <= 0) return null;
  switch (event) {
    case 'launch':
      if (joinHeld) return shared ? 'join' : null;
      return shared || activeLocked ? 'launch' : null;
    case 'return':
      if (joinHeld) return shared ? 'join' : null;
      return 'return';
    case 'resume': {
      const away = Math.max(0, backgroundMs);
      if (shared && away >= CHOOSER_RESUME_MS) return 'resume';
      if (activeLocked && away >= GROWN_UP_BACKGROUND_MS) return 'resume';
      return null;
    }
    case 'manual':
      return 'manual';
  }
}

/**
 * OA-D17: tiles in creation order (the list order) up to 12 learner profiles, so a pre-reader finds their tile in the
 * same place; from `CHOOSER_NAME_ORDER_FROM` (13, a classroom device) by name in the UI language's collation, ties in
 * creation order. Never mutates its input.
 */
export function tileOrder<T extends { displayName: string }>(profiles: readonly T[], locale: UiLocale): T[] {
  if (profiles.length < CHOOSER_NAME_ORDER_FROM) return [...profiles];
  const compare = compareNames(locale);
  return profiles
    .map((profile, index) => ({ profile, index }))
    .sort((a, b) => compare(a.profile.displayName, b.profile.displayName) || a.index - b.index)
    .map(({ profile }) => profile);
}

/**
 * The five `colors.theme` tints in the order the design pass fixed (WhoTile spec, D1): orange then blue first (the
 * pair that stays apart for the common red-green colour-vision types), then green, purple and gold.
 */
export const TILE_TINTS: readonly ThemeKey[] = ['letters', 'crafts', 'nature', 'rites', 'life'];

/**
 * Section 6.1: when two or more profiles share a cub, each of them gets a tint, by creation order inside the group
 * that shares it, repeating after five (the name stays the tell). A cub nobody else has gets `null` (its plate stays
 * `surface.sunken`). A pure function of the avatars and the list order: it reads no progress, stage or rank (CS-6).
 */
export function tileTints(profiles: readonly { id: string; avatar: string }[]): Record<string, ThemeKey | null> {
  const groups = new Map<string, string[]>();
  for (const p of profiles) groups.set(p.avatar, [...(groups.get(p.avatar) ?? []), p.id]);
  const tints: Record<string, ThemeKey | null> = {};
  for (const ids of groups.values()) {
    ids.forEach((id, i) => {
      tints[id] = ids.length >= 2 ? TILE_TINTS[i % TILE_TINTS.length]! : null;
    });
  }
  return tints;
}

/** One grown-up row (GrownUpRow spec). Row OA-4a emits only the Grown-up area; the use rows come in OA-4b. */
export interface GrownUpRowView {
  use: 'area';
  /** The lock glyph and the PIN in the accessible name: false only on a self-only device without a PIN (`none`). */
  locked: boolean;
  /** Offline (web) disables every use row but the Grown-up area, which works offline (section 12). */
  disabled: boolean;
  /** `nopin`: **A grown-up sets a PIN here.** under the label (section 6.1). */
  caption: 'nopin' | null;
}

/** The Grown-ups section of the chooser: the pending 24-hour wait (OA-D21), then the rows. */
export interface GrownUpsView {
  /** While a Forgot PIN wait runs: when a new PIN can be set (epoch ms), shown with **Cancel the wait**. */
  pending: { readyAt: number } | null;
  rows: GrownUpRowView[];
}

/**
 * The Grown-ups section (sections 6.1, 12, OA-D21). This row emits the Grown-up area only (unlocked on `none`, with
 * the `nopin` caption on `nopin`) and the pending-reset line; `os`, `uses` and `online` decide the Family, Teacher,
 * School and Sign in rows of OA-4b and change nothing here yet. `resetPending` is the end of a running Forgot PIN
 * wait (epoch ms), or `null`.
 */
export function grownUpRows(input: {
  os: 'ios' | 'android' | 'web';
  uses: readonly GrownUpUse[];
  online: boolean;
  marker: WhoMarker;
  resetPending: number | null;
}): GrownUpsView {
  const { marker, resetPending } = input;
  return {
    pending: resetPending === null ? null : { readyAt: resetPending },
    rows: [{ use: 'area', locked: marker !== 'none', disabled: false, caption: marker === 'nopin' ? 'nopin' : null }],
  };
}

/** `who.shown`'s `learners` bucket (section 15). */
export function learnersBucket(count: number): '1' | '2' | '3-4' | '5-12' | '13+' {
  if (count <= 1) return '1';
  if (count === 2) return '2';
  if (count <= 4) return '3-4';
  if (count < CHOOSER_NAME_ORDER_FROM) return '5-12';
  return '13+';
}

/** `who.shown` (section 15): codes and buckets only, never a name, an id or a count of tries. */
export function whoShownEvent(input: { trigger: WhoTrigger; learners: number; grownUps: number; anyLocked: boolean; resetPending: boolean }): {
  name: 'who.shown';
  payload: { trigger: WhoTrigger; learners: ReturnType<typeof learnersBucket>; grownUps: number; anyLocked: boolean; resetPending: boolean };
} {
  return {
    name: 'who.shown',
    payload: {
      trigger: input.trigger,
      learners: learnersBucket(input.learners),
      grownUps: Math.min(4, Math.max(0, Math.trunc(input.grownUps))),
      anyLocked: input.anyLocked,
      resetPending: input.resetPending,
    },
  };
}

export type WhoPickKind = 'learner' | 'locked_learner' | 'grown_up' | 'add' | 'cancel_reset';
export type WhoPickUse = 'family' | 'teacher' | 'school' | 'area' | 'signin';

/** `who.picked` (section 15): what was picked, and for a grown-up row which use. */
export function whoPickedEvent(kind: WhoPickKind, use?: WhoPickUse): { name: 'who.picked'; payload: { kind: WhoPickKind; use?: WhoPickUse } } {
  return { name: 'who.picked', payload: kind === 'grown_up' && use !== undefined ? { kind, use } : { kind } };
}

/** Where a learner pick on the chooser lands (section 6.2, OA-D20). */
export type PickLanding = { kind: 'back' } | { kind: 'home' } | { kind: 'join'; code: string | null };

/**
 * Section 6.2: a held join code sends the picked learner to Join, prefilled. Picking the learner who was already
 * active, over a learner screen (a quest, a story, Home), closes the chooser and that screen continues where it was.
 * Anything else lands on Home: a new learner, the chooser at launch (nothing under it), or the chooser over a
 * grown-up page or a PIN screen, which a learner never returns to without the PIN (CS-1).
 */
export function pickLanding(input: { same: boolean; under: 'area' | 'gate' | 'learner' | null; join: { code: string | null } | null }): PickLanding {
  if (input.join !== null) return { kind: 'join', code: input.join.code };
  if (input.same && input.under === 'learner') return { kind: 'back' };
  return { kind: 'home' };
}
