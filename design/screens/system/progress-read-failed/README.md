# Progress read failed: the screen, the grown-up sheet and the save lines (design pass, DP-0b)

Spec: `docs/specs/AMENDMENTS-DURABLE-PROGRESS.md` (revision 3a, `ready`) sections 3.4 to 3.8, row **DP-0b**; built by
rows DP-1c (the screen), DP-1d (the grown-up button and the sheet) and DP-2 (the save lines).
Wireframe: `design/wireframes/shell/progress-read-failed.md` revision 4a (checked against the spec: no change needed).
Approval: multi-agent review (CLAUDE.md section 5, owner rule 2026-10-12); the log is at the end of this file.

**The mocks are a design reference, not shipped code.** Every value is a token (`../../app-shell/mock/app-shell.css`,
`display-nav.css`, and the two copied once at the top of `mock/progress-read-failed.css`). No rule uses
`colors.feedback.danger`.

| File | Shows |
|---|---|
| `mock/screen.html` | A to G: list variant (read; damaged with a kept copy), learner variant (1 profile; 2 or more), a try running, the still-stuck line, tablet |
| `mock/sheet.html` | H, I: the RecoverRecord sheet over frame B, phone (bottom sheet) and wide (centred dialog) |
| `mock/save-lines.html` | K to N2: the four quiet lines on Results, Profile, the Grown-up area and Restore (N as the spec, N2 a proposal) |
| `mock/lengths.html` | en, es and ko at 320 with Largest text (B and D with the still-stuck line, and the sheet) |
| `mock/progress-read-failed.css` | the rules |
| `tools/build-mocks.mjs` | writes the four pages from one string table (edit it, not the HTML) |
| `tools/capture.mjs` | checks (sideways scroll, 64 px targets, footer and still-stuck line in view, no danger colour, banned words, sheet focus) and writes the shots |
| `shots/screen-{1280,390}.png`, `sheet-{1280,390}.png`, `save-lines-{1280,390}.png`, `lengths-{1280,320}.png` | the pages |

`NODE_PATH=<checkout>/apps/web/node_modules node design/screens/system/progress-read-failed/tools/capture.mjs` passes
with no finding on every page and width.

## The screen (DP-1c, DP-1d)

```
            [Hoya thinking, 140]
      We could not open your progress.        Heading title, centred
     Nothing was erased. Let's try again.     Body secondary, centred
     ( Hmm, the box is stuck.            )    HoyaBubble thinking
      Still stuck? Close the app and ...      Body secondary; after 3 tries; polite live region
  ---------------------------------------- Screen footer (always in view)
  [[            Try again             ]]      Button primary, hero, full width
  [       Choose another learner       ]      learner variant, 2+ profiles: secondary, lg, full width
           ( A grown-up can help )            list variant, parse + kept: ghost, md, centred
```

| Frame | Variant and case | Footer |
|---|---|---|
| A | list: `read`, or `parse` with `kept: false` | Try again |
| B | list: `parse` with `kept: true` | Try again · A grown-up can help |
| C | learner: 1 profile on the device | Try again |
| D | learner: 2 or more profiles | Try again · Choose another learner |
| E | a try is running (D shown) | every button soft-disabled, same words |
| F | after 3 tries in this session (B shown) | the still-stuck line shows |
| G | tablet / wide | the same column at the Screen frame's max width |

At most one button joins Try again: the two extra buttons belong to different variants (spec 3.5).

### Values

| Part | Component and tokens |
|---|---|
| Screen | `Screen tone="canvas"` with `footer` (as `OopsScreen`): the footer is pinned and the body scrolls, so the buttons stay in view at 320 x 568 and Largest text (`mock/lengths.html`, checked by `tools/capture.mjs`) |
| Body column | centred, `paddingHorizontal: spacing.lg` |
| Hoya | `Hoya pose="thinking" size={140}`, as `OopsScreen` |
| Gaps | `Spacer lg` Hoya to title, `sm` title to body, `xl` body to bubble, `lg` bubble to the still-stuck line |
| Title | `Heading level="title" align="center"`; the screen's heading (`accessibilityRole="header"`) |
| Body | `Body tone="secondary" align="center"` |
| Bubble | `HoyaBubble tone="thinking"`, unchanged: its own Hoya (72) and the text in a row, padding `spacing.lg`, gap `spacing.md`, `feedback.nudgeLight` with a `feedback.nudge` border (never `feedback.danger`) |
| Still-stuck line | `Body tone="secondary" align="center"` inside a `View` with `accessibilityLiveRegion="polite"`, always mounted and empty until the third try ends (so it is announced once, when it fills) |
| Try again | `Button tone="primary" size="hero" fullWidth` (`touchTarget.hero`, 96) |
| Choose another learner | `Button tone="secondary" size="lg" fullWidth` (`touchTarget.child`, 80) |
| A grown-up can help | `Button tone="ghost" size="md"` (`touchTarget.min`, 64) in a `View style={{ alignItems: 'center' }}` (a Button without `fullWidth` aligns to the start, `Button.tsx:150`) |
| Footer gap | `spacing.sm` |

## Decisions

- **D1. OopsScreen's layout, unchanged.** The spec says so (3.5); the extra buttons go into the same footer under the
  hero, in the order of the wireframe. The secondary button is filled (`brand.secondary`) because it is a real way on
  for a sibling; the grown-up button is a ghost because it is for someone else and rare.
- **D2. Busy without new words, and an answer after every try.** The spec adds no "Trying" string. While a try runs,
  every footer button is `softDisabled` (on the web drawn as disabled, still focusable, a press does nothing; on
  native it becomes plain `disabled`, `Button.tsx:106-108`), and an inner `View` of the screen carries
  `accessibilityState={{ busy: true }}` (`aria-busy` on the web; `Screen` has no prop for it). Holding Choose another
  learner and A grown-up can help too means a try never races the chooser or the gate; Try again cannot be pressed
  twice (3.5). No spinner and no motion. A try that ends without success **answers**: the bubble's line is announced
  again (native `AccessibilityInfo.announceForAccessibility(bubble)`; web: the polite region is cleared and filled
  again), so a screen-reader user and a sighted learner both know the try ran (WCAG 4.1.3). DP-1c tests it. No new
  string.
- **D3. The still-stuck line** fills when the third try of the session ends without success and stays for the rest of
  the session (the count is per session, 3.5). It sits in the body, under the bubble, not in the footer, so the
  footer never grows past the screen at 320. When it fills, the body scrolls to its end so the line is in view
  (at 320 with Largest text it is below the first screen otherwise).
- **D4. The same words for both variants** (3.8 fixes them): "your progress" fits a learner, and on a device whose
  list cannot be read the person in front of it is a learner or a grown-up of one.
- **D5. The sheet is a ConfirmSheet** (`design/components/ConfirmSheet/spec.md`): `title` = recoverRecord.title,
  `message` = recoverRecord.body, `cancelLabel` = Not now (first, initial focus), `confirmLabel` = Start fresh on this
  device, `confirmTone` **primary, not danger**. Nothing is deleted at that moment: the per-profile keys and
  `profiles-corrupt` stay (3.6), and the wireframe's rule is no danger colour on this flow. Escape, the backdrop and
  the system back are Not now; focus goes back to A grown-up can help. Native follows the ConfirmSheet's native rule
  (the platform `Alert`, Not now with style `cancel`). After Start fresh the app shows Welcome with Restore, as on a
  new device (3.6); no screen of its own. What Start fresh costs is an owner question (O2).
- **D6. Results line placement (an interpretation of 3.7, for DP-2).** "Under the headline `:504`" is read as under
  the headline block: Hoya, `Heading` and `StarRow` share one centred `View` (`ResultsScreen.tsx:476-507`), and the
  line goes as its last child, after the stars and before the bubble, so the celebration is not split.
  `Body tone="secondary" align="center"`, `Spacer sm` above it. DP-2 may put it straight under the `Heading` if the
  owner reads 3.7 literally.
- **D7. Restore (frame N is the spec; frame N2 is a proposal, owner question O3).** As the spec says (N): the line
  `caregiver.restore.saveLater` takes the place of the notice text, `Body tone="secondary"`; the success card,
  cheering Hoya and **Great** (`caregiver.restore.great.cta`) stay. Proposed (N2): the card drawn as a not-yet
  (`Card` default tone, `Hoya pose="thinking"` 96, the line, `common.buttons.ok` "OK" in place of Great), because a
  success card and "Great" cheer a save that did not happen. No new string either way.
- **D8. The save lines are quiet.** One `Body tone="secondary"` line, no icon, no box, no colour of its own, not a live
  region (each is there when its screen opens and is read in order). Restore is the one exception: its line replaces
  text inside the notice after the restore ran, so it is announced as the notice changes. Profile: above the For
  grown-ups group (Account & more on a self-only device; `saveFailedFor` only). Grown-up area: after the title block
  (title, persona, read-only caption, `ParentDashboardScreen.tsx:124-135`) and before Switch user, while any learner
  on the device is in `saveFailedFor`.
- **D9. Namespace and twin keys (open, for DP-1c, DP-1d and DP-2; owner question O1).** `packages/i18n` has no
  `grownUp` namespace (en: `a11y`, `caregiver`, `common`, `console`, `landing`, `learner`, `report`); the Grown-up
  area's strings live in `caregiver` (`caregiver.dashboard`, `caregiver.grownUpHome`). The same slip was fixed for
  Restore in revision 3a. Proposed: `grownUp.recoverRecord.*` becomes `caregiver.recoverRecord.*` and
  `grownUp.saveTrouble` becomes `caregiver.dashboard.saveTrouble`; the spec's 3.8 table and rows DP-1d and DP-2 change
  with it, before those rows. The English words do not change; the mocks keep the spec's key names. Also:
  `learner.progressReadFailed.tryAgain` repeats `common.buttons.tryAgain` (same words in en, es, ko), so DP-1c can
  reuse it; for `recoverRecord.notNow` Korean has two shipped forms (나중에, 지금은 안 함), and DP-1d picks one on purpose.
- **D10. Wide.** The same single column at the Screen frame's max width (`maxWidth.reading`), as `OopsScreen`; the
  sheet is a centred dialog from the regular class (the ConfirmSheet rule).
- **D11. Spanish and Korean** in `mock/lengths.html` are length drafts for this board only. Korean breaks between
  words (`word-break: keep-all`; DP-1c keeps Korean words whole in RN `Text` too). The reviewed values come with
  DP-1c, DP-1d and DP-2 (R8 draft, F-I18N-001 3.10 review).
- **D12. First focus.** When the screen replaces the navigator (boot) or the chooser (learner variant), the screen
  reader starts on the title (web: the heading gets `tabindex="-1"` and focus; native:
  `AccessibilityInfo.setAccessibilityFocus` on the header).

## Accessibility

- Every button is at least `touchTarget.min` (64) high at every text size (96 and 80 for the first two); the
  accessible name is the visible label.
- Reading and focus order: title (first focus, D12), body, bubble, still-stuck line (when shown), Try again, then the
  one extra button.
- The bubble is `HoyaBubble`'s own polite live region (unchanged) and is announced again after each try that does not
  work (D2); the still-stuck line is announced once.
- The sheet: `role="alertdialog"`, modal, named by its title and described by its body, Not now focused first, so
  no single activation from the opening focus starts the list fresh.
- Contrast: title `text.primary` on `surface.canvas` 15.2:1; body and lines `text.secondary` on canvas 8.0:1; bubble
  text on `feedback.nudgeLight` above 13:1; the ghost label `brand.primary` on canvas 5.1:1.
- At 320 x 568 with Largest text in en, es and ko: no sideways scroll, the footer ends inside the frame, and the
  still-stuck line is in view once the body has scrolled to its end (`tools/capture.mjs`).
- Seen on the lengths board, for DP-1c: at 320 with Largest text the bubble's own 72 px Hoya leaves its text a narrow
  column (a few words a line, and a long Spanish word breaks). This is `HoyaBubble` as shipped, the same on
  `OopsScreen`; it scrolls and nothing is cut, so it is noted, not changed here.

## Constants

Values that are not tokens.

| Where | Value | Derived from |
|---|---|---|
| Hoya size on the screen | 140 | `OopsScreen.tsx` (unchanged) |
| Hoya size in the bubble | 72 | `HoyaBubble.tsx` (unchanged) |
| Hoya size in the Restore card | 96 | `RestoreScreen.tsx` (unchanged) |
| Board frames | 320 x 568 (fixed on the lengths board); tablet frame drawn 640 high | design board only, not UI |

## Owner questions

- **O1.** The `grownUp.*` key paths (D9): move them to `caregiver.*` in the spec before DP-1d and DP-2.
- **O2.** Start fresh's cost (D5). After it, a learner comes back only through Restore (Rescue Code, account or
  file), and `profiles-corrupt` goes 30 days later. The sheet's body ("We kept a copy of it on this device.") does not
  say so. Suggested: add a second line to 3.8, for example "Learners come back with their Rescue Code."
- **O3.** Restore when the save waits (D7): the spec (frame N) or the not-yet card (frame N2).
- **O4.** `learner.profile.saveTrouble` asks the person on a learner screen, possibly a child, to "Free up some
  space". Suggested: send that ask to a grown-up ("Ask a grown-up to free up some space, then open the app again."),
  or show the `saveLater` words on Profile and keep the space ask in the Grown-up area only.

## Review log

- **Round 1 (2026-11-22), three independent reviewers** (spec conformance and code truth; child safety, anti-shame
  and accessibility; copy and i18n). No blockers. Fixed:
  - Majors: the bubble was drawn without `HoyaBubble`'s own 72 px Hoya, so the fit at 320 was not proven, and it now
    is (Values, lengths board); the Grown-up area frame showed a header and card order the dashboard does not have,
    and it is now drawn from `ParentDashboardScreen.tsx` (frame M, D8); the Restore treatment departed from 3.7, so
    frame N now draws the spec and the departure is proposal N2 and owner question O3 (D7); the "footer stays in view"
    claim was not shown, so the lengths frames are now fixed 320 x 568 with a scrolling body, and a capture check
    holds it (D3); a try that did not work gave no answer, so the bubble is announced again after each one (D2).
  - Minors: frames were not 568 high; Results frame named a ScreenHeader it does not have; D6 is now marked as an
    interpretation and cites `:476-507`; the ghost button's centring wrapper; D2's busy wording on native and where
    `busy` goes; D8's Restore exception; first focus (D12); the ghost's contrast figure; D5 says "nothing is deleted
    at that moment"; es "Elegir otro estudiante" and "¿Sigue sin abrirse?"; ko bubble "음, 상자가 안 열려요."; Korean
    breaks between words; D9 names the spec change and the twin keys.
  - Nits: the key `caregiver.restore.great.cta`; Profile's group name on a self-only device; the headline tier in
    frame K is marked unchanged.
  - Left for the owner: O1 to O4. Not changed: a minimum busy hold (the soft-disabled footer may flicker on a fast
    read; the design-system's disabled look is kept, and DP-1c can add a hold if it looks wrong on device).
