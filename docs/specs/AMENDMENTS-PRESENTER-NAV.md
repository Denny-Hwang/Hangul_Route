Status: ready (spec and wireframe pass PN-0; amends F-TCH-004 §3.5 "Touch and mouse", the control bar, §3.6 phone exception and §3.14, `AMENDMENTS-LECTURE-V2.md` section 18.6; implementation rows in section 16; the owner choices of section 3 carry recommended defaults that the rows build unless the owner picks otherwise)

# Amendment: visible Previous and Next, swipe, and no hidden tap zones on the lecture stage

> Basis: `origin/main` `524961dae` (2026-10-29). Every `file:line` below is at that commit, under `apps/mobile/` unless another root is named.
>
> Wireframe (this PR): `design/wireframes/classroom/lecture-nav.md` (the docked bar with Previous and Next at its two ends, the phone rail, the small-phone fallback, a pointed option, the Help rows, the start hint). It amends `classroom/lecture-presenter.md` C (stage and bar) and `classroom/lecture-phone.md` A to C (the phone bar and its strip). Mocks: row PN-0b.

**Owner report 2026-10-29 (translated):** "In lecture mode the touch areas for going forward and back are too wide, and they often overlap the areas for choosing a quiz answer. When I tap answer 1 or answer 3 it often goes back or forward instead. Show forward and back as visible buttons instead, or also let me swipe. Work out an improvement plan."

**Standing rules that apply here:** audience is anyone at any age (no age wording) · UI strings only through `packages/i18n` (`useMessages`), en + es + ko in the same PR, F-I18N-001 §3.10 style guide and glossary · tokens only, no emoji · reading, listening and writing only · anti-shame (CLAUDE.md §1): nothing on the stage ever marks a pick as wrong · no D1 migration · Worker first for any telemetry key · no PII in telemetry · `CLASS_TRANSFER` untouched · production level: every row ships finished and reviewed by the multi-agent review (MAR).

---

## 0. Summary

| # | Problem found | Change |
|---|---|---|
| 1 | **Every answer option is inert, and the stage owns every touch.** The stage root claims all touches (`Stage.tsx:131-136`, `onStartShouldSetResponder={() => true}`) and maps a tap by thirds (`logic/lecture/shell.ts:282-292`, `gestureCommand`): left third back, the rest forward. Quiz, question, story-check and realia options, order steps, sentence tiles and write-together chips are plain `View role="listitem"` (`QuizParts.tsx:153, 314`, `SequenceSlide.tsx:73`, `WriteTogetherSlide.tsx:254, 318`), so a tap on them falls through. In a 2 x 2 grid options 1 and 3 lie 64 to 67 % inside the left third: every tap on them went **back**; a tap on options 2 and 4 went **forward and revealed the answer**. Full-width rows: a tap on the Korean (left) went back, on the middle forward. | **PN-D1, section 7**: a tap or click on a content target never steps; a touch tap on the stage never steps at all; a mouse click steps forward only on a slide with no content targets. The thirds are removed. |
| 2 | **Phones: the bar's strip sits over the bottom options.** The strip is the bottom 80 px of the stage (`PHONE_BAR_STRIP`, `screens/presenter/stage-metrics.ts:33`), and on a 320 px stage option row 3 / 4 sits at y 208 to 299, so the first tap on option 3 shows the bar and the second lands on the bar's **Previous** (measured at 568 x 320 and 844 x 390: counter 6 / 32, then 5 / 32). | **PN-D2, PN-D3, section 5**: on a phone wide enough, the controls move to a **rail beside the stage** that never covers it and never hides; on a smaller phone the floating bar stays, but the strip goes and only a tap on empty stage area shows the bar. |
| 3 | **The way to move is invisible.** Previous and Next fade after 3 s on every window (`presenter.autoHideMs`, `tokens.ts:326`); on a phone every step hides the bar (`PresenterApp.tsx:613-621`). Swipe exists (`SWIPE_MIN` 60, `SWIPE_RATIO` 1.5) but Help never mentions it (`help.phoneBar` is the only touch hint; `HELP_KEYS` lists keys only). | **PN-D4, PN-D5, sections 5, 6 and 9**: on touch, Previous and Next are always on screen; swipe is defined with an edge guard and multi-touch rule and named in Help and in a one-time start hint. |
| 4 | **A teacher who taps an answer to "pick" it reveals the answer** (option 2 or 4: forward = Reveal). | **PN-D6 (owner choice O2), section 7.3**: a tap on an option **points at it** with a neutral outline that never reveals and never judges; Reveal clears it. |

Keyboard and clicker keys do not change (section 8). The grid does not change (section 9.1).

---

## 1. What was measured

On `origin/main` `524961dae`, a release web build, Playwright with real input (mouse at 1280 x 720 and 1920 x 1080; touch with `isMobile` at 1180 x 820, 568 x 320 and 844 x 390). The deck held 108 slides: Stage 1 letters Check, Stage 3, 4 and 6 life Checks (listen grids, listen-word and listen-sentence rows, reply rows, realia), an order slide, a Sejong story with its checks, a quiz and an activity. Each option was tapped at its centre, on its Korean text and 20 px in from its left edge, starting from the first build each time.

| Layout | Window and input | Option boxes (stage px) | Result of a tap |
|---|---|---|---|
| 2 x 2 grid (listen by sound, picture options, quiz, story check) | 1280 x 720 mouse; stage 1280 x 600, left third ends at x 427 | option 1 x 48-616, option 2 x 664-1232 | 1 and 3: **previous slide**; 2 and 4: **next = the answer is revealed** |
| 2 x 2 grid | 1920 x 1080 mouse; 1180 x 820 touch | the same fractions | the same |
| Full-width rows (listen word / sentence, reply, realia) | every size | 48-1232, 32 % in the left third | Korean text and marker (left): **back**; row centre: **next / reveal** |
| Order (2 x 2 steps) | every size | left column in the left third | left column: **back**; right column: a build step |
| Phone, row 3 / 4 | 568 x 320 and 844 x 390 touch | row 3 / 4 at y 208-299; strip from y 240 | tap 1 on option 3 **shows the bar**; tap 2 (600 ms later) lands on **Previous** (x 59-190, y 240-304 at 568): counter 6 / 32 then **5 / 32** |
| Phone, lesson start | both | the bar shows for 3 s | a tap on the bottom row presses a bar button directly |

Stage padding, the only area no slide draws in, is 48 units: 21 px at 568, 31 px at 844, 48 px at 1280, 72 px at 1920. A phone has no empty margin where a 64 px button could sit without covering content, so a visible control on a phone needs room taken from the stage (section 5.2).

Only two stage controls take input today: `SpeakerButton` (letter, syllable, quiz and question listen) and an activity's **Start timer**. Both are `Pressable`s that claim the responder first, so they never step. The design intent "the room answers by pointing: nothing on a question slide takes input but the speaker" (`e2e/web/presenter-questions.spec.ts` header) stays: the room still answers by pointing; this amendment only stops the teacher's tap from doing the wrong thing.

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| PN-D1 | **No hidden tap zones.** A touch tap on the stage never steps. A tap or click on a content target (section 7.1) never steps. A mouse click steps **forward** anywhere on a slide that has no content targets (no left-third back; Previous is on the bar and on the keys). | The thirds are what the owner hit; a zone the presenter cannot see cannot be learned. A mouse click to go on is the presentation habit (a laptop at the projector), and it is kept only where nothing on the slide looks pointable. |
| PN-D2 | **Docked windows (tablet, desktop, projector, interactive whiteboard): Previous at the start of the bar and Next / Reveal at its end**, the tools between them. On a touch device the pair **never fades**; the rest of the bar keeps D3's auto-hide. | Both thumbs reach the two ends of a tablet; the band already reserves the space under the stage, so nothing covers the slide. |
| PN-D3 | **Phones: a rail at the side of the stage** (owner choice O1, default) holding More, Sound, Previous and Next / Reveal, always shown, never over the slide. The stage box is the window minus the safe-area insets and the rail. A phone too narrow for the rail (a stage under 568 px wide with it) keeps the floating bar with the strip removed (section 5.3). | Visible controls without covering the bottom options; on most landscape phones (667 x 375 and wider) the slide shrinks by 11 to 14 %, never under the smallest stage the slide checks already pass. |
| PN-D4 | **Swipe is a first-class gesture on every window**: left = next, right = previous, at least 60 px, at least 1.5 x more horizontal than vertical, one finger, not starting at the window's side edge (section 6). It works over content targets. | The owner asked for it; it is what a phone and a whiteboard user try first; it never conflicts with pointing at an option. |
| PN-D5 | **Help names the touch controls, and the first lesson on a device shows a one-line hint** (section 9). | Swipe existed and nobody knew. |
| PN-D6 | **Pointing at an option** (owner choice O2, default): a tap or click on an answer option draws a neutral dashed outline with a pin; never a reveal, never a colour that judges; any step clears it. Keys `1` to `4` do the same. | The owner's mental model is "tap to choose the answer". This answers it without giving the answer away, and gives the teacher a way to show the room's pick. |
| PN-D7 | **Keys, clicker, grid unchanged.** | They were never the problem; a clicker user must notice nothing. |
| PN-D8 | **A kill switch for the phone rail only** (`EXPO_PUBLIC_PRESENTER_RAIL`, section 15). The tap rules of PN-D1 are a defect fix and ship without a switch. | The rail changes the phone stage size; everything else removes a fault. |

## 3. Owner choices (recommended defaults are what the rows build)

| # | Choice | Options | Recommended default | Rows it changes |
|---|---|---|---|---|
| **O1** | Phone layout | **(a) Rail beside the stage, always visible** · (b) floating bar shown by a tap on empty stage area, hidden at every step (today's bar without the strip) · (c) two corner buttons over the slide | **(a)**, with (b) as the automatic fallback on phones too narrow for the rail | PN-4 |
| **O2** | What a tap on an answer option does | **(a) Points at it (neutral outline, never reveals)** · (b) nothing (the tap is swallowed) | **(a)** | PN-5 (with (b), PN-5 is dropped and Help has no point row) |
| **O3** | Rail side | **(a) right** · (b) left · (c) a Help switch | **(a) right** (Next under the right thumb, where it already sits on the docked bar) | PN-4 |
| **O4** | Mouse click on a slide with no content targets | **(a) next, anywhere** · (b) today's thirds · (c) nothing | **(a)** | PN-2 |
| **O5** | Touch tap on empty stage area (docked windows and the rail) | **(a) nothing** · (b) next on slides with no content targets | **(a)** (one rule for touch: buttons or swipe) | PN-2 |
| **O6** | Docked bar order | **(a) Previous first, Next last, tools between** · (b) today's order (Previous and Next together at the right) | **(a)** | PN-3 |
| **O7** | One-time start hint | **(a) yes, once per device** · (b) no | **(a)** | PN-3 |
| **O8** | Navigation counts in `lecture.complete` | **(a) yes (counts and a layout code only)** · (b) no | **(a)** | PN-1, PN-3 |

Any choice the owner changes is applied by editing this table and the rows named; nothing else in this amendment depends on another choice, except that O2 (b) removes section 7.3, the `point` Help row and the `1` to `4` keys.

## 4. The navigation model per window

`layout` is decided once per window size (pure, `logic/lecture/stage-scale.ts`, next to `isPhoneWindow`): `'docked'` for every non-phone window, `'rail'` for a phone window where the rail fits (section 5.2), `'overlay'` for a phone window where it does not. `pointer` is the kind of the last `pointerdown` on the page (`'mouse'`, or `'touch'` for touch and pen; `'touch'` until one is seen when `matchMedia('(pointer: coarse)')` matches, else `'mouse'`), read by a capture listener in `platform/presenter.web.ts` (`subscribePointerKind`).

| Window | Previous / Next | Touch tap on the stage | Mouse click on the stage | Swipe | Keys |
|---|---|---|---|---|---|
| Docked, touch (tablet 1180 x 820, whiteboard 1920 x 1080) | two ends of the docked bar, **never fade** | nothing; on an option: point (O2) | as the mouse row | yes | unchanged |
| Docked, mouse (laptop at a projector, 1280 x 720, 1920 x 1080) | two ends of the docked bar, fade after 3 s, back on any activity (D3) | as the touch row | target-free slide: **next**; a slide with targets: nothing; on an option: point (O2) | yes (a mouse drag) | unchanged |
| Rail (phone 667 x 375 to 932 x 430) | the rail, **always shown** | nothing; on an option: point | — | yes | unchanged |
| Overlay (phone under the rail gate: 568 x 320, 640 x 360) | the floating bar: shown at the start, by a tap on **empty** stage area, while focused; hidden at every step | empty area: **show or hide the bar**; on an option: point; on another target: nothing | — | yes | unchanged |

## 5. Visible Previous and Next

### 5.1 The docked bar (amends F-TCH-004 §3.5 "Control bar" and README D3)

- **Order** (O6): `[ Previous ]` at the start of the band, then the status chips (flex), then Sound, Timer, Blank, Slides, Full screen (where the browser has it) and Exit, and `[[ Next / Reveal ]]` at the end. The focus order follows the visual order. Exit is never next to Next: Sound sits between them.
- **Size and look unchanged**: every button `touchTarget.hero` (96) with a visible text label; Next is the primary fill (`brand.primary` with `text.onPrimary`), at least `NEXT_MIN_WIDTH`; Previous the secondary style with its `arrow-left` icon. The band stays `BAR_BAND` (120 px with one row), so no slide moves.
- **Auto-hide on touch.** When `pointer` is `'touch'`, or once any touch has been seen during the lesson (it stays so until Exit), Previous and Next keep full opacity and take taps at all times; the other controls fade after `presenter.autoHideMs` as today and return on any activity. **They never fade during a question** or at any other time on touch. On a mouse-only window D3 is unchanged (the whole bar fades and returns on any pointer, touch or key activity), because the presenter there drives with a clicker, the keys or a click.
- **Keep controls visible** (Help) keeps the whole bar shown, as today.
- **Projector.** A tablet or laptop mirrored to a projector projects the band too; the pinned pair sits in the band under the slide, never over it. A whiteboard (touch at 1920 x 1080) is a docked touch window.

### 5.2 The phone rail (amends F-TCH-004 §3.6 phone exception; replaces the compact bar where it fits)

- **Gate.** `railFits = isPhoneWindow(...) && (w - insets.left - insets.right - PHONE_RAIL) >= PHONE_RAIL_STAGE_MIN`, with `PHONE_RAIL = touchTarget.hero` (96 px) and `PHONE_RAIL_STAGE_MIN` = 568 (new: the smallest stage width the LV-S slide checks already pass, 568 x 320; `PHONE_STAGE_MIN` stays 560 for the too-small page). Upright phones keep the rotate page.

| Window (landscape, insets) | Stage box with the rail | Unit (today) | Layout |
|---|---|---|---|
| 568 x 320 | 472 (under 568) | 0.44 | **overlay** |
| 640 x 360 | 544 (under 568) | 0.50 | **overlay** |
| 667 x 375 (iPhone SE 2 / 3, 8) | 571 x 375 | 0.45 (0.52) | **rail** |
| 780 x 360 (common Android) | 684 x 360 | 0.53 (0.60) | **rail** |
| 844 x 390, no insets | 748 x 390 | 0.58 (0.65) | **rail** |
| 844 x 390, notch (47 / 47 / 21) | 654 x 369 | 0.51 (0.59) | **rail** |
| 932 x 430, notch (59 / 59 / 21) | 718 x 409 | 0.56 (0.64) | **rail** |

  The smallest rail stage is 568 wide, the same unit (0.44) as the 568 x 320 stage the LV-S slide checks already pass, so no slide family needs a new fit rule; the PN-4 e2e repeats the LV-S fit checks at 667 x 375 and 844 x 390 with the rail to hold it.
- **Place.** The rail is a column `PHONE_RAIL` wide on the right (O3) of the stage box, inside the right safe-area inset, full height between the top and bottom insets, on `surface.sunken` with a `border.strong` rule on its stage side. The stage box is the window minus the four insets minus the rail; `stageScale` letterboxes inside it as today. Nothing of the rail ever overlaps the stage, so no slide content can sit under a control.
- **Controls, top to bottom**: `[ More ]`, `[ Sound ]`, `[ Previous ]`, `[[ Next / Reveal ]]`. Each is the rail's width minus `spacing.xs` on each side (88 px), at least `touchTarget.min` (64) tall; Next / Reveal is `1.5 x touchTarget.min` (96) tall and the primary fill. Icon above a visible label at the body floor (`typography.size.body`, 18), centred, up to two lines; a word never breaks. If the rail is shorter than the four buttons need (`3 x 64 + 96 + 3 x spacing.sm + 2 x spacing.sm` = 328 px), Next drops to 64 tall. The labels are the shipped ones (`bar.more.cta`, `bar.sound.cta`, `bar.prev.cta`, `common.buttons.next` or `bar.reveal.cta`); PN-0b measures them in en, es and ko at 18 px and a PN-4 render test holds that none overflows its button.
- **Never hides.** The rail does not auto-hide and no step hides it. Status chips stay in More's header; the no-voice chip still flashes for 3 s at the top of the stage.
- **More** opens the same sheet as today (`MoreSheet`: Slides, Timer, Blank, Full screen where the browser has it, Keys and help, Exit), over the stage and beside the rail.
- `role="toolbar"`, `aria-orientation="vertical"`, `aria-label` = `bar.label`; focus order top to bottom.

### 5.3 The small-phone fallback (overlay)

A phone window where the rail does not fit, and every phone window while the kill switch is off (section 15), keeps the floating compact bar of F-TCH-004 §3.6 with these changes:

- **The strip is removed** (`inBarStrip`, `barOverlap`, `PHONE_BAR_STRIP` as a hit area, and the grabber go). No part of the stage is a hidden zone.
- **A touch tap on empty stage area** (not a content target, not a stage button) shows the bar, or hides it while it shows. A tap on a content target never touches the bar.
- Unchanged: the bar shows at the lesson start for `presenter.autoHideMs`, every step hides it at once, it shows while focus is inside it, it hides after `presenter.autoHideMs` with no touch on it, it takes taps only `BAR_SHOW_GRACE_MS` (400) after it shows, and Keep controls visible pins it (trading the bottom of the slide for the buttons). In this layout, Previous and Next are hidden during a question unless the teacher pins them; swipe is the way to move there, and the hint and Help say so (`nav.hintOverlay`, `help.phoneBar`).

### 5.4 Auto-hide, in one table

| Layout and pointer | Previous / Next | Other controls |
|---|---|---|
| Docked, touch | always shown | fade after 3 s; back on any activity |
| Docked, mouse | fade after 3 s; back on any activity | the same |
| Rail | always shown | always shown |
| Overlay | shown at start, by a tap on empty stage, while focused; hidden at every step and after 3 s | the same (one bar) |
| Any, Keep controls visible on | always shown | always shown |
| Any, a covering overlay open (grid, help, blank, pause, full timer, Exit confirm) | as the overlay rules of §3.5 (they swallow navigation) | — |

## 6. Swipe (amends F-TCH-004 §3.5 "Touch and mouse")

A gesture is a pointer going down on the stage and up again, read by `Stage`'s responder handlers as today.

| Rule | Value | Constant |
|---|---|---|
| Horizontal travel for a swipe | `|dx| >= 60` px | `SWIPE_MIN` (unchanged) |
| Angle | `|dx| >= 1.5 x |dy|` (within about 34 degrees of horizontal) | `SWIPE_RATIO` (unchanged) |
| Direction | `dx < 0` (to the left) = next; `dx > 0` = previous | — |
| A tap | `|dx| < 12` and `|dy| < 12` px | `TAP_SLOP = spacing.md` (new; today any move under 60 px counted as a tap) |
| Between a tap and a swipe | nothing (an abandoned move) | — |
| Vertical drag | nothing: the stage never scrolls and never steps on a vertical move | — |
| Two or more touches at any time during the gesture | nothing (a pinch or a two-finger move) | — |
| Start within 16 px of the window's left or right edge (touch only) | nothing: the system back and forward gestures own the edges; a browser back still runs the history rules of §3.5 (Exit confirm) | `EDGE_GUARD = spacing.lg` (new) |
| On a content target | the swipe steps (targets never claim a swipe) | — |
| Starting on a stage button (speaker, Start timer, a rail or bar button) | nothing: the button owns the touch, and the move cancels its press | — |
| Over a covering overlay (grid, help, More sheet, Exit confirm) | nothing: the overlay is above the stage and swallows navigation | — |
| When it fires | on release, never during the move (WCAG 2.5.2) | — |

The page under the presenter sets `overscroll-behavior-x: none` on `html` and `body` while a lesson runs, so a horizontal swipe or a trackpad's two-finger swipe never becomes the browser's own back or forward. The stage keeps `touch-action: manipulation` (no double-tap zoom). No drag-follow animation: the slide changes on release, as with a key.

## 7. Taps and clicks on the stage (removes the thirds)

### 7.1 Content targets

A **content target** is a part of a slide the room points at. Each is marked with `dataSet={{ stageTarget: '<kind>' }}` (rendered as `data-stage-target`), and options also carry their index (`'option:1'` to `'option:4'`):

| Slide kind (component) | Targets | Marker |
|---|---|---|
| Quiz, incl. match sound and picture-word (`QuizSlide.tsx:59`, `QuizParts.tsx:153` card, `:314` row) | each option | `option:n` |
| Story check (`StoryCheckSlide.tsx:85`) | each option | `option:n` |
| Listen and reply question (`QuestionSlide.tsx:110-114`), grid or rows (`tools.ts:91-102 optionLayout`) | each option | `option:n` |
| Realia question (`RealiaQuestionSlide.tsx:69, 118-120`) | each option | `option:n` |
| Sequence, order and steps (`SequenceSlide.tsx:73`) | each step | `step` |
| Sentence build (`SentenceBuildSlide.tsx`) | each line and bank tile | `tile` |
| Write together (`WriteTogetherSlide.tsx:254, 318`) | each word chip and table row | `chip` |

`slideHasTargets(slide)` (pure, `logic/lecture/stage-gesture.ts`) is true for exactly those kinds, whatever the build. Title, letter, syllable, vocab, card, story, sentence, pattern, read along, realia, activity and end slides have none (their speaker and Start timer are stage buttons, not targets). A source test holds every `role="listitem"` that `QuizParts`, `SequenceSlide`, `SentenceBuildSlide` and `WriteTogetherSlide` draw to a `stageTarget` marker.

### 7.2 The rule, pure

```ts
// logic/lecture/stage-gesture.ts (new; replaces gestureCommand and inBarStrip in shell.ts; 100 % covered)
export type StageTarget = { kind: 'none' } | { kind: 'option'; index: number } | { kind: 'other' };
export type StageCommand = 'next' | 'prev' | 'toggle-bar' | { point: number } | null;
export function stageGesture(g: {
  pointer: 'mouse' | 'touch';
  dx: number; dy: number;
  startX: number;          // window px, for the edge guard
  windowWidth: number;
  touches: number;         // the most pointers down at once during the gesture
  target: StageTarget;     // from the DOM node at grant: closest('[data-stage-target]')
  slideHasTargets: boolean;
  layout: 'docked' | 'rail' | 'overlay';
  pointing: boolean;       // owner choice O2
}): StageCommand;
```

1. `touches > 1` -> `null`.
2. A swipe (section 6) -> `'next'` / `'prev'`; a touch swipe that starts within `EDGE_GUARD` of either window edge -> `null`.
3. Not a tap (`|dx| >= TAP_SLOP` or `|dy| >= TAP_SLOP`) -> `null`.
4. A tap on an option -> `{ point: index }` when `pointing`, else `null`. A tap on any other target -> `null`.
5. A tap on empty area: `pointer === 'mouse'` and `!slideHasTargets` -> `'next'` (O4); `pointer === 'touch'` and `layout === 'overlay'` -> `'toggle-bar'`; otherwise `null` (O5).

`Stage` reads the target at grant from the event's DOM node (`event.target`, web; `closest('[data-stage-target]')`), so the stage stays the only gesture owner and the slides stay presentational. `inBarStrip`, `barOverlap` and `TAP_BACK_FRACTION` are deleted with their tests.

### 7.3 Pointing at an option (owner choice O2)

- `PresenterState` gains `pointed: number | null`; the reducer (`logic/lecture/controls.ts`) gains the event `{ point: n }`: it sets `pointed = n`, or clears it when `n` is already pointed; it does nothing when the slide has no option `n`, and nothing under a covering overlay (overlays swallow it as they swallow navigation). **Any step clears it**: `next` (a reveal build included), `prev`, `first`, `last`, `goto`. So the answer is never shown with a pick still outlined, and nothing on the stage can read as "your pick was wrong".
- **Look**: a dashed outline (`STAGE_BORDER` units, `text.primary`) around the option and the `pin` icon at its marker, so colour is never the only cue; no fill change, no `feedback` colour, no motion (it appears at once with or without reduced motion). One option at a time.
- **Keys**: `1` to `4` send `{ point: n }` (with the key rules of §3.5 amendment point 5: not with `Ctrl`, `Meta` or `Alt`, not on auto-repeat, not while focus is on a button). They map to nothing on a slide with no options. No clicker sends them, so a clicker sees no change.
- **Announced**: the live region says `a11y.presenter.pointed(n)` or `a11y.presenter.unpointed`.
- Never stored, never sent (only the count `points`, section 12), never in Recent.

## 8. Keyboard and clicker (unchanged)

The key map of F-TCH-004 §3.5 (`logic/lecture/keymap.ts`, `platform/presenter.web.ts` `subscribeKeys`) is unchanged: next `ArrowRight`, `ArrowDown`, `PageDown`, `Space`, `Enter`; previous `ArrowLeft`, `ArrowUp`, `PageUp`, `Backspace`; and every tool key. The only addition is `1` to `4` for pointing (O2), which no clicker sends. A keyboard step on a phone in the overlay layout still hides the bar; on the rail and the docked bar nothing hides.

## 9. The grid, Help and the start hint

### 9.1 Grid

Unchanged: `G` or **Slides** opens it; a `goto` lands on the first build and clears `pointed`; swipes and taps inside the grid never step the lesson.

### 9.2 Help (Keys and controls)

The overlay gains a **Touch and mouse** group above the key rows (`help.touch.*`), in every layout:

- `help.touch.swipe` — Swipe left to go on, right to go back.
- `help.touch.buttons` — Or tap Previous and Next.
- `help.touch.click` — With a mouse, click the slide to go on (not on question slides).
- `help.touch.point` (O2) — Tap an answer to point at it. It does not show the answer.
- `help.phoneBar` (changed; overlay layout only) — On this phone, tap the slide to show the controls.

`HELP_KEYS` gains the row `point` (`1`, `2`, `3`, `4`; O2). The rows are pure data in `logic/lecture/help-keys.ts` with the touch rows in a new `HELP_TOUCH` list (`'swipe' | 'buttons' | 'click' | 'point'`), so a test holds them to the rules of sections 6 and 7.

### 9.3 Start hint (O7)

On the first lesson a device runs with `pointer === 'touch'`, a `StageHint` shows for `presenter.autoHideMs` x 2 (6 s) at the top of the stage: `nav.hint` (docked and rail) or `nav.hintOverlay` (overlay). It takes no taps and covers no target (top padding, as the no-voice chip). Seen once, the key `lecture:navHint` = `'1'` is written to local storage (try / catch; a blocked storage shows it each lesson, never an error); no other data. Help keeps the same lines for later.

## 10. Reduced motion

`prefers-reduced-motion: reduce`: the docked bar's fade, the overlay bar's fade and the hint's fade become instant; the pointed outline is instant in every case; a swipe never animates the slide in any case. Nothing new moves.

## 11. Accessibility

- **Alternatives to the gesture** (WCAG 2.5.1, 2.5.7): every swipe has the Previous and Next buttons and the keys.
- **Pointer cancellation** (2.5.2): every step fires on release; a swipe pulled back under 60 px does nothing.
- **Target size** (2.5.8): the docked buttons stay 96; the rail and the overlay bar buttons at least 64; content targets are large cards already.
- **Contrast** (1.4.3, 1.4.11): Next keeps `brand.primary` with `text.onPrimary`; Previous and the rail buttons draw `text.primary` on `surface.paper` with a `border.strong` edge on `surface.sunken`; the pointed outline is `text.primary` on `surface.paper` (above 3:1).
- **Focus not obscured** (2.4.11): the rail and the docked band never overlap the stage; a focused control keeps its bar shown (unchanged).
- **Screen readers**: VoiceOver and TalkBack own swipes, so the stage never sees one; Previous, Next and the keys work. The rail is a vertical toolbar. The live region announces each step (unchanged) and a pointed option.
- **Orientation**: unchanged (the rotate page on an upright phone).
- **Language of the stage** (`lang`, WCAG 3.1.2): unchanged; the rail and Help are chrome in the device language.

## 12. Telemetry (amends F-TCH-004 §3.14; owner choice O8)

No new event name. **`lecture.complete` gains seven keys**, all whole numbers except `navLayout`:

| Key | Value | Counts |
|---|---|---|
| `navLayout` | `'docked' \| 'rail' \| 'overlay'` | the layout at Start |
| `stepsButton` | 0-100000 | `next` / `prev` from a bar or rail button |
| `stepsSwipe` | 0-100000 | from a swipe |
| `stepsKey` | 0-100000 | from a key or clicker |
| `stepsClick` | 0-100000 | from a mouse click on the stage |
| `quickBacks` | 0-100000 | a `prev` within 2 s of a forward step (`QUICK_BACK_MS`), the sign of a step taken by mistake |
| `points` | 0-100000 | `{ point }` events (O2) |

Bounds are `LECTURE_REVEALS_MAX` (`packages/backend/src/lib/server-events.ts:220`). **Worker first** (row PN-1): `LECTURE_PAYLOAD_RULES['lecture.complete']` gains the keys and bounds before any app build sends them; until then the Worker drops them (unknown keys are dropped). The client tally (`logic/lecture/shell.ts` `RunTally`, `tallyStep`, `completePayload`) counts by source; `userDispatch` passes the source. No coordinates, no slide or option ids, no timings per step, no profile id (there is none), no deck title. Display and pointing choices are never sent.

## 13. Strings (en / es / ko)

New and changed keys land in the row that draws them, in all three locales; es and ko follow F-I18N-001 §3.10 (es: neutral Latin-American, tú, "mouse"; ko: 해요체, no particle attached to a variable). Glossary as shipped: Previous = Anterior = 이전; Next = Siguiente = 다음; Reveal = Mostrar = 다음 보기; option = opción = 선택지; slide = diapositiva = 슬라이드.

| Key (`learner.presenter.*` unless named) | Row | en | es | ko |
|---|---|---|---|---|
| `help.touch.title` | PN-3 | Touch and mouse | Pantalla táctil y mouse | 터치와 마우스 |
| `help.touch.swipe` | PN-3 | Swipe left to go on, right to go back. | Desliza a la izquierda para avanzar y a la derecha para volver. | 왼쪽으로 밀면 다음으로, 오른쪽으로 밀면 이전으로 가요. |
| `help.touch.buttons` | PN-3 | Or tap Previous and Next. | O toca Anterior y Siguiente. | 이전, 다음 버튼을 눌러도 돼요. |
| `help.touch.click` | PN-3 | With a mouse, click the slide to go on (not on question slides). | Con el mouse, haz clic en la diapositiva para avanzar (no en las preguntas). | 마우스로 슬라이드를 클릭하면 다음으로 가요. 문제 슬라이드에서는 안 돼요. |
| `help.touch.point` | PN-5 | Tap an answer to point at it. It does not show the answer. | Toca una opción para señalarla. No muestra la respuesta. | 선택지를 누르면 표시만 돼요. 정답은 보여 주지 않아요. |
| `help.row.point` | PN-5 | Point at an answer | Señalar una opción | 선택지 표시하기 |
| `help.phoneBar` (changed) | PN-4 | On this phone, tap the slide to show the controls. | En este teléfono, toca la diapositiva para ver los controles. | 이 휴대폰에서는 슬라이드를 누르면 조작 버튼이 보여요. |
| `nav.hint` | PN-3 | Swipe, or tap Previous and Next. | Desliza o toca Anterior y Siguiente. | 화면을 밀거나 이전, 다음 버튼을 눌러요. |
| `nav.hintOverlay` | PN-4 | Swipe to move. Tap the slide to show the controls. | Desliza para avanzar o volver. Toca la diapositiva para ver los controles. | 화면을 밀어서 넘겨요. 슬라이드를 누르면 조작 버튼이 보여요. |
| `a11y.presenter.pointed` (`n`) | PN-5 | Option {n} pointed at | Opción {n} señalada | {n}번 선택지를 표시했어요 |
| `a11y.presenter.unpointed` | PN-5 | No option pointed at | Ninguna opción señalada | 표시한 선택지가 없어요 |

Removed: none (`help.phoneBar` stays, reworded, for the overlay layout only). The `help.touch.*` values are reviewed against the as-built rules in their row's MAR (one Spanish and one Korean reviewer pass), and `length-budget.test.ts` covers the hint lines at 568 x 320.

## 14. Tests (per row)

**Viewport and input matrix** (the four windows; each with the inputs a real device of that size has):

| Id | Window | Inputs | Layout |
|---|---|---|---|
| V1 | 568 x 320 phone (`isMobile`, touch) | touch | overlay |
| V2 | 844 x 390 phone (`isMobile`, touch), with and without notch insets | touch | rail |
| V3 | 1180 x 820 tablet | touch, and mouse (a tablet with a trackpad) | docked |
| V4 | 1920 x 1080 projector or whiteboard | mouse, and touch (a whiteboard) | docked |

1280 x 720 mouse stays in the existing specs; 667 x 375 runs the rail fit checks (PN-4).

**Slide kinds**: title, letter, syllable, vocab, card, quiz (2 x 2 text, picture-word, match sound, odd one out), story, story check, question listen grid, question listen-word and listen-sentence rows, reply rows, realia, realia question (rows and grid), sequence order and steps, sentence, sentence build, pattern, read along, write together, activity, end.

| File | Row | Asserts |
|---|---|---|
| `packages/backend/src/lib/__tests__/server-events.test.ts` (extend) | PN-1 | `lecture.complete` keeps `navLayout` from its list and the six counts within 0-100000 as whole numbers; a negative, a fraction, a string, an unknown layout and any other key are dropped; old payloads unchanged |
| `apps/mobile/src/logic/lecture/__tests__/stage-gesture.test.ts` (new; replaces the `gestureCommand` and `inBarStrip` cases of `shell.test.ts:751-764, 776-784`) | PN-2 | every rule of section 7.2 in order: two touches; a swipe left and right at exactly 60 and 1.5, at 59 and at 1.49; an edge start at 15 and 16 px on both edges (touch only; a mouse drag at the edge still swipes); a tap at slop 11 and 12; a tap on an option with and without `pointing`; a tap on a step, tile or chip; an empty tap by mouse on a target-free slide (next), by mouse on a target slide (null), by touch on docked, rail (null) and overlay (`toggle-bar`); no input ever gives `'prev'` from a tap |
| `apps/mobile/src/logic/lecture/__tests__/slide-targets.test.ts` (new) | PN-2 | `slideHasTargets` per kind (the section 7.1 list exactly) for every build; a source scan: every `role="listitem"` in `QuizParts`, `SequenceSlide`, `SentenceBuildSlide` and `WriteTogetherSlide` carries `stageTarget`, options with their index |
| `apps/mobile/src/logic/lecture/__tests__/stage-scale.test.ts` (extend) | PN-4 | `navLayout`: the table of section 5.2 row by row (568 x 320 and 640 x 360 overlay; 667 x 375, 780 x 360, 844 x 390 with and without insets, 932 x 430 rail; 1180 x 820 and 1920 x 1080 docked; an upright phone the rotate page); the stage box with the rail is the window minus insets minus 96; the kill switch off gives overlay on every phone window |
| `apps/mobile/src/logic/lecture/__tests__/controls.test.ts` (extend) | PN-5 | `{ point: n }` sets and toggles; an index with no option does nothing; every step (`next` incl. a reveal build, `prev`, `first`, `last`, `goto`) clears it; covering overlays swallow it; `pointed` never survives a slide change |
| `apps/mobile/src/logic/lecture/__tests__/keymap.test.ts`, `help-keys.test.ts` (extend) | PN-3, PN-5 | the existing next and previous keys unchanged (the PR 4 cases kept verbatim); `1`-`4` map to `{ point }` only without modifiers and repeat, and nothing while focus is on a control; `HELP_TOUCH` rows match section 9.2; the `point` row lists exactly `1`-`4` |
| `apps/mobile/src/logic/lecture/__tests__/shell.test.ts` (extend) | PN-3 | `tallyStep` counts by source; `quickBacks` at 1999 and 2000 ms; `completePayload` carries the seven keys and nothing else; `navLayout` from Start |
| `apps/mobile/src/screens/presenter/__tests__/control-bar.test.tsx` (extend) | PN-3, PN-4 | docked order Previous first and Next last with Sound between Exit and Next; on touch Previous and Next keep opacity 1 and `pointer-events` after `presenter.autoHideMs` while the rest fade; on mouse all fade; the rail's four buttons in order with the vertical toolbar role; no rail label overflows its button in en, es and ko at the body floor |
| Playwright `apps/mobile/e2e/web/presenter-nav.spec.ts` (new) | PN-2 to PN-5 | for every slide kind of the list, at V1 to V4 with each input of the matrix, starting from the first build: a tap at the centre, on the Korean and 20 px in from the left edge of every content target leaves the counter and the build unchanged and presses no control (with O2, the option carries `data-pointed="true"` and nothing else changes); a touch tap on empty stage does nothing (V2, V3, V4) or toggles the bar (V1); a mouse click on empty stage steps forward on a target-free slide and does nothing on a slide with targets; a swipe left and right from the centre and from the middle of an option steps once; a vertical drag (dx 30, dy 120), a diagonal at ratio 1.2 and a two-finger swipe do nothing; a touch swipe starting 10 px from the left window edge does nothing; on touch at V2, V3, V4 Previous and Next are visible and enabled at the start, after 5 s idle, after a step and on every question slide, and intersect no content target and no stage text; at V1 after a step the bar is hidden and a tap on option 3 then option 4 changes nothing; a swipe inside the grid, Help and the More sheet steps nothing; the start hint shows once per device on touch and never on mouse; the live region names a pointed option |
| Playwright `apps/mobile/e2e/web/presenter.spec.ts:313-321` (rewritten) | PN-2 | "a click on a slide with nothing to point at goes on; the left of the stage no longer goes back": a mouse click at 10 % and at 80 % both go on on the title slide; on a question slide neither click moves |
| Playwright `presenter-phone.spec.ts:104, 110`, `presenter-sound.spec.ts:175, 181`, `audio-engine.spec.ts:230, 481` (rewritten) | PN-2, PN-4 | `tapStage` becomes a swipe left (`swipeStage`), `tapStrip` becomes a tap on empty stage at V1 or nothing at the rail sizes (the rail is always shown: the specs press `presenter-sound` directly); the "no element of the new slide meets a visible control" check runs with the rail shown at 844 x 390 and 667 x 375 |
| Playwright `presenter-reading.spec.ts`, `presenter-questions.spec.ts`, `presenter-write.spec.ts`, `presenter-build.spec.ts` (extend) | PN-4 | the LV-S fit checks also at 667 x 375 and 844 x 390 with the rail (nothing leaves the stage, no text spills, no text below the floor) |
| i18n coverage ratchets (`es-coverage.ts`, `ko-coverage.ts`), `length-budget.test.ts`, banned-word lint | PN-3, PN-4, PN-5 | es and ko present for every new and changed key |

## 15. Rollout and kill switch

1. **PN-0** (this PR) merges; **PN-0b** draws the mocks (multi-agent design review).
2. **PN-1** (Worker) deploys before any build that sends the new keys.
3. **PN-2** (the tap rules and swipe) ships as soon as it merges, with no switch: it removes the defect on every device, changes no layout and adds no string. Rollback is a revert PR.
4. **PN-3** (docked bar order and pinning, Help, start hint, counts) after PN-1 is deployed.
5. **PN-4** (the phone rail and the small-phone fallback) behind **`EXPO_PUBLIC_PRESENTER_RAIL`**, a kill switch read with `parseKillSwitch` (`config/flags.ts`, flag `presenterRail`, launch default **on**). Off: every phone window uses the overlay layout of section 5.3 (the floating bar without the strip); the tap rules of PN-2 stay. Switching it needs a rebuild and redeploy of the learner web build (as with `EXPO_PUBLIC_LECTURE_MODE`); the owner runbook gains one line.
6. **PN-5** (pointing) after the owner confirms O2.
7. **Watch**: `quickBacks` per lecture and the split of `stepsButton`, `stepsSwipe`, `stepsKey`, `stepsClick` by `navLayout` for two weeks after PN-4. A rail lecture with more `quickBacks` per step than docked ones, or a phone owner report, is the trigger to switch the rail off and revisit O1.
8. The presenter is the learner web build behind its service worker: an open lesson keeps the old rules until the next load; no saved data changes shape (`lecture:navHint` is new and optional).

## 16. PR breakdown (implementation rows)

Every UI row links its PN-0b mock and attaches screenshots at V1 to V4 (plus 667 x 375 for PN-4); every row adds en, es and ko in the same PR; shared files (`telemetry.ts`, i18n messages, `scripts/i18n-migrated.json`, `index.ts`) are touched append-only. No D1 migration.

| Row | Content | Size | Depends on |
|---|---|---|---|
| **PN-0** (this PR) | `docs(specs,design)`: this amendment; wireframe `classroom/lecture-nav.md`; wireframe index row; pointer lines in F-TCH-004 §3.5, §3.6, §3.14, `AMENDMENTS-LECTURE-V2.md` §18.6, `classroom/lecture-phone.md`, `classroom/lecture-presenter.md`, `docs/specs/README.md` | S | — |
| **PN-0b** | `design(presenter)`: mocks with MAR: `design/screens/presenter/stage-and-bar.md` (docked order and the pinned pair at 1180 x 820 and 1920 x 1080; the rail at 667 x 375, 844 x 390 with a notch and 932 x 430; the overlay fallback at 568 x 320 without the grabber), `overlays.md` (Help with the Touch and mouse group in en, es, ko), `slide-quiz.md` and `slide-listen-reply.md` (a pointed option, grid and rows); rail labels measured in en, es, ko at 18 px; shots | M | PN-0 |
| **PN-1** | `feat(backend)`: `LECTURE_PAYLOAD_RULES['lecture.complete']` gains `navLayout` and the six counts (section 12); tests; **deploys first** | S | PN-0 |
| **PN-2** | `feat(mobile)`: `logic/lecture/stage-gesture.ts` (`stageGesture`, `slideHasTargets`, `TAP_SLOP`, `EDGE_GUARD`), `stageTarget` markers on every content target of section 7.1, `Stage.onRelease` on the new rule (target read at grant, the most touches counted), `subscribePointerKind`, `overscroll-behavior-x: none` while a lesson runs; `gestureCommand`, `inBarStrip`, `barOverlap` and `TAP_BACK_FRACTION` deleted; the overlay bar's strip replaced by a tap on empty stage (the strip and grabber go on every phone); the rewritten e2e cases of section 14; no string | M | PN-0 |
| **PN-3** | `feat(mobile)`: docked bar order (O6) and the pinned pair on touch (section 5.1); Help's Touch and mouse group and `HELP_TOUCH`; the start hint (O7) and `lecture:navHint`; navigation counts in the tally and `completePayload` (O8); strings `help.touch.title`, `swipe`, `buttons`, `click`, `nav.hint` in en, es, ko | M | PN-1 deployed, PN-2, PN-0b |
| **PN-4** | `feat(mobile)`: `navLayout` and the rail gate (`PHONE_RAIL`, `PHONE_RAIL_STAGE_MIN`) in `stage-scale.ts` and `stage-constants.ts`; the rail (`PhoneRail` in `ControlBar.tsx`, the More sheet beside it); the stage box minus the rail; the overlay fallback copy (`help.phoneBar` changed, `nav.hintOverlay`); the kill switch `presenterRail` (`EXPO_PUBLIC_PRESENTER_RAIL`); LV-S fit checks at 667 x 375 and 844 x 390; the owner runbook line | L | PN-2, PN-3, PN-0b |
| **PN-5** | `feat(mobile)`: pointing (O2): `pointed` and `{ point }` in the reducer, the dashed outline and pin on option cards and rows, keys `1`-`4`, the live-region lines, Help's point rows; strings `help.touch.point`, `help.row.point`, `a11y.presenter.pointed`, `unpointed` | S | PN-2, owner O2 |

Parallel lanes: PN-1 and PN-2 at once after PN-0; PN-0b beside them. Progress counting: 7 rows (PN-0 to PN-5 with PN-0b).

## 17. Edits to the amended specs (pointer lines in this PR; text in the rows named)

- **F-TCH-004 §3.5** "Touch and mouse": the thirds are replaced by section 7 and swipe by section 6 (PN-2); "Control bar": the order and the touch pinning of section 5.1 (PN-3). **§3.6** phone exception: the rail of section 5.2 where it fits, the overlay of section 5.3 elsewhere, the strip and grabber removed (PN-2, PN-4). **§3.14**: `lecture.complete` keys (PN-1, PN-3).
- **`AMENDMENTS-LECTURE-V2.md` §18.6** and its test row for `presenter-phone.spec.ts` ("a tap on the stage advances without showing the bar; a tap in the bar's strip shows it"): superseded by sections 5.2, 5.3 and 14 (PN-2, PN-4).
- **Design docs** repeating the thirds or the strip are updated in PN-0b: `design/screens/presenter/stage-and-bar.md:12, 43`, `design/screens/presenter/README.md:95`, `design/wireframes/classroom/lecture-presenter.md:105, 285`, `lecture-phone.md:47, 130, 132`, `lecture-big-screen-v2.md:133`, `design/screens/presenter/mock/presenter-or.css:26-27`.

## 18. Open items

- **Trackpad two-finger swipe** (a laptop at a projector): with `overscroll-behavior-x: none` it no longer leaves the page, but it does not step either (wheel events are not read). Adding it is a later, separate change if asked.
- **Left-handed rail**: O3 (c), a Help switch, is not built; revisit if the owner or a report asks.
- **Native builds** (deferred track): the rule is pure and the targets are markers, but the target lookup at grant uses the DOM; a native build reads the target from the responder's `target` tag instead. Not needed while lecture mode is web only.
- **A phone cast to a TV** shows the rail on the TV too (it mirrors the window). Accepted: it sits beside the slide, never over it.

## 19. Review log

- 2026-10-29, PN-0 (this PR): measured on `524961dae` (section 1, Playwright with real mouse and touch input at 1280 x 720, 1920 x 1080, 1180 x 820, 568 x 320 and 844 x 390); the sources of the stage, the bar, the gesture rule and the key map read at that commit. Multi-agent review of this PR to follow (interaction design and accessibility, phone layout geometry, privacy and telemetry, Spanish, Korean).
