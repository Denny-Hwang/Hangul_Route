# Shell/Screen-header — one top-left Back on every non-root screen: the learner ScreenHeader, the console PageBack, the Learner app exit on the right (wireframe v1)

Spec: `docs/specs/AMENDMENTS-DISPLAY-NAV.md` section 7 (rows DN-4 learner and All lessons, DN-6 console) · amends `shell/adult-frame.md` (the way to the learner app moves right) and every learner screen's own back control
Audience: **everyone** (learner screens), **grown-ups** (console pages)
Mock: `design/components/ScreenHeader/` (learner), `design/screens/app-shell/adult-frame.md` revision 2026-10-16 (console)

## Scenario (Given-When-Then)

Given: someone deep in a screen (a vocab topic, a story's sources, the plan page of a class)
When: they want to go back one step
Then: a **Back** sits top-left in the same place on every screen and width, and the phone's or browser's back does the same thing; nothing that leaves the app ever sits there

## Screen goal

"Go back one step." (it is a frame part, not a screen)

## Box diagram

Panel A — learner `ScreenHeader`, `back` variant (stack screens), 320 wide

```
+--------------------------------+
| [< Back]   Topic: Food  ( Aa ) |  <- leading: arrow + "Back"; title h1 (may wrap); trailing: Aa
+--------------------------------+
|        [ screen content ]      |
```

Panel B — `close` variant (modals and flows that ask before leaving: quest, minigame, placement items, Stage review, story reader)

```
+--------------------------------+
| [x Close]  ····o···   ( Aa )   |  <- the flow's own middle part (progress) stays
+--------------------------------+
   [x Close] in a quest → the leave sheet (ConfirmSheet) as today
```

Panel C — console `PageBack` and the Learner app exit, phone (375) and wide (1280)

```
375:
+-----------------------------------+
| (HR) Teacher     ( Aa ) [Learner app >] |  <- exit at the RIGHT end of the header row
| Classes | Lessons | Lecture mode | Billing |
|-----------------------------------|
| [< Back to Class 2B]              |  <- PageBack: top-left of the content, above the h1
| Plan the week (h1)                |
|        [ page content ]           |

1280:
+---------------------------------------------------------------------------------------+
| (HR) Hangul Route  ( Family | Teacher )                 ( Aa )  Sign out  [Learner app >] |
|   Home   Reports   Notes   Lessons   Lecture mode   Billing                           |
|---------------------------------------------------------------------------------------|
|   [< Back to Class 2B]                                                                |
|   Plan the week (h1)                                                                  |
```

Panel D — a root screen: no leading control (Home, Route, Journey, Library, Welcome, All lessons home, a console persona home)

```
+--------------------------------+
| (Hoya) Hi, Mina!  ( Aa )(Profile)|
+--------------------------------+
```

## Interaction points

- [< Back] → `goBack()` through the screen's `beforeRemove` guard (a form with input asks first with ConfirmSheet); the browser and phone back do the same (web history bridge).
- [x Close] → as Back, for a modal or a flow; a quest asks before leaving (unchanged).
- ( Aa ) → `shell/display-sheet.md`.
- Console [< Back to …] → the page above it (space page → persona home with "Back to Classes" / "Back to Home"; plan, settings, lecture → the space; receipts → Billing).
- Console [Learner app >] → clears the grown-up unlock and console session, opens the learner app with `?lang=` (unchanged action, new place and label).

## Navigation graph

Enter from: every non-root screen renders it
Exit to: the previous screen in the stack (learner), the parent page (console), the learner app (the exit)

## States

- **success**: Panels A to D.
- **exception**: PlacementInvite (end of first-run setup) has no Back; its Take the level check and Not now are the ways on.
- **no history** (a console page opened in a new tab): PageBack still goes to the parent page (it is a link, not `history.back()`).
- **a session clock running**: ( Aa ) hidden (`shell/display-sheet.md` States); Back / Close stay.
- **200 % or Largest text at 320**: the title wraps to two lines; Back and Aa keep their 64 px targets; nothing scrolls sideways.

## Data needs

- Learner: the navigator's state (can go back), the screen's variant from `SCREEN_HEADER_VARIANTS`, the history bridge's depth.
- Console: the page's parent (`SPACE_PAGES`, the space kind for the persona home's label).

## Open questions

- None blocking.
