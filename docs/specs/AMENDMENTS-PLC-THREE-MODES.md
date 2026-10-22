Status: ready (applied by F-PLC-001 P-0c)

> **Applied 2026-10-11 in the P-0c docs PR.** Every AM-n item below is now in the text of `F-PLC-001-placement-test.md` (each marked with its id) and every W-n item in `design/wireframes/placement/placement.md`. The line numbers below refer to `origin/main` `8232a00`, before this PR. This file stays as the record of the design, the measurements and the review response. The second review round on PR #199 (two independent reviews, section "Review response, round 2" at the end) changed AM-18, AM-20, AM-21, AM-22, AM-27, AM-28, AM-29, AM-30, AM-33, AM-37, AM-38, AM-39, AM-40 and AM-41 in both places; where this record and the spec ever differ, the spec text wins.

# Amendments to F-PLC-001: three check lengths — Short, Standard (default), Deep

**Owner request (2026-10-11, binding):** "테스트를 아이들이 할 수도 있어. 265개는 너무 많아. 테스트를 세분화해보자. 간단테스트 - 저연령 아이들을 위한 짧은 테스트 / 일반(default) - 5-10분 이내 끝낼 수 있도록 / 심층테스트 - 꼼꼼하게 진행하도록". The owner asked to proceed at production level: the recommended answers of the design run are taken as decisions **P14 to P20** (section 8 of the spec, AM-39).

**Standing owner decisions:**

- The service focuses on reading, listening and writing. Speaking is not measured and not shown, and nothing here adds speaking text.
- No learner surface names an age or says "for kids".
- Anti-shame rules: no per-question timer; unanswered means skipped, never wrong; positive nudges are allowed.

**State this amendment is written against (`origin/main` `8232a00`):**

- The placement engine P-1 to P-3 (#168), the bank P-4 (#177), the plan hand-off amendments AM-1 to AM-14 (#183).
- **P12 is approved** (#194): `content/placement/` is an owner-approved content directory.
- **The bank is production-reviewed** (#186): 260 templates, **all `ready`**, the 54 sentence and reply templates included (`reviewedBy: "ai-3-lens"`). So both sentence rungs run: Standard asks **12 to 24** questions and Standard and Deep can reach `stage3`.

**What "265" meant.** It was the template pool (now 260), not the length of a check. A run draws three questions per rung; the modes below set how many rungs run.

**Ids.** AM-1 to AM-14 exist (`AMENDMENTS-PLC-PLAN-HANDOFF.md`). This file adds **AM-15 to AM-42** (spec) and **W-1 to W-8** (wireframe). New decisions are **P14 to P20**.

## The three modes at a glance

Measured on the real engine with the P-3b change and the shipped bank (AM-42 has the method). "Guessers" are five tapping patterns: uniform, never the first card, and always slot 0, 1 or 2.

| Mode | Questions | Minutes, p50 / p90 | Guessers above band 0 (above band 1) | Ceiling | Default |
|---|---|---|---|---|---|
| **Short** | 6 to 9 | 3.0 / 4.0 at the *Pictures first* pace (all nine asked); 1.6 / 2.0 for "not sure" throughout | at most 0.20 % (0 %) | `stage1` band 1, at most q1 to q3 placed out | pre-selected for *Pictures first* while the route is at band 0 |
| **Standard** | 12 to 24 | 4.7 / 6.1 (intermediate), 5.8 / 7.5 (strong reader) at the *Some reading* pace | at most 3.2 % (at most 0.60 %) | `stage3` band 0 | every other case |
| **Deep** | 12 to 42 | 7.1 / 9.8 (intermediate), 10.3 / 13.3 (strong reader); a beginner 2.6 / 3.0 | at most 0.15 % (0 %) | `stage3` band 0 | never pre-selected |

---

## AM-15 — Title, header lines (lines 3 and 10)

Line 3, replace the title with:

> # F-PLC-001 — Placement (the level check): choose a test language and a length (Short, Standard or Deep), answer a short adaptive run, start the route at the right spot

Line 10 (`**Wireframes**`), replace the list in brackets with:

> (`invite`, `language`, `options`, `handoff`, `warmup`, `item`, `item-short`, `pause`, `sound-needed`, `result`, `report`, `home-entry`)

## AM-16 — Section 1 Context (lines 18 and 32)

Line 18, after "...the engine is shared with F-RVW-001." add:

> On 2026-10-11 the owner split the check into three lengths (P14): **Short** for learners who do not read yet (6 to 9 questions, every question starts from a sound and takes one tap), **Standard**, the default (12 to 24 questions, usually under 10 minutes), and **Deep**, a careful check that confirms every step that moves the route (12 to 42). D10's question count and time limit apply to Standard, as amended by P15 to P17.

Line 32, in "What this spec does", replace item (2) with:

> (2) a pure **adaptive placement engine** (rungs of three questions, run in one of three modes: Short 6 to 9 questions, Standard 12 to 24, Deep 12 to 42) with scoring, a level on the 7-stage grid and a mapping onto F-QUEST-002's Stage 1 quest list;

## AM-17 — Section 3.1 steps 1 and 2 (lines 53 and 54)

Step 1, replace "A small line says it takes about 4 to 6 minutes and can be stopped at any time." with:

> A small line says it takes a few minutes and can be stopped at any time (`invite.duration`; no digits).

Step 2, append:

> When the chosen test language has no instruction voice on this device (`hasVoiceFor(LOCALE_META[l].speechLang)`, a small addition to `platform/audio` in P-6; "unknown" counts as available, so it never blocks by mistake), the tile shows "No voice for this language here". It stays selectable for `en` and `es`, but Short is not available for that language (step 3).

## AM-18 — Section 3.1 step 3, Options (lines 55 to 59): replace the whole step

> 3. **Options (`placement/options`)** is a **grown-up screen**: whoever sets the check up uses it, and the learner then only listens, looks and taps. Every label on it is also spoken when tapped.
>    - **Mode** (P14): three equal radio tiles, **Short**, **Standard**, **Deep**. Each has a label, a one-line help (`options.mode.<m>.help`) and a duration line (`options.mode.<m>.duration`, hidden while *Take my time* is on). There is no "recommended" badge, and the tiles never say "easy", "hard", "test" or an age. The pre-selection (`flow.ts defaultMode(levelOrder, effectiveLevel, lastResult, shortAvailable)`) is:
>
>      The pre-selection is the **first rule that matches** (round 2): (1) the newest result is a Short whose report hint fired -> Standard; (2) the effective level is above `stage1` band 0 -> Standard (Short is never pre-selected at or above its ceiling; at `stage3` Standard is still pre-selected); (3) `levelOrder` 0 and Short available -> Short; (4) `levelOrder` 0 and Short not available -> Standard; (5) otherwise -> Standard. Deep is never pre-selected. Whenever Short is not available its tile is disabled with "The short check needs sound." A screen reader changes no mode (it only pre-sets *Take my time*).
>
>      Short is available when `shortAvailable(canPlayKorean(getCapability()), hasVoiceFor(LOCALE_META[testLocale].speechLang))` is true, read when the options screen opens (before the warm-up). `levelOrder` is a reading-level id (F-LEARN-001), not an age.
>    - **Layout for `levelOrder` 0.** Used only when Short is pre-selected: one pre-filled card shows it with a **Change** link, and one primary **Start** button with an icon. Nothing has to be read or chosen first. **Change** opens the full screen below (*Take my time* and *Why Korean?* live there). With Short there is no sound-guide question (section 3.2, P19). When Standard is pre-selected, a `levelOrder` 0 learner gets the full screen with the sound-guide question (round 2).
>    - **Tiles on small and wide screens** (round 2): side by side only at 480 pt or wider and a font scale of 1.3 or less, otherwise stacked; centred in `Screen width="reading"` on wide windows; radios with `selected` / `disabled` state, a disabled Short tile hints `options.mode.short.needsSound`.
>    - **Sound guide** (D2, OD-1 (c), AM-14), for Standard and Deep: asked first, with nothing pre-selected. NEXT stays disabled until one of *Always show it* or *Show it only when I tap* is chosen. Neither choice is recommended, highlighted or described as better. One neutral sentence states the consequence: "With the guide shown, the check looks at shapes and listening. With it hidden until you tap, it can also look at reading. Your own setting is not changed." The profile setting is never written.
>    - **Take my time** (switch, off): removes the inactivity pause and the backstop clock. Pre-set to on when a screen reader is on (`AccessibilityInfo.isScreenReaderEnabled()`, read in `platform/`).
>    - Optional **Why Korean?** four icon choices (my family, K-culture, just curious, a Korean friend; blueprint 02 section 2.2 step 2) + "Skip". It only sets the theme order of the route (blueprint 04 section 8.1).

## AM-19 — Section 3.1, new step 3a (after step 3)

> 3a. **Hand-off (`placement/handoff`)**, shown after options when Short is chosen or `levelOrder` is 0, in any mode. A large Hoya button and one spoken line, "Ready? Tap Hoya to start." (`learner.placement.handoff.ready`). Below it, one line for a grown-up, written and spoken once: "Helping? Let them choose. 'Not sure' is a fine answer." (`learner.placement.handoff.helper`). The screen has no age words and no shame words. Tapping Hoya opens the warm-up. Test: a `levelOrder` 0 learner goes from options to the warm-up only through controls that have a spoken label and an icon (`flow.test.ts`). Reason: a grown-up sitting beside a young learner is the most likely set-up, and a grown-up who answers for the learner makes a false high that the union rule keeps.

## AM-20 — Section 3.1 step 4, Warm-up (line 60): replace the last two sentences

Replace "It checks audio: ... shows a one-line "No sound here, so we will use pictures and reading". It is not recorded in the result." with:

> It checks audio. A `playPrompt` result of `unavailable` sets `config.audio = false` for the whole run (audio-required templates leave the draw; section 3.5).
>
> - In **Standard and Deep** for a learner who is not listen-first, a one-line note says "No sound here, so we will use pictures and reading".
> - In **Short**, and for a **listen-first** learner (`levelOrder` 0) in any mode, the run does not start. A grown-up screen (`placement/sound-needed`) shows an icon, "Turn on sound to play", **Try again**, **Start learning** (to `FirstQuestPreview` or Home, nothing recorded), and a link **Check without sound**. That link is the grown-up's explicit choice of Standard with listen-first off: it returns to the full options screen with Standard selected, Short disabled and the sound-guide question unanswered; the warm-up is not repeated (round 2).
>
> The warm-up's tap also unlocks audio for the run. Its word is passed to the engine as `avoidTags` (its `word:` tag), so no scored question repeats it. It is not recorded in the result.

## AM-21 — Section 3.1 step 5, Items (line 61): append

> **Short layout** (wireframe `item-short`; the engine is the same):
>
> - Portrait: nothing scrolls at 320 x 568 up to 200 % text. Landscape: two columns, fitting 568 x 320 at the default text size; where it cannot fit, the grid scrolls while the prompt and **I am not sure** stay pinned (round 2).
> - Four cards in 2 x 2 at `touchTarget.child` or larger. **I am not sure** has its own full-width row with a Hoya shrug icon and a spoken label.
> - The exit is an icon with a spoken label.
> - The prompt plays on open (the warm-up tap unlocked audio); the first item after a resume or a cold start plays on a tap of a large speaker. The choices are enabled on the playback end **or** after a fallback delay (estimated prompt length plus 3 s, at most 8 s); **I am not sure** and the exit are always enabled (if the prompt cannot play, section 3.11 applies; round 2).
> - The instruction is spoken only on the first item of each rung; later items play only the Korean prompt.
> - An answer is acknowledged by the footstep trail filling, with no "Got it" word.
> - Hoya cheers every 2 answers with effort-only lines (`learner.placement.cheerShort`, for example "Thanks for listening!"). That list may not contain "right", "correct", "got it", "perfect" or "great job" (copy test).
>
> **Listen-first** (`levelOrder` 0, every mode, and every Short run): only `LISTEN_FIRST_FORMATS = ['shape-odd-one-out', 'hear-pick-written', 'hear-pick-picture', 'read-pick-picture', 'reply-pick']` are drawn: every format except Latin sound chips (`see-pick-sound`) and tile building (`build-syllable`). The reading formats stay in, so a listen-first reader can reach `stage3` in Standard and Deep (round 2).

## AM-22 — Section 3.1 step 6, Pause (line 62): replace the step

> 6. **Pause (`placement/pause`).** It is spoken, with two large icon buttons (**Keep going** / **That is enough, start learning**) and the grown-up PIN link (`gateRequired`, F-LEARN-001; stop reason `grown-up`). It opens:
>    - after three "not sure" in a row (**not in Short**: Short is at most nine questions and its exit stays visible);
>    - after 45 seconds without any touch (unless *Take my time*; nothing is recorded for the open question, which is asked again on **Keep going**);
>    - when the learner opens the exit (engine event `exit`).
>
>    **Rest card (Deep only):** after 18 answers, when more rungs remain, a spoken, number-free card says "Hoya is stretching. Keep going?" with the same two buttons. It shows once per run.
>
>    The backstop clock stops while the pause sheet, the exit sheet or the rest card is open (**Keep going** moves the deadline by the time spent paused).

## AM-23 — Section 3.1 step 7, Result: replace the AM-14 paragraph (line 78)

> **Headline when reading was not tested (OD-1, default (c); AM-14).** For Standard and Deep the options screen asks first whether to show the sound guide, with no pre-selection (one more tap; D2 respected). When the decoding strands are `not-tested`, the result headline is **Here is a good place to start** (not "Hoya found your starting spot!"). It is followed by "We checked listening and shapes. To find where to start reading, try the check with the sound guide hidden." On a **self** profile a text button follows, **Try it with the sound guide hidden** (one-tap retake). On a **child** profile no text button is shown to the learner; the retake offer is on the parent report. The weekly-plan strip, when shown, sits below that line.
>
> **After a Short run.** When the report hint fires (section 3.9), a self profile also gets a quiet link, **Try the standard check**. A child profile gets nothing extra on this screen. A Short result never says the check is for younger learners.

## AM-24 — Section 3.2, the sound guide (lines 86 and 88)

Line 86, replace "**initialised from the profile setting** (the options screen shows it pre-selected and the learner may change it for this run only; the engine has no default of its own)" with:

> **chosen on the options screen for this run only, with nothing pre-selected** (OD-1 (c), AM-14; the engine has no default of its own), except in Short (below)

After line 88 (the `always` bullet), add:

> - **Short and the sound guide (P19).** Short asks no sound-guide question and runs with `revealMode: 'tap'` without a **Show how it sounds** button. While a Short question is open, the letter tiles of a `hear-pick-written` item show no romanization: the romanization would be the answer, and a learner who does not read yet cannot use it. Everything is shown after the run. This is the second narrow exception after assumption 13. (A Short run with `revealMode: 'always'` stays defined in the engine, 6 questions of words and shapes at `stage1` band 0, but the app never starts one.)

## AM-25 — Section 3.3, shared engine table, row `options.ts` (line 101): append to the rule

> Placement calls `placeCorrect(options, rng, false, recent)`: it keeps the "never the same slot three times in a row" rule but does not move the correct option off slot 0. Measured: with `avoidFirst = true` the correct option sits in slots 1 to 3 with probability 7/24 each, so a tapper who never picks the first card is placed above band 0 in 4.35 % of Standard runs (uniform guessing 3.2 %). With `false`, every tapping pattern stays at chance or below. The shared default stays `true` for reviews.

## AM-26 — Section 3.4, the bank (lines 177 and 180)

Line 177 (Validation), append before "**the bank has at least 40 ready templates per strand**":

> per-format pools the modes rely on (`PLACEMENT_MIN_FORMAT_READY` in `PlacementBankSchema`, next to the nine-per-gate rule): at least 6 ready `hear-pick-written` templates for each of `sound-basic`, `syl-cv`, `sound-rest` and `syl-cvc` (two listen-first draws), and at least 2 ready `build-syllable` for each of `syl-cv` and `syl-cvc` (Deep's tile item); the bank test also checks at least 3 ready `vocab` oral templates besides the warm-up's word;

Line 180 (Exclusions at draw time), replace with:

> - **Exclusions at draw time:** `requires.audio` when `config.audio` is false; `requires.picture` when the picture does not resolve (`PictureArt` resolver, F-QUEST-002 section 3.11; a text tile is never substituted); `leaks: true` when `revealMode === 'always'`; any format outside `LISTEN_FIRST_FORMATS` when the run is listen-first (Short, or `config.listenFirst`); any template carrying a tag in `config.avoidTags` (the warm-up's word); the ids of the learner's previous result (`exclude`), relaxed only when a rung would otherwise have fewer than three questions (so a retake may repeat items).

## AM-27 — Section 3.5, the adaptive engine

**Files** (line 187): add to `rungs.ts` the mode helpers `PLACEMENT_MODES`, `legacyLengthOf`, `modeOf`, `modeCeiling`, `questionCap`, `backstopMs`, `drawsFor`, `passAtFor`, `LISTEN_FIRST_FORMATS`, `DEEP_REST_AT`, and to `scoring.ts` `rowsPassed`.

**Run configuration** (lines 191 to 202), replace the block with:

```ts
export const PLACEMENT_MODES = ['short', 'standard', 'deep'] as const;   // placement/rungs.ts (a leaf; schemas import it)
export type PlacementMode = (typeof PLACEMENT_MODES)[number];

export interface PlacementConfig {
  mode: PlacementMode;               // short: 6-9 questions, no clock; standard: 12-24, 10 min; deep: 12-42, 20 min
  listenFirst?: boolean;             // levelOrder 0: LISTEN_FIRST_FORMATS only, in every mode (Short always)
  avoidTags?: readonly string[];     // the warm-up's word: never drawn
  revealMode: 'tap' | 'always';
  audio: boolean;                    // from the warm-up (`playPrompt` result) and canPlayKorean(getCapability())
  visual: boolean;                   // false with a screen reader: `recog` is not run
  takeMyTime: boolean;               // true: no inactivity pause, no backstop clock
  seed: number;                      // hashSeed([profileId, startedAt])
  exclude: string[];                 // template ids of the previous result
  resolvesPicture: (ref: string) => boolean;
}
```

The engine has no `quick` or `full` mode. Those words survive only as the stored `PlacementResult.length` (section 3.8).

**Order** (lines 216 to 222), replace items 1 to 5 with:

> **Short** (`nextRung`, `mode: 'short'`): `sound-basic` → `vocab` oral → `syl-cv` only if `sound-basic` passed. Letters come first and words sit between two decoding rungs, so a learner who knows a few letters but few words is not met by three "not sure" in a row, and no format runs six in a row. When `sound-basic` cannot run (sound guide shown), `recog` follows the words. With no sound neither `sound-basic` nor `vocab` oral can run, and Short asks nothing; the app never starts Short without sound (section 3.1 step 4) and `recordPlacement` never stores a result with zero responses.
>
> **Standard and Deep:**
>
> 1. Always ask rung 1 (if `visual`).
> 2. **Main steps**, in order: `sound-basic`, `syl-cv`, `sound-rest`, `syl-cvc`, `vocab` read, `sentence` read. Each is asked only while every step before it has passed (`rowsPassed`). The first step that does not pass ends the ladder.
> 3. **Confirming draws** (`drawsFor`):
>    - Standard: a `vocab` read pass is confirmed at once by a second, different draw of three (the `vocab` read pass places out every Stage 1 quest through the stage-lower rule, bypassing the per-quest cut-back).
>    - Deep: every main step is confirmed by a second draw, asked **after the next step's first draw** (so one format never runs six in a row). `sound-basic` is not confirmed when `syl-cv` did not pass, because it sets no level alone.
>    - Both draws must pass. A failed first draw ends the step at once. A second draw that is unavailable, or stopped mid-draw while still undecided, keeps the first pass (the report shows "not finished").
> 4. **Listening.**
>    - Standard: when the ladder stopped before `syl-cvc` passed, ask `vocab` oral then `sentence` oral. When `vocab` read did not pass, ask `vocab` oral once.
>    - Deep: a learner who did not pass `vocab` read gets the oral pair. A reader who passed it on both draws gets `sentence` oral only (or `vocab` oral while no sentence draw is available), so every Deep run measures listening without ending on six easy picture questions.
> 5. `audio === false` removes oral rungs and all `requires.audio` templates. A rung with fewer than three eligible templates is `not-run` with reason `unavailable` (never a fail).
>
> **Second draws.** Pre-built at `startRun` with their own seed (`[seed, gate, form, '2']`). They never repeat a template of the first draw, and they prefer templates whose symbol, syllable or word (`spreadKey`) the first draw did not touch, falling back to any unused template. A confirming `syl-cv` or `syl-cvc` draw holds one `build-syllable` item when one is eligible (not for a listen-first learner). A resumed run is identical.

**Length** (line 224), replace with:

> **Length.**
>
> - **Short:** 6 (`sound-basic` not passed) or 9.
> - **Standard:** floor `rung1 + rung2 + oral(6) = 12`; then 15, 18, 21 (fails `syl-cvc`; or fails `vocab` read and hears words once); 24 (passes `vocab` read twice and reads sentences, or fails the confirming `vocab` read and hears words once).
> - **Deep:** 12 to 42 (`recog` 3 + four confirmed decoding steps 24 + `vocab` read 6 + `sentence` read 6 + `sentence` oral 3).
> - **Runs shorter than the floor:** early exits, `visual === false`, `audio === false` and `revealMode === 'always'` (9 questions: recognition 3 + oral 6). The result lists what was not run and never treats it as a failure.

**Gate result** (line 226), replace the first sentence with:

> **Gate result (`gateResult(responses, asked, passAt = 2)`).** `correct` = unassisted correct answers. `pass` iff `correct >= passAt`; `fail` iff `correct + (3 - asked) < passAt`; otherwise `not-run`. `passAt` is 3 only for Short's `syl-cv` (`passAtFor`), and 2 everywhere else. The stored `result` is authoritative: no consumer recomputes pass or fail from `correct`. A gate/form with two rows (one per draw) passed when a row passed and none failed (`rowsPassed`).

**Stop reasons** (line 228), replace "`cap` (quick limit or 21 reached)" with:

> `cap` (the mode's longest run was reached: Standard 24, Deep 42; a Short run always ends `complete`)

**Clock** (line 230), replace with:

> **Clock (D3).** One backstop per run, started at the first scored question: **none for Short** (nine questions bound it), **10 minutes for Standard**, **20 minutes for Deep**, and none with *Take my time*. It is not displayed, and it **stops while the pause sheet, the exit sheet or Deep's rest card is open**. When it expires the current question may be answered; then the run ends with `time`. No question is ever marked wrong because of time, and the result is computed from what was asked. The 45-second inactivity pause (screen 5) is session-level, not a question timer: it records nothing and ends nothing.

**Pure run API** (line 237), replace the `apply` events comment with:

> `// events: answer{optionId, assisted} | notSure | idle | tick | touch | exit | quit{by} | keepGoing`

and append to the paragraph after the block:

> `pause` is one of `not-sure`, `idle`, `rest` (Deep) or `exit`; the run state's config holds `mode` and `listenFirst` (still `version: 1`; no run state is stored anywhere before P-5).

## AM-28 — Section 3.6, scoring and level

Line 245 (strand status), append:

> A strand's gate may have two rows (one per draw); it counts as passed only when `rowsPassed` holds.

Line 258, replace "**Listening level** `oral: StageKey | null`: `stage2` if `vocab` oral passed, `stage3` if `sentence` oral also passed, else `stage1`; `null` when no oral rung ran." with:

> **Listening level** `oral: StageKey | null`: `stage2` if `vocab` oral passed, `stage3` if `sentence` oral also passed, else `stage1`; `null` when no oral rung ran. A Deep reader who passed `vocab` read is asked `sentence` oral only; with no `vocab` oral row, the read pass stands in for it.

After the level table (after line 256), add:

> **Ceilings by mode.** Short stops after `syl-cv`, so its level is at most `stage1` band 1 and it places out at most q1 to q3 (`modeCeiling`). Standard and Deep can reach `stage3` band 0. The item accuracy at which a rung passes half the time is 0.50 for 2 of 3, 0.64 for 2 of 3 on two draws (Deep; Standard's `vocab` read) and 0.79 for 3 of 3 (Short's `syl-cv`): the modes set different bars on purpose. Measured: the intermediate learner of appendix D is placed above band 2 in 23.5 % of Deep runs and 49.0 % of Standard runs. Results combine by the maximum (section 3.7), so a stricter later run cannot correct an earlier, higher result.

## AM-29 — Section 3.7, route seed

Line 305 (Priority tokens), replace with:

> - **Priority tokens** (at most three, in this order): symbols answered wrong, then skipped, then assisted; `skill:blending` when `syl-cv` or `syl-cvc` has a `fail` row with fewer than two correct after its `sound-*` passed (a strict-rule fail with 2 correct, Short's `syl-cv` 2 of 3, adds no blending token); `skill:finals` when `syl-cvc` has such a row.

Line 308 (Effective route), replace "priority tokens and theme order come from the newest result; `level` is the highest ever reached." with:

> `level` is the highest ever reached; `oralStage` is the **highest any result measured** (`null` only when none did); priority tokens come from the **newest result whose mode ceiling was above the level already reached when it was taken** (a Short taken at band 1 or higher does not replace them); the theme order comes from the newest motivation. Results combine by the maximum, never by "the more careful mode" (P20). A stored result's mode is read with `modeOf(result) = result.mode ?? (result.length === 'quick' ? 'short' : 'standard')`.

## AM-30 — Section 3.8, data

In the `PlacementResultSchema` block (lines 339, 342, 343), replace the three lines with:

```ts
  testLocale: UiLocaleSchema, length: z.enum(['quick', 'full']),   // unchanged: legacyLengthOf(mode), short -> quick, standard and deep -> full
  mode: PlacementModeSchema.optional(),                             // P14; absent on results written before the modes
  revealMode: z.enum(['tap', 'always']),
  ...
  responses: z.array(AssessmentResponseSchema).max(48),            // Deep asks up to 42; Short and Standard stay within 24
  gates: z.array(GateResultSchema).max(16),                         // Deep stores one row per draw (up to 15); Short and Standard stay within 9
```

`GateResultSchema` and `PlacementSummarySchema` are unchanged (the summary gets no `mode`: it carries statuses and the level only, F-TCH-001 section 3.2).

After the "No migration, no new route" bullet (line 357), add:

> - **Modes and old readers.**
>   - Every Short and Standard result also parses with the pre-change schema (test against a frozen copy, `fixtures/placement-result-schema-v1.ts`, on the engine's real output). An old reader drops `mode`, and `modeOf` recovers it.
>   - A Deep result with more than 24 responses or 9 rows is rejected by an older Worker: a 422 for the whole snapshot PUT. Measured: 84 % of intermediate and 99 % of strong-reader Deep results (16 % and 1 % parse; corrected in round 2).
>   - No Worker rollback past P-3b once a build that sets `mode` has shipped. Older app builds reject a whole backup file holding a long Deep result, so the flag flip (P-10) waits for a store build with P-3b's schema one release earlier (round 2).
>   - So the Worker carrying `mode` and the 48 / 16 bounds is deployed **before any app build that sets `mode`** (P-3b, a gate for P-5). No `PlacementResult` is stored anywhere yet (`flags.placementEnabled` is off), so relaxing the bounds breaks no stored data.
>   - A copy stripped of `mode` by an older Worker stays readable: the report groups rows by gate/form through `rowsPassed`, so a Deep result without `mode` renders like a Standard one with two-row rungs.
>   - Test in `packages/backend/src/__tests__/sync.test.ts`: PUT a 42-response Deep result with `mode` next to a legacy result, GET them, and check that every response and `mode` survive.

Line 360 (Size), replace with:

> - **Size.** A result is about 2 KB (24 responses), or about 4 KB for a long Deep run (42); ten are kept.

## AM-31 — Section 3.9, grown-up surfaces

Line 366, replace "numbers are allowed here and framed as growth ("3 of 3 on the first try" per rung)" with:

> numbers are allowed here and framed as growth ("3 of 3" per rung) for Short and Standard. A **Deep** rung shows a status word, plus "checked twice" when both draws ran, or "not finished" when the confirming draw was stopped. Deep never shows counts out of 6 and never says "first time" or "first try" (the second draw is new questions, not a retry).

Line 367 (what was not tested), append:

> For Short: "Shapes of letters and sentences are not part of the short check". The recognition and sentences strands show *not tested (short check)*, never "not yet".

After line 368 (skills note), add:

> - **Spelling with tiles** (Deep): when a `build-syllable` item was asked, a status word from those responses (all correct → *secure*, some → *getting there*, none → *not yet*). The format is found by looking the response id up in the bank (`placement.generated.ts`); an id not in the bank is skipped. It is not a strand and never changes the route.

Line 372 (Take the check again), replace with:

> - **Take the check again** (→ section 3.1 flow, `source: 'parent'`; the mode is pre-selected by `defaultMode`). **Short hint:** when `modeOf(result) === 'short'`, `sound-basic` passed and the `syl-cv` row has at least 2 correct (band 1, or band 0 caused only by the 3-of-3 rule), the report says "The short check looks at the first letters only. The standard check can find a later starting spot." and offers **Try the standard check**. There is no offer of the Deep check after a Standard result: results combine by the maximum, so Deep cannot correct an earlier, higher result (P20).

## AM-32 — Section 3.11, offline, audio and errors (line 390)

Replace "fewer than 12 eligible templates for the chosen options -> the options screen says what is limited ("This device cannot play Korean sound, so we will use pictures and reading") and runs the shorter set;" with:

> fewer eligible templates than the mode's floor:
>
> - **Standard or Deep for a learner who is not listen-first:** the options screen says what is limited ("This device cannot play Korean sound, so we will use pictures and reading") and runs the shorter set.
> - **Short, or any listen-first run, without sound:** it does not start, and the grown-up screen `placement/sound-needed` is shown (section 3.1 step 4).
> - **No voice for the instruction language:** Short is disabled for that language (step 2).
>
> `recordPlacement` never stores a result with zero responses.

## AM-33 — Section 3.12, copy (line 399)

Replace "and no digit except in the allow-listed duration strings `invite.duration`, `options.lengthQuick` and `options.lengthFull`)." with:

> and no digit except in the allow-listed duration strings `options.mode.standard.duration` and `options.mode.deep.duration`; `invite.duration` has no digit). The mode labels and help lines never name an age, a school year or "kids". `learner.placement.cheerShort` contains no success words ("right", "correct", "got it", "perfect", "great job"). `learner.placement.handoff.helper` is covered by the same scan.

Copy (English; Korean and Spanish follow F-I18N-001's review ledger). Round 2 writes every key as a full path under `learner.placement` (the grown-up options and sound-needed screens included) or `caregiver.placementReport`, and adds `learner.placement.options.cardTitle` / `.title` / `.howLong` / `.change`, `learner.placement.item.tapToHear`, `learner.placement.result.tryStandard`, `caregiver.placementReport.tryStandard` and `caregiver.placementReport.notTestedShort`; the spec's section 3.12 table is the full list.

| Key | English |
|---|---|
| `invite.duration` | It takes a few minutes. You can stop at any time. (2026-10-21, app-first-run: now "A short level check. You can stop at any time.", the sublabel of "I already know some Korean"; F-PLC-001 section 3.12 is current) |
| `options.mode.short.label` / `.help` / `.duration` / `.needsSound` | Short / A few picture and sound questions. / Just a few minutes. / The short check needs sound. |
| `options.mode.standard.label` / `.help` / `.duration` | Standard / Letters, sounds, words and sentences. / Usually under 10 minutes. |
| `options.mode.deep.label` / `.help` / `.duration` | Deep / More questions, to be extra sure. Hoya takes a break halfway. / Usually under 20 minutes. |
| `handoff.ready` / `handoff.helper` | Ready? Tap Hoya to start. / Helping? Let them choose. "Not sure" is a fine answer. |
| `rest.line` | Hoya is stretching. Keep going? |
| `soundNeeded.title` / `.tryAgain` / `.startLearning` / `.withoutSound` | Turn on sound to play / Try again / Start learning / Check without sound |
| `language.noVoice` | No voice for this language here |
| `cheerShort` (rotating) | Thanks for listening! / Nice and steady. / Hoya likes your listening. |
| `caregiver.placementReport.shortHint` | The short check looks at the first letters only. The standard check can find a later starting spot. |
| `caregiver.placementReport.shortNotTested` | Shapes of letters and sentences are not part of the short check. |
| `caregiver.placementReport.checkedTwice` / `.notFinished` / `.spellingTiles` | checked twice / not finished / Spelling with tiles |

Draft Korean and Spanish for the mode tiles (for the ledger): 짧게 / 보통 / 꼼꼼하게 · Corta / Normal / A fondo. The durations are approximations, not hard bounds: the backstop starts at the first scored question, lets the open question finish, stops while a sheet is open, and is off with *Take my time*.

## AM-34 — Section 3.13, telemetry (lines 405 and 407)

| Name | Payload | When |
|---|---|---|
| `placement.start` | `{ source, testLocale, length, mode, revealMode, level }` (`length` is the legacy `quick` \| `full`) | first scored question shown |
| `placement.complete` | `{ stopReason, asked, stage, band, oralStage, beyondContent, strandsSecure, mode }` | result computed |

No new names; `schemas/telemetry.ts` and its exact-list test are unchanged. The Worker stores payloads without validating them, so no deploy is needed for telemetry. The P-5 caller test asserts both payloads.

## AM-35 — Section 3.14, behaviours: append

- **Given** a *Pictures first* profile with no result and working sound, **when** options open, **then** one pre-filled card shows Short, **Start** needs no other choice, the hand-off speaks "Ready? Tap Hoya to start.", and the learner reaches the warm-up without reading any text.
- **Given** Short, **when** the learner answers, **then** the order is sounds, words, then syllables (only if the sounds passed); at most 9 questions; no "three not sure" sheet; no backstop; the level is at most `stage1` band 1.
- **Given** Short and `syl-cv` 2 of 3, **then** the stored row is `fail` with `correct: 2`, the level is band 0, no `skill:blending` token is added, and the parent report shows the Short hint.
- **Given** a *Pictures first* learner in any mode, **then** no `see-pick-sound` or `build-syllable` item is drawn.
- **Given** Short or a listen-first run and no sound at the warm-up, **then** the run does not start and the grown-up "Turn on sound to play" screen is shown; nothing is stored.
- **Given** Standard and a passed first `vocab` read draw, **then** a second, different draw follows at once, and the level is `stage2` only if both pass.
- **Given** Deep, **then** each confirming draw comes after the next rung's first draw, the rest card appears once after 18 answers, and a reader who passed `vocab` read hears sentences only.
- **Given** Deep and the learner stops after one wrong answer in a confirming draw, **then** that row is `not-run (stopped)`, the first pass stands, and the report shows "not finished".
- **Given** the exit sheet or the pause sheet is open, **then** the backstop does not run; **Keep going** moves the deadline by the time spent paused.
- **Given** a Short result at band 1 or higher already in the history, **when** a later Short finishes, **then** the priority tokens and the listening level of the route do not change.
- **Given** an older reader strips `mode`, **then** the result still parses, `modeOf` reads `quick` as Short and `full` as Standard, and the report scores two-row rungs correctly.

## AM-36 — Section 4, out of scope (line 438): append

> A free-writing scorer (no ghost letter, precision check, validated on real samples, about 20 per symbol group) is out of scope. Tracing measures copying (`TraceStrokeGame` draws a ghost letter, and `scoreTrace` scores coverage only), so it is not scored either. Deep's "Spelling with tiles" line is the only writing-side signal.

## AM-37 — Section 5, tests: replace or add these rows

| File | Level | Coverage |
|---|---|---|
| `…/placement-rungs.test.ts` | unit | `RUNG_TABLE`, `RUNG_SYMBOLS`; `PLACEMENT_MODES` and `PlacementModeSchema` share one tuple; `legacyLengthOf`, `modeOf`, `modeCeiling`, `questionCap` (null / 24 / 42), `backstopMs` (null / 10 / 20 min; Take my time null), `drawsFor`, `passAtFor`, `LISTEN_FIRST_FORMATS`, `DEEP_REST_AT` |
| `…/placement-plan.test.ts` | unit | Standard 12, 15, 18, 21, 24 (the `vocab` read confirmation; a failed confirmation hears words once; an unavailable second draw keeps the pass); Short 9 / 6, sound guide shown 6 (words, then shapes), no sound 0; Deep's delayed confirmation order, no `sound-basic` confirmation after a `syl-cv` fail, a failed confirmation ends the ladder, sentences-only listening, words while sentences are unavailable; every pass/fail mix within 6-9, 12-24 and 12-42 and no draw repeated |
| `…/placement-scoring.test.ts` | unit | `gateResult` with `passAt` 2 and 3; `rowsPassed` truth table; two-row `gatePassed`, level and strand; `oralStageOf` with the read pass standing in |
| `…/placement-run.test.ts` | unit | as before, plus: Short end to end (order, `quick` + `short`, `complete`); strict 2 of 3 is a stored fail without blending; no "three not sure" pause in Short; **no `see-pick-sound` or `build-syllable` for Short or for any listen-first run**; Short with no sound asks nothing (with and without a screen reader); listen-first with no sound asks shapes only; `avoidTags`; Deep: rows, rest card at 18, confirming draw with no shared template or spread key, one tile item, fallback and unavailable second draws, quitting inside a confirming draw (1 wrong: stopped and the pass stands; 2 wrong: fail); the backstop stops during the exit and pause sheets; **old reader: Short and Standard results parse with the frozen pre-change schema** |
| `…/placement-route-seed.test.ts` | unit | as before, plus: strict-rule fail adds no blending; Deep rows; `effectiveRoute` takes the highest `oralStage`; a Short at band 1+ (with or without `mode`) does not replace tokens; a Standard or Deep retake does |
| `…/placement-schema.test.ts` | unit | bounds 48 / 16; `length` still `quick` \| `full`; optional `mode` |
| `…/placement-bank-schema.test.ts` | unit | `PLACEMENT_MIN_FORMAT_READY`: 6 ready `hear-pick-written` per decoding gate, 2 ready `build-syllable` per syllable gate, drafts never count |
| `…/placement-simulated.test.ts` | integration | fixture bank, per mode, 1,000 seeded runs: Standard as before plus never-first and fixed-slot tappers at band 1 or lower in at least 97 %; Short 6-9, never above band 1, at most 3 placed out, any guesser above band 0 in at most 1 %; Deep any guesser above band 1 in at most 0.5 %, at most 42, advanced `stage3` at least 90 % with listening measured; "not sure" at band 0 in every mode |
| `…/placement-bank-modes.test.ts` (new) | content | the shipped bank through `scripts/build-placement-bank.mjs`, at most 200 runs per case: per-format minimums; Short with sound and a hidden guide always asks `sound-basic` and never the warm-up word; listen-first never meets chips or tiles; Standard's floor is 12, a perfect reader reaches `stage3` in Standard (24) and Deep (42); Deep's confirming syllable draw holds a tile item |
| `…/placement-modes-simulation.test.ts` (new) | integration | the mode table on the shipped bank with the time model of appendix D: seeded learners (five guessing patterns, not sure, intermediate, advanced) drive `startRun` / `apply` / `finishRun`, 300 runs per cell; per mode: question range, p90 minutes (Short at most 5, Standard at most 10, Deep at most 20), guesser false-high bounds, Short's ceiling and placed-out bound, Standard's intermediate `stage2` bound, Deep's higher bar than Standard, old-schema parsing |
| `packages/backend/src/__tests__/sync.test.ts` (extend) | integration | a 42-response Deep result with `mode` round-trips through `PUT` / `GET .../snapshot` next to a legacy result; 49 responses, 17 rows, an unknown `mode` or `length` are a 422 |
| `mobile/src/logic/placement/__tests__/*.test.ts` | unit, 100 % | `flow.ts`: `defaultMode` table, `shortAvailable(audio, voice)`, the `levelOrder` 0 card and hand-off (every control on the path to the warm-up has a spoken label and an icon), the sound-needed state, the sound-guide question asked only for Standard and Deep with NEXT disabled until answered. `copy.ts`: the new keys, the digit allow-list, no age words, the effort-only `cheerShort`. `result-view.ts`: hint rows (band 1; **`sound-basic` pass and `syl-cv` 2 of 3 → hint**; `sound-basic` fail → no hint); `modeOf` fallback; Deep rows grouped by gate/form; status words, no counts out of 6 for Deep; tiles line by bank lookup; AM-14 headline without a text button on a child profile |
| `mobile/src/store/__tests__/progress-store.test.ts` (extend) | integration | a result with zero responses is not stored |
| `apps/mobile/e2e/web/placement.spec.ts` (nightly) | e2e | as before, plus: a *Pictures first* Short run to the result without reading any text; a Deep run that shows the rest card |

## AM-38 — Section 6, rollout and PR breakdown

Beta measures (line 482), append:

> by mode: share chosen, median length, stop reasons, share ended by the backstop, how often the Short hint fires and is followed, `revealMode` per mode, and `see-pick-sound` accuracy by `testLocale`.

PR table (lines 488 to 498): add two rows and replace five.

| PR | Content | Size | Needs |
|---|---|---|---|
| P-0c | `docs`: three check lengths, `AMENDMENTS-PLC-THREE-MODES.md` applied (AM-15 to AM-42; P14 to P20), wireframe edits W-1 to W-8 (`options` rewritten, `handoff`, `item-short`, `sound-needed`, `pause` rest card, `result`, `report`) | S | — |
| **P-3b** | **`feat(content-schema)`: engine modes** — `rungs.ts`, `plan.ts`, `run.ts`, `run-state.ts`, `scoring.ts`, `route-seed.ts`, `schemas/placement.ts` (`mode`, 48 / 16, `PLACEMENT_MIN_FORMAT_READY`), their tests, `placement-bank-modes.test.ts`, `placement-modes-simulation.test.ts`, and the backend round-trip test. **Deploy the Worker before P-5 ships** | M | P-3 (#168), P-4 (#177), P-0c |
| P-5 | `feat(mobile)`: `logic/placement/` (flow with `defaultMode`, `shortAvailable`, hand-off and sound-needed states; copy; result view with `modeOf`, the Short hint and rows grouped by gate/form; cell look; home card), `placement-run-store`, `recordPlacement` (no zero-response result), `avoidTags` from the warm-up, merge / summarize / mission-builder changes, flag | M | P-3b **and the Worker deploy**, P-4 |
| P-6 | `feat(mobile)`: screens (language with the instruction-voice line; options as a grown-up screen with the `levelOrder` 0 card and the three mode tiles; hand-off; warm-up; item with the Short layout; pause with exit and rest; sound-needed; result), navigation, audio capability hooks and `platform/audio` `hasVoiceFor` | L | P-5, F-I18N-001 PR 4, F-AUDIO-004 A-4, OD-1 (AM-10, AM-14), wireframes W-1 to W-7 |
| P-7 | `feat(mobile)`: entry points (onboarding fork, Home card, Profile row; "Take the check again" pre-selects with `defaultMode`), Journey placed-out look and start pin | M | P-6, F-ROUTE-001 R-2a (`pin`, `check-circle` glyphs; AM-10) |
| P-8 | `feat(mobile)`: parent report (Short not-tested line and hint, Deep status words and "checked twice", Spelling with tiles by bank lookup, retake offer location by profile type), override, dashboard row | M | P-6, wireframe W-8 |
| P-10 | `test(e2e)` + flag flip for beta | S | P-7, P-7b, P-8, **the P-3b Worker deploy**, a store build with P-3b's schema shipped one release earlier (round 2) |

## AM-39 — Section 8, decisions

Line 508:

- In **D1**, replace "*Pictures first* only changes the default length" with "*Pictures first* only changes the default mode and makes the check listen-first".
- After the **D10** sentence add: "**D10 is amended by the owner request of 2026-10-11** (P14 to P17): three modes; Standard keeps the floor of 12, its ceiling becomes 24 and its backstop 10 minutes (the owner's "5 to 10 minutes"); Short is 6 to 9; Deep is 12 to 42."

Line 516, replace **P3** with:

> | P3 | *Replaced by P14.* | — |

Line 524, **P12**: unchanged (approved, #194).

Append to the table:

| # | Decision | Why |
|---|---|---|
| P14 | **Three modes: Short, Standard (default), Deep.** Defaults by `levelOrder` and the effective level, as an ordered first-match list; Deep is opt-in; Short is never pre-selected once the effective level is above `stage1` band 0. Stored as `length` (legacy `quick` / `full`) plus an optional `mode`. | Owner request 2026-10-11; old readers keep parsing Short and Standard results |
| P15 | **Short:** `sound-basic` → `vocab` oral → `syl-cv`; listen-first formats only; `syl-cv` needs 3 of 3; no "three not sure" sheet; no backstop; ceiling `stage1` band 1; does not start without sound. Below D10's floor at the owner's request: the band-1 evidence is the same `sound-basic` and `syl-cv` items as Standard's, and what it drops (recognition, sentence listening) the report names as not part of the short check. | A short, one-tap, spoken check for learners who do not read yet; it errs low because a false high is permanent (any guessing pattern above band 0 in at most 0.2 %, against about 2.5 % with 2 of 3) |
| P16 | **Standard:** the merged Full path; a `vocab` read pass is confirmed by a second draw (ceiling 24); 10-minute backstop. | The `vocab` read pass places out all of Stage 1; the second draw cuts the intermediate learner's `stage2`-or-higher false high from about 21 % to 9 %. A 12-minute backstop was considered: it would cut 2.1 % instead of 7.0 % of a rare learner (a *Pictures first* profile who reads sentences), and the label "Usually under 10 minutes" holds either way |
| P17 | **Deep:** every route-moving pass is confirmed by a second, different draw, asked after the next rung; listening for everyone (sentences only for a reader); a rest card after 18; up to 42 questions; 20-minute backstop; `responses` 48 and `gates` 16 before the first app write. | Thorough without six-in-a-row blocks or an easy tail; the Worker is deployed first |
| P18 | **Listen-first is a property of the learner** (`levelOrder` 0), applied in every mode. Test language `ko` is not listen-first by default (assumption 19). | The learner who tops out in Short must not meet Latin chips or tiles in the Standard retake |
| P19 | **Short and the sound guide:** no sound-guide question in Short; letter tiles hide romanization only while a Short question is open; everything is shown after the run. | The romanization is the answer and a learner who does not read yet cannot use it; without it, a grown-up who picks *Always show it* would get a 6-question Short that measures no reading |
| P20 | **Results combine by the maximum:** level and placed-out set as before; `oralStage` is the highest measured; priority tokens come from the newest result that could still move the route. No "check with Deep" offer after a Standard result. | Modes set different bars; a stricter later run must not erase richer evidence or pose as a correction |

## AM-40 — Section 9, unverified assumptions

Item 2, replace the last sentence with:

> Measured on the shipped bank with uniform, never-first and fixed-slot tappers (placement places the correct option without `avoidFirst`): Short above band 0 at most 0.2 %; Standard at band 1 or lower in more than 99 % and above band 0 in at most 3.2 %; Deep above band 1 0 %. The `sentence` read rung (two four-option items and one three-option reply) is passed by guessing with probability 0.19, not 0.156. Real learners guess differently; recalibrate from telemetry.

Item 3, replace "a larger rung would break the 21 ceiling" with "a larger rung would break Standard's 24 ceiling; Deep confirms each route-moving pass with a second draw instead".

Item 4, replace with:

> 4. **Time**: modelled per item (appendix D), including a fixed spoken overhead per rung and per cheer. Standard's p90 is 6.1 to 7.5 minutes at the *Some reading* pace and up to 10.8 at the *Pictures first* pace for a strong reader (7 % of those runs end with `time`, losing the `sentence` read rung). Short's p90 is 4.0 minutes at the *Pictures first* pace. Deep's p90 is up to 19.1 minutes for a strong reader at that pace (4.2 % end with `time`). Real timings come from `placement.item_answered.ms`; recalibrate after about 200 completed runs per level.

Item 11, replace with:

> 11. **D2 and the sound-guide choice (OD-1 default (c), AM-14).** Standard and Deep ask the sound-guide question first with no pre-selection. A learner who picks *Always show it* gets the *listening and shapes* check (recognition 3 + oral 6 = 9 questions; `stage1` band 0; decoding strands `not-tested`), a documented exception to the floor, and the AM-14 headline. Short asks no such question (P19).

Append:

> 18. **A helping grown-up** is the most realistic source of false-high results for young learners. The hand-off line asks them to let the learner choose; nothing can enforce it. Beta: compare quest-1 accuracy of placed-out Short learners with others.
> 19. **Listen-first for `testLocale: 'ko'`** is not assumed. Revisit when beta shows `see-pick-sound` accuracy by test language.
> 20. **The 4-card Short layout fits 320 x 568 without scrolling** in portrait up to 200 % text, and in landscape at the default text size with two columns; the `item-short` wireframe shows both, and P-6 verifies them in Playwright (round 2).
> 21. **Retakes may repeat items.** The previous result's ids are excluded only while each rung still has three questions; a repeated item is a small practice effect, and under the union rule it pushes upward.

## AM-41 — Appendix C, rung and path summary: replace

```
SHORT (levelOrder 0 default; listen-first; no "not sure" sheet; no clock)
  sound-basic   hear-pick-written           3   fail -> vocab oral, end
  vocab oral    hear-pick-picture           3   (warm-up word avoided)
  syl-cv        hear-pick-written, 3 of 3   3   only if sound-basic passed
  paths: 6 · 9 (no sound: does not start)

STANDARD (default)
  recog, sound-basic, syl-cv, sound-rest, syl-cvc   3 each, ladder ends at the first not passed
  vocab read     x2 (second draw at once)   3+3  only if syl-cvc passed
  sentence read                              3   only if vocab read passed twice
  oral pair      vocab oral, sentence oral   6   when the ladder stopped before syl-cvc passed
  vocab oral                                 3   once, after a vocab read that did not pass
  paths: 12 · 15 · 18 · 21 · 24

DEEP (opt-in; rest card after 18)
  recog 3; then sound-basic, syl-cv, sound-rest, syl-cvc, vocab read, sentence read: 3+3 each,
  the second draw after the next step's first draw (sound-basic not confirmed when syl-cv did not pass);
  sentence read's second draw right after vocab read's second draw; a step asked before an earlier
  confirmation failed is stored but not passed (stepPassed)
  listening: oral pair if vocab read not passed; else sentence oral only (vocab oral while no sentence draw)
  paths: 12 to 42
```

## AM-42 — Appendix D: append

> **Three modes (P14 to P17), measured 2026-10-11.** The real engine with the P-3b change (`startRun`, `apply`, `finishRun`), the shipped bank (260 ready), the 15-quest fixture, 2,000 seeded runs per mode x learner x pace, `revealMode: 'tap'`, audio and visual on, `takeMyTime` off, the warm-up word avoided, listen-first at the *Pictures first* pace, the backstop live. Every result was parsed as the engine wrote it, with the new schema and with a frozen copy of the pre-change schema. `placement-modes-simulation.test.ts` re-runs the same model at 300 runs per cell in CI.
>
> **Learners.** A learner *knows* an item with probability p per rung; otherwise taps "not sure" with probability u, else guesses. Guessers (p 0, u 0): uniform, never the first card, always slot 0 / 1 / 2. Not sure (u 1). Intermediate, true level about band 2: `recog` .95, `sound-basic` .92, `syl-cv` .88, `sound-rest` .8, `syl-cvc` .45, `vocab` read .35, `vocab` oral .6, `sentence` read .25, `sentence` oral .4, u .4. Advanced: .97 everywhere, u .5.
>
> **Time model.** Seconds per answered item at the *Some reading* pace: `shape-odd-one-out` 7, `hear-pick-written` 9, `see-pick-sound` 9, `build-syllable` 14, word `hear-pick-picture` 8, sentence `hear-pick-picture` 11, word `read-pick-picture` 10, sentence `read-pick-picture` 14, `reply-pick` 15, "not sure" 5; x1.5 *Pictures first*, x0.8 *Reads easily*; per-learner speed lognormal (σ 0.25), per-item noise lognormal (σ 0.35); plus 1.5 s per transition, 2.5 s of spoken instruction on the first item of each rung, a 2 s cheer every 2 answers (Short) or 3 (others), 8 s per pause sheet, 10 s for Deep's rest card and 30 s of warm-up. The options, language and hand-off screens are not counted.
>
> | Mode | Learner | Asked | p50 / p90 min | Levels | Above band 0 / above band 1 |
> |---|---|---|---|---|---|
> | Short (*Pictures first*) | guessers (worst of five) | 6-9 | 2.3 / 3.2 | band 0 99.8 % | 0.20 % / 0 % |
> | Short | not sure | 6 | 1.6 / 2.0 | band 0 100 % | 0 / 0 |
> | Short | intermediate | 9 | 3.0 / 3.8 | band 0 27.6 %, band 1 72.3 % | — |
> | Short | advanced | 9 | 3.0 / 4.0 | band 0 6.1 %, band 1 93.9 % | — |
> | Standard (*Some reading*) | guessers (worst of five) | 12-21 | 3.0 / 4.0 | band 0 96.8 % | 3.2 % / 0.60 % |
> | Standard | not sure | 12 | 2.5 / 3.0 | band 0 100 % | 0 / 0 |
> | Standard | intermediate | 12-24 (mean 21.1) | 4.7 / 6.1 | band 2 39.1 %, band 3 39.9 %, `stage2` 6.1 %, `stage3` 3.0 % | — |
> | Standard | advanced | 12-24 (mean 23.9) | 5.8 / 7.5 | `stage3` 98.5 % | — |
> | Deep (*Some reading*) | guessers (worst of five) | 12-30 | 3.0 / 4.0 | band 0 99.8 % | 0.15 % / 0 % |
> | Deep | not sure | 12 | 2.6 / 3.0 | band 0 100 % | 0 / 0 |
> | Deep | intermediate | 12-42 (mean 31.3) | 7.1 / 9.8 | band 2 54.4 %, band 3 19.7 %, `stage2` 3.5 %, `stage3` 0.3 % | — |
> | Deep | advanced | 12-42 (mean 41.6) | 10.3 / 13.3 | `stage3` 97.7 % | — |
>
> - **Short is conservative.** No run placed above band 1 or more than three quests out. The report hint (section 3.9) reaches 97.0 % of the intermediate runs (72.3 % at band 1 plus 24.7 % held at band 0 only by the 3-of-3 rule) and 99.7 % of the advanced ones; a uniform guesser triggers it in 2.8 %.
> - **Standard's second `vocab` read draw** puts the intermediate learner at `stage2` or higher in 9.0 % of runs; with one draw it is about 21 % (9.0 % / 0.42, the chance of passing the second draw).
> - **Deep sets a higher bar:** the intermediate learner is above band 2 in 23.5 % of Deep runs and 49.0 % of Standard runs. The rest card appears in 94 % (intermediate) and 99 % (advanced) of runs.
> - **By pace (p50 / p90 minutes; share ended by the backstop).** Standard, *Pictures first*: intermediate 6.2 / 8.4 (1.0 %), advanced 7.8 / 10.8 (7.0 %); *Reads easily*: 4.1 / 5.3 and 5.0 / 6.3 (0 %). Deep, *Pictures first*: intermediate 9.3 / 13.1 (0.4 %), advanced 13.7 / 19.1 (4.2 %); *Reads easily*: 6.2 / 8.4 and 8.7 / 11.1 (0 %). Short, *Some reading* and *Reads easily*: 2.3 / 2.9 and 2.1 / 2.6.
> - **Listen-first:** no Standard or Deep run of a *Pictures first* learner drew `see-pick-sound` or `build-syllable`.
> - **Old readers:** 100 % of Short and Standard results parse with the pre-change schema; Deep results parse when they end early (guessers, beginners), and 16 % (intermediate) and 1 % (advanced) otherwise.
> - **`avoidFirst`.** With the shared default `true`, the worst tapping pattern reached 4.35 % above band 0 and 1.30 % above band 1 in Standard and 0.65 % above band 0 in Short; hence `false` for placement (AM-25).

---

## Wireframe edits (`design/wireframes/placement/placement.md`)

### W-1 — Header (lines 8 to 21, 31)

Add to the screen list: "C3. Hand-off (`placement/handoff`)", "E2. Short items (`placement/item`, Short layout, promoted as `item-short`)", "F2. Rest card (`placement/pause`, Deep)", "L2. Sound needed (`placement/sound-needed`)". Replace the screen goal with:

> "Find a good starting spot in a few minutes (Short), usually under ten (Standard) or carefully (Deep), in the learner's own language, without a single number or a wrong-answer sound, and without taking anything away from the route they already have."

### W-2 — A. Fork (line 50)

Replace `about 4 to 6 minutes` with `a few minutes`.

### W-3 — C. Options (lines 83 to 106): replace the section

```
C1. Pictures first (levelOrder 0) — one pre-filled card; a grown-up screen, every label spoken on tap
┌──────────────────────────────────┐
│ [<]  "Set up the check" (hear)    │
│ ┌───────────────────────────────┐ │
│ │ [icon: ear] Short              │ │  <- pre-selected; help + duration lines
│ │ picture and sound questions    │ │
│ │ just a few minutes   [ Change ]│ │  <- opens C2
│ └───────────────────────────────┘ │
│ [[ (icon) START ]]                │  <- nothing else to read or choose -> C3 hand-off
└──────────────────────────────────┘

C2. Everyone else, or after Change
┌──────────────────────────────────┐
│ [<]  "A few choices" (hear)       │
│ How long?                         │
│ ┌────────┐ ┌────────┐ ┌────────┐  │
│ │ Short  │ │Standard│ │ Deep   │  │  <- three equal tiles; one pre-selected; no badge
│ │ (help) │ │ (help) │ │ (help) │  │     duration line under each, hidden with Take my time
│ └────────┘ └────────┘ └────────┘  │     Short disabled + "needs sound" line when no sound/voice
│ Sound guide (Standard and Deep)   │  <- asked first, nothing pre-selected (AM-14)
│  ( ) Always show it               │
│  ( ) Show it only when I tap      │
│  one neutral line (consequence)   │
│ [ ] Take my time (no time limits) │  <- on by default with a screen reader
│ Why Korean? (optional) [family] [K-culture] [curious] [friend] [ Skip ]
│ [[ NEXT ]]                        │  <- disabled until the sound guide is answered (Standard, Deep)
└──────────────────────────────────┘
```

- Every label is spoken when tapped. No age, no "kids", no "easy" or "hard", no "test".
- NEXT → C3 when Short is chosen or `levelOrder` is 0, else → D.

### W-4 — New C3. Hand-off and new E2. Short items (insert after C and after E)

```
C3. Hand-off
┌──────────────────────────────────┐
│                                   │
│        [[ (Hoya, big) ]]          │  <- the whole Hoya is the button; spoken:
│   "Ready? Tap Hoya to start."     │     "Ready? Tap Hoya to start."
│                                   │
│  for a grown-up, written + spoken │
│  once: "Helping? Let them choose. │
│  'Not sure' is a fine answer."    │
└──────────────────────────────────┘

E2. Short items (fits 320 x 568 and landscape without scrolling)
┌──────────────────────────────────┐
│ [(icon) exit] (spoken label)      │  <- opens F as an exit pause
│ [Hoya]  (speaker, plays on open)  │  <- instruction spoken on the first item of a rung only
│ ┌────────────┐ ┌────────────┐     │
│ │   card     │ │   card     │     │  <- 2 x 2, >= touchTarget.child;
│ └────────────┘ └────────────┘     │     enabled after the prompt's first full play
│ ┌────────────┐ ┌────────────┐     │
│ │   card     │ │   card     │     │
│ └────────────┘ └────────────┘     │
│ [ (shrug) I am not sure ] (spoken)│  <- its own full-width row, large, never red
│  footsteps: · · ·                 │  <- the only acknowledgement (no "Got it" word)
└──────────────────────────────────┘
```

- Hoya cheers every 2 answers with an effort-only line ("Thanks for listening!").
- No Latin sound chips and no tile building in Short, or for any *Pictures first* learner in any mode.
- No "three not sure" sheet in Short.

### W-5 — B. Test language, D. Warm-up (line 125) and new L2. Sound needed

B. Test language: add the line `[ no voice for this language here ]` under a tile whose instruction voice is missing. Short is unavailable for that language.

Replace the first sentence of the D note with:

> Not scored. Its tap unlocks audio for the run. If the sound cannot play: in Standard or Deep for a learner who is not listen-first, a line says the check will use pictures and reading; in Short, or for a listen-first learner, L2 opens instead.

```
L2. Sound needed (a grown-up screen)
┌──────────────────────────────────┐
│ [icon: speaker off]               │
│ "Turn on sound to play"           │
│ [[ TRY AGAIN ]]                   │
│ [ Start learning ]                │  <- nothing is stored
│  Check without sound   (link)     │  <- Standard, listen-first off
└──────────────────────────────────┘
```

### W-6 — F. Pause (lines 169 to 182)

- Replace `<- after three "not sure", or from the exit` with `<- after three "not sure" (not in Short), 45 s untouched, or from the exit`.
- Draw the two main buttons with icons.
- Add the rest card:

```
F2. Rest card (Deep, once, after 18 answers)
┌──────────────────────────────────┐
│ [Hoya stretching]                 │
│ "Hoya is stretching. Keep going?" │  <- spoken; no number
│ [[ (icon) KEEP GOING ]]           │
│ [ (icon) That is enough, start learning ]
└──────────────────────────────────┘
```

- Add: "The hidden backstop clock does not run while F or F2 is open."

### W-7 — G. Result (line 206): append

> After a Short run: no text to read for a child. "Hoya found your starting spot!", or "Here is a good place to start" when reading was not tested. A self profile also gets the quiet link "Try the standard check" when the Short hint fires. Never "for younger learners".

### W-8 — J. Parent report (lines 237 to 266)

- Under "What we saw", add two rows:
  - `Short: "Shapes of letters and sentences are not part of the short check" — both rows read *not tested (short check)*`
  - `Deep: each rung "secure, checked twice" | "not finished"; "Spelling with tiles  getting there" when a tile item was asked`
- Replace `numbers allowed here, framed as growth ("3 of 3 on the first try")` with `numbers allowed for Short and Standard, framed as growth ("3 of 3"); Deep shows status words only`.
- Under `[[ TAKE THE CHECK AGAIN ]]`, add `after a Short with the hint: "The short check looks at the first letters only. The standard check can find a later starting spot." [ Try the standard check ]`.
- Open questions (lines 316 to 321): replace the first two with "Should `testLocale: 'ko'` be listen-first? (default: no, until beta data)" and "Recalibrate the mode durations from `placement.item_answered.ms` after beta".

---

## Review response (three independent reviews of the design, 40 findings)

C = child lens, M = measurement lens, K = code lens. Every blocker and major is fixed; minors are fixed unless a reason is given.

| # | Sev. | Finding | Response |
|---|---|---|---|
| C1 | blocker | A pre-reader cannot get through the options screen; the design contradicted AM-14 | **Fixed.** Options is a grown-up screen (AM-18); *Pictures first* gets one pre-filled card plus a spoken hand-off (AM-19); every label is spoken; AM-14 (c) followed; `flow.test` requirement "reaches the warm-up without reading" (AM-19, AM-37); P19. |
| C2 | major | Short's main audience is often never asked letters | **Fixed** by P19 (no sound-guide question in Short; tiles hide romanization while open). Child profiles get no learner-facing retake text (AM-23). |
| C3 | major | Three words first → "need a break?" at question 3 | **Fixed, both ways:** order sounds → words → syllables, and no "three not sure" sheet in Short (AM-22, AM-27). |
| C4 | major | The chip/tile ban was tied to the mode, not the learner | **Fixed** (P18, `listenFirst` in every mode; tested over all modes). "Short+" path not needed. `ko` listen-first **rejected for now**: most Korean-school learners read romanization, and there is no data; beta measures it (assumption 19). |
| C5 | major | No guidance for a helping grown-up | **Fixed:** hand-off helper line, copy key, copy scan, wireframe C3 (AM-19, AM-33, W-4). |
| C6 | major | Short with no sound has no working fallback | **Fixed:** Short does not start; grown-up sound-needed screen; no "reading" line; instruction-voice check at the language step (AM-17, AM-20, AM-32). |
| C7 | major | Deep is tiring | **Fixed:** confirming draws one rung later, rest card at 18, readers hear sentences only, break named in the help line (AM-22, AM-27, AM-33). |
| C8 | major | Short's backstop can only hurt; clock during pauses unspecified | **Fixed:** Short has no backstop; the clock stops during pause, exit and rest (engine `exit` event; run tests) (AM-27). |
| C9 | minor | Hint misses 2-of-3 band-0 learners | **Fixed** (as M1). |
| C10 | minor | "Hard bound" is false | **Fixed:** wording dropped; separate duration keys hidden with *Take my time*; "Usually under 10 minutes" (AM-18, AM-33). |
| C11 | minor | Deep "first time" wording | **Fixed:** status words plus "checked twice"; no counts out of 6 (AM-31). |
| C12 | minor | Short item-screen details | **Fixed, all six** (AM-21, W-4). |
| M1 | major | Hint does not fire for the under-placed | **Fixed:** `short && sound-basic passed && syl-cv correct >= 2` (AM-31); test row in AM-37. |
| M2 | major | Different cut scores; the Deep "closer look" offer is misleading | **Fixed:** offer removed; AM-28 states that Deep raises the bar and results combine by the maximum (P20). "Make Deep the only retake before a Standard result is applied" **rejected**: it holds back a finished result and adds a pending state for little gain. |
| M3 | major | Retakes are not monotonic for tokens and listening | **Fixed:** default precedence rule (AM-18), `oralStage` as the maximum, token source by ceiling (AM-29); tests. |
| M4 | major | OD-1 already defaults to (c) | **Fixed:** AM-14 (c) followed (AM-18, AM-24); `placement.start.revealMode` by `mode` measured in beta (AM-38). |
| M5 | major | Standard's `stage2` jump rests on 3 items | **Fixed** (second `vocab` read draw, P16). The alternative "cut-back at `stage2`" **rejected**: about half of strong readers slip once in 21 to 24 questions and would be sent back to a Stage 1 quest after "First words". |
| M6 | minor | Guessing is not uniform | **Fixed:** never-first and fixed-slot guessers in the simulations and CI; `avoidFirst = false` for placement (AM-25). |
| M7 | minor | The second draw is disjoint by id only | **Fixed:** fresh spread keys preferred; "retakes may repeat items" stated (AM-27, assumption 21). |
| M8 | minor | The D10 floor change was not argued | **Fixed:** rationale in P15; report lines for "not part of the short check" (AM-31); Standard's backstop recorded separately (P16). |
| M9 | minor | The encoding was never run | **Fixed:** `finishRun` writes `legacyLengthOf(mode)` and `mode`; frozen pre-change schema tested on real output. |
| M10 | minor | Short timings miss the spoken overhead | **Fixed:** overhead in the model (appendix D); Short p90 4.0; label "Just a few minutes". |
| M11 | minor | Conditional on #177 and the review | **Resolved:** #177 merged, P12 approved (#194), every template ready (#186). Sentence-read guess rate 0.19 recorded (AM-40). |
| K1 | major | The diff did not implement the encoding | **Fixed** in P-3b: `length` enum unchanged, real allow-list, no environment hook. |
| K2 | major | Short with no sound and a screen reader asks nothing | **Fixed:** Short needs sound (`shortAvailable`, AM-18); engine tests for both `visual` values; `recordPlacement` refuses zero responses (AM-32). |
| K3 | major | A dropped `mode` is lost for good | **Fixed:** `modeOf` fallback; rows grouped by gate/form; Worker before any app build that sets `mode`; backend round-trip test in P-3b (AM-30). |
| K4 | major | Five internal lengths | **Fixed:** the engine takes `mode` only (AM-27). |
| K5 | major | The second draw repeats symbols in 41 % of pairs | **Fixed:** fresh spread keys preferred; test: none shared over 40 seeds. |
| K6 | major | No per-format minimums | **Fixed** in `PlacementBankSchema` (`PLACEMENT_MIN_FORMAT_READY`) and the bank test (AM-26). Mirroring them in `scripts/placement-rules.mjs` **rejected**: that module holds per-template rules only by design; bank-level counts (the nine-per-gate rule, 40 per strand) live in the schema and the bank test, which CI runs on every content change. |
| K7 | minor | "Hard bound" | **Fixed** (as C10). |
| K8 | minor | Telemetry file | **Fixed:** names unchanged; payload rows in section 3.13 (AM-34). |
| K9 | minor | Bank-backed simulation location; fixture drift | **Fixed:** bank tests use the builder, as `placement-bank.test.ts` does; fixture `AUDIO_FORMATS` aligned with the bank's. |
| K10 | minor | A strict-rule fail adds blending | **Fixed:** the stored `result` is authoritative; the token needs `correct < 2` (AM-27, AM-29). |
| K11 | minor | Warm-up word repeated | **Fixed:** `avoidTags` (AM-20, AM-26). |
| K12 | minor | Tiles inferred from an id substring | **Fixed:** bank lookup at report time (AM-31). |
| K13 | minor | ESM cycle risk | **Fixed:** the tuple lives in `rungs.ts` (type-only imports), the schema imports it; `rowsPassed` in `scoring.ts`. |
| K14 | minor | `mode` on the summary | **Fixed:** left off (AM-30). |
| K15 | minor | Deep interrupted second draw | **Fixed:** rule documented, tested for 1 and 2 wrong, report "not finished" (AM-27, AM-31, AM-35). |
| K16 | minor | Sound-guide premise wrong | **Fixed:** restated against AM-14 (P19). |
| K17 | minor | Counts, `cap` skew, PR order | **Fixed:** Short ends `complete` (no cap label); PR order in AM-38. |

## Review response, round 2 (two independent reviews of PR #199, 23 findings)

A = first review, B = second review. No blockers. Every major is fixed. Minors are fixed unless a reason is given. The spec text is changed in the places named; the AM blocks above were updated to match.

| # | Sev. | Finding | Response |
|---|---|---|---|
| A1 | major | The `defaultMode` table overlapped, and its ceiling sentence excluded every mode at `stage3` | **Fixed:** an ordered first-match list (hint fired, above `stage1` band 0, `levelOrder` 0 with and without Short, otherwise); "Short is never pre-selected at or above its ceiling"; Standard stays pre-selected at `stage3`; flow test cases for the hint at band 0 and for `stage3` (section 3.1 step 3, section 5, P14). |
| A2 / B4 | major | Two paths reached Standard without the sound-guide choice | **Fixed:** C1 is used only when Short is pre-selected; otherwise a `levelOrder` 0 learner gets C2 with the question. **Check without sound** returns to C2 with Standard selected and the question unanswered, with no second warm-up. Flow tests assert that `revealMode` is never set without an explicit choice (section 3.1 steps 3 and 4, section 3.2, wireframes C, C3, L2). |
| A3 / B3 | major | `LISTEN_FIRST_FORMATS` was never listed, and its prose contradicted the measurements | **Fixed:** the exact tuple is in section 3.5 and pinned in the rungs test: every format except `see-pick-sound` and `build-syllable` (the same tuple as P-3b, #200). The prose is reworded. The plan test checks that a listen-first perfect reader reaches `stage3` in Standard and Deep. |
| A4 | major | Deep's delayed confirmation left an already-asked next step undefined after a failed confirmation | **Fixed:** that step is stored but counts as not passed everywhere, through one predicate, `stepPassed` (`scoring.ts`). The planner gives the oral pair, the strand is never *secure* from it, and the read pass never stands in for `vocab` oral. `sentence` read's second draw comes right after `vocab` read's. The full Deep order is written out. Plan and scoring test rows added (section 3.5 items 3 and 4, section 3.6, appendix C). P-3b (#200) implements `stepPassed`. |
| A5 / B2 (figure) | minor | Old-reader share was inverted (16 % rejected vs 16 % parse) | **Fixed:** 84 % of intermediate and 99 % of strong-reader Deep results are rejected by an older Worker (section 3.8, AM-30). |
| A6 | minor | Copy keys missing and namespaces mixed | **Fixed:** every key is a full path. The grown-up options and sound-needed screens live under `learner.placement`, so the copy scan covers them. Added `options.cardTitle` / `.title` / `.howLong` / `.change`, `item.tapToHear`, `result.tryStandard`, `caregiver.placementReport.tryStandard` and `.notTestedShort` (section 3.12). |
| A7 | minor | `shortAvailable` read `config.audio`, which is set only after the warm-up | **Fixed:** `shortAvailable(canPlayKorean(getCapability()), hasVoiceFor(...))`, read at options time. A later warm-up failure goes to `placement/sound-needed` (section 3.1 step 3). |
| A8 | minor | `complete` vs `cap` precedence unstated; the rest card's stop reason missing | **Fixed:** `cap` is stored when no rung is left and the longest path was asked; it never cuts a run short. This matches P-3b. **That is enough** on the idle pause, after the background or on the rest card stores `quit` (section 3.5, section 3.1 step 6, run test). |
| A9 | minor | "Can take up to 20 minutes" read as a hard bound; the Standard help line left out sentences | **Fixed:** "Usually under 20 minutes." and "Letters, sounds, words and sentences." (section 3.12, AM-33). |
| A10 | minor | The general rule still said the first prompt of a rung plays on tap | **Fixed:** prompts play on open in every mode; the first item after a resume or a cold start plays on tap (section 3.1 step 5). |
| A11 | minor | The wireframe's "Got it" line covered Short; P-6 depended on W-1 to W-6 only | **Fixed:** "(Short: the footstep trail only)". P-6 now depends on W-1 to W-7 and P-8 on W-8 (section 6, AM-38). |
| A12 | minor | A screen-reader row in the `defaultMode` table had no matching input | **Fixed:** the row is removed. A screen reader only pre-sets *Take my time* (section 3.1 step 3). |
| B1 | major | Builds released before P-3b reject a whole backup file that holds a long Deep result | **Fixed:** new bullet in section 3.8. P-10 now also needs a store build carrying P-3b's schema shipped one release earlier on iOS and Android. P-3b's schema test records that a 42-response Deep result fails the frozen pre-change schema. A v1-compatible export form was **not chosen**: it would make the stored record lossy for a short-lived compatibility window, and gating the flag costs nothing while no result is stored. |
| B2 | major | A Worker rollback past P-3b would stop all progress sync for affected learners | **Fixed:** "never roll the Worker back past P-3b once a build that sets `mode` has shipped" is in section 3.8 and on P-3b's row. The repository has no deploy runbook, so the rule lives in the spec, P-3b's PR body and the Worker deploy note. The row count "up to 15" is **kept**: when the `sentence` oral draw is unavailable (a not-run row), a Deep reader is asked `vocab` oral, which adds a 15th row. |
| B5 | major | The Short item screen could not fit 320 x 568 in landscape | **Fixed:** no scrolling in portrait up to 200 % text, and a two-column landscape layout that fits at the default text size; above that, the grid scrolls while the prompt and **I am not sure** stay pinned. Wireframe E2 adds the landscape variant, the States bullet exempts E2, and assumption 20 is widened (section 3.1 step 5, W-4). |
| B6 | major | Short choices could stay disabled after a resume or a missing playback-end event | **Fixed:** the first item after a resume or a cold start plays on tap. Choices are enabled on the playback end or after a fallback delay (estimated length plus 3 s, at most 8 s). **I am not sure** and the exit are always enabled. Flow test row added. |
| B7 | minor | Three side-by-side tiles at 320 pt; no wide-window rule | **Fixed:** the tiles stack below 480 pt or above font scale 1.3. Content stays centred in `Screen width="reading"` (F-LAYOUT-001) instead of a new 560 pt constant (section 3.1 step 3, wireframe C). |
| B8 | minor | Accessibility of the new controls | **Fixed:** radio role and state, the disabled-tile hint, no auto-play with a screen reader (play on activation), and links at least `touchTarget.min` (section 3.12). |
| B9 | minor | Backgrounding was not covered by the backstop rule | **Fixed:** `AppState` `background` / `inactive` sends `exit`, and the pause sheet is shown on return. Run test added (section 3.1 step 6, section 3.5 Clock). |
| B10 | minor | The strict "above" token rule contradicted the test row "a Standard or Deep retake does" | **Fixed by narrowing the test row** to retakes below `stage3`. The "could still move the route" rule (P20) stays as implemented in P-3b. |
| B11 | minor | A brittle spread-key assertion; wrong backend test path | **Fixed:** "no shared spread key whenever at least three eligible fresh-key templates exist, and never a shared template id". The path is now `packages/backend/src/__tests__/sync.test.ts` (sections 3.8 and 5, AM-30). |
