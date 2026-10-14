# Icon: My route glyphs `pin`, `check-circle`, `book`, `ear`, `pencil` (component spec v1)

Sections on this sheet: the My route glyphs (R-2a, below) · [`dash`](#dash-the-miss-mark-of-a-locked-answer-f-voc-004-s-4b) (F-VOC-004 S-4b) · [`note` and `heart`](#note-and-heart-notes-from-grown-ups-f-feedback-001-fb-6) (F-FEEDBACK-001 FB-6) · [`route` and `flag`](#route-and-flag-the-learning-route-amendments-route-learning-route-lr-2) (Learning Route LR-2) · [`shift`, `shift-on` and `backspace`](#shift-shift-on-and-backspace-the-hangul-keyboard-f-curr-001-g-3) (F-CURR-001 G-3) · [theme glyphs](theme-glyphs.md) (the Heritage Journey grid: `hangul-tile`, `rice-bowl`, `lantern`, `leaf`, `spinning-top`)

Spec: `docs/specs/F-ROUTE-001-my-route-overview.md` §3.3 (stage badges), §3.6 (start marker), §3.7 (skill rows), §3.14 (no colour-only meaning), PR R-2a in §6.1 · wireframe: `design/wireframes/journey/my-route-overview.md` (legend `pin`; screens A, B and C1 to C5: stage badges, tags and the practice rows) · also needed by F-PLC-001 P-7 (start pin and placed-out look, amendment AM-10)
Code: `packages/design-system/src/components/Icon/glyphs.ts` (geometry, pure data) · `types.ts` (`IconName`) · tests `Icon/__tests__/glyphs.test.ts`
Preview: `route-glyphs-v1.png` (20, 24, 48 and 96 dp next to `check`, `journey` and `card` for family fit)

## What they are

Five glyphs for the My route page and the level-check result. They join the existing set on the same 24 x 24 grid with the same drawing rules: round caps and joins, stroke 2 (2.2 to 2.4 where a line risks a hairline at 20 dp), filled parts are solid silhouettes. All five are mostly outline, so they sit quietly next to the filled tab icons and never compete with the hero button.

| Glyph | Meaning | Where (spec) | Geometry |
|---|---|---|---|
| `pin` | "You started here" | stage-row tag (R-3, R-7a); placement start cell (F-PLC-001 P-7) | outlined drop, stroke 2.2, closed; solid centre dot r 2.6 at (12, 9.5) |
| `check-circle` | Complete: the `complete` stage state of F-ROUTE-001 §3.3 (latched, **or** every grid quest done before the latch is written, **or** the stage card owned); it stays Complete once latched | stage badge (R-3), keyed on `StageRow.state === 'complete'`, never on `latched` or `stageDoneAt`; never used for `known` (that badge is the ring-with-disc pip shape, R-2b) or `explored` (bare `check`) | ring r 9 at the centre, stroke 2.2; the `check` mark scaled into it, stroke 2.4 |
| `book` | Read | skill row (R-3) | open book outline, stroke 2.2; spine line, stroke 2 |
| `ear` | Listen | skill row (R-3) | ear rim and an inner curl that closes back on itself (no free downward hook, so it never reads as a question mark), two sound waves on the left, stroke 2.2 / 2 |
| `pencil` | Write (trace games) | skill row (R-3) | diagonal pencil outline, stroke 2.2; tip line and ferrule line, stroke 2 |

```
pin:           stroke M12 21.5 C9.5 18.5 5 14 5 9.5 A7 7 0 0 1 19 9.5 C19 14 14.5 18.5 12 21.5 Z (2.2) + fill circle(12, 9.5, 2.6)
check-circle:  stroke circle(12, 12, 9) (2.2) + stroke M7.5 12.5 L10.5 15.5 L16.5 8.5 (2.4)
book:          stroke M12 6.5 C10 5 7 4.5 3.5 5 V18.5 C7 18 10 18.5 12 20 C14 18.5 17 18 20.5 18.5 V5 C17 4.5 14 5 12 6.5 Z (2.2) + stroke M12 6.5 V20
ear:           stroke M9 10 A5.5 5.5 0 0 1 20 10 C20 13.5 17 14.5 17 17.5 A3 3 0 0 1 11.5 19 (2.2) + stroke M12.5 13 V10.5 A2.5 2.5 0 0 1 17.5 10.5 C17.5 12 15.5 12.5 14 13.5 + stroke M6.5 8.5 Q4.5 12 6.5 15.5 + stroke M3.5 6.5 Q1 12 3.5 17.5
pencil:        stroke M4 20 L5 15 L15 5 L19 9 L9 19 Z (2.2) + stroke M5 15 L9 19 + stroke M13 7 L17 11
```

## Rules

- **Tokens only.** Callers pass a colour token (`colors.text.primary` by default, `colors.text.muted` on a quiet tag, the stage colour only as decoration). The glyph is never the only carrier of meaning: every use sits next to its word ("Complete", "You started here", "Read", "Listen", "Write"), F-ROUTE-001 §3.14.
- **No commerce, no failure.** None of these is a lock or a price; `check-circle` is earned-only (the `complete` stage state), never a quiz verdict. A miss stays amber with Hoya `thinking` (CLAUDE.md §1).
- **No speaking glyph.** There is no microphone or mouth glyph in this set (owner decision 2026-10-10; F-ROUTE-001 §10). `mic` was dropped from R-2a in review.
- **Explored is not Complete.** `explored` (a taste stage, F-ROUTE-001 §3.3) uses the existing bare `check` on its badge, never `check-circle`; `check-circle` is reserved for `complete`. The R-3 badge tests cover `complete`, `explored` and `known`.
- **Sizes.** Minimum 20 dp (stage-row tag and skill rows); 24 dp in the stage badge. Checked at 20 and 24 dp in the preview: each glyph stays distinct from `check`, `journey` and `card` and from each other.
- **Accessibility.** Glyphs are decorative inside a labelled row; the row label carries the words. `Icon` has no accessibility props of its own, so the call site hides it: either the Icon sits inside the row's single accessible element (`accessible` with an `accessibilityLabel`, which groups its children), or it is wrapped in a `View` with `importantForAccessibility="no-hide-descendants"` and `accessibilityElementsHidden`. A hide-by-default prop on `Icon` would be a separate design-system change, not R-2a.
- **Tests.** The existing glyph tests (every name drawn, valid paths, all glyphs distinct, inside the 24 x 24 box, stroke band 1.5 to 3) cover them; R-2a adds a block that pins the outline style (stroke 2 to 2.6), the closed pin drop with its dot inside it, the check mark inside the ring with a visible gap (0.5 at 20 dp), and the ear's inner curl closing on itself (no question-mark tail).

## `dash`: the miss mark of a locked answer (F-VOC-004 S-4b)

Spec: `docs/specs/F-VOC-004-speed-round.md` §3.6 ("a non-colour mark (a short horizontal dash)"), §3.8 ("miss = amber + a dash"), §3.11 behaviour 4 · wireframe: `design/wireframes/vocab/speed-round.md` frame F (`[pic]  -`).

| Glyph | Meaning | Where | Geometry |
|---|---|---|---|
| `dash` | "Not this one" on an answer that is locked and moves on (no retry, so it is not `replay`) | `ChoiceCard` `wrong` state with `wrongMark="dash"` (`VocabQuestionView` in the Speed Round) | one level bar across the centre, stroke 2.6: `M7 12 H17` |

- Never a cross or an X: a short bar, drawn in `text.primary` on `feedback.nudgeLight` (14:1), always next to the amber tone and the words "Not this one" in the card's name. Never `feedback.danger`.
- 10 dp long on the 24 grid (shorter than the `plus` bar, 14), so at 24 dp it reads as a dash, not a divider. Stroke 2.6 like `check` and `close`, the other status marks.
- Tests: the glyph block in `Icon/__tests__/glyphs.test.ts` pins one horizontal stroke centred on y 12, 8 to 13 long, at least 2.4 wide, with no vertical part.

## `note` and `heart`: notes from grown-ups (F-FEEDBACK-001 FB-6)

Spec: `docs/specs/F-FEEDBACK-001-adult-feedback-channel.md` §6.5 (Home card, notes list), §6.6 (reactions), §6.10 item 1 (grown-up dashboard rows), §6.11 (no red), §6.12 (a picked answer is not shown by colour alone), §13 (glyph test row), PR FB-6 in §14.1 · wireframes: `design/wireframes/home/notes-card.md` and `notes/list.md` (`[note icon]`, the learner's own `[heart]` answer), `notes/detail.md` (the reaction row, frames A and C), `parent/notes.md` (`[note icon]` on the dashboard rows), `console/notes-sent.md` and `console/family-notes.md` (`[heart] Thank you`, icon plus label)
Code: `packages/design-system/src/components/Icon/glyphs.ts` · `types.ts` · tests `Icon/__tests__/glyphs.test.ts` (block "notes glyphs") · console pages draw the same data through `IconSvg` (`@hangul-route/design-system/icon-glyphs/dom`)
Preview: `notes-glyphs-v1.png` (20, 24, 48 and 96 dp next to `card` and `book`, which the note must not be mistaken for; `pin`, the other outline that ends in a point at the bottom; the other three reaction glyphs `pencil`, `check-circle` and `sparkle`; and the filled `star`)

| Glyph | Meaning | Where | Geometry |
|---|---|---|---|
| `note` | A note from a grown-up | Home card row 2a and the notes list rows (FB-8); the grown-up dashboard rows "Notes for <learner>" (FB-9) | portrait sheet 13 x 18 centred on x 12, stroke 2.2, its top-right corner cut at 45 degrees; the fold drawn from one end of the cut to the other, stroke 2; two level lines of writing, the second shorter, stroke 2 |
| `heart` | Thank you: the `thanks` reaction (§6.6) | the reaction row on the note page and the learner's own answer on the list (FB-8); the answer on the console sent list and the family view (FB-11a, FB-12) | one closed outline, stroke 2.2: two half-circle lobes r 4.25 that meet at (12, 8.75), sides that curve down to the tip at (12, 20.5); mirror-symmetric on x 12 |

```
note:   stroke M5.5 3 L13 3 L18.5 8.5 L18.5 21 L5.5 21 Z (2.2) + stroke M13 3 L13 8.5 L18.5 8.5 + stroke M9 13 L15 13 + stroke M9 17 L13 17
heart:  stroke M12 20.5 C9 17.5 3.5 13.5 3.5 8.75 A4.25 4.25 0 0 1 12 8.75 A4.25 4.25 0 0 1 20.5 8.75 C20.5 13.5 15 17.5 12 20.5 Z (2.2)
```

- **Tokens only.** Callers pass a colour token (`colors.text.primary` by default, `colors.text.muted` on a quiet row). Never `colors.feedback.danger` or any red: a note is encouragement and the heart is thanks, and §6.11 allows no red or danger colour on the notes screens. Every use sits next to words that say what it is: the sender label or the new-notes count on the Home card, the sender label on a list row, "Notes for <learner>" on a dashboard row, the reaction's label ("Thank you") on the heart. A screen that draws the heart checks its colour token in its own test.
- **Outline only.** Both glyphs are drawn with the `stroke` helper and have no fill part. The heart is never filled: a solid heart reads as a game "life", and the app has none (F-VOC-004 §4, F-QUEST-002 §3.9). A picked answer shows the radio mark and the `check` beside its word (`notes/detail.md` frame C, §6.12); the heart itself never fills or changes colour.
- **An answer, not a score.** The heart appears only for the `thanks` reaction. It is never a count, a like total, a favourite toggle or a rating, and never sits on a quiz, a streak or a meter. In the reaction row it is drawn at the same dp size as `pencil`, `check-circle` and `sparkle`, at the outline weight of `pencil` and `check-circle` (stroke 2 to 2.4); every reaction carries its own label in the same type, so the words, not the glyphs, are what the learner picks between.
- **Filled is not picked.** `sparkle`, the `happy` reaction, is a solid shape by design (it predates this sheet), so the reaction row mixes three outline glyphs with one filled glyph. A filled glyph never means "picked": the picked reaction is shown only by the radio mark and `check` beside its label (§6.12), and the unpicked reactions keep the same glyph and colour.
- **No unread dot.** "New" is a text pill beside the note (§6.12). The glyph looks the same for a read and an unread note; nothing is drawn on it.
- **Sizes.** Minimum 20 dp (list rows, the reaction chips); 24 dp on the Home card and the dashboard rows. Checked at 20 and 24 dp in the preview: the note stays apart from `card` (landscape, with a band) and `book`; the heart from `pin` (a round head with a solid dot), `star` and `sparkle`.
- **Accessibility.** Decorative, as for the glyphs above: the row, card or radio label carries the words (`a11y.notes.card` on the Home card, the reaction's label in the radio group), and the console's `IconSvg` is `aria-hidden`.
- **Tests.** The "notes glyphs" block in `Icon/__tests__/glyphs.test.ts` checks that both names exist and that every part is exactly a `stroke(d)` or `stroke(d, width)` value at width 2 to 2.6 with no fill. For the heart it checks one closed outline, mirror-symmetric on x 12, with two level half-circle lobes drawn left to right over the top that meet on x 12, and the tip as its one lowest point on x 12. For the note it checks a portrait sheet centred on x 12 with one diagonal edge (the 45-degree cut at the top right), a fold from the cut's start to its end through the inside corner, and two level lines inside the sheet and below the fold, each at least 1 unit clear of every other part on the 24 grid (about 0.8 dp at 20 dp). The set-wide tests (every name drawn, valid paths, all glyphs distinct, inside the 24 x 24 box, stroke band 1.5 to 3) cover both as well.

## `route` and `flag`: the Learning Route (AMENDMENTS-ROUTE-LEARNING-ROUTE LR-2)

Spec: `docs/specs/AMENDMENTS-ROUTE-LEARNING-ROUTE.md` section 4.3 (the goal tag and the route card lines), section 5.1 (the Route tab icon), section 10 (glyphs hidden, words carry the meaning), assumption b, PR LR-2 in section 13 · design sheet: `learning-route-glyphs.md` (the full rationale and the assumption b checks) · wireframes: `design/wireframes/journey/learning-route.md` A, A2, G, `parent/learning-route.md` R and L2, `console/learning-route.md` T3 · screens: `design/screens/learning-route/` (`route-card.md`, `stage-list.md`, `tab-bar.md`)
Code: `packages/design-system/src/components/Icon/glyphs.ts` · `types.ts` · tests `Icon/__tests__/glyphs.test.ts` (block "Learning Route glyphs")
Preview: `learning-route-glyphs-v1.png`, rendered from `learning-route-glyphs.html` (20, 24, 48 and 96 dp next to `journey`, `pin`, `home`, `library` and `check-circle`, the same grid in greyscale, and each glyph in context)

| Glyph | Meaning | Where | Geometry |
|---|---|---|---|
| `route` | The Learning Route page | the Route tab icon (LR-4), 24 dp; selected `brand.primary`, else `text.muted` | a solid start dot r 2.2 at (5, 20); a road at stroke 2.2 that runs right and bends back up (r 3.25) to end 0.3 short of the pin; a solid map pin (head r 5.1 at (8.5, 6.8), tip at (8.5, 14.6)) with a round hole r 1.8 drawn as a second subpath the other way round |
| `flag` | The goal stage | the route card's Goal line, 20 dp (LR-5a); the "Your goal", "{name}'s goal" and "Plan goal" tags, 16 dp (LR-5a, LR-8); the report's goal line, 20 dp (LR-8) | a pole at stroke 2.2 from y 21.5 up to y 3; a solid swallow-tail pennant from the pole to x 18.5, notched at (15.5, 8) |

```
route:  fill circle(5, 20, 2.2)
        + stroke M5 20 H15.75 A3.25 3.25 0 0 0 15.75 13.5 H11.5 (2.2)
        + fill M8.5 14.6 C6.4 12.4 3.4 9.6 3.4 6.8 A5.1 5.1 0 0 1 13.6 6.8 C13.6 9.6 10.6 12.4 8.5 14.6 Z
               M6.7 6.8 A1.8 1.8 0 1 0 10.3 6.8 A1.8 1.8 0 1 0 6.7 6.8 Z
flag:   stroke M6 21.5 V3 (2.2) + fill M6 3.5 H18.5 L15.5 8 L18.5 12.5 H6 Z
```

- **Tokens only.** Callers pass a colour token: `text.primary` on the route card and the tags; `brand.primary` or `text.muted` in the tab bar (the bar's existing tints). `flag` is a destination, never a warning: never `feedback.danger` or `feedback.nudge`.
- **Filled, like the tab icons.** `route` is solid so the bar keeps one weight with `home` and `library`. Its solid pin is not the outlined `pin` ("You started here"); the two never sit side by side. `route` differs from `journey` (a winding line between two equal dots) in outline at 20 and 24 dp, also in greyscale.
- **The hole without a prop.** `react-native-svg` and the DOM both fill with the `nonzero` rule by default; the hole is drawn in the opposite direction to the drop, so it stays open and `Icon` needs no `fillRule` prop.
- **Never alone.** Every use sits next to its words: the tab label "Route" with the accessibility label "Learning Route"; "Goal", "Your goal", "{name}'s goal", "Plan goal". Colour is never the only cue. No number, lock, star or trophy is drawn on either glyph.
- **Sizes.** 24 dp in the tab, 20 dp on the route card and report lines, 16 dp in the stage-row tags (the size `TrailRow` uses for `pin`).
- **Accessibility.** Decorative, as for the glyphs above: the navigator labels the tab, and elsewhere the glyph sits inside a labelled row or a hidden wrapper.
- **Tests.** The "Learning Route glyphs" block in `Icon/__tests__/glyphs.test.ts` checks: both names in `IconName` and apart from `journey` and `pin`; `route` has one road at stroke 2.2 that starts at the centre of a filled start dot and ends outside the pin, its round cap within 0.5 of the drop; the pin is two subpaths whose shoelace sums (over the sampled curves and arcs) have opposite signs, with the hole wholly inside the drop and the tip as its one lowest point; `route` stays inside the 24 x 24 box with its stroke caps; `flag` has one vertical pole at stroke 2.2 and one closed pennant hung from the pole whose only point inside its own bounding box is the notch `L15.5 8`. The set-wide tests cover both as well.

## `shift`, `shift-on` and `backspace`: the Hangul keyboard (F-CURR-001 G-3)

Spec: `docs/specs/F-CURR-001-upper-stage-content.md` §3.7 item 2 · screen spec `design/screens/minigame-writing/keyboard.md` (key faces) · mock `design/screens/minigame-writing/mock/keyboard.html` (the same paths)

| Name | Means | Where | Geometry (24 x 24) |
|---|---|---|---|
| `shift` | Shift, off | the Shift key of `HangulKeyboard` | an outlined up arrow with a stem, stroke 2.2 |
| `shift-on` | Shift, on (one-shot) | the same key while the shifted faces show | the same arrow, filled |
| `backspace` | Delete the last letter | the Del key of `HangulKeyboard` | a key cap pointing left, stroke 2.2, with a small cross inside |

```
shift:     stroke M12 4 L20.5 12.5 H15.5 V20 H8.5 V12.5 H3.5 Z (2.2)
shift-on:  fill   M12 4 L20.5 12.5 H15.5 V20 H8.5 V12.5 H3.5 Z
backspace: stroke M9 5.5 H20.5 V18.5 H9 L3 12 Z (2.2) + stroke M12 9.5 L16.5 14.5 M16.5 9.5 L12 14.5 (2.2)
```

- **Never alone, never a miss mark.** The glyphs are key faces: each key carries its accessible name (`a11y.minigame.keyboard`), and Shift's state is also its `selected` state and its fill, never the glyph alone. The cross inside `backspace` sits in a key cap, so it never reads as the red X of a miss (the game never shows one).
- **Tokens only.** `text.primary` on the key; Shift on uses `brand.secondaryDark`.
- **Tests.** The set-wide tests in `Icon/__tests__/glyphs.test.ts` (names, path data, distinct, inside the box, stroke band).

## Theme glyphs: the Heritage Journey grid

Five glyphs, one per theme, replace the single letters L, F, H, N, P in the Journey cells and sit above each column label: `hangul-tile` (Letters), `rice-bowl` (Food), `lantern` (Holidays), `leaf` (Nature), `spinning-top` (Play). They are decorative; the words stay in the column label and in each cell's label. Geometry, sizes and rules: [`theme-glyphs.md`](theme-glyphs.md); preview `theme-glyphs-v1.png`.
