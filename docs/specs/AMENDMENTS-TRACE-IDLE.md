# AMENDMENTS-TRACE-IDLE — a pause never scores a letter as missed

Status: ready (owner decision 2026-11-22: D1 and D2 accepted; the revision-3 review of 2026-11-22 found no blockers, §11). Revision 3 (2026-11-21, re-based on `d5ba0217c`; revision 2 was written for work order WO-02 of `docs/roadmap/review-2026-11/phase-1-safety.md`, row TI-0, on `5573e1072`). The multi-agent review of 2026-11-21 (§11) is adjudicated in revision 2; revision 3 re-reads every citation on the main tip and re-measures §1 on the AU-14 stroke data (§11).

**Amends**: F-004 §3.3 (Trace Stroke: "on Done, or after a 1.5 s idle timer past the last stroke"; "clear the drawn path") · F-008 §3.3 (retry window; "Strokes auto-clear after 2000ms") · AMENDMENTS-TOUCH §6.8 (KT-D9, "the drawing is still scored without the Done button") · F-CURR-001 §3.7 (Trace Word, letter mode and its retry pause) · tag **[TI]**
**Not amended**: F-005 (stroke order). Order never decides a pass outside strict mode, and this amendment changes only *when* a drawing is scored, not how order is judged; WO-03 (`AMENDMENTS-STROKE-ORDER-STANDARD.md`) owns order.
**Scope**: `apps/mobile/src/logic/trace-evaluator.ts`, `apps/mobile/src/logic/trace-ready.ts` (new), `apps/mobile/src/screens/minigames/TraceStrokeGame.tsx`, `apps/mobile/src/screens/minigames/TraceWordGame.tsx`, `apps/mobile/src/logic/trace-word/evaluate.ts`, the tests of §6, `packages/i18n` (en, es, ko strings)
**Owner**: solo dev
**Rollout**: next release

---

## 1. Context

CLAUDE.md §1 (anti-shame rules): one session clock at most, and "no per-question fail: time running out ... never marks an item wrong".

Trace Stroke has a hidden per-letter clock. Re-read on `d5ba0217c` (revision 2 read `5573e1072`; none of the 12 commits between them changed the gate, the wipe timers or the idle line):

- `TRACE_IDLE_MS = 1500` (`apps/mobile/src/logic/trace-evaluator.ts:13`). Every finger lift restarts a 1.5 s countdown (`:73-80`); when it runs out the drawing is scored (`evaluateOnce`, `:63-69`).
- Trace Stroke creates the gate with no condition (`screens/minigames/TraceStrokeGame.tsx:139-150`, `createTraceEvaluator` at `:140-143`), so a lift after the first stroke of ㅂ (4 strokes, `BIEUP` in `content/jamo-strokes.ts:94-99`), followed by a 1.5 s look at the guide, scores a one-stroke drawing.
- A failed score is a first-try miss: `answerRound(roundIdx, false)` (`:236`), which counts against the quest's stars (first-try scoring, `logic/first-try.ts`; `store/quest-run-store.ts:165-194`). Trace Stroke passes no `asked`, so a miss does not enter the review list; it costs first tries and stars. (Since QB-3, `AMENDMENTS-QUEST-SOUND-BACK.md`, a step replayed with Previous scores nothing new, `quest-run-store.ts:168`; a first play still does.) Then, 1.8 s or 2.0 s later, the drawing is wiped and the gate reopened (`TraceStrokeGame.tsx:238-246`), and the coaching line goes back to idle with it.
- Trace Word has the same hole in **letter mode**: its gate's `ready()` returns `true` for a letter round (`TraceWordGame.tsx:206-210`, the `return true` at `:209`), and its retry look is wiped after `RETRY_MS = 1800` (`:71`, applied `:264-269`). Block mode only waits until every letter of the block has *some* ink (`logic/trace-word/evaluate.ts:201-212`, gate `:219-238`), so an unfinished multi-stroke letter in a block can still be idle-scored.
- Strict mode (order required to pass, F-008) exists as a prop (`TraceStrokeGame.tsx:58, 78`) but no caller turns it on: `MinigameScreen.tsx:214`. In practice a round passes on coverage alone (`TraceStrokeGame.tsx:220-222`, `DEFAULT_PASS_THRESHOLD` = 0.65).
- Coverage alone is not a safe "finished" signal: coverage is the mean of per-target-stroke recall with a 24-unit tolerance (`logic/stroke-scoring.ts:19, 168-182`), so ink near one stroke also counts toward its neighbours.
- **The stroke data changed under this spec.** AU-14 (`AMENDMENTS-AUDIT-2026-11.md` row AU-14, #1035) rewrote `jamo-strokes.ts`: ㅁ and final ㅁ are now 3 strokes (were one closed loop), ㅗ and ㅛ start with the tick, ㅌ has 3 strokes, ㅈ 2, ㅊ 3. Re-measured on `d5ba0217c` with the real `scoreTrace`, each prefix of the authored strokes drawn exactly: the first 2 of ㅂ's 4 strokes still score 0.73; **19 of the 22 multi-stroke jamo** (20 at revision 2, plus ㅁ and final ㅁ) reach 0.65 before their last stroke; only ㄷ, ㅅ and ㅋ do not. New cases: ㅁ's first 2 strokes score 0.82; ㅗ's first stroke (now the tick) alone scores 0.67; ㅈ's first stroke alone scores 0.65. So every multi-stroke letter of the shipped trace rounds can now be idle-scored early: Stage 1 q2 (ㅁ ㅗ ㅜ; only ㅇ is safe) and q12 (final ㅁ ㅂ ㄹ).
- F-004 §4 already says "no idle penalty mid-stroke" (`F-004-trace-stroke.md:91`); the code does not keep that promise between strokes.

Who this hurts most: young children and anyone with a tremor or slow motor planning (WCAG 2.2.1 Timing Adjustable), on exactly the letters with the most strokes (ㅁ, ㅂ, ㅊ, ㅌ, ㅍ, ㅎ).

## 2. User story

> As a learner drawing ㅂ, I can stop between strokes to look at the guide for as long as I like. The app checks my letter when it is finished, or when I tap Done.
>
> As a parent who learned Hangul in Korea and is teaching my child, I do not see my child marked wrong because they stopped to think.

## 3. Acceptance criteria

### 3.1 The idle countdown only finishes a finished drawing

- `createTraceEvaluator` takes an optional `ready?: () => boolean` (default `() => true`, so a caller that passes nothing keeps today's behaviour). On a finger lift the countdown starts only when `ready()` is true; otherwise any running countdown is cancelled. `createTraceWordGate` becomes a thin call of `createTraceEvaluator` with its `ready` and keeps its tests. (`createTraceEvaluator` has exactly two consumers today: Trace Stroke and `createTraceWordGate`.)
- New module `logic/trace-ready.ts`:
  - `wouldPass(result, strictMode)` — the one pass rule, used by both the gate and `evaluate()`: `strictMode ? result.passWithOrder : result.coverage >= DEFAULT_PASS_THRESHOLD`. `TraceStrokeGame.tsx:220-222` calls it instead of its own expression, so the two can never drift apart.
  - `isFinished(result, strictMode)` = `wouldPass(result, strictMode)` **and** every `result.perStrokeCoverage[i] >= TRACE_READY_STROKE_MIN`, with `TRACE_READY_STROKE_MIN = 0.8`.
- **Given** a Trace Stroke round, **when** the learner lifts a finger, **then** the countdown starts only if `isFinished(scoreTrace({ target, drawn }), strictMode)`. `ready()` reads live data through refs (`strokesRef` and a target ref), because the gate is created once (`:139-150`); `TraceWordGame` does the same (`:203-211`).
- **Given** a Trace Word round in **letter mode**, the same rule applies to the letter. **In block mode**, `ready()` = every letter of the block has ink (today's rule) **and** every letter of the block `isFinished` against its own strokes.
- Consequence: **the idle path can only produce a pass, and only for a finished letter.** A miss is recorded only after the learner taps **Done**. A pause, however long, never records anything.
- Joined strokes (ㅁ in one or two strokes — the data has three since AU-14 —, ㄹ in one) still finish: per-stroke coverage is measured per *target* stroke against all drawn points, so a joined stroke covers several targets. A drawing that is rough enough to miss the 0.8 floor on some stroke is never auto-scored; the learner taps Done, which scores it with the normal pass rule (§3.2 tells them so).
- **Done** works whenever there is ink and no result is showing (as today: `TraceStrokeGame.tsx:441`), during the keep-going line too (§3.2).

### 3.2 After a pause with ink that is not finished

- **Given** the learner has lifted every finger, there is ink, and `ready()` is false, **when** `TRACE_KEEP_GOING_MS` (3000, a named constant in `logic/trace-ready.ts`) passes, **then** the status line changes to **Keep going. Tap Done when you finish.** No sound, no Hoya pose change, nothing recorded.
- The keep-going line is a separate `keepGoing: boolean` state; `feedback` stays `'idle'`, so Done stays enabled and the canvas colours do not change. Its timer is cancelled on finger down (`hold`), on Clear, on round change and on unmount; the line goes back to idle when the next stroke starts.
- The line is in the existing `accessibilityLiveRegion="polite"` status (`:541`): it is announced once per pause, on purpose.
- The idle line changes so Done is named from the first screen: `trace.idle` **Draw each line slowly. Tap Done when you finish.** (was "Slowly draw the letter. Lift your finger to finish.", `packages/i18n/src/messages/en/learner.ts:836`, which is no longer true for an unfinished letter).

### 3.3 After a miss (Done on a drawing that does not pass)

- The miss is recorded as today (`answerRound(roundIdx, false)`, first try only).
- The drawing **stays on the canvas** with the existing nudge fill and border (`traceFillByFeedback.fail`, `traceBorderByFeedback.fail`, amber — never `colors.feedback.danger`), Hoya stays `thinking`, and the retry line stays.
- **Given** a miss is showing, **when** the learner starts a new stroke (the `start` touch effect, i.e. first real ink — not `hold`, so a resting palm or a held finger with no ink changes nothing, KT-D9), **then** `feedback` goes back to `'idle'`, `orderCorrect` and `directionNudge` reset, `gate.reopen()` runs, and the new stroke is **added to** the ink already there. The learner keeps their correct strokes and adds what was missing; Done or the idle rule scores the whole drawing again. (D2 in §10.)
- **Given** a miss or a pass tip is showing, **when** the learner taps **Clear**, **then** the ink is removed, `feedback`, `orderCorrect`, `directionNudge` and `keepGoing` reset, and `gate.reopen()` runs. Rule: whenever the canvas is empty after a result, the gate is open. (Today `handleClear`, `TraceStrokeGame.tsx:281-285`, only cancels the countdown; without the timer's `reopen()` the round would lock.)
- **Show me** works as today during a miss: the demo plays over the dimmed guide; the learner's ink stays underneath and is not changed.
- **Skip** works as today (records nothing; F-008 first-try rule).
- The 1.8 s / 2.0 s timers of `TraceStrokeGame.tsx:238-246` and Trace Word's `RETRY_MS` wipe (`TraceWordGame.tsx:264-269`) are removed. Nothing on a trace canvas changes by itself after a miss.

### 3.4 After a pass: tips are not on a timer

- A **clean** pass (`pass.clean`) keeps today's 1.1 s advance (`TraceStrokeGame.tsx:223-233`; Trace Word `PASS_MS`, `TraceWordGame.tsx:69`).
- A pass that carries a tip (`pass.order`, `pass.open`, `pass.loop`; `logic/trace-copy.ts:40-45`) does **not** advance by itself: a **Next** button (same size as Done, `touchTarget.min`, focus moves to it) shows under the line, and the round advances when it is tapped. (WO-02 decision 5: coaching lines stay until the learner moves on; WCAG 2.2.1, reading speed.)
- Trace Word: the same rule for its per-letter tips.
- *Errata 2026-11-22 (TI-2; pending owner confirmation):* "same size as Done, `touchTarget.min`" cannot both hold: Done is `md` (`touchTarget.min`) in the compact and side layouts but `lg` (`touchTarget.child`) in the roomy layout. Following the TI-0b design (`design/wireframes/minigame/families.md`, "Trace Stroke states", decision 1 and open item 2), Next takes Done's slot **and Done's size** in every layout, so the button row never moves; it is never smaller than `touchTarget.min`.

### 3.5 KT-D9 (AMENDMENTS-TOUCH §6.8) restated

"A touch that never drew re-arms the idle check, so the drawing is still scored without the Done button" becomes: "a touch that never drew re-arms the idle check **subject to `ready()`**; an unfinished drawing is scored only by Done." The code comment at `trace-evaluator.ts:98-103` changes with it.

### 3.6 Strings (`packages/i18n/src/messages/{en,es,ko}/learner.ts`, block `learner.minigame.trace`)

| Key | English |
|---|---|
| `learner.minigame.trace.keepGoing` | Keep going. Tap Done when you finish. |
| `learner.minigame.trace.idle` (changed) | Draw each line slowly. Tap Done when you finish. |
| `learner.minigame.trace.next.cta` | Next |

Spanish and Korean are **shipped** locales (`packages/i18n/src/locales.ts:31-35`; any missing key fails `es-coverage.ts` / `ko-coverage.ts`), so the PR that adds or changes a key carries reviewed es and ko values (R8 draft, F-I18N-001 §3.10 two-lens review, ledger re-signed) in the same PR.

### 3.7 [On device, owner]

- On a phone: draw ㅂ and ㅊ with a 3 s pause between every stroke; the letter is never scored until it is finished or Done is tapped, and the keep-going line shows during each pause.
- After a miss, add the missing stroke and finish; after a miss, Clear and redraw; both pass.

## 4. Out of scope

- The pass threshold, tolerance and scoring math (`logic/stroke-scoring.ts`). `TRACE_READY_STROKE_MIN` is a gate rule, not a pass rule.
- Stroke order data and order coaching: WO-03.
- Turning strict mode on anywhere.
- The `TRACE_IDLE_MS` value (1.5 s stays: it is now only the delay before a finished letter is accepted).
- Highlighting only the target strokes that still need ink after a miss (WO-02 decision 4, full form): follow-up, §10 D2.
- iOS VoiceOver does not honour `accessibilityLiveRegion`; the trace status lines are not announced there. VoiceOver and switch users cannot draw on the canvas and use Skip, which costs no star. Logged for WO-41 (accessibility polish), not changed here.

## 5. UI sketch

- Family 2 wireframe: `design/wireframes/minigame/families.md` (Trace Stroke row) and the shell, `design/wireframes/minigame/shell.md`. Look: `design/screens/minigame-writing/`.
- Row TI-0b (below) adds to `design/wireframes/minigame/families.md` a "Trace Stroke states" note — the keep-going line, the miss with ink kept, the pass with a tip and its Next button — and the matching mock in `design/screens/minigame-writing/`, approved by multi-agent review (CLAUDE.md §5).

## 6. Tests

Unit (`apps/mobile/src/logic/__tests__/`, fake scheduler):

1. `ready` false: lift, advance `TRACE_IDLE_MS * 10` → `onEvaluate` not called.
2. `ready` turns true on the last lift → evaluated once, `TRACE_IDLE_MS` after that lift.
3. `ready` omitted → today's behaviour.
4. `done()` with `ready` false → evaluated once.
5. **Table-driven, all of `jamoStrokes`:** for every jamo and every proper prefix of its authored strokes, `isFinished` is false; for the full authored set it is true. (Also guards any later stroke-data change: AU-14's, and WO-03's SO-2.) Checked on `d5ba0217c` with the real `scoreTrace`: no proper prefix of the 30 jamo has every stroke at 0.8 or more, and every full letter does, so the rule holds on the AU-14 data.
6. `wouldPass` matches today's pass expression for strict and non-strict.
7. Trace Word gate tests (`logic/trace-word/__tests__/evaluate.test.ts`) stay green; add letter mode: a 2-of-4-stroke ㅂ letter never evaluates on idle.

Screen (`screens/minigames/__tests__/`, testing-library, fake timers):

8. ㅂ, strokes 1–2 drawn (coverage 0.73), advance 10 s → no `answerRound`; the keep-going line shows after 3 s **and Done is enabled**; Done → scored. The same, no `answerRound` on idle, for ㅁ strokes 1–2 (0.82) and for ㅗ's tick alone (0.67), the two q2 letters AU-14 made early-scorable.
9. ㅂ, all strokes, advance 1.5 s → `answerRound(…, true)`.
10. Scribble, Done → `answerRound(…, false)`; advance 10 s → ink and retry line still there; a `hold` with no ink changes nothing; a new stroke → line back to idle, old ink kept, finishing the letter → pass (no second `answerRound` first-try entry).
11. Miss → Clear → draw the full letter → lift → pass after `TRACE_IDLE_MS`; and miss → Clear → draw → Done scores.
12. Pass with `pass.open` → no advance after 10 s; Next shown and focused; tap → next round. Clean pass → advance after 1.1 s.

Existing tests that change (TI-1 updates the first three, TI-2 the e2e and the wipe test):

- `screens/minigames/__tests__/trace-touch.test.tsx:261-272` ("cut off ... still scored") and `:325-339` ("dot after a stroke ... still scored after the idle wait"): rewritten on a **finished** drawing, or a 1-stroke jamo such as ㄱ (`GIYEOK`, `jamo-strokes.ts:78`), so KT-D9's "a dot re-arms the check" stays covered.
- `trace-touch.test.tsx:273-293` (the 1.8 s wipe; AMENDMENTS-TOUCH KT-8 review item 2): replaced by test 10.
- e2e `apps/mobile/e2e/web/trace-touch.spec.ts:47-68` ("the idle check scored the drawing"): draws a finished letter.

Coverage: `apps/mobile` business logic stays at or above 90 %.

## 7. Rollout

Next release. Effect to watch: quest stars on the trace-heavy quests (Stage 1 q2, q12; since AU-14 every multi-stroke letter in both can be idle-scored early, §1). The app does not emit per-round telemetry (`round.correct` / `round.wrong` are named in `TELEMETRY_EVENT_NAMES` but not emitted by mobile), so a per-round miss rate is not measured; no new telemetry is added.

## 8. Dependencies

- None blocking. WO-03 (`AMENDMENTS-STROKE-ORDER-STANDARD.md`) changes the same screen: merge this one first (both specs say so). Its SO-1 nulls `orderCorrect` for coaching only; `wouldPass` keeps the two consistent.
- AU-14 (merged in #1035) already changed the stroke data this spec measures; test 5 runs on whatever `jamoStrokes` holds, so a later SO-2 data change needs no edit here.

## 9. Rows

| Row | Model | Work | Tests | Depends on |
|---|---|---|---|---|
| TI-0b | Opus 5.5 | §5 wireframe note and mock; multi-agent review | — | this spec `ready` |
| TI-1 | Sonnet 5.5 | §3.1 `ready` option, `logic/trace-ready.ts`, Trace Stroke's gate, `createTraceWordGate` re-expressed; §3.5 comment | 1–7; the three `trace-touch.test.tsx` cases | this spec `ready` |
| TI-2 | Sonnet 5.5 | §3.2 keep-going, idle line; §3.3 miss keeps ink, Clear reopens, timers removed; §3.4 Next after a tip; §3.6 strings en + es + ko | 8–12; e2e | TI-1, TI-0b |
| TI-3 | Sonnet 5.5 | Trace Word letter and block mode on the §3.1 rule; `RETRY_MS` wipe removed; Next after a tip | 7 (letter mode), a Trace Word screen test for each | TI-1, TI-2 |
| TI-4 | Sonnet 5.5 | "Amended 2026-11-xx by AMENDMENTS-TRACE-IDLE" lines in F-004, F-008, AMENDMENTS-TOUCH, F-CURR-001; `docs/specs/README.md` index line; status `shipped` | — | TI-1 – TI-3 |

Branch `fix/trace-idle`. One commit = test + implementation.

## 10. Departures from WO-02 (accepted by the owner 2026-11-22)

- **D1 — the "finished" rule.** WO-02 decision 1 asks for "stroke count ≥ expected count". This spec uses coverage plus a per-stroke floor (§3.1) instead, because learners join strokes (ㅁ in one or two, though the data has had three since AU-14; ㄹ in one) and a count rule would leave a correctly finished letter waiting forever. The table-driven test 5 gives the guarantee the count rule was for: no proper prefix of any letter is ever auto-scored.
- **D2 — what stays after a miss.** WO-02 decision 4 asks to keep the correct strokes and highlight only the strokes to redraw. This spec keeps **all** the ink and lets the learner add to it (§3.3), which keeps the correct strokes; it does not yet highlight the missing target strokes. Reason: the highlight needs a new visual state on the guide and a design pass; `perStrokeCoverage` already holds the data, so it is a small follow-up row once the owner wants it.

## 11. Review log

- 2026-11-21, multi-agent review (two lenses: code truth; charter, learner and pedagogy). Adjudicated in revision 2:
  - Fixed, blockers: coverage alone fires before most letters are finished (17 of 20 multi-stroke jamo reach 0.65 early, measured with the real scorer) → per-stroke floor and table test (§3.1, test 5); Clear after a miss left the gate locked → Clear and a new stroke reopen it (§3.3, test 11).
  - Fixed, majors: Trace Word letter mode and its `RETRY_MS` wipe are in scope (TI-3), and §1's claim about Trace Word is corrected; es and ko are shipped locales, so strings land in all three (§3.6); the idle line that said "Lift your finger to finish" changes; tips after a pass wait for Next (§3.4); the keep-going line is not a `Feedback` value, so Done stays enabled; `ready()` reads refs; one `wouldPass` helper; KT-D9 restated (§3.5); the tests that break are listed (§6); WO-02 departures recorded (§10); the real-device check is an acceptance criterion (§3.7).
  - Fixed, minors: test 6 used ㅂ as a 3-stroke letter (it has 4); Done's enabled rule stated exactly; the untestable "press-look" removed; the wireframe path corrected and a design row added (TI-0b); full string keys; F-005 not amended, with the reason; "Amended by" lines and index (TI-4); the §7 metric reworded; the wipe happens on `start`, not `hold`.
  - Kept: the 1.5 s `TRACE_IDLE_MS`; coverage, not count, as the base of the rule (D1).
  - Moved: iOS VoiceOver live-region gap → WO-41 (§4).
- 2026-11-21, revision 3: re-based on `d5ba0217c` (main tip; 12 commits after `5573e1072`). Upstream touched the two files this spec cites most: AU-14 (#1035) rewrote `jamo-strokes.ts` (standard order and counts; ㅁ now 3 strokes), and QS-3 (#1038) and FU-3 (#1042) changed `TraceStrokeGame.tsx` (the first letter's sound waits for the screen; the sound slot learns its clip) — neither touched the gate, the scoring, the wipe timers, the idle line or Done. Verdicts: 1.5 s idle auto-score **still open**; first-try miss cost **still open** (QB-3 only spares a replayed step); Trace Word letter-mode `ready() = true` and block-mode ink-only gate **still open**; wipe timers (Trace Stroke 1.8 / 2.0 s, Trace Word `RETRY_MS`) **still open**; coverage reaching 0.65 before the last stroke **still open and wider**: re-measured 19 of 22 multi-stroke jamo (was 17 of 20), ㅂ's first 2 strokes still 0.73, new cases ㅁ 0.82, ㅗ tick 0.67, ㅈ 0.65. The 0.8 per-stroke floor still separates every proper prefix from every full letter on the new data. All line numbers updated (§1, §3, §6); test 8 gains the ㅁ and ㅗ cases; §7 and §8 note AU-14. No upstream helper replaces `trace-ready.ts`. D1 and D2 stand; neither is moot.
- 2026-11-22, review of revision 3 (code truth, against `5e84e0d85`): citations correct; probes re-run independently with the real `scoreTrace` and densified strokes match §1 (19 of 22 multi-stroke jamo reach 0.65 early; no proper prefix passes the 0.8 per-stroke floor, every full letter does). No blockers. Owner accepted D1 and D2 on 2026-11-22 → `ready`.
