# AMENDMENTS-BATCHIM-COMPLETE — seven end sounds, two letters at the bottom, and a quiet h

Status: ready (multi-agent review 2026-11-25, §10; open decisions BC-OD-1 to BC-OD-17 adopted as recommended, §9). Written for work order WO-15 of `docs/roadmap/review-2026-11/phase-2-hangul.md`, row BC-0, on main `803208a95`. Built on **owner decision 2026-11-22 (OD-R9)**, approved as recommended (`docs/roadmap/review-2026-11/README.md` §4): the Stage 1 completion copy was lowered by AU-15 (#1035); what is left is to add the seven-final-sounds quest at the start of Stage 2 (WO-15). The owner asked that open decisions be adopted as recommended.

The WO names this file (`AMENDMENTS-BATCHIM-COMPLETE.md`), so it is used instead of the `AMENDMENTS-FINAL-SOUNDS.md` the session prompt offered as a default.

**Amends** (each gets an "Amended 2026-11-25 by AMENDMENTS-BATCHIM-COMPLETE [BC]" line in this PR):
- `F-CURR-001-upper-stage-content.md`: §3.1 item 3 and OD-2 (Word Builder grows from six quests to nine; the three new ones are optional), item 4 (the Word Builder cap: q8 and q9 are each one family of finals), item 6 (decodable scored reading: inside Word Builder, the finals q8 and q9 teach, in the contexts they teach; from Stage 3 on, final ㅎ only before a vowel), §3.3 (the Word Builder table: q7, q8 and q9; the q5 note "final ㅎ … appears later only in theme words" and the q6 note "double finals … appear later as theme words only") and §5 (the U-4 description).
- `F-CURR-002-category-expansion-and-mastery.md`: §5.2, the S1 row's "A batchim quest for the 7 representative final sounds" (built here as Word Builder q7, not as a Stage 1 TypeScript row) and the S3 decision record's **책을 읽어요** paragraph (§5.2, "Decision record (row CM-44 S3)": the sentence stays a theme sentence; its reason now reads "taught only by an optional Word Builder quest", §3.8, BC-OD-8).

**Not amended**: Stage 1's 16 quests (`apps/mobile/src/content/quests.ts`, `apps/mobile/src/logic/minigame-config.ts`; the WO's "do not"), Word Builder q1–q6 except q6's reward line (§3.6), Letters Volume 2 (`content/episodes/stage-2/letters.v2.json`, which has its own "Seven Final Sounds" quest, §1.3), the romanizer (WO-17, `AMENDMENTS-ROMANIZER-GAPS.md`, #1130), the Hangul Check and the quest Check romanization rules (WO-10, `AMENDMENTS-STAGE1-DECODING-CHECK.md`, PR #1129), the Stage 1 content fixes (WO-12, #1127), the romanization fade (WO-11, `AMENDMENTS-ROMANIZATION-FADE.md`, #1128).

**Scope (rows BC-2a, BC-1, BC-2b, BC-3; §7)**: `content/episodes/stage-2/letters.json`, `content/i18n/{es,ko}/lessons-stage2-letters.json`, `packages/content-schema/src/schemas/lesson.ts` and `catalog/assemble.ts` (optional quests in a lesson cell, the quest cap), `scripts/build-lessons.mjs` (the same field; budget lines), `apps/mobile/src/logic/my-route/` (required-only cell completion), the review-item cell rules (§3.9), `apps/mobile/src/content/__tests__/helpers/reuse.ts` and `upper-stage-curriculum.test.ts` (decodability), generated files (lesson modules, catalogue, `items-stable-id.json`, `content/audio/tts-manifest.json`, audio pack maps, the presenter font), the new say clips with their lock and license rows.
**Owner**: solo dev
**Rollout**: one content release: BC-1 merges only with its clips (§7); three new quests, no new UI, no new `packages/i18n` key

---

## 1. Context

### 1.1 Citations of WO-15, re-read on `803208a95`

Paths under `apps/mobile/src/` are written from `src/`. Line numbers in F-CURR-001 and F-CURR-002 are those of `803208a95`; this PR's two "Amended" lines move them down by 2.

| # | WO-15 says | On `803208a95` | Verdict |
|---|---|---|---|
| 1 | Stage 1 has six finals ㄱㄴㄹㅁㅂㅇ (`jamoBatchim`) | `src/content/jamo.ts:186-193` `jamoBatchim`: giyeok, nieun, rieul, mieum, bieup, ieung | correct |
| 2 | The [ㄷ] family (ㅅㅈㅊㅌㄷㅆ) is Stage 2 `content/episodes/stage-2/letters.json` q5; ㅋㄲㅍ are q6 | `letters.json:1643` q5 "One Sound for Six Letters", `:2059` q6 "More Letters for k and p"; the records are `src/content/jamo.ts:281-291` (`wbf`) | correct |
| 3 | F-CURR-002 §5.2 "A batchim quest for the 7 representative final sounds" is an unbuilt "later row" | `F-CURR-002:565`, the S1 additions row ("Authored as Stage 1 TypeScript rows (4.2)"); no quest teaches it | correct. Not mentioned by the WO: Letters **Volume 2** q1 "Seven Final Sounds" (`quest:stage2-letters-v2-q1`) exists, dark behind `volumes` (built-in pct 0). It reads one-block words grouped by their end sound (손 곰 강 입 떡 붓); it does not teach that many letters share one sound. See §1.3 |
| 4 | Double finals and final ㅎ are taught for reading on no route, but Stage 2–4 text has 않고, 많이, 없는, 읽는, 좋아요, 넣고 | Taught Korean (`ko` fields) of the Stage 2–4 cells holds: 많이 (in the set phrase 새해 복 많이 받으세요, and once alone, a Cloze Pick tile in `stage-4/rites.json` q3), 좋아요 / 좋아 / 좋아해요 / 좋을 (ㅎ), 넣어요 (ㅎ), 연필이 없어요 (`stage-3/letters.json` q2 Discover) and 책을 읽어요 (`stage-3/letters.v2.json` q3 Discover). 않고, 없는, 읽는 and 넣고 occur only in source quotes, notes, ko overlays and stories, which carry no taught romanization. Stage 6 also has 읽어요 (Cloze Pick tile, `stage-6/letters.v2.json:406`), 맑아요 (Cloze Pick, `stage-6/nature.v2.json:409`) and 맑음 (realia) | partly correct: the taught words are 많이, 좋아요, 넣어요, 없어요 and 읽어요 (and 맑- in Stage 6) |
| 5 | So 없어요 and 읽어요 are excluded from scored rounds (F-CURR-002 near line 597) | `F-CURR-002:603`: 책을 읽어요 is "a theme sentence: q3's Discover page with Hear it only, never a scored round", citing "the Volume 1 연필이 없어요 precedent". There is no list: the exclusion is (a) that authoring rule and (b) the U-4 test, whose Stage 3+ taught set `WORD_BUILDER_SYMBOLS` (`src/content/__tests__/helpers/reuse.ts:210-214`) has no double final, so `untaughtSymbols` (`:223-236`) fails a read with one in the scopes U-4 reads (`upper-stage-curriculum.test.ts:801-831`; `:810` asserts `닭` is untaught). U-4 reads Sentence Builder, Pic-Word Match and Listen & Pick (`reuse.ts:94-113`), so the Stage 6 Cloze Pick tiles above are outside it | moved 6 lines; "list" is a rule plus a test |
| 6 | (implied) final ㅎ words are excluded too | **Not so.** `WORD_BUILDER_SYMBOLS.finals` is `ㄷㅅㅈㅊㅌㅎㅆㅋㄲㅍ` (`reuse.ts:213`): it holds ㅎ, though Word Builder never teaches it (`jamo.ts:207-209`: "Final ㅎ is not here … Word Builder does not teach it"; F-CURR-001 §3.3 q5 note, `:118`). So U-4 passes 좋아요, 좋아해요, 좋아하는 and 넣어요 as scored reads today: 28 reads in 13 scopes of 10 quests in Stages 3, 4 and 7 (listed in §3.8). Every one has the ㅎ before a vowel | a gap the WO missed; it does not change the plan (q9 teaches exactly that context, §3.8 narrows the test to it) |
| 7 | Romanizer: `rr.ts` gives 읽고 `ikgo` and similar (WO-17); register exceptions | `packages/content-schema/src/romanization/rr.ts:13-17` (documented limits); `AMENDMENTS-ROMANIZER-GAPS.md` (#1130, merged as a spec on main `810e2689b`; RG-1 not built yet) fixes ㄺ before ㄱ in RG-1 and requires reviewed exceptions for ㄴ-insertion, 사이시옷, juncture and 하다 predicates (OD-RG1 (a), owner-approved: 하다 predicates aspirate, RR 제3장 제1항 4) | correct. Every word of §3 was run through the converter on `803208a95`; all give the RR of their standard pronunciation, none has a pattern #1130 detects (§3.7) |
| 8 | Pronunciation is written as in Stage 2 Letters Volume 2 q3 (`국물[궁물]`) | `letters.v2.json:1639` n3 (en): "{ko:책이} is said chaegi … {ko:국물} is said gungmul"; `content/i18n/ko/lessons-stage2-letters-v2.json:11` (ko): "{ko:책이}는 [채기]로 소리 나요 … {ko:국물}은 [궁물]" | correct: en and es say "is said <romanization>", ko writes the said form in brackets |
| 9 | (README §6) WO-15 touches `src/logic/minigame-config.ts` and `src/content/quests.ts` | Neither holds Word Builder: Word Builder is the JSON cell `content/episodes/stage-2/letters.json`, built by `scripts/build-lessons.mjs`; `git grep stage2-letters` finds no line in either file | the §6 conflict entry does not apply to these rows |
| 10 | (implied) Word Builder can take more quests | A lesson cell holds 3 to 6 quests: `packages/content-schema/src/schemas/lesson.ts:313` `quests: z.array(LessonQuestSchema).min(3).max(6)`; F-CURR-001 OD-2 (`:409`) "Word Builder 6" | the cap must move (§3.9, row BC-2a) |

No citation is wrong in a way that changes the plan. Items 6 and 10 are handled in §3.8 and §3.9.

### 1.2 What OD-R9 decided, and where the quests go

OD-R9 (README §4): "7종성 퀘스트를 Stage 2 앞에 추가(WO-15)", approved. WO-15 places the quests **in** Word Builder, after q5 and q6, and forbids changing Stage 1's 16 quests. The two agree once "Stage 2 앞에" is read as "at the front of Stage 2": Word Builder is Stage 2's letters column (`order: 1`), the cell that "finishes the Hangul inventory Stage 1 left open" (F-CURR-001 §3.3), and a summary of the seven end sounds cannot come before q5 and q6, which teach the [ㄷ] family and ㅋ ㄲ ㅍ. This spec takes that reading (BC-OD-2).

### 1.3 Letters Volume 2 q1 is a different quest

`quest:stage2-letters-v2-q1` "Seven Final Sounds" (dark) shows one word per end sound (손 n, 곰 m, 강 ng, 입 p, 떡 k, 붓 t; 달 물 별 l in the game) and builds one-block words with Syllable Build. It does **not** show that several letters share one sound, or that two spellings can sound the same. The new q7 does both. Both stay; q7 takes another title so the two never read alike (BC-OD-7). Volume 2 reads only Stage 1 symbols and its own (`upper-stage-curriculum.test.ts:554-556`), so q7–q9 change nothing there.

### 1.4 The rules taught, from the standard (표준 발음법)

All quotes from 표준어 규정 제2부 표준 발음법, National Institute of Korean Language, https://korean.go.kr/kornorms/regltn/regltnView.do?regltn_code=0002 (the article page the shipped notes cite: `…&regltn_no=191`), read 2026-11-25 and checked word for word by the review (§10).

| Article | Text (quoted) | Used in |
|---|---|---|
| 제8항 | "받침소리로는 'ㄱ, ㄴ, ㄷ, ㄹ, ㅁ, ㅂ, ㅇ'의 7개 자음만 발음한다." | q7 |
| 제9항 | "받침 'ㄲ, ㅋ', 'ㅅ, ㅆ, ㅈ, ㅊ, ㅌ', 'ㅍ'은 어말 또는 자음 앞에서 각각 대표음 [ㄱ, ㄷ, ㅂ]으로 발음한다." (옷[옫], 꽃[꼳], 젖[젇], 솥[솓], 앞[압]) | q7 |
| 제10항 | "겹받침 'ㄳ', 'ㄵ', 'ㄼ, ㄽ, ㄾ', 'ㅄ'은 어말 또는 자음 앞에서 각각 [ㄱ, ㄴ, ㄹ, ㅂ]으로 발음한다." (값[갑], 없다[업ː따]); 다만 '밟-', '넓-' | q8 (ㅄ, at the end of a word only) |
| 제11항 | "겹받침 'ㄺ, ㄻ, ㄿ'은 어말 또는 자음 앞에서 각각 [ㄱ, ㅁ, ㅂ]으로 발음한다." (닭[닥], 삶[삼ː]); 다만 "용언의 어간 말음 'ㄺ'은 'ㄱ' 앞에서 [ㄹ]로 발음한다." (맑게[말께]) | q8 (ㄺ, ㄻ, at the end of a word only); the 다만 is **not** taught |
| 제12항 4 | "'ㅎ(ㄶ, ㅀ)' 뒤에 모음으로 시작된 어미나 접미사가 결합되는 경우에는, 'ㅎ'을 발음하지 않는다." (놓아[노아], 많아[마ː나], 않은[아는], 싫어도[시러도]) | q9 |
| 제12항 1–3 | ㅎ before ㄱ ㄷ ㅈ aspirates them (놓고[노코], 많고[만ː코]); before ㅅ tenses it (많소[만ː쏘]); before ㄴ is [ㄴ] (놓는[논는]) or silent after ㄴ / ㄹ (않네[안네]) | **not taught** |
| 제13항 | "홑받침이나 쌍받침이 모음으로 시작된 조사나 어미, 접미사와 결합되는 경우에는, 제 음가대로 뒤 음절 첫소리로 옮겨 발음한다." (옷이[오시]) | already Word Builder n6; q7 recalls it |
| 제14항 | "겹받침이 모음으로 시작된 조사나 어미, 접미사와 결합되는 경우에는, 뒤엣것만을 뒤 음절 첫소리로 옮겨 발음한다. (이 경우, 'ㅅ'은 된소리로 발음함.)" (닭을[달글], 값을[갑쓸], 없어[업ː써], 젊어[절머]); the 해설 marks 닭이[다기] and 닭을[다글] as non-standard | q8 |
| 제15항 | a final before a **content** morpheme starting with ㅏ ㅓ ㅗ ㅜ ㅟ moves as its representative sound (맛없다[마덥따]; 붙임 값어치[가버치]) | **not taught** |

Not taught either: a double final before a consonant (읽다[익따], 읽는[잉는], 없는[엄는], 값도[갑또]: nasalisation and tensing on top of the 제10–11항 reduction). So the contexts q8 teaches are "at the end of a word" and "before a vowel" only (§3.8).

---

## 2. User story

> As a learner who has met every Hangul letter, I can read the bottom of any block: I know a bottom letter ends in one of seven sounds, I can read a block with two bottom letters (닭, 없어요), and I know a bottom ㅎ goes quiet before a vowel (좋아요 [조아요]). When a word is said differently from how it is spelled, the spelling still tells me the word.

> As a heritage parent, the app teaches 없어요 and 좋아요 the way my child hears them at home, and shows how they are written.

---

## 3. Acceptance criteria

### 3.1 Placement (BC-OD-2, BC-OD-3)

Three quests are appended to Word Builder (`episode:stage2-letters`, `content/episodes/stage-2/letters.json`), after q6:

| Quest id | Title (draft) | Teaches | Rule | Optional |
|---|---|---|---|---|
| `quest:stage2-letters-q7` | Many Letters, Seven Sounds | no new symbol; 1 new word | 제8항, 제9항 (summary of Stage 1 finals, q5, q6) | yes |
| `quest:stage2-letters-q8` | Two Letters at the Bottom | double finals ㄺ ㅄ ㄻ, by word | 제10항, 제11항 (end of a word), 제14항 (before a vowel) | yes |
| `quest:stage2-letters-q9` | A Quiet h | final ㅎ and the double finals ㄶ ㅀ, by word | 제12항 4 | yes |

- **Ids are positional.** The generator names a cell's quests `quest:<episode>-q<i+1>` (`packages/content-schema/src/catalog/assemble.ts:62`), so q7–q9 are appended, never inserted, and q1–q6 keep their ids.
- **`addedIn`.** Each new quest carries `addedIn` (YYYYMMDD, the BC-1 merge date), **above** main's catalogue version on that day (a stamp equal to it fails, `scripts/check-added-in.mjs`; 20261107 on `803208a95`). A stored placement at `stage3` or above then places them out (`packages/content-schema/src/catalog/versions.ts:8-17`). The version bump makes every stored plan "stale" and shows its holder "New lessons", as the Stage 1 crafts-q4 addition did; accepted.
- **Optional (BC-OD-3).** The cell lists them as optional (§3.9). As for the Stage 1 addition `quest:stage1-crafts-q4` (`src/content/episodes.ts:95`, `packages/content-schema/src/catalog/data.ts:125`): the route offers each in its place to a learner who has not finished a later quest; it never pulls the cursor back behind where a learner already is (`src/logic/next-quest.ts:59-75`); it is never needed for the cell or Stage 2 to be done (`requiredQuestIds`, `packages/content-schema/src/schemas/episode.ts:75`). So a learner who finished Word Builder keeps every star and card, the cell stays done (My Route included, §3.9), and the route does not move backward. The quests stay playable from the Word Builder page.
- **No cards.** No `rewardCardId`; the cell keeps `rewardCardIds ['card:norae']` (the T-2 precedent, F-CURR-001 `:274`), still awarded when q1–q6 are done.
- **Minutes.** Each quest `estimatedMinutes: 4`. A cell's catalogue minutes are the sum of its step seconds rounded (`scripts/build-lessons.mjs:368`, `:803`): 1,526 s, 25 minutes today; with three quests of 225–300 s it becomes about 37–40 minutes (BC-1 records the number).
- **Lecture, console and plans (BC-OD-14).** Optional quests behave as Stage 1's crafts-q4 already does: generated plans queue them in place (`packages/content-schema/src/curriculum/generate.ts:225-241`), the console's whole-episode pick and the lecture presets include them in route order. No code change; pinned tests move (§6.1).

### 3.2 Common rules for q7–q9

1. **Six steps**, the Stage 2 timing of F-CURR-001 §3.1 table (intro 8 s, Discover 50–60 s, practice 75–90 s with 6 rounds, apply 60–75 s with 4 rounds, Check about 35 s with exactly 2 rounds, reward 8 s). Discover at most 3 pages of at most 2 items (U-1).
2. **Discover items are `word` items** (BC-OD-4), each `{ ko, romanization, en }`, with `syllables` (the said syllables, e.g. `il geo yo`) on every word of two or more blocks, and a `picture` where WordArt or card art exists. No new jamo records, so `teaches` stays empty for q7–q9 and the U-2 and U-3 symbol checks are unchanged (`upper-stage-curriculum.test.ts:509-551`).
3. **`soundChange: true`** on the `word` of every q8 and q9 Discover item (`item.word.soundChange`, as `letters.v2.json:1030` does; read at `packages/content-schema/src/review-items/extract.ts:141`, `:208`): each is said otherwise than spelled. The field is build-only (`BUILD_ONLY_FIELDS`, `build-lessons.mjs:496`) and keeps the item out of Dictation in reviews (`stable-ids.ts:301`).
4. **Decodable.** Every Korean string in a q7–q9 scope uses only Stage 1 symbols, Word Builder q1–q6 symbols and the finals the quest itself or an earlier one of q7–q9 teaches, **in the contexts they are taught** (§3.8). No double final before a consonant; no final ㅎ, ㄶ or ㅀ at the end of a word or before a consonant; no 제15항 juncture.
5. **Heard rounds.** A heard Listen & Pick round's options sound different from each other (`dictation-unambiguous`), and **at most one option of a round ends in k, t or p** (unreleased stops are hard to tell apart by ear for English and Spanish speakers, and with a device voice); the others end in n, l, m or ng, or differ elsewhere. Homophones are never asked by ear: 입 / 잎 (both [입]), 낮 / 낫 / 낯, and 삶 (said like 삼, three). No Dictation (`type-hangul` `hear`) round in q7–q9: every q8–q9 word has a sound change, and q7's point is that spellings share a sound.
6. **No spelling round.** `promptKind: 'spelling'` plays only with `game.spelling-pick` (built-in pct 0, F-CURR-002 `:1086`), so it is not used (BC-OD-12).
7. **Reuse.** In each quest, at least half the words its games show outside Discover were taught before the quest (U-6, `upper-stage-curriculum.test.ts:486-494`; a quest's own Discover words do not count). Distractors come from Stage 1 and q1–q6 words.
8. **New items.** At most 8 per quest (`lesson-new-load`); in Word Builder the cap is by symbols (F-CURR-001 §3.1 item 4, amended in §3.10).
9. **Language.** UI copy (titles, Hoya lines, captions, labels, notes) is English at CEFR Pre-A1, short and plain; no age words, no baby talk. Taught Korean always carries its romanization and an English gloss (`en`), and es and ko glosses in the overlays (§3.6). Hoya lines name a letter by its sound in English ("a bottom h"), never in Hangul; captions and notes may use `{ko:}` tokens. No copy says the bottom h is quiet without "before a vowel" (learners soon meet 좋고 [조코], 어떻게 [어떠케], where it is heard).
10. **Glosses of words already taught elsewhere.** 읽어요 (`lex:ilgeoyo`, "read"), 넣어요 (`lex:neoeoyo`, "put it in") and 많이 (`lex:mani`, "a lot") keep the gloss they ship with today, so their review items do not change meaning. 좋아요 (`lex:joayo`) ships as "nice" in two Stage 4 rounds; q9 glosses it "good; I like it", and BC-1 records the item's new first gloss (its first teaching cell moves to Word Builder, §3.9).
11. **Anti-shame.** Nothing new: the shipped games' amber nudge and `thinking` pose; no timer; no per-question fail.
12. **Romanization** is the converter's output (§3.7) unless an entry of `ROMANIZATION_EXCEPTIONS` (as amended by #1130) covers it; no word of §3.3–§3.5 needs one.

### 3.3 q7 — Many Letters, Seven Sounds

**Learning goal.** Read the end of a block by sound: every bottom letter is said as one of seven sounds, k n t l m p ng (제8항), so different letters can end a word the same way (옷 · 꽃 · 낮 · 밭 all end in t, 제9항), and two words can sound the same while their spellings tell them apart (입 mouth, 잎 leaf: both [입]).

**Words** (Discover; BC-1 may swap a word only for one with the same final and the same picture status):

| Page (caption, draft) | Word | Romanization | Gloss (en) | Said | Picture | Taught before? |
|---|---|---|---|---|---|---|
| 1 "These end in t." | 꽃 | kkot | flower | [꼳] | `word:nature-flower` | q5 |
| 1 | 밭 | bat | field (for growing food) | [받] | none | **new** |
| 2 "These end in k." | 책 | chaek | book | [책] | `card:book` | Stage 1 / q5 |
| 2 | 밖 | bak | outside | [박] | none | q6 |
| 3 "Same sound. Look at the bottom letter." | 입 | ip | mouth | [입] | `word:body-mouth` | q6 practice |
| 3 | 잎 | ip | leaf | [입] | `word:prop-leaf` | q6 |

Discover Hoya line (draft): "Bottom letters end in just seven sounds: k, n, t, l, m, p and ng." Intro (draft): "So many bottom letters! But they end in just seven sounds." Reward (draft): title "Just Seven Sounds!", "k, n, t, l, m, p, ng. You know them all!" Blurb (draft): "Many bottom letters, just seven end sounds."

**Games** (triple Pic-Word Match / Listen & Pick / Pic-Word Match; differs from q6's Pic-Word Match / Card Match / Listen & Pick):
- **Practice, Pic-Word Match, 6 boards of 3.** Picture words across the seven sounds (꽃 붓 빛 · 책 떡 · 밥 입 잎 · 곰 · 달 별 · 강 공 · 손 산 and so on), each board mixing at least two end sounds; one board holds 입 and 잎 with a third picture.
- **Apply, Listen & Pick (heard), 4 rounds.** Hear a one-block word; pick it among three written words that differ **only in the bottom letter**, with at most one k / t / p ending a round (§3.2 item 5). The rounds: 밥 among 밥 / 밤 / 발 (bap / bam / bal); 곰 among 공 / 곰 / 곧 (gong / gom / got); 밭 among 밭 / 밤 / 발; 밖 among 밖 / 밤 / 발. Every option is a word taught by then, with its gloss (밤 night, 발 foot, 공 ball, 곧 soon). The options show their romanization, so this round trains the ear, not reading; that is its job in Apply.
- **Check, Pic-Word Match, 2 boards.** Board 1: 입, 잎 and 꽃 with their pictures. Both 입 and 잎 are romanized `ip`, so only the bottom letter tells them apart: this board measures reading. Board 2: three pictured words that differ only in their final, 밥 (`card:rice`) / 발 (`word:body-foot`) / 곰 (`word:animal-bear`) or 공 (`word:sport-ball`) / 곰 / 밥. Pic-Word Match shows romanization (AU-8 hides it only in Listen & Pick Checks), so board 2 can be solved from it; it is kept for the end-sound contrast, and the spec does not claim it measures reading.

**Note n7** (language, shown on q7's reward and card back; draft, at most 240 characters): "{ko:입} (mouth) and {ko:잎} (leaf) are both said ip: at the end of a word, {ko:ㅂ} and {ko:ㅍ} make the same sound. The spelling shows which word it is." Two sources (`lesson-source-shape`): 표준 발음법 제8항 and 제9항 (NIKL, URL above); the Standard Korean Language Dictionary (표준국어대사전, stdict.korean.go.kr) entry 잎, whose pronunciation is [입].

### 3.4 q8 — Two Letters at the Bottom

**Learning goal.** Recognise a block with two bottom letters (ㄺ ㅄ ㄻ) and read it in two places: at the end of a word you say just one of the two (닭 [닥], 값 [갑], 삶 [삼]: 제10항, 제11항); before a vowel the second one moves to the next block (읽어요 [일거요], 없어요 [업써요]: 제14항). Which one is said at the end differs (ㄺ and ㄻ keep the second, ㅄ the first) and is learned with each word, not as a rule. These are the same two places Word Builder taught for one bottom letter (n5, n6), now with two.

**Words**:

| Page (caption, draft) | Word | Romanization | Gloss (en) | Said | Picture |
|---|---|---|---|---|---|
| 1 "At the end, you say just one. The word shows which." | 닭 | dak | chicken | [닥] | none (BC-OD-10) |
| 1 | 값 | gap | price | [갑] | none |
| 2 "Before a vowel, the second one moves over." | 읽어요 | ilgeoyo | read | [일거요] | none |
| 2 | 없어요 | eopseoyo | there is none; I don't have it | [업써요] | none |
| 3 "One more: you say m." | 삶 | sam | life | [삼] | none |

Discover Hoya line (draft): "Two letters at the bottom! At the end, say just one. Before a vowel, the second one moves over." Intro (draft): "Look! This block has two letters at the bottom." Reward (draft): title "Two Letters, One Block!", "Two bottom letters? You can read them now!" Blurb (draft): "Some blocks have two bottom letters."

- 닭 alone only: 닭이 is never written or played (the 해설 to 제14항 marks the common [다기] as non-standard; a device voice may say it).
- 없어요 [업써요]: the tense ㅆ is heard, not written in RR (`eopseoyo`; RR does not mark tensification, F-CNT-002 §3.1). The note says "the second letter moves over"; it does not teach tensing.
- 삶 is kept because the WO names it and it is the commonest word ending in ㄻ; it is never asked by ear (said like 삼). BC-1 may swap it for 닮아요 (dalmayo, "look alike") or 젊어요 (jeolmeoyo, "be young"), both ㄻ before a vowel, and then page 3's caption says "the second one moves over" (BC-OD-15).

**Games** (triple Listen & Pick / Card Match / Listen & Pick):
- **Practice, Listen & Pick (heard), 6 rounds.** Hear a word; pick its spelling among three written words that sound different, with at most one k / t / p ending (for example 닭 among 닭 / 달 / 곰; 값 among 값 / 강 / 발; 읽어요 among 읽어요 / 없어요 and a taught word of another shape). At least half the options are words taught before q8 (U-6).
- **Apply, Card Match, 4 pairs.** Korean word to its meaning: two q8 words and two earlier words, or as U-6 needs.
- **Check, Listen & Pick, Read Pick Meaning (`promptShown: true`), 2 rounds.** Read a q8 word; pick its meaning among three English labels (no pictures exist): for example 값 → price / chicken / book; 없어요 → there is none / read / outside. Options are meanings only (`readPickRoundIssues`); es and ko labels in the overlay (`listenPick.rounds.<round>.options.<option>.label`).

**Note n8** (language, draft): "With two bottom letters, you say just one at the end: {ko:닭} is said dak. Before a vowel, the second one moves over: {ko:읽어요} is said ilgeoyo." Sources: 표준 발음법 제10항, 제11항 and 제14항 (NIKL); the Standard Korean Language Dictionary entries 닭 [닥] and 읽다 (활용 읽어 [일거]). The ko note writes [닥] and [일거요], and may add 없어요[업써요].

### 3.5 q9 — A Quiet h

**Learning goal.** Recognise a bottom ㅎ, alone or in ㄶ and ㅀ, and know it is not said **before a vowel** (제12항 4): 좋아요 [조아요], 넣어요 [너어요]; in ㄶ and ㅀ the ㅎ goes quiet and the other letter moves over: 많이 [마니], 괜찮아요 [괜차나요], 싫어요 [시러요].

**Words**:

| Page (caption, draft) | Word | Romanization | Gloss (en) | Said | Picture |
|---|---|---|---|---|---|
| 1 "Before a vowel, the bottom h is quiet." | 좋아요 | joayo | good; I like it | [조아요] | none |
| 1 | 넣어요 | neoeoyo | put it in | [너어요] | none |
| 2 "Two letters: the h is quiet, the other one moves over." | 많이 | mani | a lot | [마니] | none |
| 2 | 괜찮아요 | gwaenchanayo | it's okay | [괜차나요] | none |
| 3 "Words you can read now" | 싫어요 | sireoyo | I don't like it | [시러요] | none |

Discover Hoya line (draft): "Before a vowel, a bottom h is quiet. You see it, but you don't say it." Intro (draft): "Shh! A bottom h can be quiet." Reward (draft): title "Quiet h!", "You found the quiet h. Great reading!" Blurb (draft): "A bottom h makes no sound before a vowel."

- WO-15 lists 않아요 for ㄶ; it is replaced by **괜찮아요** (BC-OD-6): 않아요 alone is a helper verb with no plain meaning to gloss or picture, while 괜찮아요 is an everyday whole word with the same ㄶ. 많이 stays.
- **ㅀ is added** through 싫어요 (BC-OD-5): the same rule, no new rule load, and 좋아요 / 싫어요 is a pair learners use at once.
- No q9 word has final ㅎ, ㄶ or ㅀ at the end of a word or before a consonant (좋고 [조코], 많다 [만타], 않네 [안네] are 제12항 1–3, not taught).

**Games** (triple Listen & Pick / Card Match / Type Hangul; differs from q8 in the Check):
- **Practice, Listen & Pick (heard), 6 rounds**, as q8 (options sound different; at least half taught before q9).
- **Apply, Card Match, 4 pairs** (for example 좋아요 / good, 싫어요 / I don't like it, 많이 / a lot, and one earlier word).
- **Check, Type Hangul `see`, 2 rounds** (좋아요, and 괜찮아요 or 싫어요). `see` shows the word with its romanization and meaning and the learner copies it on the in-app keyboard (`design/wireframes/minigame/type-hangul.md:171`), so it is a produce round that copies the spelling, ㅎ included; it does not test reading (q9's practice does, by ear and eye). The keyboard composes ㄶ and ㅀ (`packages/content-schema/src/hangul/compose-typed.ts:27-28`). It is chosen because Stage 2 Volume 1's Check share leaves no room for another Listen & Pick (§3.11 item 3, BC-OD-13).

**Note n9** (language, draft): "Before a vowel, a bottom {ko:ㅎ} is not said: {ko:좋아요} is said joayo. In {ko:많이}, the {ko:ㅎ} is quiet and {ko:ㄴ} moves over: mani." Sources: 표준 발음법 제12항 4 (NIKL); the Standard Korean Language Dictionary entry 좋다 (활용 좋아 [조ː아]).

### 3.6 Copy, notes and translations

- **Notes.** A quest shows note k of its cell (culture notes first, then language, in file order; `scripts/build-lessons.mjs:387-404`). Word Builder has six language notes n1–n6, so q7–q9 would show n1–n3 again; BC-1 appends **n7, n8, n9** (language) so q7 shows n7, q8 n8 and q9 n9. Each has at least two sources from the §6.6 allowlist (NIKL and its dictionaries), `accessed`, `quoteOrLocator`, and a `verification` block with its passes, as n5 and n6 have (`letters.json:2567-2620`).
- **q6's reward.** "Word Builder Done!" stays true (q1–q6 complete the cell). The line "You met the last new letters of Word Builder." (`letters.json:2171`) is not, since q8 and q9 teach more bottom letters; BC-1 changes only that line (draft: "You met every single bottom letter. Wonderful!") with its es and ko overlays.
- **Translations.** es and ko are shipped (`packages/i18n/src/locales.ts:31-35`). Every new en field (quest titles and blurbs, step titles, Hoya lines, captions, word glosses, Card Match and Read Pick labels, notes) has its es and ko value in `content/i18n/{es,ko}/lessons-stage2-letters.json` **in the BC-1 PR** (U-10 fails a missing one), written and checked by the multi-agent review with an independent es pass and an independent ko pass (F-I18N-001 §3.10; the content-row practice of F-CURR-001 §3.10). ko notes write the said form in brackets, as Volume 2 n3 does: "{ko:읽어요}는 [일거요]로 소리 나요". ko glosses never name the word they gloss (`overlay-circular-gloss`). No key is added to `packages/i18n` (no new UI string).

### 3.7 Romanization

Run on `803208a95` with `packages/content-schema/src/romanization/rr.ts` (`romanize`, `romanizeSyllables`):

| Word | Converter | Syllables | Standard pronunciation | RR check |
|---|---|---|---|---|
| 꽃 | kkot | kkot | [꼳] | ok |
| 밭 | bat | bat | [받] | ok |
| 책 / 밖 | chaek / bak | — | [책] / [박] | ok |
| 입 / 잎 | ip / ip | — | [입] / [입] | ok |
| 밥 / 밤 / 발 / 공 / 곰 / 곧 | bap / bam / bal / gong / gom / got | — | as spelled | ok |
| 닭 | dak | dak | [닥] | ok |
| 값 | gap | gap | [갑] | ok |
| 삶 | sam | sam | [삼ː] | ok (RR does not mark length) |
| 읽어요 | ilgeoyo | il geo yo | [일거요] | ok (also an RG-1 golden vector, #1130 §3.8) |
| 없어요 | eopseoyo | eop seo yo | [업써요] | ok (tensing not written) |
| 좋아요 | joayo | jo a yo | [조아요] | ok |
| 넣어요 | neoeoyo | neo eo yo | [너어요] | ok |
| 많이 | mani | ma ni | [마ː니] | ok |
| 괜찮아요 | gwaenchanayo | gwaen cha na yo | [괜차나요] | ok |
| 싫어요 | sireoyo | si reo yo | [시러요] | ok |

None has a pattern #1130's detectors fire on (ㄺ before ㄱ; 밟-; 히 / 혀 after a stop; a 하다 block after a stop; ㄴ-insertion; 사이시옷; juncture before a content morpheme). BC-1 re-runs `corepack pnpm --filter @hangul-route/content-schema test romanization` on the main of its day; if RG-1 has landed and any value differs, the row stops and reports.

### 3.8 Decodable reading after q8 and q9 ("un-excluding", BC-OD-8, BC-OD-9)

A final counts as taught **only in the context taught**:

| Finals | Taught by | Decodable when | Not decodable |
|---|---|---|---|
| ㄺ ㅄ ㄻ | q8 | at the end of a word, or before a vowel (the next block starts with ㅇ) | before any consonant (읽다 [익따], 읽고 [일꼬], 읽는 [잉는], 없는 [엄는], 값도 [갑또]) |
| ㅎ ㄶ ㅀ | q9 | before a vowel (the next block starts with ㅇ) | at the end of a word, or before any consonant (제12항 1–3) |

- **Inside Word Builder (U-4 for Stage 2, `upper-stage-curriculum.test.ts:553-585`).** That loop checks every scope of every Word Builder quest (Pic-Word Match, Card Match, Listen & Pick prompts and options included) with flat symbol keys (`symbolKeysOf` / `undecodable`, `:457-477`). It gains the context rule, and the taught set grows from q8 and q9 by a per-quest table (`ㄺ ㅄ ㄻ` from `quest:stage2-letters-q8`, `ㅎ ㄶ ㅀ` from `quest:stage2-letters-q9`), test data in `reuse.ts` that lands in row BC-2a and is used once the quests exist. So the q8–q9 content passes and nothing outside the table's contexts does.
- **From Stage 3 on (U-4, `:823-831`).** `WORD_BUILDER_SYMBOLS` keeps its nine single finals unconditionally (ㄷ ㅅ ㅈ ㅊ ㅌ ㅆ ㅋ ㄲ ㅍ) and **final ㅎ becomes "before a vowel" only**. The double finals ㄺ ㅄ ㄻ ㄶ ㅀ stay untaught from Stage 3 on (BC-OD-8): U-4's premise is "every route has passed Word Builder", and q8–q9 are optional, so passing Word Builder no longer means they were played. A later content row that wants to score a double final from Stage 3 on lifts this with its own decision (for example making q8–q9 required, or showing a q8 / q9 word first in its own Discover).
- **Today's content stays green.** Every final-ㅎ scored read that passes U-4 today has the ㅎ before a vowel (measured on `803208a95`, confirmed by both reviewers): 좋아요 in `stage-3/life.json` q2, `stage-3/life.v2.json` q2, `stage-4/nature.v2.json` q1, `stage-7/nature.v2.json` q2 and q3; 좋아해요 in `stage-3/life.v2.json` q2 and q3; 넣어요 in `stage-3/life.v2.json` q3 and `stage-7/life.v2.json` q3; 좋아하는 in `stage-7/life.v2.json` q1, `stage-7/nature.json` q3, `stage-7/nature.v2.json` q3 and `stage-7/rites.json` q3 (28 reads, 13 scopes, 10 quests). No Sentence Builder, Pic-Word Match or Listen & Pick read has a double final. Outside the scopes U-4 reads, Cloze Pick tiles and realia hold 많이 (`stage-4/rites.json` q3), 읽어요 (`stage-6/letters.v2.json`), 맑아요 and 맑음 (`stage-6/nature.v2.json`), all before a vowel; unchanged.
- **What this does not change.** The two Stage 3 theme sentences, 연필이 없어요 (`stage-3/letters.json` q2) and 책을 읽어요 (`stage-3/letters.v2.json` q3), stay Discover-only. The other Stage 2 cells still never read a Word Builder symbol (F-CURR-001 rule 6), so q8 and q9 finals do not enter their scored reads either.
- **So the WO's acceptance** ("the exclusion list of Stage 2–4 scored rounds drops the double-final and final-ㅎ words") is met as far as optional quests allow: inside Word Builder the words are taught and scored; from Stage 3 on, final ㅎ is checked by the context it is taught in (and every current use passes), while double finals wait for the decision in BC-OD-8.

### 3.9 Pipeline and app changes for optional quests (row BC-2a, BC-OD-3)

`optionalQuestIds` exists for episodes and catalogue cells (`packages/content-schema/src/schemas/episode.ts:34`, rules `:95-99`, `requiredQuestIds` `:75`; `catalog/schema.ts:22-23`) and is read by the cursor, the journey, mastery's "done" and the curriculum generator (`src/logic/next-quest.ts:70`, `src/logic/journey.ts:89`, `src/logic/memory/mastery.ts:55`, `packages/content-schema/src/curriculum/generate.ts:225-228`); `catalog-parity.test.ts:67-75` already compares it. Only the hand-written Stage 1 episode sets it, and a lesson cell cannot (`LessonCellObjectSchema` is strict, `lesson.ts:297-318`). Row BC-2a:

1. **Schema.** `LessonCellObjectSchema` takes `optionalQuestIds: z.array(z.string()).optional()`; the cell rules reject an id that is not one of the cell's quests, a cell whose every quest is optional (as `episode.ts:95-99` do), a list that is not a suffix of the quest order, and the field on a Volume 2 file.
2. **Quest cap.** `quests` goes from `.max(6)` to `.max(9)` (`lesson.ts:313`), with a cell rule: quests beyond the sixth must all be optional. F-CURR-001 OD-2 ("Word Builder 6") reads "Word Builder 6 required and 3 optional".
3. **Generator.** The compact `GeneratedCellRow` tuple (`catalog/assemble.ts:33-35`) takes an eighth slot, the count of trailing optional quests (0 when absent); `cellRowsOf` / `catalogueOf` in `build-lessons.mjs` write it, `expandCellRows` (`assemble.ts:52-69`) sets `CatalogCell.optionalQuestIds` from it, and `shapeCell` puts `optionalQuestIds` on the lesson episode of the manifest.
4. **My Route.** `cellStateOf` (`src/logic/my-route/pips.ts:92-102`) and `stageFill` (`view.ts:347-352`) count every quest pip, so a finished Word Builder would read `partial`. They count completion over `requiredQuestIds`; an optional pip still shows and still fills when played, never counts against "complete". This also fixes the same gap for Stage 1's crafts-q4.
5. **Mastery and Cell Check (BC-OD-16).** `masteryDenominator` (`packages/content-schema/src/review-items/review-item.ts:373-381`) and `cellCheckItemIds` (`src/logic/reviews/cell-check.ts:11`, `:57-59`) take every item whose `cells` name the cell, so q7–q9's new words would count toward Word Builder's Practiced / Mastered share and the Word Builder Cell Check could ask 닭 of a learner who skipped q8. Rule: an item taught in the cell **only** by optional quests joins that cell's mastery denominator and Cell Check once the learner has completed one of those quests. BC-2a implements it where the item's teaching sources are known (the extract records each source's quest); if the item model cannot tell, the row stops and reports before BC-1. Words also taught elsewhere (좋아요, 읽어요, 넣어요, 많이) keep their other cells; their first teaching cell becomes Word Builder, which moves their stage and gloss key (§3.2 item 10).

### 3.10 Changes to F-CURR-001's rules (stated here, applied as the amended reading)

- **§3.1 item 3 and OD-2**: Word Builder has nine quests; q7–q9 are optional (`optionalQuestIds`). A lesson cell holds 3–6 required quests and, after them, at most 3 optional ones.
- **§3.1 item 4**: Word Builder's cap gains "or one family of finals with its end sound and its move before a vowel (q8: two bottom letters; q9: a bottom ㅎ quiet before a vowel), taught by word". U-3's Word Builder branch (`upper-stage-curriculum.test.ts:532-551`) needs no change: q7–q9 Discover no jamo item, so `discoverSymbols` is empty and `symbols.length <= 5` holds.
- **§3.1 item 6**: "… plus, from Word Builder on, the symbols Word Builder has taught; inside Word Builder also the finals of its optional q8 and q9, and from Stage 3 on final ㅎ only before a vowel (`AMENDMENTS-BATCHIM-COMPLETE.md` §3.8)".
- **§3.3**: three rows after q6 (§3.1 table above); the q5 note's "it appears later only in theme words (S2-1 deviation)" becomes "optional q9 teaches it before a vowel"; the q6 note's "double finals (겹받침 …) appear later as theme words only" becomes "optional q8 teaches ㄺ ㅄ ㄻ and q9 ㄶ ㅀ; from Stage 3 on they stay theme words"; the symbol accounting line is unchanged (q7–q9 add no symbol record).
- **§5**: U-2 is unchanged (finals still in exactly two quests by jamo item); U-4's text adds the §3.8 contexts.

### 3.11 Acceptance (whole WO)

1. Word Builder shows nine quests; q7, q8 and q9 follow q6 and are optional; a learner who finished q1–q6 before BC-1 keeps every star and card, the cell and Stage 2 stay done (My Route included), and the route does not move back to Stage 2; a new learner meets q7 right after q6.
2. Every q7–q9 Korean string has its romanization and en, es and ko glosses; the converter agrees with every romanization; no new `ROMANIZATION_EXCEPTIONS` entry.
3. U-1 to U-10, `lesson-check-variety`, `dictation-unambiguous`, `lesson-new-load`, `lesson-source-shape` and `culture-source` pass. The Check share is counted per tier and stage (`lesson-lint.ts:705-708`): Stage 2 Volume 1 has Listen & Pick 7, Type Hangul 7, Pic-Word Match 4 of 18 today, and 8 / 8 / 5 of 21 after q7–q9, the largest 38.1% (line 40%). A third Listen & Pick Check would make it 9 of 21 (42.9%) and fail, which is why q9's Check is Type Hangul.
4. U-4 accepts the §3.8 contexts and rejects the rest (fixtures in §6.1); today's content is unchanged and passes.
5. The seven new say clips (§6.3) are generated, QA'd, heard by the owner and committed before BC-1 merges.

---

## 4. Out of scope

- All of 제12항 1–3 (aspiration and ㄴ after ㅎ), 제11항's 다만 (ㄺ before ㄱ), double finals before a consonant, 제15항 (juncture), tensification as a rule, ㄳ ㄵ ㄼ ㄽ ㄾ ㄿ, and the 밟- / 넓- exceptions. The WO: "표준 발음법 조항 전체를 가르치려 하지 않는다."
- Stage 1's quests, Stage 1 copy, the letter wall and the Hangul Check's symbol count (still 30; Word Builder's 16 + 9 finals records unchanged).
- New symbol records for double finals or final ㅎ, new Discover views (a "table" view), new games, new WordArt (BC-OD-10, BC-OD-11).
- Scoring double finals from Stage 3 on, and scoring the Stage 3 theme sentences 연필이 없어요 and 책을 읽어요 (BC-OD-8).
- Letters Volume 2 (`letters.v2.json`) and its q1.
- The romanizer itself (WO-17) and romanization display modes (WO-10, WO-11).

---

## 5. UI sketch

No new screen or component: the quests use the shipped quest player, Discover word cards, Pic-Word Match, Listen & Pick (heard and Read Pick Meaning), Card Match and Type Hangul `see`. Existing wireframes cover them: `design/wireframes/quest/{player,discover,check}.md`, `design/wireframes/minigame/{pic-word-match,listen-pick,type-hangul}.md`. The one visible app change outside the quests is that My Route counts a cell complete over its required quests (§3.9 item 4), which the existing `design/wireframes/route/` pips already allow (an optional pip is a pip). No new wireframe or mock is needed. BC-1's PR shows one screenshot per quest at 320 px (Discover page 2 and the Check).

---

## 6. Tests

### 6.1 Test changes by row

| Row | File | Level | What |
|---|---|---|---|
| BC-2a | `packages/content-schema/src/__tests__/` (lesson schema tests) | unit | `optionalQuestIds` on a lesson cell: accepted when a suffix of the quest ids; rejected for an unknown id, a non-suffix list, an all-optional cell and on a Volume 2 file; 7–9 quests only when the ones past the sixth are optional |
| BC-2a | `packages/content-schema/src/__tests__/catalog-schema.test.ts` and the `expandCellRows` tests | unit | the eighth tuple slot gives `CatalogCell.optionalQuestIds`; absent slot = none |
| BC-2a | `scripts/__tests__/build-lessons*.test.mjs` | unit | the field goes from the cell file to the generated row and the manifest episode |
| BC-2a | `src/logic/my-route/__tests__/` (pips, view) | unit | a cell whose required quests are done is `complete` with an unplayed optional quest; Stage 1 with crafts-q4 unplayed likewise |
| BC-2a | review-item and cell-check tests | unit | an item taught only by an optional quest is outside the cell's mastery denominator and Cell Check until that quest is completed |
| BC-2a | `src/content/__tests__/helpers/reuse.ts`, `upper-stage-curriculum.test.ts` | unit | the context rule of §3.8 for both helpers (`untaughtSymbols` and `symbolKeysOf` / `undecodable`); passing fixtures: 닭, 값, 삶, 읽어요, 없어요, 좋아요, 많이, 괜찮아요, 싫어요; failing: 읽고, 읽는, 읽다, 없는, 없다, 값도, 좋고, 많다, 않네, 놓는, and 좋 alone; the q8 / q9 table; `WORD_BUILDER_SYMBOLS` without unconditional ㅎ; `:810` and `:818` updated to the new shape; the Stage 3+ U-4 loop (`:823-831`) passes on today's content |
| BC-1 | `upper-stage-curriculum.test.ts` U-1 to U-10 | integration | unchanged rules over the grown cell |
| BC-1 | pinned expectations | integration | `src/content/__tests__/episodes.test.ts:303` (nine ids, three optional); `src/logic/awards/__tests__/upper-cards.test.ts:96-107` (the card's time stays the latest **required** quest, T(6)); `src/logic/lecture/__tests__/quick-source.test.ts:39` (length); `packages/content-schema/src/__tests__/catalog-schema.test.ts:482-496` (ordered quest list); `packages/content-schema/src/__tests__/lecture-presets.test.ts:205` (the Stage 2 30-minute preset now picks q7); `apps/web/src/components/console/__tests__/grouped-lesson-picker.test.tsx:233-236` (`episodeDetail(9, …)`); `src/content/__tests__/read-pick-labels.test.ts:31` (q8's Read Pick Check) |
| BC-1 | new `src/content/__tests__/stage2-letters-final-sounds.test.ts` | integration | §3.2–§3.5 as data: q7–q9 exist, are optional and come last; Discover words and romanizations as §3.3–§3.5 tables (or a recorded BC-1 swap); every q8–q9 Discover word has `soundChange: true`; no heard round asks 입, 잎, 낮 or 삶, and none has two k / t / p options; no Type Hangul `hear` round; no string has a double final before a consonant or ㅎ / ㄶ / ㅀ outside "before a vowel"; q7 shows n7, q8 n8, q9 n9; q6's reward no longer says "last new letters" |
| BC-1 | `src/logic/__tests__/next-quest.test.ts` (or the nearest route test) | unit | with Word Builder q1–q6 and a Stage 3 quest done, the cursor does not return to q7; with q1–q6 done and nothing later, it offers q7 |
| BC-1 | `presenter-glyphs.test.ts`, `build-presenter-font.mjs --check` (CI `content-validation.yml:131`) | integration | the presenter font holds 닭 값 삶 괜 찮 싫 밭 (missing today) |
| BC-1 | `src/content/__tests__/audio-assets-drift.test.ts:80` | integration | the regenerated pack maps match the manifest after the pack moves (§6.3) |
| BC-1 | `packages/content-schema` `romanization` suite | unit | the new strings pass the converter comparison with no new exception |

### 6.2 Commands each row runs and pastes

`corepack pnpm --filter @hangul-route/content-schema test`, `corepack pnpm --filter @hangul-route/mobile test`, `corepack pnpm --filter @hangul-route/web test` (BC-1), `node scripts/validate-content.mjs`, `node scripts/build-lessons.mjs --check` and `--report`, `node scripts/generate.mjs --check`, `node scripts/build-presenter-font.mjs --check` (BC-1), and for BC-1 the release `build:web --budget`.

**Budgets (BC-1).** The Word Builder body chunk was 73,354 B raw / 12,727 B gzip for six quests (F-CURR-002 `:814`) under `BUDGET.cellChunkRaw` 90,000 / `cellChunkGzip` 16,000 (`build-lessons.mjs:108-109`); nine quests come to about 110 KB raw, and `totalRaw` (2,450,000 B, last measured 2,391,687 B) is close. BC-1 raises each line it crosses in one reviewed line with its measurement (the CM-41 to CM-44 practice), and records the start bundle (three manifest rows), the presenter font size and the learner precache.

### 6.3 Audio clips (owner)

Say clips are keyed by text and filed under the first pack that speaks them (AMENDMENTS-AUDIO-CLIPS AC-B6; `apps/mobile/scripts/audio/tts/manifest-lib.mjs:205`). Measured on `803208a95` (`content/audio/tts-manifest.json`, `apps/mobile/assets/audio/say/`) and confirmed by the review:

| Text | Today | After BC-1 |
|---|---|---|
| 밭, 닭, 값, 삶 | no row | **new** `syllable` rows (rate 0.85), pack `stage2` |
| 없어요, 괜찮아요, 싫어요 | no row | **new** `word` rows (rate 0.9), pack `stage2` |
| 읽어요, 좋아요, 넣어요 | clip exists, pack `review` | same clip, pack `stage2` |
| 많이 | clip exists, pack `stage4` | same clip, pack `stage2` |
| 꽃, 책, 밖, 입, 잎, 밥, 밤, 발, 공, 곰, 곧 and the other game words | clips exist | unchanged |

- **Owner: generate 7 new clips** (밭, 닭, 값, 삶, 없어요, 괜찮아요, 싫어요; more only if BC-1 swaps in a word with no row, and BC-1's PR lists the manifest diff) through `audio:tts:generate`, `audio:tts:qa` (Whisper pass) and `audio:tts:listen` (F-AUDIO-004). Listen for: 닭 said [닥] (not [달]), 값 [갑], 삶 [삼], 없어요 with the tense [써], 괜찮아요 and 싫어요 with no h sound.
- **No device voice for these quests.** q8's practice is heard rounds on said forms ([닥] [갑] [업써요]), and the owner has reported the device voice unclear (F-CURR-002 §7.1 CM-31 record, gate 5). Word Builder is a live `ready` cell, so q7–q9 reach learners on merge: the clips are committed on BC-1's branch before it merges (row BC-2b), never after.
- **Pack moves** happen when BC-1 regenerates the manifest, so BC-1 also runs `audio:map` and commits the moved pack chunks (`src/content/__generated__/audio-packs/`), or `audio-assets-drift.test.ts:80` fails.

---

## 7. Rollout and rows

Order: BC-0 → BC-2a → BC-1 (with BC-2b on its branch) → BC-3. BC-2a lands first, dark (no content uses it), so BC-1's content can declare its optional quests and pass U-4.

| Row | Model | Title (Conventional Commits) | Files | Tests | Acceptance |
|---|---|---|---|---|---|
| BC-0 | Opus 5.5 | `docs(specs): final sounds and double finals quests (review-2026-11 WO-15 BC-0)` | this file; "Amended" lines in F-CURR-001 and F-CURR-002; index line in `docs/specs/README.md` | — | multi-agent review passed, status `ready` |
| BC-2a | Sonnet 5.5 | `feat(content-schema): optional quests in a lesson cell, and decodable double finals (AMENDMENTS-BATCHIM-COMPLETE BC-2a)` | `packages/content-schema/src/schemas/lesson.ts`, `catalog/assemble.ts`, `scripts/build-lessons.mjs`, `src/logic/my-route/pips.ts`, `view.ts`, the review-item and cell-check files of §3.9 item 5, `src/content/__tests__/helpers/reuse.ts`, `upper-stage-curriculum.test.ts` | §6.1 BC-2a; content-schema stays at 100% coverage | no content change (`git diff --stat content/` empty); every suite green; U-4 passes today's content. **Built 2026-11-25 on `feat/optional-cell-quests`**: `optionalQuestIds` on a lesson cell (suffix of the quests, at most 3, none on Volume 2) and the cap 6 → 9 only past the sixth quest being optional; the generated row's eighth slot (the optional count, the volume slot reading 1) and the field on the manifest episode; My Route counts a cell over required quests (`Pip.optional`); mastery and Cell Check read `ReviewItem.optionalIn` (the extract records each optional quest's occurrences, an item a cell teaches only through them joins its denominator and Check once one is completed; an optional 14th chunk slot, so today's rows are unchanged); the same `cellHoldsItem` rule is on the other three paths that read `item.cells` for a cell's items (the Stage Check's `stageCheckItemIds`, the one-time memory seeding, the test-out's `cellStoreItems`), with the completed quests from `latchQuests(...).questDoneAt`; an item an optional quest teaches first keeps its later cells (`mergeGroup` also keeps the first cell with a required occurrence); the narrow bar's fill counts the optional quests played, so no bar falls at deploy; U-4's context rule (`finalContextProblems`, `WORD_BUILDER_FINAL_QUESTS`, `WORD_BUILDER_SYMBOLS` without unconditional ㅎ) |
| BC-1 | Opus 5.5 | `content(stage2): Word Builder q7-q9, seven end sounds, two bottom letters, a quiet h (AMENDMENTS-BATCHIM-COMPLETE BC-1)` | `content/episodes/stage-2/letters.json` (q7–q9, `optionalQuestIds`, `addedIn`, n7–n9, q6's reward line), `content/i18n/{es,ko}/lessons-stage2-letters.json`, generated outputs (lesson modules, catalogue, `items-stable-id.json`, `content/audio/tts-manifest.json`, audio pack maps, `apps/mobile/public/fonts/hr-presenter-kr.woff2` and its glyph sidecar), budget lines if crossed, the pinned tests of §6.1 BC-1 | §6.1 BC-1; §6.2 | §3.11 items 1–4; MAR passes recorded in the cell's `review.notes` (language, culture, learning design, reviser, independent es and ko); the PR lists the new manifest rows and the measured bytes; **merges only with BC-2b's clips on the branch** |
| BC-2b | owner + Sonnet 5.5 | `chore(audio): say clips for Word Builder q7-q9 (AMENDMENTS-BATCHIM-COMPLETE BC-2b)`, a commit on BC-1's branch | `apps/mobile/assets/audio/say/*.mp3` (7), `content/audio/tts-lock.json`, `content/assets-license.csv`, the regenerated audio packs | the audio drift and lock checks | the owner has generated and listened (§6.3) |
| BC-3 | Sonnet 5.5 | `docs(specs): Amended lines and index entry for final sounds; BC rows done (AMENDMENTS-BATCHIM-COMPLETE BC-3)` | this file (row states, As built), F-CURR-001 §3.1, §3.3, §5 and OD-2 text, F-CURR-002 §5.2 S1 row and the CM-44 S3 record, `docs/specs/README.md`, `docs/roadmap/review-2026-11/phase-2-hangul.md` (WO-15 re-check line) | — | the amended specs say what shipped; index line updated |

---

## 8. Dependencies

- **OD-R9** (2026-11-22, approved). **F-CURR-001** §3.1, §3.3, §5, OD-2 (amended). **F-CURR-002** §4.2 (optional quests), §4.5 (`dictation-unambiguous`), §5.2, §7.1 (Check rotation), the CM-31 and CM-44 S2 records (spelling round switch, `soundChange`).
- **WO-17 / `AMENDMENTS-ROMANIZER-GAPS.md`** (#1130, spec merged; rows RG-1 to RG-3 not built): no word here needs an exception; BC-1 re-runs the romanization suite on the main of its day (§3.7).
- **WO-10 / `AMENDMENTS-STAGE1-DECODING-CHECK.md`** (PR #1129, open): if DC-1 hides the Read Pick Meaning prompt's romanization in a Check, q8's Check measures reading even more directly; nothing here depends on it.
- **WO-11 / `AMENDMENTS-ROMANIZATION-FADE.md`** (#1128, spec merged; RF rows not built): its phase `all` starts when every id of `requiredQuestIds(episode:stage2-letters)` is done (its §3.4), so q7–q9, being optional, do not delay it, and the fade needs no change. A learner on **As I learn** who plays q7–q9 after q1–q6 is in phase `all`: their Discover word cards and games show romanization one tap away (Hear it still plays; Checks keep their own rule, RF §3.7). Accepted (BC-OD-17).
- **WO-12 / `AMENDMENTS-STAGE1-CONTENT-FIXES.md`** (#1127, spec merged): touches Stage 1 files only; no overlap.
- **F-AUDIO-004** (clip pipeline, QA, owner listen) and **AMENDMENTS-AUDIO-CLIPS** AC-B6 (packs). **F-I18N-001** §3.10 (es and ko review). **F-ROUTE-001** (My Route pips, §3.9 item 4).

---

## 9. Open decisions (adopted as recommended; owner instruction to proceed with recommendations)

| ID | Question | Options | Recommendation (adopted) |
|---|---|---|---|
| BC-OD-1 | Quest B (five double finals and final ㅎ): one quest or two? | (a) one quest, five symbols, two rules · (b) two quests: q8 ㄺ ㅄ ㄻ, q9 ㅎ ㄶ ㅀ | **(b)**: Word Builder's cap is "one family" (F-CURR-001 §3.1 item 4); ㄶ is governed by the ㅎ rule (제12항 4), not by 제14항, so it belongs with ㅎ. The WO allows the split |
| BC-OD-2 | Where do the quests go? | (a) Word Builder q7–q9 · (b) Stage 1 (the F-CURR-002 §5.2 S1 row) · (c) Letters Volume 2 · (d) a new cell | **(a)**: the WO says so; Stage 1 must not change; the [ㄷ] family is taught in q5; Volume 2 is dark (`volumes` pct 0). OD-R9's "Stage 2 앞에" read as "at the front of Stage 2" (§1.2) |
| BC-OD-3 | Required or optional? | (a) required: the cursor pulls every learner past Stage 2 back to Word Builder q7, and a finished Word Builder reads unfinished · (b) optional (`optionalQuestIds`, new for lesson cells) | **(b)**: the Stage 1 addition precedent (F-CURR-002 §4.2): offered in place, never pulls back, never needed for "done"; nothing a learner earned looks taken away. Cost: row BC-2a (schema, generator, My Route, mastery) and BC-OD-8 |
| BC-OD-4 | Discover by word items or by new symbol records for ㄺ ㅄ ㄻ ㄶ ㅀ ㅎ? | (a) words · (b) `wbf` records with clips, `teaches` keys, overlays | **(a)**: the WO sets a recognition goal; a final ㅎ has no sound of its own to play on a letter card; (b) would change U-2, the letter inventory, the browse and lecture symbol lists and the jamo clip set |
| BC-OD-5 | Add ㅀ (싫어요), beyond the WO's five? | (a) yes · (b) no | **(a)**: same rule as ㅎ and ㄶ; 좋아요 / 싫어요 is a pair learners use at once |
| BC-OD-6 | 않아요 for ㄶ? | (a) 않아요 · (b) 괜찮아요 | **(b)**: 않아요 alone is a helper verb with no plain gloss; 괜찮아요 is an everyday word with ㄶ |
| BC-OD-7 | Letters Volume 2 q1 "Seven Final Sounds" | (a) keep both, distinct titles · (b) fold v2 q1 into q7 | **(a)**: they teach different things (§1.3); Volume 2 is dark and reviewed |
| BC-OD-8 | "Un-excluding" from Stage 3 on | (a) inside Word Builder only; from Stage 3 on narrow final ㅎ to "before a vowel" and keep double finals untaught; leave the two theme sentences · (b) also count ㄺ ㅄ ㄻ ㄶ ㅀ as taught from Stage 3 on · (c) (b) plus scored rounds for 연필이 없어요 and 책을 읽어요 | **(a)**: q8–q9 are optional, so "passed Word Builder" no longer means they were played (review finding S7); a later content row that scores a double final decides it with its cell's MAR |
| BC-OD-9 | `WORD_BUILDER_SYMBOLS` holds ㅎ though no quest teaches it | (a) narrow ㅎ to "before a vowel" now that q9 teaches it · (b) leave it | **(a)**: makes the test say what is taught; today's 28 final-ㅎ reads are all before a vowel and keep passing |
| BC-OD-10 | Pictures for 닭, 값, 삶, 밭 | (a) none: read with gloss · (b) a new `animal-chicken` WordArt glyph (design pass, owner approval) | **(a)** in this WO; a chicken glyph is a later design row if wanted |
| BC-OD-11 | WO quest A asks for "a table" of the seven sounds | (a) Discover pages by sound + the Hoya line listing all seven + note n7 · (b) a new Discover table view (design + code) | **(a)**: no new UI; n5 already states the full table of letters to sounds |
| BC-OD-12 | Use the spelling round (same-sounding options) in q7? | (a) no · (b) yes | **(a)**: `game.spelling-pick` is at built-in pct 0, so it would play its fallback for everyone; Pic-Word Match on 입 / 잎 tests the same thing |
| BC-OD-13 | q9's Check kind | (a) Type Hangul `see` (copy; a produce round) · (b) Read Pick Meaning like q8 | **(a)**: (b) puts Stage 2 Volume 1's Listen & Pick Checks at 9 of 21 (42.9%, over the 40% line); q9's practice already tests reading |
| BC-OD-14 | Should lecture presets, the console's whole-episode pick and generated plans include optional quests? | (a) yes, in route order, as crafts-q4 today · (b) leave them out (code in three places) | **(a)**: no code; the pinned tests move (§6.1) |
| BC-OD-15 | 삶 (abstract, said like 삼) for ㄻ | (a) keep (the WO names it) · (b) 닮아요 or 젊어요 | **(a)**, with (b) allowed to BC-1 if its MAR prefers it |
| BC-OD-16 | Items taught only by an optional quest in the cell's mastery and Cell Check | (a) join them once the learner completes such a quest · (b) always (a Cell Check could ask 닭 unplayed) · (c) never | **(a)**: never asks what was not offered as played, and counts it once it was |
| BC-OD-17 | q7–q9 played after q1–q6 fall in the romanization fade's phase `all` (`AMENDMENTS-ROMANIZATION-FADE.md`), so their new words show romanization one tap away | (a) accept: Hear it plays every word and a tap shows the romanization · (b) keep `always` on these three quests (a new RF exception) | **(a)**: the fade's rule is one tap away, never gone; a per-quest exception would be a new RF rule for little gain |

---

## 10. Multi-agent review

Two independent reviewers on 2026-11-25, each given the files, not this spec's conclusions: **phon** (Korean phonology, pedagogy, word choice; fetched the NIKL page) and **eng** (engineering and content-pipeline feasibility; read the code, ran the converter and a scored-read scan).

| # | Lens | Finding | Outcome | Change |
|---|---|---|---|---|
| B1 | eng | A lesson cell holds at most 6 quests (`lesson.ts:313`); a nine-quest Word Builder fails every suite | accepted | §1.1 row 10; §3.9 item 2 (max 9, quests past the sixth optional); F-CURR-001 OD-2 amended |
| B2 | eng | The presenter font lacks 닭 값 삶 괜 찮 싫 (and 밭); CI's font check fails | accepted | BC-1 rebuilds the font and its sidecar (§6.1, §7) |
| B3 | eng | The Word Builder chunk (73,354 B for six quests) goes past `cellChunkRaw` 90,000 with nine | accepted | §6.2 Budgets: one-line raises with measurements in BC-1 |
| S1 | eng | The Check share is per tier and stage; the spec mixed Volume 2 in | accepted | §3.11 item 3: 7 / 7 / 4 of 18 → 8 / 8 / 5 of 21 (38.1%) |
| S2 | eng | Cell minutes are step seconds (25 today, not 24); the cited minutes test is the stories total | accepted | §3.1 Minutes; the test dropped from §6.1 |
| S3 | eng | Word Builder's U-4 uses `symbolKeysOf` / `undecodable` over every scope; the context rule must reach it; say where the per-quest table lands | accepted | §3.8 first bullet; §6.1 BC-2a |
| S4 | eng | Pack moves happen in BC-1, so BC-1 must regenerate the pack maps | accepted | §6.3 last bullet; §7 BC-1 files |
| S5 | eng | My Route counts every quest pip, so a finished Word Builder would read `partial` | accepted | §3.9 item 4 (required-only completion; also fixes crafts-q4) |
| S6 | eng | Mastery and Cell Check would include optional quests' items | accepted | §3.9 item 5, BC-OD-16 |
| S7 | eng | Loosening Stage 3+ U-4 for double finals rests on optional quests | accepted | §3.8 second bullet; BC-OD-8 rewritten |
| S8 | eng | Pinned tests BC-1 breaks (awards, lecture, catalogue, presets, web picker); presets and plans with optional quests is a product question | accepted | §6.1 BC-1; BC-OD-14 |
| S9 | eng | Heard rounds would use the device voice for new words on a live cell | accepted | §6.3; BC-2b is a commit on BC-1's branch before merge |
| S10 | eng | `addedIn` must be above main's version, not equal | accepted | §3.1 |
| N1–N7 | eng | Line refs (`assemble.ts:62`, `reuse.ts:223-236`, `:553-585`), shifted F-CURR line numbers, scope count (13 scopes / 10 quests), `soundChange` on `item.word`, keep q6's title, the tuple slot, the "New lessons" prompt | accepted | §1.1 note and rows; §3.2 item 3; §3.6; §3.9 item 3; §3.1 |
| P1 | phon | q9's Type Hangul `see` copies the word; the rationale overclaimed | accepted (kept the kind, BC-OD-13) | §3.5 rationale rewritten honestly |
| P2 | phon | "Before a consonant" for ㄺ ㅄ ㄻ is not taught (읽다 [익따], 없는 [엄는], 값도 [갑또]) | accepted | §1.4 last paragraph; §3.8 table; fixtures in §6.1 |
| P3 | phon | "The h is quiet" without "before a vowel" overgeneralises (좋고 [조코], 어떻게 [어떠케]) | accepted | q9 caption, intro; §3.2 item 9 |
| P4 | phon | q7 Check board 2 (붓 · 빛 · 책) did not test end sounds and repeated q5's Check | accepted | board 2 is 밥 / 발 / 곰 (or 공 / 곰 / 밥); only board 1 claims to measure reading |
| P5 | phon | q7 Apply needed named rounds; k / t / p together are hard to hear | accepted | four rounds named; at most one k / t / p per heard round (§3.2 item 5) |
| P6 | phon | n8's 없어요 example showed nothing in RR | accepted | n8 uses 읽어요 (ilgeoyo) |
| P7 | phon | Page 1 pairs 닭 (second letter) with 값 (first); "one rule" overstated | accepted | caption "The word shows which."; §3.4 goal; §3.10 item 4 wording |
| P8 | phon | 삶 is abstract and said like 삼 | partly: kept (WO) | BC-OD-15 lets BC-1 swap to 닮아요 / 젊어요 |
| P9 | phon | "No scored read has a double final" holds only for U-4's scopes; Stage 6 Cloze tiles and realia have some | accepted | §1.1 row 4, §3.8 third bullet |
| P10 | phon | 있어요 is not taught by q8 | accepted | removed from q8's example |
| P11 | phon | "Word Builder Done!" stays true | accepted | §3.6: only the second line changes |
| P12 | phon | 읽어요 "I read (it)" differs from the shipped gloss "read" | accepted | gloss "read"; §3.2 item 10 keeps shipped glosses |

Both reviewers confirmed: the quotes of 제8–15항 word for word against the NIKL page, the 제14항 해설 on 닭이 [다기], every pronunciation and romanization in §3.7 (the converter run independently), the decodability of every word at its quest, that all 28 final-ㅎ scored reads are before a vowel and no U-4 read has a double final, positional ids and catalogue growth, that lesson cells cannot set `optionalQuestIds` today, the note mapping (q7–q9 show n7–n9), `soundChange` reaching review items and Dictation, the triples and round counts against `ROUND_RANGE`, the seven missing clip rows and the `stage2` pack, and the §1.1 citations.
