Status: ready (amends `F-AUDIO-004-korean-voice-quality.md`; also amends F-001 sections 3.2 and 3.3, F-QUEST-002 sections 3.2 and 3.10, F-PLC-001's sound-letter strand, F-STORY-002's keyword audio, `AMENDMENTS-LECTURE-V2.md`'s letter slide and sound quiz, and the open Match Shape PR #865)

> Basis: `origin/main` `524961dae` (#845). Every `file:line` below is at that commit unless it names an open PR. Paths under `apps/mobile/src/` are written from `src/`. Open PRs read for this amendment: #865 (Match Shape), #855 (Syllable Build, Decoding Sprint) and #850 (Dictation).
>
> Owner decisions do **not** gate the whole amendment. Each one gates only the rows named in section 12, and each has a default that applies until the owner answers.

# Amendment to F-AUDIO-004: the voice says what the screen shows, and Korean audio is generated once and shipped as clips

**Owner request 2026-10-29 (translated):**
1. "The voice module's pronunciation is too unclear. Plan an improvement, and consider open-source models or paid services too: once a clip is recorded we can keep using it."
2. "In quizzes during lessons, the answer is ㅏ but the voice says 나. The other way round, ㄴ should be said 니은 but it says 나. Check everything and fix it. Verify twice. Make the plan concrete first, then do the work."

**Standing rules that apply here:**
- Any age: no age wording on shared surfaces.
- D2: taught Korean always carries romanization, and so does every spoken form shown on screen.
- Strings go through `packages/i18n`; every new or changed English string ships with es and ko values in the same PR.
- No copy may claim review by a native speaker or a human expert. The language review is the multi-agent review (MAR).
- Keys and credentials for any speech vendor live only on the owner's machine. They are never committed, never pasted into a PR or an issue, and never sent to an agent (AC-B5, key safety).
- Design tokens only, no emoji, anti-shame feedback (no red X).

**Ids.**
- `JV-An` amends a rule (Part A, jamo voice). `JV-n` is a Part A PR.
- `AC-Bn` amends a rule (Part B, audio clips). `AC-n` is a Part B PR.
- `AU-OD-n` is an owner decision (section 12).
- F-AUDIO-004's own ids (AD1 to AD14, A-1 to A-12) keep their meaning.

---

## 1. Problem

Two different faults sit behind the two requests. They need two different fixes, and a new voice alone fixes neither the second fault nor the root of the first.

### 1.1 What the learner hears is not what the question asks (request 2)

F-AUDIO-004 AD1 ("sound first, name second") made every prompt that asks "which letter?" play the letter's **sound** with a carrier vowel: ㄴ is said 나, ㄱ is said 가 (AD2). The letter's **name** (니은) is said only by the Discover page's Letter name button (`logic/stage1/discover-flow.ts:198-213`). Since then the app has grown many more letter surfaces, and three faults follow from that rule:

- **The Korean question asks for the letter, the voice gives a syllable.** Match Sound's heading is "들리는 글자를 눌러요" (`packages/i18n/src/messages/ko/learner.ts:664`). A Korean speaker reads that as "tap the letter you hear", hears 나, and expects the letter called 니은. The lecture slide prints "글자 이름: nieun" and plays 나 at the same time (`logic/lecture/deck-builder.ts:430`, `ko/learner.ts:1714`). The Listen & Pick prompt text says "the letter nieun" while the voice says 나 (`logic/scope-builders.ts:72`).
- **A carrier syllable contains a second tile.** 나 is ㄴ + ㅏ. Stage 1 / Letters / Quest 1's Play step asks by ear among {ㅏ ㅓ ㄱ ㄴ} (`logic/minigame-config.ts:73,183-188`), so ㅏ is on screen in every round. When the target is ㄴ the learner hears 나, taps ㅏ, which they clearly heard, and is marked wrong. This is the owner's "answer ㅏ, voice 나" case (M1, section 4).
- **The wrong-answer bubble teaches the syllable as the letter.** "다시 들어 봐요. 이건 이렇게 읽어요: 나" (`ko/learner.ts:665`, `logic/audio/prompt-view.ts:110-112`) tells the learner that ㄴ "reads as" 나.

### 1.2 The voice itself is unclear (request 1)

- **No recorded clip ships.** `src/content/__generated__/audio-assets.ts` is `AUDIO_ASSETS = {}` and `apps/mobile/assets/audio/` does not exist. Every Korean sound on every platform is the device's text-to-speech voice. The clip path (AD4: clip, then voice, then text) is built and tested, but it has no files.
- **Lone syllables are the hardest input for a device voice.** Voices are trained on sentences. A lone syllable gets a clipped onset and an interjection or question intonation; the plain, aspirated and tense series blur (가/카/까, 다/타/따, 바/파/빠, 자/차/짜, 사/싸); non-word codas (앚, 앛, 앝, 앋, 앆, 앜) can be spelled out or released.
- **The rate makes it worse.** A level-0 learner hears a syllable at 0.75 x 0.9 = 0.675 (`logic/audio/rate.ts:12-31`), and iOS halves the JS rate again (`rate.ts:4`; F-AUDIO-004 section 1 engine table).
- **The owner's recordings are blocked.** A-9 (30 jamo clips) waits on owner task T-017 and the Xcode validation #264; A-10 (names, then vocabulary) waits on A-9. About 1,200 distinct Korean utterances (section 8.1) have no clip plan at all: lessons, quests, stories, placement, review items and cards carry no `audioRef`, and the controller looks clips up only by `audioRef` (`logic/audio/controller.ts:299-302`), so even a recorded clip could never reach them.

## 2. Goals and metrics

| # | Goal | Metric | Target | Measured by |
|---|---|---|---|---|
| G1 | The voice says what the question asks | Surfaces x jamo pairs whose spoken text differs from the rule of section 3 | **0** of all (55 jamo x every surface in section 5) | `voice-surfaces.test.ts` (JV-2), e2e (JV-4) |
| G2 | No tile is right by ear except the answer | Rounds in any shipped scope where a non-answer tile is a component of the prompt (sound questions) or shares its spoken text (letter questions) | **0** | `voice-pools.test.ts` (JV-3) |
| G3 | Clear Korean on every device | Share of Korean prompts that play a clip, from the new counts-only `audio.source_summary` (AC-B9) | Stage 1 100 % after AC-8; every stage at least 98 % after AC-12 | telemetry, `audio:status` |
| G4 | Clips are right before they ship | Clips that pass both verification passes (section 9) | **100 %** of shipped clips; ASR exact match at least 98 % of words and sentences before review, 100 % of jamo after review | QA report in each content PR |
| G5 | Offline budget kept | Learner precache growth | at most the measured bytes of the Stage 1 jamo pack (about 0.35 MB); every other pack lazy; `learnerPrecacheRaw` (11,287,329 B, `scripts/pwa/lesson-chunks.mjs:126`) not crossed, so CM-5B is not triggered by audio | `lesson-chunks.mjs` budget assertion |
| G6 | No new failure | `audio.playback_failed` rate per prompt | not above the TTS-only baseline of the week before AC-7 | telemetry |
| G7 | Fast start | Clip start after the round appears (web, warmed) | under 150 ms | e2e timing assertion with a fixture clip |

## 3. Part A rule: one source of truth for what a letter says

### JV-A1 Two question types, never mixed (replaces AD1; keeps AD2 as the definition of a letter's sound)

Every place that speaks a lone jamo is one of two types. The type, not the screen, decides what is said.

| Type | What the screen shows or asks | What the voice says | Tiles allowed |
|---|---|---|---|
| **Letter question** | a lone letter, or "which letter is this?" (Match Sound, Listen & Pick letter rounds, the Hangul Check's letter rounds, Match Shape, Trace Stroke, the lecture letter slide's main button and its sound quiz, story keywords) | the letter's **name**: consonants 기역 니은 ... 히읗 and 쌍기역 ... 쌍지읒; a vowel's name is its sound (아 어 ... 의); ㅇ is 이응 | initial consonants and vowels only, never finals; every tile's name differs |
| **Sound question** | a syllable, or "which letter starts / ends this sound?" (Build Letter, Syllable Build, Decoding Sprint, Dictation, the Hangul Check's final rounds, Placement's consonant items, Discover's second button, every final on Discover and Trace Stroke) | the **syllable** (AD2 carrier: 나, 아, 안) | lone letters of one kind, and no tile other than the answer is a component of the spoken syllable (JV-A3) |

**The invariant** (pinned by tests, section 6): **a lone initial consonant or vowel on screen is never spoken as a syllable, and a syllable is never spoken for a letter question. A final is never asked or spoken by name: it is spoken as its closed syllable (안), and that syllable is shown next to it** ("ㄴ at the bottom: 안 · an", the `finalLine` copy of JV-A4). In code, the only way to get the text for a jamo is `jamoVoice(jamo, type)` (JV-A2); `spokenFor(jamo, 'sound' | 'name')` stays as its implementation detail and is no longer imported by a screen.

**Why the name for letter questions (owner request, AU-OD-1).** The owner names the expected voice directly: "ㄴ should be said 니은". It also removes every fault of section 1.1 at once:
- the Korean heading "들리는 글자를 눌러요" and the slide line "글자 이름" now match the voice;
- the name of a consonant (니은) is not a syllable built from another tile on screen, so the "ㅏ answer, 나 voice" trap cannot happen;
- ㅇ stops being the one consonant said by name (M4), because every consonant is now said by name.

**What this replaces.** D6's "isolated consonants are spoken as sounds with a carrier vowel, not as letter names" and AD1 applied to letter questions. The sound is not lost: it is taught on Discover's second button, in every syllable game, and in Placement's decoding items, which are sound questions with honest copy. If the owner prefers the old rule, AU-OD-1 option B keeps the sound on letter questions and applies only the pool rule and the copy change; every test of section 6 is written against `jamoVoice`, so either option is one table change.

### JV-A2 `logic/audio/jamo-voice.ts` (new, pure)

```ts
export type JamoQuestion = 'letter' | 'sound';

export interface JamoVoice {
  text: string;            // what is spoken: never a compatibility jamo (U+3131-318E) or a conjoining jamo (U+1100-11FF)
  romanization: string;    // shown next to it (D2): the name's RR for a letter question, spokenRomanization for a sound question
  audioRef?: string;       // nameAudioRef for a consonant letter question, audioRef otherwise (a vowel's name is its sound clip)
  kind: 'name' | 'sound';  // what was chosen, for telemetry and tests
}

export function jamoVoice(jamo: SpokenJamo, question: JamoQuestion): JamoVoice;
```

Rules:
- `letter` on a consonant returns `nameKo` with `nameAudioRef`. On a vowel it returns `spokenKo` (equal to `nameKo`) with `audioRef`. On a final (`kind: 'batchim'`) it **throws**: a final is asked only by a sound question (JV-A3), because its name equals its initial's name.
- `sound` returns `spokenKo` with `audioRef` (AD2 unchanged; initial ㅇ stays 이응, because it has no sound of its own).
- A record with no `nameKo` (none in shipped content; schema still optional) throws in tests and falls back to `spokenKo` in production, with a `console.warn` in development.
- `controller.ts:504-506` `playJamo(jamo, mode)` becomes `playJamo(jamo, question: JamoQuestion)` and calls `jamoVoice`. Call sites are listed in section 6.1.

### JV-A3 Pool rules (round builders)

1. **Letter questions:** every tile's `jamoVoice(tile, 'letter').text` is unique in the round. No final appears in a letter-question pool (`SOUND_QUIZ_JAMO_IDS`, `logic/round-builder.ts:55`, is split into `LETTER_QUIZ_JAMO_IDS` = the 24 initials and vowels, and `FINAL_QUIZ_JAMO_IDS` = the 6 Stage 1 finals).
2. **Sound questions:** tiles are one kind (consonants, vowels or finals). No non-answer tile is a component of the spoken syllable: `decompose(text)` (`logic/stage1/hangul.ts`) of the prompt must not contain any distractor's character in the matching position. A builder that cannot fill a round under this rule drops the distractor and draws another; a scope that cannot fill the tile count throws in the content test, not at run time.
3. **Finals** are asked only as sound questions: "Which letter is at the bottom of this sound?" with the closed syllable (악 안 알 암 압 앙) and final tiles only, drawn in the final-position frame the Hangul Check already uses for its final rounds (`logic/stage1/hangul-check.ts:74-81`, `lp.syl`).
4. **The lecture quiz** (`logic/lecture/deck-builder.ts:1253-1263`) pools letters with `LETTER_QUIZ_JAMO_IDS` and adds finals as their own sound-question rounds; this removes the two identical "n" tiles of M3.

### JV-A4 Copy (en / es / ko in the same PR)

| Key | Today | New |
|---|---|---|
| `learner.audio.heading.listen` (Match Sound, letter question) | en "Tap the letter you hear" · es "Toca la letra que escuchas" · ko "들리는 글자를 눌러요" | unchanged (now true) |
| `learner.audio.listenAgain` (wrong-answer bubble) | en "Listen again. This one says" · es "Escucha otra vez. Esta suena" · ko "다시 들어 봐요. 이건 이렇게 읽어요:" | letter question: en "Listen again. This letter is" · es "Escucha otra vez. Esta letra es" · ko "다시 들어 봐요. 이 글자는". The bubble shows `jamoVoice(...).text` and its romanization, for example "니은 · nieun". A sound question keeps today's line. |
| new `learner.audio.heading.startsWith` (sound question, initial) | - | en "Which letter starts this sound?" · es "¿Con qué letra empieza este sonido?" · ko "이 소리는 어떤 글자로 시작할까요?" |
| new `learner.audio.heading.endsWith` (sound question, final) | - | en "Which letter is at the bottom of this sound?" · es "¿Qué letra va abajo en este sonido?" · ko "이 소리의 받침은 어떤 글자일까요?" |
| `learner.presenter.slide.letterName` (lecture slide; en `learner.ts:2308`, ko `:1714`) | ko "글자 이름: nieun" (romanized) | the function gains a second argument, the Hangul name: ko "글자 이름: 니은 (nieun)"; en "Letter name: nieun" and es keep the romanized name |
| new `learner.quest.discover.soundWith.cta` (Discover second button, consonants; replaces `learner.quest.discover.letterName.cta` "Letter name" there, en `learner.ts:733`) | - | en "Hear it with a vowel" · es "Escúchala con una vocal" · ko "모음과 함께 들어 봐요". Under it the taught line "나 = ㄴ + ㅏ · na" is content (`KoreanText`), not a UI string, so no Hangul sits inside an English UI string (CLAUDE.md section 8) |
| new `learner.audio.finalLine` (Discover final pages, Trace Stroke finals, the bubble of a final round) | - | en "{letter} at the bottom: {syllable}" · es "{letter} abajo: {syllable}" · ko "받침 {letter}: {syllable}"; `{syllable}` is followed by its romanization (D2) |


### JV-A5 Discover (F-QUEST-002 section 3.2, amended; AU-OD-2)

- Consonant page: the main **Hear it** plays the name (니은). The second button, today's **Letter name**, becomes **Hear it with a vowel** and plays the carrier syllable (나) with its line "나 = ㄴ + ㅏ · na". The order follows the letter question rule: a lone letter on screen is first heard by its name.
- Vowel page: one **Hear it** (아); no second button, because a vowel's name is its sound (unchanged).
- Initial ㅇ page: **Hear it** plays 이응; no second button; the silent-letter line stays (F-AUDIO-004 section 3.1 rule 3).
- Final pages: **Hear it** plays the closed syllable (악), as today, with the `finalLine` "ㄱ at the bottom: 악 · ak"; the name is not played (a final's name is its initial's).
- **Example words (M5):** the ㅏ page's example 나 (`content/quests.ts:37`) is the only real word that Quest 1's four letters can spell, and it is played by its own example button with the block that holds ㅏ emphasised (F-QUEST-002 section 3.2 item 4). It stays (AU-OD-10 default). The example button's accessible label gains "Example word" (en) / "Palabra de ejemplo" (es) / "예시 낱말" (ko) so a screen-reader user never takes it for the letter's sound.

## 4. Every mismatch found, with its fix

Found by a read-only audit of every jamo speech path at `524961dae` and the three open PRs. Each row names the PR that fixes it.

| # | Mismatch | Repro | Cause | Fix | PR |
|---|---|---|---|---|---|
| M1 | A tile is part of the carrier syllable: the learner hears ㅏ inside 나 and is marked wrong (owner's "ㅏ answer, 나 voice") | Stage 1 / Letters / Quest 1, Play step (`minigame:s1-letters-q1-play`, `minigame-config.ts:183-188`, pool {ㅏ ㅓ ㄱ ㄴ}): target ㄴ, voice 나, tap ㅏ = wrong. Same in q2-play (마 가 나 with ㅏ on screen; 오 우 아 어 with ㅇ on screen), q3-play (ㅡ ㅣ ㅗ ㅜ with ㅇ; 이응 with ㅣ and ㅡ), rites-q2-play (`:365`, 파 바 카 타 with ㅏ), and the lecture match-sound steps that reuse these pools (`deck-builder.ts:494`) | `buildMatchSoundRounds` (`round-builder.ts:62-89`) draws distractors from the whole pool; letters are spoken as carrier syllables | Letter questions say names (JV-A1); pool rule JV-A3 for every sound question | JV-2, JV-3 |
| M2 | The letter name is expected, the sound is spoken (owner's "ㄴ should be 니은") | Every consonant on Match Sound, Listen & Pick `lp:sym`, the Hangul Check, Trace Stroke, the lecture slide and sound quiz, Match Shape (#865) | AD1 (`spokenFor` sound mode) | JV-A1, JV-A4, JV-A5 | JV-2 |
| M3 | Two identical tiles in the lecture quiz | A deck with Stage 1 Letters Quest 1, Holidays Quest 7 (`quests.ts:44`, `:275`) and `{kind:'quiz', from:'all'}`: initial ㄴ "n" and final ㄴ "n" side by side (`jamoOption`, `deck-builder.ts:445`); prompt 안 also contains ㅏ | `SOUND_QUIZ_JAMO_IDS` includes the 6 finals; `quizBlock` pools all taught letters | JV-A3 rules 1, 3, 4 | JV-3 |
| M4 | ㅇ is the only consonant said by name: a giveaway in consonant pools (life-q1 `minigame-config.ts:249`, life-q2 `:280`), and 이응 is close to the ㅣ prompt 이 in q3-play | play life-q1 | AD2 exception | Every consonant is said by name (JV-A1); letter-question names are unique (JV-A3 rule 1); 이응 and 이 stay distinct texts | JV-2 |
| M5 | Discover example: the ㅏ page's example word is 나, the same as the ㄴ page's (`quests.ts:37`, `:44`); the ㅇ page's 오 is the same as ㅗ's (`:75`, `:82`) | open Quest 1 Discover | Only one real word is spellable from ㄱ ㄴ ㅏ ㅓ | Keep the words; label the example button (JV-A5); AU-OD-10 | JV-3 |
| M6 | Stale replay in Match Sound: the old prompt plays over the next round | Q1, target ㄴ: tap ㅏ, then ㄴ within 100 ms. The 700 ms advance (`MatchSoundGame.tsx:110-116`) fires before the 800 ms replay (`:123-126`), whose `hear` closure holds the old round | The replay timer is not cleared on a correct tap or a round change (`:76-82`, `:105-117`) | Clear `replayTimer` on a correct tap and in the round effect; `hear` reads the round through a ref. ListenPickGame already cancels through its flow (`:150-153`) | JV-2 |
| M7 | The Hangul Check plays letters at the word rate (0.85) instead of the sound rate | any Hangul Check letter round | `symbolRound` overwrites the round id to the jamo id (`hangul-check.ts:77`), so `listenPickSpeech` (`listen-pick-speech.ts:18-22`) does not see `lp:sym:`; the same overwrite breaks the `lp:sym:` checks in `logic/memory/resolve.ts:104` and `logic/browse/facts.ts:163` | Keep the `lp:sym:` id and carry the jamo id in a new optional `jamoId` field on the round view; or pass `kind` explicitly. JV-2 picks the first and updates the two readers | JV-2 |
| M8 | Story `story:shapes-of-hangeul` speaks bare jamo (ㄱ, ㅏ, ㄴ ...): 17 keyword and check-target entries (`content/stories/shapes-of-hangeul.json:95-179`, `:243`, `:430`, `:504`, `:547-577`) | open the story, tap a letter keyword | No `spokenKo`; the device reads U+3131-318E, and the result depends on the engine (names on iOS, nothing or "Hangul letter" on some Android and Linux engines) | Add `spokenKo` = the letter name (기역, 아, 니은 ...) to every jamo keyword and check target; a content validator rule (F-CNT-001) rejects any `ko` that is a lone compatibility jamo without `spokenKo`; story version bump per F-STORY-001 | JV-3 |
| M9 | Data drift: `content/episodes/stage-1/jamo.json` has its own romanization ("g/k (giyeok)") and example words (강아지, 나비) that differ from `src/content/jamo.ts` (가족, 나무) | read both files | Two sources; only its gloss is used | A content test asserts the shared fields agree with `jamo.ts` (or the file drops them); no speech change | JV-3 |
| M10 | Listen & Pick's prompt text says "the letter nieun" while the voice says 나 (`scope-builders.ts:72`) | any `lp:sym` consonant round in fallback text or for a screen reader | AD1 | Fixed by JV-A1: the voice now says 니은 | JV-2 |
| M11 | Trace Stroke is inconsistent: in the same game ㅁ is said 마 and ㅇ 이응 (`minigame-config.ts:217`); in the final-letter trace (`:507`) the lone letter ㅁ is said 암 | play either trace step | AD1, AD2 exception | Trace Stroke on an initial or vowel is a letter question: it says the name (ㅁ = 미음; ㅇ = 이응, now consistent). A final trace (`minigame:s1-nature-q3-apply`, `:506-510`, final records) keeps the closed syllable (ㅁ = 암) and shows the `finalLine` ("ㅁ at the bottom: 암 · am") so the syllable heard is the syllable shown | JV-2 |
| M12 | The Word Builder finals say non-words (앚 앛 앝 앋 앆 앜, `jamo.ts:247-255`) | Discover pages of Word Builder q5 and q6 | Spelling-based carrier | Discover keeps the closed syllable but, once clips ship, the six finals said t share one clip spoken [앋] and ㅋ/ㄲ/ㅍ finals reuse 악 and 압 (AC-B3); the TTS fallback is unchanged (it is never quizzed by ear, `round-builder.ts:51-55`) | AC-1, AC-7 |

**Checked and fine:** Build Letter (plays the syllable the learner builds, `BuildLetterGame.tsx:88`), Trace Word, Syllable Build and Decoding Sprint (#855), Dictation (#850), quest warm-up and daily review (letter rounds are see-only, `quest-reviews.ts:101-127`, `review-rounds.ts:33-41`), and the silent surfaces (Odd One Out, write-frame finals, type-hangul tiles, letter wall, Browse, cards).

## 5. The full jamo table (pinned by `jamo-voice.test.ts`, JV-1)

"Letter question" and "sound question" are what `jamoVoice` returns. "Clip" is the file each one plays once Part B ships; a dash means the record has no clip of that type. Every Hangul string here is a spoken text; none is a lone jamo.

**Consonants (19)**

| Id | Jamo | Letter question (name) | RR | Sound question | Clip (name) | Clip (sound) |
|---|---|---|---|---|---|---|
| giyeok | ㄱ | 기역 | giyeok | 가 | `jamo/giyeok-name` | `jamo/giyeok` |
| nieun | ㄴ | 니은 | nieun | 나 | `jamo/nieun-name` | `jamo/nieun` |
| digeut | ㄷ | 디귿 | digeut | 다 | `jamo/digeut-name` | `jamo/digeut` |
| rieul | ㄹ | 리을 | rieul | 라 | `jamo/rieul-name` | `jamo/rieul` |
| mieum | ㅁ | 미음 | mieum | 마 | `jamo/mieum-name` | `jamo/mieum` |
| bieup | ㅂ | 비읍 | bieup | 바 | `jamo/bieup-name` | `jamo/bieup` |
| siot | ㅅ | 시옷 | siot | 사 | `jamo/siot-name` | `jamo/siot` |
| ieung | ㅇ | 이응 | ieung | 이응 (silent at the start; AD2) | `jamo/ieung` (the name is its sound) | `jamo/ieung` |
| jieut | ㅈ | 지읒 | jieut | 자 | `jamo/jieut-name` | `jamo/jieut` |
| chieut | ㅊ | 치읓 | chieut | 차 | `jamo/chieut-name` | `jamo/chieut` |
| kieuk | ㅋ | 키읔 | kieuk | 카 | `jamo/kieuk-name` | `jamo/kieuk` |
| tieut | ㅌ | 티읕 | tieut | 타 | `jamo/tieut-name` | `jamo/tieut` |
| pieup | ㅍ | 피읖 | pieup | 파 | `jamo/pieup-name` | `jamo/pieup` |
| hieut | ㅎ | 히읗 | hieut | 하 | `jamo/hieut-name` | `jamo/hieut` |
| ssanggiyeok | ㄲ | 쌍기역 | ssanggiyeok | 까 | `jamo/ssanggiyeok-name` | `jamo/ssanggiyeok` |
| ssangdigeut | ㄸ | 쌍디귿 | ssangdigeut | 따 | `jamo/ssangdigeut-name` | `jamo/ssangdigeut` |
| ssangbieup | ㅃ | 쌍비읍 | ssangbieup | 빠 | `jamo/ssangbieup-name` | `jamo/ssangbieup` |
| ssangsiot | ㅆ | 쌍시옷 | ssangsiot | 싸 | `jamo/ssangsiot-name` | `jamo/ssangsiot` |
| ssangjieut | ㅉ | 쌍지읒 | ssangjieut | 짜 | `jamo/ssangjieut-name` | `jamo/ssangjieut` |

The five tense consonants are not asked by ear (they stay out of `LETTER_QUIZ_JAMO_IDS`; their sounds blur with the plain and aspirated series on most voices). Their names and sounds play on Discover and the lecture letter slide.

**Vowels (21).** For every vowel the letter question and the sound question say the same text, and the name clip is the sound clip.

| Id | Jamo | Spoken (both types) | RR | Clip |
|---|---|---|---|---|
| a | ㅏ | 아 | a | `jamo/a` |
| ya | ㅑ | 야 | ya | `jamo/ya` |
| eo | ㅓ | 어 | eo | `jamo/eo` |
| yeo | ㅕ | 여 | yeo | `jamo/yeo` |
| o | ㅗ | 오 | o | `jamo/o` |
| yo | ㅛ | 요 | yo | `jamo/yo` |
| u | ㅜ | 우 | u | `jamo/u` |
| yu | ㅠ | 유 | yu | `jamo/yu` |
| eu | ㅡ | 으 | eu | `jamo/eu` |
| i | ㅣ | 이 | i | `jamo/i` |
| ae | ㅐ | 애 | ae | `jamo/ae` |
| yae | ㅒ | 얘 | yae | `jamo/yae` |
| e | ㅔ | 에 | e | `jamo/e` |
| ye | ㅖ | 예 | ye | `jamo/ye` |
| wa | ㅘ | 와 | wa | `jamo/wa` |
| wae | ㅙ | 왜 | wae | `jamo/wae` |
| oe | ㅚ | 외 | oe | `jamo/oe` |
| wo | ㅝ | 워 | wo | `jamo/wo` |
| we | ㅞ | 웨 | we | `jamo/we` |
| wi | ㅟ | 위 | wi | `jamo/wi` |
| ui | ㅢ | 의 | ui | `jamo/ui` |

The eleven compound vowels are not asked by ear: ㅐ/ㅔ, ㅒ/ㅖ and ㅙ/ㅚ/ㅞ merge for most speakers today (`round-builder.ts:51-55`, unchanged).

**Finals (15; sound question only, JV-A1).**

| Id | Jamo | Sound question | RR | Clip |
|---|---|---|---|---|
| giyeok-batchim | ㄱ | 악 | ak | `jamo/giyeok-batchim` |
| nieun-batchim | ㄴ | 안 | an | `jamo/nieun-batchim` |
| rieul-batchim | ㄹ | 알 | al | `jamo/rieul-batchim` |
| mieum-batchim | ㅁ | 암 | am | `jamo/mieum-batchim` |
| bieup-batchim | ㅂ | 압 | ap | `jamo/bieup-batchim` |
| ieung-batchim | ㅇ | 앙 | ang | `jamo/ieung-batchim` |
| siot-batchim, jieut-batchim, chieut-batchim, tieut-batchim, digeut-batchim, ssangsiot-batchim | ㅅ ㅈ ㅊ ㅌ ㄷ ㅆ | 앗 앚 앛 앝 앋 았 (shown); all pronounced [앋] | at | one shared clip `jamo/digeut-batchim`, generated from 앋 (AC-B3) |
| kieuk-batchim, ssanggiyeok-batchim | ㅋ ㄲ | 앜 앆 (shown); pronounced [악] | ak | reuse `jamo/giyeok-batchim` |
| pieup-batchim | ㅍ | 앞 (shown); pronounced [압] | ap | reuse `jamo/bieup-batchim` |

Clip count for jamo: 30 Stage 1 sound clips, 16 Word Builder sound clips (11 compound vowels, 5 tense consonants), 1 shared t-final clip, and 18 consonant name clips (13 Stage 1 consonants other than ㅇ, plus the 5 tense consonants) = **65 files**.

## 6. Part A surfaces and tests

### 6.1 Every surface that speaks a jamo (after JV-2 and JV-3)

| Surface | File | Type | Voice for ㄴ | Change |
|---|---|---|---|---|
| Match Sound | `screens/minigames/MatchSoundGame.tsx:74,81,130-131`; scopes `logic/minigame-config.ts:183-367` | letter | 니은 | `playJamo(j, 'letter')`; bubble JV-A4; M6 |
| Listen & Pick letter rounds | `logic/scope-builders.ts:60-79`, `logic/audio/listen-pick-speech.ts` | letter | 니은 | `lp.sym` builds its prompt from `jamoVoice(j, 'letter')`; prompt `audioRef` = the name clip for a consonant |
| Hangul Check, letters | `logic/stage1/hangul-check.ts:77` | letter | 니은 | M7 |
| Hangul Check, finals | `hangul-check.ts:78-80` (`lp.syl`) | sound (end) | 안 | heading `endsWith` |
| Trace Stroke, initials and vowels | `screens/minigames/TraceStrokeGame.tsx:156,321,406`; `minigame-config.ts:214-218` | letter | 니은 | M11 |
| Trace Stroke, finals | same; `minigame-config.ts:506-510` | sound (end) | 안 | M11, `finalLine` |
| Match Shape (open PR #865) | `MatchShapeBoard.tsx:147`, `ReadPickGame.tsx:94` | letter | 니은 | the PR adopts `jamoVoice` before it merges, or JV-2 migrates it if #865 merges first |
| Discover | `logic/stage1/discover-flow.ts:198-213`, `DiscoverStep.tsx:176` | letter (Hear it), sound (second button) | 니은, then 나 | JV-A5 |
| Lecture letter slide | `logic/lecture/deck-builder.ts:430`, `LetterSlide.tsx:86` | letter (main), sound (second) | 니은, then 나 | slide gets `name` and `sound` specs; ko name in Hangul (JV-A4) |
| Lecture sound quiz | `deck-builder.ts:458-466`, `:1253-1263` | letter; finals as sound (end) | 니은 | JV-A3 rule 4 |
| Placement, consonant items | `content/placement/sound-letter.json`, `ItemScreen.tsx:131` | sound (start) | 나 | heading `startsWith`; options stay consonants only (AU-OD-3) |
| Placement, vowel items | same | letter (name = sound) | 아 | none |
| Story keywords and check targets | `content/stories/shapes-of-hangeul.json`, `scene-audio.ts:41`, `check-game.ts:69` | letter | 니은 | M8 |
| Build Letter, Trace Word, Syllable Build, Decoding Sprint, Dictation | as listed in section 4 | sound (syllable shown or built) | 나 | none |

### 6.2 Tests (each is in the PR that makes it pass; CLAUDE.md section 5: tests first)

| Test | Kind | Pins |
|---|---|---|
| `logic/audio/__tests__/jamo-voice.test.ts` (JV-1) | unit, 100 % | The tables of section 5 row by row for all 55 jamo records (`jamoAll` + `jamoWordBuilder`); `letter` on a final throws; no returned text matches `/[\u3131-\u318E\u1100-\u11FF]/u`; letter-question texts are unique across `LETTER_QUIZ_JAMO_IDS`; 이응 differs from 이; `romanization` is `romanizeWord(text)` (F-CNT-002) except where a record's RR is authored |
| `logic/__tests__/voice-surfaces.test.ts` (JV-2) | unit | For **every** surface builder of section 6.1 and every shipped scope: all Match Sound rounds of every `minigame-config` entry (seeds 1-20), every `lp:sym` round of every quest and lesson, the Hangul Check for all 30, every lecture preset deck, every Trace Stroke config, every placement sound-letter item, every story jamo keyword, every Discover page: the spoken text equals `jamoVoice(target, typeOf(surface)).text`. A surface added later without a row in the table fails the test (the table is the list of builders, checked against a grep of `playJamo|jamoVoice` call sites) |
| `logic/__tests__/voice-pools.test.ts` (JV-3) | unit | JV-A3 on every shipped scope and every lecture preset: letter-question tiles have unique spoken texts and no final; sound-question distractors are not components of the prompt; finals never share a round with initials |
| `content/__tests__/no-bare-jamo-speech.test.ts` (JV-3) | content | Walks every `KoText` in shipped content (the walker of `scripts/audio/content-sources.mjs`, extended): no `spokenKo ?? ko` that is a lone jamo |
| `MatchSoundGame` component test (JV-2) | component, fake timers | M6: wrong tap then correct tap within 100 ms plays no old prompt after the advance; the bubble reads "니은 · nieun" for ㄴ |
| `hangul-check.test.ts` (JV-2) | unit | M7: letter rounds keep `lp:sym:`, play at the `sound` rate; `memory/resolve.ts` and `browse/facts.ts` still classify them |
| `e2e/jamo-voice.spec.ts` (JV-4) | Playwright, web | With the fake `speechSynthesis` capture (`test-support/audio-rig.ts` pattern): Stage 1 Quest 1 Discover (ㄴ page: Hear it = "니은", Hear it with a vowel = "나"), Play (every round's utterance equals the target's name; tapping ㅏ on a ㄴ round never happens to be "right by ear"), Check (`lp:sym`), the Hangul Check (letter and final rounds), a lecture deck with a letter slide and a quiz. A second run with fixture clips (`e2e/fixtures/audio/jamo/`, adding `nieun-name.mp3`) asserts the clip URL requested for ㄴ is the name clip |

## 7. Part B: Korean clips generated once and shipped

### AC-B1 Vendor (AU-OD-4)

Licence is the gate: generated audio must be storable and redistributable in a paid app, forever, with no per-play call.

| Rank | Service | Licence basis for storing and shipping the output | Conditions |
|---|---|---|---|
| **Primary** | **Google Cloud Text-to-Speech**, ko-KR, one voice for every clip | Output is Customer Data; the Service Terms (section 17) forbid only using output to build a competing model. Text-to-Speech is listed as an AI/ML service, not a Generative AI Service, so the under-18 rule of section 20(d) does not apply to it. | Use the classic or Chirp 3 HD voices of the Text-to-Speech API only, **not** Gemini-based TTS (it may be billed as a Generative AI service; unverified). Chirp 3 HD's SSML and custom pronunciation are labelled Preview. |
| Fallback | **Microsoft Azure Speech**, S0 paid tier, a standard Neural voice (for example `ko-KR-SunHiNeural` or `ko-KR-InJoonNeural`), not HD | The Product Terms grant commercial use of prebuilt neural voice output **on the paid tier only** (free F0 output has no commercial right). | The AI Code of Conduct requires disclosing that the voice is synthetic: the credits line of AC-B10 covers it. |
| Third | **Amazon Polly**, Neural `Seoyeon` or `Jihye` | The FAQ says generated speech can be cached and replayed with no restriction and belongs to the customer. | Fewer Korean voices. |
| Offline fallback | MeloTTS-Korean (MIT) | Commercial use allowed | One speaker, modest quality; only if no cloud vendor is possible. |

**Rejected:** NAVER CLOVA Voice (its policy forbids file download; real-time calls only), Supertone API (shut down 2026-08-31), Coqui XTTS-v2 (non-commercial CPML, no licence on sale), Fish-Speech / OpenAudio S1-mini, F5-TTS and MMS-TTS (CC-BY-NC), Zonos and Kokoro (no Korean), OpenAI `tts-1` / `gpt-4o-mini-tts` (shutdown 2027-01-06), Typecast (revocable API licence and a delete-on-termination clause; would need written confirmation).

Each content PR's `content/assets-license.csv` rows name the vendor, the voice, the date generated and the terms URL with the date it was read, so a later change of terms cannot be confused with what applied at generation time.

### AC-B2 Voice choice (AU-OD-5)

- **One adult, neutral, clearly articulating voice for every clip** (AD11's one-speaker rule). Male or female is the owner's choice; the pilot shows both.
- **Pick by a blind pilot, not by reputation** (AC-5; result in section 13). Very short inputs (가, 악, 니은) are where LLM-style voices (Chirp 3 HD, Azure Dragon HD, ElevenLabs v3, OpenAI) are known to truncate, go silent or add words (RALL-E paper on VALL-E; OpenAI forum reports). Classic neural voices are expected to be more predictable on single syllables; this is engineering judgment that the pilot tests.
- **Default:** Chirp 3 HD only if it passes every one of the 65 jamo clips (the finals included) with zero failures in both verification passes (section 9); otherwise one Neural2 voice (candidate `ko-KR-Neural2-A`; the exact voice is the pilot's result, recorded in section 13 by AC-5).
- **Rate at generation**, close to AD6 and natural for the engine: syllables and letter names about 0.85, words about 0.85-0.9, sentences about 0.9, narration 1.0 (SSML `prosody rate` or `speaking_rate`). A clip carries its own rate, so the app plays it as is: `speechParams` applies to the voice fallback only. No screen uses the `slow` option today (only tests do), so no slow clip variant is generated.

### AC-B3 Text normalization and pronunciation overrides

The engine never sees a compatibility jamo. What is sent is a **Hangul respelling** that is written as it must be heard, which works on every engine without SSML; IPA `<phoneme>` is a second-level tool for the rare case where respelling fails.

| Class | Sent to the engine | Notes |
|---|---|---|
| Consonant letter names | the official name: 기역 니은 디귿 리을 미음 비읍 시옷 이응 지읒 치읓 키읔 티읕 피읖 히읗, 쌍기역 ... | Targets in isolation: [기역] [니은] [디귿] [리을] [미음] [비읍] [시옫] [이응] [지읃] [치읃] [키윽] [티읃] [피읍] [히읃]. If a voice misreads a name, the override sends the bracketed form (for example 키윽). |
| Isolated vowels and carrier syllables | the syllable with a full stop: "아." "나." | The full stop asks for a calm statement, not an interjection or question. The pilot compares "아" and "아."; the winner is the rule. |
| Finals | 악. 안. 알. 암. 압. 앙. | The six finals said t share one clip generated from "앋." (or "앗." if the pilot finds 앋 misread); ㅋ/ㄲ finals reuse 악, ㅍ reuses 압 (section 5). |
| Words, phrases, sentences | `spokenKo ?? ko` from the content record (F-CNT-002 already authors `spokenKo` where the spelling misleads) | Standard spelling first; on a QA failure the override table sends the pronounced form (국물 → 궁물, 신라 → 실라, 같이 → 가치, 좋다 → 조타). |
| Never generated | cloze templates ("___ 하고 싶어요."), template fragments (…이에요/예요), ko-locale glosses and definitions (not taught Korean), any text with Latin letters or digits that has no `spokenKo` | The manifest builder rejects them; digits need an authored `spokenKo` (for example 2,000 → 이천). |

**Where overrides live:** `content/audio/pronunciation-overrides.json`, keyed by the content text, with `say` (the respelling), optional `ipa`, `reason`, and the engine and voice it was needed for. An override never changes what the screen shows; it only changes what is sent to the engine.

### AC-B4 Clip identity: a text-keyed clip index (new `say` group)

About 1,000 utterances have no `audioRef` and never will by hand. The fix is to key clips by the text the voice must say.

- `sayKey(text) = sha256(NFC(text.trim()))` as 16 hex characters. The same text in two places (a quest word and a vocabulary item) is one clip; the 2,346 per-source utterances collapse to about 1,213 clips (section 8.1).
- File: `apps/mobile/assets/audio/say/<sayKey>.mp3`; ref `audio/say/<sayKey>.mp3`. `AUDIO_REF_PATTERN` (`packages/content-schema/src/schemas/audio.ts`, mirrored in `apps/mobile/scripts/audio/lib.mjs:6`) gains the group `say` and keeps `.mp3`.
- **Controller lookup** (`logic/audio/controller.ts:299-302`): when `spec.audioRef` is absent or not bundled, `tryClip` tries `audio/say/<sayKey(spec.text)>.mp3`. Because the key is the spoken text itself, **a clip can never play for the wrong text**: if content changes the text, the key changes, no clip matches, and the voice speaks the new text until the clip is regenerated. A stale clip is listed by `audio:status`; it is never played.
- Jamo keep their id-named refs (`audio/jamo/<id>.mp3`, `<id>-name.mp3`), because a jamo's text alone does not say which record it is (아 is ㅏ's sound and ㅏ's name; the six t-finals share audio) and the owner's own recordings (A-9) drop into the same names.
- `JamoSchema.nameAudioRef` is filled for the 18 consonants of section 5; Word Builder jamo gain `audioRef` (they have none today, `jamo.ts:206-255`).

### AC-B5 Reproducible batch generation (run by the owner; AU-OD-8)

```
content/audio/tts-manifest.json        committed; generated from content, one row per clip
content/audio/pronunciation-overrides.json   committed; hand-edited
content/audio/tts-lock.json            committed; what was generated, row by row
apps/mobile/scripts/audio/tts/
  build-manifest.mjs                   content -> manifest (no network)
  generate.mjs                         manifest -> WAV masters (network, the owner's key)
  engines/google.mjs azure.mjs polly.mjs
  qa.mjs                               WAV/MP3 -> QA report (no network)
apps/mobile/recordings/tts/<engine>/<voice>/   gitignored: WAV masters and the QA report
```

1. **Manifest** (`pnpm --filter @hangul-route/mobile audio:tts:manifest`): walks every shipped `KoText` (the jamo records, quests, placement, lessons for Stages 2-7, vocabulary, stories, review items, cards) through the extended `scripts/audio/content-sources.mjs` and `scripts/ts-loader.mjs`. Row: `ref`, `key`, `kind` (`jamo-sound`, `jamo-name`, `syllable`, `word`, `sentence`, `narration`), `text` (what the app speaks), `say` (what is sent, after AC-B3), `ipa?`, `rate`, `pack` (AC-B6), `sources` (where it appears). A drift test fails when the committed manifest and the content disagree, like the `audio:map` drift test.
2. **Generate** (`pnpm --filter @hangul-route/mobile audio:tts:generate --engine google --voice <name> --pack <pack> [--pilot] [--only <keys>]`): reads the key **only** from the owner's environment (`GOOGLE_APPLICATION_CREDENTIALS`; `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`; the AWS profile). Writes 24 kHz (Google, Polly) or 48 kHz (Azure) mono WAV masters to the gitignored folder. Rows already in `tts-lock.json` with the same `say`, voice and rate are skipped, so a rerun only pays for changed rows. `--dry-run` prints the requests and the character count with no network, and is what CI and agents run.
3. **Process** with the existing `process-recordings.mjs` (trim, 0.3 s padding each side, loudness to -16 LUFS with the limiter top-up, mono 44.1 kHz MP3, metadata stripped), with a new `--bitrate` option: 64 kbps for jamo clips (as specified), **48 kbps for the `say` group** (AU-OD-7).
4. **Lock**: `tts-lock.json` records per row the engine, voice, model, rate, generation date, `sha256(say)` and the processed MP3's sha256. LLM-style voices are not deterministic, so the MP3 files are the committed asset; the lock proves which input made which file.
5. **Hand-off**: the owner tells the agent the pack is generated (folder path only). An agent runs QA (section 9) and processing on the owner's machine folder and opens the `content(audio)` PR with the processed MP3s, the regenerated `audio-assets` map, the lock rows and the licence rows.

**Key safety:** `.gitignore` already covers `apps/mobile/recordings/`; the scripts never open a key file themselves (each vendor SDK reads the path or profile from the owner's environment: `GOOGLE_APPLICATION_CREDENTIALS`, `AZURE_SPEECH_KEY`, `AWS_PROFILE`), never print a key, and never write one to the lock or the report; a pre-commit check (`scripts/check-no-secrets.mjs`, also in CI) rejects a staged file containing a Google service-account `"private_key"`, an `AKIA` access key id or an Azure key pattern. `generate.mjs` refuses to run inside CI and refuses an output folder that is not gitignored.

### AC-B6 Storage format and lazy packs within the offline budget

| Pack | Clips | MP3 size (64 kbps jamo, 48 kbps say) | Web delivery |
|---|---|---|---|
| `jamo-s1` (30 sounds + 13 names) | 43 | about 0.35 MB | **precache** (AD10), re-measures the learner precache and moves `learnerPrecacheRaw` by the clips' measured bytes (F-CURR-002, CM-5 budget notes: "the row that lands the jamo recordings re-measures the precache") |
| `jamo-wb` (16 sounds + 1 shared final + 5 names) | 22 | about 0.19 MB | runtime cache, warmed with Word Builder |
| `stage1` (quests) | about 56 | about 0.39 MB | runtime cache, warmed with the next quest |
| `placement` | about 86 | about 0.56 MB | runtime cache, warmed when the level check opens |
| `stage2` ... `stage7` | about 71-179 each | about 0.76-1.84 MB each | runtime cache, warmed with the next lesson |
| `vocab`, `stories`, `review`, `cards` | about 46 / 285 / 26 / 10 | about 0.32 / 3.68 / 0.30 / 0.1 MB | runtime cache, warmed by topic or story |

- **Format:** MP3, mono. It decodes everywhere this app runs: iOS 14 Safari's `decodeAudioData` (the open iOS 14 offline issue rules out Opus there), expo-av, Chrome and Firefox. Opus at 24 kbps would be about 2.4 times smaller but is not decodable by older iOS Safari and AVFoundation; not used (AU-OD-7).
- **Pack switch and shared texts:** a text used by two packs is generated once and belongs to the first pack in the order above; switching a pack off (AC-B8) sends its texts back to the voice wherever they appear.
- **Runtime cache:** a second cache `hr-audio-say-v1` for the `say` group (`CacheFirst`, `maxEntries` 1,600, audio/mpeg only); `hr-audio-v1` keeps its 400 for vocab, story, card and dialogue refs.
- **Warming:** `warmClips` (already used by Match Sound and Discover) is called with the next lesson's clip refs when a lesson opens, so a learner who goes offline after starting a lesson still hears it. The **Save for offline** pack of CM-5B (F-CURR-002) includes the stage's audio pack.
- **Bundle size:** the `say` group's require map (about 1,213 entries) is split **per pack** into Metro async chunks, on the same mechanism as the per-lesson and per-story chunks of CM-5 and CM-8 (`scripts/build-stories.mjs` writes `__generated__/story-chunks/`). A pack's map chunk loads with its lesson or story, so the start bundle carries only the `jamo-s1` refs. The start bundle line (7,340,000 B, F-CURR-002) is re-measured by AC-6.
- **Native:** clips are bundled (about 12-16 MB of MP3 in all at these bitrates); no precache limit applies. The native player is A-7 (expo-av), still gated on the owner's Xcode validation #264.

### AC-B7 Fallback order

Unchanged from AD4, with one more step:
1. the record's `audioRef` clip (jamo, vocabulary, story, card, dialogue);
2. **the text-keyed `say` clip** (AC-B4);
3. the device voice (ranked, AD5);
4. the visible text (AD13).

A clip that fails to load or decode falls through to the next step and is reported by `audio.playback_failed` (`kind: 'clip'`).

### AC-B8 Rollout by pack, with kill switches

- **Global switch:** `flags.audioClips` / `EXPO_PUBLIC_AUDIO_CLIPS` (`config/flags.ts:262,296`) turns every clip off.
- **Per-pack switch:** new `flags.audioClipPacks` / `EXPO_PUBLIC_AUDIO_CLIP_PACKS`: a comma list of enabled packs; default "all bundled packs". Removing a pack name sends that pack back to the device voice with one rebuild and no content change.
- **Order:** `jamo-s1` and `jamo-wb` (AC-7) first, because that is where unclear sound and the quiz faults meet; then `stage1` and `placement` (AC-8); then Stages 2-7 one stage per PR (AC-9 to AC-11); then vocabulary, stories, review and cards (AC-12). Web first, native after A-7.
- Each pack PR is a content-only PR: MP3s, the regenerated map, lock rows and licence rows. No code change after AC-6.

### AC-B9 Telemetry (one new name, counts only)

The four `audio.*` names (`packages/content-schema/src/schemas/telemetry.ts:51-54`) report failures, fallbacks, capability and mute; none reports a success, so G3 cannot be measured today. AC-1 adds **one** name, `audio.source_summary`, under the shared list's rules (name first, Worker first, exact-list test, a row in the consolidated telemetry table): sent at most once per session when the session ends or the page hides, with counts only (`{ clip, say, tts, text }`, integers) and the app version; no text, no ref, no learner id, no URL. G3 is `(clip + say) / (clip + say + tts + text)`.

### AC-B10 Copy and disclosure (amends F-AUDIO-004 section 3.12 and AD12)

- AD12 stays: no copy says "native speaker" or "not TTS". The withdrawn reply stays withdrawn.
- A credits line on the About / Legal page and in `docs/launch/faq.md`: en "Korean audio is computer-generated (Google Cloud Text-to-Speech) and checked by automated speech recognition and a multi-agent review." with es and ko values. The vendor name follows the vendor actually used. Required for Azure, kept for any vendor (AU-OD-9).
- After AC-7 and the offline e2e pass, the "plays offline" qualifier of section 3.12 is relaxed for **letter sounds** only: "Letter sounds play offline after your first visit." Words and stories keep the qualifier until their packs ship and are warmed.

### AC-B11 Relation to the owner's recordings (A-9, A-10; AU-OD-6)

- Generated clips **precede** the owner's recordings. T-017 is no longer a launch blocker; `docs/tasks/INBOX.md` row T-017 is marked optional.
- If the owner later records, a recording **replaces** a generated clip under the **same ref** (`audio/jamo/<id>.mp3`, `<id>-name.mp3`), with no code change. Mixing speakers inside the jamo set is not allowed (AD11): the owner replaces the whole jamo set or none of it. Words and sentences may stay generated.
- A-9 becomes "jamo clips (generated or recorded)" and is done by AC-7; A-10 becomes the name and vocabulary rows of AC-7 and AC-12.

## 8. Inventory (what Part B generates)

### 8.1 Distinct utterances (`spokenKo ?? ko`, measured at `524961dae`)

| Source | Distinct |
|---|---|
| Jamo (sounds and names) | 65 files (section 5) |
| Stage 1 quests | 60 |
| Placement | 110 |
| Lessons: Stage 2 / 3 / 4 / 6 / 7 | 155 / 159 / 85 / 130 / 275 |
| Vocabulary | 142 |
| Stories (lines, keywords, scene keywords, check targets, titles) | 84 + 27 + 215 + 143 + 33 + 24 |
| Review items (speakable) | about 630 rows, most shared with the above |
| Heritage cards (not elsewhere) | 10 |

Sum per source 2,346; **deduplicated by text about 1,213 clips**: 270 single syllables, 444 words or phrases, 486 sentences; about 6,700 characters, about 32 minutes of audio. One full generation pass is about 50k characters, about 400k with SSML wrappers; a three-engine pilot plus a full pass plus regenerations stays under 1M characters.

### 8.2 Cost (estimate, the owner's account confirms)

Google Neural2 is $16 per 1M characters and Chirp 3 HD $30 per 1M, each with 1M free characters a month; WaveNet $4 per 1M with 4M free. **Expected total: $0-30. Budget cap: $50 (AU-OD-8)**, set as a billing alert on the owner's Google Cloud project before the first run.

## 9. Verification: two passes before any clip ships (owner request "verify twice")

### Pass 1: automatic (`audio:tts:qa`, no network, run by an agent on the owner's machine folder)

| Check | Rule | Fails when |
|---|---|---|
| ASR round-trip | Local `whisper.cpp` (MIT) with `large-v3`, language `ko`, transcribes every clip. The transcript and the manifest `text` are compared after NFC, removing punctuation and spaces. | A word or sentence differs by more than one Hangul syllable, or differs at all after the override table was applied |
| Short-clip check | For clips of 1-2 syllables (ASR is weak on lone syllables), the same model decodes the clip under a grammar (whisper.cpp `--grammar`) limited to a closed set: the target text and its confusables (the plain/aspirated/tense triple, the other 5 finals, the vowel pairs ㅓ/ㅗ and ㅡ/ㅜ, the letter names that share a syllable) | The target is not the top-scoring candidate |
| Duration and silence | `check-audio.mjs` bounds (jamo 0.6-1.5 s, words and lines 0.6-4.0 s; the five three-syllable tense names such as 쌍기역 take the word bound and its 40 KB size limit); leading and trailing silence after processing 0.25-0.4 s; no internal silence over 0.5 s in a clip of 1-2 syllables | out of bounds (catches truncation and hallucinated extra words) |
| Loudness and peak | -16 LUFS plus or minus 1.5, true peak at most -1.5 dBTP, size limits of F-AUDIO-004 section 3.11 | out of bounds |
| Identity | every manifest row has exactly one clip; every clip's sha256 is in the lock; no two jamo clips that must differ are byte-identical; every surface's spoken text resolves to the clip of the same id and type (`voice-surfaces.test.ts` with the real map) | a missing, extra or swapped clip |

### Pass 2: multi-agent review (MAR)

- At least two independent reviewer agents read the Pass 1 report: transcripts, closed-set scores, durations and a per-clip spectrogram summary (onset, voiced span, final closure for the six finals). Each marks every jamo clip and every flagged word or sentence clip "keep" or "regenerate" with a reason.
- A clip ships only when both reviewers say keep. A disagreement regenerates the clip (a different take, or the override of AC-B3) and repeats both passes for that row.
- The review is recorded in the content PR body as a table (clip, transcript, scores, verdicts). No copy anywhere calls this a native-speaker or expert review.
- **Optional owner listen (recommended, about 10 minutes):** the owner plays the 65 jamo clips back to back with `pnpm audio:tts:listen --pack jamo-s1,jamo-wb` and may veto any clip. This is not a gate (the owner's "finish without waiting on my review" rule), but a veto is honoured.

## 10. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Short-input failures of LLM-style voices (silence, truncation, added words) | wrong or empty jamo clips | Pilot gate on all 65 jamo clips; classic neural voice default; Pass 1 duration and closed-set checks |
| Lone syllables still sound like interjections | unclear letters | the "아." rule of AC-B3, pilot comparison, MAR veto |
| Unreleased finals (악 압) not distinguishable in isolation | finals confused | closed-set check against the other finals; fallback: the final inside a short word (F-AUDIO-004 section 8 item 1) |
| Vendor terms change after generation | doubt about shipped clips | terms URL and the date read in every licence row; clips generated under the terms of that date |
| A clip outlives its text | wrong audio | impossible for `say` clips (key is the text); jamo clips are pinned by `voice-surfaces.test.ts` with the real map |
| Bundle or precache growth | slower first load, CM-5B triggered early | only `jamo-s1` is precached; the `say` map is measured (AC-B6) |
| Mixed voices (vendor clips plus device voice in one screen) | jarring | per-pack rollout makes a whole screen switch at once; a pack ships only complete |
| Key leak | cost, abuse | owner-only keys, gitignored outputs, pre-commit and CI secret check, `generate.mjs` refuses CI, budget alert |
| The name rule (AU-OD-1) is not what the owner meant | rework | option B is one table change; tests are written against `jamoVoice` |
| Open PRs (#865, #855, #850) merge with `playJamo(j, 'sound')` | new mismatches | `voice-surfaces.test.ts` fails on any letter surface that does not go through `jamoVoice`; JV-2 rebases last and migrates what merged first |

## 11. PR breakdown

Order is dependency order. Each PR is tests plus implementation (CLAUDE.md section 5), with en, es and ko values for every new or changed string.

| PR | Title | Content | Size | Needs | Tests |
|---|---|---|---|---|---|
| **JV-0** | `docs(specs)`: audio clips and jamo voice amendment | this file; README line; pointer at the top of F-AUDIO-004 | S | - | - |
| JV-1 | `feat(mobile)`: `jamoVoice`, one source of truth for a letter's voice | `logic/audio/jamo-voice.ts`; `LETTER_QUIZ_JAMO_IDS` / `FINAL_QUIZ_JAMO_IDS`; `playJamo(j, question)` signature with an adapter for old callers | S | - | `jamo-voice.test.ts` |
| JV-2 | `fix(mobile,i18n)`: letter questions say the letter name | every letter surface of section 6.1 through `jamoVoice` (Match Sound, `lp.sym`, Hangul Check with M7, Trace Stroke, Discover JV-A5, lecture slide and quiz, Match Shape if merged); bubble and slide copy (JV-A4, en/es/ko); M6 | M | JV-1 | `voice-surfaces.test.ts`, Match Sound component test, `hangul-check.test.ts`, Discover and lecture tests |
| JV-3 | `fix(mobile,content)`: tile pools and content that say the wrong thing | JV-A3 pool rules in `round-builder.ts`, `scope-builders.ts`, `deck-builder.ts`; finals as sound questions; Placement consonant copy; story `spokenKo` (M8) with the F-CNT-001 rule; M5 label; M9 drift test | M | JV-1 | `voice-pools.test.ts`, `no-bare-jamo-speech.test.ts`, content validator test |
| JV-4 | `test(e2e)`: the voice matches the letter | `e2e/jamo-voice.spec.ts` (fake speech capture and fixture clips) | S | JV-2, JV-3 | itself |
| AC-1 | `feat(content-schema,mobile)`: text-keyed clips and pack switches | `say` group in `AUDIO_REF_PATTERN` and `lib.mjs`; `sayKey`; controller lookup (AC-B7); `flags.audioClipPacks`; `nameAudioRef` on 18 consonants and `audioRef` on Word Builder jamo (shared finals, section 5); `audio.source_summary` (AC-B9; name and Worker first) | M | JV-1 | controller tests (lookup order, stale text never plays), schema tests, flag tests, telemetry exact-list test |
| AC-2 | `feat(scripts)`: clip manifest and pronunciation overrides | `audio/tts/build-manifest.mjs`, content walker extension, `content/audio/tts-manifest.json`, `pronunciation-overrides.json`; normalization rules of AC-B3 | M | AC-1 | manifest unit tests; drift test; no lone jamo, no cloze, digits need `spokenKo` |
| AC-3 | `feat(scripts)`: generator, lock and key safety | `audio/tts/generate.mjs` with Google, Azure and Polly adapters behind one interface; `--dry-run`; `tts-lock.json`; `process-recordings.mjs --bitrate`; `check-no-secrets.mjs` (pre-commit and CI); runbook section in `docs/launch/owner-runbook.md` (Korean) | M | AC-2 | adapters tested against recorded request fixtures with no network; lock and skip logic; secret check fixtures |
| AC-4 | `feat(scripts)`: two-pass QA | `audio/tts/qa.mjs` (whisper.cpp invocation, closed-set scoring, duration, silence, loudness, identity); report format; `audio:tts:listen` | M | AC-3 | evaluator unit tests on synthetic reports; whisper runs locally only (not in CI) |
| AC-5 | `docs(specs)`: pilot result and voice lock | the owner runs the pilot (about 81 rows: all 65 jamo clips, 10 sound-change words such as 국물 신라 같이 좋다, 6 sentences) on Chirp 3 HD, Neural2, and optionally Azure S0 and Polly; both QA passes; the chosen voice and the "아" vs "아." rule recorded in section 13 | S | AC-4, owner step 2-3 | - |
| AC-6 | `feat(mobile)`: web packs and offline budget | `pwa-postbuild.mjs` (`hr-audio-say-v1`, `globIgnores`, precache only `jamo-s1`), `warmClips` for the next lesson, CM-5B pack hook, `_headers`, per-pack async map chunks (AC-B6) and the start-bundle re-measure | M | AC-1 | pwa build assertions (`precacheGaps`, `precacheLeaks`, budget), e2e offline replay with fixture clips |
| AC-7 | `content(audio)`: jamo clips (65) | `jamo-s1` and `jamo-wb` MP3s, map, lock, licence rows; credits line (AC-B10, en/es/ko); the letter-sound offline claim | S | JV-2, AC-5, AC-6 | `audio:check`; QA report; e2e un-skipped offline Match Sound |
| AC-8 | `content(audio)`: Stage 1 quests and Placement | packs `stage1`, `placement` | S | AC-7 | same |
| AC-9 | `content(audio)`: Stages 2 and 3 | packs `stage2`, `stage3` | S | AC-8 | same |
| AC-10 | `content(audio)`: Stages 4 and 6 | packs `stage4`, `stage6` | S | AC-8 | same |
| AC-11 | `content(audio)`: Stage 7 | pack `stage7` | S | AC-8 | same |
| AC-12 | `content(audio)`: vocabulary, stories, review, cards | remaining packs; vocab clips use their existing `audio/vocab/<slug>.mp3` refs | M | AC-8 | same; runtime cache entry count |
| AC-13 | `feat(mobile)`: native clips | after A-7 and the owner's Xcode validation #264: native require maps for every pack; device matrix rows | S | A-7, AC-7 | native player tests, device checklist |

Part A (JV-1 to JV-4) does not wait for Part B and ships first: it fixes the owner's second request with the device voice alone.

## 12. Owner decisions (each with the default that applies until answered)

| # | Decision | Default | Gates |
|---|---|---|---|
| AU-OD-1 | What a letter question says | **A: the letter name** (니은), as the owner asked. B: keep the sound (나) and only fix pools and copy. | JV-2 |
| AU-OD-2 | Discover consonant page | **Name first (Hear it), then "Hear it with a vowel" (나) as the second button.** | JV-2 |
| AU-OD-3 | Placement consonant items | **Keep the sound (나) with the copy "Which letter starts this sound?"**: Placement measures decoding. Alternative: names. | JV-3 |
| AU-OD-4 | Vendor | **Google Cloud Text-to-Speech**; Azure S0 fallback; Polly third. | AC-3, AC-5 |
| AU-OD-5 | Voice | **The pilot's winner**; Chirp 3 HD only with zero jamo failures, otherwise one Neural2 voice. Male or female: the owner's ear in the pilot, else the one with fewer QA flags. | AC-5 |
| AU-OD-6 | Owner recordings | **Generated clips first; T-017 optional;** a recording later replaces the whole jamo set under the same refs. | AC-7 |
| AU-OD-7 | Format | **MP3 mono, 64 kbps jamo, 48 kbps everything else.** No Opus (iOS 14). | AC-3, AC-6 |
| AU-OD-8 | Budget | **$50 cap**, billing alert set before the first run. | AC-5 |
| AU-OD-9 | Disclosure | **Credits line naming the generated voice, for any vendor.** | AC-7 |
| AU-OD-10 | Discover example word 나 on the ㅏ page | **Keep** (the only real word Quest 1's letters spell), add the "Example word" label. | JV-3 |

### Owner steps (in Korean in `docs/launch/owner-runbook.md`, added by AC-3)

1. Answer AU-OD-1 if the default is not what you meant. Nothing else needs an answer.
2. Create or pick a Google Cloud project, enable the Cloud Text-to-Speech API, set a $50 budget alert, create a service-account key and save it **outside the repo**; export `GOOGLE_APPLICATION_CREDENTIALS` in your own shell. Do not paste the key or its path into a chat, an issue or a PR.
3. Run the pilot: `pnpm --filter @hangul-route/mobile audio:tts:generate --engine google --pilot` (about 81 rows, each on the two Google candidates; inside the free tier). Tell the agent "pilot generated".
4. After AC-5 records the voice, run one pack at a time, starting with `--pack jamo-s1,jamo-wb`, and tell the agent each time.
5. Optional: listen to the jamo clips with `audio:tts:listen` and name any you want regenerated.

## 13. Pilot result and voice lock

Filled by AC-5: engine, voice, model, rate, the "아" vs "아." rule, the overrides the pilot needed, the QA summary per candidate, and the date.

## 14. Review log

- 2026-10-29: written from the jamo speech audit, the audio inventory and the vendor licence research at `524961dae` (read-only; no audio recorded, no vendor account used). Line references spot-checked against the tree for M1, M2, M3, M5, M6, M7, M8, M10 and section 5.
