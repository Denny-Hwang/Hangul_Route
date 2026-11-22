# AMENDMENTS-STROKE-ORDER-STANDARD — stop teaching a stroke order nobody has checked; then fix the data

Status: draft, revision 2 (2026-11-21, written for work order WO-03 of `docs/roadmap/review-2026-11/phase-1-safety.md`, row SO-0). The multi-agent review of 2026-11-21 (§11) is adjudicated in this revision. Rows SO-1 and SO-1d become `ready` when the owner accepts §10 OD-SO1 and OD-SO2; SO-0b can start now (research only); SO-2 waits for approved table rows.

**Amends**: F-004 (Trace Stroke) · F-005 (stroke order) · F-006 (stroke direction: the nudge for unreviewed letters) · F-007 (the animated hint: shape reveal, caption) · F-008 (strict mode: unreviewed letters pass on coverage) · F-TCH-004 §3.6 (the reviewed-stroke list; the presenter's stroke panel) · F-CURR-001 §3.7 (Trace Word's coaching) · tag **[SO]**
**Scope**: `apps/mobile/src/content/jamo-strokes.ts`, `apps/mobile/src/logic/stroke-order-taught.ts` (new), `apps/mobile/src/screens/minigames/TraceStrokeGame.tsx`, `apps/mobile/src/screens/minigames/TraceWordGame.tsx`, `apps/mobile/src/logic/trace-word/evaluate.ts`, `apps/mobile/src/components/StrokeHint.tsx`, `apps/mobile/src/screens/presenter/slides/LetterSlide.tsx`, `apps/mobile/src/logic/trace-copy.ts`, `packages/i18n` (en, es, ko), `docs/specs/assets/stroke-order-table.md` (new), `.github/CODEOWNERS` (two lines)
**Owner**: solo dev; the stroke table needs a person who teaches Hangul handwriting (§3.4)
**Rollout**: SO-1 next release; SO-2 letter by letter as table rows are approved

---

## 1. Context

Re-read on `5573e1072`:

- The stroke data says of itself: "Hand-authored for pedagogical clarity — not perfectly anatomical Hangul stroke order. Refinement deferred to F-005 (stroke order)." (`apps/mobile/src/content/jamo-strokes.ts:14-15`). F-005 shipped (PR #26) without that refinement.
- `reviewedStrokeIds` is empty (`:298`). Its comment: "Jamo whose stroke skeleton a native speaker has reviewed (F-TCH-004 §3.6). Empty until a native-reviewed content PR adds ids". Only the presenter reads it (`logic/lecture/content.ts:78`), to caption its panel "Simplified stroke guide" (`packages/i18n/src/messages/en/learner.ts:2476`).
- Where the data's order reaches learners:
  - **Trace Stroke** scores with `checkOrder: true, checkDirection: true` (`screens/minigames/TraceStrokeGame.tsx:207-208`). Order does not decide a pass (strict mode is never on: `MinigameScreen.tsx:212`), but it picks the coaching line: after a pass with `orderCorrect === false` the learner reads **You got it! Next time, try drawing the top line first.** (`logic/trace-copy.ts:41`, `learner.ts:835`).
  - **Direction** also misfires: a target stroke with no matched drawn stroke counts as direction `false` (`logic/stroke-scoring.ts:211-217`, by design in F-006 `:35`), so a learner who writes a letter in fewer strokes than the data gets **Nice! Try drawing left-to-right next time.** (`learner.ts:836`).
  - **Show me** (`components/StrokeHint.tsx`) animates the data's order; under reduced motion its still diagram shows **numbered start badges and direction arrows**; its screen-reader label reads the order aloud (`describeStrokeOrder`, `:155`). `StrokeHint` takes only `target` (`:30-51`).
  - **Trace Word** (Stage 7: 호야, 학교, 토끼, 소, 곰, 돼지 — `content/__tests__/trace-word-strokes.test.ts:13-16`) coaches order and direction over the whole unit (`logic/trace-word/evaluate.ts:77-96`; "Order and direction coach, never fail", `TraceWordGame.tsx:112`) and builds an `orderLabel` from `describeStrokeOrder` (`:329-331`).
  - **The presenter** (`screens/presenter/slides/LetterSlide.tsx:155-201`) shows the numbered still diagram and the animation to a whole class.
- Probes with the real `scoreTrace` and `directionNudgeFor` (review, §11), full coverage each:

| Jamo | Data | Commonly taught (**hypothesis — to be sourced in SO-0b**) | What a learner who writes it the taught way sees today |
|---|---|---|---|
| ㅗ `jamo:o` (`:218-223`) | long horizontal, then short vertical | short vertical, then horizontal | `pass.order` ("top line first") |
| ㅛ `jamo:yo` (`:226-232`) | horizontal, then two short verticals | two short verticals, then horizontal | `pass.order` |
| ㅌ `jamo:tieut` (`:151-158`) | 4 strokes, separate upper-left vertical | 3: top bar; middle bar; ㄴ-shape | `pass.open` (unmatched target) |
| ㅁ `jamo:mieum` (`:92-96`), final (`:269`) | one closed stroke | 3: left vertical; top-and-right; bottom | clean praise (one target stroke: order is always true) — the **animation** still teaches one loop |
| ㅈ, ㅊ, ㅎ | 3, 4, 3 strokes | sources differ (2 or 3 for ㅈ; top-stroke form for ㅊ/ㅎ) | 2-stroke ㅈ and 3-stroke ㅊ get `pass.open` |

The data's order matches the commonly taught order for ㄱ ㄴ ㄷ ㄹ ㅂ ㅅ ㅇ ㅋ ㅍ ㅏ ㅑ ㅓ ㅕ ㅜ ㅠ ㅡ ㅣ and the finals ㄱ ㄴ ㄹ ㅂ ㅇ — still a hypothesis until sourced. Shape notes for the table: ㅂ's right vertical starts lower than its left (`:101-102`, batchim `:275-276`); the ㅜ/ㅠ comments say "upward tick" but the data runs top to bottom.

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
- **No direction coaching**, except the loop nudge for the circles: `nudge = 'none'`, unless the id is `jamo:ieung`, `jamo:ieung-batchim` or `jamo:hieut` (counter-clockwise from the top in the data, the way ㅇ is written; the loop check scores winding only, not the start point). (WO-03 SO-1: "순서·방향을 채점하지 않고".)
- **Show me** draws the letter as a **shape reveal**: all strokes fade in together over the same duration, with no per-stroke sequence and no moving dot. A caption **Shape guide** shows under the animation (placement per the SO-0c mock).
- **Reduced motion** (and the fallback when the reduced-motion query fails): the still diagram shows the letter with **no numbered badges and no arrows**.
- **Screen readers**: the hint's region label is the shape label (`a11y.minigame.strokeOrder.shapeGuide`), and its description is `a11y.minigame.strokeOrder.shape(romanization)`, not `describeStrokeOrder`. Trace Word's `orderLabel` (`TraceWordGame.tsx:329-331`) uses the shape label for a unit that is not taught.
- **The presenter** `StrokePanel` (`LetterSlide.tsx:155-201`) follows the same rule: shape reveal, unnumbered still, its own caption "Simplified stroke guide" unchanged. (OD-SO2.)
- `StrokeHint` gains props `orderTaught: boolean` and `romanization: string`; every caller passes them.
- **Learners already taught the data's order**: order never decided a pass and `orderCorrect` is not stored, so no star, card, meter or record changes. No migration and no "we changed something" note.

### 3.3 Row SO-2 (after table rows are approved): correct the data

- `jamo-strokes.ts` is changed to the approved table (§3.4) for each approved row (24 jamo and 6 finals), keeping the 200 × 200 viewBox, `p(x, y)`, and the `loop` helper for circles (never hand-placed corner points: NB-3 in the file header). The ㅂ shape and the ㅜ/ㅠ comments are corrected with them.
- SO-2 **does not** touch `reviewedStrokeIds` (§3.5).
- `pass.order` changes to **You got it! Next time, try the order in Show me.**: the current line ("the top line first") is wrong for every letter whose first stroke is not a top line (ㅓ ㅕ ㄴ ㅅ ㅁ …), and it starts showing again as letters are approved. `retry.order` already points to Show me.
- Knock-on checks in the same PR: coverage tolerance on the changed letters (`logic/__tests__/stroke-scoring.test.ts`); ㅁ's loop special case (`stroke-scoring.ts:72-81`, `MIN_WINDING_AREA_RATIO`) and `logic/__tests__/trace-copy.test.ts:44-66` (ㅁ among the "closed loops"); Trace Word's ㅁ-against-ㅇ hull check (`trace-word/evaluate.ts:173-177`, `LOOP_LETTERS`); `jamo-loops.test.ts`; `content-integrity.test.ts:113`; e2e `trace-round-loop.spec.ts` and `trace-word-round-loop.spec.ts`; direction tests (F-006); `describeStrokeOrder`; the presenter `LetterSlide`; visual-regression snapshots (F-VR-001); `AMENDMENTS-TRACE-IDLE.md` §6 test 5 (no prefix is "finished").

### 3.4 The stroke table (row SO-0b)

`docs/specs/assets/stroke-order-table.md`, one row per jamo (24 + 6 finals): jamo, number of strokes, each stroke as start → end in words ("top-left to bottom-left"), the source, and the review record (§3.5). A note states the composition rule for letters built from two jamo (ㅘ, ㄲ, ㄺ: the first jamo's strokes, then the second's) and that double consonants and compound vowels are not separate entries; any future entry starts untaught.

Sources, in this order (OD-SO3):

1. The current Korean elementary first-grade 국어 textbook (국정, 2022 개정 교육과정 국어 1-1) or its 교사용 지도서 — the order Korean children are taught. The row author records edition and page.
2. National Institute of Korean Language (국립국어원) materials, where they show stroke order. (A search on 2026-11-21 found its spelling rules on jamo **count, order and names** — 한글 맞춤법 제2장 제4항 — but no stroke-order page; the row author searches again and records what they find.)
3. King Sejong Institute (세종학당) beginner textbooks.

Rules:

- Every row names its source (title, page or URL, date seen). A row with no source is not filled in. The model does not fill a row from memory.
- Where sources differ (expected for ㅈ, ㅊ, ㅎ), the table lists each order with its source, and **the owner decides** (even when another person reviews). By default every order with a credible source is accepted: `jamo-strokes.ts` gains an optional `altStrokes` per jamo, and `orderCorrect` is true when the drawing matches any listed order; the owner may narrow it (OD-SO4). Heritage learners (P4) are often taught at home by older conventions.
- The ㅊ/ㅎ top-stroke form (the data uses a vertical tick, `:135`, `:173`) and ㅇ's start point are listed as rows of their own.

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
| `a11y.minigame.strokeOrder.shapeGuide` (`a11y.ts`) | Shape guide | SO-1 |
| `a11y.minigame.strokeOrder.shape` (`a11y.ts`) | `(romanization: string) => \`${romanization}, shape guide\`` — the romanized letter name, never a Hangul glyph (`a11y.ts:100`) | SO-1 |
| `learner.minigame.trace.pass.order` (changed) | You got it! Next time, try the order in Show me. | SO-2 |

## 4. Out of scope

- Turning strict mode on.
- New trace rounds for more letters (WO-14).
- Changing F-006's rule that an unmatched target counts as a wrong direction (it no longer reaches untaught letters; for taught letters it stays, since their data matches the taught stroke count).

## 5. UI sketch

Row SO-0c: a design pass adding `design/wireframes/minigame/trace-stroke-shape-guide.md` and a mock in `design/screens/minigame-writing/`: caption placement in tokens, the shape reveal, the unnumbered still, and the presenter panel; approved by multi-agent review (CLAUDE.md §5).

## 6. Tests

SO-1:

1. `strokeOrderTaught('jamo:o')` false with the default list; true with `['jamo:o']` passed as `reviewed`.
2. Trace Stroke, ㅗ drawn vertical-first, full coverage → pass, line `pass.clean` (not `pass.order`).
3. Same with `reviewed = ['jamo:o']` → `pass.order` (today's behaviour returns when taught).
4. ㅌ drawn ㅡ, ㅡ, ㄴ → `pass.clean`; ㅈ drawn in 2 strokes → `pass.clean`.
5. ㅁ drawn as one reversed loop → no loop nudge while untaught; ㅇ drawn clockwise → loop nudge kept.
6. Strict mode on, ㅗ vertical-first, full coverage → pass.
7. Trace Word: 호 with ㅗ vertical-first → the letter and block lines are not `pass.order`; a unit with one untaught jamo gets the shape label.
8. StrokeHint, untaught: caption rendered; no per-stroke sequence in the animation (all strokes share one timing); reduced-motion still has no numerals or arrows; accessibility label is the shape label.
9. LetterSlide's StrokePanel, untaught: no numerals, shape reveal.

SO-3 guard: 10. every id in `reviewedStrokeIds` has a filled review record (table parsed in the test).

SO-2: stroke counts per jamo match the approved table (table-driven); the knock-on suites of §3.3 pass with the new skeletons; snapshots updated in the same PR.

## 7. Rollout

SO-1 next release (it only removes coaching and the visible order). SO-2 per approved row; SO-3 per letter after SO-2's build is on a device; each taught letter gets its order coaching, numbered diagram and sequenced animation back.

## 8. Dependencies

- `AMENDMENTS-TRACE-IDLE.md` (WO-02) changes the same screen and adds `wouldPass`; merge TRACE-IDLE's TI-1 and TI-2 first, then SO-1.
- F-TCH-004 §3.6: when SO-3 adds ids, the presenter's "Simplified stroke guide" caption goes away for those letters, which is intended.

## 9. Rows

| Row | Model | Work | Tests | Depends on |
|---|---|---|---|---|
| SO-0c | Opus 5.5 | §5 wireframe and mock; multi-agent review | — | this spec reviewed |
| SO-1 | Sonnet 5.5 | §3.1 gate, §3.2 all surfaces, SO-1 strings en + es + ko | 1–9 | SO-0c, TRACE-IDLE TI-2 merged |
| SO-1d | Sonnet 5.5 | "Amended 2026-11-xx by AMENDMENTS-STROKE-ORDER-STANDARD" lines in F-004, F-005, F-006, F-007, F-008, F-TCH-004, F-CURR-001; `docs/specs/README.md` index line; CODEOWNERS lines | — | SO-1 |
| SO-0b | Opus 5.5 (research) | §3.4 table with sources; no row filled without a source | — | — |
| SO-2 | Opus 5.5 | §3.3 data correction for approved rows, `pass.order` copy, knock-on tests and snapshots; never touches `reviewedStrokeIds` | SO-2 tests, 10 | SO-0b rows approved by the owner |
| SO-3 | Owner / teacher (person) | §3.5 check each SO-2 letter on a device; add its id with the review record | 10 | SO-2 merged |

Branches: `fix/stroke-order-interim` (SO-1, SO-1d), `design/stroke-shape-guide` (SO-0c), `content/stroke-order-table` (SO-0b), `content/stroke-order-standard` (SO-2), `content/stroke-order-reviewed-<letters>` (SO-3).

## 10. Owner decisions and departures from WO-03

- **OD-SO1 — direction coaching.** This revision follows WO-03 (no order **or** direction teaching for untaught letters, §3.2), with one exception: the loop nudge stays for ㅇ, final ㅇ and ㅎ, whose data matches how circles are written. Recommended: accept.
- **OD-SO2 — the presenter.** F-TCH-004 left the presenter's stroke guide default to the owner (`:516`). This spec gates it like the learner screens (shape reveal, no numerals) instead of only captioning it, because a class copies what the board numbers. Recommended: accept.
- **OD-SO3 — source order.** WO-03 lists 국립국어원 first and the textbook second. This spec puts the 국정 first-grade 국어 textbook first: 국립국어원 has no stroke-order page (searched 2026-11-21), and the textbook is what Korean children are taught. Recommended: accept.
- **OD-SO4 — variants.** By default every sourced order is accepted (`altStrokes`); the owner may narrow a letter to one order. Recommended: accept (fair to heritage learners taught older conventions).
- **OD-SO5 — who reviews.** The owner with the textbook in hand, or a Korean teacher (WO-27's reviewer could do it in the same pass). The owner says which.

## 11. Review log

- 2026-11-21, multi-agent review (two lenses: code truth with scoring probes; charter, pedagogy and process). Adjudicated in revision 2:
  - Fixed, blockers: the SO-2 row (a model) wrote `reviewedStrokeIds` → a person-only SO-3 row, a test that every id has a review record, CODEOWNERS (§3.5); the open-stroke direction nudge misfires on a correctly written ㅌ (and 2-stroke ㅈ, 3-stroke ㅊ) because an unmatched target counts as a wrong direction → no direction coaching for untaught letters except circles (§3.2, OD-SO1).
  - Fixed, majors: Show me, the reduced-motion numbered still and the presenter still taught the unchecked order → shape reveal, unnumbered still, presenter gated (§3.2, OD-SO2); `StrokeHint` needs props (`orderTaught`, `romanization`); Trace Word moved from "Out of scope" into §3.1–3.2 with jamo ids threaded into `UnitLetter`; es and ko are shipped, so strings carry all three locales; a11y keys moved to `a11y.ts` as a function of the romanization; `pass.order` reworded for SO-2; design row SO-0c; source order and conflict owner recorded as decisions (OD-SO3); SO-2's knock-on tests listed.
  - Fixed, minors: the §1 table marks "commonly taught" as a hypothesis and corrects ㅁ (clean praise today; the harm is the animation); test 4 replaced (ㅁ in 3 strokes already passed clean); strict mode passes untaught letters on coverage; `strokeOrderTaught` takes the list as a parameter; F-006, F-007, F-008, F-CURR-001 added to Amends; P4 parent and teacher stories; no-migration statement; review record fields and `Reviewed-by:` trailer; variants default to accepting all sourced orders (OD-SO4); ㅂ shape and ㅜ/ㅠ comment notes; composite-letter rule; q12's config id named.
  - Not taken: the claim that `MinigameScreen.tsx:212` should be `:211` (line 212 is the `<TraceStrokeGame …>` render; re-read).
  - Cross-spec: half-drawn letters reaching the pass mark during a pause (ㅗ tick alone 0.67) is fixed in `AMENDMENTS-TRACE-IDLE.md` §3.1 (per-stroke floor 0.8 and the prefix test).
