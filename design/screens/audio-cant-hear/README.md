# "Can't hear it?": the link, the sheet, the one-device help sheet and Always show the letters (design pass, CH-0b)

Spec: `docs/specs/AMENDMENTS-AUDIO-CANT-HEAR.md` (revision 2, `ready` for CH-0b) sections 3.1 to 3.11, row **CH-0b**;
built by rows CH-1a (the link, the sheet, Match Sound, the one-section help sheet), CH-1b to CH-1d (the other
surfaces) and CH-2 (the switch).
Wireframe: `design/wireframes/minigame/audio-cant-hear.md` (C1 to C9). Checked against the spec, with one gap left as
it is: its C5 sketch, C9 and Navigation graph still list the Checks (quest Check, Hangul, Stage and Cell Check) as
places for the link. The spec keeps Checks without the link until OD-CH6 is answered (CH-1e), and this pass draws
none there. CH-3 can add "(after OD-CH6)" when it touches the wireframe.
Component specs: `design/components/CantHear/spec.md` (new) and `design/components/VoiceHelp/spec.md` section 2
(revised).
Approval: multi-agent review (CLAUDE.md section 5, owner rule 2026-10-12); the log is at the end of this file.

The spec lets the mock row choose the folder (section 5: `design/screens/minigame-variety/` or a new folder). This
pass uses a new folder: the link spans eight surfaces (Match Sound, Listen & Pick, review rounds, Syllable Build, the
Speed round, Dictation, Discover) and Profile, so it is not one minigame's mock.

**The mocks are a design reference, not shipped code.** Every value is a token of
`packages/design-system/src/tokens.ts` as a custom property named after it (`../app-shell/mock/app-shell.css`,
`display-nav.css`, and the two copied once at the top of `mock/cant-hear.css`). No rule uses `colors.feedback.danger`
or `colors.feedback.nudge`: the link and the sheet are not a miss (spec 3.3, 3.11).

| File | Shows |
|---|---|
| `mock/link.html` | L1 to L7: the link inactive while the round holds, active, gone after Show the letters, absent with Sound off, on Discover, tablet landscape, and the glyph variants of open question 7 |
| `mock/sheet.html` | S1 to S5: the sheet with the Apple, Android and computer line (one each), the guidance-only sheet, tablet landscape |
| `mock/help-and-setting.html` | H1 to H3: "Add a Korean voice" with one device's section; P1 to P3: the Sound card with Always show the letters (off, on, and on with no Korean voice) |
| `mock/lengths.html` | en, es and ko at 320 x 568 with 200 % text: the link, the sheet with the longest line, the switch |
| `mock/greyscale.html` | the states without colour |
| `mock/frames/*.html` | one state per page, for the window shots |
| `mock/cant-hear.css` | the rules |
| `tools/build-mocks.mjs` | writes every page from one string table (edit it, not the HTML) |
| `tools/capture.mjs` | the checks below, and the shots |

### Shots

| Shot | What it shows |
|---|---|
| `link-hold-{360x740,320x568-text200,1024x768}.png` | the round opens and the voice check holds: the link is drawn but inactive; the answers are held (not drawn) |
| `link-ready-*.png` | a play ended "played" and nothing was heard: the link is active, after the caption (wrapped under it on a phone, in the row on a tablet) |
| `letters-shown-*.png` | after Show the letters: the text heading, the panel (니은 nieun, "No sound? Read it here."), no link, focus on the speaker |
| `sound-off-*.png` | Sound off for comparison: the panel's own action, no link |
| `sheet-apple-*.png`, `sheet-android-*.png`, `sheet-computer-*.png` | the sheet with one device line each |
| `sheet-guidance-*.png` | the guidance-only sheet over Discover: no Show the letters, Hear it primary |
| `discover-*.png` | Discover's guidance-only link under the card buttons |
| `voice-help-apple-*.png` | "Add a Korean voice" with the Apple section only |
| `profile-sound-*.png` | the Sound card with Always show the letters on |
| `*-320x568-text200-full.png`, `*-320x568-text200-end.png` | the whole screen at 200 % text, and a sheet scrolled to its end |
| `link-1280.png`, `sheet-1280.png`, `help-and-setting-1280.png`, `lengths-1280.png`, `greyscale-1280.png` | the boards |

`NODE_PATH=<checkout>/apps/web/node_modules node design/screens/audio-cant-hear/tools/capture.mjs` passes with no
finding (11 frames in 3 windows, 5 boards). The checks:

- **sideways**: no page, frame or sheet scrolls sideways.
- **targets**: every drawn button and switch is at least 64 x 64.
- **danger** and **amber**: no `feedback.danger` anywhere; no `feedback.nudge` or `nudgeLight` on the link, a sheet or the Sound card.
- **words**: no emoji and no banned learner word (en, es, ko).
- **one-line**: each sheet draws exactly one device line; each help sheet exactly one section.
- **actions**: a full sheet has Show the letters (primary) first and Hear it (secondary) second. A guidance-only sheet has no Show the letters, and its Hear it is primary.
- **dialog**: each sheet is `role="dialog"` and `aria-modal`. Its title is the first focusable element. The scrim is `aria-hidden` and cannot take focus. The screen behind is `inert`.
- **order**: the speaker comes first, then the link, then the answers.
- **no-move**: the link has the same box while the round holds and once it is active, in each window.
- **reach**: in each window, the sheet's title and buttons are on screen.
- **whole**: every device line (and each help section) is fully in view when the sheet opens, or the sheet shows the scroll cue (MD11).

## The link (CH-1a; spec 3.2, 3.6, 3.11)

```
  Tap the letter you hear                   Heading level prompt
     (speaker 48)   Tap to replay  [ Can't hear it? ]   speaker row: centred, wraps (gap spacing.md)
                    phone: the link drops under the caption ^
  [ ㄴ n ] [ ㄱ g/k ]                        tiles, unchanged
  [ ㄹ r/l ] [ ㄷ d/t ]
```

| Part | Component and tokens |
|---|---|
| Link | `Button tone="ghost" size="sm"`, no `leading` glyph (MD3): `touchTarget.min` (64) high and at least 64 wide, label `bodySm` semibold `brand.primary`, 2 px `brand.primary` border, pill |
| Place | the last child of the speaker row (`flexDirection: 'row'`, `alignItems: 'center'`, `justifyContent: 'center'`, `gap: spacing.md`), which gains `flexWrap: 'wrap'`; on Listen & Pick after Hear again; on Discover under Letter name (C6) |
| Inactive (the round holds) | `softDisabled`: `surface.sunken` fill, `text.muted` label, opacity 0.6, announced as disabled, stays focusable (MD2) |
| Hidden | whenever a text is up (`muted`, `no_voice`, `error`, `blocked`, the learner's ask): not rendered |

## The sheet (CH-1a; spec 3.3, 3.4, 3.7)

```
 +--------------------------------------------+
 | Can't hear it?                        [x]  |   Heading level prompt (first focus) + close (Icon close 22, 64 target)
 | Turn off silent mode. Then turn the volume |   Body, text.primary: one line, this device only
 | up.                                        |
 | [[        Show the letters              ]] |   Button primary md fullWidth
 | [     (speaker) Hear it                  ] |   Button secondary md fullWidth, leading speaker glyph
 +--------------------------------------------+
```

| Part | Component and tokens |
|---|---|
| Frame | `Modal transparent animationType="slide"`, `accessibilityViewIsModal`, as `VoiceHelpSheet.tsx`; scrim `colors.surface.overlay`, **not** an accessibility element (a plain `Pressable` with `accessible={false}`, `importantForAccessibility="no"`, `aria-hidden` on the web) |
| Sheet | `surface.paper`, top corners `radii.xl`, padding `spacing.lg`, `maxHeight: '85%'`; the line scrolls inside, the buttons stay under it |
| Width | full width on a phone; from window class `regular` (600) capped at `layout.maxWidth.reading` (720) and centred at the bottom (MD6) |
| Title row | `Heading level="prompt"` with `accessibilityRole="header"` (first focus) and the close button at the end (`Icon close`, size 22, `text.muted`, 64 x 64) |
| Line | `Body`, `text.primary`, `Spacer sm` above; one of `learner.audio.cantHear.lines.{apple,android,computer}` by `currentDeviceFamily()` |
| Buttons | `Spacer lg` above, a column with `gap: spacing.sm`: **Show the letters** `Button primary md fullWidth`, then **Hear it** `Button secondary md fullWidth leading={<Icon name="speaker" size={spacing.xl} color={colors.text.onSecondary} />}` |
| Guidance-only | no Show the letters; Hear it is `tone="primary"` (its glyph `text.onPrimary`) |
| No Hoya, no amber, no red | the sheet is neutral (spec 3.3) |

## The help sheet, one device (CH-1a; spec 3.9)

Unchanged apart from three points: `voiceHelpContent(copy, currentDeviceFamily())` returns one section, so the sheet
lists only that device's steps; the scrim leaves the accessibility tree; and focus starts on the title (not on the
close button as its spec said before). Width as the Can't hear it? sheet (MD6). See `design/components/VoiceHelp/spec.md`
section 2.

## Always show the letters (CH-2; spec row CH-2, OD-CH1)

```
 My settings
 +---------------------------------------------+
 | (speaker) Sound                       [ On ] |   the Sound switch row, unchanged
 |           Korean voice: ready                |
 |  [ How to add a voice ]                      |   only with no Korean voice, unchanged
 | ------------------------------------------- |   1 px border.subtle
 |           Always show the letters    [ Off ] |   the new switch row
 +---------------------------------------------+
```

| Part | Component and tokens |
|---|---|
| Row | a second `Pressable` with `accessibilityRole="switch"`, `accessibilityState={{ checked }}`, `accessibilityLabel` = the label, `minHeight: touchTarget.min`, as the Sound row |
| Label | `Body weight="semibold"`, indented by the glyph width plus `spacing.sm` (24 + 8), so it lines up with "Sound" (MD9) |
| State | `Pill size="sm"`: `success` with `learner.profile.sound.on` when on, `neutral` with `sound.off` when off (the Sound row's words) |
| Divider | `borderTopWidth: borderWidth.thin`, `border.subtle`, `Spacer sm` above and below |
| Order | Sound row, then How to add a voice (when shown), then the divider and this row: How to add a voice belongs to the voice line |

## Decisions

Mock decisions are numbered MD1 to MD12, so they are not confused with the spec's departures D1 to D3.

- **MD1. Always there (spec D1, approved).** The link is drawn from the round's first frame. The mock checks that its
  box is the same while the round holds and once it is active (no-move), in all three windows.
- **MD2. Inactive = `softDisabled`, not `disabled`.** The spec asks for "announced as disabled" (3.7). `softDisabled`
  keeps the link in the web tab order, so focus order (heading, speaker, link, answers) does not change when the hold
  ends. On native `Button` makes it plain `disabled` (`Button.tsx`), which VoiceOver and TalkBack still reach.
- **MD3. No glyph on the link (open question 7; Q1). Owner decision 2026-11-24: words only, no glyph, as proposed.** The mock draws three variants (L7): (a) words only,
  (b) `speaker-off`, and (c) `ear`. Proposal: (a); the owner chose (a).
  - `speaker-off` is the app's sign for "Sound is off" (the Sound card when muted, `VoiceHelp/spec.md` section 4). On a round whose sound is on, it would say "the sound is off" or "tap to mute", which is false and might stop a learner from tapping it.
  - The words are the accessible name either way (WCAG 2.5.3).
  - A glyph also widens the link, so it wraps sooner.
  - If the owner wants a picture cue for learners who cannot read yet, (c) `ear` is the one that does not lie. It is an existing glyph.
- **MD4. Hear it carries the speaker glyph (open question 2; yes).** The same glyph as the speaker it replays, as on
  the games' Hear it buttons that carry one (`ClozePickGame.tsx:322`, `SentenceBuilderGame.tsx:303`: `leading={<Icon
  name="speaker" size={spacing.xl} …/>}`; Match Sound's wrong-answer bubble has none). Show the letters has no glyph: there is no letters glyph, and the words are short.
- **MD5. Show the letters is primary, Hear it secondary (filled `brand.secondary`).** That is the order the spec gives
  (3.3). They are two different ways on, not "OK and cancel". So Hear it is a filled secondary button, as it is in the
  wrong-answer bubble, not a ghost.
- **MD6. Width on wide windows (Q2). Owner decision 2026-11-24: both sheets are capped at 720 px wide, as proposed.** VoiceHelpSheet is full width today; on a 1024
  tablet that is a 1024 wide sheet holding one sentence. Proposed: both sheets are capped at
  `layout.maxWidth.reading` (720) from window class `regular` and stay bottom sheets, centred at the bottom.
  - This goes beyond spec 3.3 ("built like VoiceHelpSheet") and 3.9.
  - Precedent: `DisplaySheet.tsx` also caps at `maxWidth.reading`, but it becomes a centred dialog instead.
  - The owner approved on 2026-11-24 and the line is in spec 3.3, so CH-1a builds both sheets capped.
- **MD7. The line is plain `Body`, `text.primary`.** It is the one instruction on the sheet. The help sheet's note
  stays a muted caption; that is a different role.
- **MD8. Link placement (open question 1): in the speaker row, wrapping (proposed in the wireframe).** At 360 and on a
  tablet the link stays in the row after the caption. At 320, or with large text, it drops under the caption, centred.
  Shots `link-ready-*`. At 360 the outlined pill is the loudest thing in the speaker row (louder than the bare speaker
  glyph). It is still smaller than the heading and the tiles ("never the largest", 3.2), and the device check (3.14)
  decides whether it is too loud.
- **MD9. The switch row has no glyph.** There is no "letters" glyph, and borrowing `book` or `ear` would add a meaning.
  The label is indented to line up with "Sound", so the two rows read as one card about sound.
- **MD10. The guidance-only sheet** is drawn over Discover (C6); the same sheet serves the cue rounds of 3.1.
- **MD11. The sheet scrolls as one, with a scroll cue.** The title row and the line (on the help sheet: the title, the
  note, the steps and the footer) are one scroll area, and the buttons stay under it. At 320 x 568 with 200 % text the
  longest lines do not fit, and a line cut at a line break can read as a complete sentence. So when the body scrolls,
  a `border.strong` rule is drawn over the buttons, and CH-1a sets the native cues: `persistentScrollbar` on Android,
  and `flashScrollIndicators()` when the sheet opens. The `whole` check fails if a line is cut without the cue.
- **MD12. Spanish and Korean** in `mock/lengths.html` are length drafts of the new keys, for this board only. The other
  words are the shipped values. Korean breaks between words (`word-break: keep-all`). CH-1a and CH-2 draft and review
  the dictionary values (spec 3.10). The review's wording notes are in the drafts:
  - es: "¿No se oye?" puts it on the device ("¿No lo oyes?" put it on the learner). The Apple line uses "Desactiva" (Apple's wording). The computer line is shorter: "…tenga sonido".
  - ko: "올려요" as the shipped "볼륨을 올려 주세요". "그런 다음".
  - "letras" and "글자" follow the translator note of 3.10.
  At 320 with 200 % text, the Spanish computer line is still the longest: the sheet scrolls and shows the cue (MD11).

## Accessibility

- Reading and focus order on a round: heading, speaker (and Hear again), the link, the answers (`order` check).
- The link's name is its words; no hint. While the round holds it is announced as disabled (MD2).
- The sheet is modal. Focus starts on the title (a header). Then come Close, the line, Show the letters and Hear it.
  The scrim cannot take focus, and the round behind is inert. Close, the scrim and back return focus to the link.
- After Show the letters (spec 3.7): first the sheet closes (on iOS, the code waits for `onDismiss`). Then focus moves
  to the surface's target (the speaker on Match Sound; `letters-shown` draws the focus ring there). Then, after
  `motion.duration.slow` (320 ms), the text comes up in the panel's polite live region. On iOS it is announced once.
- Contrast, from the tokens:

  | Element | Colours | Ratio |
  |---|---|---|
  | link label | `brand.primary` on `surface.canvas` | 5.1:1 |
  | inactive link | `text.muted` on `surface.sunken` at 0.6 opacity | about 2.4:1 on the canvas (5.1:1 at full opacity). An inactive control is exempt from WCAG 1.4.3, and the state lasts at most 2 s; this is the design system's disabled rule, unchanged |
  | sheet line | `text.primary` on `surface.paper` | 16.1:1 |
  | Show the letters | `text.onPrimary` on `brand.primary` | 5.4:1 |
  | Hear it | `text.onSecondary` on `brand.secondary` | 5.2:1 |
  | switch label | `text.primary` on paper | 16.1:1 |
- Greyscale (`greyscale-1280.png`): the inactive link is a filled grey pill and the active one an outlined pill. The
  switch says On or Off in words. The two sheet buttons come out as near greys:
  they differ by label, by order and by Hear it's glyph.
- 200 % text at 320 x 568: the heading wraps, the link drops under the caption, and the tiles scroll. In the sheet the
  title wraps, and the line scrolls inside when needed, with the buttons in view (`reach` and `whole` checks; the scroll cue; `*-end.png`).

## Constants

Values that are not tokens.

| Where | Value | Derived from |
|---|---|---|
| Speaker glyph | 48 | `MatchSoundGame.tsx` (unchanged) |
| Close glyph | 22 | `VoiceHelpSheet.tsx` (unchanged) |
| Sound row glyph | 24 | `ProfileScreen.tsx` (unchanged) |
| Sheet max height | 85 % | `VoiceHelpSheet.tsx` (unchanged) |
| On pill label | drawn in `feedback.successDark` | the shipped `Pill` success label is a literal in `Pill/style.ts` (outside this pass); the mock uses the nearest token |
| Tile size | 96 (phone), 144 (tablet) | `tileMetrics` floor `touchTarget.hero`; drawn, not computed |
| Board frames | 360 x 740, 320 x 568, 1024 x 768 | design board only, not UI |

## Open questions (for the owner and the review)

Owner decision 2026-11-24: Q1 to Q6 answered in session, "all as recommended". Q1, Q2 and Q3 are decided; Q4, Q5 and Q6 stay notes.

- **Q1 (open question 7). A glyph on the link?** Proposed: none (MD3). Alternative: `ear`. Not `speaker-off`. **Owner decision 2026-11-24: none; the link is words only.**
- **Q2. The sheets' width on wide windows (MD6).** Capping both sheets at 720 is new to `VoiceHelpSheet`. CH-1a would
  build it for both sheets. **Owner decision 2026-11-24: yes, capped at 720 on both sheets (spec 3.3).**
- **Q3 (wireframe open question 4).** An iPad that asks for the desktop site and reports no touch points, or an
  Android tablet whose Chrome asks for the desktop site, gets the computer line. Proposed: acceptable. The computer
  line ("Turn the volume up. Check that this page is not muted.") is still true on those devices. **Owner decision 2026-11-24: accepted.**
- **Q4 (wireframe open question 5).** Headphones paired elsewhere are not named. Proposed: leave out (one short line).
- **Q5 (wireframe open question 3).** Is "Turn off silent mode" clear? At 200 % text the Apple line takes three
  lines at 320 and fits. Device check 3.14 decides.
- **Q6 (for CH-2).** The shipped Sound switch puts "On" in its accessible name and also sets `checked`, so it is said
  twice (the mock copies it as shipped, outside this pass). The new switch does not repeat it: its name is the label
  only, and its pill is hidden from screen readers.
- Not answered here: OD-CH2, OD-CH6 and OD-CH7 (re-opened or new, awaiting the owner). They change no drawing in this
  pass: Checks keep no link until OD-CH6 is answered.

## Review log

- **Round 1 (2026-11-24), two independent reviewers**: (1) spec conformance and code truth; (2) child safety,
  anti-shame, accessibility, copy and i18n. Both verdicts were "ready after fixes", with no blockers. Fixed:
  - Major (code truth): the 720 width cap was written in both component specs as settled. It is now marked
    "proposed, pending the owner" there and in MD6, with the `DisplaySheet` precedent (Q2).
  - Major (charter): at 200 % text the Spanish sheet cut its line at a line break, with no sign that it scrolls. Now:
    - the title and the line scroll as one;
    - a scroll cue is drawn when the body scrolls (MD11), and CH-1a sets `persistentScrollbar` and `flashScrollIndicators()`;
    - a `whole` check fails on a cut line without the cue;
    - the es line is shorter.
  - Minors:
    - The 360 wrap claim was wrong: at 360 the link stays in the row (MD8).
    - The README said the two sheet buttons differ by fill in greyscale; they do not (corrected).
    - The inactive link's real contrast, about 2.4:1 at 0.6 opacity, is now stated with the WCAG exemption.
    - MD4 now cites the Hear it buttons that do carry the glyph, at `spacing.xl` (not a literal 24).
    - The scrim recipe now follows `ConfirmSheet.tsx` (`focusable={false}`, `tabIndex -1`, `accessibilityElementsHidden`).
    - The web back and Escape go through `useHistorySheet`.
    - Focus on the title is set through a focusable wrapper `View` with a ref.
  - Nits:
    - Discover's Hear it is secondary, as shipped.
    - The es and ko speaker names are the shipped values.
    - Mock decisions are renamed MD1 to MD12.
    - The wireframe's Checks gap is noted.
    - `announceAndWait(text, gapMs)` is spelled out.
    - `onShowLetters` is required on a full sheet (union props).
    - The VoiceHelp spec quotes the shipped "Come back and reopen Hangul Route." / "Reload this page."
    - es "¿No se oye?" and "Desactiva"; ko "올려요" and "그런 다음" (MD12).
    - The double "On" of the shipped Sound switch goes to CH-2 (Q6).
  - Agreed by the charter reviewer: MD3, words only on the link (`ear` is the only acceptable fallback, never struck
    through).
  - Not changed: the link's loudness at 360 (left to the 3.14 device check, MD8).
