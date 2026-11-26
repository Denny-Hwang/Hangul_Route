# AMENDMENTS-DISCOVER-SOUND-FIRST — a new letter is heard by its sound first

Status: ready (multi-agent review 2026-11-25, §11; open decisions SF-OD-1 to SF-OD-5 adopted provisionally, §10). Written for work order WO-13 of `docs/roadmap/review-2026-11/phase-2-hangul.md`, row SF-0, on main `8676b5de5`. Built on **owner decision 2026-11-22 (OD-R2)**, approved as recommended (`docs/roadmap/review-2026-11/README.md` §4): keep the letter-name decision AU-OD-1 (2026-10-29), but put the sound first in Discover, using the "one table change" that `AMENDMENTS-AUDIO-CLIPS.md` promised (`:80`, `:509`).

**Owner decision 2026-11-25**: the open decisions SF-OD-1 to SF-OD-5 are approved as recommended ("권고대로 진행해줘"); they are no longer provisional.

**Row SF-3 added 2026-11-26** (§12): the "아 · 오 · 우" button on the initial ㅇ card, WO-12 item 13 (`AMENDMENTS-STAGE1-CONTENT-FIXES.md` §1.1 #13, OD-CF5), which CF moved to WO-13 and SF-0 had left out of scope. **Owner decision 2026-11-26**: the owner assigned it to this amendment and approved its open decisions SF-OD-6 to SF-OD-8 as recommended.

> **Amended 2026-11-25 by `AMENDMENTS-MINIMAL-PAIRS.md` [MP]** (work order WO-16 of the 2026-11 review: hear plain, aspirated and tense consonants apart, on approved clips only) (SF-OD-5, SF-OD-4): SF-OD-5 is answered there (§3.11, MP-OD-5): Match Sound keeps the name; quest 6's new contrast step is the sound practice of 가 / 카 and the other plain / aspirated pairs, on approved clips. SF-OD-4 (a): the four Check rounds keep the series rule; practice now includes the contrast, in contrast rounds only.

**Amends** (each gets an "Amended 2026-11-25 by AMENDMENTS-DISCOVER-SOUND-FIRST [SF]" line in this PR):
- `AMENDMENTS-AUDIO-CLIPS.md`: JV-A5 (Discover's button order and the line under each button), the "Discover" and "Listen & Pick letter rounds" rows of §6.1, the `startsWith` row of JV-A4 (one more user), and AU-OD-2 in §12 (reversed). JV-A1's rule for letter questions is **not** changed.
- `F-QUEST-002-discover-check-stage1-complete.md`: §3.2 item 1 (Discover goes back to its own 2026-10-12 text: **Hear it** plays the sound, the name is the second button), §3.3 Round 1 (a consonant round is "hear a sound, pick the written symbol" again), §3.6 (the Check options of quests 4 and 6) and §3.10 (Listen & Pick's heading on such a round).
- `AMENDMENTS-AUDIT-2026-11.md`: AU-10 (the sound that plays by itself when a Look and learn page opens is now the letter's sound, 가, not its name).
- `design/wireframes/quest/discover.md` (section "[SF] Sound first"; from row SF-3, also "[SF-3] The ㅇ card").
- From row SF-3 (2026-11-26): `AMENDMENTS-STAGE1-CONTENT-FIXES.md` OD-CF5, §4 and §8 (item 13 now points at §12 here).

**Not amended**: AU-OD-1 and JV-A1's letter-question rule. Match Sound, Listen & Pick letter rounds outside the four quest Check rounds of §3.7, the Hangul Check, Trace Stroke, the lecture letter slide and its sound quiz, the presenter sound check and Match Shape's pair board still say a letter by its name (the lecture's copy of those four Check rounds follows them, §3.7) (OD-R2: "keep the decision itself"). The Hangul Check belongs to WO-10 (`AMENDMENTS-STAGE1-DECODING-CHECK.md`). Content fixes belong to WO-12 (`AMENDMENTS-STAGE1-CONTENT-FIXES.md`); its item 13, a "아 · 오 · 우" button on the ㅇ page, is row SF-3 of this amendment (§12, added 2026-11-26). QS-3 and AU-10's conditions (sound on, no screen reader, something can play) do not change.

**Why a new file, not a section of `AMENDMENTS-AUDIO-CLIPS.md`** (the WO suggests a section there; the decision was left to this row):
1. The repo amends an amendment with a new file and a tagged pointer in the old one: `AMENDMENTS-QUEST-SOUND-BACK.md` put a `[QS]` note into AUDIO-CLIPS G7 (`:60`), and `AMENDMENTS-AUDIO-CANT-HEAR.md` chose a separate file for the same reasons (its "Not amended" line).
2. This change needs the 8-section template and its own row table (README §5.1 step 2). AUDIO-CLIPS is a 14-section document with its own numbering; a section inside it could not carry a template.
3. AUDIO-CLIPS is `ready` with open rows (AC-13 native clips; clips held for a later round) and many recent edits. Short `[SF]` notes there do not collide with that work; a new section would.
4. This change reaches past AUDIO-CLIPS's scope: the quest Check's round 1 (F-QUEST-002 §3.3) and Listen & Pick's heading (§3.10), and a field on `ListenPickRoundSchema`.

AUDIO-CLIPS stays the one place that says what each surface speaks: its JV-A5, §6.1 and §12 point here.

**Scope (row SF-1)**: `apps/mobile/src/logic/stage1/discover-flow.ts`, `apps/mobile/src/screens/quest/DiscoverStep.tsx` (with the `|vowel` comment at `:83`), `apps/mobile/src/logic/scope-builders.ts`, `apps/mobile/src/logic/voice-pools.ts`, `apps/mobile/src/logic/minigame-config.ts` (four Check rounds), `apps/mobile/src/screens/minigames/ListenPickGame.tsx` (the heading), `apps/mobile/src/logic/lecture/build-steps.ts`, `logic/lecture/deck-builder.ts` and `screens/presenter/slides/QuestionSlide.tsx` (the lecture's copy of the four rounds, §3.7), `packages/content-schema/src/schemas/minigame.ts` (one optional field), `packages/i18n/src/messages/{en,es,ko}/learner.ts` and `a11y.ts` (two keys), `packages/i18n/src/messages/review-ledger.json`, `content/i18n/{es,ko}/minigames.json` (the four rounds' prompt gloss), and the tests of §6.
**Owner**: solo dev
**Rollout**: next release

---

## 1. Context

### 1.1 Citations of WO-13, re-read on `8676b5de5`

The WO was written on `d5ba0217c` and re-checked there. Paths under `apps/mobile/src/` are written from `src/` below.

| # | WO-13 says | On `8676b5de5` | Verdict |
|---|---|---|---|
| 1 | `AMENDMENTS-AUDIO-CLIPS.md:78`: AU-OD-1, "option B ... is one table change; tests are written against `jamoVoice`"; `:507` the same | `:80` (JV-A1 "What this replaces") and `:509` (§10 risk row) | moved 2 lines; same text |
| 2 | `packages/i18n/src/messages/en/learner.ts:765` `soundWith: { cta: 'Hear it with a vowel' }` | `:791` (`hearIt` `:789`, `sayLine` `:793`) | moved; same text |
| 3 | `logic/stage1/discover-flow.ts:214, 228` `loneLetterVoice`: the Hear it of a consonant is its name | `:214` `const main = loneLetterVoice(jamo)`, `:228` `hear: hear(\`${key}\|sound\`, main.text, main.audioRef, 'sound')`; the second button is built from `jamoVoice(jamo, 'sound')` at `:219-220` and `:231-239` | correct |
| 4 | `discover-flow.ts:417-420` `autoHearId`: AU-10 plays the page's first item's `hear` | `:417-420`: `first?.kind === 'symbol' ? first.hear.id : undefined` | correct: autoplay follows `item.hear`, so SF-1 needs no change there |
| 5 | QS-3: the autoplay waits 350 ms | `screens/quest/DiscoverStep.tsx:246-282` (the effect), `:261` `afterScreenSettles`; `logic/audio/settle.ts:8` `SCREEN_SETTLE_MS = 350` | correct |
| 6 | reported: the hint under a letter describes the sound ("a soft, light g") while the main button plays the name | `content/jamo.ts:27` `'jamo:giyeok': 'a soft, light g (between g and k)'`, rendered under the glyph (`DiscoverStep.tsx:511-515`) above **Hear it** (`:525-533`), which plays 기역 | correct |
| 7 | design: the quest Check's round 1 uses the existing `startsWith` line ("Which letter starts this sound?") | `learner.ts:1146` `audio.heading.startsWith`, with es (`es/learner.ts:787`) and ko (`ko/learner.ts:762`) values; used today only by Placement (`logic/placement/item-view.ts:75`). Listen & Pick has one heading for every round, `listenPick.heading` "Listen, then pick" (`learner.ts:919`; chosen at `screens/minigames/ListenPickGame.tsx:465`) | correct; Listen & Pick needs a per-round way to show it (§3.7) |
| 8 | (the review item behind the WO) the quest Check's round 1 says the name | Round 1 of every Stage 1 quest Check that asks a symbol is `lp.sym` (`logic/scope-builders.ts:63-84`), a letter question: `jamoVoice(jamo, 'letter')` at `:66`. Rounds: `minigame-config.ts:227` (ㅓ), `:248` (ㅜ), `:267` (ㅡ), `:296` (ㅊ), `:322` (ㅅ), `:350` (ㅋ), `:440` (ㅛ), `:713` (ㅍ, then ㅗ) | correct, with a finding: five of the nine targets are vowels, whose name **is** their sound (§3.7) |

None of these changes the plan. Item 8 narrows it: only the four consonant rounds change what is heard.

### 1.2 What happens today

- Quest 1, page 2 of Look and learn (ㄱ, ㄴ; `content/quests.ts:41-46`): the page opens and, 350 ms later, says **기역** by itself (AU-10, QS-3). The learner has met ㅏ and ㅓ only; 기역 holds ㅣ, ㅕ, a silent ㅇ and a final ㄱ, none of them taught. The hint above the button says "a soft, light g". The sound 가 is only on the small second button, **Hear it with a vowel**.
- Quest 6 (`quests.ts:231`) has Hoya say "Tap Hear it: k is like g with a puff of air". **Hear it** on the ㅋ page plays 키읔, so the line is not true.
- A learner who cannot hear and gets the text line sees "Say it out loud: giyeok" (`discover-flow.ts:617`, `sayLine` of `spokenRomanization`): it asks them to say the name, not the sound.
- The quest Check's ㅊ round (quest 4) says 치읓, so the one Check item about the new consonant measures "know the name", not "know the sound".

Before AUDIO-CLIPS (2026-10-29), F-QUEST-002 §3.2 item 1 said the opposite: "it plays the symbol's **sound** ... never the letter name of the other consonants; the letter name is a second, optional **Letter name** button". JV-A5 reversed that to follow the letter-question rule. The wireframe still has the old text (`design/wireframes/quest/discover.md`, "Interaction points").

### 1.3 How OD-R2 reads here

OD-R2: "Keep the decision itself (AU-OD-1); use the spec's option B ('one table change')".

- **AU-OD-1 stays.** A letter question still says the letter's name. "Option B" here is **not** AU-OD-1 option B (which would make every letter question say the sound); it is the mechanism AUDIO-CLIPS named for it: every surface speaks through `jamoVoice(jamo, question)`, so moving a surface from one question to the other is one table change. The table is `logic/__tests__/voice-surfaces.test.ts` (the §6.1 list in code): its two Discover rows (`:202-213`) swap their question types.
- **AU-OD-2 is reversed.** AU-OD-2 (2026-10-29) chose "name first (Hear it), then Hear it with a vowel". After SF-1, Discover's **Hear it** says the sound (가) and a second button, **Hear the name**, says the name (기역).
- **Why Discover may differ from the letter-question rule.** A Discover page is not a question: nothing is asked and nothing is scored. It teaches. The letter-question rule exists so a voice never says a syllable for "which letter is this?" (JV-A1, M1). On Discover both forms are on screen, each under its own labelled button with its own line, so neither can be mistaken for the other, and the sound is what reading needs first.
- **The quest Check's round 1.** WO-13's design makes the quest Check's symbol round a sound question with the existing `startsWith` line, and leaves name questions to the Hangul Check (WO-10). §3.7 does this for the four consonant rounds.
- **A known effect of keeping AU-OD-1.** The step after Look and learn is Match Sound ("Match the Sound", "Tap the letter you hear"), and it still says the **name** (기역). After SF-1 a learner who never taps the optional **Hear the name** button meets 기역 there for the first time, and a step called "Match the Sound" plays the name while Discover just presented 가 as the sound. Every basic consonant's name begins with that consonant's own sound (기역, 니은, 디귿 ... 히읗; ㅇ's 이응 is the exception), so the learner can still match by the first sound, and the name is one tap away on Discover. Moving Match Sound to the sound would change AU-OD-1, which OD-R2 kept; it is open decision SF-OD-5 for the owner.

### 1.4 The clips are there

Every sound the new first button plays has a shipped clip (AC-7, 65 of 65; `apps/mobile/assets/audio/jamo/`):

| Discover symbol | Hear it (after SF-1) | Clip | Pack | Hear the name | Clip |
|---|---|---|---|---|---|
| 13 basic consonants (ㄱ to ㅎ, not ㅇ) | 가 나 다 라 마 바 사 자 차 카 타 파 하 | `audio/jamo/<id>.mp3` | `jamo-s1`, precached (`content/__generated__/audio-assets.ts`) | 기역 ... 히읗 | `audio/jamo/<id>-name.mp3`, `jamo-s1` |
| initial ㅇ | 이응 (unchanged: it has no sound of its own) | `audio/jamo/ieung.mp3` | `jamo-s1` | none (name = what Hear it says) | — |
| 10 Stage 1 vowels, 11 Word Builder vowels | 아 ... (unchanged: a vowel's name is its sound) | `audio/jamo/<id>.mp3` | `jamo-s1` / `jamo-wb` | none | — |
| 6 Stage 1 finals, 9 Word Builder finals | 악 안 알 암 압 앙; 앋 악 압 (unchanged; M12) | `audio/jamo/<id>-batchim.mp3` and the shared `jamo-wb` finals | `jamo-s1` / `jamo-wb` | none (a final is never said by name) | — |
| 5 tense consonants (Word Builder) | 까 따 빠 싸 짜 | `audio/jamo/ssang<id>.mp3` | `jamo-wb`, a lazy chunk (`content/__generated__/audio-packs/audio-pack-jamo-wb.ts`) | 쌍기역 ... 쌍지읒 | `ssang<id>-name.mp3`, `jamo-wb` |

So no new clip is needed. §3.5 says what happens when a clip does not play.

## 2. User story

> As a learner meeting ㄱ for the first time, I hear **가** first, the sound I will read in words, and I can then tap **Hear the name** to hear 기역, the word grown-ups and the letter games use for it.
>
> As a learner in the quest's Quick check, when a consonant round plays a sound, the heading tells me what to do: "Which letter starts this sound?"

## 3. Acceptance criteria

### 3.1 The Discover symbol card, by kind

| Symbol | Big button **Hear it** (pulses on the first card) | Line under it | Second button | Line under it |
|---|---|---|---|---|
| Consonant whose name differs from its sound (13 Stage 1, 5 Word Builder) | its sound: `jamoVoice(j, 'sound')` (가, sound clip) | the taught line **"가 = ㄱ + ㅏ"** with its romanization **ga** (`KoreanText`, content; it was the second button's line). Its accessible label is the syllable and its romanization only ("가, ga"), so a Korean screen-reader voice does not read the lone ㄱ of the equation as its name 기역 | **Hear the name**, small, ghost tone: `jamoVoice(j, 'letter')` (기역, name clip) | **"기역"** with **giyeok** (`KoreanText`; it was the line under Hear it) |
| Initial ㅇ | 이응, as today | 이응 · ieung, as today | none | — |
| Vowel | its sound, as today (아) | 아 · a, as today | none | — |
| Final | its closed syllable, as today (악; Word Builder finals by their pronounced form, M12) | the `finalLine`, as today | none | — |
| Word, exchange line | as today | as today | — | — |

- The order on a consonant card is: glyph and romanization, sound hint, **Hear it**, its line, **Hear the name**, its line, the **Can't hear it?** link (first card only, CH-1d), the block (finals only), the example word, the "Say it out loud" lines, the status panel. Reading order for a screen reader is the same.
- The second button and its line appear exactly where the old **Hear it with a vowel** did: only for a consonant whose sound and name differ (`jamo.kind === 'consonant' && jamoVoice(j, 'sound').text !== jamoVoice(j, 'letter').text`, guarded as `discover-flow.ts:219-220` is today: the kind first, because `jamoVoice(final, 'letter')` throws). ㅇ, vowels and finals have one button.
- Sizes and tones do not change: **Hear it** is `size="lg"`, `tone="secondary"`, pulses once (static under reduced motion); **Hear the name** is `size="md"`, `tone="ghost"` (`DiscoverStep.tsx:525-533`, `:549-556`). **Hear it** is at least `touchTarget.child` (80), **Hear the name** `touchTarget.min` (64; `Button` `md`). [SF-3] corrected 2026-11-26: this line said both were `touchTarget.child`.
- The heard mark, Continue, Previous, Read along, `romanizationMode` and `quest.discover_completed { questId, pages, heard }` behave as today. `heard` counts distinct buttons tapped; the second button's id changes (below), its count does not.

### 3.2 View model (`logic/stage1/discover-flow.ts`)

- `symbolItem` (`:202-244`): `hear` is built from `jamoVoice(jamo, 'sound')` for **every** symbol (for ㅇ, a vowel and a final this is the same text and clip as today's `loneLetterVoice`). `spokenRomanization` is that voice's romanization (`ga`), so the text fallback says "Say it out loud: ga".
- `spokenLine` on a consonant whose name differs becomes the carrier line: `{ ko: '가 = ㄱ + ㅏ', romanization: 'ga' }` (built as `soundWith.ko` is today, `:235`). On ㅇ and a vowel it stays `{ ko: main.shown, romanization: main.romanization }`; a final keeps `finalLine` and no `spokenLine`.
- `soundWith` is replaced by `nameButton?: { action: HearAction; ko: string; romanization: string }`: the action is `hear(\`${key}|name\`, name.text, name.audioRef, 'sound')` with `name = jamoVoice(jamo, 'letter')`; `ko` and `romanization` are the name and its romanization (기역, giyeok).
- Action ids: the main button stays `<item key>|sound` (now truthfully the sound); the second becomes `<item key>|name` (was `|vowel`). The `HearAction.id` comment (`:37`) and the test ids `discover-hear-<id>` follow.
- `autoHearId` (`:417-420`), `autoHearAllowed` (`:427-429`) and the reducer do **not** change.
- `loneLetterVoice` is no longer imported by `discover-flow.ts`; it stays for the lone-letter surfaces (`logic/audio/jamo-lines.ts:21-23`).
- `pageRender` (`:615`): the ids of an item are `[item.hear.id, item.nameButton?.action.id, item.example?.hear.id]`.

### 3.3 The sound that plays by itself (AU-10, QS-3)

- **Given** a learner's or a guest's quest (`autoHear`), **when** a Look and learn page opens whose first item is a consonant other than ㅇ, **then** 350 ms later the page says that consonant's **sound** once (가 on quest 1's page 2), by its clip when the clip can play, else by the Korean voice. This follows from §3.2: the autoplay plays `item.hear`. No code in `DiscoverStep.tsx:246-282` changes; tests pin it (§6).
- Everything else of AU-10 and QS-3 stays: not with sound off, not with a screen reader on, not when nothing can say it; once per page; a tap on any button during the wait plays at once and drops the autoplay; it stops when the page changes; `tapped` (the `heard` count) does not move.
- WO-13's acceptance: a quest 1 learner on page 2 hears **가** before any tap, and tapping **Hear it** on ㄱ says 가.

### 3.4 Can't hear it? on Discover (CH-1d)

Unchanged: one guidance-only link per page, under the first card's buttons, with the device line and **Hear it**. Its **Hear it** plays the first card's `item.hear` (`DiscoverStep.tsx:565`), which is now the sound.

### 3.5 When a sound does not play (consistent with F-AUDIO-004 AD4 and `AMENDMENTS-AUDIO-CANT-HEAR.md`)

Discover is a surface whose Korean is printed next to the speaker (`textOnScreen`, F-AUDIO-004 §3.9 A-5b; CANT-HEAR §3.1 "Discover, guidance only"). Nothing new is needed; the order is the existing one:

1. **The clip** (`audio/jamo/<id>.mp3`). The `jamo-s1` set is precached. A `jamo-wb` clip plays once its chunk has loaded; until then, and if the remote switch `audioClips` or `audioPack.<pack>` is off (AC-B8), the next step applies.
2. **The ranked Korean device voice** says the same text (가), as for every prompt (AC-B7, AC-B12).
3. **No clip and no Korean voice, sound off, or a failed or blocked play:** the item shows "Say it out loud: ga" (now the sound's romanization, not "giyeok"), the card's status panel says why with its one action, and the carrier line "가 = ㄱ + ㅏ · ga" and the name line "기역 · giyeok" are already printed. Nothing else changes; Continue is never held. The autoplay is skipped (`autoHearAllowed`: no clip and no voice).
4. **The second button** follows the same order with the name clip; its own line is its text fallback.

A content test pins the first step for shipped content: every consonant on a shipped Discover page has its sound clip and, if its name differs, its name clip in the clip map (`AUDIO_ASSETS` or its pack chunk) (§6).

### 3.6 Strings and labels

| Key | English (Pre-A1) | Where |
|---|---|---|
| `learner.quest.discover.hearIt.cta` (exists, `:789`) | "Hear it" (unchanged) | the big button on every card |
| new `learner.quest.discover.hearName.cta` | **"Hear the name"** | the second button on a consonant card |
| new `a11y.hearNameLabel(letter: string)` | **"Hear the name. {letter}"**, with `letter` = `a11y.discoverLetter(romanization)` without the hint ("Korean letter g/k") | the second button's accessible name; the visible label is its start (WCAG 2.5.3), in every locale (a test pins it, §6) |
| `learner.quest.discover.soundWith.cta` (exists, `:791`) | "Hear it with a vowel" (unchanged) | no longer used by Discover; the presenter's letter slide still uses it (`screens/presenter/slides/LetterSlide.tsx:117`), so the key stays. Its comment says so |
| `learner.audio.heading.startsWith` (exists, `:1146`) | "Which letter starts this sound?" (unchanged) | also the quest Check's consonant round (§3.7) |
| `a11y.hearItLabel` (exists, `a11y.ts:85`) | "Hear it. {label}" (unchanged) | the big button |

- **Why "Hear the name", not WO-13's "Hear its name"**: the same length and level, and young readers and learners of English often mix up "its" and "it's".
- **Why the big button keeps "Hear it"** (WO-13's sketch said "Hear the sound"; open decision SF-OD-1, adopted provisionally): "Hear it" now plays the sound, which is what every Hoya line already promises ("Tap Hear it to listen to each one", `quests.ts:32` and nine more Stage 1 Discover steps; quest 6's "Tap Hear it: k is like g with a puff of air" becomes true). Renaming it would change ten Stage 1 Hoya lines and their es and ko overlays, collide with WO-12's content row in `quests.ts`, and make the ㅇ page's single button ("Hear the sound" playing 이응) false. The pair "Hear it" / "Hear the name" still tells the two buttons apart.
- **es and ko.** Spanish and Korean are shipped locales (`packages/i18n/src/locales.ts:31-35`), so a missing key fails `es-coverage.ts` / `ko-coverage.ts`. R8 runs only after a merge to `main`, so SF-1 drafts the es and ko values of the two new keys itself, has them reviewed under F-I18N-001 §3.10 (the two-lens review) and re-signs the ledger for `learner` and `a11y`, in the same PR, as CH-1a did (CANT-HEAR §3.10). This spec writes English only.
- No string holds Hangul or an age word; the taught lines are `KoreanText` content (CLAUDE.md §8).

### 3.7 The quest Check's consonant round becomes a sound question

F-QUEST-002 §3.3 Round 1 said "hear a sound, pick the written symbol"; JV-2 made it a letter question (`lp.sym`, the name). For a **consonant** target it becomes a sound question again.

**Which rounds.** Round 1 of each Stage 1 quest Check that asks a consonant other than ㅇ:

| Check (`minigame-config.ts`) | Target | Today: voice and options | After SF-1: voice | Options after SF-1 |
|---|---|---|---|---|
| `s1-life-q1-check` (`:296`) | ㅊ | 치읓; ㅊ ㅈ ㄱ ㄷ | 차 (`chieut.mp3`) | **ㅊ ㄴ ㄱ ㄷ** (ㅈ out: same series) |
| `s1-life-q2-check` (`:322`) | ㅅ | 시옷; ㅅ ㅈ ㅂ ㅁ | 사 (`siot.mp3`) | ㅅ ㅈ ㅂ ㅁ (unchanged) |
| `s1-life-q3-check` (`:350`) | ㅋ | 키읔; ㅋ ㄱ ㅌ ㄷ | 카 (`kieuk.mp3`) | **ㅋ ㄴ ㅌ ㄷ** (ㄱ out: same series) |
| `s1-crafts-q4-check` (`:713`, first round) | ㅍ | 피읖; ㅍ ㅁ ㄹ ㅅ | 파 (`pieup.mp3`) | ㅍ ㅁ ㄹ ㅅ (unchanged; ㅂ was already left out, `:710-712`) |

Left as letter rounds, unchanged (open decision SF-OD-3): the vowel rounds `s1-letters-q1-check` ㅓ (`:227`), `-q2` ㅜ (`:248`), `-q3` ㅡ (`:267`), `s1-rites-q3-check` ㅛ (`:440`) and the second round of `s1-crafts-q4-check` ㅗ. A vowel's name is its sound, so the voice is already the sound (어, 우, 으, 요, 오), and "Which letter starts this sound?" would be false for a vowel: 어 is written ㅇ + ㅓ, so the letter it starts with is ㅇ. The batchim quests' round 1 is already a syllable round (`lp.syl`).

**Rules for the sound round:**
- **Builder.** A new `lp.symSound(jamoId, taughtIds, { optionIds })` in `logic/scope-builders.ts` beside `lp.sym`. `optionIds` is **required**: `lp.sym`'s default options come from the confusables (`checkOptionIds`; `logic/stage1/confusables.ts:20-23`), which list the series partner first (ㅊ → ㅈ, ㅋ → ㄱ, ㅍ → ㅂ). It throws for a vowel, ㅇ (no sound of its own) or a final. The prompt is `jamoVoice(jamo, 'sound')`: text 차, romanization `cha`, `audioRef` the sound clip. Options are built as in `lp.sym` (the glyph, its romanization, `the letter <nameEn>`).
- **The prompt's gloss**, shown once the round is answered (`logic/listen-pick-flow.ts:237`), is **`the sound of the letter <nameEn>`** ("차 · cha, the sound of the letter chieut"), not `lp.sym`'s `the letter <nameEn>`: 차 is also a word, taught as "tea" on quest 4's Discover (`content/quests.ts:159`) and offered as "tea" in the same Check's round 2 (`minigame-config.ts:297`), and 사 and 파 are words too, so "차 · the letter chieut" would read as a meaning. The es and ko values of the four rounds' prompt gloss (`content/i18n/{es,ko}/minigames.json`, keys `listenPick.rounds.lp-sym-jamo-<id>.prompt`; today "la letra chieut" / "글자 chieut") are re-drafted in the same PR and reviewed with the two new UI keys.
- **Same id.** The round keeps the id `lp:sym:<jamoId>`, so the memory store (`logic/memory/resolve.ts:113`, the `recognize` rung of the letter), the speech rate (`logic/audio/listen-pick-speech.ts:19`, `sound`), Browse's "letter" fact (`logic/browse/facts.ts:163`) and the quest scaffold filter (`logic/quest-flow/quest-scaffold.ts:30`) read it unchanged.
- **One new field.** `ListenPickRoundSchema` (`packages/content-schema/src/schemas/minigame.ts:116-145`) gains `frame: z.literal('startsWith').optional()`. Only `lp.symSound` sets it. The name follows the lecture quiz's `frame: 'endsWith'` (`screens/presenter/slides/QuizSlide.tsx:84`).
- **Heading.** `ListenPickGame.tsx:465`: a round with `frame === 'startsWith'` (and no text prompt or spelling kit) shows `learner.audio.heading.startsWith` instead of "Listen, then pick", in the heading and in the round's accessible label (`:466-470`). Hoya's miss line stays "Listen again".
- **Pool.** Every option passes JV-A3 rule 2 (`soundTileAllowed`, `logic/voice-pools.ts:54-59`: one kind, no option is a component of 차), **and** no option is in the **target's** plain / aspirated / tense series (ㄱ ㅋ ㄲ, ㄷ ㅌ ㄸ, ㅂ ㅍ ㅃ, ㅈ ㅊ ㅉ, ㅅ ㅆ). Two distractors may be partners of each other: the ㅋ round keeps ㅌ and ㄷ. A new `sameSeries(a, b)` in `voice-pools.ts` holds the table. Reason: 차 against 자 or 카 against 가 differ only by aspiration, the hardest contrast for English and Spanish speakers and the one a device voice blurs (AUDIO-CLIPS §1.2; the rule `minigame-config.ts:710-712` already applies to this Check). Training that contrast is WO-16's minimal-pair work, with clips, not a two-item Check. So quest 6's own point ("k is like g with a puff of air") is taught on Discover and practised in Match Sound (by name), but checked by ear nowhere until WO-16. `lp.symSound` throws on a pool that breaks either rule, so a content test fails first.
- **The lecture's copy of these rounds.** A lecture deck that includes a quest replays its Check as `listen` quiz slides (`logic/lecture/deck-builder.ts:771-810`, `listenStep(..., check = true)`; the prompt type is `logic/lecture/build-steps.ts:54`), whose question reads "Which one did you hear?" (`screens/presenter/slides/QuestionSlide.tsx:38`). After SF-1 the four rounds say 차, so that question no longer fits. The `listen` prompt gains `frame?: 'startsWith'`, copied from the round, and `QuestionSlide` then shows `learner.audio.heading.startsWith`, as `QuizSlide.tsx:84` does for `frame: 'endsWith'`. Nothing else in the lecture changes.
- **Can't hear it?** In the quest Check the asked text is the romanization alone (CANT-HEAR §3.12, CH-1e: the options hold theirs, AU-8), so **Show the letters** shows "cha"; a right answer after it is hinted for the memory store (CH-1f). No change.
- **Scoring** is unchanged (first try; two rounds; F-QUEST-002 §3.3).

### 3.8 [On device, owner]

- iPhone (PWA) and an Android phone, quest 1, page 2: the page says 가 by itself (the clip), Hear it says 가, Hear the name says 기역. With the silent switch on (iPhone) nothing plays and Can't hear it? is under the first card.
- The same page at the Largest text setting and on a 320-wide window: both buttons and both lines fit, the page scrolls, Continue stays reachable.
- VoiceOver / TalkBack on the ㄱ card: the second button reads "Hear the name. Korean letter g/k"; nothing plays by itself.
- Quest 4's Quick check, round 1: the heading reads "Which letter starts this sound?" and the voice says 차; after the answer the panel reads "차 · cha, the sound of the letter chieut".
- VoiceOver / TalkBack on the line under Hear it: it reads "가, ga", not "기역".

## 4. Out of scope

- AU-OD-1 itself, and every letter question outside the four Check rounds of §3.7 (Match Sound, Listen & Pick letter rounds in Play steps, the Hangul Check, Trace Stroke, the lecture letter slide and quiz, the presenter sound check, Match Shape's pair board). Under OD-R2 they keep the name. Match Sound in quest 1 still says 기역; Discover now teaches 가 first and 기역 only on its optional second button, so a learner may hear the name for the first time in Match Sound (§1.3, SF-OD-5).
- The presenter's letter slide (`LetterSlide.tsx`): it keeps name first and **Hear it with a vowel** (open decision SF-OD-2). Only the lecture's copy of the four Check rounds changes (§3.7).
- The Hangul Check (WO-10) and its name and decoding sections.
- Every content fix of WO-12. (The ㅇ page's "아 · 오 · 우" button, WO-12 item 13, was out of scope here until 2026-11-26; it is now row SF-3, §12.) For WO-12: quest 1's ㄱ example word is 가 glossed "the sound ga" (`content/quests.ts:43`), so page 2 now gives 가 three times (autoplay, the line, the example), and "the sound ga" is not a meaning.
- A minimal-pair round of plain, aspirated and tense consonants (WO-16).
- Any new clip, any change to the clip pipeline, QS-3's timing or AU-10's conditions.
- Renaming the big button (SF-OD-1).

## 5. UI sketch

`design/wireframes/quest/discover.md`, section "[SF] Sound first (consonant card)"; its S1 notes and "Interaction points" are updated in this PR. Listen & Pick's heading slot is the one in `design/wireframes/minigame/listen-pick.md` (S4); only its words change on the four rounds of §3.7, so that wireframe is not redrawn. No visual mock: no new component, size, colour or token; the change is the order of two existing buttons and their labels.

## 6. Tests

TDD (CLAUDE.md §5): each test lands, failing first, in the SF-1 PR that makes it pass.

| File | Level | What it pins |
|---|---|---|
| `apps/mobile/src/logic/stage1/__tests__/discover-flow.test.ts` | unit | quest 1's own page 2 (`content/quests.ts:41-46`): `autoHearId(model, 1)` is `jamo:giyeok\|sound` and that action's text is 가. ㄱ: `hear.spec` = `{ text: '가', audioRef: 'audio/jamo/giyeok.mp3' }`, `spokenLine` = `{ ko: '가 = ㄱ + ㅏ', romanization: 'ga' }`, `spokenRomanization` = `ga`, `nameButton.action.spec` = `{ text: '기역', audioRef: 'audio/jamo/giyeok-name.mp3' }`, `nameButton.ko` = 기역, ids `jamo:giyeok\|sound` and `jamo:giyeok\|name`; ㄴ the same with 나 / 니은; ㅇ, a vowel and a final have no `nameButton` and keep today's `hear`; a tense consonant (ㄲ: 까 / 쌍기역); the say line of a failed main play is "Say it out loud: ga". **For every symbol page of every shipped quest and lesson** (the loop of `voice-surfaces.test.ts`'s `discoverSaid`): `autoHearId(model, p)` is the first item's `hear.id`, and when that item is a consonant other than ㅇ its spec text is `jamoVoice(j, 'sound').text` and its `audioRef` is not a `-name` clip. Every consonant on a shipped Discover page has its sound clip and, when it has a `nameButton`, its name clip in the clip map (`AUDIO_ASSETS` or the pack chunk's map) |
| `apps/mobile/src/screens/quest/__tests__/discover-auto-hear.test.tsx` | render | the autoplay follows `item.hear`: `spoken()` is `['아', '나']` where it was `['아', '니은']` (`:129`) and `['나']` where it was `['니은']` (`:264`); a page whose first item is ㄱ says 가 once by itself, and a tap on **Hear the name** during the 350 ms wait plays 기역 and drops the autoplay |
| `apps/mobile/src/screens/quest/__tests__/learner-audio.test.tsx` | render | the second button is named "Hear the name" (`:132`), its id is `\|name` (`:137`) and it says the name; Hear it says the sound |
| `apps/mobile/src/screens/quest/__tests__/discover-cant-hear.test.tsx` | render | the ids of `:101` (`\|vowel` → `\|name`); the link's Hear it plays the first card's sound |
| `apps/mobile/src/logic/__tests__/voice-surfaces.test.ts` | unit | **the one table change**: row "Discover, every page: Hear it" (`:202-207`) becomes type `sound` for every symbol; row "every consonant page: Hear it with a vowel" (`:208-213`) becomes "Hear the name", type `letter`, reading `nameButton`; the `lp:sym` row (`:167-177`) splits: rounds with `frame: 'startsWith'` are type `sound`, the rest stay `letter` |
| `apps/mobile/src/logic/__tests__/scope-builders.test.ts` | unit | `lp.symSound`: prompt 차 / `cha` / sound clip / gloss `the sound of the letter chieut`, `frame: 'startsWith'`, id `lp:sym:jamo:chieut`; throws without `optionIds`, for a vowel, ㅇ, a final, an option of the target's series (ㅈ for ㅊ) and an option that breaks rule 2. The loop over every scope's `lp:sym` round (`:113-130`, prompt = `jamoVoice(j, 'letter')`) splits by `frame`: `startsWith` rounds expect `jamoVoice(j, 'sound')` |
| `apps/mobile/src/logic/__tests__/voice-pools.test.ts` | unit | `sameSeries`: the five series both ways; vowels and finals are in none. The loop over every `lp:sym` round (`:253-268`, `letterTileAllowed`) splits by `frame`: `startsWith` rounds are checked with `soundTileAllowed` and no `sameSeries(target, option)` |
| `apps/mobile/src/content/__tests__/stage1-curriculum.test.ts` | unit | the F-QUEST-002 §3.6 table test (`:337-352`): ㅊ among {ㅊ ㄴ ㄱ ㄷ}, ㅋ among {ㅋ ㄴ ㅌ ㄷ}; the four rounds of §3.7 have `frame: 'startsWith'` and every other Stage 1 quest Check symbol round has none |
| `apps/mobile/src/logic/lecture/__tests__/deck-builder.test.ts`, the presenter `QuestionSlide` test | unit, render | a deck with quest 4 has a `listen` slide with `frame: 'startsWith'` for its Check's round 1, and the slide shows "Which letter starts this sound?"; other `listen` slides keep "Which one did you hear?" |
| `apps/mobile/src/screens/minigames/__tests__/` (the Listen & Pick render test) | render | a `frame: 'startsWith'` round shows "Which letter starts this sound?" as its heading and in the round's accessible label; other rounds keep "Listen, then pick" |
| `packages/content-schema/src/__tests__/` (minigame schema test) | unit | `frame` accepts `'startsWith'`, rejects any other value, is optional |
| `packages/i18n/src/__tests__/jamo-voice-messages.test.ts`, `length-budget.test.ts`, `review-ledger-current.test.ts` | unit | `hearName.cta` and `hearNameLabel` in en / es / ko, no Hangul in en or es; in every locale `hearNameLabel(x)` starts with `hearName.cta` and `hearItLabel(x)` with `hearIt.cta` (label in name); `hearName.cta` inside the button budget (`:275-277` list); the ledger is current |
| `apps/mobile/e2e/web/jamo-voice.spec.ts`, `jamo-voice-rig.ts` (`hearWithVowel` → `hearName`, `\|name`) | e2e (Playwright, web) | quest 1 Discover, page 2: by itself the page says 가; ㄴ Hear it = 나 with "나 = ㄴ + ㅏ" and "na" under it; Hear the name = 니은 with "니은 · nieun"; ㄱ = 가 / 기역. Quest 2 (`:102-123`): ㅁ Hear it = 마, Hear the name = 미음 |
| `apps/mobile/e2e/web/audio.spec.ts` | e2e | the pages' own sounds: `['아', '가']` where `:357` has `['아', '기역']`, `['카']` where `:549` has `['키읔']`; the comments at `:352-353` and `:543` |
| `apps/mobile/e2e/web/jamo-voice-audio.spec.ts` (fixture build) | e2e | inverted (`:150-168`): on ㄴ, Hear it plays the sound clip `jamo/nieun.mp3` and Hear the name plays `jamo/nieun-name.mp3` |

Coverage: `discover-flow.ts`, `scope-builders.ts` and `voice-pools.ts` are business logic (`apps/mobile/src/logic/`, 90 % target); `packages/content-schema` stays at 100 %.

## 7. Rollout

Next release, no flag: the change is an order and two labels on a teaching page, plus four Check rounds. No stored data changes: `quest.discover_completed` keeps its shape, and the Check keeps its round ids, so the memory store's `recognize` rung for these four letters (`logic/memory/resolve.ts:113`) holds answers to the name (before) and to the sound (after). Both show the learner recognises the letter by ear, so nothing is migrated. The es and ko values ship in the same PR (§3.6).

## 8. Dependencies

- Owner decision **OD-R2** (2026-11-22). AU-10 (#1035), QS-3 (#1038), JV-1 / JV-2 (`jamoVoice`), AC-7 (the 65 jamo clips), AU-8 (the Check holds its options' romanization), CH-1d / CH-1e / CH-1f (Can't hear it? on Discover and in Checks).
- Same files as WO-12 (`discover-flow.ts`, `DiscoverStep.tsx`: item 13; `minigame-config.ts`) and WO-14 (b) (README §6): merge one after the other; conflicts are mechanical.
- `packages/i18n/src/messages/en/learner.ts` and `a11y.ts`: nearly every UI work order (README §6).

## 9. Rows

| Row | Model | What | Files | Tests | Acceptance |
|---|---|---|---|---|---|
| **SF-0** | Opus 5.5 | this spec; `design/wireframes/quest/discover.md`; the "Amended" lines and `[SF]` notes in AUDIO-CLIPS, F-QUEST-002 (§3.2, §3.3, §3.6, §3.10) and AMENDMENTS-AUDIT-2026-11; the index line in `docs/specs/README.md` | docs only | — | multi-agent review done (§11); status `ready` |
| **SF-1** | Sonnet 5.5 | **built 2026-11-25 on `feat/discover-sound-first`** (two commits: Discover sound first with `nameButton`, `hearName.cta` / `hearNameLabel` en, es, ko and the ledger re-signed for `learner` and `a11y`; then `lp.symSound`, `sameSeries`, `frame: 'startsWith'`, the four Check rounds, the Listen & Pick heading, the lecture's copy and the four rounds' es / ko prompt gloss; the Korean button reads "글자 이름 들어 보기" after the review; the §3.8 device checks are open) `fix(mobile,i18n)`: Discover plays the sound first (§3.1-§3.6) and the quest Check's consonant round asks by sound (§3.7). Two commits, one per change, each with its tests | the files of "Scope" above | §6, all rows; `pnpm --filter @hangul-route/mobile test`, `pnpm --filter @hangul-route/i18n test`, `pnpm --filter @hangul-route/content-schema test`, `node scripts/check-i18n.mjs`, the `jamo-voice` e2e | a quest 1 learner hears 가 on page 2 before any tap and on Hear it; Hear the name says 기역; autoplay = `item.hear` is pinned; quest 4's round 1 says 차 under "Which letter starts this sound?"; es and ko reviewed, ledger re-signed; §3.8 handed to the owner |
| **SF-2** | Sonnet 5.5 | `docs(specs)`: close: this status → `shipped` after §3.8 (or "built, on-device checks open"), row PR numbers here and in the index line, the `[SF]` notes' "as built" details if SF-1 departed from §3; this spec's AUDIO-CLIPS line numbers refreshed (`:80`, `:509` on `8676b5de5` move with the notes this PR adds); a `[SF]` pointer in `AMENDMENTS-AUDIO-CANT-HEAR.md`'s CH-1d row (`:308`, "after Letter name") | this file, `docs/specs/README.md`, AUDIO-CLIPS §14 (one review-log line), CANT-HEAR | — | the docs say what main does |
| **SF-3a** | Opus 5.5 | `docs(specs)`: §12 (the ㅇ card's **Hear it with vowels**), SF-OD-6 to SF-OD-8, the [SF-3] section of `design/wireframes/quest/discover.md`, the pointer in `AMENDMENTS-STAGE1-CONTENT-FIXES.md` OD-CF5, §4 and §8, the index line | this file, the wireframe, CF, `docs/specs/README.md` | — | multi-agent review (§11, 2026-11-26: phonics and pedagogy; accessibility and design) done; open decisions approved by the owner 2026-11-26 |
| **SF-3b** | Opus 5.5 | **built 2026-11-26 on `feat/silent-ieung-button`** (`vowelsButton`, `HearAction.series`, `actionSpecs`, `playInOrder` and `SERIES_GAP_MS` in `discover-flow.ts`; the run counter in `DiscoverStep.tsx`; `hearVowels.cta` / `hearVowelsLabel` en, es "Escuchar con vocales", ko "모음과 함께 들어 보기", kept by both reviewers; ledger re-signed for `learner` and `a11y`; the §12.9 device checks are open) `feat(mobile,i18n)`: the button (§12.2-§12.7), stacked on SF-3a | `apps/mobile/src/logic/stage1/discover-flow.ts`, `apps/mobile/src/screens/quest/DiscoverStep.tsx`, `packages/i18n/src/messages/{en,es,ko}/learner.ts` and `a11y.ts` (two keys), `packages/i18n/src/messages/review-ledger.json`, the tests of §12.8 | §12.8; `TZ=UTC pnpm --filter @hangul-route/mobile test`, `pnpm --filter @hangul-route/i18n test`, `node scripts/check-i18n.mjs`, `pnpm generate --check`, `pnpm --filter @hangul-route/mobile audio:check`, lint, typecheck, `CI=1 pnpm --filter @hangul-route/mobile build:web` (start bundle against `PRECACHE_BUDGET.startBundleRaw`) | §12.9; es and ko drafted and reviewed in the PR (two reviewers), the ledger re-signed for `learner` and `a11y`; §12.9's device checks handed to the owner |

## 10. Open decisions (each adopted provisionally, as recommended)

- **SF-OD-1 — the labels.** (a) Keep **Hear it**; the second button is **Hear the name** (§3.6). (b) WO-13's sketch: **Hear the sound** / **Hear its name**, with the ten Stage 1 Hoya lines that say "Tap Hear it" rewritten (and their es / ko overlays), the Word Builder lines checked, and the ㅇ page given its own label. **Recommendation: (a)** (§3.6: every Hoya line stays true, quest 6's becomes true, no collision with WO-12). Adopted provisionally.
- **SF-OD-2 — the presenter's letter slide.** It still plays the name on its main speaker and the sound on **Hear it with a vowel** (`LetterSlide.tsx:113-117`). (a) Leave it (a grown-up leads the class and names the letter; OD-R2 named Discover only). (b) Align it with Discover in a later row of F-TCH-004. **Recommendation: (a) now**, revisit with the owner after SF-1 ships if teachers ask. Adopted provisionally.
- **SF-OD-3 — vowel rounds in the quest Check.** Quests 1-3 and 9 ask a vowel in round 1. (a) Leave them (their voice is already the sound; quest 1's options are its four new symbols, two of each kind, so a consonant sound round there would have two options). (b) Retarget them to a consonant. **Recommendation: (a)**. Adopted provisionally.
- **SF-OD-5 — Match Sound after a sound-first Discover** (§1.3). (a) Keep AU-OD-1 as OD-R2 decided: Match Sound says the name; every basic consonant's name starts with its own sound, and the name is on Discover's second button. (b) Make Stage 1 Match Sound a sound question (the "one table change" again, with JV-A3 rule 2 pools), so "Match the Sound" plays the sound Discover taught. **Recommendation: (a) for SF-1**, because OD-R2 kept AU-OD-1 explicitly; the owner should look at (b) together with WO-16, which reworks listening practice anyway. Adopted provisionally; flagged. **[MP] 2026-11-25:** looked at with WO-16 (`AMENDMENTS-MINIMAL-PAIRS.md` §3.11, MP-OD-5): (a) stays; quest 6's contrast step plays the sounds Discover taught, on approved clips.
- **SF-OD-4 — the series rule.** (a) Only the four Check rounds of §3.7 exclude the target's series. (b) Every sound question excludes it. **Recommendation: (a)**: practice rounds may include the contrast once WO-16 has clip-only minimal pairs; a Check should not. Adopted provisionally.

- **SF-OD-6 — the label of the ㅇ card's second button** (§12.4). (a) **Hear it with vowels**. (b) "Hear a, o, u": romanization inside a UI string, which then has to be kept in step with the content by hand in three locales, and it names the sounds without saying they are ㅇ with vowels. (c) Reuse `soundWith.cta` "Hear it with a vowel": no new string, but it is singular while three vowels play, and the presenter's letter slide uses it for a different thing. **Recommendation: (a)**: it follows the shipped "Hear it with a vowel" (the presenter's letter slide, `LetterSlide.tsx:117`), which also means "this letter on a vowel" (ㄴ → 나); here it is ㅇ on three vowels. **Owner decision 2026-11-26: approved as recommended.**
- **SF-OD-7 — which clips** (§12.2). (a) The three shipped vowel clips 아 / 오 / 우 (`audio/jamo/a.mp3`, `o.mp3`, `u.mp3`, pack `jamo-s1`, precached), played one after the other. (b) One new clip "아, 오, 우" through the F-AUDIO-004 pipeline (voice lock, TTS, QA, the owner's listen). **Recommendation: (a)**: they are the very clips the ㅏ, ㅗ and ㅜ cards play, so the learner hears that ㅇ adds nothing to them, which is the point; no new clip, no manifest or pack change, no owner listen, and it works offline. **Owner decision 2026-11-26: approved as recommended.**
- **SF-OD-8 — which syllables** (§12.2). (a) 아 · 오 · 우, as WO-12 item 13 asks. (b) Add 어 or 이. (c) Words (아이, 오이, 우유): ㅣ comes in quest 3 and ㅠ later, so they are not readable on quest 2's page. **Recommendation: (a)**: all three vowels are taught before the ㅇ card (ㅏ in quest 1, ㅗ and ㅜ on quest 2's page 1), they are the three mouth shapes most unlike each other, and three short sounds keep the button at about 3.5 s. **Owner decision 2026-11-26: approved as recommended.**

## 11. Review log

- 2026-11-25, SF-0: written on `8676b5de5`.
- 2026-11-25, multi-agent review (two independent reviewers: phonics and pedagogy with accessibility; engineering against the code and the clip maps). No blocker. Confirmed: sound first with the carrier line is sound teaching; ㅇ, vowels, finals and tense consonants are right; the four option sets pass `soundTileAllowed` and `explicitOptionIds` and are right by ear only for the answer; `jamoVoice(j, 'sound')` equals today's `loneLetterVoice` for ㅇ, vowels and finals (text, shown, romanization, clip); the autoplay needs no code change; every clip is in the generated maps; the es and ko plan is right for shipped locales. Applied:
  - the after-answer gloss "the sound of the letter <name>" instead of "the letter <name>" (차, 사, 파 are words; 차 is "tea" in the same quest), with its es and ko overlay entries (§3.7);
  - the Match Sound effect of keeping AU-OD-1 stated (§1.3, §4) and put to the owner as SF-OD-5;
  - label in name tested in every locale; the carrier line's accessible label "가, ga" (§3.1, §3.6, §3.8);
  - "Hear the name" instead of "Hear its name" (its / it's);
  - the `nameButton` guard checks the kind first; `lp.symSound` requires `optionIds`; "series partner" means the target's;
  - F-QUEST-002 §3.6 added to the amended sections; the tests that would fail listed in §6 (`stage1-curriculum.test.ts`, the `lp:sym` loops of `scope-builders.test.ts` and `voice-pools.test.ts`, `audio.spec.ts`, `jamo-voice-audio.spec.ts`, quest 2 in `jamo-voice.spec.ts`, `review-ledger-current.test.ts`) and a direct assertion on quest 1's page 2;
  - the lecture's copy of the four Check rounds gets the `startsWith` frame (§3.7), and its files join the scope;
  - quest 6's contrast left to WO-16 stated; quest 1's example 가 "the sound ga" passed to WO-12; the wireframe's large-text note; small slips (nine targets, the silent ㅇ in 기역, the memory rung in §7) and line numbers.
- 2026-11-26, SF-3a: §12 written on `fb4ff3b3c`; open decisions SF-OD-6 to SF-OD-8 approved by the owner as recommended.
- 2026-11-26, multi-agent review of SF-3a (two independent reviewers: phonics and pedagogy; accessibility and design, against the code). No blocker. Confirmed: initial ㅇ is silent, so 아 / 오 / 우 are right; ㅏ ㅗ ㅜ are taught before the ㅇ card; the three clips are shipped, precached and the vowel cards' own; the final ㅇ is rightly left out; the label fits the budget and puts the visible label first in the accessible name; no "Say it out loud" line is right; the replay from 아; autoplay unaffected; anti-shame holds; no mock is needed (the ㅇ card never has Hear the name, so the button fills that exact slot). Applied:
  - the line under the button is three carrier lines, 아 = ㅇ + ㅏ · a and its sisters, not "아 · 오 · 우": the same clips as the vowel cards alone would read as a replay; the composition beside "마 = ㅁ + ㅏ" on the ㅁ card is the lesson (§12.1, §12.4);
  - the gap is 150 ms, not 500 ms: each clip carries about 0.35 s of silence at each end (measured), so 500 ms gave about 1.2 s between 0.3 s syllables; timings corrected (§12.3, SF-OD-8);
  - how it stops is written down: `playPrompt` resolves a cut-off prompt as `played`, so `playInOrder` checks a run counter after every play and wait and a superseded run reports nothing; a page change and leaving stop it (§12.3), with render tests for Previous, Continue and leaving during a wait (§12.8);
  - all three clips are warmed, counted by the card slot and played (§12.6 item 4);
  - "no playing state" decided and explained, so the Read along Stop pattern is not copied (§12.3);
  - the silent-switch device check corrected (no panel: the switch cannot be detected), and Can't hear it? sits under the ㅁ card on quest 2 (§12.9); the iOS device-voice and VoiceOver notes added;
  - the card order: Say it out loud lines and the status panel come before the example (§12.5, wireframe); the heard pill drawn;
  - `touchTarget.min` (64) for an `md` button, here and in §3.1;
  - when `heard` counts the button; exact-name matching in tests; SF-OD-6 (b)'s reasoning; the CF row's line citation refreshed.

## 12. Row SF-3 — the ㅇ card's "아 · 오 · 우" button (added 2026-11-26)

Written on main `fb4ff3b3c`, after SF-1 (#1136). Source: WO-12 item 13 of `docs/roadmap/review-2026-11/phase-2-hangul.md` ("초성 ㅇ 을 '이응'으로만 들려줘 묵음을 귀로 확인할 수 없음 → Discover 의 ㅇ 페이지에 '아 · 오 · 우' 연속 재생 버튼"), moved to WO-13 by `AMENDMENTS-STAGE1-CONTENT-FIXES.md` OD-CF5 and assigned to this amendment by the owner on 2026-11-26.

### 12.1 Why

The ㅇ card says ㅇ by its name, 이응: initial ㅇ has no sound of its own (F-AUDIO-004 W5, W6; §3.1). Its hint says "silent at the start of a block" (`content/jamo.ts:34`), but nothing on the card lets the learner **hear** that silence. The example word 오 (`content/quests.ts:82`) helps once; one syllable does not show a rule. Three blocks that start with ㅇ and sound just like the vowel alone, played one after the other and written as ㅇ + vowel, do: ㅇ + ㅏ is 아, while the ㅁ card above it on the same page shows ㅁ + ㅏ is 마.

### 12.2 What the button plays

| | |
|---|---|
| Where | The **initial ㅇ** card (`jamo:ieung`, kind `consonant`) on any Discover page. Shipped today: quest 2, page 2, second item, after ㅁ (`content/quests.ts:82`). Not the final ㅇ card (`jamo:ieung-batchim`, "ng", `quests.ts:322`), not a vowel or another consonant |
| Plays | **아, 오, 우**, in that order: `jamoVoice(ㅏ, 'sound')`, `jamoVoice(ㅗ, 'sound')`, `jamoVoice(ㅜ, 'sound')` (SF-OD-8) |
| Clips | `audio/jamo/a.mp3`, `o.mp3`, `u.mp3` (`content/audio/tts-manifest.json:33, 37, 39`, sources `jamo:a#sound`, `jamo:o#sound`, `jamo:u#sound`, said "아." at rate 0.85; pack `jamo-s1`, precached; in `apps/mobile/src/content/__generated__/audio-assets.ts`). The same clips the ㅏ, ㅗ and ㅜ cards' **Hear it** play. **No new clip**, no manifest, pack or lock change, no owner listen (SF-OD-7) |
| Taught before | ㅏ in quest 1 (`quests.ts:37`); ㅗ and ㅜ on quest 2's page 1 (`:76-77`). A content test keeps it so (§12.8) |
| Speech rate | `sound`, as every Discover letter button |

### 12.3 Order, gaps and stopping

- One tap plays the three sounds one after the other. Each starts when the one before has **finished**, after a **150 ms** wait (`SERIES_GAP_MS` in `discover-flow.ts`). Each clip is about 1.05 s and already holds about 0.35 s of silence before and after its 0.3 s of voice (measured in the SF-3a review), so the voices are about 0.85 s apart: three separate syllables, not one long vowel. The whole is about 3.5 s. The wait is not Read along's `motion.duration.slow` (320 ms): that pause follows a sentence with no silence of its own; this one follows a clip that has it, and the 150 ms keeps the device voice (no built-in silence) from running the three together.
- **What stops it.** Another sound on the page (Hear it, Hear the name, an example word, a line, Read along), **Continue**, **Previous** or leaving the step: the sound that is playing stops and nothing of the rest is played (no 오 over 이응, no 우 on the next page). Show how to say it, Can't hear it? and the help sheet play nothing and do not stop it. A second tap on the button itself starts it again from 아.
- **How (the rule the build follows).** `playPrompt` resolves a prompt that a newer one cut off as `played` (F-AUDIO-004; the same reason `logic/story/audio-runner.ts` keeps a generation counter), so a plain loop would go on. The run is `playInOrder(steps, { play, wait, live })` in `discover-flow.ts`: it waits after each play and before each next one, and checks `live()` after every play and every wait; a run that is no longer live returns `superseded` and the screen sends **no** `audio` event for it. The screen keeps one run counter: every `play` effect and every `stopAudio` effect ends the run in progress, and so do a page change and leaving the step, which also stop the voice when a run is playing (today `next` does not stop a single clip; a 3.5 s run must not outlive its page). The wait's timer is cleared with the run.
- **No playing state.** Unlike Read along (whose button becomes **Stop**, `DiscoverStep.tsx:735`), the button keeps its label while it plays and there is no live announcement or per-syllable highlight. Reason: it is short (about 3.5 s), it starts only on the learner's tap, any other sound or Continue stops it (so WCAG 1.4.2 does not apply), and the three syllables are printed under it. Do not copy the Read along pattern here.
- It never plays by itself: AU-10's autoplay plays the page's first item's `hear` (§3.3), and on the ㅇ card that is still 이응. On quest 2's page 2 the first item is ㅁ anyway.
- **Heard.** The button is one button: it enters `tapped` on the tap, so `quest.discover_completed.heard` counts it once, as every button (a tap counts whatever played, §3.1). The card's heard mark appears only when all three played (the run reports `played`).

### 12.4 Label, accessible name and the lines under it

| Key | English (Pre-A1) | Where |
|---|---|---|
| new `learner.quest.discover.hearVowels.cta` | **"Hear it with vowels"** (SF-OD-6) | the button on the ㅇ card; 19 characters, inside the `cta` budget (28) |
| new `a11y.hearVowelsLabel(letter: string)` | **"Hear it with vowels. {letter}"**, `letter` = `a11y.discoverLetter(romanization)` without the hint ("Korean letter silent/ng") | the button's accessible name; it starts with the visible label in every locale (WCAG 2.5.3), as `hearNameLabel` does |

- Under the button, three **carrier lines**, content (`KoreanText`, `size="sm"`), stacked: **아 = ㅇ + ㅏ** · a, **오 = ㅇ + ㅗ** · o, **우 = ㅇ + ㅜ** · u. They are the consonant card's carrier line ("마 = ㅁ + ㅏ · ma" on the ㅁ card above) for ㅇ, so the page shows the contrast: ㅁ + ㅏ says ma, ㅇ + ㅏ says only a. No gloss, as the carrier and name lines (they are sounds here). Each line's accessible label is its syllable and romanization only ("아, a"), as the carrier line's (§3.1), so a Korean screen-reader voice does not read the lone ㅇ as 이응 three times.
- **es and ko** are shipped locales: SF-3b drafts the two keys' es and ko values, has them reviewed under F-I18N-001 §3.10 by two reviewers in the PR and re-signs the ledger for `learner` and `a11y`, as SF-1 did (§3.6). This section writes English only. No string holds Hangul or an age word.
- Discover tests match button names exactly, not by prefix: "Hear it" is the start of "Hear it with vowels" (Voice Control users say "Show numbers" to pick one; nothing else is needed).

### 12.5 Where it sits

The ㅇ card never has **Hear the name** (its name is what Hear it says, §3.1), so the new button takes that button's place and pattern exactly. The card, top to bottom (`DiscoverStep.tsx:502-648`): heard pill (once heard), glyph and romanization, sound hint, **Hear it** (이응; big; it pulses only when it is the page's first card), its line "이응 · ieung", **Hear it with vowels** (`size="md"`, `tone="ghost"`: `touchTarget.min`, 64), its three carrier lines, the **Can't hear it?** link (only on the page's first card; on quest 2 it sits under the ㅁ card), the "Say it out loud" lines, the status panel, then the divider and the example word. Screen-reader order is the same. No card has three letter buttons. Largest text and 320 wide: as the consonant card (the two buttons stack, each centred at its own width, its lines under it); the card scrolls and Continue stays reachable.

No visual mock: the button is the existing second-button pattern (Hear the name, §3.1: `HearButton` md ghost and `KoreanText` sm lines in a centred column), with a new label and three lines in place of one; no new component, size, colour, token or arrangement. The one thing the pattern does not show, a button that plays for a few seconds, is settled in words (§12.3, "No playing state"). The wireframe gets the ㅇ card (`design/wireframes/quest/discover.md`, "[SF-3] The ㅇ card").

### 12.6 When a sound does not play (`AMENDMENTS-AUDIO-CANT-HEAR.md` §3.1: Discover is guidance only, its Korean is printed)

1. Each of the three plays by the usual order: the clip, else the ranked Korean device voice (AC-B7, AC-B12), as every Discover button (§3.5).
2. If one of them does not play (sound off, no clip and no Korean voice, a blocked or failed play), the run **stops there**: nothing after it is tried. The card's status panel says why with its one action (Turn sound on, Tap to hear, Try again), and that action plays the whole button again from 아 (the panel replays the button played last, `DiscoverStep.tsx:288-290`).
3. The three carrier lines are already printed and are the button's text fallback, as the name line is for Hear the name (§3.5 item 4; `sayLines` covers only `hear` and the example, `discover-flow.ts:620-624`). No "Say it out loud" line is added; nothing else changes; Continue is never held.
4. The build reads **all three** clips wherever it reads a button's clip: the warm-up (`warmClips`, `DiscoverStep.tsx:142`), the card slot's "has a clip" (`useCardSlot`, `:408-418`: true only when every button's every clip is there) and the play effect (`:195`). The page's **Can't hear it?** link is unchanged: its **Hear it** plays the first card's main Hear it.

### 12.7 Anti-shame

Optional and unscored: nothing is asked, nothing can be missed, no timer, no mark but the heard pill (which only fills). Continue is enabled at once and never waits for it.

### 12.8 Tests (SF-3b; each failing first)

| File | Level | What it pins |
|---|---|---|
| `apps/mobile/src/logic/stage1/__tests__/discover-flow.test.ts` | unit | the ㅇ card has `vowelsButton`: id `jamo:ieung\|vowels`, its action's `series` = `[{ 아, audio/jamo/a.mp3 }, { 오, audio/jamo/o.mp3 }, { 우, audio/jamo/u.mp3 }]`, `spec` = the first, kind `sound`; its `lines` = 아 = ㅇ + ㅏ / a, 오 = ㅇ + ㅗ / o, 우 = ㅇ + ㅜ / u, each labelled "아, a" and so on; no `nameButton`; ㄱ, a vowel, the final ㅇ and a tense consonant have no `vowelsButton`; `pageRender`'s heard mark counts it; `actionSpecs` gives all three. `playInOrder`: plays in order with a `SERIES_GAP_MS` wait between (none before the first, none after the last), returns `played` when all played, stops at and returns the first other result, returns `superseded` (and plays nothing more) when no longer live after a play or after a wait. Quest 2's own page 2 has the button, and ㅏ ㅗ ㅜ are taught on an earlier page; each of the three clips is in `AUDIO_ASSETS` |
| `apps/mobile/src/screens/quest/__tests__/discover-vowels.test.tsx` (new) | render | the ㅇ card shows **Hear it with vowels** with the three lines under it and the accessible name "Hear it with vowels. Korean letter silent/ng" (exact match); a tap plays 아, 오, 우 in order and the heard mark shows; a tap on Hear it, Continue, or Previous during a wait stops it and nothing more of it plays; leaving the step during a wait plays nothing more; a muted first play stops it at 아 and the card's status panel shows; all three clips are warmed |
| `apps/mobile/src/logic/__tests__/voice-surfaces.test.ts` | unit | a new row "Discover, the initial ㅇ card: Hear it with vowels", type `sound`, targets ㅏ ㅗ ㅜ |
| `packages/i18n/src/__tests__/jamo-voice-messages.test.ts`, `length-budget.test.ts`, `review-ledger-current.test.ts` | unit | `hearVowels.cta` and `hearVowelsLabel` in en / es / ko, no Hangul in en or es; `hearVowelsLabel(x)` starts with `hearVowels.cta` in every locale; the key is in the button budget list; the ledger is current |
| `apps/mobile/e2e/web/jamo-voice.spec.ts` (quest 2, `:102-123`) | e2e (Playwright, web) | on the ㅇ card, **Hear it with vowels** says 아, 오, 우 in that order |

Coverage: `discover-flow.ts` is business logic (90 % target).

### 12.9 Acceptance

- A quest 2 learner on page 2 taps **Hear it with vowels** on the ㅇ card and hears 아, 오, 우, each a separate syllable, from the shipped vowel clips, with "아 = ㅇ + ㅏ · a" and its two sister lines under the button; Hear it still says 이응.
- No other card has the button; nothing plays by itself; Continue is never held; another sound, Continue or Previous stops it.
- es and ko reviewed in the PR, ledger re-signed; every check of row SF-3b green; the start bundle is reported against `PRECACHE_BUDGET.startBundleRaw` (Discover is in the start bundle).
- **[On device, owner]** iPhone (PWA) and an Android phone, quest 2 page 2: the three sounds play with clear gaps, 오 and 우 too (they start from a timer after the tap; the clips go through the already unlocked Web Audio, but the iOS device-voice fallback could be refused there, which would put the status panel up mid-run). With the silent switch on, nothing is heard and no panel shows (the switch cannot be detected, CANT-HEAR §1); the lines are printed; Can't hear it? sits under the ㅁ card. VoiceOver / TalkBack read "Hear it with vowels. Korean letter silent/ng" and then "아, a", "오, o", "우, u" (VoiceOver may speak over 아, as over every Hear it). At Largest text the two buttons and the lines fit and Continue stays reachable.

### 12.10 Out of scope

The presenter's letter slide (SF-OD-2's reasoning: a grown-up leads it), the final ㅇ card, the lecture's letter slide, the Hangul Check (WO-10) and any new clip.
