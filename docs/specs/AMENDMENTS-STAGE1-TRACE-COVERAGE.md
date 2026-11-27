# AMENDMENTS-STAGE1-TRACE-COVERAGE — every new letter is traced once in its own quest

Status: ready (multi-agent review 2026-11-25, §11; open decisions OD-TC-1 to OD-TC-10 adopted as recommended, §10). Written for work order WO-14 of `docs/roadmap/review-2026-11/phase-2-hangul.md`, row TC-0, on main `803208a95`. The prerequisites are built: WO-02 (`AMENDMENTS-TRACE-IDLE.md`, shipped) and WO-03 through SO-2 (`AMENDMENTS-STROKE-ORDER-STANDARD.md`, SO-2 built 2026-11-23, OD-SO12 2026-11-24). WO-14 names this file (`AMENDMENTS-STAGE1-TRACE-COVERAGE.md`, apart from WO-12's `AMENDMENTS-STAGE1-CONTENT-FIXES.md`). Tag **[TC]**.

**Amends** (each gets an "Amended 2026-11-25 by AMENDMENTS-STAGE1-TRACE-COVERAGE [TC]" line in this PR):
- `F-QUEST-002-discover-check-stage1-complete.md`: §3.2 (a Discover step that teaches letters gets one **Trace the new letters** page after its letter pages), §3.6 (the step seconds of quests 1–10; quest 8's theme page keeps 추석 only; two re-estimates), §5 (two content tests). Its tables are edited in row TC-2.
- `AMENDMENTS-STROKE-ORDER-STANDARD.md`: §3.1 "every surface below asks it" gains one surface (the trace page's Show me), and §4's "New trace rounds for more letters (WO-14)" points here.
- `design/wireframes/quest/discover.md` (section "[TC] Trace the new letters"; its open question "See how it is drawn" is answered).

**Not amended**: `AMENDMENTS-TRACE-IDLE.md` (the trace page reuses its "finished" rule as it is, §3.3), F-004 (Trace Stroke: the scored game and `TraceStrokeGame.tsx` are not changed), the Trace rounds of quest 2 and quest 12 (`minigame-config.ts:240-244`, `:530-534`), `reviewedStrokeIds` and the SO-3 review (§3.6).

**Scope (rows TC-1a, TC-1b)**: `apps/mobile/src/logic/stage1/discover-flow.ts`, `apps/mobile/src/logic/stage1/discover-write.ts` (new), `apps/mobile/src/screens/quest/DiscoverStep.tsx`, `apps/mobile/src/screens/quest/DiscoverTracePad.tsx` (new), `apps/mobile/src/screens/quest/QuestPlayerView.tsx` (passes `writeOnce`; the step heading on the trace page; the payload type), `apps/mobile/src/logic/quest-flow/check-launcher.ts` (`discoverCompletedPayload`), `apps/mobile/src/content/quests.ts` (quests 1–10: step seconds; quest 8: one item and one picture moved; quests 8 and 9: one estimate each), `content/i18n/{es,ko}/stage1-quests.json` (quest 8's removed item), `packages/content-schema/src/review-items/stage1-items.json` (regenerated), `content/audio/tts-manifest.json` and the generated audio map (regenerated; expected unchanged, §3.2), `packages/i18n/src/messages/{en,es,ko}/learner.ts` and `a11y.ts`, `packages/i18n/src/messages/review-ledger.json`, `apps/mobile/scripts/pwa/lesson-chunks.mjs` (the start-bundle budget, if the measurement needs it), `docs/roadmap/TELEMETRY-NAMES-2.md`, and the tests of §6.
**Owner**: solo dev
**Rollout**: next release

---

## 1. Context

### 1.1 Citations of WO-14, re-read on `803208a95`

Paths under `apps/mobile/src/` are written from `src/` below.

| # | WO-14 says | On `803208a95` | Verdict |
|---|---|---|---|
| 1 | "Of the 30 symbols only q2's ㅁ ㅇ ㅗ ㅜ and q12's finals ㅁ ㅂ ㄹ ㅇ are traced" | `logic/minigame-config.ts:240-244` (`minigame:s1-letters-q2-apply`, `trace-stroke`, ㅁ ㅇ ㅗ ㅜ, 4 rounds) and `:530-534` (`minigame:s1-nature-q3-apply`, final ㅁ ㅂ ㄹ ㅇ, 4 rounds); no other Stage 1 scope has `kind: 'trace-stroke'`. Quest 2's step is `content/quests.ts:90`, quest 12's `:501` | correct |
| 2 | q1–q10 teach the 30 symbols | `minigame-config.ts:96-116` (L1 … R3 and the batchim lists); `content/quests.ts:12`; `content/__tests__/stage1-curriculum.test.ts:211-225` pins the order (ㅏ ㅓ ㄱ ㄴ / ㅗ ㅜ ㅁ ㅇ / ㅡ ㅣ ㄷ ㄹ / ㅈ ㅊ / ㅂ ㅅ / ㅋ ㅌ / final ㄴ ㄹ / ㅑ ㅕ ㅍ final ㅇ / ㅛ ㅠ ㅎ final ㄱ / final ㅁ ㅂ) | correct |
| 3 | every one of the 30 has stroke data to trace | `content/jamo-strokes.ts:124-317`: exactly 30 entries, the 24 letters and the 6 finals (`*-batchim`, each a `copy` of its consonant, `:311-316`); `strokeFormsForJamo` `:330`. No upper-stage Discover letter (double consonants, compound vowels, other finals) has any | correct |
| 4 | F-QUEST-002's quest length: 4–5 minutes, 3–7 steps | `F-QUEST-002 … .md:172` (R4: six steps, 4–5 minutes, rounds 6 + 4 + 2) and `:200` (step seconds: intro 6–8, discover 40 s for 2 pages and 60 s for 3, practice 75–90, apply 60–75, check 35, reward 8); schema `packages/content-schema/src/schemas/quest.ts:165-166` (3–15 minutes, 3–7 steps); content-skill `.claude/skills/content-skill/SKILL.md:70-78` | correct |
| 5 | (how time is checked in code) | `stage1-curriculum.test.ts:802-806` (T10: `estimatedMinutes` = `round(sum(durationSeconds) / 60)` within 1); `:228-235`, `:328-335`, `:411-420` (each quest's minutes), `:373-389` (episode minutes: letters 15, life 12, rites 14, nature 12, crafts 16), `:391-401` (Stage 1 = 65); `:673-685` (T4: six steps, Discover ≤ 3 pages of ≤ 2 items, practice 6 and apply 4 rounds) | correct |
| 6 | design (b) belongs in Discover | the review README's conflict table lists `screens/quest/DiscoverStep.tsx` and `logic/stage1/discover-flow.ts` for "WO-14(b)" (`docs/roadmap/review-2026-11/README.md:103`) | correct |

None of these changes the plan.

### 1.2 The step seconds today

From `content/quests.ts` (intro, discover, practice, apply, check, reward; seconds):

| Quest | New symbols | Steps (s) | Sum | `estimatedMinutes` |
|---|---|---|---|---|
| 1 `stage1-letters-q1` | ㅏ ㅓ ㄱ ㄴ | 8, 40 (`:49`), 90, 75, 35, 8 | 256 | 5 |
| 2 `stage1-letters-q2` | ㅗ ㅜ ㅁ ㅇ | 6, 40 (`:87`), 90, 75 (Trace), 35, 8 | 254 | 5 |
| 3 `stage1-letters-q3` | ㅡ ㅣ ㄷ ㄹ | 8, 40 (`:125`), 90, 75, 35, 8 | 256 | 5 |
| 4 `stage1-life-q1` | ㅈ ㅊ | 8, 40 (`:164`), 75, 60, 35, 8 | 226 | 4 |
| 5 `stage1-life-q2` | ㅂ ㅅ | 6, 60 (`:210`), 75, 60 (Build a Letter, `:213`), 35, 8 | 244 | 4 |
| 6 `stage1-life-q3` | ㅋ ㅌ | 6, 40 (`:248`), 75, 60, 35, 8 | 224 | 4 |
| 7 `stage1-rites-q1` | final ㄴ, final ㄹ | 8, 40 (`:289`), 75 (Listen & Pick, `:291`), 60 (Build a Block, `:292`), 35, 8 | 226 | 4 |
| 8 `stage1-rites-q2` | ㅑ ㅕ ㅍ, final ㅇ | 8, 60 (`:334`), 90, 75 (Build a Letter, `:337`), 35, 8 | 276 | 5 |
| 9 `stage1-rites-q3` | ㅛ ㅠ ㅎ, final ㄱ | 8, 40 (`:372`), 90 (Listen & Pick, `:374`), 90 (Story Sequence, `:378`), 35, 8 | 271 | 5 |
| 10 `stage1-nature-q1` | final ㅁ, final ㅂ | 8, 60 (`:422`), 75 (Listen & Pick, `:424`), 60, 35, 8 | 246 | 4 |

Discover counts 10 s per item (40 s for 2 pages of 2 items, 60 s for 3). The four-symbol quests have 90 s of practice and 75 s of apply; the two-symbol quests 75 s and 60 s. Quest 9's Story Sequence is the one value outside F-QUEST-002's apply range; its comment gives two reasons: "Story Order (4 cards plus replay) needs it, and it keeps the spec's 5-minute value for this 2-page quest" (`quests.ts:375-377`).

### 1.3 What the review found

Today 26 of the 30 symbols are never traced in the quest that teaches them, and 22 are never traced anywhere in Stage 1 (only q2's four letters and q12's four finals have a Trace step, item 1). WO-14's reason ("근거"): writing helps tell apart look-alike letters such as ㅓ / ㅏ and ㄷ / ㄹ. A single trace over a guide is a first exposure to the shape and its strokes, not yet writing from memory; it puts the look-alikes side by side under the learner's own finger (quest 1 has ㅏ and ㅓ on one page, quest 3 ㄷ and ㄹ, `quests.ts:36-46`, `:118-121`), and the scored games and later writing build on it.

### 1.4 What this spec builds on

- **The "finished" rule** (`AMENDMENTS-TRACE-IDLE.md` §3.1, shipped): `isLetterFinishedInForms(forms, drawn, strictMode)` (`logic/trace-ready.ts:46-52`): a drawing is finished when it passes and every stroke of some accepted form is covered to `TRACE_READY_STROKE_MIN = 0.8` (`:12`); no proper prefix of any of the 30 letters is finished (TRACE-IDLE §6 test 5, extended to the other forms by SO-2). The gate `createTraceEvaluator({ idleMs, onEvaluate, ready })` (`logic/trace-evaluator.ts:44`) evaluates only a finished drawing, `TRACE_IDLE_MS = 1500` (`:14`) after the last lift.
- **The forms** (SO-2, OD-SO12): `strokeFormsForJamo(id)` (`content/jamo-strokes.ts:330`) lists the form shown first and every accepted other form.
- **The "taught" gate** (SO-1): `strokeOrderTaught(jamoId, reviewed = reviewedStrokeIds)` (`logic/stroke-order-taught.ts:9-11`) is true only for an id a **person** has added to `reviewedStrokeIds` (`content/jamo-strokes.ts:341`, empty today) after checking the stroke table and the letter's Show me on a device (row SO-3). It describes the stroke data, not a learner. Untaught means Show me is a shape reveal with the line "Shape guide", the reduced-motion still has no numbers, and there is no order or direction coaching.
- **The canvas pieces**: `tracePanGesture` (`components/trace-pan.ts`), `pointsToPathD` / `inkPathD` (`logic/stroke-diagram.ts:40`, `:56`), `traceLayoutMode` and `traceCanvasSize` with its floor `TRACE_CANVAS_MIN = 160` (`logic/trace-layout.ts:44`, `:70`, `:21`), `TraceControls` (`screens/minigames/TraceControls.tsx`), Show me `StrokeHint` (`components/StrokeHint.tsx:124`, props `orderTaught`, `romanization`), `TRACE_KEEP_GOING_MS = 3000` (`logic/trace-ready.ts:18`), the clean pass beat of 1100 ms (`screens/minigames/TraceStrokeGame.tsx:325`), the accessible heading text `traceTargetA11yText` (`logic/korean-labels.ts:43`).
- **Discover** (`logic/stage1/discover-flow.ts`, rendered by `screens/quest/DiscoverStep.tsx`, the only renderer, from `screens/quest/QuestPlayerView.tsx`): `buildDiscover(pages, copy, a11y, locale, overlays)` (`:289-336`); the reducer `stepDiscover` (`:479`) and `pageRender` (`:604`) are pure; Continue is always enabled (`continueEnabled: true`, `:644`); the `done` effect `{ pages, heard }` (type `:405`, sent `:541`) becomes `quest.discover_completed` through `discoverCompletedPayload` (`logic/quest-flow/check-launcher.ts:52-58`; `QuestPlayerView.tsx:384-388`). The pages scroll (`DiscoverStep.tsx:294-380`) above the pinned Continue and Previous (`:381-389`). Above the step, `QuestPlayerView.tsx:408-428` draws the close header, the step dots, the step title and the step pill. Trace Stroke's screen does not scroll, because "the canvas owns vertical drags" (`TraceStrokeGame.tsx:607`).

## 2. User story

> As a learner meeting ㅏ and ㅓ for the first time, right after I hear them I trace each one once with my finger. Nothing is scored; when my letter is finished, Hoya says it looks like the letter and the next one comes up.
>
> As a parent who learned Hangul in Korea, I see my child trace every new letter in the lesson that teaches it: look, listen, trace.
>
> As a learner who cannot draw on the screen (a switch or a screen reader), I can move on from the tracing page at once, and nothing is marked against me.

## 3. Acceptance criteria

### 3.1 Design choice: (b), tracing inside Discover

WO-14 offers (a) fewer Match Sound rounds and 2–4 Trace rounds in practice, or (b) a short, unscored "write it once" right after Discover, and recommends (b) for the anti-shame rules and for time. This spec takes **(b)**, in this form (OD-TC-1):

- A Discover step whose letter cards have stroke data gets **one extra page, "Trace the new letters"**, right after the **last page that holds a letter card**. It lists those letters in page order and shows one at a time on a trace canvas.
- It is part of Discover: unscored, Continue always enabled, Previous as on any page.

Why not (a): every Stage 1 practice step is the quest's only drill of sound to letter, and T4 pins 6 practice rounds (`stage1-curriculum.test.ts:673-685`); scored Trace rounds add first-try stars to lose on a letter met a minute before. Why not a canvas on each letter card: the Discover page scrolls, and a canvas inside a scrolling page fights the scroll for vertical drags (§1.4).

### 3.2 Which quests and letters (the per-quest table)

The rule is derived, not authored: a letter card is traced when its content item's `jamoId` has stroke forms (`strokeFormsForJamo(id) !== undefined`), each id once. On today's content that is exactly the jamo items of quests 1–10 (§1.1 items 2, 3). Quests 11–15, the Stage 1 addition (Match Shape) and every upper-stage Discover get no trace page. Adaptive pacing's compact page never meets it: pacing runs only in the lesson cells of Stages 2–4, 6 and 7 (`logic/quest-flow/pacing-view.ts:10`).

**Seconds.** The trace page counts **10 s per letter**, Discover's own rate per item (§1.2). This is an **unmeasured planning figure**, about half the repo's estimate for a scored Trace round (quest 2: 75 s for 4 letters; quest 12: 60 s for 4), which includes Done, misses, retries and the Next wait; the trace page has none of these, but it has fixed waits of 2.6 s per finished letter (1.5 s gate, 1.1 s beat). It is measured in the next playtest and by telemetry (§7), with a named fallback (OD-TC-2).

**Budget rule** (OD-TC-2): every quest keeps its `estimatedMinutes`, and its step seconds add up to **300 s or less**.

| Quest | Letters on the trace page (in order) | Discover pages after | Discover s | Other change | Sum before → after | Min |
|---|---|---|---|---|---|---|
| 1 | ㅏ ㅓ ㄱ ㄴ | ㅏ ㅓ · ㄱ ㄴ · **trace** | 40 → 80 | — | 256 → 296 | 5 |
| 2 | ㅗ ㅜ ㅁ ㅇ | ㅗ ㅜ · ㅁ ㅇ · **trace** | 40 → 80 | — (its scored Trace step stays, OD-TC-5) | 254 → 294 | 5 |
| 3 | ㅡ ㅣ ㄷ ㄹ | ㅡ ㅣ · ㄷ ㄹ · **trace** | 40 → 80 | — | 256 → 296 | 5 |
| 4 | ㅈ ㅊ | ㅈ ㅊ · **trace** · 고추 차 | 40 → 60 | — | 226 → 246 | 4 |
| 5 | ㅂ ㅅ | ㅂ ㅅ · **trace** · 아버지 아기 · family words | 60 → 80 | — | 244 → 264 | 4 |
| 6 | ㅋ ㅌ | ㅋ ㅌ · **trace** · words | 40 → 60 | — | 224 → 244 | 4 |
| 7 | final ㄴ, final ㄹ | finals · **trace** · words of Seollal | 40 → 60 | — | 226 → 246 | 4 |
| 8 | ㅑ ㅕ ㅍ, final ㅇ | ㅑ ㅕ · ㅍ final ㅇ · **trace** · 추석 | 60 → 90 | the theme page keeps 추석 only; its songpyeon picture moves to the final ㅇ card; Build a Letter estimate 75 → 60 s (OD-TC-3) | 276 → 291 | 5 |
| 9 | ㅛ ㅠ ㅎ, final ㄱ | ㅛ ㅠ · ㅎ final ㄱ · **trace** | 40 → 80 | Listen & Pick practice estimate 90 → 75 s (OD-TC-4) | 271 → 296 | 5 |
| 10 | final ㅁ, final ㅂ | finals · **trace** · 봄 밥 · payoff | 60 → 80 | — | 246 → 266 | 4 |

- Every `estimatedMinutes` stays (T10: 244, 246, 264 and 266 s round to 4; 291, 294 and 296 s to 5). Episode minutes (15, 12, 14, 12, 16) and Stage 1's 65 minutes do not change, so the catalogue, the planner and the parent pages do not move. Stated plainly: the estimated time of quests 1–10 grows from 2,479 s to 2,739 s (+260 s, about 4.3 minutes over ten quests); the minute labels hold because each quest was under its rounded value.
- All 30 symbols are on a trace page in the quest that teaches them (WO-14's acceptance).
- The "1–3 Discover pages" rule (schema `quest.ts` `DiscoverSchema`, T4, content-skill) counts **content** pages; the trace page is extra. Quests 5, 8 and 10 show four pages.
- Quests 11–15 and the Stage 1 addition: unchanged. (WO-12's third Discover pages for quests 11 and 15, #1127, are word pages: no trace page.)

**Quest 8** (OD-TC-3), 316 s with the trace page. Two changes:
1. The theme page "Words of Chuseok" (`quests.ts:325-331`) keeps **추석** (with `card:chuseok`) and drops **송편**, which is already page 2's example for final ㅇ (`:322`). The final ㅇ item gains `picture: 'card:songpyeon'` (a `jamo` item may carry a picture, `quest.ts:45`; it is the first letter card with one, `DiscoverStep.tsx:628-630`), so the rice cake of the quest's title is still pictured. A one-item page is allowed (F-QUEST-002 §3.1; #1127 adds two). −10 s.
2. Build a Letter's estimate goes from 75 s to 60 s, the value of the other Stage 1 Build a Letter apply steps with four blocks (quest 5 `:213`, four open blocks; quest 7 `:292`, four closed blocks, harder than quest 8's two closed and two open). This is a **re-estimate**: the learner builds the same four blocks. −15 s.

Consequences, all checked in TC-1b: 추석 keeps its `quest:stage1-rites-q2` source, so its clip stays in the `stage1` pack; 송편 keeps sources (the example, the Check, the blocks), so no clip moves or goes (both regenerated with `audio:tts:manifest` and `audio:map`; the drift tests must stay green); the Stage 1 review-item table is regenerated (`stage1-items.json:192-193` freezes both words at `pages[2]`; `REVIEW_ITEMS_STAGE1_WRITE=1` with `review-items-stage1.test.ts`, then `node scripts/build-review-items.mjs --check`), and the PR states whether 송편 is still a Stage 1 `lex` item; the es / ko overlay keys of the removed item go (`overlays.test.ts:202` requires it); quest 8's lecture deck keeps a one-word theme slide.

**Quest 9** (OD-TC-4), 311 s with the trace page: the Listen & Pick practice estimate goes from 90 s to 75 s, the value every other six-round Listen & Pick practice in Stage 1 has (quest 7 `:291`, quest 10 `:424`, quests 11, 12, 14, 15). A **re-estimate**: the same six rounds. Story Sequence keeps its 90 s and its comment (its first reason, "Story Order needs it", still stands).

### 3.3 The trace page

What the learner sees (wireframe "[TC] Trace the new letters"; mock in row TC-0b):

- **Title** "Trace the new letters", in the slot of the step title: on the trace page `QuestPlayerView` shows this title in place of the step's own title and hides the step pill (§3.4, layout). The page label and dots are Discover's ("Page 3 of 3"), counting the trace page.
- **Letter row**: one small chip per letter of the page (glyph only), in order; the current one ringed; a letter traced to the end on this visit gets a filled mark. The chips are decorative: hidden from screen readers behind one summary, "2 of 4 letters traced", and not buttons. The marks only fill (CLAUDE.md §1); a letter passed with **Next letter** stays plain, never marked as missed.
- **Heading** for the current letter: `trace.heading` ("Trace the letter a") or, for a final, `trace.headingFinal` ("Trace the final n"), with the romanization (taught Korean carries it, CLAUDE.md §1); its accessible text is `traceTargetA11yText`, as in Trace Stroke (`TraceStrokeGame.tsx:428`). A final also shows Discover's `batchimLine` ("Sits at the bottom of the block").
- **Canvas**: the letter's ghost (the form shown, `strokesForJamo`) and the learner's ink.
- **Buttons**: **Hear it**, **Show me**, **Clear** and, while a letter follows, **Next letter** (§3.4 says where they go).
- **Hoya's strip** (one line area, as in Trace Stroke): idle, praise, keep going, or shape guide. It stays outside any scrolling part, so the praise is always seen.

Behaviour (pure logic in `logic/stage1/discover-write.ts` and the Discover reducer; `DiscoverTracePad` renders and runs timers):

- **Finished, by itself.** The pad makes the TRACE-IDLE gate with `ready = isLetterFinishedInForms(strokeFormsForJamo(id), drawn, false)` and **no Done button** (OD-TC-9). `TRACE_IDLE_MS` after the learner lifts every finger on a finished letter, the letter counts as **traced**: the ink takes the success look, Hoya cheers with `trace.pass.clean` ("Beautiful! That looks like the letter."), the success haptic plays, the chip fills. During the next `WRITE_ADVANCE_MS = 1100` ms the canvas takes no ink and Next letter is disabled; then the next letter comes up with an empty canvas and the idle line. On the last letter the praise stays and the canvas stays as drawn; **Clear** empties it and the learner may trace again (the line goes back to idle; a second finish praises again; the chip is already filled).
- **Never a miss.** No Done, no fail state, no amber look, no `answerRound`, no stars, no first try, no review item, no memory-store write. An unfinished drawing waits.
- **A pause on unfinished ink.** After `TRACE_KEEP_GOING_MS` with every finger lifted, ink on the canvas and the letter not finished, the line becomes **"Keep going, or tap Next letter."** (on the last letter **"Keep going, or tap Continue."**): it names the way on, because a rough but complete drawing may never reach "finished" and there is no Done. No sound, nothing recorded; it goes back to idle at the next stroke, on Clear and on a letter change.
- **Next letter** (`size="md"`): enabled while a letter follows, except during the advance beat; it clears the ink, shows the next letter, records nothing. Not shown on the last letter. A letter passed over is not offered again on this visit (the page is a once-through).
- **Clear**: removes the ink, calls the gate's `reopen()`, and cancels the keep-going timer (TRACE-IDLE §3.3: an empty canvas has an open gate). Disabled with no ink.
- **Show me**: `StrokeHint` with `orderTaught = strokeOrderTaught(id)` and the letter's romanization, as in Trace Stroke after SO-1 (untaught, every letter today: shape reveal, the strip reads `trace.shapeGuide` while it is up and the strip is idle). Its sound is **the same as Hear it**: it dispatches `{ type: 'hear', id: 'write|<jamoId>' }` (so a consonant says its sound, 가, not its name; OD-TC-10). It never calls `playJamo` itself.
- **Hear it** dispatches the same `hear` event: the letter card's own `hear` spec under the id `write|<jamoId>` (a final: its closed syllable). It plays through one prompt slot registered under the key `write` (`cardKeyOf('write|…')` is `write`, `DiscoverStep.tsx:84`); a play that cannot sound shows that slot's status panel in the strip's place, as a card does (F-AUDIO-004 A-5b). The page has no **Can't hear it?** link: the letter pages before it carry it (CH-1d).
- **No sound by itself.** Nothing plays when the page opens or the letter changes; `autoHearId` returns `undefined` for a page with no items.
- **No coaching.** No order, direction or loop tip, taught or not (OD-TC-7).
- **Coming back.** While the Discover step is mounted (Previous to a letter page and Continue back), the trace page keeps its letter and filled chips. A new mount of the step starts plain; nothing is stored. Reached by Previous from the practice step (QB-2), the step opens on its last page, which is now the trace page in quests 1–3 and 9: accepted.
- **Timers** (`TRACE_IDLE_MS`, keep-going, the advance beat, Show me) are cleared on letter change, on page change and on unmount.

### 3.4 Layout of the trace page

The canvas is never inside a scroll view (§1.4). On the trace page `DiscoverStep` renders, instead of its ScrollView, a fixed column like Trace Stroke's screen, above the same pinned Continue and Previous:

1. **Chrome**: `QuestPlayerView` passes the step title slot "Trace the new letters" and hides the step pill while the trace page shows (`DiscoverStep` reports the page kind through a new `onPageKind?: (kind: 'cards' | 'trace') => void` prop); the close header and step dots stay. The step's `hoyaLine` is not drawn on the trace page.
2. **Band above the canvas**: the page label with its dots, then one row with the letter chips, then the heading (and a final's `batchimLine`).
3. **Canvas slot** (`flex: 1`): `traceCanvasSize(slot, traceCanvasMax(layoutClass))`, never below `TRACE_CANVAS_MIN`.
4. **Controls** in `TraceControls` with `scrolls` always true (`TraceControls.tsx:52-57` scrolls on native only when `scrolls` is set): one wrapping row of `sm` buttons, Hear it, Show me, Clear, Next letter; Hoya's strip above that row and outside the scroll (Hoya's figure only in the roomy layout, as `TraceFeedback` `showHoya`).
5. **Landscape** (`traceLayoutMode(...) === 'side'`, e.g. 844 × 390): canvas left, band and controls right, as Trace Stroke's side mode (`TraceStrokeGame.tsx` side layout).

Acceptance: at every viewport of `e2e/web/layout.spec.ts:25-33` (320 × 568, 375 × 553, 375 × 667, 844 × 390, 390 × 844, 768 × 1024, 1180 × 820), and at the Largest text size on 390 × 844, the canvas is at least `TRACE_CANVAS_MIN` and fully on screen, and Continue is on screen without scrolling. Row TC-0b measures the mock at these sizes. If a size cannot meet it with rules 1–5, TC-0b may, in this order: (a) put the chips and the heading on one line (the chips shrink to the heading's line height); (b) drop the chips at that size (the summary moves to the heading's accessible text). It records the result here before TC-1b starts.

**TC-0b result (2026-11-26; `design/screens/discover-trace/trace-new-letters.md`, approved by multi-agent review).** Rules 1–5 with (a) and (b) do **not** meet the acceptance at 320 × 568, 375 × 553, 375 × 667, 844 × 390 or Largest on 390 × 844 (measured canvas slot with every control showing: 0, 0, 38–78, 81, 150–158). They fit at 390 × 844, 768 × 1024 and 1180 × 820 with no fallback. TC-0b fixes the fallbacks as a ladder; the pad takes the first step whose canvas slot is at least `TRACE_CANVAS_MIN` with every part on screen, chosen once per page by a pure function of the Screen content box, the text-size scale and the page's content (so the canvas keeps one size across the page's letters):
- Portrait: **full** (rules 1–4) → **beside** ((a), and Hear it and Show me in a column beside the canvas; Clear and Next letter stay in the row, away from the canvas edge) → **compact** (beside, and the title slot is not drawn: the heading leads) → **short** (compact, the step dots in the ScreenHeader between Close and Aa as Trace Stroke's DN-4 progress, no page row with its label kept for screen readers, `spacing.sm` gaps, Previous and Continue `md` with no spacer under them) → **short-b** (short with (b)).
- Landscape, when `traceLayoutMode` of the Screen content box (before the reading cap) is `side`: **side** (rule 5, the pinned row under both columns) → **side-short** (the step dots and count pill in the header, no title, no page row, the `md` pinned row at the foot of the right column) → **side-short-b** (with (b)).
- Measured choice: 320 × 568 short / short-b (canvas 160); 375 × 553 short-b (161–190); 375 × 667 compact (162–163; quest 8 short, 215); 844 × 390 side-short / side-short-b (207–264); 390 × 844 full (186–215); 768 × 1024 full (384); 1180 × 820 side (380); Largest on 390 × 844 beside (185–204).
- Also for TC-1b: the strip keeps the height of its tallest line and at least the status row's; the heading keeps the room of the page's longest heading and a page with a final keeps the final's line; on the last letter Next letter's place stays empty; Next letter is `sm` (as rule 4's row); `StepActions` gets a row size (`md` in the short steps). Open to the owner: OQ-1 (the pinned row steps down to `md` on this page only) and OQ-2 (the title not drawn in compact and the short steps).

**Owner decision 2026-11-26 (approved as recommended):** on the trace page only, the short layouts draw Previous / Continue 64 high (80 on the letter pages before it), and the compact and short layouts do not draw the step title "Trace the new letters" (the per-letter heading leads the page; the page label stays for screen readers). TC-1b adds the `StepActions` size option this needs. This answers OQ-1 and OQ-2.

### 3.5 View model and reducer (row TC-1a)

New module `logic/stage1/discover-write.ts`, pure, 100 % covered:

- `WRITE_ADVANCE_MS = 1100`.
- `writeLetters(pages: readonly DiscoverPage[]): string[]`: the content items' `jamoId`s with stroke forms, in page order, each once.
- `writePageIndex(built: readonly DiscoverPageView[]): number`: where the trace page goes (after the last built page holding a `symbol` item with stroke forms).
- `writeStripLine(input: { traced: boolean; keepGoing: boolean; hintUp: boolean; last: boolean }): 'praise' | 'keepGoing' | 'keepGoingLast' | 'shapeGuide' | 'idle'` (praise wins, then keep going, then shape guide, else idle).

In `logic/stage1/discover-flow.ts`:

- `DiscoverPageView` gains `write?: DiscoverWriteView`, `DiscoverWriteView = { key: 'write'; letters: DiscoverWriteLetter[] }`, `DiscoverWriteLetter = { jamoId: string; glyph: string; romanization: string; final: boolean; hear: HearAction }` (`hear`: the letter card's `hear` spec and kind, id `write|<jamoId>`). A trace page has `items: []` and no `exchange`.
- `buildDiscover(pages, copy, a11y, locale, overlays, options?: { writeOnce?: boolean })` (default `false`; callers pass `undefined` for `overlays`). With `writeOnce`, the trace page is inserted at `writePageIndex`. The `jamoId` comes from the content item (a view item's `key` may carry `#1`).
- `DiscoverState` gains `write: { at: number; traced: readonly string[] }` (set by `startDiscover`, the only constructor; never persisted).
- New events: `{ type: 'traced'; jamoId }` (adds once, never removes) and `{ type: 'writeNext'; from: number }` (moves `at` to `from + 1` only when `from === at`, capped at the last letter; so the advance timer and a Next letter tap can never skip a letter). `next`, `prev` and `hear` do not touch `write`.
- The `done` effect becomes `{ type: 'done'; pages; heard; written }` with `written = traced.length`.
- `pageRender` returns for a trace page `write: { letters, at, traced, last }`, `items: []`, and the usual dots, page, `hasPrevious`, `isLast`, `continueEnabled: true`.

In `DiscoverStep` / `QuestPlayerView` (row TC-1b):

- `DiscoverStep` gains `writeOnce?: boolean` (default `false`) and `onPageKind`; `QuestPlayerView` passes `writeOnce` true for every Discover step it renders (the All lessons preview included: a grown-up sees what the learner sees). Existing `DiscoverStep` screen tests keep the default and stay as they are.
- The action map (`DiscoverStep.tsx:115-126`) also registers each trace letter's `hear`.
- `onDone` and `discoverCompletedPayload` (`check-launcher.ts:52-58`) carry `written` and `writeSeconds` (OD-TC-8): `quest.discover_completed { questId, pages, heard, written, writeSeconds }`, `writeSeconds` the whole seconds the trace page was shown in this mount (0 without one).
- No new file calls `playJamo`, `jamoVoice` or `loneLetterVoice` (the pad plays only through `hear` events), so `logic/__tests__/voice-surfaces.test.ts:408-414` needs no new row.
- The pad's canvas code is **written in `DiscoverTracePad`**, reusing the shared modules of §1.4; `TraceStrokeGame.tsx` is not refactored here (CLAUDE.md §8). The canvas keeps `nativeID="trace-canvas"` so the e2e drawing helpers work.

### 3.6 Strings (`packages/i18n`)

| Key | English (Pre-A1) | Use |
|---|---|---|
| new `learner.quest.discover.write.title` | **Trace the new letters** | the title on the trace page |
| new `learner.quest.discover.write.idle` | **Trace each line slowly.** | idle line (no "Tap Done": there is none) |
| new `learner.quest.discover.write.keepGoing` | **Keep going, or tap Next letter.** | after a pause on unfinished ink |
| new `learner.quest.discover.write.keepGoingLast` | **Keep going, or tap Continue.** | the same on the last letter |
| new `learner.quest.discover.write.next.cta` | **Next letter** | the button |
| new `a11y.discoverWriteProgress(traced: number, total: number)` | **"{traced} of {total} letters traced"** | the letter row's summary; top level next to `a11y.discoverLetter` (`a11y.ts:88`); `plural()` on `total` in en and es, no plural form in ko |
| `learner.minigame.trace.heading`, `.headingFinal`, `.pass.clean`, `.showMe.cta`, `.clear.cta`, `.shapeGuide`; `learner.quest.discover.hearIt.cta`, `.batchimLine`; `a11y.minigame.traceLetter`, `.traceFinal`, `.traceCanvas` (through `traceTargetA11yText`, `traceCanvasA11yLabel`), `a11y.romanizationOr` | (exist) | reused |

Spanish and Korean are shipped locales (`packages/i18n/src/locales.ts`): TC-1b drafts the es and ko values itself, has them reviewed under F-I18N-001 §3.10 (two lenses) and re-signs the ledger for `learner` and `a11y` in the same PR, as SF-1 and CH-1a did. One verb, "trace", on the whole page. No Hangul, no age word.

### 3.7 Stroke order and the "taught" state

- **Tracing a letter never makes it "taught".** `strokeOrderTaught` is not learner progress: it says a person has checked the letter's stroke data (SO-3), and only a person changes `reviewedStrokeIds` (STROKE-ORDER §3.5; a test fails on an id without a review record). The trace page reads the gate and never writes it.
- **What the gate changes here**: only Show me (shape reveal, "Shape guide" line, unnumbered still and the shape label while untaught; ordered animation and numbered still once taught).
- **Forms**: the ghost shows the form shown; "finished" reads every accepted form (OD-SO12), so ㅈ in three strokes, or ㅊ / ㅎ with a flat top stroke, finishes like the form shown.
- **Consequence to plan for**: until SO-3, a learner's first tracing of each letter has a shape guide, not an order model. Recommendation to the owner (not a row of this spec): have the SO-3 reviewer take the quest 1–3 letters first.
- **No learner record**: nothing goes to progress, the memory store, the letter wall or the Hangul Check's anchor (F-QUEST-002 §3.2: Discover is unscored).

### 3.8 [On device, owner]

- iPhone (PWA) and an Android phone, quest 1: the trace page follows page 2; trace ㅏ (praise, then ㅓ), tap Next letter on ㅓ, trace ㄱ and ㄴ; Continue goes to Match the Sound. Drawing never scrolls the page.
- 320 × 568 and Largest text on 390 × 844: canvas ≥ 160 and on screen, Continue on screen.
- TalkBack and VoiceOver: the row reads "0 of 4 letters traced", Continue is reachable at once, nothing plays by itself.
- Quest 8: page 2's final ㅇ card shows the songpyeon picture; the theme page shows 추석 alone; after quest 8, the Chuseok card's Hear on Results sounds offline.

## 4. Out of scope

- The scored Trace steps of quests 2 and 12, Trace Stroke and Trace a Word; extracting a shared canvas from `TraceStrokeGame.tsx` (a later refactor row).
- Tracing a final inside its block (OD-TC-6 (b), a follow-up to take with WO-15); highlighting missing strokes (TRACE-IDLE D2); copying a letter without the ghost.
- Coaching on the trace page (OD-TC-7).
- The lecture deck and the presenter: decks are built from content pages; the trace page is not a slide.
- Quests 11–15, the Stage 1 addition, the upper stages; strict mode; `reviewedStrokeIds`.

## 5. UI sketch

- Wireframe: `design/wireframes/quest/discover.md`, section "[TC] Trace the new letters" (this PR), which also answers that file's open question "See how it is drawn".
- Mock: row TC-0b, a design pass adding `design/screens/discover-trace/` (the page at the §3.4 sizes, Largest text, a final, the last letter, the keep-going line, Show me, reduced motion), approved by multi-agent review (CLAUDE.md §5). TC-1b does not start before it.

## 6. Tests

TDD (CLAUDE.md §5): each test lands, failing first, in the row that makes it pass.

TC-1a, unit (`logic/stage1/__tests__/`):

1. `buildDiscover` with `writeOnce: true`, quest 1's pages: three pages, the third the trace page with ㅏ ㅓ ㄱ ㄴ; without it, two pages.
2. Quest 4: the trace page is page 2 (before the words page). Quests 7 and 10: page 2, letters `final: true`. Quest 8 (after TC-1b's content): page 3, before the 추석 page.
3. Quest 11 and an upper-stage Discover with Word Builder letters: no trace page. A content item repeated on two pages appears once.
4. Reducer: `traced` adds once and never removes; `writeNext` with a stale `from` does nothing (no double advance); `at` stops at the last letter; `next` / `prev` / `hear` keep `write`; `done` carries `written`.
5. `autoHearId` on a trace page is `undefined`; `pageRender` of a trace page has `continueEnabled: true` and no items; `writeStripLine` covers each order.
6. Changed: the three `done` assertions of `discover-flow.test.ts` (`:292`, `:320`, `:434`) gain `written: 0`.

TC-1b, content (`content/__tests__/stage1-curriculum.test.ts`):

7. **T12 (new)**: for each of quests 1–10, `writeLetters` of its Discover equals `questTeaches(quest)` in order; their union is the 30 symbols; quests 11–15 have none.
8. **T13 (new)**: every Stage 1 quest's step seconds add up to 300 or less (T10 still holds). The minutes tests (`:228-235`, `:328-335`, `:411-420`, `:373-401`) are unchanged and stay green.
9. Changed: `:315-326` (quest 8's theme words: 추석 only; its final ㅇ item has `picture: 'card:songpyeon'`). `:310-313` is unchanged (the page keeps its caption).
10. Regenerated and green: `review-items-stage1.test.ts`, `overlays.test.ts`, `audio-assets-drift.test.ts`, `apps/mobile/scripts/__tests__/tts-manifest-drift.test.mjs`, the lecture deck tests for quest 8.

TC-1b, screen (`screens/quest/__tests__/`, testing-library, fake timers):

11. A finished ㅏ → after `TRACE_IDLE_MS` the praise line and a filled chip; ink during the beat is ignored; after `WRITE_ADVANCE_MS` ㅓ with an empty canvas; nothing calls `answerRound`.
12. A half-drawn ㅂ, 10 s → still ㅂ, no fill, "Keep going, or tap Next letter." after 3 s; a rough full ㅂ (every stroke drawn, one under 0.8) → the same line, never praise. Next letter → the next letter, chip plain. Next letter tapped during the beat does nothing.
13. Last letter: praise stays; Clear empties the canvas and the line goes back to idle; the keep-going line names Continue.
14. Show me on an untaught letter → shape reveal and the "Shape guide" line, and it plays the card's sound (가 for ㄱ), not the name; with `reviewed` containing the id → the ordered animation; `reviewedStrokeIds` unchanged.
15. Hear it plays the card's sound and adds `write|jamo:giyeok` to `heard`; nothing plays when the page opens.
16. Continue on the trace page with nothing drawn → `quest.discover_completed` carries `written: 0` and `writeSeconds`.
17. Changed: `screens/quest/__tests__/quest-previous.test.tsx` (`PAGES` at `:45` and its uses at `:110`, `:140`, `:145-154`, `:339-353`, the payload at `:353`): the page count is derived from `buildDiscover(…, { writeOnce: true })`. `logic/__tests__/check-launcher.test.ts:69-76` (the payload). The other `DiscoverStep` tests (`discover-previous`, `discover-auto-hear`, `discover-cant-hear`) keep `writeOnce` off and do not change.

e2e (`apps/mobile/e2e/web/`), updated in TC-1b: `rites-quests.spec.ts:57-67` (quest 7: page 2 is the trace page, the theme page is page 3 of 3) and `:94-106` (quest 8: four pages, page 3 the trace page, page 4 추석 alone; page 2's final ㅇ card shows the songpyeon picture); `life-quests.spec.ts:87-100` (quest 5: four pages); `nature-crafts-quests.spec.ts:84-102` (quest 10: four pages); `results-teaser.spec.ts:202` and `audio.spec.ts:863`, `:1116` (quest 1: "Page 1 of 3"); `layout.spec.ts:25-33`, `:64-69` (quest 1's trace page at every viewport: canvas ≥ 160 and Continue reachable). `helpers.ts` `passDiscover` reads the page count and needs no change; `game-sizing` and `text-size-fit` are re-run. New `discover-trace.spec.ts`: quest 1's trace page, a finished ㄱ drawn with the mouse on `#trace-canvas`, then Continue.

Coverage: `apps/mobile` business logic stays at or above 90 %; `discover-write.ts` 100 %. Start bundle: `DiscoverStep` and `discover-flow` are in it; TC-1a and TC-1b each run `build:web --budget` and, if needed, raise `PRECACHE_BUDGET.startBundleRaw` (`apps/mobile/scripts/pwa/lesson-chunks.mjs:315`) with the measurement in the comment, as TI-2, SO-1 and LR-2 did.

## 7. Rollout

Next release, with TC-1b (TC-1a changes nothing on screen). Watch `quest.discover_completed`: `written` (do learners trace, how many letters) and `writeSeconds` per letter. The next family playtest of quests 1–3 (F-QUEST-002 §6, the "4-5 minute claim") times the trace page, quest 8's Build a Letter and quest 9's practice. OD-TC-2's fallback applies if the trace page's median is over 15 s per letter.

## 8. Dependencies

- `AMENDMENTS-TRACE-IDLE.md` (shipped), `AMENDMENTS-STROKE-ORDER-STANDARD.md` SO-1 and SO-2 (built): §1.4.
- `AMENDMENTS-DISCOVER-SOUND-FIRST.md` (WO-13, ready): Hear it and Show me reuse the card's `hear`, which SF-1 makes the sound. Either may land first.
- `AMENDMENTS-STAGE1-CONTENT-FIXES.md` (WO-12, #1127): edits quests 6, 7, 11 and 15 in `content/quests.ts`, the overlays and `stage1-items.json`; it does not touch quest 8's pages or any step seconds of quests 1–10. TC-1b rebases on CF-1b and regenerates `stage1-items.json` and the audio manifest after it.
- `AMENDMENTS-ROMANIZATION-FADE.md` (WO-11, #1128): RF-1b also changes `discover-flow.ts` and `DiscoverStep.tsx`; a letter's own value is never folded and the trace page shows only letters, so they do not interact; the rows merge one after the other.
- `AMENDMENTS-STAGE1-DECODING-CHECK.md` (WO-10, #1129): no interaction.
- WO-15 (batchim quests): Discover letter cards with stroke data there get a trace page by the same rule; OD-TC-6 (b) can be taken with it.

## 9. Rows

| Row | Model | Work | Files | Tests | Acceptance | Depends on |
|---|---|---|---|---|---|---|
| TC-0 | Opus 5.5 | This spec; the wireframe section; "Amended" lines in F-QUEST-002 and STROKE-ORDER-STANDARD; the index lines; multi-agent review | `docs/specs/AMENDMENTS-STAGE1-TRACE-COVERAGE.md`, `docs/specs/F-QUEST-002-discover-check-stage1-complete.md`, `docs/specs/AMENDMENTS-STROKE-ORDER-STANDARD.md`, `docs/specs/README.md`, `design/wireframes/quest/discover.md`, `design/wireframes/README.md` | — | status `ready` | — |
| TC-0b | Opus 5.5 | Design pass: the trace page mock at the §3.4 sizes and states of §3.3; fixes §3.4's fallbacks if needed; multi-agent review | `design/screens/discover-trace/`, this spec §3.4 | — | mock approved; §3.4 sizes met on the mock. **done 2026-11-25**: `design/screens/discover-trace/trace-new-letters.md`, `mock/discover-trace.css`, `mock/trace-new-letters-{sizes,states,largest,200,spec-only}.html`, `tools/{frames,build,measure}.mjs`, `shots/`; §3.4 "TC-0b result" | TC-0 |
| TC-1a | Sonnet 5.5 | §3.5 `discover-write.ts` and the `discover-flow.ts` changes, behind `writeOnce` (default off) | `logic/stage1/discover-flow.ts`, `logic/stage1/discover-write.ts` (new), their tests; `scripts/pwa/lesson-chunks.mjs` if the budget needs it | 1–6 | tests green; nothing changes on screen. **done 2026-11-26**: `discover-write.ts` (`WRITE_ADVANCE_MS`, `writeLetters`, `writePageIndex` (-1 when nothing to trace), `writeStripLine`, `jamoIdOfKey`) and the `discover-flow.ts` changes behind `writeOnce` (off by default); tests 1–6 in `discover-write.test.ts` and `discover-flow.test.ts`; start bundle +1,818 B raw on main, line raised to 4,585,300 B (`lesson-chunks.mjs`, measurement 4,579,228 B). Accepted deviations: `DiscoverState.write` also holds `count` (the letter count, to cap `at`); eight `done` assertions in `discover-flow.test.ts` gain `written: 0` (the spec listed three); the layout-ladder chooser is not in TC-1a (it goes with the pad in TC-1b) | TC-0 |
| TC-1b | Sonnet 5.5 | §3.3–3.5 `DiscoverTracePad`, `DiscoverStep` (`writeOnce`, `onPageKind`, the trace layout), `QuestPlayerView` (passes `writeOnce`; title and pill; payload type), `discoverCompletedPayload`; §3.2 content (quests 1–10 Discover seconds; quest 8's theme item, picture and Build a Letter estimate; quest 9's practice estimate); §3.6 strings en + es + ko and ledger; `TELEMETRY-NAMES-2.md` (`written`, `writeSeconds`; `pages` counts the trace page; `heard` counts `write|` taps separately); overlays; regenerated review items and audio manifest | `screens/quest/DiscoverStep.tsx`, `screens/quest/DiscoverTracePad.tsx` (new), `screens/quest/QuestPlayerView.tsx`, `logic/quest-flow/check-launcher.ts`, `content/quests.ts`, `content/i18n/{es,ko}/stage1-quests.json`, `packages/content-schema/src/review-items/stage1-items.json`, `content/audio/tts-manifest.json` and generated audio files (only if changed), `packages/i18n/src/messages/{en,es,ko}/{learner,a11y}.ts`, `packages/i18n/src/messages/review-ledger.json`, `docs/roadmap/TELEMETRY-NAMES-2.md`, `scripts/pwa/lesson-chunks.mjs` if needed, tests and e2e of §6 | 7–17, e2e | every new letter of quests 1–10 is on its quest's trace page; §3.4 sizes met in `layout.spec.ts`; §3.8 by the owner. **done 2026-11-26** (§3.8 on a device is the owner's): `DiscoverTracePad.tsx` (the pad) behind `discover-trace-entry.tsx`/`discover-trace-chunk.tsx` (a lazy screen chunk, `screen-chunk:discover-trace`, 13.7 KB raw, asked for as a Discover step with letters opens; its pinned buttons alone until it is in), `logic/stage1/trace-pad-layout.ts` (the ladder chooser, pure: `traceArrangement`, a pure function of the Screen content box, the text scale and the page), `use-screen-content-box.ts`, `StepActions` `rowSize`, `DiscoverStep` (`writeOnce`, `onPageKind`, `written` and `writeSeconds` only when the step has a trace page), `QuestPlayerView` (`writeOnce`, the title slot, the step pill and the step dots in the header by the arrangement), `discoverCompletedPayload`; content (quests 1–10 Discover seconds, quest 8's page and picture, 75 → 60 s, quest 9's practice 90 → 75 s, overlays, `stage1-items.json` without the 송편 `discover` row: 송편 stays a Stage 1 `lex` item through its Check round); en, es and ko strings (es and ko drafted and kept by two reviewers, ledger re-signed for `learner` and `a11y`); tests 7–17 and e2e. Measured on the release build (Chromium, `layout.spec.ts` and `discover-trace.spec.ts`): canvas 160–384 and wholly on screen, Continue on screen, at the seven viewports and Largest on 390 × 844. Start bundle: 4,589,675 B raw (4,375 B over the line; the pad is the 13.7 KB chunk), line raised to 4,595,700 B (`lesson-chunks.mjs`). Accepted deviations: the chooser's part heights are estimates fitted to the mock and to the real build, so at 844 × 390 a page with a final (quests 7, 8) takes `side-short-b` where the mock took `side-short` for quest 7; the landscape column's gaps are `spacing.xs` and its pinned row's top padding `spacing.xs` (the real header is 68 high, the mock's 64); the trace page's heading View keeps Trace Stroke's wrapper (an accessible `header` around the `Heading`), so two heading nodes show on the web (the outer one carries the accessible name; e2e reads it by test id); `@hangul-route/design-system` exports `./src/tokens` (the chooser is pure logic and Metro reads no `exports`); `console-locale-check.mjs` also leaves Clerk's own es and ko localizations out of its probes (a probe of ours, "espera un momento", is a substring of one). | TC-0b, TC-1a |
| TC-2 | Sonnet 5.5 | Closing docs: F-QUEST-002 §3.2 text, §3.6 tables (quest 8's Discover pages; the steps line "a trace page, 10 s per letter, outside the 1–3 page rule"; quest 8's apply and quest 9's practice seconds) and §5 (T12, T13); `.claude/skills/content-skill/SKILL.md` §3.1 note (Discover 40–90 s with the trace page; the page cap counts content pages); the wireframe's "as built" notes; this spec's status `shipped`; the index status | the docs named | — | docs match the build | TC-1b |

Branches: `docs/trace-each-letter` (TC-0), `design/discover-trace` (TC-0b), `feat/discover-trace-model` (TC-1a), `feat/discover-trace-page` (TC-1b), `docs/trace-coverage-amended` (TC-2). One commit = test + implementation.

## 10. Decisions

### 10.1 Settled by WO-14 and the review README

- **(b), not (a)** (WO-14's recommendation, §3.1).
- **Time does not grow** (WO-14 "설계 제약"), read as OD-TC-2.
- **Every new symbol of quests 1–10 is traced once in its own quest**, finals included (WO-14 acceptance).
- **Unscored** (CLAUDE.md §1 anti-shame rules; WO-14 (b) "채점 없음").
- **Tracing never marks a letter's stroke order "taught"** (STROKE-ORDER §3.5: a person only), §3.7.

### 10.2 Open decisions (adopted as recommended; the owner said to proceed with the recommendations)

| ID | Question | Options | Recommendation (adopted) |
|---|---|---|---|
| OD-TC-1 | The form of (b) | (a) one trace page after the last letter page, letters one at a time; (b) a canvas on each letter card; (c) a trace page after each letter page; (d) one trace page at the end of Discover | **(a)**. (b) puts a canvas in a scrolling page and doubles each card; (c) doubles the four-letter quests' pages; (d) puts theme or word pages between hearing and tracing (quests 4–8, 10) |
| OD-TC-2 | What "do not lengthen the quest" means | (a) `estimatedMinutes` unchanged and step seconds ≤ 300; (b) step seconds never grow (cut 20–40 s of play from every quest); (c) `estimatedMinutes` only | **(a)**. The minute value is what learners, parents, teachers, the planner and the episode sums read; (b) removes sound-to-letter practice from ten quests; (c) would let quests 8 and 9 run 5:16 and 5:11 under a "5 minutes" label. **Fallback** if the measured median is over 15 s per letter (§7): Match Sound / Listen & Pick practice goes from 6 to 5 rounds in quests 1–3, 8 and 9 (a T4 exception), decided by the owner then |
| OD-TC-3 | Quest 8 (316 s) | (a) the theme page keeps 추석 only (songpyeon picture to the final ㅇ card) and Build a Letter 75 → 60 s; (b) remove the whole theme page (추석 leaves Stage 1's rites words, its clip moves pack, the review items change); (c) leave it at 316 s | **(a)**: 291 s. One real cut that keeps the quest's Chuseok word and touches no clip, plus a re-estimate to the value of the same game with four blocks in quests 5 and 7 |
| OD-TC-4 | Quest 9 (311 s) | (a) Listen & Pick practice 90 → 75 s, the value of every other six-round Listen & Pick practice; (b) Story Sequence 90 → 75 s; (c) a real cut (three story cards, or Build a Letter in place of Story Sequence) | **(a)**: 296 s. (b) contradicts the comment's first reason ("Story Order needs it"); (c) removes the quest's only culture sequence |
| OD-TC-5 | Quest 2 already traces ㅁ ㅇ ㅗ ㅜ (scored) | (a) keep it, and add the trace page; (b) replace quest 2's apply; (c) no trace page in quest 2 | **(a)**. One rule for every letter quest; 294 s; the scored Trace is the only in-quest check of tracing in quests 1–10 |
| OD-TC-6 | How a final is traced | (a) its shape alone, as in quest 12, with "Sits at the bottom of the block"; (b) inside its example block | **(a)**. Its place is taught by the block diagram on the card just before; (b) needs block placement (Trace a Word's `block-strokes.ts`) and a design pass: a follow-up with WO-15. TC-0b may draw a faint block frame behind a final's ghost |
| OD-TC-7 | Coaching on the trace page | (a) praise only; Show me follows the gate; (b) Trace Stroke's tips | **(a)**. A first try at a shape; a tip would wait for Next (TRACE-IDLE §3.4) and slow the page |
| OD-TC-8 | Telemetry | (a) add `written` and `writeSeconds` to `quest.discover_completed`; (b) none | **(a)**. Two properties on an existing event; the only way to know whether learners trace and how long it takes (§7) |
| OD-TC-9 | A Done button | (a) none: a finished letter is accepted on the pause; the keep-going line names Next letter / Continue; (b) Done that never fails ("Good try") | **(a)**. With no miss state there is nothing for Done to decide |
| OD-TC-10 | Show me's sound | (a) the card's sound, as Hear it (가); (b) the name, as Trace Stroke's Show me (기역); (c) silent | **(a)**. One voice per letter on the page, the sound Discover just taught (WO-13); no new voice surface |

## 11. Review log

- 2026-11-25, multi-agent review of the TC-0 draft (two lenses: handwriting / phonics pedagogy and session timing; engineering feasibility against the code, tests and e2e). Every number in §3.2 re-checked against `quests.ts` by the timing reviewer; the code citations re-checked by the engineering reviewer.
  - **Blocker, fixed**: the page did not fit the promised sizes: `QuestPlayerView` draws a title and pill above Discover, and with the band, controls and pinned Continue a 320 × 568 window had no room for a 160 canvas (`traceCanvasSize` floors at 160, so it would overflow), and landscape had no rule; `layout.spec.ts` walks quest 1's Discover at 320 × 568, 375 × 553 and 844 × 390 → §3.4 (the title takes the step title's slot, the pill hides, controls in one scrolling `TraceControls`, side mode in landscape, sizes as acceptance, TC-0b measures with ordered fallbacks); `layout.spec.ts` in §6.
  - **Majors, fixed**: 10 s per letter is unmeasured and half the scored-trace estimate → said so, telemetry `writeSeconds`, a named fallback (§3.2, §7, OD-TC-2). Quest 9's re-estimate misread the comment (its first reason is play time) → the practice estimate moves instead, to the value every other six-round Listen & Pick practice has (OD-TC-4). Quest 8's page removal moved 추석's clip to another pack and changed the Stage 1 review items and rites words → the page keeps 추석, drops only the repeated 송편, plus a same-game re-estimate (OD-TC-3); review-item regeneration and the manifest named (§3.2, §6). A rough but complete drawing never got praise and the keep-going line was untrue → the line names Next letter / Continue (§3.3, test 12). Show me would say the name (기역) next to Hear it's sound (가), and a new `playJamo` caller would fail the voice-surface table → Show me plays the card's `hear` (OD-TC-10, §3.5). The payload builder `discoverCompletedPayload` and its test were out of scope → in scope (§3.5, test 17). Making `writeOnce` the default in `DiscoverStep` broke five screen test files → a `DiscoverStep` prop, default off, passed by `QuestPlayerView`; `quest-previous.test.tsx` listed (§3.5, test 17). TC-1a changed three `done` assertions → listed (test 6). Next letter during the advance beat could skip a letter → `writeNext { from }`, Next disabled in the beat (§3.5, test 12). The start-bundle budget → measured in TC-1a and TC-1b (§6). The new module's exports and copy-vs-extract were unnamed → named; the canvas is written in the pad, `TraceStrokeGame.tsx` untouched (§3.5).
  - **Minors, fixed**: `TraceControls` must scroll always; the slot key `write`, its status panel, no Can't hear link; `jamoId` from content items, deduplicated; the a11y string's place and plurals; the first letter card with a picture gets an e2e assertion; the page cap counts content pages; QB-2 opens on the trace page (accepted); `pages` / `heard` meaning in `TELEMETRY-NAMES-2.md`; the advance beat, the last letter, Clear after praise and the chips (decorative, not buttons) decided; the heading's accessible text and the reused a11y keys; Hoya's strip outside the scroll; the "writing helps look-alikes" claim softened (§1.3) and user story 2 softened; finals in their block named as a follow-up with WO-15; the rounding bullet lists 244; the total growth (+260 s) stated; one verb, "trace", across title, heading and lines (the page is now "Trace the new letters").
  - **Citations corrected**: `buildDiscover` `:289-336` (it already takes `overlays`); `done` sent at `:541`; `continueEnabled` value `:644`; DiscoverStep ScrollView `:294-380`; `rites-quests.spec.ts:57-67`.
  - **Kept**: (b) and its placement; finals as a lone shape (OD-TC-6); quest 2 keeps its scored Trace; the chips come back plain on a new mount (nothing stored; the run store is not extended for it). The recommendation that SO-3 reviews the quest 1–3 letters first is the owner's call, not a row (§3.7).
  - **Not verified** (left to the rows): rendering on devices and at Largest text (TC-0b, §3.8); real tracing times (§7); the exact regenerated review items and manifest (TC-1b).
