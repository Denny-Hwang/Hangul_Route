# AMENDMENTS-MINIMAL-PAIRS — hear plain, aspirated and tense consonants apart, on approved clips only

Status: ready (multi-agent review 2026-11-25, §11; open decisions MP-OD-1 to MP-OD-8 adopted provisionally, §10). Written for work order WO-16 of `docs/roadmap/review-2026-11/phase-2-hangul.md`, row MP-0, on main `803208a95` (after #1126, the [SF] spec). The plan of the 2026-11 review was approved by the owner on 2026-11-22 (`docs/roadmap/review-2026-11/README.md` §4); WO-16 needs none of the decisions of that table. The owner said to proceed with the recommendations, so the open decisions of §10 are adopted provisionally.

**Amends** (each gets an "Amended 2026-11-25 by AMENDMENTS-MINIMAL-PAIRS [MP]" line in this PR):
- `F-QUEST-002-discover-check-stage1-complete.md`: §3.4 (a contrast step is never scored and never caps the stars), §3.6 (quest 6 gains a contrast step after its practice step) and §3.10 (Listen & Pick plays contrast rounds: clip only, skipped when a clip cannot play, unscored, a two-sound comparison on a miss).
- `F-AUDIO-004-korean-voice-quality.md`: AD4 (one exception to "MP3 > TTS > visible text": a contrast round plays its approved clip or is not played).
- `AMENDMENTS-AUDIO-CLIPS.md`: AC-B5 step 1 (the contrast catalogue is a manifest source) and §9 (a set gate after the per-clip gate, and a blind owner listen of each set, which, unlike the optional jamo listen, is required for a set to be played).
- `F-CURR-001-upper-stage-content.md`: §3.1 rule 1 and tests U-1 and U-6 (one optional contrast step may follow the practice step; Stage 2 Letters quest 2 gets one; its words are not counted by U-6).
- `AMENDMENTS-AUDIO-CANT-HEAR.md`: §3.1 (Listen & Pick's contrast round is guidance only, like the spelling round under the cue rule).
- `AMENDMENTS-DISCOVER-SOUND-FIRST.md`: SF-OD-5 (answered here, §3.11) and SF-OD-4 (practice now includes the contrast, in contrast rounds only).

**Not amended**: AU-OD-1 (a letter question says the letter's name) and Match Sound (§3.11). The quest Checks, the Hangul Check and every scored round: the contrast stays out of them (WO-16: "Check 에는 넣지 않는다"). The rule at `apps/mobile/src/logic/minigame-config.ts:710-712` (no option told apart only by its sound in a Check) and SF's series rule for the four Check rounds stay. The per-clip QA of AUDIO-CLIPS §9 is not changed; the set gate comes after it. The voice lock (one voice, Polly `Seoyeon`, AD11) is not changed.

**Why a new file.** WO-16 names it. Like `AMENDMENTS-AUDIO-CANT-HEAR.md` and `AMENDMENTS-DISCOVER-SOUND-FIRST.md`, it reaches across several specs (F-QUEST-002, F-AUDIO-004, AUDIO-CLIPS, F-CURR-001) and needs its own row table; the specs it amends get a tagged `[MP]` pointer.

**Scope (rows MP-1a, MP-1b, MP-2a, MP-2b, MP-3)**: see §9 for which row touches what.
- Clip pipeline (MP-1a, MP-1b, MP-3): `content/audio/contrast-sets.json` (new), `apps/mobile/scripts/audio/{content-sources,gen-audio-map,gen-contrast-sets}.mjs` (the last new), `scripts/audio/tts/{qa,qa-run,qa-lib,qa-report,recognizers,listen,listen-lib}.mjs`, `apps/mobile/src/content/__generated__/{contrast-sets.ts,audio-assets.ts,audio-packs/*}`, `content/audio/{tts-manifest,tts-lock}.json`, `pronunciation-overrides.json` (only if a new take needs it), `content/assets-license.csv`, the new MP3s, `docs/launch/owner-runbook.md` (§M), the e2e fixture approvals (`apps/mobile/e2e/fixtures/audio/contrast-sets.json`, new).
- Runtime (MP-2a): `packages/content-schema/src/schemas/minigame.ts` (`contrastSet`), `schemas/quest.ts` (`contrast` on a step), `schemas/lesson.ts` (the step-order rule), `src/review-items/extract.ts`; `apps/mobile/src/logic/audio/contrast-sets.ts` (new), `logic/audio/controller.ts` and `logic/audio/prompt-state.ts` (`clipOnly`), `components/use-prompt-slot.ts` (no text for a contrast round), `logic/scope-builders.ts` (`lp.pair`), `logic/listen-pick-flow.ts`, `screens/minigames/ListenPickGame.tsx`, `logic/lecture/deck-builder.ts`.
- Quest and content (MP-2b): `logic/quest-flow/skip-cap.ts`, `screens/quest/QuestPlayerView.tsx` (pass-by, the pacing index), `logic/lessons/lesson-lint-items.ts` (`questKnownAfter`), `logic/minigame-config.ts`, `content/quests.ts`, `content/episodes/stage-2/letters.json`, `content/i18n/{es,ko}/{stage1-quests,minigames,lessons-stage2-letters}.json`, `packages/i18n/src/messages/{en,es,ko}/{learner,a11y}.ts`, `packages/i18n/src/messages/review-ledger.json`, the generated lesson modules and catalogue.
- This PR: this file, the `[MP]` lines in the six specs above, `design/wireframes/minigame/listen-pick.md` (section [MP]), the index line.
- And the tests of §6.

**Owner**: solo dev
**Rollout**: next release; the rounds reach learners only as the owner approves each set (§3.3).

---

## 1. Context

### 1.1 Citations of WO-16, re-read on `803208a95`

Paths under `apps/mobile/src/` are written from `src/`.

| # | WO-16 says | On `803208a95` | Verdict |
|---|---|---|---|
| 1 | `logic/minigame-config.ts:710-713`: a comment leaves out options told apart only by sound (바 / 파, 어 / 오), "a device voice must not decide this Check" | the comment is `:710-712` (`'minigame:s1-crafts-q4-check'`), the rounds `:713` | correct |
| 2 | Stage 2 q2 (tense consonants) has only picture-word and dictation, no minimal pair | `quest:stage2-letters-q2` "Double Letters", `content/episodes/stage-2/letters.json:434`: practice Pic-Word Match (`:534`, scope `:563`), apply Card Match, Check Type the Word in hear mode (`:550`, scope `:781`: 빵, 딸기) | correct. That Check already asks the tense contrast by ear (writing 빵 from its clip); out of scope (§4, MP-OD-7) |
| 3 | clips are one voice (Polly Seoyeon) with forced-choice QA and an owner listen; `content/audio/pronunciation-overrides.json` records "바 heard as 파" and "까 heard as 가" | voice lock `content/audio/tts-voice-lock.json`; forced choice over the series (`scripts/audio/tts/qa-lib.mjs:59` `LETTER_SERIES`, used by `closedSetOf`; AUDIO-CLIPS §9 Pass 1); overrides `"바"` (`:31`, heard 파; now sent as `바!`), `"까"` (`:88`, heard 가; sent as `까,`), `"짜"` (`:94`, heard 자; sent as `짜!`). The owner listen is optional for passing clips and decides held ones (AUDIO-CLIPS §9) | correct |
| 4 | "Listen & Pick scopes" for q6 and Stage 2 q2 | quest 6 is `quest:stage1-life-q3` (`content/quests.ts:221`, teaches ㅋ ㅌ; Hoya: "k is like g with a puff of air", `:231`). Its practice step is **Match Sound** (`:250`, scope `logic/minigame-config.ts:329-334`); its Listen & Pick is the Check (`:346-354`). Stage 2 q2 has no Listen & Pick at all | **finding**: neither quest has a Listen & Pick practice step to add rounds to. Does not change the plan; decides where the rounds live (§3.5, MP-OD-1) |
| 5 | (implied) the rounds fit the quest | the six-step order is enforced for lesson quests (`packages/content-schema/src/schemas/lesson.ts:49` `LESSON_STEP_ORDER`, checked at `:346`) and for Stage 1 (`content/__tests__/stage1-curriculum.test.ts:44`, asserted in T4 at `:674`) | a new step needs F-CURR-001 §3.1 rule 1 amended (§3.5) |
| 6 | "별 계산에 영향이 없다" | every first answer of every step counts toward the stars: Listen & Pick reports through `host.answer` (`screens/minigames/ListenPickGame.tsx:272`), `answerRound` tallies it (`store/quest-run-store.ts:173-190`), `logic/quest-outcome.ts:31` turns the tally into stars; the same call feeds the memory store. Skipping a game step caps the stars (`logic/quest-flow/skip-cap.ts:31-45`), and every `practice` step's answers become review items (`packages/content-schema/src/review-items/extract.ts:196`) | an unscored step needs its own rule in each of these places (§3.8) |
| 7 | the clip pipeline (`docs/launch/owner-runbook.md` Step 12) | Step 12 (`:166-177`) is the owner's own recording path (T-017), optional since AU-OD-6. The live path is runbook §M (`:695`): M-2 generate in a separate terminal, M-6 two-pass QA by an agent (`audio:tts:qa`), M-4 optional listen (`audio:tts:listen`); scripts `apps/mobile/package.json:18-26` | Step 12 is the wrong citation for today's pipeline; §M is the one this spec extends. Does not change the plan |

### 1.2 What happens today

- The contrast that English and Spanish speakers find hardest is described, not practised. Quest 6 says "k is like g with a puff of air"; after SF-1 (`AMENDMENTS-DISCOVER-SOUND-FIRST.md`, not built yet) its Discover plays 카 and 가, but nothing asks the learner to tell them apart by ear: Match Sound says names (키읔, 기역), and after SF-1 the Check's ㅋ round leaves out ㄱ (on this checkout it still offers ㄱ by name, `minigame-config.ts:349`). Stage 2 q2 shows 까치, 딸기, 빵 with pictures, then asks the learner to write 빵 from its sound.
- The voice is weakest exactly here. In the AC-5 pilot, 까 and 짜 were heard as 가 and 자 for all three candidate voices; for Seoyeon 바 was also heard as 파 (AUDIO-CLIPS §13). The fixes changed the way some clips are said: today 바 is sent as `바!`, 까 as `까,`, 짜 as `짜!`, while 가, 카, 파, 빠, 자, 차 end in a full stop. A set that mixes an exclamation, a comma and a full stop can be told apart by its tune instead of its consonant.

### 1.3 The three-way contrast (phonetics, for the rules below)

- Korean has three voiceless series of stops and affricates, plain (lenis) ㄱ ㄷ ㅂ ㅈ, aspirated ㅋ ㅌ ㅍ ㅊ and tense (fortis) ㄲ ㄸ ㅃ ㅉ, and two fricatives, ㅅ and ㅆ. At the start of an utterance none is voiced; a plain stop between voiced sounds is voiced (the 다 of 자다, 차다 and 짜다 is [d] in all three, so those sets differ only in their first consonant). Voice onset time (VOT) is long for aspirated, short for tense and in between for plain: Lisker & Abramson 1964, which measured Korean, English and Spanish stops side by side ([doi:10.1080/00437956.1964.11659830](https://doi.org/10.1080/00437956.1964.11659830)); Cho, Jun & Ladefoged 2002 for the acoustic and aerodynamic correlates, ㅅ / ㅆ included ([doi:10.1006/jpho.2001.0153](https://doi.org/10.1006/jpho.2001.0153)).
- In today's Seoul Korean the plain and aspirated stops overlap in VOT, and the pitch at the start of the vowel keeps them apart: low after a plain stop, high after aspirated and tense ones. Silva 2006 ([Phonology 23(2)](https://www.cambridge.org/core/journals/phonology/article/abs/acoustic-evidence-for-the-emergence-of-tonal-contrast-in-contemporary-korean/FEC7E73BA21B687AFAE8A252F24B2F98)); Kang 2014, a corpus study ([doi:10.1016/j.wocn.2014.03.005](https://doi.org/10.1016/j.wocn.2014.03.005)). Listeners differ in how much they weight VOT against pitch (Schertz, Cho, Lotto & Warner 2015, on Korean listeners and English stops, [doi:10.1016/j.wocn.2015.07.003](https://doi.org/10.1016/j.wocn.2015.07.003)).
- **ㅅ is not a "low" consonant.** A phrase that starts with ㅅ or ㅆ (like ㅎ and the aspirated and tense series) starts high; only ㄱ ㄷ ㅂ ㅈ start low. Calling ㅅ "plain" is a spelling label, not a pitch claim, so nothing below tells the learner that ㅅ "starts low".
- **For our learners** (an inference from the VOT categories above, plus one study of Spanish listeners). English /p t k/ are aspirated (long lag) and English /b d g/ at the start of a word are short lag, so an English listener has one category for Korean plain and aspirated stops together and one that fits Korean tense stops: plain against aspirated is the pair to train. Spanish /p t k/ are short lag, near Korean tense, and Spanish /b d g/ are prevoiced, which no Korean word-initial stop is (Lisker & Abramson 1964). Naive Spanish listeners and Spanish-speaking learners of Korean mapped most Korean word-initial stops onto a Spanish voiceless stop (Martínez García & Holliday, "The perception of Korean stops by native speakers of Spanish", ICPhS 2019, [uvadoc 10324/70728](https://uvadoc.uva.es/handle/10324/70728)). Romanization misleads both: "ka" read in Spanish is close to Korean 까, not 카, and "ga" suggests a voiced g that Korean ㄱ is not at the start of a word.
- **Training.** Identification training with feedback improves the perception of a non-native contrast (Logan, Lively & Pisoni 1991, [doi:10.1121/1.1894649](https://doi.org/10.1121/1.1894649)); much of its carry-over to new speech came from hearing several talkers, which one voice (AD11) cannot give. What this app can vary is the vowel and the word, so Stage 1 draws from twelve pairs in four vowels (§3.1). Even so, practice on one voice may not carry over to every speaker; that limit is stated, not solved, here (§4).

What follows for the spec: (1) the cue lives in the consonant **and** the start of the vowel's pitch, so a clip whose whole tune differs (an exclamation against a statement) is not a fair pair (§3.2 G3); (2) no single number such as VOT can gate a Seoul Korean clip, because natural plain and aspirated clips overlap on it (§3.2); (3) the feedback names both cues, air and pitch, in plain words (§3.7).

## 2. User story

> As a learner who speaks English or Spanish, after I meet ㅋ, I hear 가 or 카 and pick which one I heard. When I miss, I hear both again, one after the other, with a short note on each ("Soft, starts lower.", "Big puff, starts higher."), and nothing counts against me.
>
> As the owner, I approve a set only after I have told its clips apart blind, and the app never plays a set I have not approved, never fills one in with the device voice, and never shows a broken round when a clip is missing.

## 3. Acceptance criteria

### 3.1 The contrast sets (the catalogue)

A **contrast set** is two or three clips that differ only in the plain, aspirated or tense series of their first consonant. A contrast round's options are exactly one set.

**Rules for a set:**
1. **Initial position only.** The series differ in the first consonant of the first syllable; everything else (vowel, final, second syllable) is the same, in spelling and in standard pronunciation.
2. **Decodable when played.** Every letter of every member is taught at or before the step that plays it (its own quest's Discover counts: Stage 2 q2 teaches the tense letters on its Discover). Stage 1 pairs plain with aspirated only; tense letters come in Stage 2 q2 (WO-16).
3. **Syllables in Stage 1, real words in Stage 2** (WO-16). A Stage 1 member is a syllable whose `en` is "the syllable <romanization>", as `lp.syl` writes it (`logic/scope-builders.ts:36`); a Stage 2 member is a word with its gloss. Either is shown after the round is answered.
4. **One voice, one frame** (§3.2 G3). A member uses an existing shipped clip when it passes the gate; otherwise MP-1b generates it.
5. **No merged sounds.** No set relies on ㅐ / ㅔ or another merged pair (AUDIO-CLIPS §9).

**Stage 1, quest 6 (`quest:stage1-life-q3`): plain against aspirated, a pool of twelve pairs in four vowels.** Every clip is shipped, a `syllable` (or `jamo-sound`) row at rate 0.85, said with a full stop.

| Series | ㅏ | ㅗ | ㅜ | ㅣ |
|---|---|---|---|---|
| ㄱ / ㅋ | `ga-ka`: 가 `audio/jamo/giyeok.mp3`, 카 `audio/jamo/kieuk.mp3` | `go-ko`: 고 `audio/say/ad025a70ef84aab2.mp3`, 코 `audio/say/f4f759edb468db53.mp3` | `gu-ku`: 구 `audio/say/ffa3c0de0f615f11.mp3`, 쿠 `audio/say/ea8ec5a273bad36f.mp3` | `gi-ki`: 기 `audio/say/0747eccf912e966b.mp3`, 키 `audio/say/e37db65fd90db469.mp3` |
| ㄷ / ㅌ | `da-ta`: 다 `audio/jamo/digeut.mp3`, 타 `audio/jamo/tieut.mp3` | `do-to`: 도 `audio/say/a3ec07cdd87ae1fa.mp3`, 토 `audio/say/164f51aa4871af06.mp3` | `du-tu`: 두 `audio/say/dfedd225bb659d50.mp3`, 투 `audio/say/278079e3f64bc00d.mp3` | — (디 / 티 have no clip; MP-1b may add them) |
| ㅈ / ㅊ | `ja-cha`: 자 `audio/jamo/jieut.mp3`, 차 `audio/jamo/chieut.mp3` | `jo-cho`: 조 `audio/say/db2f8a944f6cda9e.mp3`, 초 `audio/say/1fd639e1ec96a7ea.mp3` | `ju-chu`: 주 `audio/say/6234d5b178a8b258.mp3`, 추 `audio/say/35463324808727af.mp3` | `ji-chi`: 지 `audio/say/32e608b594bece7a.mp3`, 치 `audio/say/5b910cd1473d913c.mp3` |

That is eleven sets; MP-1b adds `di-ti` (디, 티, two new `syllable` rows) to make twelve.
- ㅂ / ㅍ is not in quest 6: ㅍ is taught in quest 8 (MP-OD-6).
- The `audio/jamo/` members are the sound clips Discover plays after SF-1 (`jamo-s1`, precached), so the learner hears the very sound the quest taught. They are **not** fed to the manifest as say occurrences (they are jamo rows already), so the say clips of 카, 타 and 자 stay in their packs.
- The other members sit in the `stage1`, `stage2`, `placement` and `stage7` packs today. Once the catalogue names them as quest 6's, the manifest's rule (a text belongs to the first pack, in AC-B6 order, that uses it) moves those in a later pack to `stage1`, which quest 6 loads. No clip is regenerated; the map and the pack chunks are.

**Stage 2, Letters quest 2 (`quest:stage2-letters-q2`): words, the three series.**

| Set id | Members (gloss) | Clips today | Played in |
|---|---|---|---|
| `dal-tal-ttal` | 달 (moon), 탈 (mask), 딸 (daughter) | 달, 탈 shipped (`달.`, `탈.`); **딸 new** | S2 q2 contrast step |
| `bul-pul-ppul` | 불 (fire), 풀 (grass), 뿔 (horn) | 불, 풀 shipped; **뿔 new** | S2 q2 |
| `jada-chada-jjada` | 자다 (to sleep), 차다 (to kick), 짜다 (salty) | 짜다 shipped (`word`, rate 0.9, no stop); **자다, 차다 new** | S2 q2 |
| `bang-ppang` | 방 (room), 빵 (bread) | 빵 shipped; **방 new** (팡 is not a word) | S2 q2 |
| `sada-ssada` | 사다 (to buy), 싸다 (cheap) | **both new** | S2 q2 |
| `gae-kkae` | 개 (dog), 깨 (sesame) | 개 shipped; **깨 new** (ㅐ is taught in Stage 2 q1) | S2 q2 |

- **New rows for MP-1b: 10** (딸, 뿔, 방, 깨, 디, 티 as `syllable` rows sent with a full stop; 자다, 차다, 사다, 싸다 as `word` rows). About 40 billed characters with the stop rule; a fraction of a cent.
- The pack rule moves 탈 (from `stories`) and 풀 and 짜다 (from `review`) to `stage2`; 불 stays in `placement` and 달 in `stage1`, both packs that a Stage 2 lesson loads (`clipScopeOfEpisode`, `logic/audio/lesson-clips.ts`).
- **Lone tense syllables are not used** (가/카/까, 바/파/빠, 자/차/짜 as syllables). The pilot showed the voice loses a lone tense onset (까, 짜 heard as 가, 자 for every voice), and the shipped fixes put 까, 바 and 짜 in a frame that differs from their partners (§1.2), so those sets would fail G3 today. Stage 2 trains each series on words instead, as WO-16 asks there. 다/타/따 and 사/싸 would pass G3 but are left out to keep the step short (MP-OD-3).
- 싸다 also means "to wrap" and, in talk with children, "to go to the toilet"; with the gloss "cheap" it is acceptable. The owner may swap it in MP-3.

### 3.2 The clip gate (machine checks, row MP-1a)

A set can be approved only when **every** check below passes. The checks run in `audio:tts:qa --contrast <set id | all>` (new flag, its own row selection: the members of the named sets, across packs) on the processed MP3s; the result is a table in the QA report, one line per set.

| # | Check | Passes when |
|---|---|---|
| G1 | Each member passes the per-clip gate | Pass 1 and the shared signal checks of AUDIO-CLIPS §9, and the MAR (or the owner's "good" for a held clip), as for any shipped clip; the lock holds its `mp3Sha256` |
| G2 | Series forced choice | Whisper Pass 1 forced choice whose grammar is the **whole series** at the member's place and vowel (for 가: 가 / 카 / 까; for 달: 달 / 탈 / 딸), even when the set is a pair, returns the member's own text. So a 가 that sounds like 까 fails a 가 / 카 pair. `closedSetOf` (`qa-lib.mjs`) already puts the series into Pass 1's closed set for clips of one or two syllables, so G2 mostly reads that result and adds the series forms the closed set lacks; Pass 2 (CTC) margins against the other members are printed, advisory only (AC-5: the model cannot gate) |
| G3 | Same frame | every member's `say` ends the same way (all a full stop, all a comma, or all none), none or all are sent through an IPA phoneme, and all have the same manifest `kind` and `rate`. Read from the manifest; no audio. G3 is necessary, not sufficient: the same written frame can still come out in a different tune, which the owner's listen (§3.3, step 2) checks |
| G4 | Not the same clip | no two members are byte-identical (the identity check of §9 already fails this; restated per set) |
| G5 | Like for like | each member's voiced span (`voicedSpanS`, `qa-report.mjs`) is between 0.75 and 1.33 times the set's median, and the members' integrated loudness is within 1.5 LU of each other. **Advisory on the first run**: an aspirated onset's noise may widen its voiced span, so MP-1b reports G5 on the shipped Stage 1 pairs and fixes the bound (or keeps G5 advisory) before it gates |
| G6 | Playable where it is used | every member is in a pack that the quest playing it loads (`clipScopeOfEpisode` / the Stage 1 quest's units, `logic/audio/lesson-clips.ts`); `jamo-s1` members are precached |

**No phonetic measurement in the gate** (MP-OD-4). The gate does not measure VOT or the pitch at the vowel's start. (1) In Seoul Korean plain and aspirated stops overlap in VOT and are told apart largely by pitch (§1.3), so a VOT threshold would fail natural clips and pass unnatural ones. (2) An onset-pitch estimate is feasible (an autocorrelation in a few dozen lines of JS), but it could only be advisory: what a set must do is be told apart by a Korean listener, and the owner's blind listen (§3.3) measures exactly that, with G2 as the machine's version of the same question. An advisory onset-pitch difference (plain lower than aspirated) is the first thing to add if G2 and the owner ever disagree on a set.

**When a set fails.** A set that fails G1, G2, G4 or G5 has a member regenerated (another take, or an AC-B3 override), and the member's other uses are re-checked by the per-clip gate, because a text has one clip. A set that fails G3 needs every member in one frame; when that would make a member worse on its other surfaces (the owner chose `까,` after three rounds), the set stays unapproved and is not played (§3.6). No set-only clip group is created (MP-OD-2).

### 3.3 The owner's listening approval (row MP-3)

`pnpm audio:tts:listen --contrast <set id | all>` (a new mode of the terminal listen tool, `scripts/audio/tts/listen.mjs`). Per set, about one minute:

1. **Blind identification.** The terminal shows the **whole series** at the set's place and vowel as numbered choices (for `ga-ka`: `1 가 ga`, `2 카 ka`, `3 까 kka`; for a triple, its three members). The tool plays each **member** three times in a shuffled order (6 plays for a pair, 9 for a triple), and after each play the owner presses the number he heard. No answer is shown until the end of the set.
2. **Side by side.** The tool plays the members in series order, then asks two questions, answered `y` or `n`:
   - "Same calm voice, same speed and tune; only the first sound differs?" (no member sounds like a question, a shout, cut off or drawn out)
   - for a stop or affricate set: "Plain soft and lower at the start; aspirated a clear puff and higher; tense tight, no puff, higher?" (the two that apply to a pair); for `sada-ssada`: "사 breathy, 싸 a longer, sharper hiss; both start high?"; and for a word set also "Each one sounds like the word?"
3. **Verdict.** The set **passes** when every blind play was right and both answers are `y`. Anything else is a fail, with an optional note. `r` replays the last play, `q` stops, as in the jamo listen.
4. **Once on a phone speaker.** The owner runs `--contrast all` once with the computer's sound sent to a phone-sized speaker (or plays the processed MP3s on a phone), because aspiration noise is high-pitched and a small speaker loses it first; a set that fails only there is a fail.

The result goes to `apps/mobile/recordings/tts/polly/Seoyeon/owner-contrast.json` (gitignored): per set, the date, the plays and answers, the two answers, the note, and the `mp3Sha256` of every member as played. An agent then opens the approval PR (MP-3's second half): it copies, for each passed set, `approval: { date, plays, correct, mp3Sha256: { <ref>: <sha> } }` into `content/audio/contrast-sets.json`, after checking that each sha equals the lock's `mp3Sha256` (a file changed after the listen is not approved). A failed set is listed in the PR body with its note and goes on the next key session's list.

- This listen is **required** for a set to be played, unlike the optional jamo listen of §9: WO-16's gate is "the owner heard them told apart".
- It is not called a native-speaker or expert review anywhere in the app (AUDIO-CLIPS standing rule).

### 3.4 The approval record, the generated module and the lapse (row MP-1a)

- `content/audio/contrast-sets.json` (new, committed, edited by the rows): `{ schemaVersion: 1, sets: [{ id, series: 'k' | 't' | 'p' | 'c' | 's', unit, members: [{ text, romanization, en, ref, kind: 'plain' | 'aspirated' | 'tense' }], approval?, lapsed? }] }`. `unit` is the game scope that plays the set (`minigame:s1-life-q3-pairs`, `minigame:s2-letters-q2-pairs`); its quest is read from the unit's name (`minigame:s1-life-q3-pairs` -> `quest:stage1-life-q3`), which is how MP-1a's decodability test runs before the step exists.
- **A manifest source.** `scripts/audio/content-sources.mjs` reads the catalogue: each member whose `ref` is not an `audio/jamo/` ref is an occurrence of the pack of its unit's quest, with the unit as its source. So the new texts get manifest rows (and MP-1b can generate them) before any round uses them, and a member warms with the quest that plays it.
- **Generated module** `src/content/__generated__/contrast-sets.ts`, written by a new `scripts/audio/gen-contrast-sets.mjs` from the catalogue and `tts-lock.json` only (not from the manifest), and run first by `audio:map`. It exports `CONTRAST_SETS` (every set, its members with their refs, and `approved: boolean`: true when the set has an `approval` whose `mp3Sha256` equals the lock's `mp3Sha256` for **every** member). Build order: catalogue -> `gen-contrast-sets` -> manifest (the manifest builder imports `minigame-config.ts`, which imports the module through `lp.pair`) -> the audio map. The drift test of the audio map covers the module.
- **Fixture approvals for e2e.** The fixture build (`gen-audio-map.mjs --with-e2e-fixtures`) reads `apps/mobile/e2e/fixtures/audio/contrast-sets.json` (a fixture set over fixture clips, approved by their fixture shas) in place of the real approvals, so the e2e of §6 can play an approved set; a release build never reads it.
- **Lapse.** A test fails when an approval names a sha that is not the lock's: the PR that regenerates a member must either re-listen the set or move its `approval` to `lapsed: { date, reason }`. So a clip never changes under an approval unnoticed, and a lapsed set simply stops playing.
- The same test checks the catalogue against §3.1: members of one set differ only in the series of the first consonant (`decomposeSyllable`); every `ref` is a manifest row; `kind` matches the consonant; no member is a merged-sound text; every member is decodable at its unit's quest.

### 3.5 Where the rounds live: one contrast step (row MP-2b)

**A contrast step** is a `practice` step that carries `contrast: true` (`QuestStepSchema`, `packages/content-schema/src/schemas/quest.ts:124`, one optional field) and plays a Listen & Pick scope whose rounds all have `contrastSet`. A quest may have **one**, right after its practice step. The step order becomes `intro, discover, practice, [practice with contrast: true], apply, check, reward` (F-CURR-001 §3.1 rule 1 and U-1; `LESSON_STEP_ORDER`'s check at `lesson.ts:346`; Stage 1 T4 at `stage1-curriculum.test.ts:674`).

| Quest | New step (after `s3`) | Scope | Duration |
|---|---|---|---|
| `quest:stage1-life-q3` (`content/quests.ts:250`) | `{ id: 's3p', kind: 'practice', contrast: true, titleEn: 'Hear the Puff', minigameKind: 'listen-pick', minigameRef: 'minigame:s1-life-q3-pairs', durationSeconds: 40 }` | `logic/minigame-config.ts`, after `:334`: the twelve Stage 1 sets of §3.1 | 40 s; the quest's sum goes from 224 s to 264 s, `estimatedMinutes` stays 4 (T10, `stage1-curriculum.test.ts:802-806`) |
| `quest:stage2-letters-q2` (`letters.json:534`) | `{ "id": "s3p", "kind": "practice", "contrast": true, "titleEn": "Soft, Puff or Tight?", "minigameKind": "listen-pick", "minigameRef": "minigame:s2-letters-q2-pairs", "durationSeconds": 40 }` | the cell's `scopes`, after `:563`: the six Stage 2 sets | 40 s; 256 s to 296 s, inside U-5's 225-300 s band; `estimatedMinutes` stays 4. The Word Builder cell's minutes go from 25 to 26 (1,526 s to 1,566 s, `build-lessons.mjs`), through the generated catalogue and its parity test; route plans use quest minutes, which do not change |

**The round** (`ListenPickRoundSchema`, `packages/content-schema/src/schemas/minigame.ts`, one optional field): `contrastSet: z.string().optional()`, the set id. A scope lists **sets**, not targets: a round is `{ id: 'lp:pair:<set id>', contrastSet, prompt, options, answerId }` with the options exactly the set's members (`{ id: <romanization>, text: { ko, romanization, en } }`) and `prompt` / `answerId` filled with the set's first member as a placeholder.
- In TypeScript it is built by a new `lp.pair(setId)` in `logic/scope-builders.ts`, which reads `CONTRAST_SETS` and throws on an unknown set. The Stage 2 cell writes its rounds out in full in its JSON (it needs the glosses and their es / ko overlays); a content test checks them against the catalogue.
- Ids are ASCII (`lp:pair:ga-ka`, option ids `ga`, `ka`) so the overlay keys of `scripts/overlay-fields.mjs` stay stable.
- **The step draws its rounds when it starts** (seeded per mount): Stage 1 draws **six** of its playable sets with no two in a row from the same series where it can, Stage 2 plays its six; each round's **target** is drawn from the set's members so that across the step the plain and aspirated targets (Stage 1) or the three series (Stage 2, as far as six rounds allow) come up as evenly as possible. Options are shuffled per round (`shuffleOptions`, as today). A replay of the quest therefore has no fixed answer key.
- **At least two sets.** A contrast step with fewer than two playable sets, or (Stage 1) whose playable sets cannot give both a plain and an aspirated target, is passed by (§3.6): a learner is never trained on one series alone.
- The clip a member plays is the catalogue's `ref` for it (`contrastClipRef(setId, text)`), never a lookup by text, so the round plays exactly the clip that was approved.

Neither step changes the other steps or their ids. A saved run of either quest from before the release is discarded on resume, because the step list changed (`stepsSignature`, `logic/quest-flow/saved-run.ts:83`); this is the existing, safe rule.

### 3.6 When a round plays, and when it is skipped (the fallback rules)

A contrast round is **playable** when all of these hold (`contrastRoundPlayable(round, env)` in `logic/audio/contrast-sets.ts`, with `hasClip` and the settings passed in, so the rule stays pure):
1. its set is approved (`CONTRAST_SETS`, §3.4);
2. every member's clip can play now: `hasClip(ref)` for each member (`platform/audio.web.ts:221`, `platform/audio.ts`: bundled or its pack chunk added, clips on, the remote `audioClips` and `audioPack.<pack>` switches on);
3. sound is on, and **Always show the letters** (CH-2) is off: either would put the prompt on screen;
4. the host is a practice host (`quest`, `preview`); a content test also keeps contrast rounds out of every Check, review and lecture scope.

**Skip, silently** (WO-16): a round that is not playable is not shown. No message, no mark, no answer, no change to stars, review items or the memory store. The game's "n / N" counts only playable rounds.
- **On step entry, wait for the packs, then decide.** `hasClip` is false for a lazy pack until its chunk has been added (`ClipRegistry.has`, `logic/audio/clip-assets.ts:24-25`). So before deciding, `QuestPlayerView` awaits the clip registry's pending chunk loads, bounded by the controller's own pack wait (`PACK_WAIT_MS`, `logic/audio/controller.ts:301`), on every entry to a contrast step: from the previous step, on Previous, and on a resumed run that opens there. The game checks each round again just before it opens, so a pack switched off mid-step drops the rounds after it.
- **A step with nothing to play is passed by.** If the step cannot play (no playable round, or fewer than §3.5's two sets), the player moves on as if it were done: `goNextStep` when the learner came forward, `goPrevStep` when they came back (Previous). No step screen, no launcher, no `minigame.finished`, not added to `skippedSteps` (which records a step the learner chose to skip, AU-9). The quest's step dots still count it (`max = steps.length`), so a passed-by step fills its dot: intended, it is part of the quest that this device cannot play now. On a native build before AC-13 (no clips play) every contrast round is unplayable and both steps are passed by: the quests are as today.
- **All rounds drop after the step has opened** (a pack switched off, Can't hear it?): the game completes as usual (`host.complete()`, `minigame.finished` sent), having scored nothing.
- **A clip that does not play while a round is shown**: any result but `played` for the prompt (below) ends the round unscored, and the next one opens (or the step completes).
- **Never the device voice, never text** (WO-16: "기기 TTS 로 이 대립을 채점하지 않는다"). A contrast round's prompt and members are played with `clipOnly: true` on the play spec (`logic/audio/controller.ts`): the controller tries that one ref and nothing else (no say-clip lookup, no voice: AC-B7 steps 2-4 skipped) and resolves `played`, or `unavailable` with a new fallback reason `'clip-only'` for anything else, a missing, failed, blocked or muted play included. The prompt slot (`components/use-prompt-slot.ts`, `logic/audio/prompt-state.ts`) takes a `noText` option for a contrast round: `unavailable` then never moves it to the `text` phase (which would print the answer), and the play is not counted as `text` by `runPrompt` or the audio telemetry; it is still reported by `audio.playback_failed` when a clip failed.

### 3.7 Feedback on a right answer and on a miss (anti-shame)

- **Right** (first try or later): as any Listen & Pick round (`check` mark, the prompt plays once more, F-A11Y-001); then every option shows its **kind line** under it (table below) and its gloss, and each option becomes a button that plays its clip, so the learner can hear the other members too.
- **Miss**: the option turns amber (`colors.feedback.nudge`) with the `replay` mark and stays locked (F-A11Y-001); Hoya `thinking` says **"Listen to both."** Then, instead of the 800 ms replay of the prompt (`listen-pick-flow.ts:121`), the round shows a **compare row**: the right member and the member tapped, each as `KoreanText` (Hangul and romanization) with its kind line; their clips play one after the other (the right one first, 400 ms apart), and the one playing has an outline and a speaker glyph, not a colour alone (static under reduced motion). Each item of the row is a button that plays its clip again.
  - On a **pair**, the round then ends (unscored), with Next as for a right answer: a second tap would only be "the other one".
  - On a **triple**, the round stays open; a second miss rings the right option (as today).
- No `colors.feedback.danger`, no counter, no timer, nothing taken away (CLAUDE.md §1). The compare row never says "wrong".

**Kind lines** (new strings, English Pre-A1). Both cues are named, so a learner who listens only for air also hears about pitch (§1.3):

| Key (`learner.minigame.contrast.*`) | English | Used for |
|---|---|---|
| `missHoya` | "Listen to both." | Hoya on a miss |
| `kind.plain` | "Soft, starts lower." | ㄱ ㄷ ㅂ ㅈ |
| `kind.aspirated` | "Big puff, starts higher." | ㅋ ㅌ ㅍ ㅊ |
| `kind.tense` | "Tight, no puff." | ㄲ ㄸ ㅃ ㅉ |
| `kind.plainS` | "Soft, with a little breath." | ㅅ (no pitch claim: ㅅ starts high, §1.3) |
| `kind.tenseS` | "A long, sharp hiss." | ㅆ |
| `a11y.contrastItem(item, kind)` | "{item}, {kind}" (item = `a11y.koreanItem`, by romanization) | each option's and each compare item's accessible name after the answer |

- "Soft" matches the Discover hint of ㄱ ("a soft, light g", `content/jamo.ts:27`) and "puff" the hints of ㅊ ㅋ ㅌ ㅍ (`:36-39`) and Stage 2 q2's Hoya line ("a tight throat, with almost no puff of air", `letters.json:450`). "Lower" and "higher" are comparisons, so they hold for a syllable heard beside its partner.
- **For the es drafters** (a note in the MP-2b PR, not a string): tense is close to Spanish p / t / c ("como la p, t, c del español"); aspirated is "con un soplo de aire, más que en español"; plain is "suave, empieza más bajo; no es la g, b, d del español". The ko values describe the same cues in Korean.
- **es and ko in the same PR.** Spanish and Korean are shipped locales, so a missing key fails `es-coverage.ts` / `ko-coverage.ts`; R8 runs only after a merge to `main`. MP-2b drafts the es and ko values, has them reviewed under F-I18N-001 §3.10 and re-signs the ledger, as CH-1a and SF-1 did (`AMENDMENTS-AUDIO-CANT-HEAR.md` §3.10, `:199`). The step titles and the members' glosses are content: their es and ko go in `content/i18n/{es,ko}/stage1-quests.json` (`steps.s3p.title`), `minigames.json` (the q6 scope's options) and `lessons-stage2-letters.json` (U-10: every `ready` cell in all three languages).
- The announcer says the result once by romanization, never Hangul (F-A11Y-001 AF-4b); the compare row's items are read in order, each once. No string holds Hangul or an age word.

### 3.8 Scoring: never, anywhere

A contrast step is not a scored step in any of the places that count steps or answers:
- **The answer.** The flow still emits its `answer` effect (the game's own result, announcer, Next and advance read it: `ListenPickGame.tsx`'s `settle`), tagged `scored: false` for a contrast round; the game's `answer` case (`:269-276`) then does **not** call `hostRef.current.answer`. So nothing reaches `correctCount` / `totalCount`, `scoredRounds`, the missed list of Try these again, `tries`, or the memory store (`firstAnswerListener` is reached only through `answerRound`), and `answersGiven` (LR) is not touched, so leaving a contrast step never asks "Keep playing?".
- **The skip cap.** `skippableGameSteps` (`logic/quest-flow/skip-cap.ts:31-33`) leaves out a step with `contrast: true`. Its launcher may still show "Skip for now", and skipping it never caps the stars; a passed-by step is not a game step for the cap either.
- **Review items.** `extract.ts` (`packages/content-schema/src/review-items/extract.ts`: `SCORED_STEPS` `:196`, `scopeAnswers` `:242-252`, `stage1Occurrences` `:538`) skips a step with `contrast: true` and any round with `contrastSet`, so no contrast member becomes a review item (no new frozen id; `REVIEW_ITEM_ROWS` and `stage1-items.json` unchanged), and none is ever asked in the Daily Review, a warm-up or Try these again.
- **Known words.** `questKnownAfter` (`logic/lessons/lesson-lint-items.ts:229-231`) does not count a contrast step's words as known, and U-6 (the reuse test, `upper-stage-curriculum.test.ts`, `stage2ReuseProblems`) does not count them as shown words.
- **Adaptive pacing.** The scaffold round plays before **Apply**, not on "the step after the first practice step" (`QuestPlayerView.tsx:241-242`): the trigger becomes `stepIndex === applyAt`, so a contrast step between them does not move it.
- **Stars** (`starsForAccuracy`) are exactly what they are without the step (WO-16 acceptance; tests §6). F-QUEST-002 §3.4's target mix (practice 6 + apply 4 + check 2 scored rounds) is unchanged; the contrast step's six rounds are on top and unscored.

### 3.9 Can't hear it?, Sound off and Always show the letters

- **Can't hear it?** (CH-1b) on a contrast round is **guidance only**: the device line and Hear it, no Show the letters (showing the prompt would print the answer: the cue rule's reason). Once the learner has opened it in a contrast step, the step's later contrast rounds are dropped after the current one (§3.6), so the learner is not left guessing through rounds they cannot hear. The current round stays answerable, unscored.
- **Sound off** and **Always show the letters**: the rounds are not playable (§3.6 rule 3), so the step is passed by. With sound on again, the step plays the next time the quest is played.

### 3.10 The gate is reusable (for WO-10 and later rounds)

`logic/audio/contrast-sets.ts` exports `contrastApproved(a: string, b: string): boolean`: true when one approved set holds both texts. `AMENDMENTS-STAGE1-DECODING-CHECK.md` (WO-10, open PR #1129) leaves the plain / aspirated pairs ㄱ-ㅋ, ㄷ-ㅌ, ㅂ-ㅍ, ㅈ-ㅊ out of its decode options "until clips pass a listening gate". This is that gate: such a pair may enter a decode item when `contrastApproved` holds for its two blocks; adding a set is a catalogue entry, the machine checks of §3.2 and an owner listen of §3.3, with no code. Whether WO-10 uses it is WO-10's decision; this spec only provides it.

### 3.11 Match Sound after a sound-first Discover (SF-OD-5)

SF-OD-5 asked whether Stage 1 Match Sound should play sounds instead of names, "together with WO-16". With WO-16, quest 6 (and Stage 2 q2) get a step that plays the very sounds Discover taught and asks the learner to tell them apart, on approved clips. Match Sound by name is not a contrast exercise (키읔 and 기역 differ in more than the first sound), and making it a sound question would put 가 / 카 into a game that falls back to the device voice. So: **keep Match Sound by name** (AU-OD-1, which OD-R2 kept), and let the contrast step carry the sound practice (MP-OD-5, adopted provisionally; flagged for the owner). The step title "Match the Sound" over a game that plays names is a content question for WO-12, not changed here.

### 3.12 [On device, owner]

- iPhone (PWA) and an Android phone, quest 6 with the sets approved: after Match Sound the "Hear the Puff" step plays 6 rounds; a miss shows "Listen to both." and plays the two clips one after the other with their lines; the stars at the end are what they would be without the step (compare with a run that skips nothing, and one that skips the contrast step).
- The same with the silent switch on (iPhone): Can't hear it? is guidance only; after it the step ends after the current round.
- Sound off on Profile: quest 6 goes from Match Sound straight to "What Does It Mean?".
- Stage 2 q2 offline after the Word Builder cell has been opened online: the step plays (its packs are cached).
- VoiceOver / TalkBack on a miss: the compare items read "ga, Soft, starts lower." and "ka, Big puff, starts higher."

## 4. Out of scope

- Any scored use of the contrast: the quest Checks, the Hangul Check, the Stage and Cell Checks, Placement, the Daily Review. Stage 2 q2's own Check (Type the Word in hear mode, 빵 and 딸기) already asks the tense contrast by ear through a clip; not changed here (MP-OD-7).
- Lone tense syllables (가/카/까 and the like) as sets, until a key session makes a set pass G3 (§3.1).
- ㅂ / ㅍ in Stage 1 (quest 8, MP-OD-6), contrast steps in other quests, and bringing the contrast back later (an unscored review slot): follow-ups once the quest 6 step has been used.
- More than one voice (AD11): talker variety would need the owner's recordings (AU-OD-6), a later decision. One voice may not carry over to every speaker (§1.3).
- Content outside the two new steps, for WO-12 (`AMENDMENTS-STAGE1-CONTENT-FIXES.md`, which already rewrites the es voiced sound-alikes; check these against it): the shipped es hint of ㄱ ("entre la g de «gato» y la c de «casa»", `content/i18n/es/stage1-jamo.json`) points toward voicing and the tense series; the ㅅ hint "like s in sun" is closer to ㅆ for many English speakers; an English anchor for the tense series (the p, t, k of "spy", "sty", "sky") would suit the Stage 2 q2 Hoya line.
- The lecture: `deck-builder.ts`'s `listenStep` leaves contrast rounds out (a classroom speaker and a teacher's voice are another setting); a contrast-only step gives no slide.
- Match Sound (§3.11); the presenter's letter slide (SF-OD-2).
- New telemetry: a failed clip already sends `audio.playback_failed`.
- A phonetic measurement (VOT, pitch) in the gate (§3.2, MP-OD-4).

## 5. UI sketch

`design/wireframes/minigame/listen-pick.md`, section "[MP] Contrast round" (added in this PR): the round, the miss with its compare row (pair and triple), the right answer with kind lines, the guidance-only Can't hear it?, and the step passed by. No visual mock: the round is Listen & Pick's existing layout; the compare row reuses `KoreanText`, the replay mark and the outline of F-A11Y-001, with no new token or component. If MP-2a finds the compare row does not fit at the Largest text size on a 320-wide window, it asks for a design pass; the wireframe states that constraint.

## 6. Tests

TDD (CLAUDE.md §5): each test lands, failing first, in the row that makes it pass. Script tests live under `apps/mobile/scripts/__tests__/` (the only script folder `apps/mobile/vitest.config.ts:36` runs).

| File | Level | Row | What it pins |
|---|---|---|---|
| `apps/mobile/scripts/__tests__/tts-qa.test.mjs` (extended) | unit | MP-1a | G2-G5 on synthetic reports and manifests: a set whose members end in `.` and `!` fails G3; byte-identical members fail G4; a member 1.5 times the median voiced span is flagged by G5 (advisory) or fails it (gating); a pair member whose series forced choice returns the tense form fails G2; a Pass 2 margin is printed, never fails; `--contrast` selects the members across packs |
| `apps/mobile/scripts/__tests__/contrast-sets.test.mjs` (new) | unit | MP-1a | the catalogue: §3.1 rules (first consonant only, series kinds, refs are manifest rows, no merged sound, decodable at the unit's quest read from the unit's name); an approval sha that is not the lock's fails (lapse); `CONTRAST_SETS[].approved` is true exactly when every sha matches; the generated module is current (drift); the fixture approvals are read only by the fixture build |
| `apps/mobile/scripts/__tests__/tts-manifest.test.mjs` (extended) | unit | MP-1a | the catalogue's say texts are occurrences of the unit's pack with the unit as source; `audio/jamo/` members are not; 코 도 토 구 쿠 두 투 조 초 주 추 기 키 지 치 land in `stage1` (unless already earlier); 탈 풀 짜다 in `stage2`; 불 stays `placement`, 달 `stage1`; the 10 new rows exist with their `say` |
| `apps/mobile/scripts/__tests__/tts-qa-run.test.mjs` (extended) | unit | MP-1a | the contrast listen: the whole series as choices, each member 3 times shuffled; pass only with every play right and both answers `y`; the series question for `sada-ssada`; the result records each member's sha as played |
| `packages/content-schema/src/__tests__/` (minigame, quest, lesson and review-items tests) | unit | MP-2a | `contrastSet` and `contrast` are optional; `LESSON_STEP_ORDER` accepts one second `practice` step with `contrast: true` whose scope rounds all have `contrastSet`, rejects two, and rejects one with a plain round; `extract.ts` makes no item from a contrast step or round (`REVIEW_ITEM_ROWS` unchanged) |
| `apps/mobile/src/logic/__tests__/scope-builders.test.ts` | unit | MP-2a | `lp.pair`: id `lp:pair:ga-ka`, options the set's members with ASCII ids and `en` "the syllable ga"; throws on an unknown set |
| `apps/mobile/src/logic/audio/__tests__/contrast-sets.test.ts` (new) | unit | MP-2a | `contrastApproved`, `contrastClipRef`; `contrastRoundPlayable` for each rule of §3.6 (unapproved, one member without a clip, a pack switched off, sound off, Always show the letters, a Check host); the round draw: six of the playable Stage 1 sets, targets balanced, both series present, seeded; fewer than two sets or one series only -> not playable as a step |
| `apps/mobile/src/logic/__tests__/listen-pick-flow.test.ts` | unit | MP-2a | a contrast round: the `answer` effect carries `scored: false`; a wrong tap emits no `schedule-replay` and a `compare` effect (right, then tapped); on a pair the round then resolves; on a triple it stays open; a prompt result other than `played` ends the round with nothing scored; the count shrinks when a later round is dropped |
| `apps/mobile/src/logic/audio/__tests__/controller.test.ts`, `prompt-state.test.ts` | unit | MP-2a | `clipOnly`: a missing, failing or blocked clip resolves `unavailable` with reason `'clip-only'`, no voice, no say-clip lookup; a `noText` slot never enters `text` and counts no `text` |
| `apps/mobile/src/screens/minigames/__tests__/` (the Listen & Pick render test) | render | MP-2a | a miss shows "Listen to both." and the compare row with the kind lines, plays the two refs in order, no danger colour; the right answer shows each option's kind line and makes each option play its clip; Can't hear it? is guidance only and drops the later contrast rounds; `host.answer` is never called; the accessible names are `contrastItem` |
| `apps/mobile/src/logic/lecture/__tests__/deck-builder.test.ts` | unit | MP-2a | a deck with quest 6 has no slide from the contrast step |
| `apps/mobile/src/logic/quest-flow/__tests__/skip-cap.test.ts` | unit | MP-2b | a `contrast: true` step is not in `skippableGameSteps`; skipping it leaves the cap at 3; skipping both scored games caps at 1 |
| `apps/mobile/src/screens/quest/__tests__/quest-previous.test.tsx`, `quest-skip-cap.test.tsx`, `quest-pacing-player.test.tsx` | render | MP-2b | a contrast step with nothing to play is passed by on Next, on Previous and on a resumed run, after the pack wait; not in `skippedSteps`; no `minigame.finished`; its dot filled. A run with the contrast step played with every answer wrong and one with it passed by end with the same tally, stars and review answers, and nothing reaches the memory listener. The pacing scaffold opens before Apply, not on the contrast step |
| `apps/mobile/src/content/__tests__/stage1-curriculum.test.ts`, `upper-stage-curriculum.test.ts` | unit | MP-2b | T4 (`:674`) and U-1 with the optional contrast step; the two contrast steps as in §3.5; no contrast round in any Check, review or lecture scope; every contrast round matches the catalogue; T10 (264 s) and U-5 (296 s); U-6 does not count contrast words; `questKnownAfter` does not either |
| `packages/i18n/src/__tests__/` (coverage, length budget, ledger) | unit | MP-2b | the new keys in en / es / ko, no Hangul in en or es, the ledger current |
| `apps/mobile/e2e/web/contrast-step.spec.ts` (new; fixture clips and the fixture approvals of §3.4) | e2e | MP-2b | quest 6: the step plays fixture clips, a miss plays two clips; with the fixture set unapproved the quest goes from Match Sound to the apply step; no `speechSynthesis` call during the step |

Coverage: `logic/audio/contrast-sets.ts`, the flow and the quest-flow change are business logic (`apps/mobile/src/logic/`, 90 % target); `packages/content-schema` stays at 100 %.

## 7. Rollout

- MP-1a, MP-2a and MP-2b ship with no set approved: the catalogue exists, the gate runs, the steps are in the content, and every learner passes both steps by. Nothing changes for learners until MP-3.
- MP-1b adds 10 clips (content PR, AC-B8 style, no code).
- MP-3's approval PR turns sets on: an approved set's rounds start to play on the next web deploy. Native builds play them after AC-13.
- **Turning a set off** is a one-line PR (move its `approval` to `lapsed`); no remote switch is added (MP-OD-8). The pack switches of AC-B8 still turn every clip of a pack off at once, which skips the rounds too.
- No stored data changes. Saved runs of quest 6 and S2 q2 from before the release are discarded on resume (§3.5).

## 8. Dependencies

- AUDIO-CLIPS: the per-clip gate (§9), the manifest and packs (AC-B5, AC-B6), the switches (AC-B8), the voice lock (§13); runbook §M for the owner's key session. AC-13 for native.
- SF-1 (`AMENDMENTS-DISCOVER-SOUND-FIRST.md`): Discover plays 가 / 카 before quest 6's contrast step does; MP-2 does not need SF-1 merged, but the on-device check of §3.12 reads best after it.
- CH-1b, CH-2 (Can't hear it?, Always show the letters), F-A11Y-001 (marks, announcer), LR (`answersGiven`), AU-9 (`skippedSteps`, the skip cap), F-CURR-002 §4.6 (adaptive pacing), the review-item extract (F-CURR-002).
- Same files as WO-11 to WO-15 (`minigame-config.ts`, `content/quests.ts`; README §6), and `QuestPlayerView.tsx` with WO-06 / WO-07 and WO-38: merge one after the other; conflicts are mechanical. `packages/i18n/src/messages/en/learner.ts`: nearly every UI work order.
- WO-10 (`AMENDMENTS-STAGE1-DECODING-CHECK.md`, PR #1129): may reuse §3.10.

## 9. Rows

| Row | Model | What | Files | Tests | Acceptance |
|---|---|---|---|---|---|
| **MP-0** | Opus 5.5 | this spec; the wireframe section; the "Amended" lines and `[MP]` notes in F-QUEST-002, F-AUDIO-004, AUDIO-CLIPS, F-CURR-001, CANT-HEAR and SF; the index line in `docs/specs/README.md` | docs only | — | multi-agent review done (§11); status `ready` |
| **MP-1a** | Sonnet 5.5 | `feat(scripts)`: the catalogue (§3.1, no approvals) as a manifest source; `gen-contrast-sets.mjs` and the generated module; the set gate (G2-G6) in `audio:tts:qa --contrast` and its report table; `audio:tts:listen --contrast` with `owner-contrast.json`; the fixture approvals; the manifest, audio map and pack chunks regenerated (the 10 new rows, the pack moves); a runbook §M step (M-7, Korean) for the contrast listen | `content/audio/contrast-sets.json`, `scripts/audio/{content-sources,gen-audio-map,gen-contrast-sets}.mjs`, `scripts/audio/tts/{qa,qa-run,qa-lib,qa-report,recognizers,listen,listen-lib}.mjs`, `src/content/__generated__/{contrast-sets.ts,audio-assets.ts,audio-packs/*}`, `content/audio/tts-manifest.json`, `e2e/fixtures/audio/contrast-sets.json`, `docs/launch/owner-runbook.md` | §6 rows MP-1a; `pnpm --filter @hangul-route/mobile test`; `audio:tts:generate --dry-run` for the 10 rows | the catalogue passes its test with no approval; the dry run lists the 10 rows and their characters |
| **MP-1b** | owner, then Sonnet 5.5 | the owner generates the 10 rows (runbook M-2, `--only`); an agent runs QA with `--contrast all`, the MAR, processing, and opens `content(audio): contrast clips` (AC-B5 hand-off), with G5 measured on the shipped pairs and its bound fixed or left advisory (§3.2). A set that fails G2-G4 is reported with the regenerate command | the MP3s, `tts-lock.json`, `assets-license.csv`, the audio map, `pronunciation-overrides.json` if needed, this spec's G5 line if the bound changes | `audio:check`; the QA report with the contrast table in the PR body | every member of §3.1 has a shipped clip, or the PR lists what is held and why |
| **MP-2a** | Sonnet 5.5 | `feat(mobile,content-schema)`: `contrastSet`, `lp.pair`, `contrast-sets.ts` (playable, draw, approved), `clipOnly` and the `noText` slot, the flow and the game (§3.6, §3.7, §3.9), the `scored: false` answer path, the lecture exclusion, the review-item exclusion, en strings | the "Runtime (MP-2a)" files of Scope; `packages/i18n/src/messages/en/{learner,a11y}.ts` | §6 rows MP-2a; `pnpm --filter @hangul-route/mobile test`, `pnpm --filter @hangul-route/content-schema test` | a fixture contrast scope plays on clips only, scores nothing, and drops a round whose clip cannot play |
| **MP-2b** | Sonnet 5.5 | `feat(mobile,content,i18n)`: the `contrast` step field and the step-order rule, the skip cap, the pass-by (with the pack wait), the pacing index, `questKnownAfter` and U-6, the two steps and their scopes (§3.5), es / ko strings drafted and reviewed and the ledger re-signed, the content overlays, the generated lesson modules and catalogue (Word Builder 26 min), the e2e | the "Quest and content (MP-2b)" files of Scope | §6 rows MP-2b; the above plus `pnpm --filter @hangul-route/i18n test`, `node scripts/check-i18n.mjs`, `node scripts/validate-content.mjs`, the new e2e | with no set approved both quests play as today (the steps are passed by, the stars unchanged); with the fixture set approved, the e2e plays it on clips only |
| **MP-3** | owner, then Sonnet 5.5 | the owner runs `audio:tts:listen --contrast all` (§3.3), once more on a phone speaker; an agent opens `content(audio): approve contrast sets` with the approvals copied and checked against the lock | `content/audio/contrast-sets.json`, the generated module | `contrast-sets.test.mjs` | the approved sets have `approved: true`; the failed ones are listed with notes |
| **MP-4** | Sonnet 5.5 | `docs(specs)`: close: status `shipped` after §3.12 (or "built, on-device checks open"), row PR numbers here and in the index line, the `[MP]` notes' "as built" details if a row departed from §3, a review-log line in AUDIO-CLIPS §14 | this file, `docs/specs/README.md`, AUDIO-CLIPS | — | the docs say what main does |

Order: MP-1a; then MP-1b, MP-2a and MP-2b (MP-2a before MP-2b; either may come before MP-1b: a manifest row with no clip is held, as today); then MP-3 (needs MP-1b); then MP-4. Estimates: MP-1a 1d, MP-1b owner 15 minutes and 0.25d, MP-2a 1d, MP-2b 1d, MP-3 owner about 20 minutes and 0.1d, MP-4 0.1d (WO-16 estimated spec 0.5d, clips 1d, build 1d; the build is larger because a step that is never scored touches the skip cap, the review items, pacing and the lint).

## 10. Open decisions (each adopted provisionally, as recommended)

- **MP-OD-1 — where the rounds live.** Neither quest has a Listen & Pick practice step (§1.1 item 4). (a) One optional contrast step after the practice step, marked `contrast: true` (§3.5; amends the six-step rule). (b) Turn the practice step into Listen & Pick (quest 6 loses Match Sound, S2 q2 loses Pic-Word Match). (c) A second segment inside the practice step (a new step field and a segment player). **Recommendation: (a)**: no game is lost, a step that cannot play is passed by cleanly, and the field gives every place that counts steps one thing to test. Adopted provisionally.
- **MP-OD-2 — a set whose clips are in different frames.** (a) The set stays unapproved until a take of each member in one frame passes every use of that text (§3.2). (b) A set-only clip group (`audio/pair/`, a schema and pipeline change) so a set can have its own takes. **Recommendation: (a)**: one text, one clip (AC-B4), and Stage 2 uses words, whose new takes share a frame from the start. Adopted provisionally.
- **MP-OD-3 — syllable triples in Stage 2.** (a) Words only (§3.1). (b) Add 다/타/따 and 사/싸 (they pass G3 today) as two more rounds, at 8 rounds and about 50 s, which takes S2 q2 over U-5's 300 s. **Recommendation: (a)**. Adopted provisionally.
- **MP-OD-4 — a phonetic measurement in the gate.** (a) None; G2 and the owner's blind listen decide (§3.2). (b) VOT and onset pitch as advisory columns. **Recommendation: (a)**, with an advisory onset-pitch difference as the first addition if G2 and the owner disagree. Adopted provisionally.
- **MP-OD-5 — Match Sound (SF-OD-5).** (a) Keep it by name; the contrast step is the sound practice (§3.11). (b) Make Stage 1 Match Sound a sound question with series-free pools. **Recommendation: (a)**. Adopted provisionally; flagged for the owner, as SF flagged it.
- **MP-OD-6 — ㅂ / ㅍ in Stage 1.** (a) Not now (ㅍ is quest 8; 바's clip is `바!`, so `ba-pa` fails G3). (b) A contrast step in quest 8 with `bo-po` (보 and 포 are shipped with a full stop) and the q6 pairs. **Recommendation: (a) for this amendment**, (b) as the first follow-up once the q6 step is in use. Adopted provisionally.
- **MP-OD-7 — Stage 2 q2's Check.** Its Type the Word round asks 빵 by ear. (a) Leave it (a dictation of a taught word, not a forced choice between two clips; Can't hear it? covers it, CH-1c). (b) Make it a see round. **Recommendation: (a)**; noted for WO-10's review of what Checks measure. Adopted provisionally.
- **MP-OD-8 — a remote switch.** (a) None: a set is turned off by a one-line PR, and the pack switches still work (§7). (b) A remote name `game.contrast` (Worker list first). **Recommendation: (a)**: the rounds are unscored and skip themselves on any clip problem. Adopted provisionally.

## 11. Review log

- 2026-11-25, MP-0: written on `803208a95`.
- 2026-11-25, multi-agent review (two independent reviewers: Korean phonetics and listening pedagogy for English and Spanish speakers; engineering against the code and the clip pipeline). Confirmed: the citations, the 19 cited clips and their frames, decodability, the glosses, the durations, the silent skip, unscored practice, the G3 rule and the no-measurement decision. Applied:
  - **Blockers**: skipping a contrast step would have capped the stars (`skip-cap.ts`), and its rounds would have become review items asked by the device voice (`extract.ts`): a step-level `contrast: true` that every counter leaves out (§3.8), with tests.
  - **Phonetics**: Schertz et al. 2015 cited only for cue weighting, and the English-listener claims stated as an inference from the VOT categories (§1.3); ㅅ starts high, so no "starts low" for ㅅ and a separate owner question for `sada-ssada` (§1.3, §3.3); kind lines that name both cues ("Soft, starts lower." / "Big puff, starts higher."), "A long, sharp hiss." for ㅆ (§3.7); the lenis voicing note (§1.3).
  - **Pedagogy**: targets drawn per play and balanced, at least two sets with both series (§3.5); a Stage 1 pool of eleven shipped pairs plus 디/티 in four vowels, six drawn per play; the single-voice limit stated (§1.3, §4); the whole series as foils in G2 and in the blind listen, and a phone-speaker pass (§3.2, §3.3); after a right answer every option plays; a pair round ends after the compare row (§3.7); notes for the es drafters and content follow-ups for WO-12 (§3.7, §4).
  - **Engineering**: the `answer` effect kept with `scored: false` (§3.8); `clipOnly` resolves `unavailable` with reason `'clip-only'` and a `noText` slot (§3.6); the pass-by waits for the pack chunks and names its navigation calls (§3.6); the pacing scaffold keyed to Apply, U-6 and `questKnownAfter` left out (§3.8); one generated module with `approved` flags and its build order, fixture approvals for e2e (§3.4); ASCII round and option ids, required `en`, the overlay files (§3.5, §3.7); the pack moves listed exactly, jamo members not fed as say texts (§3.1); test paths the runner picks up, T4 `:674` and T10 for Stage 1 (§6); the Word Builder cell's minutes (§3.5); MP-2 split into MP-2a and MP-2b (§9).
