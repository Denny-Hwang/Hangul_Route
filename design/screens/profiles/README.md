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
| `who-is-joining.md` | the checklist, the locked and class-only rows, offline, the results with the cap line, the network stop with Try again |
| `console-pin.md` | GrownUpLock with Use a passkey, the five `/account/pin-reset` states, the set-a-PIN card, the PIN-owner card |
| `mock/profiles.css` | the sheet of this pass, linked after `../../app-shell/mock/app-shell.css` (tokens, board) and `../../app-shell/mock/display-nav.css` (text size, ScreenHeader, Display control, ConfirmSheet) |
| `mock/who-is-using.html` | boards 1 to 15 |
| `mock/who-is-using-largest.html` | board 16, the whole page at the Largest text size (`html.ts-largest`) |
| `mock/pin-entry-v2.html` | boards 1 to 12 |
| `mock/people-on-device.html` | boards 1 to 9 |
| `mock/who-is-joining.html` | boards 1 to 5 |
| `mock/console-pin.html` | boards 1 to 12 |
| `mock/lengths.html` | the es and ko overflow check: the tightest pieces in en, es and ko side by side |
| `shots/` | each mock in Chromium at 320 and 1280, and at 320 with the browser text size at 200 % (`-320-text200`), full page, 1x |

**The mocks are a design reference, not shipped code.** Learner screens are react-native drawn as HTML in rem, so the browser text size and the Display sheet's text size both reach them; the console pages use the GrownUpLock card of `design/screens/app-shell/`.

- **Tokens.** Every value is a token of `packages/design-system/src/tokens.ts` as a custom property named after it (`--colors-theme-letters` is `colors.theme.letters`). `profiles.css` copies the eleven tokens the app-shell sheets do not carry (`colors.theme.*`, `colors.hoya.furBlue`, `furGreen`, `furPurple`, `furPink`, `colors.feedback.danger`, `radii.xl`) and redefines none. Every `var()` resolves in Chromium. No colour literal in the HTML, no emoji, no motion. No new token and no new glyph: the lock, plus, profile-pair (`parent`), chevrons, close, check and backspace are the shipped Icon glyphs.
- **Words.** Every drawn English string is a dictionary value of `packages/i18n` or a row of the amendment's section 17, word for word. One row was missing and is added to section 17.4 by this pass (below). The es and ko values on `lengths.html` are the section 17 drafts. The mocks were made by a throw-away generator that is not committed (as for the reports, billing, browse and console mocks).
- **Annotations.** Grey monospace labels and dashed boxes are board notes, not UI. A dashed box stands for an unchanged part of a screen.
- **Fixture.** Wed Oct 21, 2026, a family tablet: Mina and Jun (both the orange cub), Sora (the grown-up's own profile, blue cub, locked), Leo (class-scoped on this device, green cub). The account holds a family and a class. The classroom board has 26 learners. Names are examples.

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

Added to `docs/specs/AMENDMENTS-ONE-ACCOUNT-MANY-USERS.md` section 17.4 by this pass, with es and ko drafts written to the F-I18N-001 section 3.10 style guide; OA-7b lands it with the other 17.4 rows and its fix-stage review may still improve the drafts. No `packages/i18n` file changes in this row, so the review ledger is untouched.

| Key | en | es | ko | Why |
|---|---|---|---|---|
| `caregiver.join.who.joined(name)` | {name} joined. | {name} se unió. | {name}: 들어갔어요. | section 10.3 lists "joined" as a per-learner result, but only `already(name)` and the cap line had rows |

Reused without change: `learner.welcome.grownUps.needsInternet`, `caregiver.audience.*.zoneLabel` / `pinVerifyTitle` / `pinCreateSubtitle`, `caregiver.pin.cooldown(seconds)`, `caregiver.pin.entry.*`, `caregiver.pin.reset.*`, `caregiver.join.title`, `caregiver.join.bubble.found(space)`, `caregiver.join.errors.familyFull(cap)`, `caregiver.retry.offline`, `learner.editProfile.title`, `learner.home.greeting(name)`, `a11y.profileEntry`, `console.lock.*`, `common.buttons.*`.

## Decisions taken in this design pass

- **D1. The tint fills the plate, never the text.** A tile is a plate (the cub's paper circle on `surface.sunken`, or on the tint) over a paper strip with the name. No text sits on a tint, so the tints (1.86 to 4.58 against paper) need no reading contrast and the name stays the tell (spec 6.1). Order by creation order inside a same-cub group: `letters`, `crafts`, `nature`, `rites`, `life`, then again: orange then blue first, the pair that stays apart for the common red-green colour-vision types.
- **D2. A lock is a badge and a caption.** A `text.primary` lock in a ringed paper badge at the plate's corner and `learner.who.lockedCaption` under the name. When the locks cannot be read (fail closed), every tile carries the badge without the caption and the screen shows the one line `learner.who.locksUnread`, so the grid does not repeat a sentence on every tile.
- **D3. The grid is sized in rem.** `auto-fill` columns of at least 8rem (10rem from `layout.breakpoint.wide`, six per row), so a larger text size takes a column away: a 360 phone shows two at Standard and one at Largest (board 16). The wide switch is measured on the screen's own width (a container query here; the app's window class in code).
- **D4. Grown-ups are visibly secondary.** A `border.subtle` rule, a `size.body` bold `text.secondary` heading, rows at `touchTarget.min` with the label at `size.body` (tiles carry `size.bodyLg` bold and are 96 or more). One column on a phone, three from wide.
- **D5. The pending wait is a box, not a row.** `surface.sunken`, the line in `text.primary`, then a secondary **Cancel the wait**, at the top of the Grown-ups section, read in order (not a live region, spec 14).
- **D6. Offline rows stay and say why.** `aria-disabled` (kept in the reading order), `surface.sunken`, label `text.muted`, caption "Needs the internet", no chevron. Grown-up area stays enabled.
- **D7. Switch on Home is its own button.** The Home trail gains **Switch** (`learner.who.switch`) between Display and Profile: the shipped two-person glyph (`parent`) over the word, 73 x 64 (at least 44 x 44, spec 14, and the 64 floor). It opens the chooser directly (spec 6.2); the avatar stays the Profile entry, so `profiles/switch-button.md`'s sheet is not built. At 320 with 200 % text the trail wraps under the greeting (the title keeps 8rem).
- **D8. The PIN screen's title names the destination, with no new string:** the zone name for the Grown-up area, the use label for Family, Teacher, School or Sign in as a grown-up (`learner.who.use.*`), the learner's name on a locked tile, **Cancel the wait** for `CancelReset`, **Choose a new grown-up PIN** after the ticket.
- **D9. Use face or fingerprint is a full-width secondary button between the lines and the dots.** It is above the pad and never replaces it; Unlock stays the primary under the pad. A cancel or failed match leaves the screen as it was. After an enrolment change the button is gone and the line `caregiver.pin.biometric.changed` takes the subtitle's place.
- **D10. Pause lines take the subtitle's place** (the shipped polite live region, `size.bodySm` semibold), seconds under a minute and minutes above. The help line is a second, regular-weight line under it on the Grown-up area destination only, from the third pause; Forgot PIN? stays enabled in every pause; the keys are `aria-disabled` and named "paused".
- **D11. Sign in to the account is the first reset card** (heading, caption, primary **Sign in**) and is **hidden** offline and on native builds (spec 8.5 step 1 decides between section 12's "hidden or disabled"). The Rescue Code and the 24-hour wait cards are unchanged.
- **D12. The expired-ticket line is an info notice** (`feedback.infoLight`, `role="status"`) at the top of the normal start (the chooser, or Home on an unshared device). The reset-by-wait notice is the same notice at the top of the Grown-up area with a primary **Change PIN**.
- **D13. The PIN-owner offer lives on the persona home.** Section 7.2 moment 3 named "the console's Account page", which does not exist at `a384759ca` (only `/account/billing` and `/account/invite`). The hand-off after a fresh PIN lands on the Family or Teacher home, so the offer is a card there: `console.pinOwner.hint` and a secondary **Let this account reset the PIN here**, shown only while the tab's `pin` unlock is under 2 minutes old, the marker is `pin` and this account is not the owner for the current epoch. It needs no dismiss button because it is gone by itself after that window. Reverification is Clerk's dialog; success shows `pinOwner.done` (a `feedback.successLight` status with the check glyph) until the page is left. The spec's section 7.2 and OA-3 row are amended in this PR.
- **D14. The set-a-PIN card has no dismiss button.** It is marked seen (`pinPromptSeen`) when it first renders, so it shows once per browser; **Open the app** is a secondary button (the home's own tasks keep the primary).
- **D15. Use a passkey is a secondary button under the last button of the lock card,** only off `pin` browsers. On a `pin` browser the lock is unchanged.
- **D16. `/account/pin-reset` is the lock's single paper card** (no frame, no persona, no name, no number), titled `console.pinReset.title`. Going is a polite status with no button (the page leaves by itself); each refusal has **Back to learning** (`console.lock.backToLearning`).
- **D17. People on this device rows** are the cub (40), the name, the lock glyph for a locked profile and a chevron; no visible "locked" word (the wireframe's has no row; the accessible name is `a11y.who.lockedTile(name)`).
- **D18. Switch rows.** The whole row is the target (at least 64), the label is the switch's name, the hint sits under it; without a PIN both switches are disabled with `caregiver.pin.needsPinFirst` as the hint. Drawn on: track `brand.primary` with a paper knob; off: `surface.sunken` with a `border.shape` outline (4.55:1).
- **D19. Remove from this device is a secondary paper button, never red.** The danger tone (`feedback.danger`, `text.onPrimary` 4.64:1) appears on one control in the whole pass: **Remove** in the Remove anyway step, after **Keep** (first and focused). Saved: Cancel, then Remove as the primary. Unsaved: **Save progress first** (primary), Cancel, then **Remove anyway** as a quiet underlined text button. Checking: only Cancel. See the ConfirmSheet addendum.
- **D20. Who is joining? uses real check boxes in 64-high rows** with the cub, the name, a caption where there is one, and the lock glyph on a locked profile. A class-only learner is a disabled row on `surface.sunken`. The screen keeps its shipped title (`caregiver.join.title`, used for every code today) and the found line (`bubble.found`); **Next** is `common.buttons.next`, `aria-disabled` offline with "Needs the internet" under it.
- **D21. Results** lead with `join.who.result(joined, total)` as a status heading, then one line per learner: `joined(name)` (new), `already(name)`, or the name in the colon form with `errors.familyFull(cap)`, never as an error. A network stop shows the lines done so far, `caregiver.retry.offline` and **Try again** (`join.who.retry`).
- **D22. Korean wraps at spaces** (`:lang(ko) { word-break: keep-all }`), as the shipped web builds (`apps/web/src/app/globals.css`) and native text (`packages/design-system/src/line-break.ts`) already do, so no Korean word breaks between two syllables (`lengths.html`).

## es and ko lengths

Character counts of the section 17 drafts against English, for the pieces with the least room. Every one is drawn on `lengths.html` at 320 (and at 320 with 200 % text): nothing truncates or overflows; each line wraps inside its control, and every control keeps at least 64 px.

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
| `caregiver.people.removeAnywayAsk` | 65 | 81 (125 %) | 30 (46 %) | sheet title |
| `caregiver.join.who.takesPlace` | 21 | 29 (138 %) | 13 (62 %) | check caption |
| `caregiver.join.who.classOnly` | 34 | 52 (153 %) | 20 (59 %) | check caption |
| `console.pinOwner.cta` | 35 | 48 (137 %) | 29 (83 %) | button |
| `console.lock.passkey.cta` | 13 | 24 (185 %) | 6 (46 %) | button |

The longest relative growth is es `lock.passkey.cta` (185 %) and `switchUser` (164 %): both are full-width buttons and stay on one line at 320. The longest absolute lines are es `resetPending` (93) and `removeAnywayAsk` (81): four and three lines at 320, inside their box and sheet. The `{time}` of `resetPending` is the device's locale time (`18:40`, `오후 6:40`).

## Measured on the mock (Chromium)

- No sideways scroll on any render (320, 1280, and 320 at 200 % text), no duplicate id, no dangling `aria-labelledby`, `aria-describedby` or `for`, no console error. No control under 64 px tall; no tile under 96 x 96 (141 x 141 on a 360 phone, 294 x 153 at Largest). The Home Switch button is 73 x 64. The 320 shots draw the board around the phone, so the screen inside is 254 px and shows one tile column; a real 320 window (288 px inside the gutters) shows two.
- Contrast from the token values: `text.primary` on paper 16.10, on sunken 13.58, on infoLight 12.69, on successLight 13.24; `text.secondary` on paper 8.44 and on sunken 7.12 (captions, hints, lock and chevron glyphs); `text.muted` on sunken 5.07 (disabled labels); `text.onPrimary` on `brand.primary` 5.44, on `brand.secondary` 5.20 (Use face or fingerprint), on `feedback.danger` 4.64; ghost `brand.primary` on canvas 5.14; `border.shape` on paper 4.55 and on canvas 4.29 (Add tile, switch off); `border.focus` on canvas 4.06.

## Review

Author pass (design, accessibility, anti-shame, child safety, privacy, copy, against sections 6, 8, 10, 14, 17 and the wireframes), done before the PR; each finding is fixed in this PR:

- Design: a phone board on the wide page took the wide layout (rows went three across inside a 360 frame and broke "Teacher"); the wide switch is now measured on the screen's own width. The Grown-ups section first borrowed the Welcome page's centred `.grownups` class; renamed. Phone boards first stretched past 360; pinned.
- Fit: at 320 with 200 % text the Home greeting and the PIN title were squeezed to one letter per line by the trail; titles keep 8rem and the trail wraps under them. Korean broke between syllables of one word; `:lang(ko)` now keeps words whole, as the builds do.
- Fidelity: Cancel and Forgot PIN? were first drawn as text links; they are the shipped ghost buttons, and Use face or fingerprint became the secondary fill so it is not a third ghost.
- Spec: "the console's Account page" does not exist; the PIN-owner offer moved to the persona home (D13, spec section 7.2 amended). The per-learner "joined" line had no string; added (section 17.4).
- Anti-shame and safety: no tile carries progress, stars, cards, level, streak, a space or a time (CS-6); rows carry generic labels only (CS-7); no red outside Remove anyway; no count of tries on a pause; the help line is drawn only on the Grown-up area destination (CS-21); no speaking UI; no age wording.
- Privacy: no drawn address, title or label carries a name beyond the learner's own tile and rows, an email, an account or an id; the reset ticket and `pinOwner` are never shown.

The independent multi-agent review (CLAUDE.md section 5) follows on the PR; its findings and their adjudication are recorded here and in the PR body in the fix stage.
