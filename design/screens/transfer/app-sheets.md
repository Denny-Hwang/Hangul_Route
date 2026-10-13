# Learner app: MoveClass, ApproveTransfer, the read-only sheet, the Home line (design mock v1, for T-7c)

Wireframe: `design/wireframes/console/class-transfer.md` screens 5, 6, 7 · spec 4.11 (device rules), 4.12 (screens, Home), 4.2 guards 7, 10, 11 · code: `navigation/types.ts` (`GrownUpDestination`), `screens/parent/PinEntryScreen.tsx` (`proceed()`), `logic/profiles/gate-route.ts` · mock: `mock/app-sheets.html` · shots: `shots/app-sheets-375.png`, `-1280.png`

## The gate

`GrownUpDestination` gains `MoveClass` and `ApproveTransfer`; `PinEntryScreen.proceed()` routes to them. The PIN screen itself is unchanged (drawn as a dashed "unchanged" box). A self-only device with no PIN opens them directly. The device route needs a PIN made at least a day ago (a PIN older than this feature counts as old enough) or a self-managed profile with its consent time. The read-only sheet sits behind the same gate (its veto is an answer too). On a managed device with no PIN the gate starts the existing PIN setup first (`initialPinMode` `setup-1`, `pin-flow.ts`), then continues to the destination; for the read-only sheet that PIN guards only the veto, never a yes (D24, `classes-card.md`). An inbox value this app does not know reads as route `none`, learner-side wording and no age (`classes-card.md`, Unknown values).

## MoveClass (device route, learner-started only)

```
 <  Move to another class                         stack header, h1 takes focus
    Ask the new teacher for their class code.
    [      A B C 1 2 3      ]                     the join field (JoinSpaceScreen), label "Class code"
    6 letters or numbers — no O, I, 0 or 1
    ((        Find class        ))                hero button
 -> consent sheet (consent-sheet.md, app column):
    title "Move {Name} to {Destination}?" (self: "Move to {Destination}?")
    Language [ English v ]
    the canonical lines, list open, identity block from the device preview
    ((  Yes, move {Name}  ))   (self: "Yes, move me")    waits until the last line has been in view (D2)
    (   Not now   )
 -> "Request sent. Nothing changes until everyone says yes."  (( Done ))
```

Answers under the field (one at a time, `role="alert"`, the field `aria-invalid`), in the console words of `start-sheet.md` where they apply, plus:

| Answer | Line |
|---|---|
| `429 cooldown` | "You can ask again in about a week." |
| `409 caregiver_required` (a family account appeared since the inbox was read) | "Ask the grown-up with the account to start this move in the console." |
| `422 device_consent_locked` | "Moves can't be started on this device yet." |
| `409 already_open`, started by a class | "A class already asked about moving {Name}. Look on the Classes & family card." |
| `409 already_open`, started by the learner side | "A move for {Name} is already waiting. Look on the Classes & family card." |
| `409 same_space` | "That code is for the class {Name} is in now." |
| `422 not_transferable` | "That code can't be used for a move." |
| `409 destination_busy` | "That class has many moves waiting. Try again in a few days." |
| `429 too_many_requests` | "Too many moves were started today. Try again tomorrow." |
| `422 consent_locale_unavailable` at create | "Not available in your language yet." (the sheet's notice) |
| offline | "This needs internet. Try again when you are online." and Find class disabled |

Consent is never queued.

## ApproveTransfer (route `device` only)

For a learner-started request whose learner consent was reset (terms changed, lapsed): "Please check this again." on top, then the consent sheet, **Yes, move {Name}** (self: **Yes, move me**) and **Not now** (the device decline lives only here and in the read-only sheet). On routes `caregiver` and `none` the device cannot say yes, so a reset request opens the read-only sheet instead (below).

## The read-only sheet (the veto, guard 11)

Title "A move is waiting". It states the request, says where the yes happens when it does not happen here, and offers only the veto and **Back**. The server refuses device consent on a teacher-started request (`caregiver_required_for_teacher_request`), so the sheet never has a Yes.

| Request (inbox `initiator`, state, `learnerRoute`) | Body | Veto |
|---|---|---|
| `source`, learner slot waiting, `caregiver` | "{Source} asked about moving {Name} to {Destination}." · "A grown-up with an account answers this in the console." | **Not now** (device decline), with "Not now ends this request." as its description |
| `source`, learner slot consented, a class still waiting (any route) | the same first line · "Waiting for the other class to answer." (both classes: "Waiting for the classes to answer.") | **Not now** |
| `source`, learner slot waiting, `none` | the same first line · "This move can't be answered here." | **Not now** |
| `learner_side`, waiting for the classes (any route) | "Asked: a move to {Destination}." · "Waiting for the classes to answer." (one class left: "Waiting for the other class to answer.") | **Cancel the request** (device cancel, `withdrawn_learner`) |
| approved, waiting for room (any route) | "Asked: a move to {Destination}." · the room block "Waiting for room in the new class." | **Cancel the request** |
| `learner_side`, consent reset, `caregiver` | "Asked: a move to {Destination}. Please check this again." · "A grown-up with an account answers this in the console." | **Cancel the request** |
| `learner_side`, consent reset, `none` | the same first line · "This move can't be answered here." | **Cancel the request** |

The inbox carries `initiator` as `source` or `learner_side` only, so the copy never says which grown-up or device started a learner-side move. A veto never says "the family said no" to anyone.

**Identity facts on inbox-fed sheets.** `InboxTransferSchema.to` has `ownerName`, `schoolName` and `ageBucket` but no `learnerCount`. MoveClass reads the device preview, which has the count; `ApproveTransfer` reads the inbox and draws the identity block without the count. To show it, T-7a needs an additive, lenient `to.learnerCount` in `InboxTransferSchema` and the Worker inbox, shipped Worker first (T-5c follow-up); until then the line is the age bucket alone.

## Planned (cooling-off)

Title "A move is planned for {date}.", the `cooling_off` consent line as the body, **Cancel the move** and **Back**. Cancel lives only inside this gated sheet (and the console).

## Moved

When the inbox shows `executed`: "Moved. {Name} is now in {Destination}. Cards and stars stayed with {Name}." (`role="status"`, a one-off), then the app refreshes the inbox and syncs so plans and access switch at once.

## Home line

One calm line under the Hoya tip, only when the learner side must answer or a move is planned; no number, no timer, no red. Waiting for the classes and waiting for room show no Home line (nothing for this device to answer); they stay on the Classes card.

| Case | Line | Button and target |
|---|---|---|
| teacher-started, learner slot waiting (any route) | "Sunday Class A asked about moving Mina to Saturday Class B." | **Review** (gated) → the read-only sheet |
| learner-side, consent reset, route `device`, managed | "A move to Saturday Class B is waiting." | **Review** (gated) → `ApproveTransfer` |
| learner-side, consent reset, route `device`, self audience | "A move is waiting for you." | **Review** (direct on a self-only device with no PIN) → `ApproveTransfer` with "Yes, move me" |
| learner-side, consent reset, route `caregiver` or `none` | "A move to Saturday Class B is waiting." | **Review** (gated) → the read-only sheet (its only action is the veto) |
| cooling-off | "A move is planned for Oct 14." | **Cancel** (gated) → the planned sheet |

The self-audience line opens the sheet instead of carrying "Yes, move me" on Home itself, so the consent lines are always shown before a yes (spec 4.12, amended).

The line is a paper row (`radii.lg`, `shadows.card`, padding `spacing.md` `spacing.lg`); the button is a ghost `sm` with the gate mark when gated.

## Tokens

App screens use the design-system `Heading`, `Body`, `Caption`, `Button` (hero for Find class, primary for Yes, ghost for Not now, Cancel the request, Cancel the move, Back) and the join field style of `JoinSpaceScreen` (`touchTarget.hero`, `size.display`, `spacing.sm` tracking). Notices `surface.sunken`; the done line `feedback.successLight`; the waiting primary `surface.sunken` with `text.muted` (5.07:1); the language switch the select pill of the console (64 px). Window classes in px (F-LAYOUT-001).

## Accessibility

Every screen's `h1` takes focus on open; the back control is a 64 px button named "Go back". All buttons are full width and at least 64 px tall; the hero is 96. A waiting **Yes** is `aria-disabled` (still focusable) with "Read to the end to continue." as its description. At 375 with 200 % text every screen wraps without sideways scroll (measured).
