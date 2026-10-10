Status: ready

# F-LEARN-001 — All-ages onboarding and profile: who is learning, reading level, consent, grown-up PIN, avatar variants

**Scope**: `packages/content-schema` (level table, `learnerType`, telemetry names) · `packages/design-system` (Hoya fur variants, tokens) · `apps/mobile` (`CreateProfileScreen`, consent and PIN logic, `PinEntryScreen` + new `PinResetScreen`, profile switcher, grown-up dashboard, copy) · `apps/web` (console roster, parent demo pages, privacy and terms text) · `packages/backend` (types only, no behaviour change) · **no D1 migration**
**Owner**: solo dev
**Rollout**: audience update of 2026-10-09 (CLAUDE.md §1). PR order in §7.
**Wireframe**: `design/wireframes/onboarding/all-ages-onboarding.md` (drafted in one file: `wireframes/all-ages-onboarding.md`; copy it there with the first PR)

Parent / siblings: F-PROF-001 (device profiles, PIN §3.5, avatars §3.2) · F-SYNC-001 (`LearnerRegister` contract) · F-SPACE-001 (roster) · F-RESTORE-001 (Rescue Code, used by Forgot PIN) · F-I18N-001 (locale catalogs; this spec's new strings live in one module so they can move) · F-PLC-001 (placement: first reader of the level) · F-LAYOUT-001 (safe-area and small-phone layout; PIN keypad sizing) · audit findings UF-05/06/07/08/09, DATA-01/02, UX-06/07/08/27/33 · **PR #95** (merged: Profile entry label "Profile", scrollable safe-area `Screen`, responsive PIN pad — referenced, not respecified here, see §3.7 and §3.4)

---

## 1. Context

The product is for anyone learning Hangul, at any age (CLAUDE.md §1, D1). First-run onboarding still asks a child's question.

What exists today (verified in the working tree on 2026-10-10):

- `CreateProfileScreen.tsx` asks **"How old are you?"** and offers only `5–7`, `8–9`, `10–11` (`:30-36`, heading `:117`, a11y label `Age group …` `:127`), defaulting to `5-7` (`:48`). It subtitles the form "A grown-up can help with this." (`:86`).
- On a fresh install the grown-up card is mandatory: `needsConsent = firstRun && !consentAcceptedAt` (`:45`), `valid` requires the checkbox (`:57`), and the only wording is "I'm a parent or guardian and I agree to the Privacy Policy." (`:234`, `:252`). An adult learning alone cannot finish sign-up without a false statement. The policy is not linked (`:251-253`) and a disabled Continue gives no reason (`:272-279`, audit UX-27).
- The card collects **no PIN**. `PinEntryScreen` decides its mode with `storedHash ? 'verify' : 'setup-1'` (`:61`), so whoever first taps a grown-up action (Grown-up zone, Add a profile, Unlock the journey, Save my progress, Restore: `ProfileScreen.tsx:58-74`) sets the PIN, usually the child. There is no "Forgot PIN" anywhere in `apps/mobile/src`; F-PROF-001 §3.5 says reset means reinstall and wipe (audit UX-08).
- "Pick a Hoya" renders the same `<Hoya pose="idle" size={64}/>` for all five avatars (`:162-181`); `HoyaProps` has no variant (`packages/design-system/src/components/Hoya/types.ts:3-8`); the choice is stored in `profile.avatar` but the cub that is drawn is always the gold one: the switcher draws `<Hoya pose=… size={72}/>` regardless of `p.avatar` (`ProfileScreen.tsx:113`), and since PR #95 the Home entry only rings the same gold cub in `colors.theme[avatarTheme(profile.avatar)]` (`HomeScreen.tsx:171,178`). The avatar buttons also lack a selected state (`:165-169`).
- `ageGroup` is shown as "Age {ageGroup}" in the profile switcher (`ProfileScreen.tsx:116`), the grown-up dashboard (`ParentDashboardScreen.tsx:57`), the teacher console roster (`apps/web/src/app/teach/space/page.tsx:151`) and the mock family pages (`apps/web/src/app/parent/page.tsx:86`, `parent/[childId]/page.tsx:26`); design-preview samples say "Age 5-7" (`design-preview/page.tsx:889`, `design-preview/components/page.tsx:372`) and "child (ages 5–7 primary)" (`design-preview/page.tsx:493`).
- **Nothing branches on `ageGroup`.** A grep of non-test source finds only pass-through (`profile-model.ts:21,64`, `profile-store.ts:31`, `sync-store.ts:58,122,228`, `platform/sync-api.ts:37,67,112,164,220`, `packages/backend/src/routes/sync.ts:30`, `routes/spaces.ts:378`, `lib/learners.ts:4-5`, `db/d1.ts:29,126-127`), storage and display. The value is declared as the literal union `'5-7' | '8-9' | '10-11'` by hand in more than ten places (`packages/content-schema/src/schemas/profile.ts:28`, `schemas/sync.ts:55`, `packages/backend/src/store.ts:19,57`, `apps/mobile/src/platform/sync-api.ts`, `store/sync-store.ts:58`, `apps/web/src/lib/console/api.ts:28`, `apps/web/src/data/mock-family.ts:9`) and enforced by `CHECK (age_group IN ('5-7','8-9','10-11'))` in `apps/api/migrations/0001_schema_v1.sql:18` and `0002_schema_v2.sql:11`.
- Consent is one device-level timestamp, `account:consentAcceptedAt` (`store/account-store.ts:13,69-73`); the parent email is stored locally in `account:parentEmail` (`:12,63-67`). A grep of `apps/mobile/src` finds no network use of the email (only `account-store.ts` and `CreateProfileScreen.tsx` reference it).
- Profiles are persisted without schema parsing: `profile-store.hydrate` does `readJson<Profile[]>(KEY)` (`store/profile-store.ts:57-61`), so an added optional field needs no storage migration. Backup files do parse: `BackupFileSchema.profile = ProfileSchema` (`schemas/sync.ts:79-85`), a non-strict `z.object`, so an extra optional key neither breaks old files nor old readers.
- Copy that assumes a child reader: see the table in §3.9 (re-verified against the tree). `apps/web/src/app/privacy/page.tsx:17-23,47` and `terms/page.tsx:17,23` were already reworded for the mixed audience; `privacy/page.tsx:29` still lists the three age bands.
- **PR #95 is merged** (`332e199`): it added `avatarTheme(kind)` (`logic/profiles/avatar-catalog.ts:39-46`), the visible **"Profile"** caption and the accessible name "Profile and settings" on the Home entry (`HomeScreen.tsx:155-183`; the old unlabelled 64 px circle is gone), a scrollable safe-area `Screen`, and a responsive PIN pad (`logic/profiles/pin-pad-layout.ts`, used by `PinEntryScreen.tsx:25,71-83`). **Problem for this spec**: `AVATAR_PRESETS` maps `hoya-blue` to theme `life` (gold), `hoya-green` to `rites` (purple), `hoya-purple` to `nature` (green), `hoya-pink` to `crafts` (blue) (`avatar-catalog.ts:26-30`), so the ring that #95 draws from the theme colour contradicts the avatar's own name. This spec makes the avatar's name the contract for its colour (§3.6) and replaces that ring colour; the label and the entry itself are not touched.

## 2. Decisions

Binding owner decisions this spec implements: **D1** (anyone, any age; level labels replace age labels; stored ids opaque; optional local-first `learnerType`), **D2** (all new strings sit in one catalog-ready module), **D3** (no shame copy introduced), **D8** (spec id).

Decisions made in this spec (reviewable; change here first):

| # | Decision | Why |
|---|---|---|
| L1 | Level ids stay `'5-7' \| '8-9' \| '10-11'` on the wire and in D1. The field keeps the name `ageGroup`. A single `LEARNER_LEVELS` table in `packages/content-schema` is the only place that names them. | No migration, no cached-client break (audit DATA-01 phase 1). SQLite cannot drop a CHECK without a table rebuild, so a fourth level would need one; we do not add levels. |
| L2 | `learnerType: 'child' \| 'self'` is **local only**: stored in the profile on the device, in backup files, never sent in `LearnerRegister`, never stored in D1. Teachers and the roster do not see it. | Keeps the signal private and avoids a migration; the server has no use for it. Cost: a profile restored from a Rescue Code arrives without it (§3.10). |
| L3 | Meaning: `'self'` = the learner manages their own profile and attests to being 13 or older. `'child'` = an adult (parent, guardian, teacher) manages the profile; it does **not** mean under 13. Absent = treated as `'child'` (the conservative branch) and never inferred from the level. | A parent may manage a 15-year-old; a teacher may set up an adult class. Level is a reading preference, not an age. |
| L4 | The "Who is learning?" question has **no preselected answer** and the form below it appears only after an answer. | It decides which attestation the user makes; a default would be a legal-text default. |
| L5 | The level picker defaults to the middle option ("Some reading") and shows "You can change this any time in Profile". | Audit UF-05. A pre-selection avoids a dead Continue; the middle option implies no demographic. |
| L6 | The level has **no effect on content in this spec**. Its descriptions describe the reader, not promises about the app. First consumers: F-PLC-001 (placement length, D10) and the "Read to me" default (F-STORY-002 / F-STORY-003: on for level order 0, "Pictures first"; a default, never a restriction). | Audit UX-07: the old cards promised differences that did not exist. |
| L7 | PIN is **required** on any device that has a managed (`child` or unset) learner, created inside the first-run grown-up card. It is **optional** on a self-only device. If a self-only device has no PIN, grown-up actions open without a gate. | A PIN on a one-adult device is friction that protects nothing; where a child can reach the device the PIN is the point. |
| L8 | Devices that already exist without a PIN keep today's behaviour (the first gate creates it). Closing that hole (an adult check before first setup) is a follow-up. | Not child-reachable on new installs after this spec; legacy installs are a shrinking set. |
| L9 | Forgot PIN has two offline paths and no email path: (a) re-enter the **Rescue Code** that the device already stores locally for a synced profile (`sync-store.ts:32`, F-RESTORE-001 §3.1); (b) a **24-hour wait**, then set a new PIN. Progress is kept in both. Clerk email recovery stays Phase 2 (F-PROF-001 §3.5). | No mail service exists (`F-PROF-001:76`); the Rescue Code is the one adult-held secret already on the device. |
| L10 | The learner's cub (`ProfileAvatar`) is shown for the **learner** (switcher, dashboard, Home entry, Results header, console chip). The guide Hoya (greeting, bubbles, quest intros) stays the standard gold Hoya. | Two different Hoyas on one screen would confuse; the guide is a brand character, the cub is the learner's. |
| L11 | The avatar **name is the contract for its colour**: `hoya-blue` is blue. The Pillar `theme` in `AVATAR_PRESETS` stays as catalogue data and does not colour anything. | Fixes the PR #95 ring mismatch. |
| L12 | Avatar names (`글이 Geuri`, `살이 Sari`, `례이`, `솔이 Sori`, `솜이 Somi`) stay out of the UI as today (`avatar-catalog.ts:7-8`). The visible label is the English `label` ("Book Tiger"). The Rites name is respelled **예리 (Yeri)** in the catalogue (F-CNT-002 §3.8, owner confirmed 2026-10-10). | Colour is never the only cue (WCAG 1.4.1); labels give a second one. |

## 3. Acceptance criteria

### 3.1 Data (content-schema, additive)

New file `packages/content-schema/src/schemas/learner-level.ts`, exported from `src/index.ts`:

```ts
export const LEARNER_LEVEL_IDS = ['5-7', '8-9', '10-11'] as const;
export const LearnerLevelIdSchema = z.enum(LEARNER_LEVEL_IDS);
export type LearnerLevelId = z.infer<typeof LearnerLevelIdSchema>;

export const LearnerTypeSchema = z.enum(['child', 'self']);
export type LearnerType = z.infer<typeof LearnerTypeSchema>;

export interface LearnerLevel { id: LearnerLevelId; order: 0 | 1 | 2; label: string; description: string }
export const LEARNER_LEVELS: readonly LearnerLevel[] = [
  { id: '5-7',   order: 0, label: 'Pictures first', description: 'Big tiles and pictures, very little to read.' },
  { id: '8-9',   order: 1, label: 'Some reading',   description: 'Short words and short sentences.' },
  { id: '10-11', order: 2, label: 'Reads easily',   description: 'Longer text, stories and conversations.' },
] as const;
export const DEFAULT_LEARNER_LEVEL: LearnerLevelId = '8-9';
export function isLearnerLevelId(v: unknown): v is LearnerLevelId;
/** Label for a stored id; null for an id this build does not know (a pill is then simply not drawn). */
export function levelLabel(id: string): string | null;
export function levelDescription(id: string): string | null;
/** 0 = Pictures first, 1 = Some reading, 2 = Reads easily; null for an unknown id. Consumers branch on this, never on the raw '5-7' id. */
export function levelOrder(id: string): 0 | 1 | 2 | null;
```

- `ProfileSchema` (`schemas/profile.ts:25-34`): `ageGroup: LearnerLevelIdSchema` (was an inline `z.enum`) with a doc comment "opaque level id; despite the name it is not an age"; add `learnerType: LearnerTypeSchema.optional()`. `LearnerRegisterSchema.learner.ageGroup` (`schemas/sync.ts:55`) uses `LearnerLevelIdSchema`; it does **not** gain `learnerType` (L2). Unknown keys are stripped by zod, so a newer client that sends `learnerType` still registers.
- Type-only unification (one commit, no behaviour change): replace every hand-written `'5-7' | '8-9' | '10-11'` with `LearnerLevelId` or `Profile['ageGroup']`: `packages/backend/src/store.ts:19,57`, `apps/mobile/src/platform/sync-api.ts:37,67,164,220` (and `:112`, currently `string`), `store/sync-store.ts:58`, `apps/web/src/lib/console/api.ts:28`, `apps/web/src/data/mock-family.ts:9`.
- **No SQL**. `0001`/`0002` CHECKs and `d1.ts:126-127` are untouched. The `age_group` column keeps receiving a level id.
- `LEARNER_LEVELS` strings are English, plain (CEFR Pre-A1), and in this one table so F-I18N-001 can add `es`/`ko` overlays keyed by `id`.

### 3.2 Who is learning (first screen of the form)

`CreateProfileScreen` keeps its file and route (`Onboarding/CreateProfile`, params `{ firstRun: boolean }`, `navigation/types.ts:32`). Sections render in this order; sections 2 to 6 appear only after section 1 has an answer (L4).

1. **Who is learning?** Two radio cards (`accessibilityRole="radio"`, `accessibilityState.checked`, group label "Who is learning?"), each at least `touchTarget.child` tall: "Me" with sub-line "I'm 13 or older"; "My child or a student" with sub-line "A grown-up sets it up". Selecting sets local `learnerType` (`'self'` / `'child'`).
2. **Name.** Label "Your name" (self) / "Their name" (child). Same field and `validateDisplayName` as today (`profile-model.ts:39-45`); the accepted characters are widened by F-I18N-001 (§3.2.1).
3. **Level.** Heading "How do you like to learn?" (self) / "How do they like to learn?" (child). Three radio cards rendered from `LEARNER_LEVELS`, stacked vertically (the old three-across layout at `flexBasis: '31%'`, `:129`, cannot hold a description at 320 dp). Each card: label (title size) + description (caption) + `accessibilityLabel` "`<label>`. `<description>`". Pre-selected: `DEFAULT_LEARNER_LEVEL` (L5). Helper line under the group: "You can change this any time in Profile."
4. **Avatar.** Heading "Pick a Hoya". Five tiles rendered with `ProfileAvatar` (§3.6) in their own colour, each with the English label under it ("Book Tiger" …), `accessibilityRole="radio"`, `accessibilityLabel` "`<label>`", `accessibilityState.checked`. Default `DEFAULT_AVATAR` (`avatar-catalog.ts:33`).
5. **Grown-up card** (`learnerType === 'child'`) or **Agreement card** (`'self'`) — §3.3.
6. **Continue.** Disabled until valid; when disabled a caption names what is missing, in this order: "Choose who is learning", "Type a name", "Tick the box to agree", "Create the PIN" (UX-27). The Hoya "Ready to go!" card keeps its place; its line "Your name and choices stay on this device." is replaced by "Your name and choices are saved on this device. Sign-in and sync are optional." (the old line contradicted sync and backup).

The heading of the screen is **Who is learning?** (replaces "Who's playing?" `:84`). "A grown-up can help with this." (`:86`) is removed.

#### 3.2.1 Names for adults and for the Spanish UI — already shipped (PR #97)

The rule is **owned by F-I18N-001 §3.9 and is already on `main`**: `validateDisplayName` (`profile-model.ts:41-49`) accepts `/^[A-Za-zÀ-ɏ가-힣0-9 '’-]+$/` (so "Andrés", "Zoë", "O’Neil" and "수니" are valid) and returns `'unsupported-character'` for anything else. This spec changes neither the pattern nor the error code. It requires only that (a) the form keeps using `validateDisplayName` as the single rule, (b) the hint strings follow F-I18N-001 (today inline: "Please use letters, numbers, spaces, ' or -.", `CreateProfileScreen.tsx:63-64`; they move to the dictionary there), and (c) the form's tests include an accented name and a Hangul name. `NAME_MAX` stays 12 (schema max is 20: `profile.ts:27`, `sync.ts:54`).

### 3.3 Consent, branching on who is learning

New module `apps/mobile/src/logic/profiles/learner-type.ts` (pure; 100 %):

```ts
export type DeviceAudience = 'family' | 'self';   // labels / tone
export const effectiveLearnerType = (p: { learnerType?: LearnerType }): LearnerType => p.learnerType ?? 'child';
export function deviceAudience(profiles: Array<{ role: ProfileRole; learnerType?: LearnerType }>): DeviceAudience;
  // 'family' if any learner profile is effectively 'child', else 'self'; no profiles -> 'family'
export function requiredConsent(i: { learnerType: LearnerType; guardianAcceptedAt: string | null; selfAcceptedAt: string | null }): 'guardian' | 'self' | null;
  // child -> 'guardian' unless guardianAcceptedAt; self -> 'self' only when neither timestamp exists
export function gateRequired(i: { profiles: ...; parentPinHash: string | null }): boolean;
  // parentPinHash != null || deviceAudience(profiles) === 'family'
export function pinRequiredForNewProfile(i: { learnerType: LearnerType; parentPinHash: string | null }): boolean;
  // learnerType === 'child' && parentPinHash === null
```

`store/account-store.ts` gains (keys follow the file's `account:` convention, all via `platform/storage`):

| State | Key | Meaning |
|---|---|---|
| `guardianConsentAcceptedAt` | `account:guardianConsentAcceptedAt` | A parent or guardian agreed (checkbox below) |
| `selfConsentAcceptedAt` | `account:selfConsentAcceptedAt` | A learner attested "13 or older" and agreed |
| `pinResetRequestedAt` | `account:pinResetRequestedAt` | §3.5 wait path |

`acceptConsent()` (`:69-73`) is replaced by `acceptGuardianConsent()` and `acceptSelfConsent()`; each also sets `consentAcceptedAt` when it is still null (kept as "first consent", so anything reading it keeps working). **Migration** in `hydrate`: when `consentAcceptedAt` is present and `guardianConsentAcceptedAt` is absent, set `guardianConsentAcceptedAt = consentAcceptedAt` in memory (the old checkbox was a parent/guardian attestation); no write is needed until the next change.

**Grown-up card** (`learnerType === 'child'`, shown when `requiredConsent === 'guardian'` or `pinRequiredForNewProfile`; it is the existing card at `CreateProfileScreen.tsx:185-257` plus the PIN):

- Heading "For a grown-up"; body "A parent, guardian or teacher sets up the account. We collect as little as possible and never show ads." (adds "teacher").
- "Email (optional)" with the existing caption and validation (`isValidEmail`), placeholder `name@email.com` (was `grown-up@email.com`, `:205`).
- **Create a grown-up PIN**: inline `PinPad` (§3.4), 4 digits entered twice.
- Checkbox "I'm a parent or guardian of this learner (or I set it up for them) and I agree to the Privacy Policy." with "Privacy Policy" as a link (`logic/links.ts` `privacyUrl()` built like `consoleBillingUrl`, `logic/paywall.ts:33-37`, opened with `Linking.openURL`; if it fails, the screen shows "Open hangulroute.com/privacy in a browser." like `PaywallScreen.tsx:31-38`).
- Continue requires: valid name, a level, an avatar, checkbox ticked, PIN confirmed (when `pinRequiredForNewProfile`), email empty or valid.
- On submit (order matters, all synchronous stores): `acceptGuardianConsent()` → `setParentPinHash(hash)` (hash from `createPinHash(pin, pinHasher)`, `logic/profiles/pin-hash.ts`, `platform/crypto.ts`) → `setParentEmail` if typed → `createProfile({ …, learnerType: 'child' })`.

**Agreement card** (`learnerType === 'self'`, shown when `requiredConsent === 'self'`):

- Heading "Before you start"; body "We collect as little as possible and never show ads."
- "Email (optional)" (same caption and validation).
- Checkbox "I'm 13 or older and I agree to the Privacy Policy." with the same link.
- A collapsed row "Protect settings with a PIN (optional)" expands to the same `PinPad`. If the learner sets one, it is stored like any other; if not, `gateRequired` stays false (L7).
- On submit: `acceptSelfConsent()` → optional `setParentPinHash` → `setParentEmail` → `createProfile({ …, learnerType: 'self' })`.

**Adding a profile later** (`firstRun: false`, reached through `PinEntry` → `AddProfile`, `ProfileScreen.tsx:58-74`, or directly on a self-only device without a PIN): the same form. Section 1 is asked again. If the answer is `'child'` and `guardianConsentAcceptedAt` is null (a self-only device gains a child), the grown-up card appears with PIN creation (mandatory) and, on submit, the device becomes a family device (`deviceAudience` flips because the new profile is `'child'`). If the answer is `'self'` on a device that already has any consent, no card is shown. There is no "13 or older" re-attestation per profile; adding a profile is itself behind the gate whenever the gate is required.

**Neutrality statement for counsel** (not code): the question is a plain declaration, not an age gate that teaches an answer; the self path collects only a nickname, a level, an avatar and an optional email that never leaves the device in this build.

### 3.4 PIN creation in the card, shared keypad

- New presentational component `apps/mobile/src/components/PinPad.tsx` = the **key grid extracted from `PinEntryScreen.tsx:238-298`**, props `{ value: string; onChange(next: string): void; disabled?: boolean; layout: PinPadLayout; testID? }`; the dots (`PIN_LENGTH`, `logic/profiles/pin-hash.ts:10`) stay with the caller; digits are never echoed as text (F-PROF-001 §3.5). **PR #95 already solved the small-phone sizing** (`logic/profiles/pin-pad-layout.ts`: `pinPadLayout` picks 3x4, 4x3 or 6x2 and shrinks keys from `touchTarget.child` to the `touchTarget.min` floor, `pinPadBudget` measures what is left; `PinEntryScreen.tsx:71-83`), so this spec **reuses it and does not invent a 3-column rule**: `PinEntryScreen` keeps computing its layout from the measured header and passes it in; the CreateProfile card (which scrolls) calls `pinPadLayout({ width, height: Number.POSITIVE_INFINITY, minKey: touchTarget.min, maxKey: touchTarget.min, gap: spacing.sm })`, i.e. 64 dp keys in a 3-column grid. The refactor is behaviour-neutral: the existing Playwright assertions that the pad and its CTA fit without scrolling at 320x568 and 375x553 (`apps/mobile/e2e/web/layout.spec.ts`) must stay green, and the labels `Digit n` / `Delete last digit` are kept (`PinEntryScreen.tsx:255,275`).
- `PinSetupField` (inside the card): two `PinPad` states, "Create a PIN" then "Type it again". A mismatch clears both and shows "Those didn't match. Let's start again." (the string at `PinEntryScreen.tsx:126`), never a red state (`colors.feedback.nudge` only).
- The first-run card never offers PIN setup unless the answer to section 1 is `'child'` (or the self learner opens the optional row). `PinEntryScreen`'s `setup-1` mode remains for legacy devices (L8) and for the optional self path (§3.5, `mode: 'setup'` param).
- Titles in `PinEntryScreen` (`:158-165`) branch on `deviceAudience`: family keeps "Grown-up zone" / "Create a grown-up PIN" / "Pick 4 digits only grown-ups will know. It protects settings and grown-up pages."; self-only uses "Settings PIN" / "Create a PIN" / "Pick 4 digits to protect settings."

### 3.5 Forgot PIN (audit UX-08)

New route `PinReset` (add to `RootStackParamList` and `navigation/root.tsx`), screen `screens/parent/PinResetScreen.tsx`; pure logic `logic/profiles/pin-reset.ts` (100 %).

- `PinEntryScreen` in `verify` mode gets a quiet text button "Forgot PIN?" below Cancel (target at least `touchTarget.min`; boring styling, no icon, so a child gains nothing by poking it). It is absent in `setup` modes. Route param `PinEntry: { next, mode?: 'setup' }` is added so the self-only device can open setup deliberately.
- `PinResetScreen` explains in one line: "Your learners, cards and progress are kept." and offers:
  1. **Use a Rescue Code** — shown only when at least one local profile has a stored code (`useSyncStore.byLearner[id].rescueCode`, `sync-store.ts:32`). One text field (auto-capitalise characters). Since PR #96 a Rescue Code is **four words + six digits** (`TIGER-MOON-RIVER-APPLE-482139`); codes issued earlier are two words + four digits and still restore, so the field accepts both through `normalizeRescueCode` (`schemas/sync.ts:109`, any case, spaces or hyphens, digits glued or grouped) and the placeholder shows the four-word shape. Submit compares the normalised entry with every stored code; no network. A wrong entry counts through the existing throttle (`registerFailure` on `account:pinAttempts`: 5 per 60 s then a 30 s cooldown, `pin-hash.ts:11-14,57-64`), so the code cannot be brute-forced on the device.
  2. **Wait 24 hours** — always available, and the only option when no code is stored (otherwise it sits behind "I don't have the code"). "Start the wait" writes `account:pinResetRequestedAt`; the screen then shows "You can set a new PIN after `<local date and time>`". The old PIN keeps working meanwhile; a successful `verifyPin` clears the request. After `PIN_RESET_WAIT_MS` (24 h) the same button reads "Set a new PIN".
- Both paths end in `PinEntryScreen` `setup-1`/`setup-2` (route `PinEntry` with `mode: 'setup'`, `next` preserved); `setParentPinHash` resets the attempt state (`account-store.ts:80-84`). Only after the new PIN is stored is `pinResetRequestedAt` cleared.
- Residual risk, accepted and documented: a child who finds the screen and waits 24 h can replace the PIN. The Rescue Code path is listed first whenever it exists so adults are steered to it; the wait path is the fallback for devices that never synced. Phase 2 (Clerk email) removes the wait.
- Copy rules: calm, adult tone, never a shaming line.

### 3.6 Avatar variants shown everywhere (audit UX-06, L10, L11)

- **Tokens first** (charter: design before code, tokens only). The eight new fur colours are **flat keys of the existing `colors.hoya` group**, not a new top-level object: `hoya.furBlue`, `hoya.furBlueDark`, `hoya.furGreen`, `hoya.furGreenDark`, `hoya.furPurple`, `hoya.furPurpleDark`, `hoya.furPink`, `hoya.furPinkDark` (the orange variant is the existing `hoya.fur` / `hoya.furDark`, unchanged). Reason: since PR #95 `packages/design-system/src/__tests__/tokens-parity.test.ts` pins **every** `colors.<group>.<key>` to a row `| \`group.key\` | #RRGGBB |` in `design/tokens/colors.v1.md` in both directions, so a nested `hoyaVariant` object would be invisible to it, and a documented-only row would fail it. So the sequence is: (1) rows in `design/tokens/colors.v1.md` under "Hoya variants" (design step, `design/screens`), (2) the same values in `tokens.ts`, (3) the parity test passes. A pure helper `hoyaVariantColors(variant): { fur: string; furDark: string }` (exported from `tokens.ts`, so the web app can import it from `@hangul-route/design-system/tokens` without pulling React Native) maps `'orange' | 'blue' | 'green' | 'purple' | 'pink'` to those keys.

  Values are chosen in the design step, starting from the palette that already exists (for example `theme.crafts`, `theme.nature`, `theme.rites`, `stage.stage6`), under these constraints, each asserted in `contrast.test.ts` where numeric: fur against `colors.hoya.stripes` at least 3:1 (`contrastRatio`, `src/contrast.ts`); fur against `colors.surface.paper` and `colors.surface.canvas` at least 3:1 for the ring/chip use (non-text); the five variants stay distinguishable under simulated deuteranopia and protanopia (design review, not a unit test); cheek and belly tokens unchanged.
- `HoyaProps` gains `variant?: HoyaVariant` (`'orange' | 'blue' | 'green' | 'purple' | 'pink'`, default `'orange'`). `Hoya.tsx` reads its fur and fur-dark fills from `hoyaVariantColors(variant)` (the file has 28 lines referencing `colors.hoya.*`; only the `fur` and `furDark` ones change); stripes, nose, cheek and belly keep using `colors.hoya`. The pose-transition pulse and the labels (`Hoya the tiger, <pose>`) are unchanged.
- New `apps/mobile/src/components/ProfileAvatar.tsx`: props `{ avatar: AvatarKind; size: number; pose?: HoyaPose; ring?: boolean; testID? }`. It maps `AvatarKind` → variant (`avatar.replace('hoya-', '')`, guarded by `isAvatarKind`, fallback `orange`), draws the cub in a circle with an optional ring (`borderWidth.thick`) in `hoyaVariantColors(variant).fur`, and carries **no** accessibility label of its own (it is decorative inside labelled controls; audit UX-33). `avatarTheme()` (PR #95, `avatar-catalog.ts:39-46`) no longer colours anything once the Home ring uses `ProfileAvatar`; PR 5 deletes it and its test instead of leaving dead code (`AVATAR_PRESETS[].theme` stays as catalogue data).
- Where the learner's cub appears (all through `ProfileAvatar`):

  | Site | Today | After |
  |---|---|---|
  | Create profile picker | identical Hoyas (`CreateProfileScreen.tsx:179`) | five tinted cubs + English label |
  | Profile switcher card | `<Hoya pose=… size={72}/>` (`ProfileScreen.tsx:113`) | the profile's cub, `cheering` when active; card shows name + level label |
  | Home Profile entry | PR #95 (`HomeScreen.tsx:158-183`): the gold Hoya in a ring of `colors.theme[avatarTheme(avatar)]`, caption "Profile" already present | `ProfileAvatar` with `ring` (ring and cub in the avatar's own variant colour); the caption and accessible name ("Profile and settings") are kept as they are |
  | Grown-up dashboard card | none (`ParentDashboardScreen.tsx:53-58`) | cub at 40 dp beside the name |
  | Results header | none | a 40 dp cub + name chip above the guide Hoya (`ResultsScreen.tsx:106` stays the guide) |
  | Console roster card | none (`avatar` is already in the payload, `spaces.ts:379`, `console/api.ts:29`) | `AvatarChip` (below) |

- Console: `apps/web/src/components/AvatarChip.tsx`, a 28 px circle filled with `hoyaVariantColors(v).fur` (imported from `@hangul-route/design-system/tokens`) plus the English avatar label as `aria-label`; unknown avatar strings (the server stores `avatar` as a free string, `schemas/sync.ts:56`) render a neutral `colors.surface.sunken` circle. No full Hoya SVG on the web (the preview page has a hand-copied one, `design-preview/page.tsx:1019`; adding a five-variant row there is part of the design PR). With `anonymizeRoster` the chip carries no name or initial.
- The five avatar buttons everywhere get `accessibilityRole="radio"`, a selected state, and the English label (not the raw id `Avatar hoya-orange`, `:168`).
- `AVATAR_PRESETS[2]` (`avatar-catalog.ts:28`): `pillarName: '예리'`, `romanization: 'Yeri'` (F-CNT-002 §3.8 and its owner-confirmation note). `AVATAR_PRESETS` becomes the source of the labels used by the picker (it is currently not imported by any screen); when F-I18N-001 PR 5 lands, the English `label` moves to `m.learner.avatars[kind]` so it can be translated.

### 3.7 Replacing every "Age X" label (audit UF-07)

Rule: a level label is drawn only where it helps someone decide something; elsewhere the pill is removed. All label text comes from `levelLabel()` (null → no pill).

| Site (verified) | Change |
|---|---|
| `apps/mobile/src/screens/profile/ProfileScreen.tsx:116` `<Caption>Age {p.ageGroup}</Caption>` | `<Caption>{levelLabel(p.ageGroup)}</Caption>` (hidden when null); the card shows name + label, not age |
| `apps/mobile/src/screens/parent/ParentDashboardScreen.tsx:57` `<Pill label={\`Age ${p.ageGroup}\`}/>` | `<Pill label={levelLabel(p.ageGroup)}/>` when non-null |
| `apps/web/src/app/teach/space/page.tsx:151` `Age {l.ageGroup}` | `{levelLabel(l.ageGroup)}` pill, hidden when null; roster is production `/teach` |
| `apps/web/src/app/parent/page.tsx:86` `Age {p.ageGroup}` and `parent/[childId]/page.tsx:26` `Age {child.ageGroup} · …` | same helper; the demo copy says "learner" not "child" in the same edit only where it prints the label |
| `apps/web/src/data/mock-family.ts:9,28,56` | types use `LearnerLevelId` (§3.1); values unchanged |
| `apps/web/src/app/design-preview/page.tsx:889` and `design-preview/components/page.tsx:367` sample pill `'Age 5-7'` | `'Pictures first'` |
| `apps/web/src/app/design-preview/page.tsx:493` `'child (ages 5–7 primary)'` | `'primary action'` |
| `apps/mobile/src/screens/onboarding/CreateProfileScreen.tsx:127` a11y `Age group ${g.label}` | removed with the picker (§3.2) |
| `CreateProfileScreen.tsx:77` telemetry payload `{ ageGroup, … }` | `{ level, … }` (§3.8; `learnerType` is not sent — owner decision 2026-10-10) |

Both apps import `levelLabel` from `@hangul-route/content-schema` (the web app already depends on it: `console/api.ts` imports `ProgressSummary`). The pill is not shown at all on the learner's own Home. A guard test greps the non-test source of `apps/mobile/src` and `apps/web/src` for `` `Age ` `` and `Age {` and fails on any match (§5).

PR #95 (merged) set the Home entry label to "Profile" with the accessible name "Profile and settings" (`HomeScreen.tsx:155-183`). This spec **does not touch the label or the name**; PR 5 only swaps the glyph and the ring colour inside that entry for `ProfileAvatar` (§3.6).

### 3.8 Telemetry (add to `TELEMETRY_EVENT_NAMES`, `packages/content-schema/src/schemas/telemetry.ts:9-33`)

| Name | Fires | Payload (no free text, no name, no email) |
|---|---|---|
| `onboarding.who_selected` | section 1 answered | `{ learnerType, firstRun }` |
| `onboarding.level_selected` | level chosen (first change only, not the default) | `{ level, learnerType }` |
| `onboarding.consent_given` | Continue pressed with a card | `{ basis: 'guardian' \| 'self_13plus', hasEmail, pinSet }` |
| `onboarding.started` (existing, `CreateProfileScreen.tsx:74-78`) | profile created | `{ level, learnerType, firstRun, hasEmail }` — `ageGroup` and `hasParentEmail` keys are dropped |
| `profile.updated` | edit saved (§3.11) | `{ field: 'level' \| 'avatar' \| 'name' \| 'learner_type' }` |
| `pin.created` | a PIN is stored | `{ where: 'first_run' \| 'gate' \| 'reset' \| 'optional' }` |
| `pin.reset_requested` | Rescue Code accepted or wait started | `{ method: 'rescue_code' \| 'wait' }` |
| `pin.reset_completed` | new PIN stored after a reset | `{ method }` |

`packages/content-schema/src/__tests__/telemetry.test.ts` lists the names exactly; update it. The API whitelist reads the same constant (`packages/backend/src/routes/telemetry.ts`), so no backend change. **Owner decision 2026-10-10: `learnerType` is NOT sent in any telemetry payload** (only `level`, never free text); it stays on the device (and on `ProfileSchema` locally). The privacy page therefore needs no `learnerType` disclosure (§3.12). `track()` (`platform/telemetry.ts`) already never throws and honours `flags.telemetryEnabled`.

### 3.9 Neutral "Ask a grown-up" copy (audit UF-08)

New module `apps/mobile/src/logic/audience-copy.ts` holds the strings below as `audienceCopy(audience: DeviceAudience)`; it is the single place to move into F-I18N-001 catalogs. Rule: the default is a neutral sentence; the family variant may add "(a grown-up can help)" only where an adult really is needed. "Grown-up zone" and "Create a grown-up PIN" are caregiver surfaces and stay for the family audience (CLAUDE.md §1 allows adults to be addressed there).

| Site (verified) | Today | After (both audiences unless noted) |
|---|---|---|
| `components/InstallGuideSheet.tsx:72` | "Ask a grown-up to add me to your home screen." | "Add me to your home screen." (family adds a second line "A grown-up can help.") |
| `screens/journey/JourneyScreen.tsx:72` a11y | "…: ask a grown-up to unlock" | "`<stage>`: locked. Opens the unlock page." |
| `screens/home/HomeScreen.tsx:222` | "Reviews from your grown-up" | "Reviews picked for you" |
| `screens/homework/HomeworkScreen.tsx:56` | "Picked by your grown-ups. Hoya sometimes adds a review." | "Picked by Hoya, your teacher or your family." |
| `screens/sync/RestoreScreen.tsx:98` | "Got a rescue code, a grown-up account, or a saved file?" | "Got a rescue code, an account, or a saved file?" |
| `screens/sync/RestoreScreen.tsx:167` | button "Sign in as a grown-up" (disabled, "Coming soon") | "Sign in" |
| `components/SpacesCard.tsx:42` | "…Got a code from a teacher or a grown-up?" | "…Got a code from a teacher or your family?" |
| `logic/spaces/join-code.ts:40` | "…A grown-up can leave one in settings." | "…Leave one in Settings first." (verified: the Leave button, `SpacesCard.tsx:51`, is not PIN-gated and asks only for a confirmation) |
| `logic/spaces/join-code.ts:44` | "That code is for grown-ups. Ask for a class code." | "That code isn't for joining as a learner. Ask for a class code." |
| `logic/sync/restore.ts:50` | "…with your grown-up's rescue code." | "…with your rescue code." |
| `logic/paywall.ts:26` | "…A grown-up enters it on the web console." | "…Enter it on the web console." |
| `screens/paywall/PaywallScreen.tsx:115-116` | "Grown-ups buy it once on the web console…" / "…a grown-up can buy it once…" | "Buy it once on the web console…" / "…you can buy it once…" |
| `screens/profile/ProfileScreen.tsx:90` | "Tap a Hoya to switch." | "Tap a profile to switch." |
| `ProfileScreen.tsx:128,196,232`, `components/BackupCard.tsx:48,50` a11y | "(grown-ups only)" | family: "(PIN required)"; self without PIN: no suffix |
| `ProfileScreen.tsx:229-233` | "Grown-up zone" | family: unchanged; self-only: "Account & backup" |

Out of this table: web console wording "Kids don't need an account…", "Home — my kids", `billingKidsLine` (`apps/web/src/lib/console/copy.ts:4,7,42`, `routing.ts:42`) is audit UF-10 (teacher and parent surfaces) and belongs to the copy PR that owns the landing page; it is not a blocker here. Landing, store copy and internal docs (UF-01..04, UF-11, INT-*) are separate PRs.

### 3.10 Migration and mapping of existing data

| Existing data | Result | Where |
|---|---|---|
| Profile with `ageGroup` `'5-7'`/`'8-9'`/`'10-11'`, no `learnerType` | Unchanged on disk. Label: `Pictures first` / `Some reading` / `Reads easily`. `effectiveLearnerType` = `'child'`. Not written back (no storage migration; `profile-store.hydrate` does not parse) | §3.1, §3.3 |
| Device with `account:consentAcceptedAt` | `guardianConsentAcceptedAt` is derived from it on hydrate (the old attestation was a parent/guardian one) | §3.3 |
| Device with a PIN | Unchanged; `gateRequired` true (it has a PIN and its profiles are effectively `'child'`) | §3.3 |
| Device with no PIN | L8: first gate still creates it | §3.4 |
| Backup file exported by an older build | `BackupFileSchema` parses it (no `learnerType`); restored profile is `'child'`-effective | `schemas/sync.ts:79-85` |
| Backup file from this build opened by an older build | `learnerType` is stripped by zod; nothing breaks | same |
| Learner restored by Rescue Code or re-link on a new device | `adoptServerLearner` builds the profile without `learnerType` (`sync-store.ts:225-232`) and no consent record exists on that device. Treated as `'child'`; the grown-up zone behaves as today. Recorded gap, follow-up: ask "Who is learning?" once after restore | §5 |
| Server rows | `age_group` untouched; roster still returns `ageGroup` (`spaces.ts:378`), console maps it with `levelLabel` | §3.7 |
| Adult who onboarded under the old flow | Keeps `'child'`-effective profile and PIN gate until they change "Who is learning?" in Profile (§3.11) | §3.11 |

### 3.11 Editing a profile (level, avatar, who)

Without this, a wrong first choice (or the legacy default) cannot be fixed.

- New route `EditProfile: { profileId: string }`, entered from an "Edit" button on each profile card in `ProfileScreen`. Editable: name (same validation), level (`LEARNER_LEVELS` picker), avatar (`ProfileAvatar` picker). Name, level and avatar carry no privacy meaning, so no PIN is needed for them on a self-only device; when `gateRequired` is true the route opens behind the PIN gate like the other grown-up actions (`openGrownUps`, `ProfileScreen.tsx:58-74`).
- **Who is learning** is the fourth row. Changing `'child'` → `'self'` requires the PIN gate (when one exists), the same "I'm 13 or older and I agree to the Privacy Policy" checkbox, and sets `selfConsentAcceptedAt` if absent. Changing `'self'` → `'child'` requires `requiredConsent === 'guardian'` handling and PIN creation if none (the grown-up card in a sheet). Either way telemetry `profile.updated { field: 'learner_type' }`.
- Reducer `updateProfile(set, id, patch: { displayName?; ageGroup?; avatar?; learnerType? })` in `logic/profiles/profile-model.ts` (next to `renameProfile`, `:91-102`), plus `profile-store.updateProfile`. A profile that has synced re-registers nothing: `displayName`, `ageGroup`, `avatar` changes reach the server only through the existing registration fields on the next snapshot flow; if the server has no update route for these (`routes/sync.ts` only registers on first sync) the change stays local and the roster shows the registered values. **Verified on `main` (`332e199`)**: no such route exists — `packages/backend/src/routes/sync.ts` has only `POST /learners` (`:17`), `PUT`/`GET /learners/:id/snapshot` (`:43`, `:87`) and `GET /learners/:id/inbox` (`:103`), and `routes/recovery.ts` only issues and claims Rescue Codes. So edits to name, level and avatar are **local until a server route exists**: the roster keeps the values registered at first sync, and the Edit screen says "Changes show on your teacher's list after you join again" for a learner who is in a class. A `PATCH /learners/:id` route (additive D1 columns are not needed: the three columns exist) is a follow-up spec and, per the charter, its server schema ships before any client sends the change.

### 3.12 Alignment notes (privacy, terms, internal docs)

Counsel reviews the switch from child-directed to mixed-audience (audit UF-09). Concrete edits:

- `apps/web/src/app/privacy/page.tsx:29` → "Learner profile: a display nickname, a learning level (for example "Pictures first") and an avatar. A real name is optional and only stored if the account holder enters it." `:31` → "Account contact: an email (the parent's when the learner is a child), used for sign-in, receipts and account recovery." `:23` add: "A learner aged 13 or older can set up their own profile. For a learner under 13, a parent or legal guardian sets it up and consents." `:73` → "The account holder (a parent or legal guardian when the learner is a child) can review, export, correct or delete the learner's data…". Add one bullet to "What we collect": "Whether a profile is managed by an adult or by the learner themselves is kept on the device; it is sent only inside onboarding events that carry the device-generated profile id (no name, no email), i.e. pseudonymous, not anonymous." The COPPA section (`:47`) stays verbatim.
- `apps/web/src/app/terms/page.tsx:17,23` already read "learners of any age"; add "A learner aged 13 or older may accept these terms for themselves."
- Internal docs updated in the docs PR: `docs/specs/F-PROF-001-device-profiles.md` §3.2 (avatar tints, level, who), §3.5 (replace "reinstall wipes data" with the two reset paths), §9.3; `docs/specs/F-SYNC-001` and `F-SPACE-001` API contract wording ("ageGroup is an opaque level id; display via `levelLabel`"); `design/wireframes/profiles/create-learner.md` open question on age (`:67,:71`) resolved by §3.2; `design/wireframes/profiles/pin-entry.md` open question "Forgot PIN" resolved by §3.5; `design/wireframes/onboarding/welcome.md:4` audience line; `docs/blueprints/10-app-map.md` row `profiles/create-parent` ("name·age·avatar" → "who·name·level·avatar").
- Code comments that still frame the product by age: `packages/design-system/src/tokens.ts:12,138,196,200,212` ("ages 5–11", "5–7 yo legibility", "children 5–11", "children 5–7", "anti-startle for kids") and `apps/mobile/src/config/flags.ts:26-29` ("5–11 yo Korean voices"). PR 3 rewords the first (it already edits `tokens.ts`), a one-line `docs` commit the second; no identifier changes (`touchTarget.child` stays).
- App Store privacy answers: the onboarding events carry `level` with a `profileId` (not `learnerType`, owner decision 2026-10-10); check `docs/launch/app-store-submission.md` data-use answers before the next submission (not read for this spec; listed in §9).

### 3.13 States, offline, errors, accessibility

- **Offline / no network**: the whole flow is local (storage + crypto). The privacy link needs a browser; failure shows the note in §3.3. Telemetry queues offline as today.
- **Storage failure** (`writeJson` rejects): the existing stores `void` the promises; keep that. If `createPinHash` throws, show "Couldn't set the PIN. Try again." under the pad, keep the entries, do not create the profile.
- **Empty / invalid**: name hint strings stay calm (`CreateProfileScreen.tsx:60-65`); no red; the incomplete-form caption in §3.2 names the next missing step; email invalid uses `colors.feedback.nudge` (`:215`).
- **Small phones**: all new controls reflow at 320 dp (cards stack, no horizontal scroll); the form scrolls (`Screen scrollable`); Continue stays reachable (F-LAYOUT-001 provides the sticky footer; until then the button is last in the scroll).
- **Targets and roles**: every card, tile and key at least `touchTarget.min` (64), option cards at least `touchTarget.child` (80); radio groups use `accessibilityRole="radio"` with checked state; the consent checkbox keeps `accessibilityRole="checkbox"`; decorative cubs have no label of their own (the control around them is labelled).
- **Motion**: no new animation; the Hoya pose pulse already respects reduced motion (`Hoya.tsx`).
- **No emoji** in rendered output; the old `✓` glyph in the checkbox (`CreateProfileScreen.tsx:249`) is replaced by the design-system check icon when the component is rewritten.

### 3.14 Behaviours (Given / When / Then)

- **Given** a fresh install, **when** Create profile opens, **then** only "Who is learning?" with two unselected cards is drawn, Continue is disabled and its caption reads "Choose who is learning".
- **Given** the answer "My child or a student", a valid name, the default level, a chosen cub, a PIN entered twice identically and the box ticked, **when** Continue is pressed, **then** in this order `guardianConsentAcceptedAt` is stored, `parentPinHash` is stored, the profile is created with `learnerType: 'child'`, `onboarding.started` fires with `{ level, learnerType: 'child', firstRun: true, hasEmail }` (no name, no email) and the app opens `FirstQuestPreview`.
- **Given** the PIN confirmation differs, **then** both entries clear, "Those didn't match. Let's start again." appears in the amber nudge style and no profile is created.
- **Given** the answer "Me", **when** the box "I'm 13 or older and I agree to the Privacy Policy" is ticked and Continue pressed with the optional PIN row left closed, **then** `selfConsentAcceptedAt` is stored, no PIN is stored, `gateRequired` is false and tapping "Grown-up zone" in Profile opens the dashboard with no PIN screen.
- **Given** a device with a stored Rescue Code and a PIN, **when** "Forgot PIN?" is tapped and the code is typed in any case with spaces, **then** the PIN-setup screen opens, the old hash is replaced after the new PIN is confirmed, `pinAttempts` is reset, and profiles, cards and stars are unchanged.
- **Given** a device with no stored code, **when** "Start the wait" is pressed, **then** `pinResetRequestedAt` is stored, the button is disabled and shows the date and time 24 hours later, and **when** 24 hours have passed **then** it reads "Set a new PIN"; a successful ordinary PIN entry before then clears the request.
- **Given** a profile stored by an older build with `ageGroup: '8-9'` and no `learnerType`, **then** it is treated as `'child'`, the switcher shows "Some reading" and no text anywhere contains "Age".
- **Given** a stored `ageGroup` this build does not know (a future level), **then** no level pill is drawn and nothing throws.
- **Given** the cub `hoya-blue`, **when** the switcher, Home entry and dashboard render, **then** each draws the blue variant (not the theme colour) and the picker shows the label "Blue Tiger"-style English label under each cub.

## 4. Out of scope

- Content or difficulty that changes with level; placement (F-PLC-001); the "Read to me" default (F-STORY-002 / F-STORY-003 own it).
- A D1 migration, a `learner_level` column, rebuilding `learners` without `age_group`, or a fourth level (L1).
- Syncing `learnerType` to the server, showing it to teachers, or inferring it from play.
- Clerk email recovery for the PIN, a PIN-reset email, an adult check before first PIN setup on legacy devices (L8), PIN reset from the web console.
- Consent for restored profiles (§3.10 gap), `parentEmail` actually sending anything.
- Landing page, manifest, store listing, launch docs and design briefs (UF-01..04, UF-11, INT-*); console "kids" wording (UF-10).
- Localising the new strings (F-I18N-001); the Welcome-screen locale chooser.
- Full small-phone/safe-area work and the PIN keypad's final layout beyond 64 dp keys (F-LAYOUT-001); the Profile entry label (PR #95).
- A separate "Me" tab or splitting child and grown-up settings (audit UX-21).

## 5. Tests

Coverage: `content-schema` 100 %, mobile `logic` and `store` 90 % rising to 100 % (charter §6), screens are covered by the web e2e lane (the mobile vitest config lists no component tests: `apps/mobile/vitest.config.ts:20-31`), `packages/backend` 90 %.

| File | Level | Coverage |
|---|---|---|
| `packages/content-schema/src/__tests__/learner-level.test.ts` (new) | unit | `LEARNER_LEVELS` has exactly the three ids in order; `levelLabel`/`levelDescription`/`levelOrder` for each id, `null` for `'12-14'`/`''`; `isLearnerLevelId`; `LearnerTypeSchema` rejects others |
| `…/schemas.test.ts` (extend; fixtures at `:161-193`) | unit | `ProfileSchema` parses a profile with and without `learnerType`; **legacy fixture** (old profile JSON) still parses; `BackupFileSchema` parses an old backup |
| `…/sync.test.ts` (extend; fixtures at `:52-75`) | unit | `LearnerRegisterSchema` accepts the three ids, rejects `'12-14'`, strips an unknown `learnerType` |
| `…/telemetry.test.ts` (extend) | unit | the seven new names in §3.8 (`onboarding.started` already exists) are in the whitelist and the sorted list matches |
| `apps/mobile/src/logic/profiles/__tests__/learner-type.test.ts` (new) | unit | `effectiveLearnerType` default; `deviceAudience` for none / self-only / mixed / role filtering; `requiredConsent` matrix (child/self × guardian/self timestamps); `gateRequired`; `pinRequiredForNewProfile` |
| `…/profile-model.test.ts` (extend) | unit | `createProfile` with `learnerType`; `createProfile` rejects what `validateDisplayName` rejects (no rule change here); `updateProfile` patch rules and unchanged others |
| `…/pin-reset.test.ts` (new) | unit | rescue-code match against several stored codes, normalisation, no stored code; wait state `idle`/`waiting`/`ready` at boundary instants; throttle shares `pinAttempts`; request cleared on success |
| `…/pin-hash.test.ts` (unchanged) | unit | regression: attempt/cooldown behaviour not altered by the `PinPad` refactor |
| `apps/mobile/src/store/__tests__/account-store.test.ts` (extend) | unit | new keys persist and hydrate; legacy `consentAcceptedAt` yields `guardianConsentAcceptedAt`; `acceptSelfConsent`/`acceptGuardianConsent` set the first-consent stamp once; `pinResetRequestedAt` round trip |
| `…/profile-store.test.ts` (extend) | unit | `createProfile` stores `learnerType`; hydrating a profile without it leaves it undefined; `updateProfile` persists |
| `apps/mobile/src/logic/__tests__/audience-copy.test.ts` (new) | unit | every string in §3.9 for both audiences; none contains "grown-up" in the self audience except the caregiver-surface keys; banned-word scan (`failed`, `missed`, `overdue`, `incomplete`) clean |
| `apps/mobile/src/logic/__tests__/copy-guard.test.ts` (new) | unit | reads non-test sources under `apps/mobile/src` and `apps/web/src` with `fs` and fails on `Age ${`, `` `Age ` `` + ageGroup, `Age {`, `How old are you`, `Age group` |
| `apps/web/src/lib/console/__tests__/level-label.test.ts` (new) | unit | roster/pill helper returns label or hides |
| `packages/design-system/src/__tests__/tokens.test.ts` (extend; the legibility test is at `:53`) and `tokens-parity.test.ts` (unchanged, must pass with the eight new `hoya.*` rows) | unit | `hoyaVariantColors` returns the five variants; `orange` equals `colors.hoya.fur/furDark`; unknown variant falls back to orange; rename the test text "kids 5-7 legibility" → "young-reader legibility" (age framing in a test title) |
| `packages/design-system/src/__tests__/contrast.test.ts` (extend) | unit | each variant's fur against `hoya.stripes` at least 3:1 and against `surface.paper`/`canvas` at least 3:1 |
| `apps/mobile/e2e/web/layout.spec.ts` (existing, from PR #95) | e2e | regression guard for the `PinPad` extraction (PR 4a): the grown-up PIN pad and its CTA still fit without scrolling at 320x568 and 375x553 (the mobile vitest config has no component harness, so a unit test of the component is not possible) |
| Existing e2e helpers `apps/mobile/e2e/web/{layout,backup,rescue-code-320,progress-reload,install-guide,offline}.spec.ts` | e2e | all six onboard through "Type your name" + `getByRole('checkbox')`; PR 4 replaces that with one shared helper (`e2e/web/helpers.ts`: choose "My child or a student", name, tick the box, set a PIN) and updates the six files in the same PR |
| *Hoya `variant` render* | note | `packages/design-system/vitest.config.ts` is node-only and excludes `src/components/**`, so there is no render test; the mapping is the pure `hoyaVariantColors` (tested above) and the five variants are shown on the design-preview page (F-PREV-001 / F-VR-001) |
| `packages/backend/src/__tests__/sync.test.ts` (extend; the audit's `api-v1-extended.test.ts` bad-age test no longer exists in this tree) | integration | registration with each level id works; `'12-14'` is still a 422; a body with `learnerType` registers and the stored learner has no such field |
| `apps/mobile/e2e/web/onboarding-self.spec.ts` (new, Playwright, `playwright.config.ts`) | e2e | at 375x667 and 320x568: choose "Me", form appears, Continue disabled with reason, fill, tick "13 or older", no PIN needed, land on first-quest preview, no text "Age" or "grown-up" on screen |
| `apps/mobile/e2e/web/onboarding-guardian.spec.ts` (new) | e2e | choose "My child…", PIN twice, mismatch message, consent link present, then Profile → "Grown-up zone" prompts the PIN (no setup screen); Forgot PIN with a seeded rescue code resets and keeps progress |
| `apps/mobile/e2e/web/progress-reload.spec.ts` (existing) | e2e | regression: legacy profile in storage (no `learnerType`) loads, shows "Some reading", gate behaves as before |

## 6. Rollout

Ships behind no flag; the old flow cannot coexist with the new consent text. Order and risks in §7. After PR 4 merges, the onboarding events in §3.8 let us count `who_selected`, level mix and PIN-set rate. The legacy-device behaviour (L8) is unchanged, so existing testers are not locked out. Counsel review of §3.12 gates the **web** text PR, not the app PRs, but the app must not ship to the stores (Education category, App Review 2.3.8 / 5.1.4) before that review is done.

## 7. PR breakdown (small PRs, dependency order)

| PR | Content | Depends on |
|---|---|---|
| 1 | `feat(content-schema)`: `learner-level.ts`, `learnerType` on `ProfileSchema`, `LearnerLevelIdSchema` in `ProfileSchema` and `LearnerRegisterSchema`, telemetry names + tests. **Separate commit**: type-only replacement of the hand-written unions (§3.1). Wireframe copied to `design/wireframes/onboarding/all-ages-onboarding.md` | — |
| 2 | `feat(mobile)`: `logic/profiles/learner-type.ts`, `pin-reset.ts`, `audience-copy.ts`, `account-store` consent keys + migration, `profile-model` (`learnerType`, `updateProfile`), `profile-store.updateProfile`; all unit tests | 1 |
| 3 | `design(tokens)` + `feat(design-system)`: eight `hoya.fur*` tokens (`design/tokens/colors.v1.md` rows first, parity test), `hoyaVariantColors`, `Hoya` `variant` prop, preview row; `ProfileAvatar` and `AvatarChip` | 1 |
| 4a | `refactor(mobile)`: `PinPad` extraction from `PinEntryScreen` (no behaviour change; `layout.spec.ts` stays green) | — |
| 4b | `feat(mobile)`: `CreateProfileScreen` rewrite (who, name, level, avatar, grown-up/agreement cards, first-run PIN, links), onboarding telemetry, shared e2e onboarding helper and the six updated specs, `onboarding-*.spec.ts` | 2, 3, 4a |
| 5 | `feat(mobile)`: `ProfileAvatar` in the switcher, dashboard, Home entry, Results (delete `avatarTheme`); replace "Age X" (§3.7 mobile rows); neutral copy (§3.9); copy-guard test | 2, 3 |
| 6 | `feat(mobile)`: Forgot PIN (`PinResetScreen`, route, `PinEntry` link + `mode`), titles by audience, `pin.*` telemetry, e2e | 2, 4b |
| 7 | `feat(web)`: console roster `levelLabel` + `AvatarChip`, parent demo pages, design-preview samples, `mock-family` types; privacy and terms edits (§3.12) after counsel; docs and wireframe alignment | 1, 3 |
| 8 (can slip) | `feat(mobile)`: `EditProfile` screen (§3.11) | 2, 3, 5 |

**Cross-spec order**: PR 4b and F-I18N-001 PR 5 edit the same screens — PR 4b first. F-I18N-001 PR 4 (`KoreanText`) is not needed here. This spec adds no field to `ProfileSettings` (F-I18N-001 owns it).

## 8. Dependencies

- **Upstream**: F-PROF-001 (profiles, PIN), F-RESTORE-001 (Rescue Code stored locally), F-SYNC-001 (`LearnerRegister`), PR #95 (merged: Profile entry, `pin-pad-layout`), PR #97 (merged: names), PR #96 (merged: four-word Rescue Code), F-DES-001 (token structure; `tokens-parity.test.ts` from PR #95).
- **Coordination with F-I18N-001**: its PR 5 refactors the same first-run screens (Welcome, CreateProfile, Profile, PinEntry). The name rule already shipped (PR #97) and `ProfileSettings` stays F-I18N-001's (no field added here). Land F-LEARN-001 PR 4b first; F-I18N-001 PR 5 then only moves strings. New strings here are written once, in `LEARNER_LEVELS` and `audience-copy`, so the refactor is a move, not a rewrite.
- **Downstream**: F-I18N-001 (move `LEARNER_LEVELS` and `audience-copy` into catalogs), F-PLC-001 (first reader of the level), F-STORY-002 / F-STORY-003 ("Read to me" default by level order), F-LAYOUT-001 (keypad and sticky Continue), F-TCH-004.
- **External**: counsel review of the mixed-audience consent text (§3.12). Designer decision on the four tint values (§3.6).

## 9. Unverified assumptions (check while implementing)

1. ~~A profile-update route exists~~ — settled: none exists (§3.11); the change is local until a follow-up route ships.
2. ~~Leave-a-class is PIN-gated~~ — settled: it is not (§3.9).
3. ~~PR #95's `avatarTheme` and caption exist~~ — settled: merged as described in §1.
4. `Linking.openURL` is acceptable for the privacy link on the web PWA (it is used the same way in `PaywallScreen.tsx:35`).
5. App Store data-use answers do not need to change for two local-only fields and two onboarding payload keys (`docs/launch/app-store-submission.md` not re-read here).
6. ~~The owner confirms respelling `례이` as `예리` (L12)~~ — **confirmed by the owner 2026-10-10**.
7. Counsel accepts a plain "I'm 13 or older" attestation for the self path (§3.3 neutrality statement); this is an owner / legal decision (listed in `REVIEW-1.md`), and it gates the store release, not the code.
