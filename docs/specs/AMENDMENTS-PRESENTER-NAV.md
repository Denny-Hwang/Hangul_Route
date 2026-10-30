Status: ready (spec and wireframe pass PN-0; amends F-TCH-004 §3.5 "Touch and mouse", the control bar, §3.6 phone exception and §3.14, `AMENDMENTS-LECTURE-V2.md` section 18.6; implementation rows in section 16; the owner choices of section 3 carry recommended defaults that the rows build unless the owner picks otherwise; decided 2026-10-29: the owner confirmed every recommended default; mocks PN-0b)

# Amendment: visible Previous and Next, swipe, and no hidden tap zones on the lecture stage

> Basis: `origin/main` `524961dae` (2026-10-29). Every `file:line` below is at that commit. Paths starting `logic/`, `screens/`, `platform/` or `config/` are under `apps/mobile/src/`; `PresenterApp.tsx`, `e2e/` and `scripts/` are under `apps/mobile/`; any other root is named in full.
>
> Wireframe (this PR): `design/wireframes/classroom/lecture-nav.md` (the docked bar with Previous and Next at its two ends, the phone rail, the small-phone fallback, a pointed option, the Help rows, the start hint). It amends `classroom/lecture-presenter.md` C (stage and bar) and `classroom/lecture-phone.md` A to C (the phone bar and its strip). Mocks: row PN-0b.

**Owner report 2026-10-29 (translated):** "In lecture mode the touch areas for going forward and back are too wide, and they often overlap the areas for choosing a quiz answer. When I tap answer 1 or answer 3 it often goes back or forward instead. Show forward and back as visible buttons instead, or also let me swipe. Work out an improvement plan."

**Standing rules that apply here:** audience is anyone at any age (no age wording) · UI strings only through `packages/i18n` (`useMessages`), en + es + ko in the same PR, F-I18N-001 §3.10 style guide and glossary · tokens only, no emoji · reading, listening and writing only · anti-shame (CLAUDE.md §1): nothing on the stage ever marks a pick as wrong · no D1 migration · Worker first for any telemetry key · no PII in telemetry · `CLASS_TRANSFER` untouched · production level: every row ships finished and reviewed by the multi-agent review (MAR).

---

## 0. Summary

| # | Problem found | Change |
|---|---|---|
| 1 | **Every answer option is inert, and the stage owns every touch.** The stage root claims all touches (`Stage.tsx:131-136`, `onStartShouldSetResponder={() => true}`) and maps a tap by thirds (`logic/lecture/shell.ts:282-292`, `gestureCommand`): left third back, the rest forward. Quiz, question, story-check and realia options, order steps, sentence tiles and write-together chips are plain `View role="listitem"` (`QuizParts.tsx:153, 314`, `SequenceSlide.tsx:73`, `WriteTogetherSlide.tsx:254, 318`), so a tap on them falls through. In a 2 x 2 grid options 1 and 3 lie 64 to 67 % inside the left third: every tap on them went **back**; a tap on options 2 and 4 went **forward and revealed the answer**. Full-width rows: a tap on the Korean (left) went back, on the middle forward. | **PN-D1, section 7**: a tap or click on a content target never steps; a touch tap on the stage never steps at all; a mouse click steps forward only on a slide with no content targets. The thirds are removed. |
| 2 | **Phones: the bar's strip sits over the bottom options.** The strip is the bottom 80 px of the stage (`PHONE_BAR_STRIP`, `screens/presenter/stage-metrics.ts:33`), and on a 320 px stage option row 3 / 4 sits at y 208 to 299, so the first tap on option 3 shows the bar and the second lands on the bar's **Previous** (measured at 568 x 320 and 844 x 390: counter 6 / 32, then 5 / 32). | **PN-D2, PN-D3, section 5**: on a phone wide enough, the controls move to a **rail beside the stage** that never covers it, never hides and keeps at least 32 px of inert space from every option (section 5.0); 640 x 360 class phones get a compact icon rail; only the smallest phones (568 x 320) keep the floating bar, with the strip removed, shown only by a tap on empty stage area. |
| 3 | **The way to move is invisible.** Previous and Next fade after 3 s on every window (`presenter.autoHideMs`, `tokens.ts:326`); on a phone every step hides the bar (`PresenterApp.tsx:613-621`). Swipe exists (`SWIPE_MIN` 60, `SWIPE_RATIO` 1.5) but Help never mentions it (`help.phoneBar` is the only touch hint; `HELP_KEYS` lists keys only). | **PN-D4, PN-D5, sections 5, 6 and 9**: on touch, Previous and Next are always on screen; swipe is defined with an edge guard and multi-touch rule and named in Help and in a start hint shown until the device's first button or swipe step (at most three lessons); on touch, a tap on empty stage rings Next instead of stepping. |
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
| PN-D2 | **Docked windows (tablet, desktop, projector, interactive whiteboard): Previous at the start of the bar and Next / Reveal at its end**, the tools between them; on a wide touch window (a whiteboard, 1600 px and wider) Previous sits beside Next at the end instead (owner choice O9). On a touch device the pair **never fades**; the rest of the bar keeps D3's auto-hide. | Both thumbs reach the two ends of a tablet; a teacher at the side of a 2 m board reaches one end, not two; the band already reserves the space under the stage, so nothing covers the slide. |
| PN-D3 | **Phones: a rail at the side of the stage** (owner choice O1, default) holding More, Next / Reveal, Previous and Sound, always shown, never over the slide, with an inert gap on its stage side (section 5.0). The stage box is the window minus the safe-area insets and the rail. A phone too narrow for the full rail gets the compact icon rail (O10); only a phone too narrow for that (568 x 320) keeps the floating bar with the strip removed (section 5.3). | Visible controls without covering the bottom options; on landscape phones of 640 x 360 and wider the slide shrinks by 11 to 16 %, never under the phone gate (`PHONE_STAGE_MIN`, 560). |
| PN-D4 | **Swipe is a first-class gesture on every window**: left = next, right = previous, at least 60 px, at least 1.5 x more horizontal than vertical, one finger, not starting at the window's side edge (section 6). It works over content targets. | The owner asked for it; it is what a phone and a whiteboard user try first; it never conflicts with pointing at an option. |
| PN-D5 | **Help names the touch controls, a one-line hint shows at the start of a lesson until the device's first button or swipe step (at most three lessons), and a touch tap on empty stage rings Next** (sections 7.2 and 9). | Swipe existed and nobody knew; a teacher used to tapping the slide needs to see where to tap now. |
| PN-D6 | **Pointing at an option** (owner choice O2, default): a tap or click on an answer option draws a neutral dashed outline with a pin; never a reveal, never a colour that judges; any step clears it. Keys `1` to `4` do the same. | The owner's mental model is "tap to choose the answer". This answers it without giving the answer away, and gives the teacher a way to show the room's pick. |
| PN-D7 | **Keys, key-sending clickers and the grid unchanged.** | They were never the problem; a clicker that sends keys must notice nothing. A clicker in air-mouse mode sends clicks and follows the mouse rule (O4). |
| PN-D8 | **A kill switch for the phone rail only** (`EXPO_PUBLIC_PRESENTER_RAIL`, section 15). The tap rules of PN-D1 are a defect fix and ship without a switch. | The rail changes the phone stage size; everything else removes a fault. |

## 3. Owner choices (recommended defaults are what the rows build)

**Decided 2026-10-29:** the owner confirmed every recommended default below: the phone rail on the right, always visible (O1 a, O3 a), a tap on an answer points at it with a neutral dashed outline (O2 a), and O4 to O10 as recommended.

| # | Choice | Options | Recommended default | Rows it changes |
|---|---|---|---|---|
| **O1** | Phone layout | **(a) Rail beside the stage, always visible** · (b) floating bar shown by a tap on empty stage area, hidden at every step (today's bar without the strip) · (c) two corner buttons over the slide | **(a)**, with (b) as the automatic fallback on phones too narrow for the rail (decided 2026-10-29) | PN-4 |
| **O2** | What a tap on an answer option does | **(a) Points at it (neutral outline, never reveals)** · (b) nothing (the tap is swallowed) | **(a)** (decided 2026-10-29) | PN-5 (with (b), PN-5 is dropped and Help has no point row) |
| **O3** | Rail side | **(a) right** · (b) left · (c) a Help switch | **(a) right** (Next under the right thumb, where it already sits on the docked bar; decided 2026-10-29) | PN-4 |
| **O4** | Mouse click on the stage | **(a) next anywhere on a slide with no content targets; nothing on a slide with targets** · (b) today's thirds · (c) nothing · (d) next on empty area of any slide (a click on a target still never steps) | **(a)**. A clicker in air-mouse mode (it sends a left click, not a key) then stops on question slides and needs its key mode or the keyboard; (d) keeps it moving, at the cost of a near-miss click beside an option revealing the answer | PN-2 |
| **O5** | Touch tap on empty stage area (docked windows and the rail) | **(a) no step; Next shows a 1 s ring to say where to tap** · (b) next on slides with no content targets | **(a)** (one rule for touch: buttons or swipe) | PN-2 |
| **O6** | Docked bar order | **(a) Previous first, Next last, tools between** · (b) today's order (Previous and Next together at the right) | **(a)** | PN-3 |
| **O7** | Start hint | **(a) yes, on touch, until the device's first button or swipe step, at most three lessons** · (b) no | **(a)** | PN-3 |
| **O8** | Navigation counts in `lecture.complete` | **(a) yes (counts and a layout code only)** · (b) no | **(a)** | PN-1, PN-6 |
| **O9** | Docked bar order on a wide touch window (an interactive whiteboard, window 1600 px wide or more with a touch pointer) | **(a) Previous beside Next at the end** (the teacher at the side of the board reaches both) · (b) the two ends, as a tablet (O6) · (c) Previous at the start and a second Previous beside Next | **(a)** | PN-3 |
| **O10** | Phones too narrow for the full rail (640 x 360 class) | **(a) a compact rail: icon-only buttons, `touchTarget.min` square, the label as the accessible name** · (b) the floating bar (section 5.3), as on 568 x 320 | **(a)**: the buttons stay visible; the arrows are named in Help and in the start hint (decided 2026-10-29) | PN-4 |

Any choice the owner changes is applied by editing this table and the rows named; nothing else in this amendment depends on another choice, except that O2 (b) removes section 7.3, the `point` Help row and the `1` to `4` keys, and O10 (b) moves the 640 x 360 rows of section 5.2 to the overlay layout.

## 4. The navigation model per window

`layout` is decided once per window size (pure, `logic/lecture/stage-scale.ts`, next to `isPhoneWindow`): `'docked'` for every non-phone window, `'rail'` for a phone window where the full or the compact rail fits (section 5.2; `railSize: 'full' | 'compact'` says which), `'overlay'` for a phone window where neither does.

Two pointer facts, read in `platform/presenter.web.ts` by the existing `subscribeInputKind` (`presenter.web.ts:828`, used at `PresenterApp.tsx:519`), extended to report `'mouse' | 'touch' | 'key'` instead of `'pointer' | 'key'` (no second page listener):

- **The gesture's own pointer** (for the tap rules of section 7): taken from the responder grant event, `nativeEvent.type` `'touchstart'` = `'touch'`, `'mousedown'` = `'mouse'`. A mouse-type event counts as `'touch'` when the last `pointerdown` had `pointerType` `'pen'` (Windows Chrome sends pen input as mouse events).
- **Touch seen** (for pinning, section 5.1, and the start hint, section 9.3): true from the start when `matchMedia('(any-pointer: coarse)')` or `matchMedia('(hover: none)')` matches, and from the first `pointerdown` with `pointerType` `'touch'` or `'pen'`; it stays true until Exit. A whiteboard or a touch panel that reports a fine primary pointer still matches `any-pointer: coarse` or `hover: none` in almost every case; one that matches neither and sends only mouse events is a mouse window (Keep controls visible pins everything there, and the hint and Help say so).

| Window | Previous / Next | Touch tap on the stage | Mouse click on the stage | Swipe | Keys |
|---|---|---|---|---|---|
| Docked, touch seen (tablet 1180 x 820, whiteboard 1920 x 1080) | two ends of the docked bar (beside each other at the end on a wide touch window, O9), **never fade** | nothing (Next shows a short emphasis, section 7.2); on an option: point (O2) | as the mouse row | yes | unchanged |
| Docked, mouse only (laptop at a projector, 1280 x 720, 1920 x 1080) | two ends of the docked bar, fade after 3 s, back on any activity (D3) | as the touch row | target-free slide: **next**; a slide with targets: nothing; on an option: point (O2) | yes (a mouse drag) | unchanged |
| Rail (phone 640 x 360 to 932 x 430; compact at 640 x 360 class) | the rail, **always shown** | nothing (Next shows a short emphasis); on an option: point | — | yes | unchanged |
| Overlay (phone under the compact rail gate: 568 x 320; every phone with the kill switch off) | the floating bar: shown at the start, by a tap on **empty** stage area, while focused; hidden at every step | empty area: **show or hide the bar**; on an option: point; on another target: nothing | — | yes | unchanged |

## 5. Visible Previous and Next

### 5.0 Clearance (every layout)

A visible control is only safe if a finger that misses a target by a fingertip does not land on it (contact error is about 7 to 10 mm, 28 to 38 CSS px). So:

- **`NAV_CLEARANCE = spacing.xxl` (32 px)**: between the box of any content target (section 7.1) and the hit area of any rail or bar button there are at least 32 window px that take no tap (stage padding, letterbox, the rail's inert gap or the band's own padding). It is a window-px rule, not a stage-unit rule, so it holds at the smallest stage.
- **Rail**: the rail's stage side is an inert gap `PHONE_RAIL_GAP = spacing.md` (12 px) inside the rail column (no hit area of a rail button reaches into it). With the smallest rail stage (unit 0.4375, 560 wide) the stage padding is 48 units = 21 px, so the clearance is 21 + 12 = 33 px. What this guarantees is the clearance: a tap aimed at a content target, missed by up to 32 px, presses no rail button. A fingertip inside the rail's own 12 px strip is a tap beside a button, and a browser's touch adjustment may give it to the nearest rail button, as beside any button (section 5.2 as built); that press is one the presenter aimed at the rail, never at an answer.
- **Docked band**: the stage padding (48 units, at least 38 px at 1024 x 768) plus the band's `spacing.md` top padding (12 px) keep the bottom options at least 50 px from the band buttons on every docked window.
- **Overlay**: the floating bar covers the stage while shown, so it cannot meet the rule; that is why it is kept only below the compact rail gate (section 5.3, and section 18 Open items).
- An e2e holds it: `presenter-nav.spec.ts` measures, at every layout of the matrix, the distance between every content target box and every visible control box (section 14).

### 5.1 The docked bar (amends F-TCH-004 §3.5 "Control bar" and README D3)

- **Order** (O6): `[ Previous ]` at the start of the band, then the status chips (flex), then Exit, Full screen (where the browser has it), Slides, Blank, Timer and Sound, and `[[ Next / Reveal ]]` at the end. The focus order follows the visual order. Exit is never next to Next: Sound sits between them.
- **Wide touch window** (O9: window 1600 px wide or more with touch seen): `[ Previous ]` moves to just before Next: chips, Exit, Full screen, Slides, Blank, Timer, Sound, `[ Previous ]`, `[[ Next / Reveal ]]`. A teacher standing at the side of a 75 to 86 inch board reaches both without walking across it.
- **When the band wraps** (a tablet such as 1024 x 768, 1080 x 810, 1133 x 744, or upright 820 x 1180, where one row does not hold everything): Previous and Next stay on the **bottom row at its two ends** (or together at its end, O9); the tools wrap onto a row above them, and if two rows do not hold them either, Timer, Blank and Slides move into a **More** button on the bottom row (the same `MoreSheet` the phone uses). The band grows by one row (`BAR_BAND` per row), the stage shrinks to match; nothing overlaps the stage. **Measured in PN-0b**: a tool never shrinks or breaks onto a third row; Spanish needs the More fallback on an upright iPad (744 px of tools in 720 px at 768 x 1024, in 696 px at 744 x 1133), where More sits on the bottom row just before Next (just before Previous under O9) and its sheet holds the three tools it took; en and ko fit two rows there. The wrapped band keeps the focus order Previous, the chips, the tools, More, Next, so the step pair stays first and last although the tools row is drawn above.
- **As built (PN-3 review round 1):** while the docked More sheet is open, the pinned Previous and Next beside it stay opaque and enabled: a press on either, or a step key (arrows, PageDown, Home, End, a clicker), closes the sheet and then steps; a tool key (G, B, T, H) closes it and opens its tool; a swipe or tap on the stage left visible still steps nothing (section 5.2). The band keeps each control's last measured width until new labels report their own (a language or text-size change mid-lesson), so it never falls back to an unmeasured row. When a wider window no longer needs More, the sheet closes and focus goes to Next. Only on a band too narrow for even More's two rows (a narrow mouse window at a large text size; no tablet PN-0b measured) do the tools left on it (Exit, Full screen, Sound) wrap onto a second tools row, so no control is clipped; the band grows by `BAR_BAND` again.
- **Size and look unchanged**: every button `touchTarget.hero` (96) with a visible text label; Next is the primary fill (`brand.primary` with `text.onPrimary`), at least `NEXT_MIN_WIDTH`; Previous the secondary style with its `arrow-left` icon. The band is `BAR_BAND` (120 px) when its controls fit one row, as today, so on those windows no slide moves; the wrap rule above covers the rest.
- **Auto-hide on touch.** When touch is seen (section 4), Previous and Next keep full opacity and take taps at all times; the other controls fade after `presenter.autoHideMs` as today and return on any activity. **They never fade during a question** or at any other time on touch. On a mouse-only window D3 is unchanged (the whole bar fades and returns on any pointer, touch or key activity), because the presenter there drives with a clicker, the keys or a click.
- **How it is built.** The fade lives in `PresenterApp.tsx` (`barHidden`, `showBar`, `hideBarNow` and the 3 s timer, `PresenterApp.tsx:513-545`); `ControlBar` only receives `hidden`, and the docked bar fades as one `Animated.View` whose `pointerEvents` follow `live` (`ControlBar.tsx:214`), which waits `BAR_SHOW_GRACE_MS` after every show. `ControlBar` gains an explicit prop `pinNav: boolean`; when it is true, Previous and Next render **outside** the fading `Animated.View` (same band, same places), always opaque, always `pointerEvents: 'auto'`, and **exempt from the 400 ms grace**, so the first tap after the tools faded is never lost. The tools keep the fade and the grace.
- **Keep controls visible** (Help) keeps the whole bar shown, as today.
- **Projector.** A tablet or laptop mirrored to a projector projects the band too; the pinned pair sits in the band under the slide, never over it. A whiteboard (touch at 1920 x 1080) is a docked touch window.

### 5.2 The phone rail (amends F-TCH-004 §3.6 phone exception; replaces the compact bar where it fits)

- **Sizes.** The full rail column is `PHONE_RAIL = touchTarget.hero + spacing.sm` (104 px): the inert gap `PHONE_RAIL_GAP` (12) on the stage side, buttons 88 wide, `spacing.xs` (4) on the window side. The compact rail (O10) is `PHONE_RAIL_COMPACT = touchTarget.min + spacing.md + spacing.xs` (80 px): the same 12 px gap, icon-only buttons `touchTarget.min` (64) square, 4 px on the window side.
- **Gate.** With `free = w - insets.left - insets.right` and `PHONE_STAGE_MIN` (560, the existing phone gate, `logic/lecture/stage-constants.ts:181`): `railSize = 'full'` when `isPhoneWindow(...) && free - PHONE_RAIL >= PHONE_STAGE_MIN`; else `'compact'` when `free - PHONE_RAIL_COMPACT >= PHONE_STAGE_MIN`; else the overlay layout. Upright phones keep the rotate page. No new stage minimum: a rail stage is never narrower than the stage the phone gate already allows. **Height (added in the PN-4 review, 2026-10-30):** the rail's height `h - insets.top - insets.bottom` must also hold its four buttons as drawn, so no two ever overlap: the full rail needs `2 x max(More, Sound) + Next + Previous + 5 x spacing.sm`, each button its drawn height (a one-line 18 px label button is 69 px: 2 + 4 + 32 + 4 + 21 + 4 + 2; two lines 90), so 316 px with one-line labels; the compact rail needs `4 x 64 + 5 x 8` = 296 px. A window short of the full rail's need gets the compact rail, and one short of 296 the overlay layout (a 360 dp Android phone in landscape Chrome with its bars showing, about 780 x 280).

| Window (landscape, insets) | Free width | Layout | Stage box | Unit (today) |
|---|---|---|---|---|
| 568 x 320 | 568 | **overlay** (full 464, compact 488: under 560) | 568 x 320 | 0.44 (0.44) |
| 640 x 360 | 640 | **compact rail** | 560 x 360 | 0.44 (0.50) |
| 667 x 375 (iPhone SE 2 / 3, 8) | 667 | **rail** | 563 x 375 | 0.44 (0.52) |
| 780 x 360 (common Android) | 780 | **rail** | 676 x 360 | 0.53 (0.60) |
| 844 x 390, no insets | 844 | **rail** | 740 x 390 | 0.58 (0.65) |
| 844 x 390, notch (47 / 47 / 21) | 750 | **rail** | 646 x 369 | 0.50 (0.59) |
| 932 x 430, notch (59 / 59 / 21) | 814 | **rail** | 710 x 409 | 0.55 (0.64) |
| 844 x 330 (iPhone Safari with its toolbar) | 844 | **rail**, Next at its label height | 740 x 330 | 0.55 |
| 844 x 300 | 844 | **compact rail** (height under 316) | 764 x 300 | 0.50 |
| 780 x 280 (360 dp Android, Chrome bars showing) | 780 | **overlay** (height under 296) | 780 x 280 | 0.47 |

  The smallest rail stage is 560 to 563 wide (unit 0.4375 to 0.44), within 1.5 % of the 568 x 320 stage the LV-S slide checks already pass and inside the phone gate; the PN-4 e2e repeats the LV-S fit checks at 640 x 360 (compact) and 667 x 375 and 844 x 390 (full) with the rail to hold it.
- **Place.** The rail is a column on the right (O3) of the stage box, inside the right safe-area inset, full height between the top and bottom insets, on `surface.sunken` with a `border.strong` rule on its stage side; the inert gap lies between that rule and the buttons. The stage box is the window minus the four insets minus the rail; `stageScale` letterboxes inside it as today. Nothing of the rail ever overlaps the stage, and section 5.0 holds the clearance.
- **Controls, top to bottom**: `[ More ]` at the top, `[[ Next / Reveal ]]` and `[ Previous ]` as a pair **centred in the rail's height**, `[ Sound ]` at the bottom. So no button that steps sits at the rail's ends beside the corner options, and the right thumb rests on Next. Full rail: each button 88 wide, at least `touchTarget.min` (64) tall; Next / Reveal is `1.5 x touchTarget.min` (96) tall and the primary fill; icon above a visible label at the body floor (`typography.size.body`, 18), centred, up to two lines; a word never breaks. If the rail is shorter than the four buttons need with Next at 96 (`2 x max(More, Sound) + 96 + Previous + 5 x spacing.sm`, each as drawn: 343 px with one-line 18 px labels), Next drops to 64 tall (its label may draw it taller). The labels are the shipped ones (`bar.more.cta`, `bar.sound.cta`, `bar.prev.cta`, `common.buttons.next` or `bar.reveal.cta`); PN-0b measures them in en, es and ko at 18 px and a PN-4 Playwright e2e holds that none overflows its button (the label fallback below). Compact rail: the same four in the same order, 64 square: Next / Reveal (`arrow-right` on the primary fill), Previous (`arrow-left`) and Sound (`speaker` / `speaker-off`) icon only, each with its label as the accessible name (`aria-label`); More keeps its short text label (there is no `more` icon today), which PN-0b measures in en, es and ko at 18 px inside 64 px; if one does not fit, PN-4 adds a `more` (three dots) icon to `packages/design-system` `Icon` with its own test and mock line. **Measured in PN-0b** (`design/screens/presenter/stage-and-bar.md` "Navigation (PN-0b)"): every label fits on one line in the system fonts once the full rail's buttons have no side padding (the 2 px border is the edge, 84 px of room; the widest word is "Siguiente", 81.4 px in the iOS system font and 76.6 px in Roboto, but 84.8 px in Noto Sans, a fallback on some Android builds), and More fits 64 px in en, es and ko. The margin is close to none, and a larger browser text size or a wider OEM font widens every word, so **PN-4 builds a label fallback**: the rail measures each label's widest word on the real text; when a full-rail word is wider than its room, the rail draws as the compact rail, and when More's word is wider than the compact rail's 52 px, More shows a `more` (three dots) icon with its label as the accessible name (PN-4 adds the glyph to `Icon` for this case only). No label ever overflows its button. PN-4 holds this with a Playwright e2e that measures real text in Chromium and WebKit (en, es, ko at 18 px, plus one larger text size that takes the fallback), not a render test, which has no text layout.
- **Never hides.** The rail does not auto-hide and no step hides it. Status chips stay in More's header; the no-voice chip still flashes for 3 s at the top of the stage.
- **More** opens the same sheet as today (`MoreSheet`: Slides, Timer, Blank, Full screen where the browser has it, Keys and help, Exit), over the stage and beside the rail. While it is open the stage is **covered**: `moreOpen` joins the `covering` input of the stage gesture (section 7.2), so a swipe or tap on the stage area left visible beside or above the sheet steps nothing and points at nothing; a tap there closes More and does nothing else. (Today the sheet is `pointerEvents="box-none"`, `ControlBar.tsx:313-330`, and `userDispatch`, `PresenterApp.tsx:659-665`, has no `moreOpen` check. The sheet already opens from today's phone bar, so PN-2 adds the check; PN-4 keeps it for the rail.)
- `role="toolbar"`, `aria-orientation="vertical"`, `aria-label` = `bar.label`; focus order top to bottom.
- **As built (PN-4).** The gate is `railSize` and `navLayout(phone, rail)` in `logic/lecture/stage-scale.ts`, with the formulas `phoneRail`, `phoneRailCompact`, `railButtonWidth`, `railNeed` and `railNextHeight` in `stage-constants.ts` (pure, like `barBand`) and the token values `PHONE_RAIL`, `PHONE_RAIL_COMPACT`, `PHONE_RAIL_GAP`, `RAIL_RULE` and `RAIL_LABEL_ROOM` beside `NAV_CLEARANCE` in `screens/presenter/stage-metrics.ts`; `stageBox` takes the rail's column. `PhoneRail` in `ControlBar.tsx`; the presenter lays the stage column and the rail out as a row, so the class tools (Blank, the grid, Help, the full timer) cover the stage only and the rail stays beside them. The label fallback measures every word of More, Next, Reveal, Previous and Sound (Next and Reveal both, so a build never flips the rail) at the chosen text size; it turns a full rail compact and never moves a window to or from the overlay. While More is open the rail stays beside the sheet, opaque and enabled, and follows PN-3's rule for the docked sheet (section 5.1, as built): a press on its Previous or Next closes the sheet and then steps; a swipe or a tap on the covered stage still steps nothing (a tap closes the sheet). A choice of this row: Help's `help.phoneBar` line ("tap the slide to show the controls") shows in the overlay layout only, also on the home's Help, which asks the gate for the window turned sideways. **Touch adjustment**: no rail button's hit area reaches the 12 px gap (what is under a point there is the rail itself), but the browser's own touch adjustment still moves a fingertip in the gap onto the nearest rail button, as beside any button; the 32 px clearance on the stage side is what keeps a tap aimed at a target off the rail (section 5.0), and the PN-4 e2e taps the stage-side gap. **Height gate (review round 1):** the rail's probe also lays out each label in its 84 px room and reports, once every word and label is measured, the four buttons' drawn heights with the label fallback (`onRailMeasure`); `railSize` gates on them through `railNeeds` (`stage-constants.ts`), so the last complete measure stands and a lesson start never flips the rail. Before any measure the gate assumes one line per label at the chosen text size. The rail clips nothing (only its probe clips itself), so a focused button's ring is drawn whole inside a notch inset.

### 5.3 The small-phone fallback (overlay)

A phone window where neither rail fits (568 x 320 class), and every phone window until PN-4 ships or while its kill switch is off (section 15), keeps the floating compact bar of F-TCH-004 §3.6 with these changes:

- **The strip is removed** (`inBarStrip`, `barOverlap`, `PHONE_BAR_STRIP` as a hit area, and the grabber go). No part of the stage is a hidden zone.
- **A touch tap on empty stage area** (not a content target, not a stage button) shows the bar, or hides it while it shows. A tap on a content target never touches the bar.
- **Over a covering tool** (Blank, pause, the full timer, the grid, Help): a touch anywhere still brings the bar back, as today (`PresenterApp.tsx:841-847`), because those tools change no slide and hide no target.
- **Known remaining risk.** Once the teacher shows the bar on a question slide, it covers the bottom option row again, so a next tap aimed at option 3 or 4 can land on Previous or Next. It is now always a tap the teacher made visible on purpose, never a hidden first tap, and swipe needs no bar; it is listed in section 18.
- Unchanged: the bar shows at the lesson start for `presenter.autoHideMs`, every step hides it at once, it shows while focus is inside it, it hides after `presenter.autoHideMs` with no touch on it, it takes taps only `BAR_SHOW_GRACE_MS` (400) after it shows, and Keep controls visible pins it (trading the bottom of the slide for the buttons). In this layout, Previous and Next are hidden during a question unless the teacher pins them; swipe is the way to move there, and the hint and Help say so (`nav.hintOverlay`, `help.phoneBar`).

### 5.4 Auto-hide, in one table

| Layout and pointer | Previous / Next | Other controls |
|---|---|---|
| Docked, touch seen | always shown, taps taken at once (no grace) | fade after 3 s; back on any activity |
| Docked, mouse only | fade after 3 s; back on any activity | the same |
| Rail | always shown | always shown |
| Overlay | shown at start, by a tap on empty stage, while focused; hidden at every step and after 3 s | the same (one bar) |
| Any, Keep controls visible on | always shown | always shown |
| Any, a covering overlay open (grid, help, blank, pause, full timer, Exit confirm, the More sheet) | as the overlay rules of §3.5 (they swallow navigation; section 5.2 for More) | — |

## 6. Swipe (amends F-TCH-004 §3.5 "Touch and mouse")

A gesture is a pointer going down on the stage and up again, read by `Stage`'s responder handlers. Today `Stage` has only grant, release and terminate; PN-2 adds `onResponderStart` and `onResponderMove`, which record the most touches seen at once (`max(nativeEvent.touches.length)`). At grant `Stage` stores the `identifier` of the first touch and its start point; on release `dx` and `dy` come only from the touch with that identifier (in `changedTouches` or `touches`), never from `changedTouches[0]`, which is the last finger lifted. A mouse gesture has one pointer and no identifier.

| Rule | Value | Constant |
|---|---|---|
| Horizontal travel for a swipe | `|dx| >= 60` px | `SWIPE_MIN` (unchanged) |
| Angle | `|dx| >= 1.5 x |dy|` (within about 34 degrees of horizontal) | `SWIPE_RATIO` (unchanged) |
| Direction | `dx < 0` (to the left) = next; `dx > 0` = previous | — |
| A tap | `|dx| < 12` and `|dy| < 12` px | `TAP_SLOP = spacing.md` (new; today any move under 60 px counted as a tap) |
| Between a tap and a swipe | nothing (an abandoned move) | — |
| Vertical drag | nothing: the stage never scrolls and never steps on a vertical move | — |
| Two or more touches at any time during the gesture | nothing (a pinch or a two-finger move), whatever order the fingers lift in | — |
| Start within the edge guard of the window's left or right edge (touch only) | nothing: the system back and forward gestures own the edges | `EDGE_GUARD = max(spacing.xl, inset + spacing.sm)` per side (new): 24 px, or the side's safe-area inset plus 8 when that is larger |
| On a content target | the swipe steps (targets never claim a swipe) | — |
| Starting on a stage button (speaker, Start timer, a rail or bar button) | no step: the button owns the touch and keeps its own press rules (a drag that leaves the button and its retention area cancels the press; a drag that stays on it still presses it, as a lift on it would) | — |
| Over a covering overlay (grid, help, More sheet, Exit confirm) | nothing: the overlay swallows navigation (the More sheet through the `covering` input, section 5.2) | — |
| When it fires | on release, never during the move (WCAG 2.5.2) | — |

The release build already sets `html, body { overscroll-behavior: none; }` and `body { user-select: none }` on every page (`scripts/pwa-postbuild.mjs:104-105`); PN-2 adds nothing there, and a test asserts the rule is still in the built page. That keeps Chromium's overscroll history swipe from leaving the page. It does **not** control iOS Safari's edge back and forward swipe, nor Android's gesture navigation; the edge guard keeps the stage out of those edges, and if the browser's own back does run (a swipe from the very edge, or the phone's Back), it lands on the history rules of §3.5: the Exit confirm, never a silent exit. The stage keeps `touch-action: manipulation` (no double-tap zoom). No drag-follow animation: the slide changes on release, as with a key.

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
| Sentence build (`SentenceBuildSlide.tsx`: the `Tile` component, `:169`, and `ParticleTile`, `:189`; it draws no `role="listitem"`) | each placed tile, particle tile and bank tile | `tile` |
| Write together (`WriteTogetherSlide.tsx:254, 318`) | each word chip and table row | `chip` |

`slideHasTargets(slide)` (pure, `logic/lecture/stage-gesture.ts`) is true for exactly those kinds, whatever the build. Title, letter, syllable, vocab, card, story, sentence, pattern, read along, realia, activity and end slides have none (their speaker and Start timer are stage buttons, not targets). A source test holds every `role="listitem"` that `QuizParts`, `SequenceSlide` and `WriteTogetherSlide` draw to a `stageTarget` marker; for `SentenceBuildSlide`, which draws no list items, a render test holds that every element with testID `presenter-build-placed`, `presenter-build-particle` and `presenter-build-bank-tile` carries `data-stage-target="tile"`. **Any future slide that scrolls, takes a drag or draws a new pointable part must declare in its row how it claims the gesture** (a stage button, a `stageTarget` marker, or a responder of its own that this rule then names); none does today: no slide has a `ScrollView`, `PanResponder`, drag or trace (letter strokes are animations), and only the Grid, Help and More overlays scroll.

**As built (PN-3, after the F-CURR-002 Phase 3 merge, #889):** two slide kinds joined the deck after this section was written. A **Role Play** turn draws its replies with the quiz's option rows (`OptionRows`, each with its `option:n` marker), so `slideHasTargets` is true for it; its chat bubbles are lines to read, not targets. A **Hidden Heritage** slide is a scene the room points at in the room, with nothing pointable on the stage, so it has none (a mouse click there goes on, as on a picture slide). `slide-targets.test.ts` holds both.

### 7.2 The rule, pure

```ts
// logic/lecture/stage-gesture.ts (new; replaces gestureCommand and inBarStrip in shell.ts; 100 % covered)
export type StageTarget = { kind: 'none' } | { kind: 'option'; index: number } | { kind: 'other' };
export type StageCommand = 'next' | 'prev' | 'toggle-bar' | 'close-more' | 'nudge-next' | { point: number } | null;
export function stageGesture(g: {
  pointer: 'mouse' | 'touch'; // the gesture's own pointer (section 4: the grant event's nativeEvent.type, pen as touch)
  dx: number; dy: number;     // of the touch tracked from grant (section 6)
  startX: number;             // window px, for the edge guard
  windowWidth: number;
  edgeGuard: { left: number; right: number }; // EDGE_GUARD per side (section 6)
  touches: number;            // the most touches down at once during the gesture
  target: StageTarget;        // from the DOM node at grant: closest('[data-stage-target]')
  slideHasTargets: boolean;
  layout: 'docked' | 'rail' | 'overlay';
  covering: 'none' | 'more' | 'other'; // the More sheet, or another covering overlay (section 5.4)
  pointing: boolean;          // owner choice O2
}): StageCommand;
```

0. `covering === 'other'` -> `null`; `covering === 'more'` -> `'close-more'` for a tap, `null` for anything else (no step, no point).
1. `touches > 1` -> `null`.
2. A swipe (section 6) -> `'next'` / `'prev'`; a touch swipe that starts within the edge guard of either window edge -> `null`.
3. Not a tap (`|dx| >= TAP_SLOP` or `|dy| >= TAP_SLOP`) -> `null`.
4. A tap on an option -> `{ point: index }` when `pointing`, else `null`. A tap on any other target -> `null`.
5. A tap on empty area: `pointer === 'mouse'` and `!slideHasTargets` -> `'next'` (O4); `pointer === 'touch'` and `layout === 'overlay'` -> `'toggle-bar'`; `pointer === 'touch'` otherwise -> `'nudge-next'` (O5: no step); a mouse click on a target slide -> `null`.

**`'nudge-next'`** never steps: Next (on the docked bar or the rail) shows a static `border.focus` ring, `STAGE_BORDER` wide, for 1 s (`NUDGE_MS`, new), drawn at once and removed at once (no motion, so reduced motion changes nothing). It tells a teacher used to tapping the slide where to tap now. It is not announced (the live region stays for steps).

`Stage` reads the target at grant from the event's DOM node (`event.target`, web; `closest('[data-stage-target]')`), so the stage stays the only gesture owner and the slides stay presentational. `inBarStrip`, `barOverlap` and `TAP_BACK_FRACTION` are deleted with their tests.

### 7.3 Pointing at an option (owner choice O2)

- `PresenterState` gains `pointed: number | null`; the reducer (`logic/lecture/controls.ts`) gains the event `{ point: n }`: it sets `pointed = n`, or clears it when `n` is already pointed; it does nothing when the slide has no option `n`, and nothing under a covering overlay (overlays swallow it as they swallow navigation). **Any step clears it**: `next` (a reveal build included), `prev`, `first`, `last`, `goto`. So the answer is never shown with a pick still outlined, and nothing on the stage can read as "your pick was wrong".
- **Look**: a dashed outline (`STAGE_BORDER` units, `text.primary`) drawn **`spacing.sm` stage units outside** the card's own border, so it reads as a second line rather than a thicker edge, and the `pin` icon at its marker at `presenter.size.caption` (28 units) or larger, so colour is never the only cue; no fill change, no `feedback` colour, no motion (it appears at once with or without reduced motion). One option at a time. PN-0b checks it at the back of a room: a 1280 x 720 projector-style shot (lowered contrast) in `slide-quiz.md`. The outline is never thinner than `STAGE_BORDER_MIN` (`borderWidth.base`); **on one-column rows** (row gap `spacing.md` units) its offset is `(row gap - outline width) / 2` instead, so it sits in the middle of the gap and never reaches the next row at a phone's unit (PN-0b, `slide-listen-reply.md` "Pointed option").
- **Keys**: `1` to `4` send `{ point: n }`, matched on `key` `'1'`-`'4'` **or** `code` `Digit1`-`Digit4` and `Numpad1`-`Numpad4` (so a layout where the digit row needs Shift, such as AZERTY, works). Key rules of §3.5 amendment point 5: not with `Ctrl`, `Meta` or `Alt`, not on auto-repeat, not during IME composition. **Focus on a button does not block them**: `onActivatable` in `logic/lecture/keymap.ts` blocks only `Enter` and `Space`, which would activate the focused control; a digit activates nothing, and after a click on Previous or Next focus stays on that button, exactly when the teacher reaches for `1`-`4`. They map to nothing on a slide with no options. No key-sending clicker sends them.
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
- `help.touch.keep` — Keep controls visible shows every button all the time. (Above the existing switch; for a screen where the buttons fade.)
- `help.phoneBar` (changed in PN-2; overlay layout only) — On this phone, swipe to move. Tap the slide to show the controls.

`HELP_KEYS` gains the row `point` (`1`, `2`, `3`, `4`; O2). The rows are pure data in `logic/lecture/help-keys.ts` with the touch rows in a new `HELP_TOUCH` list (`'swipe' | 'buttons' | 'click' | 'point' | 'keep'`), so a test holds them to the rules of sections 6 and 7.

### 9.3 Start hint (O7)

When touch is seen (section 4) at the first slide of a lesson, a `StageHint` shows for `presenter.autoHideMs` x 2 (6 s) at the top of the stage: `nav.hint` (docked and rail) or `nav.hintOverlay` (overlay). It takes no taps and covers no target (top of the stage, as the no-voice chip; at 568 x 320 the pill, about 34 px at 18 px text, is taller than the 21 px stage padding and covers the top of the prompt for those 6 s, which PN-0b measures and accepts or shortens; **measured and accepted in PN-0b**: at 568 x 320 the pill is 33 px tall in en and ko and 53 px (two lines) in es, and on the first slide it covers only the slide counter (and in es 2 px of the deck caption's line box, not its letters); PN-3's length budget holds `nav.hintOverlay` to two lines there, a PN-3 test holds that every built deck starts with its title slide, and the PN-3 e2e checks at 568 x 320 that the pill's box meets no content target and no prompt). It shows on each lesson **until the device's first step by a bar or rail button or a swipe**, and on at most three lessons: the key `lecture:navHint` holds `'1'`, `'2'` or `'3'` (lessons shown) or `'done'`, written through the storage wrapper (`platform/storage.web.ts`, never `localStorage` directly; a blocked storage shows it each lesson, never an error); no other data. Help keeps the same lines for later.

**As built (PN-3; the O7 default decided 2026-10-29):** the hint shows only when the lesson opens on its first slide and that slide is a title slide. Every grid lesson (an episode deck) opens on its title; a ready-made lesson opens on its title when its first block is a lesson or a story, and on letters or word cards otherwise (a warm-up, a word review), where no hint shows and no lesson is counted, so the pill never covers a prompt. `logic/lecture/__tests__/nav-hint.test.ts` pins both (it replaces "every built deck starts with its title slide", which a warm-up does not). A key or clicker step and a touch tap on empty stage (the Next ring) do not end the hint; a step to another slide takes it away at once; a read of `lecture:navHint` that has not answered after 1.5 s counts as storage off. Review round 1: a read that slow shows the hint and **writes nothing**, so a late answer never turns a stored `'done'` or count back into `'1'`; the lesson's count is written without waiting for the store, so a store that never answers still shows the hint; and only a press or swipe that **moved** the lesson (another slide or build) ends the hint, so Previous on the first slide keeps it.

## 10. Reduced motion

`prefers-reduced-motion: reduce`: the docked bar's fade, the overlay bar's fade and the hint's fade become instant; the pointed outline is instant in every case; a swipe never animates the slide in any case. Nothing new moves.

## 11. Accessibility

- **Alternatives to the gesture** (WCAG 2.5.1, 2.5.7): every swipe has the Previous and Next buttons and the keys.
- **Pointer cancellation** (2.5.2): every step fires on release; a swipe pulled back under 60 px does nothing.
- **Target size and spacing** (2.5.8): the docked buttons stay 96; the full rail 88 x 64 or more, the compact rail and the overlay bar buttons at least 64; content targets are large cards already; at least 32 px of inert space between any content target and any rail or band button (section 5.0).
- **Contrast** (1.4.3, 1.4.11): Next keeps `brand.primary` with `text.onPrimary`; Previous and the rail buttons draw `text.primary` on `surface.paper` with a `border.strong` edge on `surface.sunken`; the pointed outline is `text.primary` on `surface.paper` (above 3:1).
- **Focus not obscured** (2.4.11): the rail and the docked band never overlap the stage; a focused control keeps its bar shown (unchanged).
- **Screen readers**: VoiceOver and TalkBack own swipes, so the stage never sees one; Previous, Next and the keys work. The rail is a vertical toolbar; the compact rail's icon buttons carry their labels as accessible names. The live region announces each step (unchanged) and a pointed option.
- **Orientation**: unchanged (the rotate page on an upright phone).
- **Language of the stage** (`lang`, WCAG 3.1.2): unchanged; the rail and Help are chrome in the device language.

## 12. Telemetry (amends F-TCH-004 §3.14; owner choice O8)

No new event name. **`lecture.complete` gains seven keys**, all whole numbers except `navLayout`:

| Key | Value | Counts |
|---|---|---|
| `navLayout` | `'docked' \| 'rail' \| 'overlay'` | the layout when the first slide is shown, after the resize from Start's fullscreen request has settled (not the window at the Start tap) |
| `stepsButton` | 0-100000 | `next` / `prev` from a bar or rail button |
| `stepsSwipe` | 0-100000 | from a swipe |
| `stepsKey` | 0-100000 | from a key or clicker |
| `stepsClick` | 0-100000 | from a mouse click on the stage |
| `quickBacks` | 0-100000 | a `prev` within 2 s of a forward step (`QUICK_BACK_MS`), the sign of a step taken by mistake |
| `points` | 0-100000 | `{ point }` events (O2) |

Bounds are `LECTURE_REVEALS_MAX` (`packages/backend/src/lib/server-events.ts:220`). **Worker first** (row PN-1): `LECTURE_PAYLOAD_RULES['lecture.complete']` gains the keys and bounds before any app build sends them; until then the Worker drops them (unknown keys are dropped). The client side is its own row, PN-6, which waits only for PN-1 to be deployed, so no visible change waits on telemetry. The client tally (`logic/lecture/shell.ts` `RunTally`, `tallyStep`, `completePayload`) counts by source; `userDispatch` passes the source. No coordinates, no slide or option ids, no timings per step, no profile id (there is none), no deck title. Display and pointing choices are never sent.

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
| `help.touch.keep` | PN-3 | Keep controls visible shows every button all the time. | Con «Dejar los controles a la vista» activado, todos los botones se ven siempre. | '조작 버튼 계속 보이기'를 켜면 모든 버튼이 계속 보여요. |
| `help.phoneBar` (changed) | PN-2 | On this phone, swipe to move. Tap the slide to show the controls. | En este teléfono, desliza para avanzar o volver. Toca la diapositiva para ver los controles. | 이 휴대폰에서는 화면을 밀어서 넘겨요. 슬라이드를 누르면 조작 버튼이 보여요. |
| `nav.hint` | PN-3 | Swipe, or tap Previous and Next. | Desliza o toca Anterior y Siguiente. | 화면을 밀거나 이전, 다음 버튼을 눌러요. |
| `nav.hintOverlay` | PN-3 | Swipe to move. Tap the slide to show the controls. | Desliza para avanzar o volver. Toca la diapositiva para ver los controles. | 화면을 밀어서 넘겨요. 슬라이드를 누르면 조작 버튼이 보여요. |
| `a11y.presenter.pointed` (`n`) | PN-5 | Option {n} pointed at | Opción {n} señalada | {n}번 선택지를 표시했어요 |
| `a11y.presenter.unpointed` | PN-5 | No option pointed at | Ninguna opción señalada | 표시한 선택지가 없어요 |

Removed: none (`help.phoneBar` stays, reworded in PN-2, for the overlay layout only). The `help.touch.*` values are reviewed against the as-built rules in their row's MAR (one Spanish and one Korean reviewer pass), and `length-budget.test.ts` covers the hint lines at 568 x 320.

## 14. Tests (per row)

**Viewport and input matrix** (each with the inputs a real device of that size has):

| Id | Window | Inputs | Layout (PN-2 / PN-3, before PN-4) | Layout (PN-4 on) |
|---|---|---|---|---|
| V1 | 568 x 320 phone (`isMobile`, touch) | touch | overlay | overlay |
| V2 | 844 x 390 phone (`isMobile`, touch), with and without notch insets | touch | overlay | rail |
| V2c | 640 x 360 phone (`isMobile`, touch) | touch | overlay | compact rail |
| V3 | 1180 x 820 tablet; also 1024 x 768 and upright 820 x 1180 (the band wraps, section 5.1) | touch, and mouse (a tablet with a trackpad) | docked | docked |
| V4 | 1920 x 1080 projector or whiteboard | mouse, and touch (a whiteboard: O9 order) | docked | docked |

1280 x 720 mouse stays in the existing specs; 667 x 375 runs the rail fit checks (PN-4). Each e2e row states which column it asserts; a PN-2 case at V2 expects the overlay, the PN-4 rewrite of the same case expects the rail.

**Slide kinds**: title, letter, syllable, vocab, card, quiz (2 x 2 text, picture-word, match sound, odd one out), story, story check, question listen grid, question listen-word and listen-sentence rows, reply rows, realia, realia question (rows and grid), sequence order and steps, sentence, sentence build, pattern, read along, write together, activity, end.

**Layout families** (the full tap grid runs on one slide of each; every other kind gets a smoke case: one centre tap per target and one swipe): 2 x 2 option grid (quiz text), full-width option rows (question listen-word), order steps (sequence order), sentence tiles (sentence build), write-together chips, and one target-free slide (title).

**Swipes in e2e**: `page.touchscreen` has only `tap()`, so a shared helper `swipeStage(page, from, to, { fingers })` in `e2e/web/helpers.ts` drives CDP `Input.dispatchTouchEvent` (as `audio-engine.spec.ts:356` does), Chromium only; under `E2E_WEBKIT` the swipe cases skip and the tap cases run.

| File | Row | Asserts |
|---|---|---|
| `packages/backend/src/lib/__tests__/server-events.test.ts` (extend) | PN-1 | `lecture.complete` keeps `navLayout` from its list and the six counts within 0-100000 as whole numbers; a negative, a fraction, a string, an unknown layout and any other key are dropped; old payloads unchanged |
| `logic/lecture/__tests__/stage-gesture.test.ts` (new; replaces the `gestureCommand` and `inBarStrip` cases of `shell.test.ts:751-764, 776-784`) | PN-2 | every rule of section 7.2 in order: `covering` other and More (a tap gives `'close-more'`, a swipe `null`); two touches, with the fingers lifted in either order; a swipe left and right at exactly 60 and 1.5, at 59 and at 1.49; an edge start at 23 and 24 px on both edges, and at an inset of 47 (guard 55: 54 and 55), touch only (a mouse drag at the edge still swipes); a tap at slop 11 and 12; a tap on an option with and without `pointing`; a tap on a step, tile or chip; an empty tap by mouse on a target-free slide (next), by mouse on a target slide (null), by touch on docked and rail (`'nudge-next'`) and overlay (`'toggle-bar'`); no input ever gives `'prev'` from a tap |
| `screens/presenter/__tests__/stage-gesture-events.test.tsx` (new) | PN-2 | `Stage`'s handlers: the touch tracked from grant gives `dx`, not `changedTouches[0]`; `onResponderStart` / `onResponderMove` raise the touch count; a `mousedown` grant gives `'mouse'`, a `touchstart` grant `'touch'`, a mouse event after a pen `pointerdown` `'touch'` |
| `logic/lecture/__tests__/slide-targets.test.ts` (new) | PN-2 | `slideHasTargets` per kind (the section 7.1 list exactly) for every build; a source scan: every `role="listitem"` in `QuizParts`, `SequenceSlide` and `WriteTogetherSlide` carries `stageTarget`, options with their index |
| `screens/presenter/__tests__/build-slides.test.tsx` (extend) | PN-2 | every `presenter-build-placed`, `presenter-build-particle` and `presenter-build-bank-tile` carries `data-stage-target="tile"` |
| `platform/__tests__/presenter.web.test.ts` (extend) | PN-2 | `subscribeInputKind` reports `'mouse'`, `'touch'` (touch and pen) and `'key'`; touch seen from `(any-pointer: coarse)` or `(hover: none)` at start |
| `scripts/__tests__/pwa-postbuild-shell.test.mjs` (extend) | PN-2 | the built page still carries `overscroll-behavior: none` on `html, body` |
| `PresenterApp` with fake timers (`screens/presenter/__tests__/presenter-nav-pin.test.tsx`, new) | PN-2 | touch seen: after `presenter.autoHideMs` Previous and Next keep opacity 1 and `pointerEvents: 'auto'`, and a press right after a fade (inside `BAR_SHOW_GRACE_MS`) steps; the tools fade and keep the grace; mouse only: all fade; `'nudge-next'` draws the ring for `NUDGE_MS` and steps nothing |
| `logic/lecture/__tests__/stage-scale.test.ts` (extend) | PN-4 | `navLayout` and `railSize`: the table of section 5.2 row by row (568 x 320 overlay; 640 x 360 compact; 667 x 375, 780 x 360, 844 x 390 with and without insets, 932 x 430 full; 1180 x 820, 1024 x 768, 820 x 1180 and 1920 x 1080 docked; an upright phone the rotate page); the stage box is the window minus insets minus 104 (full) or 80 (compact); the kill switch off gives overlay on every phone window |
| `logic/lecture/__tests__/controls.test.ts` (extend) | PN-5 | `{ point: n }` sets and toggles; an index with no option does nothing; every step (`next` incl. a reveal build, `prev`, `first`, `last`, `goto`) clears it; covering overlays swallow it; `pointed` never survives a slide change |
| `logic/lecture/__tests__/keymap.test.ts`, `help-keys.test.ts` (extend) | PN-3, PN-5 | the existing next and previous keys unchanged (the PR 4 cases kept verbatim); `1`-`4` by `key` and by `code` `Digit1`-`Digit4`, `Numpad1`-`Numpad4` map to `{ point }` without modifiers, repeat or IME composition, **also while focus is on a control**; `Enter` and `Space` on a control still map to nothing; `HELP_TOUCH` rows match section 9.2; the `point` row lists exactly `1`-`4` |
| `logic/lecture/__tests__/shell.test.ts` (extend) | PN-6 | `tallyStep` counts by source; `quickBacks` at 1999 and 2000 ms; `completePayload` carries the seven keys and nothing else; `navLayout` from the first slide shown, not from the Start tap |
| `screens/presenter/__tests__/control-bar.test.tsx` (**new**; no `ControlBar` render test exists today) | PN-3, PN-4 | docked order Previous first and Next last with Sound between Exit and Next; at 1600 px and wider with touch seen, Previous just before Next (O9); a wrapped band keeps Previous and Next on the bottom row; `pinNav` renders Previous and Next outside the fading view; the rail's four buttons in the order More, Next, Previous, Sound with the vertical toolbar role, Next and Previous centred; the compact rail's icon buttons carry their labels as accessible names; a rail in the label fallback renders the compact buttons and, with `moreIcon`, More's `more` icon with its label as the accessible name |
| Playwright `e2e/web/presenter-nav.spec.ts` (new) | PN-2 to PN-5 | on each layout family at V1 to V4 (V2c from PN-4) with each input of the matrix, starting from the first build, every content target is tapped at its centre, on its Korean, 20 px in from its left edge, **8 px inside its right edge and 8 px inside its bottom edge**: the counter and the build stay, no control is pressed (with O2, the option carries `data-pointed="true"` and nothing else changes); a tap in the padding between a target and the rail or the band presses nothing; **clearance**: every content target box is at least 32 px from every visible control box (section 5.0); a touch tap on empty stage does nothing but the Next ring (V2, V3, V4) or toggles the bar (V1); a mouse click on empty stage steps forward on a target-free slide and does nothing on a slide with targets; a swipe left and right from the centre and from the middle of an option steps once; a vertical drag (dx 30, dy 120), a diagonal at ratio 1.2 and a two-finger swipe do nothing; a touch swipe starting 10 px from either window edge does nothing; on touch at V2, V3, V4 Previous and Next are visible and enabled at the start, after 5 s idle, after a step and on every question slide; at V1 after a step the bar is hidden and a tap on option 3 then option 4 changes nothing, and after an empty tap shows the bar, the bar is fully shown before the next tap (the remaining risk of section 5.3 is visible, never hidden); with More open (V2), a swipe and an option tap on the exposed stage step nothing and point at nothing, and a tap there closes More; a swipe inside the grid, Help and the More sheet steps nothing; the start hint shows on touch until the first button or swipe step and never on mouse; the live region names a pointed option; **measured text** (Chromium and WebKit): no full-rail label overflows its button in en, es and ko at the body floor, a larger text size takes the label fallback (PN-4), and Spanish at 768 x 1024 takes the docked More fallback with Previous, More and Next on the bottom row (PN-3) |
| Playwright `e2e/web/presenter.spec.ts:313-321` (rewritten) | PN-2 | "a click on a slide with nothing to point at goes on; the left of the stage no longer goes back": a mouse click at 10 % and at 80 % both go on on the title slide; on a question slide neither click moves |
| Playwright `presenter-phone.spec.ts:104, 110, 325, 375`, `presenter-sound.spec.ts:175, 181`, `audio-engine.spec.ts:230, 481` (rewritten) | PN-2, then PN-4 | PN-2: `tapStage` becomes `swipeStage` left, `tapStrip` becomes a tap on empty stage (overlay at every phone size); the Help assertion at `:325` expects the new `help.phoneBar`; the covering-tool case at `:375` ("a covering tool (Blank) ... a touch brings it back") keeps its expectation (section 5.3). PN-4: at the rail sizes the specs press `presenter-sound` directly (the rail is always shown) and the "no element of the new slide meets a visible control" check runs with the rail shown at 844 x 390, 667 x 375 and 640 x 360 |
| Playwright `presenter-reading.spec.ts`, `presenter-questions.spec.ts`, `presenter-write.spec.ts`, `presenter-build.spec.ts` (extend) | PN-4 | the LV-S fit checks also at 640 x 360 (compact rail), 667 x 375 and 844 x 390 (full rail): nothing leaves the stage, no text spills, no text below the floor |
| Kill switch off (`EXPO_PUBLIC_PRESENTER_RAIL=0` build, local, recorded in the PR) | PN-4 | at 844 x 390 the overlay layout with no strip: the V1 overlay cases pass there |
| i18n coverage ratchets (`es-coverage.ts`, `ko-coverage.ts`), `length-budget.test.ts`, banned-word lint | PN-2, PN-3, PN-4, PN-5 | es and ko present for every new and changed key |

**Real-device acceptance** (PN-2 and PN-4, before merge, recorded in the PR; CI runs Chromium only, `playwright.config.ts:36`): on iPhone Safari, iPad Safari and Android Chrome, tap options 1 and 3 (no step), swipe from the centre and from an option (one step), swipe from each edge (no step; a browser back lands on the Exit confirm); plus a local `E2E_WEBKIT=1` run of the tap cases.

## 15. Rollout and kill switch

1. **PN-0** (this PR) merges; **PN-0b** draws the mocks (multi-agent design review).
2. **PN-1** (Worker) deploys before any build that sends the new keys.
3. **PN-2** (the tap rules, swipe, the pinned pair on docked touch, the Next ring, the strip removed, `help.phoneBar` reworded) ships as soon as it merges, with no switch: it removes the defect on every device. Rollback is a revert PR. **Allowed interim state until PN-3 and PN-4**: docked touch windows already have Previous and Next always shown (in today's order, together at the right); every phone uses the overlay layout of section 5.3 (a tap on empty stage shows the bar; swipe moves; Help says both); no start hint yet.
4. **PN-3** (docked bar order O6 / O9 and the wrap rule, Help's Touch and mouse group, the start hint) after PN-2 and PN-0b; it does not wait for PN-1. Interim until PN-4: phones still on the overlay layout, now with the start hint.
5. **PN-4** (the phone rail, compact and full) behind **`EXPO_PUBLIC_PRESENTER_RAIL`**, a kill switch read with `parseKillSwitch` (`config/flags.ts`, flag `presenterRail`, launch default **on**). Off: every phone window uses the overlay layout of section 5.3 (the floating bar without the strip); the tap rules of PN-2 stay. The switch is read **at build time**: turning it off needs a rebuild and redeploy of the learner web build (as with `EXPO_PUBLIC_LECTURE_MODE`), and an open lesson keeps the old build until the next load (service worker). It is there so a rail problem is answered without reverting PN-4's code, not to be faster than a revert. The owner runbook gains one line.
6. **PN-5** (pointing) after the owner confirms O2 (confirmed 2026-10-29).
7. **PN-6** (the navigation counts in the client tally and `completePayload`) after PN-1 is deployed and PN-2 has merged.
8. **Watch** (after PN-6): `quickBacks` per lecture and the split of `stepsButton`, `stepsSwipe`, `stepsKey`, `stepsClick` by `navLayout` for two weeks after PN-4. A rail lecture with more `quickBacks` per step than docked ones, or a phone owner report, is the trigger to switch the rail off and revisit O1.
9. The presenter is the learner web build behind its service worker: an open lesson keeps the old rules until the next load; no saved data changes shape (`lecture:navHint` is new and optional).

## 16. PR breakdown (implementation rows)

Every UI row links its PN-0b mock and attaches screenshots at V1 to V4 (plus 640 x 360 and 667 x 375 for PN-4); every row adds en, es and ko in the same PR; shared files (`telemetry.ts`, i18n messages, `scripts/i18n-migrated.json`, `index.ts`) are touched append-only. No D1 migration.

| Row | Content | Size | Depends on |
|---|---|---|---|
| **PN-0** (this PR) | `docs(specs,design)`: this amendment; wireframe `classroom/lecture-nav.md`; wireframe index row; pointer lines in F-TCH-004 §3.5, §3.6, §3.14, `AMENDMENTS-LECTURE-V2.md` §18.6, `classroom/lecture-phone.md`, `classroom/lecture-presenter.md`, `docs/specs/README.md` | S | — |
| **PN-0b** | `design(presenter)`: mocks with MAR: `design/screens/presenter/stage-and-bar.md` (docked order and the pinned pair at 1180 x 820, the wrapped band at 1024 x 768 and upright 820 x 1180, the O9 order at 1920 x 1080 touch with a reach note for a teacher at the side of a whiteboard; the full rail at 667 x 375, 844 x 390 with a notch and 932 x 430; the compact rail at 640 x 360; the overlay fallback at 568 x 320 without the grabber; the 32 px clearance drawn on each), `overlays.md` (Help with the Touch and mouse group in en, es, ko), `slide-quiz.md` and `slide-listen-reply.md` (a pointed option, grid and rows, plus a 1280 x 720 projector-style shot); rail labels measured in en, es, ko at 18 px (and More inside 64 px); the start hint measured at 568 x 320; shots | M | PN-0 |
| **PN-1** | `feat(backend)`: `LECTURE_PAYLOAD_RULES['lecture.complete']` gains `navLayout` and the six counts (section 12); tests; **deploys first** | S | PN-0 |
| **PN-2** | `feat(mobile)`: `logic/lecture/stage-gesture.ts` (`stageGesture`, `slideHasTargets`, `TAP_SLOP`, `EDGE_GUARD`, `NUDGE_MS`), `stageTarget` markers on every content target of section 7.1, `Stage` on the new rule (target and pointer read at grant, the touch tracked by identifier, the most touches counted in `onResponderStart` / `onResponderMove`, `covering` with `moreOpen`), `subscribeInputKind` extended (section 4); `navLayout` with `'docked'` and `'overlay'` only (from `isPhoneWindow`; PN-4 adds `'rail'`); the pinned pair on docked touch (`pinNav`, outside the fade, no grace; section 5.1) and the Next ring; `gestureCommand`, `inBarStrip`, `barOverlap` and `TAP_BACK_FRACTION` deleted; the overlay bar's strip replaced by a tap on empty stage (the strip and grabber go on every phone); string `help.phoneBar` changed in en, es, ko; the PN-2 e2e cases of section 14 and the real-device acceptance | M | PN-0 |
| **PN-3** | `feat(mobile)`: docked bar order (O6, O9) and the wrap rule (section 5.1); Help's Touch and mouse group and `HELP_TOUCH`; the start hint (O7) and `lecture:navHint`; strings `help.touch.title`, `swipe`, `buttons`, `click`, `keep`, `nav.hint`, `nav.hintOverlay` in en, es, ko | M | PN-2, PN-0b |
| **PN-4** | `feat(mobile)`: `'rail'` in `navLayout`, `railSize` and the rail gate (`PHONE_RAIL`, `PHONE_RAIL_COMPACT`, `PHONE_RAIL_GAP`, `NAV_CLEARANCE`) in `stage-scale.ts` and `stage-constants.ts`; the full and compact rail (`PhoneRail` in `ControlBar.tsx`, the More sheet beside it, covering the stage); the stage box minus the rail; the kill switch `presenterRail` (`EXPO_PUBLIC_PRESENTER_RAIL`) and its switch-off check; LV-S fit checks at 640 x 360, 667 x 375 and 844 x 390; the owner runbook line; the real-device acceptance | L | PN-2, PN-3, PN-0b |
| **PN-5** | `feat(mobile)`: pointing (O2): `pointed` and `{ point }` in the reducer, the dashed outline and pin on option cards and rows, keys `1`-`4`, the live-region lines, Help's point rows; strings `help.touch.point`, `help.row.point`, `a11y.presenter.pointed`, `unpointed` | S | PN-2, owner O2 |
| **PN-6** | `feat(mobile)`: navigation counts (O8): `RunTally` and `tallyStep` by source, `completePayload` with the seven keys, `navLayout` from the first slide shown; `userDispatch` passes the source | S | PN-1 deployed, PN-2 |

Parallel lanes: PN-1 and PN-2 at once after PN-0; PN-0b beside them; PN-6 as soon as PN-1 is deployed. Progress counting: 8 rows (PN-0 to PN-6 with PN-0b).

## 17. Edits to the amended specs (pointer lines in this PR; text in the rows named)

- **F-TCH-004 §3.5** "Touch and mouse": the thirds are replaced by section 7 and swipe by section 6 (PN-2); "Control bar": the touch pinning of section 5.1 (PN-2) and the order and wrap rule (PN-3). **§3.6** phone exception: the rail of section 5.2 where it fits, the overlay of section 5.3 elsewhere, the strip and grabber removed (PN-2, PN-4). **§3.14**: `lecture.complete` keys (PN-1, PN-6).
- **`AMENDMENTS-LECTURE-V2.md` §18.6** and its test row for `presenter-phone.spec.ts` ("a tap on the stage advances without showing the bar; a tap in the bar's strip shows it"): superseded by sections 5.2, 5.3 and 14 (PN-2, PN-4).
- **Design docs** repeating the thirds or the strip are updated in PN-0b: `design/screens/presenter/stage-and-bar.md:12, 43`, `design/screens/presenter/README.md:95`, `design/wireframes/classroom/lecture-presenter.md:105, 285`, `lecture-phone.md:47, 130, 132`, `lecture-big-screen-v2.md:133`, `design/screens/presenter/mock/presenter-or.css:26-27`.

## 18. Open items

- **Small-phone overlay (568 x 320 class) remains a known risk.** Neither rail fits; once the teacher shows the floating bar on a question slide, it covers the bottom option row, so a tap aimed at option 3 or 4 can still press Previous or Next. It is now always a tap on a bar the teacher just made visible, never a hidden first tap, and swipe needs no bar. Moving the bar to the top would cover the speaker instead; two corner buttons would cover content (the stage padding is 21 px). Revisit with the `quickBacks` by `navLayout` watch (section 15) or a report.
- **Trackpad two-finger swipe** (a laptop at a projector): the global `overscroll-behavior: none` keeps it from leaving the page in Chromium, but it does not step either (wheel events are not read). Adding it is a later, separate change if asked.
- **Left-handed rail**: O3 (c), a Help switch, is not built; revisit if the owner or a report asks.
- **Native builds** (deferred track): the rule is pure and the targets are markers, but the target lookup at grant uses the DOM; a native build reads the target from the responder's `target` tag instead. Not needed while lecture mode is web only.
- **A phone cast to a TV** shows the rail on the TV too (it mirrors the window). Accepted: it sits beside the slide, never over it.
- **Start hint on title slides only** (PN-3, section 9.3 as built): a teacher who runs only warm-up or word-review presets (which open on letters or word cards) never sees the hint, and those lessons are not counted. This narrows O7 so the pill never covers a prompt; Help keeps the lines. For the owner to accept, or to ask for a pill placed where PN-0b measures it covers no prompt on those first slides.
- **`help.touch.click` wording**: "not on question slides" names the common case; the mouse-click rule also holds on sequence, sentence-build and write-together slides (every slide with content targets, section 7.1). A later spec touch may reword it (for example "on slides with nothing to point at"), with es and ko in the same PR.
- **The start hint is drawn only** (`aria-hidden`): a screen-reader user hears the same lines in Help. Accepted in PN-3's accessibility pass; announcing it once through the polite live region is a later option.

## 19. Review log

- 2026-10-29, PN-0 (this PR): measured on `524961dae` (section 1, Playwright with real mouse and touch input at 1280 x 720, 1920 x 1080, 1180 x 820, 568 x 320 and 844 x 390); the sources of the stage, the bar, the gesture rule and the key map read at that commit. Multi-agent review of this PR to follow (interaction design and accessibility, phone layout geometry, privacy and telemetry, Spanish, Korean).
- 2026-10-29, PN-0 review round 1 (two independent reviews: interaction design and geometry; engineering and rollout). Applied: a 32 px clearance rule and an inert rail gap (section 5.0), the rail pair centred; the docked order written as the wireframe and test (Sound between Exit and Next); the More sheet covers the stage; O9 for whiteboards and the wrap rule; touch seen from `any-pointer: coarse` / `hover: none` and from the gesture's own event, through `subscribeInputKind`; the compact rail for 640 x 360 (O10) and the overlay risk listed; `EDGE_GUARD` 24 px or inset + 8, and the overscroll claim corrected; the Next ring and a longer-lived hint; the pointed outline offset and pin size; digits `1`-`4` with focus on a control and by `code`; the sentence-build tile check; PN-2 now carries the docked pinning and `help.phoneBar`, counts split to PN-6; the test inventory corrected (`control-bar.test.tsx` new, the timing on `PresenterApp`, the phone Help and Blank cases, a CDP swipe helper, a reduced grid, per-row expectations); the responder handlers and identifier tracking named; the build-time kill switch stated, with a switch-off check; `navLayout` from the first slide; real-device acceptance. Not applied, with reasons in the PR: a faded-bar wake-up click that does not step (it would break the mouse presenter's click-to-go-on after every idle), and a top-of-stage overlay bar (it moves the risk to the speaker).
- 2026-10-29, owner decision: every recommended default of section 3 confirmed (O1 a, O2 a, O3 a, O4 to O10 as recommended).
- 2026-10-29, PN-0b (mocks): `design/screens/presenter/stage-and-bar.md` "Navigation (PN-0b)", `overlays.md` "Touch and mouse", `slide-quiz.md` and `slide-listen-reply.md` "Pointed option"; rules in `mock/presenter-nav.css`. Measured in Chromium on every layout of sections 4 and 5: the inert space from every content target to every visible control is at least 33.0 px on every rail (640 x 360 compact rail) and 50.4 px or more on every docked window, and 0 px only while the overlay bar shows (568 x 320, and 844 x 390 with the rail switched off: section 18). Design decisions for the rows: the full rail's buttons have no side padding (PN-4); the pointed outline never drops under `STAGE_BORDER_MIN` and its pin sits at the marker's top right on a paper disc (PN-5); the band's wrap is measured, and Spanish wraps it at 1180 x 820 (PN-3). The multi-agent review is the next line.
- 2026-10-29, PN-0b multi-agent review round 1 (two independent reviews: interaction, accessibility and phone geometry with the Spanish and Korean passes; production safety and accessibility). **Spanish: PASS** (neutral Latin-American tú and "mouse" throughout). **Korean: PASS** (해요체, the glossary terms, no particle on a variable, breaks between words). Every section 13 string in the mock matches this spec, and every shipped chrome string matches `packages/i18n`. Applied: the branch rebased onto the squash-merged PN-0; the docked **More fallback** drawn and measured (Spanish at 768 x 1024 and 744 x 1133 needs it; a tool never shrinks or takes a third row) and the wrapped band's focus order stated (section 5.1); a **rail label fallback** for PN-4 (compact rail, and a `more` icon on More, when a measured word does not fit) and the overflow check moved from a render test to a Playwright e2e with real text (sections 5.2 and 14); the pointed outline **centred in the row gap** on one-column rows, with shots at 667 x 375 and 640 x 360 (section 7.3); the start-hint sentence matched to the measurement, with a first-slide-is-title test and a pill-box e2e for PN-3 (section 9.3); `help.touch.keep` in Spanish quotes the switch with «» as shipped Spanish does (section 13); the 1180 x 820 mouse frame relabelled as a mouse-only window (a tablet with a trackpad stays in the touch state); how the shots are taken stated in `stage-and-bar.md`. Not applied, with the reason in the PR: a Next ring that cannot be mistaken for focus (it follows only a touch tap, after which the browser shows no focus ring, and lasts 1 s; section 7.2 keeps `border.focus`).
- 2026-10-29, PN-3 (as built): the docked order O6 and O9 and the measured wrap rule with the More fallback (`logic/lecture/bar-layout.ts`, `ControlBar.tsx`), Help's Touch and mouse group (`HELP_TOUCH`), the start hint and `lecture:navHint` (`logic/lecture/nav-hint.ts`); owner choices O6, O7 and O9 as decided 2026-10-29. Section 9.3 gains the as-built note on which lessons show the hint. Multi-agent review of the row (interaction and accessibility, Spanish, Korean) to follow in its PR.
- 2026-10-30, PN-3 multi-agent review round 1 (two independent reviews: interaction, accessibility and the Spanish and Korean passes; production safety and engineering). **Spanish: PASS** (neutral Latin-American tú, "mouse", the glossary terms Anterior, Siguiente and diapositiva; the keep line quotes the shipped switch label). **Korean: PASS** (해요체, the glossary terms 이전, 다음 and 슬라이드; the keep line quotes the shipped label, and no particle follows a variable). Applied: a slow `lecture:navHint` read shows the hint and writes nothing, and the count is written without waiting on the store (section 9.3); only a step that moved the lesson ends the hint; with the docked More sheet open a bar or key step closes it and steps, and a tool key closes it first (section 5.1 as built); the band keeps its last widths across a language or text-size change; More's rows are checked to fit, with a second tools row only where they do not; focus goes to Next when More leaves the band; the e2e proves `'done'` on a fresh lesson and adds the 1080 x 810 and 1133 x 744 wrap windows; after merging main (#889), Role Play joins the target kinds and Hidden Heritage does not (section 7.1 as built). Listed in section 18 for the owner: the title-slide narrowing of O7, the `help.touch.click` wording, and the drawn-only hint.
- 2026-10-30, PN-4 (as built): the phone rail of section 5.2, full and compact, as decided 2026-10-29 (O1 a, O3 a, O10 a): the gate in `stage-scale.ts`, `PhoneRail` in `ControlBar.tsx`, the label fallback with the new `more` glyph (`packages/design-system` `Icon`), the kill switch `flags.presenterRail` (`EXPO_PUBLIC_PRESENTER_RAIL`, launch default on, read at build time; owner runbook line added). Section 5.2 gains the as-built note (More open beside the rail, Help's overlay line, touch adjustment). No new string: the rail reuses `bar.more.cta`, `bar.sound.cta`, `bar.prev.cta`, `common.buttons.next`, `bar.reveal.cta` and `bar.label`. Multi-agent review (geometry, interaction and accessibility, Spanish, Korean) in the PR.
- 2026-10-30, PN-4 multi-agent review round 1 (two independent reviews: geometry, interaction and accessibility with the Spanish and Korean passes; production safety and engineering). **Geometry and interaction: PASS** on the width gate, the stage box, the order, the pair, the sizes, the toolbar role, never hiding, More covering the stage and the kill switch. **Spanish: PASS** (no new strings; Siguiente, Anterior, Mostrar, Sonido and Más fit the 84 px and 52 px rooms; the fallback covers the Noto Sans case). **Korean: PASS** (다음, 이전, 다음 보기, 소리 and 더 보기 never break inside a word; the runbook line reads naturally). Applied: the rail gate checks the rail's height as drawn (section 5.2 "Height", short-window rows and e2e at 780 x 280, 640 x 280, 844 x 300, 844 x 330 and 667 x 328); the rail reports only a complete measure (no flip at lesson start); the rail no longer clips a focused button's ring; `navLayout` takes the rail as a required argument; section 5.0 states what the inert strip guarantees; the label e2e steps to Reveal and requires an 18 px label; the PN-3 wrap check waits for the stage to settle; the local Playwright config left the tree. Open for the owner: real-device acceptance on iPhone Safari, iPad Safari and Android Chrome with the browser bars showing (section 14).
