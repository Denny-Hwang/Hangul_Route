# Learner app: MoveClass, ApproveTransfer, the read-only sheet, the Home line (design mock v1, for T-7c)

Wireframe: `design/wireframes/console/class-transfer.md` screens 5, 6, 7 · spec 4.11 (device rules), 4.12 (screens, Home), 4.2 guards 10, 11 · code: `navigation/types.ts` (`GrownUpDestination`), `screens/parent/PinEntryScreen.tsx` (`proceed()`), `logic/profiles/gate-route.ts` · mock: `mock/app-sheets.html` · shots: `shots/app-sheets-375.png`, `-1280.png`

## The gate

`GrownUpDestination` gains `MoveClass` and `ApproveTransfer`; `PinEntryScreen.proceed()` routes to them. The PIN screen itself is unchanged (drawn as a dashed "unchanged" box). A self-only device with no PIN opens them directly. The device route needs a PIN made at least a day ago (a PIN older than this feature counts as old enough) or a self-managed profile with its consent time.

## MoveClass (device route, learner-started only)

```
 <  Move to another class                         stack header, h1 takes focus
    Ask the new teacher for their class code.
    [      A B C 1 2 3      ]                     the join field (JoinSpaceScreen), label "Class code"
    6 letters or numbers — no O, I, 0 or 1
    ((        Find class        ))                hero button
 -> consent sheet (consent-sheet.md, app column):
    title "Move {Name} to {Destination}?" (self: "Move to {Destination}?")
    the canonical lines, list folded, identity block
    ((  Yes, move {Name}  ))   (self: "Yes, move me")
    (   Not now   )
 -> "Request sent. Nothing changes until everyone says yes."  (( Done ))
```

Errors under the field use the console words (`start-sheet.md`) and the cooldown "You can ask again in about a week."; offline shows "This needs internet. Try again when you are online." and disables Find class. Consent is never queued.

## ApproveTransfer

For a learner-started request whose learner consent was reset (terms changed, lapsed): "Please check this again." on top, then the consent sheet, **Yes, move {Name}** and **Not now** (the device decline lives only here and in the console).

## A teacher started it (read-only plus veto)

```
 <  A move is waiting
    Sunday Class A asked about moving Mina to Saturday Class B.
    A grown-up with an account answers this in the console.
    (   Not now   )                                 ends the request quietly; never "the family said no"
```

The server refuses device consent on a teacher-started request (`caregiver_required_for_teacher_request`), so the sheet has no Yes.

## Planned (cooling-off)

Title "A move is planned for {date}.", the `cooling_off` consent line as the body, **Cancel the move** and **Back**. Cancel lives only inside this gated sheet (and the console).

## Moved

When the inbox shows `executed`: "Moved. {Name} is now in {Destination}. Cards and stars stayed with {Name}." (`role="status"`), then the app refreshes the inbox and syncs so plans and access switch at once.

## Home line

One calm line under the Hoya tip, only when the learner side must answer or a move is planned; no number, no timer, no red:

| Case | Line | Button |
|---|---|---|
| teacher-started | "Sunday Class A asked about moving Mina to Saturday Class B." | Review (gated) → read-only sheet |
| guardian-started, waiting for this device (reset) | "A move to Saturday Class B is waiting." | Review (gated) → ApproveTransfer |
| self audience | "A move is waiting for you." | Review (direct) → sheet with "Yes, move me" |
| cooling-off | "A move is planned for Oct 14." | Cancel (gated) → planned sheet |

The line is a paper row (`radii.lg`, `shadows.card`, padding `spacing.md` `spacing.lg`); the button is a ghost `sm` with the gate mark when gated.

## Tokens

App screens use the design-system `Heading`, `Body`, `Caption`, `Button` (hero for Find class, primary for Yes, ghost for Not now, Cancel the move, Back) and the join field style of `JoinSpaceScreen` (`touchTarget.hero`, `size.display`, `spacing.sm` tracking). Notices `surface.sunken`; the done line `feedback.successLight`. Window classes in px (F-LAYOUT-001).

## Accessibility

Every screen's `h1` takes focus on open; the back control is a 64 px button named "Go back". All buttons are full width and at least 64 px tall; the hero is 96. At 375 with 200 % text every screen wraps without sideways scroll (measured).
