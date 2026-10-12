# Onboarding/Welcome-personas — learners start in one tap, grown-ups find their sign-in (wireframe v2)

Spec: `docs/specs/F-APP-001-persona-app-shell.md` §3.6, §3.20 behaviours 1-2 · amends `onboarding/welcome.md` (the screen above the language row is unchanged)
Audience: **anyone, any age** (shared surface) — the learner, or a parent, caregiver or teacher who opened the app. No age wording, never "for kids".
Code target: `apps/mobile/src/screens/onboarding/WelcomeScreen.tsx` (A-7), web only, behind `flags.grownUpHomeEnabled`

## Scenario (Given-When-Then)

Given: app.hangulroute.com opens on a browser with no learner profile (so Welcome is the first screen)
When: the visitor is a learner, or a grown-up who came to manage a family or a class
Then: the learner sees one big "start" action exactly where it always was; the grown-up sees a small, clearly worded way to their sign-in without reading anything else

## Screen goal

"Start learning in one tap; a grown-up reaches the right sign-in in one tap." (primary: start; secondary: persona row)

## Box diagram

Panel A — first visit (no last persona on this browser)

```
+----------------------------------+
|                                  |
|          [HOYA waving]           |
|   short greeting (placeholder)   |
|   2-line invitation              |
|                                  |
|   [[ LET'S START ]]              |  <- primary, unchanged size and position
|   [ I already have progress ]    |  <- unchanged -> sync/restore
|                                  |
|   ------------------------------ |  <- thin divider
|   "Here to support a learner?"   |  <- one short line (placeholder)
|   [ Parent or caregiver ] [ Teacher ]  <- two equal secondary buttons (sign-in only)
|                                  |
|   [language chips]  (if >1 locale shipped)
|   1 muted trust line             |
+----------------------------------+
```

Panel B — returning grown-up (this browser remembers persona = teacher)

```
|   [[ LET'S START ]]              |
|   [ I already have progress ]    |
|   ------------------------------ |
|   [ Continue as teacher ]        |  <- one secondary button ("Continue as family" for the family persona)
|   ( Someone else )               |  <- small text link -> shows Panel A row
```

Panel C — offline

```
|   "Here to support a learner?"   |
|   [ Parent or caregiver ] [ Teacher ]   <- disabled (keep their labels)
|   "Needs the internet"           |  <- one inline line; buttons re-enable when back online
```

Panel D — native iOS / Android build, or flag off: today's `onboarding/welcome.md` (no divider, no row).

- The row never pushes "LET'S START" down on a phone at 320 wide: the row sits below the restore link; on short screens the screen scrolls, the primary stays in the first view.
- Two buttons side by side when they fit, stacked otherwise; both meet the touch-target token.

## Interaction points

- [[ LET'S START ]] → `profiles/create-learner` flow as today; telemetry `shell.persona_chosen { persona: 'learner', from: 'welcome' }`
- [ Parent or caregiver ] → (same tab) `shell/signin` with `?persona=parent` (sign-in only; creating an account is behind the adult step there); `shell.persona_chosen { persona: 'parent', from: 'welcome' }`
- [ Teacher ] → `shell/signin` with `?persona=teacher`; `{ persona: 'teacher', from: 'welcome' }`
- [ Continue as teacher ] → `shell/signin` (no hint; the router sends a signed-in grown-up home); `{ persona: 'teacher', from: 'welcome-continue' }`
- ( Someone else ) → replaces Panel B's button with Panel A's row (no navigation)
- [ I already have progress ] → `sync/restore` (unchanged)

## Navigation graph

Enter from: cold launch with no learner profile · `shell/adult-frame` "Open the learner app" on a browser without profiles · `shell/offline` "Back to learning"
Exit to:    `profiles/create-learner` · `sync/restore` · `shell/signin`

## States

- **success**: Panels A / B as drawn.
- **empty**: no last persona → Panel A (the normal first visit).
- **error**: the last-persona entry is unreadable or invalid → treated as absent (Panel A). Offline: Panel C (no navigation to a page that cannot load).

## Data needs

- reads: `flags.grownUpHomeEnabled`; `Platform.OS === 'web'`; `navigator.onLine` and the `online` / `offline` events; shell store (`hr-shell` / `kv`) `lastPersona` (`LastPersonaSchema`, persona code only, read-only through `platform/shell-store.web.ts`)
- writes: nothing (telemetry queue only)

## Open questions

- Line wording "Here to support a learner?" is a draft; the dictionary owns the final copy (es / ko via the overlay process). Default: the draft.
- The trust line (`learner.welcome.trust`) still says "kids"; flagged for the copy owner in F-APP-001 §9, not changed by this screen.
