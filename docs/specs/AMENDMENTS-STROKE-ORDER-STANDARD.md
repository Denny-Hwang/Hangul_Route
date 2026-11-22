# AMENDMENTS-STROKE-ORDER-STANDARD — stop teaching a stroke order nobody has checked; then source and check the data

Status: ready for rows SO-0b, SO-0c, SO-1 and SO-1d (owner decision 2026-11-22: OD-SO1 to OD-SO4 accepted as recommended; OD-SO5 — the Korean teacher of WO-27 reviews the table and does SO-3; the revision-3 review of 2026-11-22 is adjudicated, §11). SO-2 still waits for table rows the reviewer approves; SO-3 is the reviewer's. Revision 3 (2026-11-21, re-based on `d5ba0217c`; revision 2 was written for work order WO-03 of `docs/roadmap/review-2026-11/phase-1-safety.md`, row SO-0, on `5573e1072`). The multi-agent review of 2026-11-21 (§11) is adjudicated in revision 2; revision 3 builds on AU-14, which rewrote the stroke data upstream (§1, §11).

**Amends**: F-004 (Trace Stroke) · F-005 (stroke order) · F-006 (stroke direction: the nudge for unreviewed letters) · F-007 (the animated hint: shape reveal, caption) · F-008 (strict mode: unreviewed letters pass on coverage) · F-TCH-004 §3.6 (the reviewed-stroke list; the presenter's stroke panel) · F-CURR-001 §3.7 (Trace Word's coaching) · tag **[SO]**
**Scope**: `apps/mobile/src/content/jamo-strokes.ts`, `apps/mobile/src/logic/stroke-order-taught.ts` (new), `apps/mobile/src/screens/minigames/TraceStrokeGame.tsx`, `apps/mobile/src/screens/minigames/TraceWordGame.tsx`, `apps/mobile/src/logic/trace-word/evaluate.ts`, `apps/mobile/src/components/StrokeHint.tsx`, `apps/mobile/src/screens/presenter/slides/LetterSlide.tsx`, `apps/mobile/src/logic/trace-copy.ts`, `packages/i18n` (en, es, ko), `docs/specs/assets/stroke-order-table.md` (new), `.github/CODEOWNERS` (two lines)
**Owner**: solo dev; the stroke table needs a person who teaches Hangul handwriting (§3.4)
**Rollout**: SO-1 next release; SO-2 (now a check of the AU-14 data against the sourced table) letter by letter as table rows are approved

---

## 1. Context

Re-read on `d5ba0217c` (revision 2 read `5573e1072`).

- **Upstream rewrote the data.** AU-14 (`AMENDMENTS-AUDIT-2026-11.md` row AU-14, merged in #1035; audit finding EDU-6, `docs/launch/product-review-2026-11-15.md:248`) changed `apps/mobile/src/content/jamo-strokes.ts` to "the standard school stroke order and stroke counts" (header, `:15-23`): ㅁ 3 strokes, ㅌ 3, ㅈ 2 (the bar runs into the left leg), ㅊ 3 (the tick, then ㅈ's two), ㅗ and ㅛ ticks first, ㅂ's bars from the same height, and each final shares its consonant's definition (`:76-104`, `:266-271`). `content/__tests__/jamo-stroke-order.test.ts` pins every count and direction against its own `STANDARD` table (`:50-84`). The "not perfectly anatomical" disclaimer is gone. The ㅂ shape note and the ㅜ/ㅠ "upward tick" comments of revision 2 are fixed by the same row.
- **Provenance is unchanged.** The new order is still hand-authored: AU-14's table is the audit's own ("직접 확인", EDU-6), with no textbook, edition, page or person named, and no reviewer. `reviewedStrokeIds` is still empty (`jamo-strokes.ts:283`); AU-14's As built says so on purpose ("stays empty ... until a teacher has reviewed the data"), and the audit's standing rules forbid claiming expert review. Only the presenter reads the list (`logic/lecture/content.ts:78`), to caption its panel "Simplified stroke guide" (`packages/i18n/src/messages/en/learner.ts:2480`).
- **Also done by AU-14:** the order line no longer names a stroke: `pass.order` is **You got it! Next time, try the strokes in the right order. Tap Show me to see.** (`learner.ts:839`, en, es and ko). Revision 2's SO-2 copy change is dropped.
- Where the data's order still reaches learners (none of these changed upstream):
  - **Trace Stroke** scores with `checkOrder: true, checkDirection: true` (`screens/minigames/TraceStrokeGame.tsx:214-215`). Order does not decide a pass (strict mode is never on: `MinigameScreen.tsx:214`), but it picks the coaching line: after a pass with `orderCorrect === false` the learner reads `pass.order` (`logic/trace-copy.ts:41`).
  - **Direction** also misfires: a target stroke with no matched drawn stroke counts as direction `false` (`logic/stroke-scoring.ts:212-219`, by design in F-006 `:35`), so a learner who writes a letter in fewer or other strokes than the data gets **Nice! Try drawing left-to-right next time.** (`learner.ts:840`).
  - **Show me** (`components/StrokeHint.tsx`) animates the data's order; under reduced motion its still diagram shows **numbered start badges and direction arrows**; its screen-reader label reads the order aloud (`describeStrokeOrder`, `:155`). `StrokeHint` takes only `target` (`:30-51`).
  - **Trace Word** (Stage 7: 호야, 학교, 토끼, 소, 곰, 돼지 — `content/__tests__/trace-word-strokes.test.ts:13-16`) coaches order and direction over the whole unit (`logic/trace-word/evaluate.ts:76-96`; "Order and direction coach, never fail", `TraceWordGame.tsx:113`) and builds an `orderLabel` from `describeStrokeOrder` (`:340-342`).
  - **The presenter** (`screens/presenter/slides/LetterSlide.tsx:162-204`, caption `:77`) shows the numbered still diagram and the animation to a whole class.
- Probes on `d5ba0217c` with the real `scoreTrace`, `directionNudgeFor` and `passMessage`, full coverage each:

| Jamo | Data (AU-14) | Other common forms (**hypothesis — to be sourced in SO-0b**) | What a learner who writes the other form sees today |
|---|---|---|---|
| ㅗ `jamo:o` (`:226-231`), ㅛ `jamo:yo` (`:234-240`) | tick(s) first, then the long bar | (revision 2's hypothesis; now the data) | data order: `pass.clean`; bar first: `pass.order` |
| ㅌ `jamo:tieut` (`:160-166`) | 3: top bar; middle bar; ㄴ shape | 4 strokes with a separate upper-left vertical (the pre-AU-14 data) | 3-stroke: `pass.clean`; 4-stroke: `pass.order` |
| ㅁ `jamo:mieum` (`MIEUM`, `:88-92`), final (`:269`) | 3: left bar; top and right; bottom bar | one or two strokes | `pass.open` (unmatched target) |
| ㅈ `jamo:jieut` (`:134-140`) | 2: bar into left leg; right leg | 3: bar; left leg; right leg | `pass.open` |
| ㅊ `jamo:chieut` (`:142-149`), ㅎ `jamo:hieut` (`:178-185`) | vertical tick first | a short horizontal top stroke; ㅊ in 4 strokes | `pass.open` |

So AU-14 moved the data to revision 2's hypothesis column, and the misfires moved to the other forms: today a learner taught the 3-stroke ㅈ, a horizontal top stroke on ㅊ or ㅎ, or ㅁ in fewer strokes is told to draw "left-to-right", and nobody has yet sourced which forms are correct. Every count in the data is still a hypothesis until sourced.

Trace rounds that reach learners today: Stage 1 q2 (`minigame:s1-letters-q2-*`, ㅁ ㅇ ㅗ ㅜ) and q12 (`minigame:s1-nature-q3-apply`, final ㅁ ㅂ ㄹ ㅇ) (`apps/mobile/src/logic/minigame-config.ts`), and Trace Word in Stage 7.

## 2. User story

> As a learner, the app never tells me to change a stroke order that my teacher or parent taught me correctly.
>
> As a parent who learned Hangul in Korea, the app never contradicts how I teach my child to write.
>
> As a teacher showing a letter to my class, the screen never numbers strokes in an order nobody has checked.

## 3. Acceptance criteria

### 3.1 One gate

- `logic/stroke-order-taught.ts`: `strokeOrderTaught(jamoId: string, reviewed: readonly string[] = reviewedStrokeIds): boolean` = `reviewed.includes(jamoId)`. Every surface below asks it; SO-3 turns order teaching back on letter by letter by adding an id.
- For a Trace Word unit or a composite letter (ㅘ = ㅗ + ㅏ, ㄲ, ㄺ …), order is taught only when **every** jamo id of every letter in the unit is taught. `UnitLetter` (`trace-word/evaluate.ts:24`) gains `jamoIds` from `PlacedLetter.jamoIds` (`block-strokes.ts:31-32`).

### 3.2 Row SO-1 (now): unreviewed letters get no order or direction teaching

For a jamo (or unit) that is **not** taught:

- **Scoring of pass or miss is unchanged** (coverage). In strict mode, an untaught letter passes on coverage alone (`wouldPass(result, strictMode && taught)`, the helper of `AMENDMENTS-TRACE-IDLE.md` §3.1), so an order nobody checked can never fail a round.
- **No order coaching**: `passMessage` and `failMessage` get `orderCorrect = null`.
- **No direction coaching**, except a loop nudge computed over the circles only. For an untaught letter or unit the nudge is `loopNudgeFor(result)`, never `directionNudgeFor(result)`:
  - `loopNudgeFor` (new, `logic/trace-copy.ts`, next to `directionNudgeFor` `:23-36`): `'loop'` when some target with `closedPerTarget[i]` true has `directionsPerTarget[i]` false; otherwise `'none'`. Open targets (bars, ticks) are ignored, matched or not, so it **never returns `'open'`**; an untaught letter never gets the "left-to-right" line.
  - Why not keep `directionNudgeFor` for the circle letters: it returns `'open'` as soon as any open target is unmatched (`:31-33`; an unmatched target counts as direction `false`, `stroke-scoring.ts:212-219`). Probed on `5e84e0d85` with the real `scoreTrace` and `directionNudgeFor`: ㅎ (`jamo:hieut`, `jamo-strokes.ts:178-185`) drawn with a short horizontal top stroke, the bar and a counter-clockwise ring, full coverage → directions `[false, true, true]`, closed `[false, false, true]` → `'open'` → `pass.open`, though the ring was right.
  - In the data only `jamo:ieung`, `jamo:ieung-batchim` and `jamo:hieut`'s ring have a closed target (counter-clockwise from the top, the way ㅇ is written; the loop check scores winding only, not the start point; since AU-14 ㅁ has no closed stroke, `jamo-loops.test.ts`). So in effect only those three can get a nudge, and only `pass.loop`; every other untaught letter gets `'none'`. The same ㅎ probe with `loopNudgeFor`: counter-clockwise ring → `'none'` (`pass.clean`); clockwise ring → `'loop'` (`pass.loop`).
  - Trace Word, for a unit that is not taught: `directionNudge` is `loopNudgeFor` over the same adjusted result `evaluate.ts:92-95` builds today (short strokes forgiven), instead of `directionNudgeFor`.
  - (WO-03 SO-1: "순서·방향을 채점하지 않고".)
- **Show me** draws the letter as a **shape reveal**: all strokes fade in together over the same duration, with no per-stroke sequence and no moving dot. A caption **Shape guide** shows under the animation (placement per the SO-0c mock).
  - *SO-0c design (2026-11-22, `design/wireframes/minigame/trace-stroke-shape-guide.md`):* the caption is a line of the game's Hoya strip, drawn by the game screen (not by `StrokeHint`), and replaces the **idle** line only (a miss or pass line always wins, `AMENDMENTS-TRACE-IDLE.md` §3.3); the ghost steps aside while the hint is up; the strokes are opaque in one group at opacity 0.6; the shape is held at least 1000 ms; the presenter panel hides its own letter while revealing.
- **Reduced motion** (and the fallback when the reduced-motion query fails): the still diagram shows the letter with **no numbered badges and no arrows**.
- **Screen readers**: the hint's label is `a11y.minigame.strokeOrder.shape(romanization)` (romanization through `a11yRomanization`), not `describeStrokeOrder`; the still reads `strokeOrder.close(shape(romanization))`. (SO-0c: one label, so "shape guide" is not read twice; the separate `shapeGuide` a11y key is dropped.) Trace Word's `orderLabel` (`TraceWordGame.tsx:340-342`) uses the shape label for a unit that is not taught.
- **The presenter** `StrokePanel` (`LetterSlide.tsx:162-204`) follows the same rule: shape reveal, unnumbered still, its own caption "Simplified stroke guide" unchanged. (OD-SO2.)
- `StrokeHint` gains props `orderTaught: boolean` and `romanization: string`; every caller passes them.
- **Learners already taught the data's order**: order never decided a pass and `orderCorrect` is not stored, so no star, card, meter or record changes. No migration and no "we changed something" note.

### 3.3 Row SO-2 (after table rows are approved): check the AU-14 data against the table

AU-14 already rewrote the data and pinned it (§1). SO-2 no longer writes the data from scratch; it builds on AU-14:

- For each approved row (24 jamo and 6 finals), compare `jamo-strokes.ts` with the approved table (§3.4). Change only the letters that disagree, keeping the 200 × 200 viewBox, `p(x, y)`, the shared consonant/final constants (`GIYEOK` … `IEUNG`, `copy`) and the `loop` helper for circles (never hand-placed corner points: NB-3 in the file header).
- Where the table accepts more than one order (OD-SO4), add the variants as `altStrokes` and make `orderCorrect` (and the direction check) true when the drawing matches any listed order. Expected first: ㅈ (2 or 3 strokes), ㅊ and ㅎ (the top-stroke form), ㅁ.
- `jamo-stroke-order.test.ts` stays the one pin: its `STANDARD` table (`:50-84`) gets a source column check, i.e. a test that each `STANDARD` entry equals the approved row of `stroke-order-table.md` (parsed), so the data, the test and the table cannot drift. No second count/direction table is written.
- SO-2 **does not** touch `reviewedStrokeIds` (§3.5).
- Knock-on checks, only for letters SO-2 changes: coverage tolerance (`logic/__tests__/stroke-scoring.test.ts`); `logic/__tests__/trace-copy.test.ts` (AU-14 already moved ㅁ from the loops to the open strokes, `:54-87`); Trace Word's ㅁ-against-ㅇ hull check (`trace-word/evaluate.ts:142, 174`, `LOOP_LETTERS`); `jamo-loops.test.ts`; `content-integrity.test.ts:113`; e2e `trace-round-loop.spec.ts` and `trace-word-round-loop.spec.ts`; direction tests (F-006); `describeStrokeOrder`; the presenter `LetterSlide`; visual-regression snapshots (F-VR-001); `AMENDMENTS-TRACE-IDLE.md` §6 test 5 (no prefix is "finished"; it holds on the AU-14 data, checked 2026-11-21).
- Dropped from revision 2 (done by AU-14): the `pass.order` copy change, the ㅂ shape fix, the ㅜ/ㅠ comments, ㅁ's loop special case (ㅁ is no longer closed).

### 3.4 The stroke table (row SO-0b)

`docs/specs/assets/stroke-order-table.md`, one row per jamo (24 + 6 finals): jamo, number of strokes, each stroke as start → end in words ("top-left to bottom-left"), the source, and the review record (§3.5). A note states the composition rule for letters built from two jamo (ㅘ, ㄲ, ㄺ: the first jamo's strokes, then the second's) and that double consonants and compound vowels are not separate entries; any future entry starts untaught.

Sources, in this order (OD-SO3):

1. The current Korean elementary first-grade 국어 textbook (국정, 2022 개정 교육과정 국어 1-1) or its 교사용 지도서 — the order Korean children are taught. The row author records edition and page.
2. National Institute of Korean Language (국립국어원) materials, where they show stroke order. (A search on 2026-11-21 found its spelling rules on jamo **count, order and names** — 한글 맞춤법 제2장 제4항 — but no stroke-order page; the row author searches again and records what they find.)
3. King Sejong Institute (세종학당) beginner textbooks.

Rules:

- Every row names its source (title, page or URL, date seen). A row with no source is not filled in. The model does not fill a row from memory.
- Where sources differ (expected for ㅈ, ㅊ, ㅎ), the table lists each order with its source, and **the owner decides** (even when another person reviews). By default every order with a credible source is accepted: `jamo-strokes.ts` gains an optional `altStrokes` per jamo, and `orderCorrect` is true when the drawing matches any listed order; the owner may narrow it (OD-SO4). Heritage learners (P4) are often taught at home by older conventions.
- The ㅊ/ㅎ top-stroke form (the data uses a vertical tick, `:145`, `:181`), ㅈ's stroke count (the data, since AU-14, uses 2) and ㅇ's start point are listed as rows of their own. AU-14's choices are not a source; they are the starting point the table checks.

### 3.5 Who marks a letter taught (row SO-3, a person)

- Only a person adds an id to `reviewedStrokeIds`: the owner, or a person who teaches Hangul handwriting, after checking the table row **and** the letter's Show me animation on a device running the SO-2 build.
- The review record in the table row: reviewer name or initials, role (teacher / owner), sources checked, what was seen (table row, Show me on device, build), date, PR link. The commit that adds the id carries a `Reviewed-by:` trailer.
- A unit test fails if any id in `reviewedStrokeIds` has no filled review record in `stroke-order-table.md`.
- `.github/CODEOWNERS` gains `apps/mobile/src/content/jamo-strokes.ts` and `docs/specs/assets/stroke-order-table.md` for the owner.

### 3.6 Strings

`packages/i18n/src/messages/{en,es,ko}/`. Spanish and Korean are **shipped** locales (`packages/i18n/src/locales.ts:31-35`), so every new or changed key carries reviewed es and ko values (R8 draft, F-I18N-001 §3.10 review, ledger re-signed) in the same PR.

| Key | English | Row |
|---|---|---|
| `learner.minigame.trace.shapeGuide` | Shape guide | SO-1 |
| `a11y.minigame.strokeOrder.shape` (`a11y.ts`) | `(romanization: string) => \`${romanization}, shape guide.\`` — the romanized letter name, never a Hangul glyph (`a11y.ts:100`); ends with a full stop because `close` appends " Tap to close." | SO-1 |

## 4. Out of scope

- Turning strict mode on.
- New trace rounds for more letters (WO-14).
- Changing F-006's rule that an unmatched target counts as a wrong direction (it no longer reaches untaught letters: `loopNudgeFor` looks at closed targets only; for taught letters it stays, since their data matches the taught stroke count).

## 5. UI sketch

Row SO-0c: a design pass adding `design/wireframes/minigame/trace-stroke-shape-guide.md` and a mock in `design/screens/minigame-writing/`: caption placement in tokens, the shape reveal, the unnumbered still, and the presenter panel; approved by multi-agent review (CLAUDE.md §5).

## 6. Tests

SO-1:

1. `strokeOrderTaught('jamo:o')` false with the default list; true with `['jamo:o']` passed as `reviewed`.
2. Trace Stroke, ㅗ drawn bar-first (against the AU-14 data), full coverage → pass, line `pass.clean` (not `pass.order`).
3. Same with `reviewed = ['jamo:o']` → `pass.order` (today's behaviour returns when taught).
4. ㅌ drawn in 4 strokes (the pre-AU-14 form) → `pass.clean`; ㅈ drawn in 3 strokes → `pass.clean`; ㅊ with a horizontal top stroke → `pass.clean`; ㅎ with a horizontal top stroke and a counter-clockwise ring → `pass.clean` (`loopNudgeFor` ignores the unmatched tick); ㅎ with a horizontal top stroke and a clockwise ring → `pass.loop`, never `pass.open` (each is `pass.order` or `pass.open` today, §1). Unit tests for `loopNudgeFor` itself: an unmatched or wrong-way open target alone → `'none'`; a wrong-way closed target → `'loop'`; no `directionsPerTarget` → `'none'`.
5. ㅁ drawn as one loop → `pass.clean` (no open-stroke nudge) while untaught; ㅇ drawn clockwise → `pass.loop` (loop nudge kept); final ㅇ the same.
6. Strict mode on, ㅗ bar-first, full coverage → pass.
7. Trace Word: 호 with ㅗ bar-first → the letter and block lines are not `pass.order`; a unit with one untaught jamo gets the shape label.
8. StrokeHint, untaught: no per-stroke sequence in the animation (all strokes read one shared value); reduced-motion still has no numerals or arrows; accessibility label is `shape(romanization)`; StrokeHint renders no caption. Trace Stroke and Trace Word screens, untaught: the strip shows `trace.shapeGuide` while the hint is up and the strip is on its idle line, and keeps a miss or pass line (SO-0c).
9. LetterSlide's StrokePanel, untaught: no numerals, shape reveal.

SO-3 guard: 10. every id in `reviewedStrokeIds` has a filled review record (table parsed in the test).

SO-2: `jamo-stroke-order.test.ts`'s `STANDARD` equals the approved table (parsed), and `altStrokes` match their rows; the knock-on suites of §3.3 pass for the changed letters; snapshots updated in the same PR.

## 7. Rollout

SO-1 next release (it only removes coaching and the visible order). SO-2 per approved row (a no-op for a letter whose AU-14 data the table confirms); SO-3 per letter after SO-2's build is on a device; each taught letter gets its order coaching, numbered diagram and sequenced animation back.

## 8. Dependencies

- `AMENDMENTS-TRACE-IDLE.md` (WO-02) changes the same screen and adds `wouldPass`; merge TRACE-IDLE's TI-1 and TI-2 first, then SO-1.
- F-TCH-004 §3.6: when SO-3 adds ids, the presenter's "Simplified stroke guide" caption goes away for those letters, which is intended.

## 9. Rows

| Row | Model | Work | Tests | Depends on |
|---|---|---|---|---|
| SO-0c | Opus 5.5 | §5 wireframe and mock; multi-agent review — **done 2026-11-22** (`design/wireframes/minigame/trace-stroke-shape-guide.md`, `design/screens/minigame-writing/trace-stroke-shape-guide.md`) | — | this spec reviewed |
| SO-1 | Sonnet 5.5 | §3.1 gate, §3.2 all surfaces, SO-1 strings en + es + ko | 1–9 | SO-0c, TRACE-IDLE TI-2 merged |
| SO-1d | Sonnet 5.5 | "Amended 2026-11-xx by AMENDMENTS-STROKE-ORDER-STANDARD" lines in F-004, F-005, F-006, F-007, F-008, F-TCH-004, F-CURR-001; `docs/specs/README.md` index line; CODEOWNERS lines | — | SO-1 |
| SO-0b | Opus 5.5 (research) | §3.4 table with sources; no row filled without a source | — | — |
| SO-2 | Opus 5.5 | §3.3 check of the AU-14 data against approved rows, changes and `altStrokes` where they disagree, `STANDARD` tied to the table, knock-on tests and snapshots; never touches `reviewedStrokeIds` | SO-2 tests, 10 | SO-0b rows approved by the owner |
| SO-3 | Korean teacher of WO-27 (person; OD-SO5 2026-11-22) | §3.5 check each SO-2 letter on a device; add its id with the review record | 10 | SO-2 merged |

Branches: `fix/stroke-order-interim` (SO-1, SO-1d), `design/stroke-shape-guide` (SO-0c), `content/stroke-order-table` (SO-0b), `content/stroke-order-standard` (SO-2), `content/stroke-order-reviewed-<letters>` (SO-3).

## 10. Owner decisions and departures from WO-03 (decided 2026-11-22)

- **OD-SO1 — direction coaching.** This revision follows WO-03 (no order **or** direction teaching for untaught letters, §3.2), with one exception: the loop nudge stays for ㅇ, final ㅇ and ㅎ, whose data matches how circles are written. Mechanism (revision 3a): the nudge is computed over the closed (circle) targets only (`loopNudgeFor`), so an untaught letter never gets the open-stroke line, including ㅎ drawn with another top-stroke form. Recommended: accept.
- **OD-SO2 — the presenter.** F-TCH-004 left the presenter's stroke guide default to the owner (`:516`). This spec gates it like the learner screens (shape reveal, no numerals) instead of only captioning it, because a class copies what the board numbers. Recommended: accept.
- **OD-SO3 — source order.** WO-03 lists 국립국어원 first and the textbook second. This spec puts the 국정 first-grade 국어 textbook first: 국립국어원 has no stroke-order page (searched 2026-11-21), and the textbook is what Korean children are taught. Recommended: accept.
- **OD-SO4 — variants.** By default every sourced order is accepted (`altStrokes`); the owner may narrow a letter to one order. Recommended: accept (fair to heritage learners taught older conventions). Since AU-14 picked one form each for ㅈ, ㅊ and ㅎ, this decision now decides whether learners taught the other form keep getting `pass.open`.
- **OD-SO5 — who reviews.** The owner with the textbook in hand, or a Korean teacher (WO-27's reviewer could do it in the same pass). The owner says which. **Decided 2026-11-22: the Korean teacher of WO-27 (row HR-3s), in the same pass.**

## 11. Review log

- 2026-11-21, multi-agent review (two lenses: code truth with scoring probes; charter, pedagogy and process). Adjudicated in revision 2:
  - Fixed, blockers: the SO-2 row (a model) wrote `reviewedStrokeIds` → a person-only SO-3 row, a test that every id has a review record, CODEOWNERS (§3.5); the open-stroke direction nudge misfires on a correctly written ㅌ (and 2-stroke ㅈ, 3-stroke ㅊ) because an unmatched target counts as a wrong direction → no direction coaching for untaught letters except circles (§3.2, OD-SO1).
  - Fixed, majors: Show me, the reduced-motion numbered still and the presenter still taught the unchecked order → shape reveal, unnumbered still, presenter gated (§3.2, OD-SO2); `StrokeHint` needs props (`orderTaught`, `romanization`); Trace Word moved from "Out of scope" into §3.1–3.2 with jamo ids threaded into `UnitLetter`; es and ko are shipped, so strings carry all three locales; a11y keys moved to `a11y.ts` as a function of the romanization; `pass.order` reworded for SO-2; design row SO-0c; source order and conflict owner recorded as decisions (OD-SO3); SO-2's knock-on tests listed.
  - Fixed, minors: the §1 table marks "commonly taught" as a hypothesis and corrects ㅁ (clean praise today; the harm is the animation); test 4 replaced (ㅁ in 3 strokes already passed clean); strict mode passes untaught letters on coverage; `strokeOrderTaught` takes the list as a parameter; F-006, F-007, F-008, F-CURR-001 added to Amends; P4 parent and teacher stories; no-migration statement; review record fields and `Reviewed-by:` trailer; variants default to accepting all sourced orders (OD-SO4); ㅂ shape and ㅜ/ㅠ comment notes; composite-letter rule; q12's config id named.
  - Not taken: the claim that `MinigameScreen.tsx:212` should be `:211` (line 212 is the `<TraceStrokeGame …>` render; re-read).
  - Cross-spec: half-drawn letters reaching the pass mark during a pause (ㅗ tick alone 0.67) is fixed in `AMENDMENTS-TRACE-IDLE.md` §3.1 (per-stroke floor 0.8 and the prefix test).
- 2026-11-21, revision 3: re-based on `d5ba0217c` (main tip; 12 commits after `5573e1072`). AU-14 (`AMENDMENTS-AUDIT-2026-11.md`, #1035) rewrote `jamo-strokes.ts` to the audit's standard-order table and added `content/__tests__/jamo-stroke-order.test.ts`; QS-3 and FU-3 changed only the sound code of `TraceStrokeGame.tsx`. Verdicts: unreviewed hand-authored data **partly fixed** (order and counts changed to revision 2's hypothesis and the disclaimer removed, but still unsourced and unreviewed); `reviewedStrokeIds` empty **still open** (`:283`, deliberately left empty by AU-14); order/direction coaching lines **partly fixed** (`pass.order` no longer says "top line first"; the order and direction checks still run on unreviewed data, and the misfires moved to the other forms: 3-stroke ㅈ, horizontal-top ㅊ/ㅎ, ㅁ in fewer strokes get `pass.open`, 4-stroke ㅌ and bar-first ㅗ get `pass.order`, re-probed); StrokeHint, Trace Word coaching and labels, presenter **still open** (files unchanged). Changes: §1 rewritten on the new data with new probes and line numbers; §3.3 SO-2 rescoped to checking the AU-14 data against the sourced table, building on `jamo-stroke-order.test.ts` instead of a second table; the `pass.order` string row, the ㅂ / ㅜ / ㅠ notes and ㅁ's loop knock-on dropped; tests 2, 4–7 re-pointed at forms that misfire today; OD-SO4 note. OD-SO1 to OD-SO5 stand; none is moot. WO-03 is not solved upstream: no letter has a sourced, person-checked order, and every surface still teaches the data's order.
- Revision 3 review (2026-11-22), adjudicated as revision 3a (re-checked on `5e84e0d85`). Fixed, major: §3.2 kept direction coaching for `jamo:hieut`, but `directionNudgeFor` returns `'open'` whenever an open target is unmatched (`logic/trace-copy.ts:31-33`), so ㅎ with a horizontal top stroke and a correct ring got `pass.open`, contradicting test 4's `pass.clean` (re-probed with the real `scoreTrace`: directions `[false, true, true]`, closed `[false, false, true]` → `'open'`) → untaught letters and units use a new `loopNudgeFor`, computed over the closed targets only, which never returns `'open'` (§3.2, Trace Word included); test 4 now pins ㅎ with a counter-clockwise ring → `pass.clean` and a clockwise ring → `pass.loop`, plus `loopNudgeFor` unit cases; test 5 adds final ㅇ; OD-SO1 describes the mechanism (the decision itself is unchanged); §4's F-006 note says why the rule no longer reaches untaught letters.
- 2026-11-22, SO-0c design pass and its multi-agent review (`design/screens/minigame-writing/trace-stroke-shape-guide.md`, Review log). Spec changes it needs, made here: §3.2 caption placement and look note; §3.2 screen-reader line (one label, `a11yRomanization`); §3.6 `shape` ends with a full stop and the `shapeGuide` a11y key is dropped; §6 test 8 checks the caption at screen level (StrokeHint renders none) and keeps miss and pass lines. Open questions for the owner are in the wireframe §11 (Show me over the ghost; ㅇ arrow; the presenter caption wording; reveal contrast on the retry canvas).
