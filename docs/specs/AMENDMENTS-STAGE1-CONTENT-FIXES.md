# AMENDMENTS-STAGE1-CONTENT-FIXES — small accuracy fixes in the Stage 1 content

Status: ready (revision 2, 2026-11-25, after the multi-agent review of §11; revision 1 the same day). Written for work order WO-12 of `docs/roadmap/review-2026-11/phase-2-hangul.md`, row CF-0, on main `8676b5de5`. The WO was written on `5573e1072` and re-checked on `d5ba0217c`. WO-12 holds only fixes that need no owner decision (the plan is approved, owner decision 2026-11-22, `docs/roadmap/review-2026-11/README.md` §4). Where this spec still had to choose, §10 lists the choice as an open decision with a recommendation, adopted provisionally.

**Amends** (each got its "Amended 2026-11-25 by AMENDMENTS-STAGE1-CONTENT-FIXES [CF]" line in row CF-0): F-QUEST-002 §3.6 (the quest list, the scope table and the Discover table: quest 6 reading words, quest 7 Check round 2, quests 11 and 15 Discover) and Appendix A (the final ㄹ hint) · F-I18N-001 §3.5 item 6 (the English sound-alike it quotes from `jamo.json` is gone) · `AMENDMENTS-AUDIO-CLIPS.md` M9 (the `jamo.json` drift test also covers `en`) · `AMENDMENTS-PICTURES-2026-11.md` PX-2 (the kite card's words now match its picture) · tag **[CF]**
**Not amended**: the order in which Stage 1 teaches the letters (the WO's "do not"), the Stage 1 claims of AU-15 (`packages/i18n/src/__tests__/stage1-claims.test.ts`), `jamoVoice` and the Discover buttons (WO-13), the Spanish and Korean `soundHint`s except the four that name a changed example word.
**Scope**: `apps/mobile/src/content/jamo.ts`, `content/heritage-cards.ts`, `content/quests.ts`, `logic/minigame-config.ts`; `content/episodes/stage-1/jamo.json`; `content/i18n/{es,ko}/stage1-jamo.json`, `stage1-cards.json`, `stage1-quests.json`, `minigames.json`; the tests and generated files these edits force (§3.4).
**Owner**: solo dev
**Rollout**: next release; content only, no flag

---

## 1. Context

### 1.1 The citations of WO-12, re-read on `8676b5de5`

None of the cited files changed between `d5ba0217c` and `8676b5de5`: `git diff --stat d5ba0217c 8676b5de5 -- apps/mobile/src/content/jamo.ts apps/mobile/src/content/quests.ts apps/mobile/src/logic/minigame-config.ts apps/mobile/src/content/heritage-cards.ts content/episodes/stage-1/jamo.json content/i18n/es/stage1-*.json content/i18n/ko/stage1-*.json` is empty. Lines in other specs (F-QUEST-002 Appendix A `:565`, `AMENDMENTS-PICTURES-2026-11.md:113`) are as on `8676b5de5`; the [CF] lines added in row CF-0 move them down by two.

| # | WO-12 says | On `8676b5de5` (file:line, text) | Verdict |
|---|---|---|---|
| 1 | `jamo.json:292` "EU — a soft sound between 'u' and 'i'"; the ko overlay says the same | `content/episodes/stage-1/jamo.json:292` `"en": "EU — a soft sound between 'u' and 'i'"`. ko `content/i18n/ko/stage1-jamo.json:118` `"gloss": "eu 소리: u와 i 사이의 부드러운 소리예요."`; es `content/i18n/es/stage1-jamo.json:118` `"gloss": "EU: un sonido suave entre la u y la i"` (the WO did not name es). The app hint is `jamo.ts:49` `'jamo:eu': 'say "oo" with flat lips'` | **valid** (A2): ㅡ is the high, back (or central, A4), unrounded vowel, made with the lips spread. "Between u and i" is vague rather than false: it leaves out the cue that matters, the spread, unrounded lips, so a reader hears a rounded ü; "say oo with flat lips" states that cue. And the record disagrees with the app |
| 2 | `jamo.json` "G — sounds like the start of 'go'", 'door', 'boy'; clashes with `jamo.ts:19` "no voiced English claims" | `jamo.json:6` `"G — sounds like the start of 'go'"`, `:32` `"D — sounds like the start of 'door'"`, `:71` `"B — sounds like the start of 'boy'"`; also `:110` `"J — sounds like the start of 'jump'"` (the same claim, not named by the WO). The rule is `jamo.ts:18-20`. es `gloss` makes the same voiced claim: `:8` «gato», `:18` «dedo», `:33` «bebé» | **valid** (A4): the lenis stops and affricate ㄱ ㄷ ㅂ ㅈ are voiceless at the start of a word (with some aspiration) and voiced only between voiced sounds |
| 3 | `jamo.json` gloss of 으뜸 is "first" | `jamo.json:298` `"en": "first"`; `jamo.ts:182` `exampleWordEn` `'first'` | **valid in part** (A3: 으뜸 is "많은 것 가운데 가장 뛰어난 것. 또는 첫째가는 것": the best, or the one ranked first; English "first" reads as first in time). **Absorbed by #9**: 으뜸 is replaced, so there is nothing left to re-gloss |
| 4 | `minigame-config.ts:151` `word('설', 'seol', 'New Year (short for seollal)')` | the same, `:151` | **valid** (A3: 설 is a headword of its own, "=설날", a synonym, not a short form; the dictionary splits the longer word as 설-날). **Resolved by #5**: the only use of `W.seol` (and of `W.nal`) is the Check round #5 replaces, so CF-1b deletes both entries. If §10 OD-CF4 keeps the round, the gloss becomes "Lunar New Year's Day" |
| 5 | `minigame-config.ts:383` quest 7 Check `lp.word(W.seollal, [W.seol, W.nal, W.dal])`; `quests.ts:283` 설날 `syllables: ['seol', 'lal']` | `minigame-config.ts:383` `rounds: [lp.syl('달', ['다', '단'], W.dal.en), lp.word(W.seollal, [W.seol, W.nal, W.dal])]`; `quests.ts:283` `{ ko: '설날', romanization: 'seollal', en: 'Lunar New Year', syllables: ['seol', 'lal'] }` (a theme page, "Words of Seollal") | **valid** (A1 article 20: ㄴ next to ㄹ is said [ㄹ], as in 칼날 [칼랄]). The first quest with final letters asks, in its Check, for a word whose sound is not its spelling, and the item is solved by length alone (one two-block option among three one-block options) |
| 6 | `jamo.ts:160` ㄹ IPA `'r'` | `jamo.ts:160` `c('rieul', 'ㄹ', 'r/l', 'rieul', 'r', '라면', …)`; the IPA is shown on the presenter's letter slide (`screens/presenter/slides/LetterSlide.tsx:121-122`, `[r]`) | **valid** (A4): ㄹ before a vowel is the tap [ɾ]; [r] is a trill |
| 7 | final ㄹ hint "like l in ball" | `jamo.ts:53` `'jamo:rieul-batchim': 'ends like l in "ball"'`; F-QUEST-002 Appendix A `:565` | **valid** (A5): English final l, as in "ball", is the dark l [ɫ]; Korean final ㄹ is a clear [l] with the tongue tip on the gum ridge (A4). The es hint «sol» and the ko hint (혀끝을 윗잇몸에 대고) are already right and do not change |
| 8 | `card:kite` says "diamond kite" but the fact names Bangpaeyeon; the picture was redrawn by PX-2 (#1039) | `heritage-cards.ts:65` `blurb` `'A diamond kite painted with a tiger\'s face.'`; fact `'Bangpaeyeon — shield kite — has a hole in the middle for steering.'`. `HeritageCardArt.tsx:607-621` draws the shield kite: a paper rectangle, bamboo sticks, a round hole, a red circle at the top, no face. es `stage1-cards.json` blurb «Una cometa en forma de rombo pintada con la cara de un tigre.»; ko «호랑이 얼굴을 그린 마름모꼴 연이에요.» | **valid** (A3: 방패연 is a rectangular kite with a hole in the middle). The picture is done; the words are not |
| 9 | `jamo.ts` example words 토끼 (ㅌ), 책 (ㅊ), 아빠 (ㅏ), 으뜸 (ㅡ) use letters Stage 1 never teaches; shown by `deck-builder.ts:485` and the ko hints | `jamo.ts:166` 책 (ㅐ), `:168` 토끼 (ㄲ), `:174` 아빠 (ㅃ), `:182` 으뜸 (ㄸ). `deck-builder.ts:485-487` puts the example on the presenter's letter slide; the ko `soundHint`s quote it (`stage1-jamo.json:51` ‘책’, `:61` ‘토끼’, `:76` ‘아빠’, `:116` ‘으뜸’), and the Discover page shows that hint under the letter and reads it in the letter's label (`discover-flow.ts:184-187, 225`). `jamo.json` repeats the four words (the drift test `stage1-jamo-json-drift.test.ts:43-48` makes it) | **valid**. The WO's list "ㅌ 토마토, ㅊ 차, ㅇ 아기, ㅡ 그림" has one slip: ㅇ's word 아이 uses only Stage 1 letters; 아기 is the fix for ㅏ (아빠). For ㅊ this spec takes 치마 rather than the WO's 차, because 차 is also ㅊ's spoken syllable and would show twice on the presenter's letter slide (§10 OD-CF1). Decodability at each letter's own quest is tabled in §3.3 |
| 10 | quest 6 (`life-q3`) reads four loanwords: 쿠키, 토마토, 코코아, 토스트 | `quests.ts:236-237` (examples 쿠키, 토마토), `:242-243` (words 코코아, 토스트); `minigame-config.ts:337-342` (Culture Quiz pairs), `:351` (Check `lp.word(W.tomato, [W.kokoa, W.kuki, W.toseuteu])`) | **valid as stated** (all four are loanwords). Loanwords are a sound way to practise decoding, so this is a balance fix, not an error: §10 OD-CF2 keeps the two loanwords that carry the new letters and replaces the other two |
| 11 | Linking (연음) is explained once, in quest 13 (`quests.ts:535`) | `quests.ts:535` `noteEn: 'Read it smoothly: nol + i sounds like nori.'` is the only `noteEn` in the Stage 1 quests | **valid** (A1 articles 13 and 15) |
| 12 | `quests.ts:595` "King Sejong made Hangul so everyone could read. Now you can read it too!" overclaims (six finals, no ㅐ ㅔ, tense consonants or compound vowels) | `quests.ts:595`, the same text; es and ko overlays say the same (`es/stage1-quests.json` `quest:stage1-crafts-q3` `steps.s1.hoyaLine`; ko the same key) | **valid**. AU-15 (#1035) lowered the stage-level lines; this quest line was left |
| 13 | initial ㅇ is only heard as 이응, so its silence cannot be checked by ear; add an "아 · 오 · 우" button on the ㅇ Discover page | `jamo.ts:164` ㅇ `spokenKind: 'name'`; `discover-flow.ts:217-220` gives ㅇ no second button. Quest 2's ㅇ card already carries the example 오 with its own play button (`quests.ts:82`), which says [o] | **valid in part**, and it is a Discover button change, not a content fix. **Moved to WO-13** (§10 OD-CF5): its SF rows rework the same Discover buttons (sound first) and own `discover-flow.ts` and `DiscoverStep.tsx` (README §6 serial-merge table) |

**The decodability check the WO asks for already exists**: `apps/mobile/src/content/__tests__/stage1-curriculum.test.ts` T3 (`:658-671`, every scope symbol, word and Check option is taught by this quest or earlier) and T7 (`:762-780`, every Discover reading word). It does not cover the letter records' example words (`jamo.ts` `exampleWordKo`), which no quest page shows; CF-1a adds that test (§6).

### 1.2 Where each string is seen

| Item | Learner surface | Grown-up surface |
|---|---|---|
| #1, #2 (`jamo.json` `en`, overlay `gloss`) | none: no app or site screen reads `jamo.json` `en` or the jamo overlay `gloss` today (the report's letter tiles read `soundHint`, `LearnerReportScreen.tsx:160-166` and `AccountLearnerReportScreen.native.tsx:104-108`). The story importer reads `ko`, `romanization` and `kind` only (`scripts/import-heritage.mjs:708`) | none |
| #5 | quest 7 Check, quest 7 Discover theme page | Browse preview |
| #6 | none | the presenter's letter slide |
| #7 | Discover (final ㄹ), its screen-reader label | report letter tiles |
| #8 | the kite card (Library, reward) | the same |
| #9 | Discover hint under ㅊ ㅌ ㅏ ㅡ in the Korean UI only (the English and Spanish hints name no word) | the presenter's letter slide (example line), the ko report tiles |
| #10, #11, #12 | quests 6, 11, 15 | Browse preview |

### 1.3 Authorities (all opened 2026-11-25)

| Id | Source | What it supports |
|---|---|---|
| A1 | 국립국어원, 표준어 규정 제2부 표준 발음법 (한국어 어문 규범): https://korean.go.kr/kornorms/regltn/regltnView.do?regltn_code=0002&regltn_no=191 | 제4항: ㅡ is a monophthong. 제13항: a final before a vowel-initial particle, ending or suffix moves to the next syllable as it is (깎아 [까까], 옷이 [오시]). 제15항: before a vowel-initial content morpheme the final moves as its representative sound (밭 아래 [바다래]). 제20항: "‘ㄴ’은 ‘ㄹ’의 앞이나 뒤에서 [ㄹ]로 발음한다" (칼날 [칼랄], 물난리 [물랄리]) |
| A2 | 김선철, 「단모음(單母音)의 발음법」, 새국어소식 2003년 8월 [표준 발음법의 이해], 국립국어연구원: https://www.korean.go.kr/nkview/nknews/200308/61_5.html | ㅡ sits in the high, back, unrounded cell; "/ㅡ/는 앞니를 거의 열지 않은 채로 입을 양쪽으로 벌리면서 소리 내야 한다" (lips spread): the ㅜ tongue with flat lips |
| A3 | 국립국어원 표준국어대사전 (https://stdict.korean.go.kr/, served at kdict.korean.go.kr): 설¹ "우리나라 명절의 하나. 정월 초하룻날이다.=설날"; 설-날 "우리나라 명절의 하나. 정월 초하룻날이다.≒설"; 으뜸 "많은 것 가운데 가장 뛰어난 것. 또는 첫째가는 것"; 방패연 "방패 모양으로 만든 연 … 가운데는 구멍을 내어 …"; 한국-어 (韓國語) "한국인이 사용하는 언어"; 목-요일. Search pages: `https://kdict.korean.go.kr/standard/search/searchResult.do?pageSize=10&searchKeyword=<word>` | #3, #4, #8, the glosses of §3.2 |
| A4 | "Korean phonology", Wikipedia: https://en.wikipedia.org/wiki/Korean_phonology (sections Consonants: Plain, Sonorants, Positional allophones; Vowels) | the plain stops are voiced between sonorants and voiceless elsewhere, with some aspiration word-initially; ㄹ is the tap [ɾ] between vowels and [l] (or [ɭ]) at the end of a word; ㅡ is [ɯ] / [ɨ], unrounded. Primary source behind it: Cho, Jun and Ladefoged (2002), "Acoustic and aerodynamic correlates of Korean stops and fricatives", *Journal of Phonetics* 30 |
| A5 | "English phonology", Wikipedia: https://en.wikipedia.org/wiki/English_phonology (Consonants: Sonorants) | RP has clear [l] before a vowel and dark (velarized) [ɫ] before a consonant or at the end before silence; in General American /l/ is generally dark |

## 2. User story

> As a learner, every hint, example word and Check in Stage 1 tells me the truth about how Korean sounds, uses only letters I can learn in Stage 1, and does not test me on a sound change nobody has shown me.
>
> As a parent or teacher showing a letter on the big screen, the example word under it is one my learner can read by the end of Stage 1, and the sound mark is right.

## 3. Acceptance criteria

### 3.1 The changes (English base)

Each row: file and line on `8676b5de5`, the current text, the new text. Lines move as rows land; the text is the key.

| # | Row | File:line | Current | New |
|---|---|---|---|---|
| 5 | CF-1b | `minigame-config.ts:383` | `lp.word(W.seollal, [W.seol, W.nal, W.dal])` | `lp.word(W.mun, [W.mul, W.dal, W.san])` (hear 문, pick among 문 물 달 산: the four Build a Block syllables of the quest, `:373-378`; 문 and 물 differ only in the final it teaches) |
| 5 | CF-1b | `minigame-config.ts` W table (`:149-150`) | no `mul` entry | add `mul: word('물', 'mul', 'water'),` after `mun` |
| 4, 5 | CF-1b | `minigame-config.ts:151-152` | `seol: word('설', 'seol', 'New Year (short for seollal)'),` and `nal: word('날', 'nal', 'day'),` | deleted (no other use) |
| 5 | CF-1b | `quests.ts:283` | `{ type: 'word', word: { ko: '설날', … syllables: ['seol', 'lal'] }, picture: 'card:seollal' }` | the same item plus `noteEn: 'Here n sounds like l: seol + nal sounds like seollal.'` (53 characters; the `noteEn` limit is 80, `quest.ts:52`). The word stays on the theme page only |
| 6 | CF-1a | `jamo.ts:160` | IPA `'r'` | `'ɾ'` |
| 7 | CF-1a | `jamo.ts:53` | `'ends like l in "ball"'` | `'ends in a clear l, tongue tip behind the top teeth'` (50 characters; `soundHint` limit 60, `content-schema/src/schemas/jamo.ts:34`). "Tongue tip up" alone is true of the English dark l too; what makes the dark l is the raised back of the tongue, so the hint names where the tip sits, as the ko hint does (혀끝을 윗잇몸에 대고) |
| 8 | CF-1a | `heritage-cards.ts:65` blurb | `'A diamond kite painted with a tiger\'s face.'` | `'A paper kite on bamboo sticks, with a red circle at the top.'` (describes the PX-2 picture; the fact keeps the hole). Fact unchanged |
| 9 | CF-1a | `jamo.ts:166` ㅊ | `'책', 'chaek', 'book'` | `'치마', 'chima', 'skirt'` (native, starts with ㅊ, readable in quest 4: ㅊ ㅣ ㅁ ㅏ) |
| 9 | CF-1a | `jamo.ts:168` ㅌ | `'토끼', 'tokki', 'rabbit'` | `'토마토', 'tomato', 'tomato'` (the quest 6 example under ㅌ, `quests.ts:237`) |
| 9 | CF-1a | `jamo.ts:174` ㅏ | `'아빠', 'appa', 'dad'` | `'아기', 'agi', 'baby'` (the quest 5 word, `quests.ts:197`) |
| 9, 3 | CF-1a | `jamo.ts:182` ㅡ | `'으뜸', 'eutteum', 'first'` | `'그림', 'geurim', 'picture'` |
| 9 | CF-1a | `jamo.json:126-130, 152-156, 191-195, 295-299` (the four `exampleWord`s) | 책 chaek "book"; 토끼 tokki "rabbit"; 아빠 appa "dad"; 으뜸 eutteum "first" | 치마 chima "skirt"; 토마토 tomato "tomato"; 아기 agi "baby"; 그림 geurim "picture" (forced by the drift test, so it lands in CF-1a, not CF-2) |
| 10 | CF-1b | `quests.ts:223` blurb | `'Two puff-of-air letters, k and t, and picnic snacks to read.'` | `'Two puff-of-air letters, k and t, and picnic words to read.'` |
| 10 | CF-1b | `quests.ts:226` intro `hoyaLineEn` | `'Picnic time! What snacks did we pack?'` | `'Picnic time! Let\'s read picnic words!'` (an acorn is not a packed snack) |
| 10 | CF-1b | `quests.ts:242-243` (quest 6, Discover page 2) | word 코코아 kokoa "cocoa" `['ko','ko','a']`; word 토스트 toseuteu "toast" `['to','seu','teu']` | word 고구마 goguma "sweet potato" `['go','gu','ma']`; word 도토리 dotori "acorn" `['do','to','ri']` |
| 10 | CF-1b | `minigame-config.ts:145, 147` W table | `kokoa`, `toseuteu` | replaced by `goguma: word('고구마', 'goguma', 'sweet potato', ['go', 'gu', 'ma'])`, `dotori: word('도토리', 'dotori', 'acorn', ['do', 'to', 'ri'])` |
| 10 | CF-1b | `minigame-config.ts:337-342` Culture Quiz | 토마토 Tomato, 코코아 Cocoa, 쿠키 Cookie, 토스트 Toast, 김밥 Kimbap | 토마토 Tomato, 고구마 Sweet potato, 쿠키 Cookie, 도토리 Acorn, 김밥 Kimbap |
| 10 | CF-1b | `minigame-config.ts:351` Check round 2 | `lp.word(W.tomato, [W.kokoa, W.kuki, W.toseuteu])` | `lp.word(W.dotori, [W.tomato, W.kuki, W.goguma])` (도토리 and 토마토 both hold ㅌ and ㅗ: a reading item, not a length item) |
| 11 | CF-1b | `quests.ts` quest 11 Discover (`:445-461`) | two pages; `durationSeconds: 40` (`:460`) | a third page, no caption, one item: `{ type: 'word', word: { ko: '얼음', romanization: 'eoreum', en: 'ice', syllables: ['eo', 'reum'] }, noteEn: 'Read it smoothly: eol + eum sounds like eoreum.' }`; `durationSeconds: 60` (F-QUEST-002 §3.6: 60 s for 3 pages) |
| 11 | CF-1b | `quests.ts` quest 15 Discover (`:600-618`) | two pages; `durationSeconds: 40` (`:617`) | a third page, no caption, one item: `{ type: 'word', word: { ko: '한국어', romanization: 'hangugeo', en: 'the Korean language', syllables: ['han', 'gu', 'geo'] }, noteEn: 'Read it smoothly: hanguk + eo sounds like hangugeo.' }`; `durationSeconds: 60` |
| 12 | CF-1b | `quests.ts:595` | `'King Sejong made Hangul so everyone could read. Now you can read it too!'` | `'King Sejong made Hangul so everyone could read. Now you can read Korean words too!'` |

Notes on the choices:

- **#11 words.** Both are decodable once quest 10 has taught the finals ㅁ and ㄱ (§3.3), hold one link only, and are covered by a cited rule: 얼음 = 얼- + the suffix -음, article 13 ([어름]); 한국어 = 한국-어 (A3 splits it so), [한구거]: article 13 if 어 is read as a suffix, and article 15 gives the same sound, since ㄱ is its own representative sound. The WO's 음악 and 목요일 are decodable too, but neither fits a theme of quests 11–15 and their linking is inside a Sino-Korean word, which A1 does not state as an example; §10 OD-CF3 keeps them as alternatives. The note format copies quest 13's (`quests.ts:535`). Quest 11's minutes: 8 + 60 + 75 + 60 + 35 + 8 = 246 s, still 4 (T10); quest 15 the same.
- **#5 note.** It names the sound change instead of "Read it smoothly", because 설날 is not linking but ㄴ said as ㄹ (A1 article 20).
- **#8.** The picture's red circle is the 꼭지 of the shield kite (PX-2: "the rectangular shield kite with the centre hole and the red top circle", `AMENDMENTS-PICTURES-2026-11.md:113`).
- **#12.** The stage-level lines (AU-15) say "basic Hangul" and "the basic letters"; this line now claims "Korean words", which the learner has read since quest 2 and quest 15 adds to (not "your first": quest 3's intro already says "you can read real words!"). The step title "You Can Read!" (`:595`) stays (§10 OD-CF6).

### 3.2 Spanish and Korean overlay values

Every value below replaces or adds a shipped es or ko value (`LOCALE_STATUS` es and ko `'shipped'`, `packages/i18n/src/locales.ts:31-35`). These are content overlays, not `packages/i18n` messages, so **no R8 run**: by F-I18N-001 §3.10 item 4 "a PR that changes a shipped es / ko value runs the MAR of that key in the same PR". The drafts here follow the existing style of each file (ko glosses are short dictionary-style descriptions, as today; OD-R5's picture-first Korean gloss is WO-24's job). The row's MAR (two lenses at least: native language and naturalness, tone and length) may reword them; it lists every finding in the PR.

| # | Row | File, entry, key | Current | New (draft for the MAR) |
|---|---|---|---|---|
| 9 | CF-1a | `es/stage1-jamo.json` `jamo:chieut` `exampleWord.gloss` | libro | falda |
| 9 | CF-1a | `ko/stage1-jamo.json` `jamo:chieut` `exampleWord.gloss` | 글과 그림을 묶어 만든 읽을거리 | 허리에 둘러 입는 옷 |
| 9 | CF-1a | `ko/…` `jamo:chieut` `soundHint` | ‘책’의 첫소리. ch 소리에 바람을 세게 내보내요. | ‘치마’의 첫소리. ch 소리에 바람을 세게 내보내요. |
| 9 | CF-1a | `es/…` `jamo:tieut` `exampleWord.gloss` | conejo | tomate |
| 9 | CF-1a | `ko/…` `jamo:tieut` `exampleWord.gloss` | 귀가 길고 깡충깡충 뛰는 동물 | 빨갛고 동그란 열매 채소 (the quest 6 gloss of 토마토) |
| 9 | CF-1a | `ko/…` `jamo:tieut` `soundHint` | ‘토끼’의 첫소리. t 소리에 바람을 세게 내보내요. | ‘토마토’의 첫소리. t 소리에 바람을 세게 내보내요. |
| 9 | CF-1a | `es/…` `jamo:a` `exampleWord.gloss` | papá | bebé |
| 9 | CF-1a | `ko/…` `jamo:a` `exampleWord.gloss` | 아버지를 다정하게 부르는 말 | 아주 어린 아이 (the quest 5 gloss of 아기) |
| 9 | CF-1a | `ko/…` `jamo:a` `soundHint` | ‘아빠’의 아 소리. 입을 크게 벌려요. | ‘아기’의 아 소리. 입을 크게 벌려요. |
| 9 | CF-1a | `es/…` `jamo:eu` `exampleWord.gloss` | lo mejor, lo primero | dibujo |
| 9 | CF-1a | `ko/…` `jamo:eu` `exampleWord.gloss` | 가장 좋거나 첫째가는 것 | 선이나 색으로 모양을 나타낸 것 |
| 9 | CF-1a | `ko/…` `jamo:eu` `soundHint` | ‘으뜸’의 으 소리. 입술을 옆으로 펴요. | ‘그림’에 있는 으 소리. 입술을 옆으로 펴요. (quotes only the example word, as `overlays.test.ts:433-448` requires) |
| 8 | CF-1a | `es/stage1-cards.json` `card:kite` `blurb` | Una cometa en forma de rombo pintada con la cara de un tigre. | Una cometa de papel con varillas de bambú y un círculo rojo arriba. |
| 8 | CF-1a | `ko/stage1-cards.json` `card:kite` `blurb` | 호랑이 얼굴을 그린 마름모꼴 연이에요. | 대나무 살에 종이를 붙여 만든 연이에요. 위쪽에 빨간 동그라미가 있어요. |
| 5 | CF-1b | `es/minigames.json` `minigame:s1-rites-q1-check` `listenPick.rounds.1.prompt` | Año Nuevo lunar | puerta |
| 5 | CF-1b | `ko/minigames.json` same key | 음력 새해 첫날 명절 | 드나들 때 여닫는 것 (the quest 7 gloss of 문) |
| 5 | CF-1b | `es/stage1-quests.json` `quest:stage1-rites-q1` `steps.s2.discover.pages.1.items.0.note` (new) | — | Aquí la n suena como l: seol + nal suena como seollal. |
| 5 | CF-1b | `ko/stage1-quests.json` same key (new) | — | 여기서는 n이 l처럼 소리 나요. seol + nal은 seollal처럼 소리 나요. |
| 10 | CF-1b | `es/stage1-quests.json` `quest:stage1-life-q3` `blurb` | Dos letras con soplo de aire, k y t, y meriendas de pícnic para leer. | Dos letras con soplo de aire, k y t, y palabras de pícnic para leer. |
| 10 | CF-1b | `ko/…` same key | 바람을 세게 내는 글자 k, t와 소풍 간식 낱말을 읽어요. | 바람을 세게 내는 글자 k, t와 소풍 낱말을 읽어요. |
| 10 | CF-1b | `es/…` `quest:stage1-life-q3` `steps.s1.hoyaLine` | ¡Hora del pícnic! ¿Qué meriendas llevamos? | ¡Hora del pícnic! Vamos a leer palabras del pícnic. |
| 10 | CF-1b | `ko/…` same key | 소풍 시간이에요! 어떤 간식을 챙겼을까요? | 소풍 시간이에요! 소풍 낱말을 읽어 봐요! |
| 10 | CF-1b | `es/…` `quest:stage1-life-q3` `steps.s2.discover.pages.1.items.0.word.gloss` | cacao | camote, batata |
| 10 | CF-1b | `ko/…` same key | 초콜릿 맛이 나는 따뜻한 음료 | 땅속에서 자라는 달콤한 뿌리채소 |
| 10 | CF-1b | `es/…` `…pages.1.items.1.word.gloss` | pan tostado | bellota |
| 10 | CF-1b | `ko/…` same key | 노릇하게 구운 빵 | 참나무에 열리는 작은 열매 |
| 10 | CF-1b | `es/minigames.json` `minigame:s1-life-q3-apply` | `cardPairs.kokoa.gloss` Cacao, `cardPairs.toseuteu.gloss` Pan tostado | removed; added `cardPairs.goguma.gloss` Camote, batata and `cardPairs.dotori.gloss` Bellota |
| 10 | CF-1b | `ko/minigames.json` same entry | `cardPairs.kokoa.gloss`, `cardPairs.toseuteu.gloss` | removed; added `cardPairs.goguma.gloss` 땅속에서 자라는 달콤한 뿌리채소 and `cardPairs.dotori.gloss` 참나무에 열리는 작은 열매 |
| 10 | CF-1b | `es/minigames.json` `minigame:s1-life-q3-check` `listenPick.rounds.1.prompt` | tomate | bellota |
| 10 | CF-1b | `ko/minigames.json` same key | 빨갛고 동그란 열매 채소 | 참나무에 열리는 작은 열매 |
| 11 | CF-1b | `es/stage1-quests.json` `quest:stage1-nature-q2` `steps.s2.discover.pages.2.items.0.word.gloss` / `.note` (new) | — | hielo / Léelo de corrido: eol + eum suena como eoreum. |
| 11 | CF-1b | `ko/…` same keys (new) | — | 물이 얼어서 굳은 것 / 이어서 읽어요. eol + eum은 eoreum처럼 소리 나요. |
| 11 | CF-1b | `es/…` `quest:stage1-crafts-q3` `steps.s2.discover.pages.2.items.0.word.gloss` / `.note` (new) | — | el idioma coreano / Léelo de corrido: hanguk + eo suena como hangugeo. |
| 11 | CF-1b | `ko/…` same keys (new) | — | 한국 사람이 쓰는 말 / 이어서 읽어요. hanguk + eo는 hangugeo처럼 소리 나요. |
| 12 | CF-1b | `es/…` `quest:stage1-crafts-q3` `steps.s1.hoyaLine` | El rey Sejong creó el hangul para que todo el mundo pudiera leer. ¡Ahora tú también puedes leerlo! | El rey Sejong creó el hangul para que todo el mundo pudiera leer. ¡Ahora tú también puedes leer palabras en coreano! |
| 12 | CF-1b | `ko/…` same key | 세종대왕은 모두가 글을 읽을 수 있도록 한글을 만들었어요. 이제 여러분도 한글을 읽을 수 있어요! | 세종대왕은 모두가 글을 읽을 수 있도록 한글을 만들었어요. 이제 여러분도 한국어 낱말을 읽을 수 있어요! |

The new ko notes attach 은 / 는 to fixed romanization written in the string (nal, eum, eo), never to a variable, so the particle rule of F-I18N-001 §3.10 holds; the pattern is the shipped 놀이 note's (`ko/stage1-quests.json`, "nol + i는 nori처럼").

### 3.3 Example words: Stage 1 letters only, and when each becomes readable

A letter record's example word (`jamo.ts` `exampleWordKo`) must use only the 30 Stage 1 symbols. This table is the WO's check, by hand, of the first quest after which each word reads with the letters taught so far (quests 1–10 teach; ㅐ ㄲ ㅃ ㄸ are never taught in Stage 1). "At its quest" means readable in the quest that teaches the letter.

| Letter (quest) | Example now | First readable | Example after CF-1a | First readable |
|---|---|---|---|---|
| ㄱ (1) | 가족 | 9 (ㅈ q4, final ㄱ q9) | unchanged | 9 |
| ㄴ (1) | 나무 | 2 | unchanged | 2 |
| ㄷ (3) | 달 | 7 | unchanged | 7 |
| ㄹ (3) | 라면 | 8 (ㅕ) | unchanged | 8 |
| ㅁ (2) | 물 | 7 | unchanged | 7 |
| ㅂ (5) | 밥 | 10 | unchanged | 10 |
| ㅅ (5) | 산 | 7 | unchanged | 7 |
| ㅇ (2) | 아이 | 3 | unchanged | 3 |
| ㅈ (4) | 집 | 10 | unchanged | 10 |
| ㅊ (4) | 책 | **never** (ㅐ) | 치마 | **4, at its quest** |
| ㅋ (6) | 코 | 6, at its quest | unchanged | 6 |
| ㅌ (6) | 토끼 | **never** (ㄲ) | 토마토 | **6, at its quest** |
| ㅍ (8) | 포도 | 8, at its quest | unchanged | 8 |
| ㅎ (9) | 하늘 | 9, at its quest | unchanged | 9 |
| ㅏ (1) | 아빠 | **never** (ㅃ) | 아기 | 3 |
| ㅑ (8) | 야구 | 8, at its quest | unchanged | 8 |
| ㅓ (1) | 엄마 | 10 | unchanged | 10 |
| ㅕ (8) | 여우 | 8, at its quest | unchanged | 8 |
| ㅗ (2) | 오리 | 3 | unchanged | 3 |
| ㅛ (9) | 요리 | 9, at its quest | unchanged | 9 |
| ㅜ (2) | 우유 | 9 (ㅠ) | unchanged | 9 |
| ㅠ (9) | 유리 | 9, at its quest | unchanged | 9 |
| ㅡ (3) | 으뜸 | **never** (ㄸ) | 그림 | 10 |
| ㅣ (3) | 이름 | 10 | unchanged | 10 |

Result: never readable in Stage 1, 4 → 0; readable at the letter's own quest, 7 → 9; every example readable by quest 10. Making every word readable at its own quest does not fit quest 1's letters (with ㅏ ㅓ ㄱ ㄴ only 나 "I", 너 "you", 가 and 거 can be written: no picturable noun), so CF-1a's test pins "Stage 1 symbols only" and this table stays a record (§10 OD-CF1). The quest's own Discover examples, which the learner meets on the page, are already readable at their quest (T7).

### 3.4 What the edits force (same PR as the edit)

- **Positional overlay pins** (`apps/mobile/src/content/__tests__/fixtures/overlay-ko-pins.json`, test `overlays.test.ts:458-517`): `jamo:a` 아빠 → 아기, `jamo:chieut` 책 → 치마, `jamo:eu` 으뜸 → 그림, `jamo:tieut` 토끼 → 토마토 (CF-1a); `minigame:s1-rites-q1-check listenPick.rounds.1.prompt` 설날 → 문, `minigame:s1-life-q3-check listenPick.rounds.1.prompt` 토마토 → 도토리, `quest:stage1-life-q3 …pages.1.items.0.word.gloss` 코코아 → 고구마, `…items.1.word.gloss` 토스트 → 도토리, and new rows for `quest:stage1-rites-q1 …pages.1.items.0.note` 설날, `quest:stage1-nature-q2 …pages.2.items.0.word.gloss` and `.note` 얼음, `quest:stage1-crafts-q3 …pages.2.items.0.word.gloss` and `.note` 한국어 (CF-1b). A pin moves only after the row's MAR has read the new translation against the new Korean.
- **Review items** (F-CURR-002 §4.2): `packages/content-schema/src/review-items/stage1-items.json` is re-extracted (`apps/mobile/src/content/__tests__/review-items-stage1.test.ts` fails until it is), and `node scripts/build-review-items.mjs --freeze` adds the new items: `lex` 고구마, 도토리, 한국어 and 문 (a Check round's answer word is a `lex` item, as 설날 is at `stage1-items.json:187`; `items-stable-id.json` holds `syl|문` but no `lex|문`); 얼음 already has a frozen id, `vocab:eoreum`. `lex:kokoa` and `lex:toseuteu` (`items-stable-id.json:407, 550`) are taught by no other source and go to `retired` in the same PR (a learner's state for them stays, out of selection and denominators). CF-1b lists the build's own report of new and retired ids in the PR; any id beyond these six (four new, two retired) stops the row (it would mean another source changed).
- **Clip manifest**: `pnpm --filter @hangul-route/mobile audio:tts:manifest` is run and `content/audio/tts-manifest.json` committed (`apps/mobile/scripts/__tests__/tts-manifest-drift.test.mjs`). Letter records' example words are not in the manifest (`apps/mobile/scripts/audio/content-sources.mjs` reads no `exampleWord`), so CF-1a needs no clip; 물, 토마토 and 얼음 (`audio/vocab/eoreum.mp3`) already have clips. Only 고구마, 도토리, 한국어 (and 문 if the manifest asks for a word-kind row besides its syllable row) are new spoken texts: they have no file yet and play through the device voice (F-AUDIO-004 AD4) until the next clip round of `AMENDMENTS-AUDIO-CLIPS.md` generates them (Polly Neural `Seoyeon`, the two acoustic passes, the owner's listening); that round is not part of this spec.
- **Orphaned clips** (CF-1b): the manifest rows of 설 (`tts-manifest.json:133`) and 날 (`:92`) have `minigame:s1-rites-q1-check` as their only source, so the regenerated manifest drops them; 코코아 (`:181`) and 토스트 (`:185`) also lose every source unless the builder still walks the retired items `lex:kokoa` and `lex:toseuteu`. A say clip with no manifest row stops `audio:map` and so `build:web` (`apps/mobile/scripts/audio/lib.mjs:99-107`, `splitAssetMap`). For every row the regenerated manifest drops, CF-1b deletes the mp3 in `apps/mobile/assets/audio/say/`, its rows in `content/assets-license.csv` and `content/audio/tts-lock.json`, and re-runs `pnpm --filter @hangul-route/mobile audio:map` (committing the regenerated `src/content/__generated__/audio-packs/` files); the PR lists the removed refs.
- **Tests that pin old strings** (update in the same row, each named in the PR): `stage1-curriculum.test.ts:244-260` (quest 7 Check table), `:337-353` (quest 6 Check table), `:465-496` (quests 11–15 Discover: two pages and four reading words become three pages for quests 11 and 15, and five reading words); e2e `apps/mobile/e2e/web/nature-crafts-quests.spec.ts:125-136` and `:240-249` (each walks two Discover pages then taps Skip for now; it gains a third `nextPage`, checks 얼음 / 한국어 and their notes, and takes a screenshot of the new page), e2e `apps/mobile/e2e/web/card-award-quest.spec.ts:100` (`{ answer: '설날' }` → `'문'`), `answer-feedback.spec.ts:43` and `axe-smoke.spec.ts:142` (the Culture Quiz map: 코코아 Cocoa, 토스트 Toast → 고구마 Sweet potato, 도토리 Acorn); any other test the full suite names.
- **F-QUEST-002 §3.6 tables** are amended by this spec (the [CF] line); the tables themselves are edited in row CF-3.

### 3.5 The `jamo.json` text field follows the app (row CF-2)

`content/episodes/stage-1/jamo.json` keeps its role (the story importer's letter list) but stops carrying its own English sound-alikes:

- every one of the 24 entries' `en` equals the letter's `SOUND_HINTS` text in `jamo.ts` (after CF-1a), word for word, for example `jamo:eu` `"say \"oo\" with flat lips"` and `jamo:giyeok` `"a soft, light g (between g and k)"`. This fixes #1 and #2 (and ㅈ "jump", `:110`) and every future drift.
- in `content/i18n/{es,ko}/stage1-jamo.json`, each of the 24 `gloss` values equals the same entry's `soundHint` (already reviewed text, written fresh for each language). This replaces the es voiced sound-alikes («G: suena como el inicio de «gato»», «dedo», «bebé») with the reviewed "between g and k" hints, which still name «gato» and «casa» but no longer claim a voiced sound, and the es and ko ㅡ "between u and i" (§1.1 #1, #2).
- Changed values: 24 `en`, 24 es `gloss`, 24 ko `gloss`. No learner or grown-up screen shows them today (§1.2), so the change is not visible; the MAR of the row is still run (§3.2 rule) and may be short: each new value is a copy of a reviewed one.

## 4. Out of scope

- The order letters are taught in (WO "do not"; `phase-2-hangul.md` §"이 Phase 에 넣지 않은 것").
- New Korean sentences.
- #13 (moved to WO-13, OD-CF5).
- New clips for the new words (the clip pipeline's next round).
- Deleting `jamo.json` (`docs/launch/product-review-2026-11-15.md` EDU-14 suggested it; it still feeds `scripts/import-heritage.mjs`).
- Korean gloss style under OD-R5 (WO-24).
- The quest 15 step title "You Can Read!" (OD-CF6).

## 5. UI sketch

None. Content only: no screen, layout or control changes. The new Discover pages of quests 11 and 15 are ordinary word pages with one item: a page may hold one or two items (F-QUEST-002 §3.1, T4 `stage1-curriculum.test.ts:673-678`), though every Stage 1 page ships two today. The page shows the word, its romanization, its gloss and the note under it, exactly as quest 13's 놀이 card does.

## 6. Tests

| Row | Test (unit, vitest) | What it pins |
|---|---|---|
| CF-1a | `apps/mobile/src/content/__tests__/stage1-curriculum.test.ts`, new **T12** "every Stage 1 letter's example word uses only the 30 Stage 1 symbols" | `wordSymbols(j.exampleWordKo)` is not null for each of the 24 consonants and vowels, and it holds the letter itself (as T7 asks of Discover examples); written first, it fails on 책, 토끼, 아빠, 으뜸 |
| CF-1a | `apps/mobile/src/content/__tests__/stage1-curriculum.test.ts` (new cases beside T12) | ㄹ `ipa` is `'ɾ'`; `jamo:rieul-batchim` `soundHint` is the new text; no `SOUND_HINTS` value contains `"ball"` or the word `voiced` |
| CF-1a | new `apps/mobile/src/content/__tests__/stage1-card-text.test.ts` | `card:kite` blurb is the new text and never matches `/diamond|tiger/i` |
| CF-1a | `overlays.test.ts` (shipped) | the pins of §3.4 and the ko hint quote rule (`:433-448`) |
| CF-1b | `stage1-curriculum.test.ts` updated tables + new: quest 7's Check holds no word whose `syllables` differ from the letter-by-letter romanization (no sound change in a Check of quests 1–10) | 설날 can never come back into an early Check |
| CF-1b | `stage1-curriculum.test.ts` new: quest 6 reading words (Discover examples, words and Check answer) are at least half not in a loanword list held in the test (쿠키, 토마토, 코코아, 토스트) | #10 |
| CF-1b | `stage1-curriculum.test.ts` new: quests 11 and 15 each have one word with a `noteEn` that starts "Read it smoothly:", and quest 7's 설날 has its note | #5, #11 |
| CF-1b | `stage1-curriculum.test.ts` new: quest 15 intro `hoyaLineEn` does not match `/read it too/` and the es and ko overlay lines are the §3.2 text | #12 |
| CF-1b | T3, T4, T7, T8 (shipped) | every new word reads with taught symbols, pages ≤ 3, romanization equals `romanizeWord` (고구마 goguma, 도토리 dotori, 얼음 eoreum, 한국어 hangugeo, 물 mul) |
| CF-1b | `review-items-stage1.test.ts`, `tts-manifest-drift.test.mjs` (shipped) | §3.4 |
| CF-2 | `apps/mobile/src/content/__tests__/stage1-jamo-json-drift.test.ts` new cases | `entry.en === record.soundHint` for the 24; for es and ko, `gloss === soundHint` for the 24 |

No e2e is added; the three e2e files of §3.4 change their data only. Coverage: content files are data; the logic coverage targets are unchanged.

## 7. Rollout

Next release, no flag. Order: CF-1a, then CF-1b and CF-2 (either order; CF-2 needs CF-1a's ㅡ ko hint), then CF-3. No migration: progress is by quest id, retired review items keep their state, and earned cards are untouched.

## 8. Dependencies

- F-QUEST-002 (owner of the Stage 1 quests), F-CNT-002 (romanization), F-I18N-001 §3.5, §3.6 and §3.10 (jamo hints, overlays and their MAR), F-CURR-002 §4.2 (review items, freezing and retiring), `AMENDMENTS-AUDIO-CLIPS.md` (clips, M9), `AMENDMENTS-PICTURES-2026-11.md` PX-2 (the kite picture).
- WO-13 (SF rows) receives #13. WO-11 and WO-15 also edit `minigame-config.ts` and `quests.ts` (README §6): merge in series, rebase mechanically.

## 9. Rows

| Row | Model | Files | Tests | Acceptance |
|---|---|---|---|---|
| CF-0 (done) | Opus 5.5 | this spec; the [CF] lines in F-QUEST-002, F-I18N-001, `AMENDMENTS-AUDIO-CLIPS.md`, `AMENDMENTS-PICTURES-2026-11.md`; one index line in `docs/specs/README.md` | — | multi-agent review (§11) done; status `ready` |
| CF-1a (built 2026-11-25 on `content/stage1-letter-fixes`: ㄹ ipa `ɾ`, the final ㄹ hint, example words 치마 / 토마토 / 아기 / 그림 in `jamo.ts` and `jamo.json`, the kite blurb, the 14 es / ko values and four ko pins, T12 and `stage1-card-text.test.ts`; MAR run, the manifest was not stale) | Sonnet 5.5 | `apps/mobile/src/content/jamo.ts` (#6, #7, #9), `content/heritage-cards.ts` (#8); forced: `content/episodes/stage-1/jamo.json` (the four `exampleWord`s), `content/i18n/{es,ko}/stage1-jamo.json` (§3.2 #9 rows), `content/i18n/{es,ko}/stage1-cards.json` (kite blurb), `overlay-ko-pins.json` (four rows), `content/audio/tts-manifest.json` if the manifest check says stale | §6 CF-1a; full `apps/mobile` vitest | the §3.1 CF-1a rows and §3.2 CF-1a rows are in; T12 fails before and passes after; MAR of the 14 es / ko values listed in the PR; `pnpm turbo run lint test` green |
| CF-1b | Sonnet 5.5 | `apps/mobile/src/logic/minigame-config.ts` (#4, #5, #10), `content/quests.ts` (#5, #10, #11, #12); forced: `content/i18n/{es,ko}/stage1-quests.json`, `minigames.json` (§3.2 CF-1b rows), `overlay-ko-pins.json`, `stage1-items.json`, `items-stable-id.json`, `tts-manifest.json`, the orphaned clips and their license / lock rows and the regenerated audio packs (§3.4), the tests and four e2e files of §3.4 | §6 CF-1b; full `apps/mobile` and `packages/content-schema` vitest | the §3.1 CF-1b rows are in; decodability violations 0 (T3, T7); review-item build reports exactly the new and retired ids of §3.4; `pnpm --filter @hangul-route/mobile build:web` passes (no orphaned clip); MAR of the es / ko values listed in the PR |
| CF-2 | Sonnet 5.5 | `content/episodes/stage-1/jamo.json` (24 `en`), `content/i18n/{es,ko}/stage1-jamo.json` (24 `gloss` each), `stage1-jamo-json-drift.test.ts` | §6 CF-2 | the §3.5 invariant holds and is tested; `scripts/validate-content.mjs` green with `HANGUL_ROUTE_STRICT_LOCALES=es,ko`; MAR note in the PR |
| CF-3 | Sonnet 5.5 | F-QUEST-002 §3.6 tables (quest 6 reading words, scope row 6 and 7, Discover rows 6, 11, 15) and Appendix A (final ㄹ); `phase-2-hangul.md` WO-12 status line; this spec's status and §9 PR numbers; the index line | — | the spec tables say what ships; status `shipped` when CF-1a, CF-1b and CF-2 are merged (no on-device check is needed: no UI change) |

## 10. Open decisions (adopted provisionally; the owner may overturn any of them before the row that uses it)

| Id | Question | Options | Adopted (recommended) |
|---|---|---|---|
| OD-CF1 | How strict is "decodable" for a letter record's example word (#9)? | (a) only the 30 Stage 1 symbols, tested; readability by quest kept as the §3.3 record. (b) readable at the letter's own quest: no picturable noun fits quest 1's letters, and it would replace 15 of 24 words | **(a)**. Within (a), ㅊ takes 치마 skirt (native, ㅊ-initial, readable in quest 4) rather than the WO's 차, which is also ㅊ's spoken syllable and would show twice on the presenter's letter slide; 차 stays acceptable if the owner prefers the WO's word |
| OD-CF2 | Quest 6's word set (#10) | (a) keep 쿠키 and 토마토 (they carry ㅋ and ㅌ on the letter cards), replace 코코아 and 토스트 with 고구마 sweet potato and 도토리 acorn, blurb and intro line say "picnic words". (b) 코 nose and 키 height: native and short, but off the picnic theme. (c) reject #10: loanwords are a sound decoding choice | **(a)**: half native, both readable at quest 6; the Check asks 도토리 among 토마토 쿠키 고구마 (도토리 and 토마토 share ㅌ ㅗ; 고구마 sets ㄱ against the ㅋ of 쿠키, 고/코, 구/쿠). No native food word with ㅋ or ㅌ is readable at quest 6, so an acorn found on the picnic stands in. The title "Picnic Snacks" stays: three of the four reading words, the Culture Quiz's 김밥 and the reward card are snacks, and the title is pinned across the Journey and e2e |
| OD-CF3 | Which linking words (#11) and where | (a) 얼음 in quest 11, 한국어 in quest 15, one-item third pages. (b) the WO's 음악 and 목요일 as well or instead. (c) replace an existing word instead of adding a page | **(a)**: each fits its quest's theme and is covered by A1 articles 13 / 15 |
| OD-CF4 | Quest 7's Check word round (#5) | (a) 문 among 문 물 달 산, `W.seol` and `W.nal` deleted. (b) keep 설날 and fix only the gloss of 설 ("Lunar New Year's Day") | **(a)**, as the WO asks |
| OD-CF5 | #13, the "아 · 오 · 우" button for initial ㅇ | (a) move to WO-13 (SF-0 / SF-1), which reworks the same Discover buttons sound-first and owns `discover-flow.ts` / `DiscoverStep.tsx`; any new clip by the F-AUDIO-004 pipeline. (b) a CF row here with its own wireframe and mock | **(a)** |
| OD-CF6 | Quest 15's step title "You Can Read!" | (a) keep: the intro of a reading quest, true in a basic sense, and the overclaim was the line's "read it" (all of Hangul). (b) "Read Words!" | **(a)** |
| OD-CF7 | The `jamo.json` `en` field and the overlay `gloss` (#1, #2) | (a) all 24 equal `SOUND_HINTS`, and es / ko `gloss` equal their `soundHint`, tested. (b) fix only the wrong rows, keeping the "G — …" format. (c) drop the field | **(a)**: one source, no future drift, as the WO's test asks; (c) would also need the overlay validator and the strict-locale count changed |

## 11. Review log

Row CF-0, 2026-11-25. Two independent reviewers read revision 1, neither of them shown the author's reasoning: **L** (Korean linguistics and Hangul pedagogy; opened 표준 발음법, 표준국어대사전 and Wikipedia Korean phonology) and **C** (citations and repo rules; checked 40+ `file:line` citations and every §3.2 current value with grep). No blocker. Revision 2 applies every finding below; no finding was rejected.

| # | By | Severity | Finding | Outcome |
|---|---|---|---|---|
| 1 | L | should-fix | #12 "your first Korean words" is wrong in time: learners read words from quest 2, and quest 3's intro already says "you can read real words!" | en / es / ko now "Now you can read Korean words too!" and its translations (§3.1, §3.2) |
| 2 | L, C | should-fix | quest 6's intro "What snacks did we pack?" (and es, ko) would call an acorn a packed snack; the title "Picnic Snacks" also stays | intro line and its overlays changed to "picnic words" (§3.1, §3.2); OD-CF2 says why the title stays and what 고구마 contrasts |
| 3 | L | should-fix | ko kite blurb joins an action and a state clause awkwardly | two sentences: "대나무 살에 종이를 붙여 만든 연이에요. 위쪽에 빨간 동그라미가 있어요." |
| 4 | C | should-fix | quests 11 and 15 e2e (`nature-crafts-quests.spec.ts`) walk exactly two Discover pages; §5 claimed a shipped one-item page that does not exist | e2e added to §3.4 and CF-1b; §5 reworded |
| 5 | C | should-fix | 문 as a Check answer is a new `lex` item, so the build would report six ids, not five, and stop the row | §3.4 and CF-1b: four new, two retired |
| 6 | C | should-fix | 설, 날 (and possibly 코코아, 토스트) say clips lose their manifest rows, and an orphaned say clip stops `audio:map` / `build:web` | §3.4 "Orphaned clips": delete the mp3s and their license and lock rows, regenerate the packs; `build:web` in CF-1b acceptance |
| 7 | C | should-fix | the AUDIO-CLIPS [CF] line named words that already have clips (물, 토마토, 얼음) and jamo examples that are not in the manifest | line rewritten: only 고구마, 도토리, 한국어 are new; the removals named |
| 8 | C | should-fix | F-I18N-001's sound-alike item is §3.5 item 6, not §3.6 | fixed in the Amends line, the F-I18N-001 [CF] line and the index |
| 9 | L | nit | #1: "between u and i" is vague rather than false ([ɨ] is central); its flaw is the missing spread-lips cue | §1.1 #1 reworded |
| 10 | L | nit | #2: ㅈ is an affricate; §3.5 overstated "fixes «gato»" (the es hints still name it, without the voiced claim) | both reworded |
| 11 | L | nit | final ㄹ hint "tongue tip up" is true of the dark l too | "ends in a clear l, tongue tip behind the top teeth" (50 characters), matching the ko hint |
| 12 | L | nit | ㅊ example 차 equals ㅊ's spoken syllable, so it shows twice on the presenter slide | 치마 skirt (native, ㅊ-initial, readable in quest 4); OD-CF1 records the choice |
| 13 | L, C | nit | OD-CF1 (b) "impossible" overstated: 나, 너 are words | "no picturable noun fits quest 1's letters" |
| 14 | L | nit | ko glosses: 그림 defined with its own root, 덩이뿌리 technical, acorns are not round | 선이나 색으로 모양을 나타낸 것; 달콤한 뿌리채소; 참나무에 열리는 작은 열매 |
| 15 | L | nit | 한국어 article: state 13 (suffix) with 15 giving the same | §3.1 note reworded |
| 16 | C | nit | `:367-372` should be `:373-378` (Build a Block); note is 53 characters; `git log` claim false (no shared base), cite `git diff --stat`; line numbers of other specs shift by the [CF] lines; kite test belongs in a card-content test; T12 should also check the letter is in its word; `AccountLearnerReportScreen.native.tsx` shows the same tiles | all applied |

Verified correct by the reviewers: the 표준 발음법 articles and examples (제4, 13, 15, 20항), the dictionary readings (설 = 설날, 으뜸, 방패연, 도토리), the phonetics (lenis voicing, [ɾ] / [l], ㅡ unrounded), all romanizations and `syllables` splits, all 24 rows of §3.3 and its totals, all 13 verdicts, the ko particles, no age or shame wording, the string limits, the overlay key formats, the pins of §3.4, and that no screen reads `jamo.json` `en` or the jamo overlay `gloss`.
