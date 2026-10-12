# Parent/Grown-up-home-card — from the in-app dashboard to the grown-up home (wireframe v1)

Spec: `docs/specs/F-APP-001-persona-app-shell.md` §3.6, §3.9 (`openGrownUpArea`) · amends `parent/dashboard.md` (a card at the top; the local dashboard below is unchanged)
Audience: **parent or caregiver** (behind the PIN gate already)
Component target: `apps/mobile/src/screens/parent/ParentDashboardScreen.tsx` (A-7), web only, behind `flags.grownUpHomeEnabled`

## Scenario (Given-When-Then)

Given: a parent passed the grown-up PIN on the family tablet and is on the in-app dashboard
When: they want reports, messages or billing for their account
Then: one card at the top opens the grown-up home in the same tab, without asking for the PIN again

## Screen goal

"Open the grown-up home." (the rest of the dashboard keeps its own goal)

## Box diagram

```
+-----------------------------------+
| [< back]   Grown-up dashboard     |
|-----------------------------------|
|  +-----------------------------+  |
|  | Grown-up home (title)       |  |
|  | 1 line: reports, messages,  |  |
|  | billing for your account    |  |
|  |               [[ OPEN ]]    |  |  -> shell/signin (router) via openGrownUpArea
|  +-----------------------------+  |
|                                   |
|  [ existing local learner cards ] |  <- unchanged (F-PAR-001), works offline
|                                   |
+-----------------------------------+
```

- Native builds and flag off: no card (today's screen).

## Interaction points

- [[ OPEN ]] → `openGrownUpArea({ via: 'dashboard' })`: writes the grown-up unlock, emits `shell.grown_up_handoff { via: 'dashboard', target: 'router' }`, navigates the tab to `/signin` (signed in → persona home; signed out → Clerk widget), with `?lang=` when the UI locale is not English
- [< back] → `profile/settings` (unchanged)

## Navigation graph

Enter from: `profile/settings` grown-up zone → `profiles/pin-entry` → this screen
Exit to:    `shell/signin` → `shell/parent-home` / `shell/teacher-home` · `profile/settings`

## States

- **success**: card as drawn.
- **empty**: not applicable (the card has no data).
- **error**: offline → the navigation lands on `shell/offline` (Back to learning returns to the app).

## Data needs

- reads: `flags.grownUpHomeEnabled`, `Platform.OS`, UI locale
- writes: `sessionStorage` `hr:grownup:unlock` (through `platform/grown-up-handoff.web.ts`); telemetry queue

## Open questions

- Should the card also appear on a self-only device (adult learner, no PIN)? Default yes: the gate opens directly there (`gateOpensDirectly`), and the grown-up home is where their account lives.
