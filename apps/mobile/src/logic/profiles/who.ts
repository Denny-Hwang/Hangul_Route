import {
  APP_ROUTES,
  CHOOSER_NAME_ORDER_FROM,
  CHOOSER_RESUME_MS,
  GROWN_UP_BACKGROUND_MS,
  SCHOOL_FOCUS_QUERY,
  type GrownUpUse,
  type GuestRecord,
  type ThemeKey,
  type UiLocale,
} from '@hangul-route/content-schema';
import { compareNames } from '@hangul-route/i18n';
import { gateProfiles } from '../guest/guest-model';
import type { GrownUpHandoffRequest } from '../shell/handoff-rules';

/**
 * [OA] "Who is using this?", the device's one chooser (AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 6.1 to 6.4,
 * OA-D1, OA-D6, OA-D17, OA-D20, OA-D21; row OA-4a). Pure: every input is passed in (profiles, locks, the uses known
 * on the device, the device gate marker, the clock), so each rule is unit-tested. The screen
 * (`screens/who/WhoIsUsingScreen.tsx`) and the triggers (`store/who-chooser.ts`) only read and act on the answers.
 */

/** The device gate marker as a code (`logic/profiles/gate-events.ts` `markerCode`). */
export type WhoMarker = 'none' | 'pin' | 'nopin';

/**
 * Why the chooser opened (section 6.2): the `trigger` of `who.shown` and of `profile.switch` with `via: 'chooser'`.
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 6.1 (row GU-5): `try`, the site's Start learning (`?try=1`) on a device
 * with learner profiles.
 */
export type WhoTrigger = 'launch' | 'return' | 'resume' | 'join' | 'manual' | 'try';

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
 * [GU] GU-D14, AMENDMENTS-GUEST-FIRST-LESSON section 9.2 (row GU-2): a live guest (`guest`, a record whose id is not a
 * profile here) counts as one more learner profile, so one profile and a live guest is shared. A guest alone is no
 * profile: the device is not shared.
 */
export function isSharedDevice(input: {
  profiles: readonly { id: string }[];
  locks: readonly string[];
  uses: readonly GrownUpUse[];
  marker: WhoMarker;
  guest?: GuestRecord | null;
}): boolean {
  const { locks, uses, marker } = input;
  if (input.profiles.length === 0) return false;
  const profiles = gateProfiles(input.profiles, input.guest);
  if (profiles.length >= 2) return true;
  const ids = new Set(profiles.map((p) => p.id));
  if (locks.some((id) => ids.has(id))) return true;
  if (uses.length === 0) return false;
  return marker !== 'none';
}

/**
 * The moments the chooser may open (section 6.2): the app start, the `who=1` boot intent (the console's Learner app
 * exit, `return`), a return from the background (`resume`) and a Switch someone pressed (`manual`).
 * [GU] Row GU-5: `try`, the app start with the `try=1` boot intent while the guest switch is on.
 */
export type ChooserEvent = 'launch' | 'return' | 'resume' | 'manual' | 'try';

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
 * - [GU] `try` (AMENDMENTS-GUEST-FIRST-LESSON section 6.1, GU-D7, CS-G4, OQ-G9): with at least one profile, shared or
 *   not, and whether or not the active profile is locked, the chooser opens with the trigger `try` (where **Try the
 *   first quest** shows); it never selects, creates or opens a profile. A held join wins (OA-D20): `join` on a shared
 *   device, else `null` so Join opens as today. With the flag off the intent is ignored like every other.
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
    case 'try':
      if (joinHeld) return shared ? 'join' : null;
      return 'try';
  }
}

/** [GU] Section 9.1: the one guest tile the chooser may draw after Add a learner. */
export type GuestTile = 'guest' | 'try';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON section 9.1 (row GU-5, CS-G4, CS-G5, OQ-G8): at most one guest tile, and only
 * with the guest switch on (`guestOn`). A live guest on the device shows its own tile (`guest`: resume the run). With
 * no live guest, **Try the first quest** (`try`) shows only on a chooser the site opened: the `try` trigger, or the
 * `return` trigger together with `try=1` (`tried`). A held class code (`joining`, or the `join` trigger) shows none:
 * joining needs a profile. Launch, resume and Switch without a live guest show none.
 */
export function guestTile(input: { guestOn: boolean; liveGuest: boolean; trigger: WhoTrigger; tried: boolean; joining: boolean }): GuestTile | null {
  const { guestOn, liveGuest, trigger, tried, joining } = input;
  if (!guestOn || joining || trigger === 'join') return null;
  if (liveGuest) return 'guest';
  return trigger === 'try' || (trigger === 'return' && tried) ? 'try' : null;
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

/**
 * A grown-up row on the chooser (GrownUpRow spec): a use of the signed-in account known on this device (web), the
 * **Sign in as a grown-up** row (web, no use known), or the device's own Grown-up area. F-AUTH-004 section 7.1 (row
 * NS-4, iOS and Android only): `account`, the **Grown-up account** row of a native uses record that holds no use.
 */
export type GrownUpRowUse = GrownUpUse | 'signin' | 'account' | 'area';

/** One grown-up row (GrownUpRow spec, rows OA-4a and OA-4b). */
export interface GrownUpRowView {
  use: GrownUpRowUse;
  /** The lock glyph and the PIN in the accessible name: false only on a self-only device without a PIN (`none`). */
  locked: boolean;
  /** Offline (web) disables every use row but the Grown-up area, which works offline (section 12). */
  disabled: boolean;
  /**
   * The line under the label: `nopin` (**A grown-up sets a PIN here.**, the Grown-up area on a `nopin` device) or
   * `offline` (**Needs the internet**, a disabled use row). F-AUTH-004 ND-7 (row NS-4, native): `needs_pin` (**Set a
   * grown-up PIN first.**, an account row on a `nopin` device, which opens PIN setup).
   */
  caption: 'nopin' | 'offline' | 'needs_pin' | null;
}

/**
 * F-AUTH-004 sections 7.1 and 12 (row NS-4): what the native chooser adds to the rows on iOS and Android. `nativeAccount`
 * is `nativeAccountEnabled` (the build switch and a key this build accepts); `record` the uses of the native uses
 * record `hr:grownup:deviceUses` (an empty list for a record that holds no use), or `null` with no record (absent,
 * stale, unreadable or not parsing).
 */
export interface NativeAccountRowsInput {
  nativeAccount: boolean;
  record: readonly GrownUpUse[] | null;
}

/** The Grown-ups section of the chooser: the pending 24-hour wait (OA-D21), then the rows. */
export interface GrownUpsView {
  /** While a Forgot PIN wait runs: when a new PIN can be set (epoch ms), shown with **Cancel the wait**. */
  pending: { readyAt: number } | null;
  rows: GrownUpRowView[];
}

/** The fixed order of the use rows (section 5.2): family, teacher, school. */
const USE_ORDER: readonly GrownUpUse[] = ['family', 'teacher', 'school'];

/**
 * The Grown-ups section (sections 6.1, 12, OA-D11, OA-D21). On the web: the known uses (`deviceUses`, section 7.1) in
 * the order family, teacher, school, or **Sign in as a grown-up** in their place when none is known; then the Grown-up
 * area. Native shows only the Grown-up area (no sign-in in the native app until F-AUTH-004). Offline, every row but
 * the Grown-up area is disabled with **Needs the internet** (grown-up pages are online-only); the Grown-up area works
 * offline. A self-only device without a PIN (`none`) shows no lock glyph. `resetPending` is the end of a running
 * Forgot PIN wait (epoch ms), or `null`. The rows carry codes only: never an account name or email (CS-7).
 */
export function grownUpRows(input: {
  os: 'ios' | 'android' | 'web';
  uses: readonly GrownUpUse[];
  online: boolean;
  marker: WhoMarker;
  resetPending: number | null;
  /** F-AUTH-004 (row NS-4): the native account's inputs, iOS and Android only (`nativeGrownUpRows`). */
  native?: NativeAccountRowsInput;
}): GrownUpsView {
  // F-AUTH-004 section 7.1 (row NS-4): babel-preset-expo inlines EXPO_OS, so the web build folds this branch away and
  // drops `nativeGrownUpRows` with it: the web's rows and its start bundle are unchanged.
  if ((process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android') && input.os !== 'web' && input.native !== undefined) return nativeGrownUpRows(input, input.native);
  const { os, uses, online, marker, resetPending } = input;
  const locked = marker !== 'none';
  const known = USE_ORDER.filter((use) => uses.includes(use));
  const accountRows: (GrownUpUse | 'signin')[] = os !== 'web' ? [] : known.length > 0 ? known : ['signin'];
  return {
    pending: resetPending === null ? null : { readyAt: resetPending },
    rows: [
      ...accountRows.map((use): GrownUpRowView => ({ use, locked, disabled: !online, caption: online ? null : 'offline' })),
      { use: 'area', locked, disabled: false, caption: marker === 'nopin' ? 'nopin' : null },
    ],
  };
}

/**
 * F-AUTH-004 sections 7.1, 12 and ND-7, ND-9 (row NS-4; design `entries.md` boards 1 to 7, D3): the Grown-ups rows of a
 * native build. With `nativeAccount` false, the Grown-up area only, exactly as at the basis (CS-N13). With it on:
 *
 * | Device                | Account rows (then the Grown-up area)                                               |
 * | `pin`, record of uses | the known uses in the order family, teacher, school                                 |
 * | `pin`, empty record   | **Grown-up account** (`account`)                                                    |
 * | `pin`, no record      | **Sign in as a grown-up**                                                           |
 * | `nopin`               | **Sign in as a grown-up**, captioned **Set a grown-up PIN first.** (it opens setup) |
 * | `none` (`open`)       | **Sign in as a grown-up**, no lock glyph (no session is kept there, ND-9)           |
 *
 * The uses record exists only on a PIN device (ND-9), so on `nopin` and `none` it is never read. Offline every account
 * row is disabled with **Needs the internet**, which wins over the `nopin` caption (D3); the Grown-up area row stays
 * enabled and keeps its own `nopin` caption. Codes only: never a name or an email (CS-7, CS-N9).
 */
function nativeGrownUpRows(input: { uses: readonly GrownUpUse[]; online: boolean; marker: WhoMarker; resetPending: number | null }, native: NativeAccountRowsInput): GrownUpsView {
  const { online, marker, resetPending } = input;
  const locked = marker !== 'none';
  let accountRows: (GrownUpUse | 'signin' | 'account')[] = [];
  if (native.nativeAccount) {
    const known = marker === 'pin' && native.record !== null ? USE_ORDER.filter((use) => native.record!.includes(use)) : null;
    accountRows = known === null ? ['signin'] : known.length > 0 ? known : ['account'];
  }
  const accountCaption: GrownUpRowView['caption'] = !online ? 'offline' : marker === 'nopin' ? 'needs_pin' : null;
  return {
    pending: resetPending === null ? null : { readyAt: resetPending },
    rows: [
      ...accountRows.map((use): GrownUpRowView => ({ use, locked, disabled: !online, caption: accountCaption })),
      { use: 'area', locked, disabled: false, caption: marker === 'nopin' ? 'nopin' : null },
    ],
  };
}

/**
 * Section 5.3: the grown-up page a use row opens once the PIN is through (`openGrownUpArea({ via: 'chooser', target
 * })`). Family opens the family home; Teacher the teacher home through the `/teach` router with the teacher hint (the
 * router alone follows the last persona, which could be Family on an account that holds both); School the teacher
 * home at its School group (`focus=school`). Sign in as a grown-up has no target: the hand-off opens the sign-in
 * router. No target carries an id (no PII in URLs); each passes `safeNextPath`.
 */
export function grownUpTarget(use: GrownUpUse | 'signin'): string | undefined {
  switch (use) {
    case 'family':
      return APP_ROUTES.parentHome;
    case 'teacher':
      return `${APP_ROUTES.teacherIndex}?persona=teacher`;
    case 'school':
      return `${APP_ROUTES.teacherIndex}?${SCHOOL_FOCUS_QUERY}`;
    case 'signin':
      return undefined;
  }
}

/** The `learner.who.use` key of a use row's label (and of its PIN screen's title). */
export function rowLabelKey(use: GrownUpUse | 'signin'): GrownUpUse | 'signIn' {
  return use === 'signin' ? 'signIn' : use;
}

/**
 * Section 5.3: the hand-off a use row asks for after its PIN (or directly on a `none` device):
 * `openGrownUpArea({ via: 'chooser', target })`, the target from `grownUpTarget` (none for Sign in: the router).
 */
export function chooserHandoff(use: GrownUpUse | 'signin'): GrownUpHandoffRequest {
  const target = grownUpTarget(use);
  return target === undefined ? { via: 'chooser' } : { via: 'chooser', target };
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

/** [GU] Row GU-5, section 12: `try` (Try the first quest) and `guest` (the guest's own tile). */
export type WhoPickKind = 'learner' | 'locked_learner' | 'grown_up' | 'add' | 'cancel_reset' | 'try' | 'guest';
/** F-AUTH-004 section 7.1 (row NS-4): `account`, the native **Grown-up account** row (NS-1 appended it to the payload rules). */
export type WhoPickUse = 'family' | 'teacher' | 'school' | 'area' | 'signin' | 'account';

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
