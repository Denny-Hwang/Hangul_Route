# Onboarding/Welcome — value-first landing, no account (wireframe v1)

Spec: `docs/specs/F-PROF-001-device-profiles.md` §3.2 (first run creates the parent profile first) · `docs/blueprints/10-app-map.md` §3.1, §4.1
Audience: **learner (P4/P5 child, 5–11)** primary · parent secondary (an adult usually holds the device at this moment)
Code (back-filled): `apps/mobile/src/screens/onboarding/WelcomeScreen.tsx` — route `Onboarding/Welcome`

## Scenario (Given-When-Then)

Given: the app cold-launches on a device with zero profiles (`RootNavigator` picks `Onboarding` when `profiles.length === 0`)
When: the first screen renders
Then: in one glance the child meets Hoya and the adult sees one big button; no account, email or store page stands between them and the first quest

## Screen goal

"Get from cold launch to profile creation in one tap — value first, account never (on this screen)."

## Box diagram

```
+----------------------------------+
|                                  |
|          [HOYA waving]           |  <- guide character, large, centered
|                                  |
|   "Hi! I'm Hoya." (placeholder)  |  <- 1 short display line
|   2-line invitation (what +      |  <- "a few minutes a day" tone,
|   how long), placeholder         |     never longer than 2 lines
|                                  |
|                                  |
|   [[ LET'S START ]]              |  <- primary CTA -> profiles/create-parent
|                                  |
|   [ I already have progress ]    |  <- secondary text-style -> sync/restore (FUTURE)
|                                  |
|   1 muted trust line             |  <- "made for kids 5-11" placeholder
+----------------------------------+
```

- No back control and no top bar: this is the first screen of the app.
- The secondary link slot is reserved *below* the primary so the primary never
  moves when the restore flow lands.

## Interaction points

- [[ LET'S START ]] → `profiles/create-parent` (code: `CreateProfile { firstRun: true }`)
- [ I already have progress ] → `sync/restore` — **future exit (P, roadmap §5)**; not in shipped code. Then `profiles/picker`, or `sync/merge-notice` when local progress also exists (app-map §4.2).
- Hoya tap: no-op in MVP (single waving pose, F-HOYA-001)

## Navigation graph

Enter from: cold launch (profiles == 0). Note: `profile/settings` "+ Add a profile" re-enters the Onboarding stack at `profiles/create-learner`, not here.
Exit to:    `profiles/create-parent` · `sync/restore` (future)

## States

- **success**: as drawn.
- **empty**: this screen *is* the app's empty state — nothing loads, no spinner.
- **error** (profile store fails to hydrate): still render; first run must never block on storage. The root navigator waits on `hydrated` so a device that *does* have profiles is not shown Welcome by mistake.

## Data needs

- reads: `useProfileStore.hydrated`, `profiles.length` (read by the root navigator, not the screen)
- writes: none
- telemetry: none in code today; candidate `onboarding.welcome_viewed` as the funnel top (one fire-and-forget event, no PII)

## Open questions

- Restore entry: plain text link vs. a small "Grown-ups: restore" row. A child should not hit it by accident, but an adult reinstalling must find it in under 5 s (beta with parents).
- Should Hoya speak the invitation aloud on mount for pre-readers (P4, 5–7), or only on tap? Autoplay audio on first launch risks store-review friction; default tap.
- App-map §3.1 sets the goal "first quest within 30 s, no account", yet the shipped flow puts parent-PIN creation *before* the first quest. Keep, or move PIN creation after `results/celebrate` ("account later", blueprint 01)? Decide before the mid-fi pass.
