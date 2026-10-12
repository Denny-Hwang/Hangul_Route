# Parent/Grown-up-home-card — from the learner app to the grown-up home: the Profile row and the dashboard card (wireframe v2)

Spec: `docs/specs/F-APP-001-persona-app-shell.md` §3.6, §3.9 (`openGrownUpArea`, fresh-PIN rule), §3.10 · amends `profile/settings` (grown-up zone, first row) and `parent/dashboard.md` (a card at the top; the local dashboard below is unchanged)
Audience: **parent or caregiver, teacher** on a device that already has learner profiles (so Welcome never shows)
Component target: `apps/mobile/src/screens/profile/ProfileScreen.tsx` and `apps/mobile/src/screens/parent/ParentDashboardScreen.tsx` (A-7), web only, behind `flags.grownUpHomeEnabled`

## Scenario (Given-When-Then)

Given: a family tablet where the children already learn, and a parent who wants their family home (reports, notes, billing)
When: they open Profile and look at the grown-up zone
Then: the first row says "Grown-up home"; one PIN entry later they are in, with no stop at the local dashboard; a parent already on the dashboard finds the same entry as a card at the top

## Screen goal

"Open the grown-up home." (the rest of Profile and of the dashboard keep their own goals)

## Box diagram

Panel A — Profile, grown-up zone (first row)

```
+-----------------------------------+
| Profile                           |
|  [ learner card, switch ... ]     |  <- unchanged
|-----------------------------------|
|  Grown-up zone                    |
|  +-----------------------------+  |
|  | Grown-up home            >  |  |  <- NEW first row
|  | Your family, classes and    |  |
|  | billing                     |  |
|  +-----------------------------+  |
|  | Grown-up dashboard       >  |  |  <- existing rows below, unchanged order
|  | ...                         |  |
+-----------------------------------+
```

Panel B — dashboard card (behind the gate already)

```
+-----------------------------------+
| [< back]   Grown-up dashboard     |
|-----------------------------------|
|  +-----------------------------+  |
|  | Grown-up home (title)       |  |
|  | Your family, classes and    |  |
|  | billing.                    |  |
|  |               [[ OPEN ]]    |  |  -> openGrownUpArea({ via: 'dashboard' })
|  +-----------------------------+  |
|                                   |
|  [ existing local learner cards ] |  <- unchanged (F-PAR-001), works offline
+-----------------------------------+
```

Panel C — offline (either entry)

```
|  | Grown-up home               |  |  <- disabled, label kept
|  | Needs the internet          |  |
```

Panel D — the PIN screen for `GrownUpArea` on a device with no PIN stored

```
|  "This device has no grown-up PIN. Sign in on the grown-up page instead."
|  [[ CONTINUE ]]                   |  -> /signin (no unlock written); never a "create a PIN" step
```

- Native builds and flag off: no row and no card (today's screens).
- The line names only what exists today; it never promises reports or notes (the learner app cannot see the console's feature flags).

## Interaction points

- Grown-up home row (Panel A) → `openGrownUpArea({ via: 'profile' })`:
  - self-only device without a PIN → straight to `shell/signin` (router → home)
  - device with a PIN → `profiles/pin-entry` in verify mode (destination `GrownUpArea`, no Forgot PIN) unless a PIN was entered in the last 2 minutes → writes the unlock, emits `shell.grown_up_handoff { via: 'profile', target: 'router' }`, opens `shell/signin` (signed in → persona home; signed out → Clerk), with `?lang=` when the UI locale is not English
  - family device without a PIN → Panel D
- [[ OPEN ]] (Panel B) → the same, `via: 'dashboard'`; a parent who just entered the PIN to open the dashboard is not asked again; after 2 minutes they are
- [< back] → `profile/settings` (unchanged)

## Navigation graph

Enter from: `profile/settings` (Panel A) · `profile/settings` grown-up zone → `profiles/pin-entry` → dashboard (Panel B)
Exit to:    `profiles/pin-entry` (verify) · `shell/signin` → `shell/parent-home` / `shell/teacher-home` · `profile/settings`

## States

- **success**: row and card as drawn.
- **empty**: not applicable (no data).
- **error**: offline → Panel C (disabled); a navigation that still happens offline lands on `shell/offline` (Back to learning returns to the app). No PIN on a family device → Panel D.

## Data needs

- reads: `flags.grownUpHomeEnabled`, `Platform.OS`, UI locale, `navigator.onLine`, device marker inputs (profiles, PIN hash), `ui-store.lastPinVerifiedAt` (memory)
- writes: `sessionStorage` `hr:grownup:unlock` (`src: 'pin'`, PIN epoch; through `platform/grown-up-handoff.web.ts`); telemetry queue

## Open questions

- Should the row also appear on a self-only device (adult learner, no PIN)? Default yes: the gate opens directly there (`gateOpensDirectly`), and the grown-up home is where their account lives.
