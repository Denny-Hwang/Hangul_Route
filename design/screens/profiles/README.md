# Profiles: "Who is using this?", grown-up PIN v2, People on this device, Who is joining?, and the console side (design mocks v1, OA-0b)

Spec: `docs/specs/AMENDMENTS-ONE-ACCOUNT-MANY-USERS.md` (sections 5.3, 6, 7.2 to 7.6, 8.3 to 8.6, 10.3, 10.4, 12, 14, 17). This is design row **OA-0b**: the agent design pass that CLAUDE.md section 5 requires before a component is built (no component without a mock, no mock without a wireframe), approved by multi-agent review on the owner decision of 2026-10-12 (F-SPACE-002 T-0b precedent, #472; AMENDMENTS-SEATS-ADMINS SA-0b, #753).
Wireframes: `design/wireframes/profiles/who-is-using.md`, `pin-entry-v2.md`, `people-on-device.md` (OA-0), and `console-pin.md` (new in this pass: the console pieces had no wireframe). `profiles/picker.md` is superseded.
Built by:
- **OA-4a / OA-4b / OA-5**: the chooser, its tiles and rows, the Home Switch button → `who-is-using.md`, components `design/components/WhoTile/`, `design/components/GrownUpRow/`.
- **OA-2 / OA-6 / OA-9**: the PIN screen's pauses, help line, face or fingerprint, the sign-in reset option, the new-PIN title, the expired line, the reset-by-wait notice → `pin-entry-v2.md`.
- **OA-5 / OA-7a / OA-9**: People on this device, the lock and face or fingerprint switches, Remove → `people-on-device.md`, and the ConfirmSheet addendum in `design/components/ConfirmSheet/spec.md`.
- **OA-7b**: Who is joining? → `who-is-joining.md`.
- **OA-3 / OA-6**: the lock's Use a passkey, `/account/pin-reset`, the set-a-PIN card, the PIN-owner card → `console-pin.md`.

## What is here

| File | What it fixes |
|---|---|
| `who-is-using.md` | the chooser on phone and tablet, the classroom grid, every state of sections 6.1 and 6.2, tints, locks, the Home Switch button, Largest text |
| `pin-entry-v2.md` | pause steps in seconds and minutes, the help line (Grown-up area only), face or fingerprint, the enrolment-changed line, the reset choice with Sign in to the account, Choose a new grown-up PIN, the expired line, the reset-by-wait notice, Cancel the wait |
| `people-on-device.md` | the Grown-up area's new top, one person, the lock switch and hint, the face or fingerprint switch and warning, Remove in its checking, saved, unsaved and Remove anyway states |
| `who-is-joining.md` | the checklist, the locked and class-only rows, offline, the results with the cap line, the network stop with Try again, the name step and the consent step |
| `console-pin.md` | GrownUpLock with Use a passkey, the five `/account/pin-reset` states, the set-a-PIN card, the PIN-owner card |
| `mock/profiles.css` | the sheet of this pass, linked after `../../app-shell/mock/app-shell.css` (tokens, board) and `../../app-shell/mock/display-nav.css` (text size, ScreenHeader, Display control, ConfirmSheet) |
| `mock/who-is-using.html` | boards 1 to 15 |
| `mock/who-is-using-largest.html` | board 16, the whole page at the Largest text size (`html.ts-largest`) |
| `mock/pin-entry-v2.html` | boards 1 to 12 |
| `mock/people-on-device.html` | boards 1 to 9 |
| `mock/who-is-joining.html` | boards 1 to 8 |
| `mock/console-pin.html` | boards 1 to 12 |
| `mock/lengths.html` | the es and ko overflow check: every key of the length table, the long bodies and the tightest stacks in en, es and ko side by side (rows 1 to 12) |
| `shots/` | each mock in Chromium at 320 and 1280, and at 320 with the browser text size at 200 % (`-320-text200`), full page, 1x |

**The mocks are a design reference, not shipped code.** Learner screens are react-native drawn as HTML in rem, so the browser text size and the Display sheet's text size both reach them; the console pages use the GrownUpLock card of `design/screens/app-shell/`.

- **Tokens.** Every value is a token of `packages/design-system/src/tokens.ts` as a custom property named after it (`--colors-theme-letters` is `colors.theme.letters`). `profiles.css` copies the eleven tokens the app-shell sheets do not carry (`colors.theme.*`, `colors.hoya.furBlue`, `furGreen`, `furPurple`, `furPink`, `colors.feedback.danger`, `radii.xl`) and redefines none. Every `var()` resolves in Chromium. No colour literal in the HTML, no emoji, no motion. No new token and no new glyph: the lock, plus, profile-pair (`parent`), chevrons (`arrow-left` is also the PinPad's delete key), close and check are the shipped Icon glyphs.
- **Words.** Every drawn English string, and every accessible name, is a dictionary value of `packages/i18n` or a row of the amendment's section 17, word for word. The rows that were missing are added to sections 17.2 and 17.4 by this pass (below). A caption or hint is a separate string set as the description, never joined into a name. The es and ko values on `lengths.html` are the section 17 drafts. The mocks were made by a throw-away generator that is not committed (as for the reports, billing, browse and console mocks).
- **Annotations.** Grey monospace labels and dashed boxes are board notes, not UI. A dashed box stands for an unchanged part of a screen.
- **Fixture.** Wed Oct 21, 2026, a family tablet: Mina and Jun (both the orange cub), Sora (the grown-up's own profile, blue cub, locked), Leo (class-scoped on this device, green cub; a tile on the chooser and a row in People on this device, disabled on Who is joining?). The account holds a family and a class. The classroom board has 26 learners. Names are examples.

## Constants

| Where | Value | Derived from |
|---|---|---|
| Tile minimum width (`WHO_TILE_MIN`) | 8rem | two columns fit a 320 window at Standard (2 x 128 + 12 = 268 of 288); in rem, so the Largest text size (1.5) drops a 360 phone to one column before a name truncates (spec section 14) |
| Tile minimum width from `layout.breakpoint.wide` | 10rem | six tiles in a row at `layout.maxWidth.full` (wireframe Panel B) |
| Avatar on a tile / a row / the Home ring | 72 / 40 / 52 | `ProfileAvatar` sizes "Profile switcher card", "Grown-up dashboard card", "Home Profile entry" (`design/components/ProfileAvatar/spec.md`) |
| Lock badge | 32 (`spacing.xxl`) | holds the 20 lock glyph with a `borderWidth.base` ring |
| PIN key | 80 (`touchTarget.child`) | `PinEntryScreen` `pinKeyMax` base on a phone (unchanged) |
| Drawn switch track | 52 x 32 | design board only; the app uses the platform `Switch`, whose row is the touch target |
| Board phone / tablet frames, sheet backdrop height | 360 / 1180 / 26rem | design board only, not UI |

## New strings

Added to `docs/specs/AMENDMENTS-ONE-ACCOUNT-MANY-USERS.md` sections 17.2 and 17.4 by this pass, with es and ko drafts written to the F-I18N-001 section 3.10 style guide; OA-7b (the 17.4 rows) and OA-5 (`lockedRow`) land them with the other rows, and their fix-stage reviews may still improve the drafts. No `packages/i18n` file changes in this row, so the review ledger is untouched.

| Key | en | es | ko | Why |
|---|---|---|---|---|
| `caregiver.join.who.joined(name)` | {name} joined. | {name} se unió. | {name}: 들어갔어요. | section 10.3 lists "joined" as a per-learner result, but only `already(name)` and the cap line had rows |
| `caregiver.join.who.consentTitle(space)` | Join {space}? | ¿Unirse a {space}? | {space}: 참여할까요? | section 10.3's one consent step had no rows (review) |
| `caregiver.join.who.consentLine(name)` | {name}: joining saves their progress to the account. | {name}: al unirse, su progreso se guarda en la cuenta. | {name}: 참여하면 진도가 계정에 저장돼요. | one line per picked learner: names each learner it registers |
| `caregiver.join.who.consentSees` | The family's grown-ups will see each name and their progress. | Los adultos de la familia verán cada nombre y su progreso. | 가족의 어른이 각 이름과 진도를 보게 돼요. | what joining shares |
| `caregiver.join.who.consentYes` | Yes, join | Sí, unirse | 네, 참여하기 | the consent's yes; ko uses the shipped Join verb 참여 (`caregiver.join.title`, `code.join.cta`) |
| `caregiver.join.who.notNow` | Not now | Ahora no | 지금은 안 함 | the consent's no; the same words in all three languages as the transfer consent's Not now (`caregiver.transfer.actions.notNow.cta`) |
| `console.pinOwner.notNow` | Not now | Ahora no | 지금은 안 함 | closes the PIN-owner card for this unlock in this tab (D13, review round 2); the same words as `console.transfer.consent.notNow.cta` |
| `a11y.who.lockedRow(name)` | {name}, locked | {name}, con candado | {name}: 잠겨 있어요 | People on this device: `lockedTile(name)` says a PIN opens it, but there a tap opens the person page (review) |

Changed section 17 drafts (length budgets, review): es `caregiver.people.keep` "Mantener", es `caregiver.join.who.classOnly` "En este dispositivo, solo es para su clase." (review round 2: the earlier "solo está en una clase" could read as "in only one class"), es `console.lock.passkey.cta` "Usar llave de acceso"; `console.pinOwner.cta` keeps its key and gets a named wider budget (below). Reused: `console.adminInvite.signedInAs(who)` for the PIN-owner card's account line.

Reused without change: `learner.welcome.grownUps.needsInternet`, `a11y.pinDigit(digit)`, `a11y.pinDelete`, `a11y.pinDots`, `caregiver.join.confirm.*`, `console.adminInvite.signedInAs(who)`, `caregiver.audience.*.zoneLabel` / `pinVerifyTitle` / `pinCreateSubtitle`, `caregiver.pin.cooldown(seconds)`, `caregiver.pin.entry.*`, `caregiver.pin.reset.*`, `caregiver.join.title`, `caregiver.join.bubble.found(space)`, `caregiver.join.errors.familyFull(cap)`, `caregiver.retry.offline`, `learner.editProfile.title`, `learner.home.greeting(name)`, `a11y.profileEntry`, `console.lock.*`, `common.buttons.*`.

## Decisions taken in this design pass

- **D1. The tint fills the plate, never the text.** The row fixes the tints to `colors.theme`; four of its five values equal `colors.stage` values, which is accepted because the tint is a pure function of avatar and creation order, never changes with progress and carries no number, badge or stage name (CS-6; WhoTile spec). A tile is a plate (the cub's paper circle on `surface.sunken`, or on the tint) over a paper strip with the name. No text sits on a tint, so the tints (1.86 to 4.58 against paper) need no reading contrast and the name stays the tell (spec 6.1). Order by creation order inside a same-cub group: `letters`, `crafts`, `nature`, `rites`, `life`, then again: orange then blue first, the pair that stays apart for the common red-green colour-vision types.
- **D2. A lock is a badge and a caption.** A `text.primary` lock in a ringed paper badge at the plate's corner and `learner.who.lockedCaption` under the name. When the locks cannot be read (fail closed), every tile carries the badge without the caption and the screen shows the one line `learner.who.locksUnread`, so the grid does not repeat a sentence on every tile.
- **D3. The grid is sized in rem.** `auto-fill` columns of at least 8rem (10rem from `layout.breakpoint.wide`, six per row), so a larger text size takes a column away: a 360 phone shows two at Standard and one at Largest (board 16). The wide switch is measured on the screen's own width (a container query here; the app's window class in code).
- **D4. Grown-ups are visibly secondary.** A `border.subtle` rule, a `size.body` bold `text.secondary` heading, rows at `touchTarget.min` with the label at `size.body` (tiles carry `size.bodyLg` bold and are 96 or more). One column on a phone, three from wide.
- **D5. The pending wait is a box, not a row.** `surface.sunken`, the line in `text.primary`, then a secondary **Cancel the wait**, at the top of the Grown-ups section, read in order (not a live region, spec 14).
- **D6. Offline rows stay and say why.** `aria-disabled` (kept in the reading order), `surface.sunken`, label `text.muted`, caption "Needs the internet", no chevron. Grown-up area stays enabled.
- **D7. Switch on Home is its own button.** The Home trail gains **Switch** (`learner.who.switch`) between Display and Profile: the shipped two-person glyph (`parent`) over the word, 73 x 64 (at least 44 x 44, spec 14, and the 64 floor). Its name is the word (`learner.who.switch`) and its hint the chooser title (`learner.who.title`), two whole strings, never one joined label. It opens the chooser directly (spec 6.2 trigger row amended in this PR); the avatar stays the Profile entry, so `profiles/switch-button.md`'s sheet is not built. At 320 with 200 % text the trail wraps under the greeting (the title keeps 8rem).
- **D8. The PIN screen's title names the destination, with no new string:** the zone name for the Grown-up area, the use label for Family, Teacher, School or Sign in as a grown-up (`learner.who.use.*`), the learner's name on a locked tile, **Cancel the wait** for `CancelReset`, **Choose a new grown-up PIN** after the ticket.
- **D9. Use face or fingerprint is a full-width secondary button between the lines and the dots.** It is above the pad and never replaces it; Unlock stays the primary under the pad. A cancel or failed match leaves the screen as it was. After an enrolment change the button is gone and the line `caregiver.pin.biometric.changed` takes the subtitle's place.
- **D10. Pause lines take the subtitle's place** (the shipped polite live region, `size.bodySm` semibold), seconds under a minute and minutes above. The help line is a second, regular-weight line under it on the Grown-up area destination only, from the third pause; Forgot PIN? stays enabled in every pause; the keys are disabled and keep the shipped `a11y.pinDigit` / `a11y.pinDelete` names, which the platform reads as disabled (no "paused" string; the wireframe line is amended). The pad is the shipped `PinPad`: `radii.lg` keys and the bare `arrow-left` delete key.
- **D11. Sign in to the account is the first reset card** (heading, caption, primary **Sign in**) and is **hidden** offline and on native builds (spec 8.5 step 1 decides between section 12's "hidden or disabled"). The Rescue Code and the 24-hour wait cards are unchanged.
- **D12. The expired-ticket line is an info notice** (`feedback.infoLight`, `role="status"`) at the top of the normal start (the chooser, or Home on an unshared device). The reset-by-wait notice is the same notice at the top of the Grown-up area with a primary **Change PIN**.
- **D13. The PIN-owner offer lives on the persona home.** Section 7.2 moment 3 named "the console's Account page", which does not exist at `a384759ca` (only `/account/billing` and `/account/invite`). The hand-off after a fresh PIN lands on the Family or Teacher home, so the offer is a card there: `console.pinOwner.hint`, the signed-in account (`console.adminInvite.signedInAs(who)`: the account's own email, so a grown-up handed off to the wrong account sees it) and a secondary **Let this account reset the PIN here** (`console.pinOwner.cta`), shown only while the tab's `pin` unlock is under 2 minutes old, the marker is `pin` and this account is not the owner for the current epoch. It goes at once when the tab's unlock drops (the `hr-grownup` lock message, 5 minutes hidden, 15 idle minutes, sign out). When reverification completes, the unlock's age and epoch are checked again; a lapsed one writes nothing (CS-10 test extended). Reverification is Clerk's dialog; success shows `pinOwner.done` (a `feedback.successLight` status with the check glyph) until the page is left. The spec's section 7.2 and OA-3 row are amended in this PR. A quiet **Not now** (`console.pinOwner.notNow`, `btn-quiet`) under the button closes the card for this unlock in this tab and writes nothing else (`sessionStorage` `pinOwnerOfferClosed`, the unlock's time only), and the first navigation away from the persona home closes it the same way: a grown-up who sees a wrong account (a child's, CS-10) has a control to press, and the offer is never left live on a page nobody watches.
- **D14. The set-a-PIN card has no dismiss button.** It is marked seen (`pinPromptSeen`) once it has been in view in a visible tab (IntersectionObserver while the document is visible) or when Open the app is pressed, so it shows once per browser and a render nobody saw does not use it up; **Open the app** is a secondary button (the home's own tasks keep the primary).
- **D15. Use a passkey is a secondary button under the last button of the lock card,** only when the marker is read and is not `pin`: in practice the `nopin` lock. A failed read or a missing marker on a device with profiles may be a `pin` browser, so it shows none (fail closed; spec 7.4 and CS-17 amended). On a `pin` browser the lock is unchanged.
- **D16. `/account/pin-reset` is the lock's single paper card** (no frame, no persona, no name, no number), titled `console.pinReset.title`. Going is a polite status with no button (the page leaves by itself); each refusal has **Back to learning** (`console.lock.backToLearning`).
- **D17. People on this device rows** are the cub (40), the name, the lock glyph for a locked profile and a chevron; no visible "locked" word (the wireframe's has no row); the accessible name is `a11y.who.lockedRow(name)` ("Sora, locked"), new in 17.2, because a tap here opens the person page without a PIN.
- **D18. Switch rows.** The whole row is the target (at least 64), the label is the switch's name, the hint sits under it; without a PIN both switches are disabled with `caregiver.pin.needsPinFirst` as the hint. Drawn on: track `brand.primary` with a paper knob; off: `surface.sunken` with a `border.shape` outline (4.55:1).
- **D19. Remove from this device is a secondary paper button, never red.** The danger tone (`feedback.danger`, `text.onPrimary` 4.64:1) appears on one control in the whole pass: **Remove** in the Remove anyway step, after **Keep** (first and focused). Saved: Cancel, then Remove as the primary. Unsaved: **Save progress first** (primary), Cancel, then **Remove anyway** as a quiet underlined text button. Checking: only Cancel. The initial focus is Cancel on the checking, saved and unsaved sheets and Keep on the Remove anyway step (drawn with the focus ring). With no PIN on the device, Remove from this device is disabled with Set a grown-up PIN first., like the lock switch (board 4; spec 10.4, CS-12). See the ConfirmSheet addendum.
- **D20. Who is joining? uses real check boxes in 64-high rows** with the cub, the name, a caption where there is one, and the lock glyph on a locked profile. A class-only learner is a disabled row on `surface.sunken`. The screen keeps its shipped title (`caregiver.join.title`, used for every code today) and the found line (`bubble.found`); **Next** is `common.buttons.next`, `aria-disabled` offline with "Needs the internet" under it as its description. Only the active learner starts checked (OA-D14).
- **D21. Results** lead with `join.who.result(joined, total)` as a status heading, then one line per learner: `joined(name)` (new), `already(name)`, or the name in the colon form with `errors.familyFull(cap)`, never as an error. A network stop shows the lines done so far, `caregiver.retry.offline` and **Try again** (`join.who.retry`).
- **D23. The consent step names every picked learner** (boards 7, 8): `consentTitle(space)`, one `consentLine(name)` per picked learner in pick order, `consentSees`, then **Yes, join** (primary) and **Not now** (ghost, back to the checklist, nobody registered). The name step before it reuses only the fields of the shipped Join confirm step, once per picked learner, with **Next** (`common.buttons.next`), which sends nothing (board 6): the shipped **That's me** calls `join` at once and would register the learner before the consent. `membership-store.join` runs only after Yes, join, which checks the PIN's age again (asked again past 2 minutes); the picks are frozen once the PIN is accepted, and a change after Not now asks it again (`who-is-joining.md`, spec 10.3, CS-11). Strings new in 17.4.
- **D22. Korean wraps at spaces** (`:lang(ko) { word-break: keep-all }`), as the shipped web builds (`apps/web/src/app/globals.css`) and native text (`packages/design-system/src/line-break.ts`) already do, so no Korean word breaks between two syllables (`lengths.html`).

## es and ko lengths

Character counts of the section 17 drafts against English, for the pieces with the least room. Every key in this table is drawn on `lengths.html` in en, es and ko at 320 and at 320 with 200 % text, together with the long bodies (`removeSaved`, `removeUnsaved`, `spacesStay`, `checking`, `biometric.warning`, `biometric.changed`, `resetByWaitNotice`, `pinReset.notOwner`, `pinReset.firstSignIn`) and the tightest stacks (the unsaved Remove sheet with its three full-width buttons, the Remove anyway and saved sheets, the lock and face or fingerprint switch cards, the consent step, the console refusal card): nothing truncates or overflows; each line wraps inside its control, and every control keeps at least 64 px.

| Key | en | es | ko | Where |
|---|---|---|---|---|
| `learner.who.add` | 13 | 18 (138 %) | 6 (46 %) | Add tile, 8rem |
| `learner.who.lockedCaption` | 26 | 18 (69 %) | 10 (38 %) | tile caption |
| `learner.who.title` | 18 | 20 (111 %) | 10 (56 %) | title |
| `learner.who.use.signIn` | 21 | 18 (86 %) | 8 (38 %) | row |
| `learner.who.nopinCaption` | 27 | 27 (100 %) | 18 (67 %) | row caption |
| `learner.who.locksUnread` | 43 | 42 (98 %) | 22 (51 %) | line |
| `learner.who.resetPending` | 68 | 93 (137 %) | 48 (71 %) | pending box |
| `learner.who.resetCancel` | 15 | 18 (120 %) | 7 (47 %) | button |
| `learner.who.switch` | 6 | 7 (117 %) | 3 (50 %) | Home button, 64 wide |
| `learner.who.switchUser` | 11 | 18 (164 %) | 7 (64 %) | button |
| `learner.who.joinCaption` | 20 | 19 (95 %) | 13 (65 %) | caption |
| `caregiver.pin.cooldownMinutes` | 46 | 41 (89 %) | 24 (52 %) | PIN line |
| `caregiver.pin.cooldownHelp` | 43 | 52 (121 %) | 32 (74 %) | PIN line |
| `caregiver.pin.biometric.cta` | 23 | 20 (87 %) | 10 (43 %) | button |
| `caregiver.pin.biometric.toggle` | 33 | 28 (85 %) | 12 (36 %) | switch label |
| `caregiver.pin.reset.signIn.newPinTitle` | 25 | 29 (116 %) | 13 (52 %) | header title |
| `caregiver.people.lock` | 26 | 30 (115 %) | 13 (50 %) | switch label |
| `caregiver.people.remove` | 23 | 26 (113 %) | 9 (39 %) | button |
| `caregiver.people.saveFirst` | 19 | 27 (142 %) | 10 (53 %) | button |
| `caregiver.people.removeAnyway` | 13 | 21 (162 %) | 6 (46 %) | quiet button |
| `caregiver.people.keep` | 4 | 8 (200 %) | 6 (150 %) | button |
| `caregiver.people.removeAnywayAsk` | 65 | 81 (125 %) | 30 (46 %) | sheet title |
| `caregiver.join.who.takesPlace` | 21 | 29 (138 %) | 13 (62 %) | check caption |
| `caregiver.join.who.classOnly` | 34 | 43 (126 %) | 20 (59 %) | check caption |
| `caregiver.join.who.consentLine(name)` (Mina) | 50 | 52 (104 %) | 24 (48 %) | consent line |
| `caregiver.join.who.consentSees` | 61 | 58 (95 %) | 24 (39 %) | consent line |
| `caregiver.join.who.consentYes` | 9 | 10 (111 %) | 7 (78 %) | button |
| `console.pinOwner.cta` | 35 | 48 (137 %) | 29 (83 %) | button |
| `console.pinOwner.notNow` | 7 | 8 (114 %) | 7 (100 %) | quiet button |
| `console.lock.passkey.cta` | 13 | 20 (154 %) | 6 (46 %) | button |

The longest relative growth is es `keep` (8 against 4, inside the 8-character floor), `switchUser` (164 %) and `removeAnyway` (162 %): all are buttons that wrap and stay on one line at 320. The longest absolute lines are es `pinReset.firstSignIn` (about 140), `resetPending` (93) and `removeAnywayAsk` (81): six, four and three lines at 320, inside their card, box and sheet. The `{time}` of `resetPending` is the device's locale time (`18:40`, `오후 6:40`).

### Length budget (F-I18N-001 section 3.11, `packages/i18n/src/__tests__/length-budget.test.ts`)

CI holds every key ending in `cta` to 28 characters in every locale and every es string to at most max(8, ceil(1.5 x en)) unless it is on `ES_LENGTH_ALLOW_LIST`. The section 17 drafts against it, after this pass:

| Key | Budget | en / es / ko | Result | Row that lands it |
|---|---|---|---|---|
| `console.pinOwner.cta` | `cta` 28 | 35 / 48 / 29 | over in all three: **a named `WIDER_BUDGET` entry of 48** with its reason (the card's one action, a full-width button that wraps; measured on the last row of `lengths.html`); the key keeps `cta` so the budget still guards it (review round 2 reverted the earlier rename to `pinOwner.button`) | OA-3 adds the entry |
| `console.lock.passkey.cta` | `cta` 28, es 20 | 13 / 20 / 6 | es shortened to "Usar llave de acceso" (was 24) | OA-3 |
| `caregiver.people.keep` | es 8 | 4 / 8 / 6 | es "Mantener" (was "Conservar", 9) | OA-7a |
| `caregiver.join.who.classOnly` | es 51 | 34 / 43 / 20 | es "En este dispositivo solo está en una clase." (was 52, and drops the gendered "vinculado") | OA-7b |
| `learner.who.switchUser` | es 17 | 11 / 18 / 7 | **allow-list**: "Cambiar de persona", one letter over; gender-neutral where "usuario" is not; a full-width button that wraps | OA-4a adds the `ES_LENGTH_ALLOW_LIST` entry |
| `caregiver.people.removeAnyway` | es 20 | 13 / 21 / 6 | **allow-list**: "Quitar de todos modos", one letter over; the idiom of the allow-listed `console.confirm.copyAnyway`; a ConfirmSheet button that wraps | OA-7a adds the entry |
| `caregiver.pin.biometric.cta`, `console.pinPrompt.cta` | `cta` 28 | 23 / 20 / 10; 12 / 12 / 4 | fit | OA-9, OA-3 |

Every other section 17 row fits (checked with the section's own placeholders). Spec section 17.4 records the two allow-list entries and their reasons.

## Measured on the mock (Chromium)

- No sideways scroll on any render (320, 1280, and 320 at 200 % text), no duplicate id, no dangling `aria-labelledby`, `aria-describedby` or `for`, no console error. No control under 64 px tall; no tile under 96 x 96 (141 x 141 on a 360 phone, 294 x 153 at Largest). The Home Switch button is 73 x 64. Every tile grid has exactly one tile with `tabindex="0"` (roving); the PIN keys carry the shipped `Digit n` / `Delete last digit` names in every state; every ConfirmSheet is labelled and described. The 320 shots draw the board around the phone, so the screen inside is 254 px and shows one tile column; a real 320 window (288 px inside the gutters) shows two.
- Contrast from the token values: `text.primary` on paper 16.10, on sunken 13.58, on infoLight 12.69, on successLight 13.24; `text.secondary` on paper 8.44 and on sunken 7.12 (captions, hints, lock and chevron glyphs); `text.muted` on sunken 5.07 (disabled labels); `text.onPrimary` on `brand.primary` 5.44, on `brand.secondary` 5.20 (Use face or fingerprint), on `feedback.danger` 4.64; ghost `brand.primary` on canvas 5.14; `border.shape` on paper 4.55 and on canvas 4.29 (Add tile, switch off); `border.focus` on canvas 4.06.

## Review

Author pass (design, accessibility, anti-shame, child safety, privacy, copy, against sections 6, 8, 10, 14, 17 and the wireframes), done before the PR; each finding is fixed in this PR:

- Design: a phone board on the wide page took the wide layout (rows went three across inside a 360 frame and broke "Teacher"); the wide switch is now measured on the screen's own width. The Grown-ups section first borrowed the Welcome page's centred `.grownups` class; renamed. Phone boards first stretched past 360; pinned.
- Fit: at 320 with 200 % text the Home greeting and the PIN title were squeezed to one letter per line by the trail; titles keep 8rem and the trail wraps under them. Korean broke between syllables of one word; `:lang(ko)` now keeps words whole, as the builds do.
- Fidelity: Cancel and Forgot PIN? were first drawn as text links; they are the shipped ghost buttons, and Use face or fingerprint became the secondary fill so it is not a third ghost.
- Spec: "the console's Account page" does not exist; the PIN-owner offer moved to the persona home (D13, spec section 7.2 amended). The per-learner "joined" line had no string; added (section 17.4).
- Anti-shame and safety: no tile carries progress, stars, cards, level, streak, a space or a time (CS-6); rows carry generic labels only (CS-7); no red outside Remove anyway; no count of tries on a pause; the help line is drawn only on the Grown-up area destination (CS-21); no speaking UI; no age wording.
- Privacy: no email or account appears on a learner surface or on a grown-up row (CS-7), and no drawn address, title or label carries a name beyond the learner's own tile and rows, or an id; the reset ticket and `pinOwner` are never shown. The only account drawn is the signed-in account's own email on the PIN-owner card behind the console lock (D13, boards 10 and 11 of `console-pin.html`, the last row of `lengths.html`), reusing `console.adminInvite.signedInAs`, so a grown-up handed off to the wrong account sees it.

Independent multi-agent review (CLAUDE.md section 5), 2026-10-21, two reviewers: 0 blockers, 8 majors, 15 minors (the consent step and Board 9's label were raised by both). Adjudication, fixed in this PR unless marked rejected:

- Length budgets (major): `console.pinOwner.cta` renamed `pinOwner.button`; es `lock.passkey.cta`, `people.keep` and `join.who.classOnly` shortened; `switchUser` and `removeAnyway` named as allow-list entries with reasons for OA-4a and OA-7a ("Length budget" above, spec 17.4).
- `lengths.html` incomplete (major): it now draws every key of the table, the long bodies and the tightest stacks in en, es and ko (rows 1 to 12); shots re-taken.
- Accessible names without rows (major): no "paused" string (the keys keep the shipped `a11y.pinDigit` / `a11y.pinDelete` names, the platform reads them as disabled); the Home Switch is named by its word with the chooser title as its hint; `a11y.who.lockedRow(name)` added; row captions are descriptions, never joined into names; the `nopin` Grown-up area row no longer announces a PIN.
- Use a passkey on unreadable and `nopin` browsers (major, child safety): **adopted for a failed read and a missing marker with profiles** (fail closed: either may be `pin`; spec 7.4, CS-17, OA-3 amended; board 2 redrawn). **Not adopted for `nopin`**: OQ-7 and OQ-21 (owner, 2026-10-21) put Use a passkey on every browser whose marker is not `pin`, and `none` and browsers without learner data never show the lock, so hiding it on `nopin` too would remove the owner's feature; this is left to the owner as an open question (PR body).
- The PIN-owner card and CS-10 (major, child safety): the card names the signed-in account (`console.adminInvite.signedInAs`), goes at once when the tab's unlock drops, and re-checks the 2 minutes and the epoch when reverification completes; the CS-10 test sequence covers the card (spec 7.2, CS-10, OA-3).
- Board 1 of Who is joining? pre-checked Jun (major): only the active learner starts checked.
- The consent step had no mock or strings (major, both reviews): boards 6 to 8 and five 17.4 rows (D23); the name step is the shipped confirm step.
- Tints equal stage colours (major): **rejected**; the OA-0b row fixes the tints to `colors.theme`, and the tint is a pure function of avatar and creation order with no number or stage name, so it shows no level (D1, WhoTile spec). Left to the owner as a follow-up if a non-stage palette is wanted.
- Minors fixed: the spec 6.2 trigger row and the wireframe header now match D7; board 13 says 73 x 64; board 9 draws Next; the pad is the shipped `radii.lg` PinPad with the `arrow-left` delete key; roving `tabindex` on every grid; sheets labelled and described; Next described by Needs the internet; Leo on the chooser and in People; `pinPromptSeen` written only once the card was seen (spec 7.6); OA-7b notes for the family-join title and the grown-up cap line (`who-is-joining.md`).
- Minor rejected: the chooser's pending line keeps `{time}`; OA-D21 (owner, 2026-10-21) makes the wait visible on the chooser with its time, and CS-21 limits only `cooldownHelp`.
- es/ko language review: the one string this pass first added, `caregiver.join.who.joined(name)`, passed (style guide and glossary). No `packages/i18n` file changes in this row, so the review ledger is untouched; the drafts added in the fix stage are reviewed in the MAR of the row that lands them (OA-7b, OA-5).

Independent multi-agent review, round 2 (CLAUDE.md section 5), 2026-10-21, two reviewers on the four OA-0b commits: 0 blockers, 3 majors, 13 minors (one reviewer approved with 8 minors and passed the es/ko strings; the other asked for changes). Adjudication, fixed in this PR unless marked rejected:

- Who is joining? registered learners before the consent (major, child privacy): the shipped **That's me** calls `join` at once, so the name step now reuses only the confirm step's fields with **Next**, which sends nothing; **Not this one** is dropped; `membership-store.join` runs only after Yes, join, and Not now sends nothing (board 6, D23, `who-is-joining.md`, spec 10.3, CS-11, OA-7b tests).
- The PIN-owner card had no way to close it (major, child safety, CS-10): a quiet **Not now** (`console.pinOwner.notNow`, new in 17.5 with the shipped transfer-consent words) closes it for this unlock in this tab, and leaving the persona home closes it too (boards 10 and 11, D13, spec 7.2, CS-10, the storage table, OA-3 tests).
- Remove stayed enabled without a PIN (major, CS-12): board 4 draws Remove from this device disabled with Set a grown-up PIN first. (spec 10.4, CS-12, ConfirmSheet addendum, OA-7a tests). No exception for `none` is designed; one would need an owner decision in spec 10.4.
- Fresh PIN across the join steps (minor): the picks are frozen once the PIN is accepted, a change after Not now asks it again, and Yes, join re-checks its age and asks again past 2 minutes (`who-is-joining.md`, spec 10.3, CS-11).
- `pinOwner.button` dodged the `cta` budget (minor): the key is `console.pinOwner.cta` again, with a named `WIDER_BUDGET` entry of 48 and its reason, which OA-3 (#785) already carries; the en words stay those of the row.
- The `nopin` row's reason misread the gate (minor): spec 17.2, `who-is-using.md`, GrownUpRow and board 8 now say that entering runs PIN setup first, so the name does not promise a PIN check.
- Forgot PIN? on `CancelReset` (minor): hidden; board 12 redrawn, spec 8.5 and `pin-entry-v2.md` say so.
- ConfirmSheet initial focus (minor): Cancel on the checking, saved and unsaved sheets, Keep on Remove anyway; boards 6 to 9 draw the focus ring (`profiles.css` `.rn-btn.is-focus`).
- Add a learner announced a PIN where none guards it (minor): board 9 (`none`) names it plain "Add a learner"; board 8 (`nopin`) keeps "PIN required", as the shipped Profile add does on a family device, where adding runs PIN setup first (`gatedA11y`; WhoTile spec, spec 17.2).
- Offline School and Sign in were not drawn (minor): board 4 adds School disabled; board 14 adds Sign in as a grown-up disabled with Needs the internet (it shows only with no use known, so it cannot sit next to Family on board 4).
- `lengths.html` Home trail kept the English Profile (minor): es "Perfil" and ko "프로필" (`learner.home.profileLabel`) are drawn; shots re-taken.
- `switch-button.md` had no superseded note (minor): a partly-superseded [OA] note there and in F-PROF-001 section 3.4 point to D7 and board 13.
- The privacy line said no account is drawn (minor): reworded above (the PIN-owner card's own email is the one intended account line, D13).
- es/ko consistency notes from the language review (minor): ko `join.who.notNow` is now 지금은 안 함, the transfer consent's words; ko `consentTitle`, `consentLine` and `consentYes` use the shipped Join verb 참여 (참여할까요?, 참여하면, 네, 참여하기); `joined(name)` keeps 들어갔어요, which mirrors the shipped `bubble.done` 들어왔어요; es `classOnly` is "En este dispositivo, solo es para su clase." (43, inside the 51 budget). Spec 17.4 and this README carry them.
- Rejected: none.
- es/ko language review: the reviewer passed every new and changed es/ko draft against the F-I18N-001 section 3.10 style guide and glossary. The round-2 changes reuse shipped values word for word (지금은 안 함 / Ahora no, 참여, Perfil / 프로필) or follow the reviewer's own wording (es `classOnly`). No `packages/i18n` file changes in this row, so the review ledger is untouched; OA-7b, OA-3 and OA-5 land the rows and sign their own ledger entries.
