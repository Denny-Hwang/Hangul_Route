# Quest leave and resume: the Home resume hero, the check resume page and the save-failed page (design pass, LR-0b)

Spec: `docs/specs/AMENDMENTS-QUEST-LEAVE-RESUME.md` (revision 2, `ready` for LR-0b) sections 3.1 to 3.7, row **LR-0b**
(section 5); built by rows LR-2 (Home), LR-3a and LR-3b (the checks; both wait for OD-LR1 and OD-LR9) and LR-4 (the
save-failed page). LR-1 (Keep playing?) needs no mock (spec section 5); its sheet is drawn once for reference.
Wireframes (revision 2 each, checked against the spec: no change needed): `design/wireframes/home/next-lesson-resume.md`,
`design/wireframes/reviews/check-resume.md`, `design/wireframes/reviews/save-failed.md`,
`design/wireframes/minigame/keep-playing-sheet.md`.
Approval: multi-agent review (CLAUDE.md section 5, owner rule 2026-10-12); the log is at the end of this file.
Audience: any learner, any age (P4 / P5 / P6); the same screens for everyone. Tone: calm and sure, never alarmed.

**The mocks are a design reference, not shipped code.** Every value is a token of `packages/design-system/src/tokens.ts`
as a custom property named after it (`../app-shell/mock/app-shell.css`, `../app-shell/mock/display-nav.css`,
`../learner-shell/mock/learner-shell.css`, and the one token copied at the top of `mock/quest-leave-resume.css`). No
colour literal in a rule; no `colors.feedback.danger`; no emoji; no motion.

| File | Shows |
|---|---|
| `mock/home-resume.html` | Home: A the hero's resume variant, C the plain hero (first day, Start), A on a first day, B the Start again sheet (phone), B wide (centred dialog) |
| `mock/check-resume.html` | the checks: R the reading frame, A the resume page (Hangul Check, Stage Check), C the intro after Start again (unchanged), E the stop sheet with OD-LR1 (c) and with (a), A wide |
| `mock/save-failed.html` | the save-failed page: A ready, A busy, A after 3 tries; F the stop sheet (Daily Review, Stage Check); C a check result with the save-later line (OD-LR8); A wide |
| `mock/keep-playing.html` | Keep playing? over a game (LR-1, reference only: the shipped ConfirmSheet with new words) |
| `mock/greyscale.html` | the state-carrying frames as drawn and in luminance greyscale |
| `mock/frames/*.html` | the same states one per page, filling the window, for the viewport shots |
| `mock/quest-leave-resume.css` | the rules of this pass |
| `tools/build-mocks.mjs` | writes every page from one string table (edit it, not the HTML) |
| `tools/capture.mjs` | the checks below, and the shots |
| `shots/<frame>-{360x740,390x844,1024x768}.png` | each frame on two phones and a tablet in landscape |
| `shots/<frame>-320x568-text200.png`, `-full.png` | each frame on a small phone at 200 % text: the first screen, and the whole page |
| `shots/board-{home-resume,check-resume,save-failed,keep-playing,greyscale}-1280.png` | the boards, full page |

Frames: `home-resume`, `home-plain`, `home-sheet`, `check-reading`, `check-resume`, `stage-check-resume`, `check-stop`,
`save-failed`, `save-failed-stuck`, `save-failed-stop`, `result-save-later`.

The tools need apps/web's install (`pnpm install`, and a Playwright Chromium); in a worktree with no install of its
own, set `NODE_PATH` to a checkout's `apps/web/node_modules`.
`node design/screens/quest-leave-resume/tools/capture.mjs` passes with no finding (11 frames x 4 sizes, 5 boards).

Checks (`tools/capture.mjs`): no sideways scroll; every button, link and switch at least `touchTarget.min` (64) high;
no `feedback.danger`; no emoji and no banned word (`packages/i18n/src/banned-words.json`) in drawn text or accessible
names; no percent and no "n of m" on the check and save-failed frames (the review-copy rule, spec 3.7); every sheet a
modal alertdialog named and described by ids that exist, its first button the one focused, the screen behind inert;
Try again inside the window at every size; the still-stuck line in view once the body has scrolled to its end; the
sheet's last button reachable; the Home hero button at the same place with and without the resume parts.

## Home: the resume variant (LR-2, spec 3.2)

```
 Next lesson                              Caption secondary semibold (eyebrow; the region's name)
 Meet o, u, m and the circle              Heading prompt
 Stage 1 · Meet the Letters · lesson 2 of 3   Caption secondary (unchanged)
 About 4 minutes                          Caption muted (unchanged)
 [[             Continue              ]]  Button primary hero, full width; hint = the caption below
 You can go on from step 3 of 5.          Caption secondary (new)
 Start again                              LinkButton (new), role button, 64 high
 (route) See your Learning Route          LinkButton (unchanged), last
```

### Values

| Part | Component and tokens |
|---|---|
| Hero | as built (`HomeScreen.tsx:300-339`): `Card padding="md" elevation="card"`, the region named by its eyebrow |
| Continue | unchanged `Button tone="primary" size="hero" fullWidth` (`touchTarget.hero`, 96), label `learner.home.next.continue.cta`, accessible name `next.a11y(cta, title)` |
| Caption | `Spacer sm`, then `Caption tone="secondary"`, `learner.home.next.resume.line(step, total)`; also the button's `accessibilityHint` (web: `aria-describedby`) |
| Start again | `LinkButton` (`components/LinkButton.tsx`: `touchTarget.min` high and wide, `Body` semibold `tone="brand"`, `paddingHorizontal: spacing.md`), no icon, in a `View style={{ alignSelf: 'flex-start' }}` as the route link |
| Route link | unchanged, after Start again |
| Sheet | `ConfirmSheet`: `title` = `.resume.sheet.title`, `message` = `.resume.sheet.message`, `cancelLabel` = `.resume.sheet.keep.cta` (first, initial focus on the web), `confirmLabel` = `.resume.startAgain.cta`, `confirmTone` primary; `testID` `home-start-again` |

## The checks (LR-3a, LR-3b, spec 3.4; drawn with OD-LR1 (c) and OD-LR9 (b))

```
 [x]                                 Aa        route header (Close leaves; the place is kept)
              [Hoya waving 120]
               Hangul Check                    the check's DisplayHeadline (unchanged)
        Pick up where you left off?            Heading title (new; first focus)
 [[              Continue                 ]]   Button primary hero, full width
 [              Start again               ]    Button secondary lg, full width
```

### Values

| Part | Component and tokens |
|---|---|
| Reading (Panel R) | the intro's top column as is (`StageReviewScreen.tsx:323-332`: `Hoya pose="waving" size={120}`, `Heading level="display"`), no body, no switch, no buttons; `accessibilityState={{ busy: true }}` on the column. The Stage Check reads inside its existing loading frame (not redrawn) |
| Resume page | the same top column, then `Spacer md`, `Heading level="title" align="center"` = `learner.stageReview.resume.title`, `Spacer xl`, `Button tone="primary" size="hero" fullWidth` = `common.buttons.continue`, `Spacer md`, `Button tone="secondary" size="lg" fullWidth` = `learner.stageReview.resume.startAgain.cta` (`touchTarget.child`, 80); the level check's resume page (`screens/placement/ResumeScreen.tsx`) is the model |
| Stage Check | the same page with its own title (`learner.stageCheck.title`) and the `END_HOYA` size it already uses |
| Intro after Start again | unchanged (body, `AttemptSwitch`, Let's go, Maybe later) |
| Stop sheet | the shipped one (`StageCheckScreen.tsx:180-194` and the Hangul Check's), body `learner.stageReview.leave.bodyKept` with OD-LR1 (b) or (c), the shipped `.leave.body` with (a) |

## The save-failed page (LR-4, spec 3.5)

```
 [x]                                 Aa        route header (Close asks: Panel F)
              [Hoya thinking 140]
        We could not save this yet.           Heading title, centred (first focus)
        Your answers are still here.          Body secondary, centred
   Still stuck? You can stop for now ...      Body secondary; after 3 tries; polite live region
 ------------------------------------------  Screen footer (pinned)
 [[              Try again                ]]  Button primary hero, full width; softDisabled while a try runs
```

### Values

| Part | Component and tokens |
|---|---|
| Screen | `Screen tone="canvas"` with `footer`, as `OopsScreen` and `ProgressReadFailedScreen`: the footer is pinned and the body scrolls |
| Hoya | `Hoya pose="thinking" size={140}` (as OopsScreen) |
| Gaps | `Spacer lg` Hoya to title, `sm` title to body, `lg` body to the still-stuck line |
| Title | `Heading level="title" align="center"`, `accessibilityRole="header"`, focused when the page opens |
| Body | `Body tone="secondary" align="center"` |
| Still-stuck line | `Body tone="secondary" align="center"` in a `View accessibilityLiveRegion="polite"`, always mounted, empty until the third try in a row ends without success |
| Try again | `Button tone="primary" size="hero" fullWidth`, `common.buttons.tryAgain`; `softDisabled` while a try runs, and the screen's inner `View` carries `accessibilityState={{ busy: true }}` |
| Stop sheet | the screen's own (Daily Review: `learner.dailyReview.leave.title`, `.stay.cta` first, `.stop.cta`; Stage Check: `learner.stageReview.leave.title`, `.stay.cta`, `.stop.cta`), message `learner.dailyReview.saveFailed.leaveBody` |
| Save-later line (OD-LR8) | `Body tone="secondary" align="center"`, `learner.results.saveLater`, under the stars (`Spacer sm` above), no icon, no box, not a live region |

## Decisions

- **D1. The Home caption sits under the button, the link under the caption.** The spec and wireframe say so; the shot
  check holds it: the hero button's top is the same in `home-resume` and `home-plain` at every size, so nothing moves
  when the read lands (spec 3.2). The caption is `Caption tone="secondary"` (as the where line) rather than muted, so it
  reads as information, not as a footnote.
- **D2. Start again on Home is a LinkButton, not a ghost Button.** The wireframe calls it "a quiet link"; the hero
  already has one link of that kind (the Learning Route). Same component, no icon, so Continue stays the one strong way
  on and the two links read as one family. It is placed before the route link (spec 3.2: "The Learning Route link stays
  last").
- **D3. Both Home sheets and both stop sheets are the shipped ConfirmSheet.** Cancel first (paper, `border.strong`,
  the initial focus on the web), confirm second, `confirmTone` primary, never danger: on a learner screen danger is
  never drawn (ConfirmSheet spec, tokens.ts). The wireframes draw the cancel in `[[ ]]` (primary); the shipped
  ConfirmSheet draws the confirm filled. The mocks follow the shipped component and the spec (`confirmTone 'primary'`),
  not the wireframe's brackets, so the four sheets of this amendment look like every other learner sheet.
- **D4. The still-stuck line is in the body, not the footer** (as the read-failed screen's D3): the footer never grows
  past a 320 x 568 screen at 200 % text. When it fills, the body scrolls to its end so the line is in view
  (`save-failed-stuck-320x568-text200.png`, checked by `tools/capture.mjs`). Spec 3.5 says "a line shows above the
  button": in the body, under the body text, it is directly above the footer.
- **D5. No HoyaBubble on the save-failed page.** OopsScreen and the read-failed screen have one; spec 3.5 lists only
  Hoya, title, body and Try again, and the page must stay calm and short. Hoya `thinking` is the one pose (never a sad
  one).
- **D6. Busy is the soft-disabled look, with no new words and no spinner** (as the read-failed screen's D2). A try that
  fails again announces the title once, politely (spec 3.5). No minimum busy hold is drawn; LR-4 may add one if it
  flickers on a device.
- **D7. The resume page has no body line and no count.** Spec 3.4: Hoya, the check's title, the question, Continue,
  Start again. No "parts done", no "n of m", no percent (the review-copy rule; checked on every check frame). The
  reading-practice switch is not shown (the run keeps its choice).
- **D8. The reading frame (Panel R) is the intro's top with nothing under it**, `aria-busy` on the column, no spinner
  (at most 800 ms; a spinner would flash). When the page comes in, focus goes to the resume title (web: `tabindex=-1`;
  native: `setAccessibilityFocus`), or stays at the intro's top when the normal intro comes.
- **D9. The stop sheet is drawn with both OD-LR1 answers.** (c) (recommended): "You can keep going later." (a): the
  shipped "You can take it again any time." Nothing else on the sheet changes. LR-3a picks the line the owner decides.
- **D10. Wide.** Home: the same hero in the main column (as the shipped hero); the sheets become a centred dialog from
  600 px (`layout.breakpoint.regular`, ConfirmSheet's rule) with the cancel-first row. The check and save-failed pages
  keep one column at the Screen frame's max width (`layout.maxWidth.reading`).
- **D11. es and ko are not drawn.** Each row (LR-2, LR-3a, LR-4) carries its reviewed es and ko values (spec 3.7). The
  longest English lines fit at 320 x 568 at 200 % text, with the page scrolling and nothing cut. Korean breaks between
  words (`word-break: keep-all` in RN `Text` is the rows' concern, as for DP-1c).

## Accessibility

- Every button, link and switch is at least `touchTarget.min` (64) high at every size (96 for the hero buttons, 80 for
  the resume page's Start again); the accessible name is the visible label (Continue on Home adds the lesson title, as
  today, and the caption as its hint).
- Home reading order: eyebrow, title, where, minutes, Continue, caption, Start again, the route link.
- Check resume: title (the check's), the question (first focus), Continue, Start again. Reading frame: busy.
- Save-failed: title (first focus), body, the still-stuck line (when shown), Try again. Try again is busy while a try
  runs and cannot be pressed twice; a try that fails again announces the title once (polite); the still-stuck line is
  announced once, when it fills.
- Every sheet: `role="alertdialog"`, modal, named by its title and described by its message; the safe choice (Keep my
  place, Keep going, Back to it, Keep playing) first and focused on the web; on native the screen reader enters the
  Modal and reads title, message, the safe choice, then the other; nothing behind it can be reached (`inert`, checked).
- Greyscale (`board-greyscale-1280.png`): every state differs by words and shape, not by colour alone (the resume
  hero's caption and link; the sunken, muted busy button; the focus ring on the safe choice; the two resume buttons'
  size and order).
- Contrast: title `text.primary` on `surface.canvas` 15.2:1; body,
  captions and the save-later line `text.secondary` on canvas 8.0:1, on paper 8.4:1; the minutes line `text.muted` on
  paper 6.0:1; the LinkButton label `brand.primaryDark` on paper 7.7:1; `text.onPrimary` on `brand.primary` 5.4:1;
  `text.onSecondary` on `brand.secondary` 5.2:1 (WCAG 2.x, computed from tokens.ts).

## Constants

Values that are not tokens.

| Where | Value | Derived from |
|---|---|---|
| Hoya on the check pages | 120 | `StageReviewScreen.tsx` intro (unchanged); the Stage Check keeps its `END_HOYA` |
| Hoya on the save-failed page | 140 | `OopsScreen.tsx` (unchanged) |
| Hoya in the Home header | 56 | `design/screens/learner-shell/mock/home-hero.html` (unchanged) |
| The reading frame's limit | 800 ms | spec 3.3 / 3.4 (`SAVED_RUN_READ_MS`) |
| The still-stuck line | after 3 tries in a row | spec 3.5 |
| Board frames | 390 wide; drawn 640 high | design board only, not UI |
| Shot sizes | 360 x 740, 390 x 844, 320 x 568 at 200 % text, 1024 x 768, boards at 1280 | design only |

## Owner questions

- **O1. OD-LR1 and OD-LR9** (spec section 10) are still open; the mocks draw the recommendations ((c), (b)) and the
  stop sheet with both lines (D9). Nothing else in the mocks depends on them.
- **O2. Home caption tone** (D1): secondary (drawn) or muted (as the minutes line). Secondary is proposed, because it
  says what Continue will do.
- **O3. The Stage Check's resume page** reuses the Hangul Check's keys (spec 3.7); its page title is the Stage Check's
  own. No new question.

## Review log

- **Round 0 (2026-11-24), author's checks before review.** `tools/capture.mjs` green on 11 frames at 4 sizes and 5
  boards; the board and frame shots read at 1280, 390, 360, 320 at 200 % text and 1024. Fixed while drawing: the
  reading-practice switch was a 32 px control (the whole row is now the switch, 64 high, as `AttemptSwitch`); the
  still-stuck line sat below the first screen at 320 with 200 % text (the body now scrolls to its end when it fills,
  D4, and a check holds it).
- **Round 0b (2026-11-24), the author's three-lens pass** (spec conformance and code truth; child safety, anti-shame
  and accessibility; copy and i18n). Every drawn string matches spec 3.7 or the shipped dictionary word for word
  (`learner.dailyReview.result.headline.two` "Great work!" on the result frame; the Stage Check's stop sheet uses the
  `learner.stageReview.leave.*` keys, `StageCheckScreen.tsx:183`). Spec section 5 names 390 x 844 and 320 x 568 with
  the largest text (the app's 1.5); the shots use 200 % (the OS text size, a larger case), so the largest-text case is
  covered by it. No finding left open.
- **Round 1: pending.** The independent multi-agent review (CLAUDE.md section 5; lenses: spec conformance and code
  truth; child safety, anti-shame and accessibility; copy and i18n) is to be run on this PR before approval.
