# F-PROF-001 — Device-Shared Profiles

**Status**: `ready` (promoted by T-023 — see §9 Decisions)
**Scope**: `apps/mobile` · `packages/content-schema` · MVP (learner × N + parent × 1, local only)
**Owner**: solo dev
**Rollout**: MVP — local profiles, PIN-protected parent, no cloud sync. Teacher / co-parent / Clerk sync are Phase 2.

Parent doc: `docs/blueprints/09-homework-review-profiles-addendum.md` §3.

---

## 1. Context

A single Hangul Route install must support multiple learners — typical home shares one tablet across 2–3 siblings, and Korean weekend schools share devices across cohorts. Without distinct profiles, Journey progress, the Heritage collection, and Hoya's growth state cross-contaminate, which would destroy the *personal pledge* contract from `02-core-feature-spec §5.2`.

F-PROF-001 is the foundation feature: F-HW-001, F-RVW-001, F-PAR-001, and F-TCH-001 all read `currentProfileId` from this module. It must land before any of them go to `ready`.

Key non-negotiables:
- Switching learner profiles takes **one tap** (no PIN, no friction — a 5-year-old does it).
- Switching *into* parent / teacher requires PIN (protects assignment / dashboard surfaces).
- No two profiles ever see each other's collection or stars on the learner home (no sibling comparison).

## 2. User story

> As a **parent of two**, I want each of my kids to pick their own tiger-shaped avatar on the home screen and see only their progress, so the older one doesn't crush the younger one's motivation by "winning".

Companion stories:

- As a **parent**, I want to switch to a parent view with a PIN so my kid can't accidentally assign themselves homework or read my dashboard.
- As a **learner**, I want my profile to remember where I left off in the Journey so I never have to "find my place".

## 3. Acceptance criteria

### 3.1 Profile picker (cold launch)

- **Given** the app launches and ≥ 1 profile exists,
  **when** the launch screen finishes,
  **then** the **Profile Picker** renders with all profiles as avatar tiles (≥ 96 × 96 dp each, max 8 visible, scroll if more).
- **Given** a learner profile tile is tapped,
  **when** the tap registers,
  **then** the home screen renders for that profile within ≤ 300 ms (no PIN, no loading screen — pre-warm on app launch).
- **Given** a parent profile tile is tapped,
  **when** the tap registers,
  **then** a **PIN entry** modal appears requiring 4 digits. After 5 wrong attempts within 60 s, cooldown 30 s before retry.

### 3.2 Profile creation

- **Given** an empty install (no profiles yet),
  **when** the app launches,
  **then** a one-time onboarding flow runs: parent creates **parent profile first** (name + PIN) → then adds 1+ learner profiles (name + avatar choice).
- **Given** a parent profile exists,
  **when** parent goes to "Add another child",
  **then** they can create additional learner profiles without re-entering PIN within the same session (15-min session window).
- Avatars: **5** preset Hoya variants (tiger cub), one per culture-theme Pillar — 글이 (Letters) · 살이 (Life) · 례이 (Rites) · 솔이 (Nature) · 솜이 (Crafts). These are illustrations, not learner names. Names: free text, 1–12 chars, no emojis, no Korean/Chinese (UI is English).

### 3.3 Data isolation

- **Given** profile A is active,
  **when** any screen reads progress / collection / homework / reviews,
  **then** the read is scoped to A's `profileId`. There is no global "current learner" except `currentProfileId`.
- Each persistence write — Journey, Library history, Companion state, ReviewAttempt, HomeworkAssignment — **must** carry `profileId` as part of the key. Lint covered by a unit test that scans `apps/mobile/src/logic/**/persist*.ts` for missing profile keys.
- **Given** a learner profile's home screen renders,
  **when** the screen builds,
  **then** **no other profile's stars / collection / streak appears anywhere in the tree** — no sibling avatars, no comparative copy. Detected by snapshot tests that fail if any rendered string matches `/sibling|brother|sister|other kid/i`.

### 3.4 Profile switch (during a session)

- **Given** a learner profile is active and a switch is requested,
  **when** the switch triggers,
  **then** the current screen state is persisted (Quest in progress is auto-paused, not lost) and the Profile Picker re-renders.
- Switch is reachable from the home screen via a small avatar-corner button (≥ 44 × 44 dp tap target). It is **not** reachable from within a Quest screen (prevents mid-game switching that loses state).

### 3.5 PIN management

- PIN is 4 digits. Stored as `<salt>:<digest>` — a per-PIN 16-byte salt from a native CSPRNG plus SHA-256 — in AsyncStorage under `parent.<profileId>.pin_hash`. The hash primitive is injected (`PinHasher`), so the choice is swappable without touching PIN logic. Rationale and the rejected bcrypt-cost-10 option are recorded in §9.2.
- PIN reset in MVP requires reinstalling the app (data wipe). Phase 2: Clerk email recovery.
- The PIN entry UI **never** echoes digits as text — shows ● dots only.

### 3.6 Accessibility / safety

- Profile Picker is reachable on cold launch only (locked screen pre-picker). Once a profile is active, deep-links and back-handlers can't bypass into a different profile's data.
- VoiceOver reads each tile as `"<name>'s tiger, stage <N>. Tap to enter."`.
- A "Sign out" button does not exist in MVP — switching profiles is the only mechanism (deletion requires Settings → Profile → Delete with PIN).

## 4. Out of scope

- **Cloud sync** of profiles across devices → Phase 2 with Clerk + D1.
- **Teacher** / **co-parent** roles → Phase 2 (F-TCH-001 will extend the role enum).
- **Biometric** unlock for parent (FaceID / TouchID) → Phase 2.
- **Profile photo upload** — MVP only allows preset avatars (privacy + COPPA simplicity).
- **Family link** across devices (parent's phone + kid's tablet) → Phase 3.
- **Account migration** / export / import — Phase 3.

## 5. UI sketch

Wireframes authored (T-025 — v1, low-fi):

- `design/wireframes/profiles/picker.md` — cold-launch profile picker
- `design/wireframes/profiles/create-parent.md` — parent onboarding (name + PIN)
- `design/wireframes/profiles/create-learner.md` — learner onboarding (name + avatar)
- `design/wireframes/profiles/pin-entry.md` — PIN modal
- `design/wireframes/profiles/switch-button.md` — corner switch on home

## 6. Tests

### Unit — `apps/mobile/src/logic/profiles/`

| File | Coverage focus |
|---|---|
| `logic/profiles/profile-model.ts` | CRUD reducers + name validation + `scopedKey` namespacing; profileId required on all writes |
| `logic/profiles/pin-hash.ts` | `PinHasher` port, hash round-trip, sliding-window cooldown after 5 wrong attempts |
| `logic/profiles/session.ts` | active profile lifecycle, 15-min parent session window, switch reachability |
| `logic/profiles/avatar-catalog.ts` | preset avatar catalog integrity |

Named `profile-model.ts` rather than `profile-store.ts` so it does not read as a
second zustand store — `src/store/profile-store.ts` is the persistence shell that
delegates to these reducers.

### Integration

- Create parent + 2 learners → profile picker shows 3 tiles → switch from learner A to learner B → A's Journey untouched, B's Journey loaded.
- Cold launch with no profiles → onboarding forces parent first, learner second.
- 5 wrong PIN attempts → 30 s cooldown → 6th attempt rejected until cooldown ends.

### Platform wrapper — `apps/mobile/src/platform/`

| File | Coverage focus |
|---|---|
| `platform/storage.ts` (AsyncStorage wrapper from `packages/hooks`) | mocked — W4 target 70 % |

### E2E (Detox, nightly)

- First launch → create parent (PIN 1234) → create learner "Suni" → home renders for Suni → tap switch → back to picker → tap parent → PIN modal → enter PIN → dashboard placeholder loads.

## 7. Rollout

- **MVP**: ships with this spec, local only.
- Feature flag: none — profiles are core; can't be flagged off.
- Migration: if v1.0 launched before F-PROF-001 lands, on first run after upgrade we wrap existing data under an implicit "Default" learner profile and prompt parent setup.

## 8. Dependencies

### Upstream

- **`apps/mobile/src/platform/storage.ts`** — the sanctioned AsyncStorage wrapper (see §9.1). No longer blocked on a `packages/hooks` package.
- **packages/content-schema** — needs `Profile`, `ProfileRole` types.

### Downstream — everything in the addendum

- **F-HW-001** reads `currentProfileId` to scope today's mission.
- **F-RVW-001** writes `ReviewAttempt` per profile.
- **F-PAR-001** reads `linked_learners` from the parent profile.
- **F-TCH-001** extends `ProfileRole` with `teacher`.

### External

- **expo-crypto** — native CSPRNG (`getRandomBytesAsync`) + `digestStringAsync(SHA-256)`. Same integration shape as the expo modules already wrapped in `src/platform/` (speech, haptics, sharing). `bcrypt-js` was evaluated and rejected — see §9.2.

---

## 9. Decisions (T-023 — draft → ready)

Three open items blocked promotion. All three are resolved here; each records
the residual risk it leaves behind.

### 9.1 AsyncStorage wrapper — `packages/hooks` is not required for MVP

CLAUDE.md §8 forbids direct `AsyncStorage` use and points at "`packages/hooks`
의 안전 훅 (별도 PR 예정)". That package never landed, but
`apps/mobile/src/platform/storage.ts` already **is** the single sanctioned
read/write surface, and as of T-022 (F-COV-003) it is unit-tested at 100 %
line coverage in the platform lane.

**Decision**: `platform/storage.ts` satisfies the §8 contract for
`apps/mobile`. `packages/hooks` is deferred until a *second* consumer needs
the same wrapper (realistically `apps/web` in Phase 2) — creating a new
workspace package today would add a one-line re-export package for no
consumer, against CLAUDE.md §2 (new packages need a proposal) and §10.1
(scope discipline).

**Residual risk**: none for MVP. When `packages/hooks` does land, the import
site is one module (`platform/storage.ts`), so the migration is mechanical.

### 9.2 PIN hashing — injected `PinHasher`, salted SHA-256 over bcrypt-js

The draft specified `bcrypt` cost 10 via `bcrypt-js`, pending a Hermes
compatibility review. That review could not be completed on-device in this
environment, so the design was changed to make the primitive swappable and
the pure logic verifiable without it.

**Why bcrypt-js was rejected as the default:**
1. **JS-thread cost.** `bcrypt-js` is pure JS; cost 10 runs on the order of
   hundreds of milliseconds to seconds under Hermes on mid-range Android,
   and it blocks the JS thread — i.e. a visible hang on every PIN entry, on
   the one screen a parent uses in a hurry.
2. **Entropy pitfall.** React Native has no `crypto.getRandomValues` by
   default; `bcrypt-js` silently degrades to `Math.random()` for salt
   generation unless a polyfill (`react-native-get-random-values`) is added.
   That failure mode is silent and easy to ship.
3. **The work factor buys little here.** A 4-digit PIN is a 10 000-value
   keyspace. An attacker holding the stored hash enumerates it regardless of
   the KDF — cost 10 turns milliseconds into minutes, not into infeasibility.
   The control that actually matters against the in-scope threat (a child
   poking at a shared tablet) is the attempt cooldown in §3.5, plus OS-level
   app sandboxing of AsyncStorage.

**Decision**: PIN logic depends on a `PinHasher` interface
(`hash` / `verify`), defined in `src/logic/profiles/pin-hash.ts` and fully
unit-tested against a deterministic fake. The shipped implementation lives in
the platform lane (`src/platform/crypto.ts`) and uses **expo-crypto**: a
16-byte salt from the native CSPRNG, `SHA-256(salt + pin)`, stored as
`<saltHex>:<digestHex>`. Fast, correctly seeded, no JS-thread stall.

**Residual risk**: the stored hash is *not* resistant to offline enumeration
by an attacker with filesystem access. This is accepted for a local-only,
device-scoped 4-digit PIN. **Revisit trigger**: Phase 2 cloud sync — the
moment a PIN hash leaves the device (Clerk / D1), re-evaluate with a native
argon2/bcrypt binding, since the threat model then includes a server-side
breach. Also still unverified on a physical device: `expo-crypto` behaviour
under Hermes is expected-good (native module, Expo SDK 52) but is covered by
mocks here, not by a device run — T-026's Detox pass is the checkpoint.

### 9.3 Avatar count — 5 presets, not 8

§3.2 asked for "8 preset variants" but then named only the five Pillars, and
`AvatarKindSchema` in `packages/content-schema` has exactly five members.

**Decision**: five avatars, one per culture-theme Pillar (Letters · Life ·
Rites · Nature · Crafts). This keeps the avatar set aligned with the
Heritage-Journey grid's culture axis instead of inventing three unanchored
variants. §3.2 updated.

**Residual risk**: on a shared weekend-school device more than five learners
must reuse avatars. Duplicates are explicitly allowed (see
`design/wireframes/profiles/create-learner.md` open questions) — restricting
them would invite comparison and conflict between children.
