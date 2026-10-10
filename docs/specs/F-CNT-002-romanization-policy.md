Status: ready

# F-CNT-002 — Romanization policy and validator: Revised Romanization, unhyphenated, checked against the shipped content

**Scope**: `packages/content-schema` (RR converter, rules, schema fields) · `apps/mobile` (content modules, `minigame-config`, tests) · `apps/web` (landing data, preview pages, tests) · `packages/backend` (seed) · `content/**` · `.github/workflows/content-validation.yml` · `.claude/skills/content-skill/SKILL.md` (§3.3 wording only)
**Owner**: solo dev
**Rollout**: audit `audio-pass-2` findings F03, F04, F05, F07, F10, F11, F12, F14 (and F08, F15 for the jamo table). PR order in §7.

Parent / siblings: F-CNT-001 (language policy validator; its §4 lists "romanization spelling accuracy" as this spec) · F-I18N-001 (locale overlays: romanization stays one RR string for every UI locale) · F-AUDIO-004 (what the voice says must match what the screen shows) · F-STORY-003 (adds `storySteps[].romanization`; this spec supplies the values and the rule) · F-LEARN-001 §3.6/L12 (avatar name `례이`) · D4 (JSON-first content, validator scans what ships) · D13 (this policy)

---

## 1. Context

CLAUDE.md §1 requires every taught Korean string to show a romanization. F-CNT-001 enforces that the key *exists*, in JSON only. Nothing checks that the romanization is *right*, and the validator never sees the TypeScript content the apps ship.

What exists today (verified in the working tree on 2026-10-10; the audit's rule-based converter was re-run and reproduces its 12 mismatches):

- `scripts/validate-content.mjs:20-23,65-72` walks `content/**/*.json` only. Its output is "2 file(s) scanned" (`content/episodes/stage-1/cards.json`, `jamo.json`). All learner content lives elsewhere: `apps/mobile/src/content/{heritage-cards,jamo,quests,episodes}.ts`, `apps/mobile/src/logic/minigame-config.ts`, `apps/mobile/src/logic/profiles/avatar-catalog.ts`, `apps/web/src/data/stage1-cards.ts`, inline strings in web pages. The CI job runs only on `content/**` and `packages/content-schema/**` (`.github/workflows/content-validation.yml:3-8`).
- Four wrong strings reach learners (the audio the TTS speaks is in brackets, measured by the audit with `say -v Yuna`): `윷놀이` shown `yutnori`/`yut-no-ri`, said [윤노리]; `한글날` shown `hangeul-nal`, said [한글랄]; `케이팝` shown `K-pop`, hides the ㅋ sound it teaches; `례이` shown `Yeri`, RR is `ryei`, said [레이]. One landing string is wrong with no romanization field: `거의! · geo-eui · almost!`.
- 27 romanizations are syllable-hyphenated (`gang-a-ji`, `bo-reum-dal`, …) and seven words are spelled two ways across files (`호랑이` `ho-rang-i`/`horangi`, `무궁화`, `윷놀이`, `팽이`, `사과`, `우유`, `아빠`).
- Korean strings that ship with **no** romanization: the three story-sequence scopes (`apps/mobile/src/logic/minigame-config.ts:122-125,147-150,188-191`; the type has `labelKo?` only, `:13`, and `StorySequenceGame.tsx:140` renders `labelKo` alone), the 24 jamo example words (`apps/mobile/src/content/jamo.ts:64-90`; `JamoSchema` has `exampleWordKo` but no romanization, `packages/content-schema/src/schemas/jamo.ts:17`), and the Seollal greeting `새해 복 많이 받으세요.` placed in an English field (`apps/mobile/src/content/quests.ts:92`, field `hoyaLineEn`, rendered by `QuestPlayerScreen.tsx:147-151`, `NarrativeStepBody` at `:157`).

## 2. Decisions

Binding: **D13** (Revised Romanization of the National Institute of Korean Language, unhyphenated, pronunciation-based; hyphens only to show syllable splits in teaching UI), **D4** (the validator scans what ships), **D2** (romanization is visible by default; the "hide until tap" setting is F-I18N-001's).

Made in this spec:

| # | Decision | Why |
|---|---|---|
| C1 | One TypeScript implementation of the converter and checker in `packages/content-schema/src/romanization/` (zero imports, pure). No second copy in `.mjs`, no new dependency (no `tsx`). | The package already holds the schemas every app imports, and its target is 100 % coverage (CLAUDE.md §6). |
| C2 | Enforcement runs as **vitest suites**, not a standalone CLI. `pnpm run test` (CI job `ci.yml`) and `content-validation.yml` already run them. `scripts/validate-content.mjs` keeps its F-CNT-001 structural rules unchanged. | `engines` is `node >=20` (`package.json`) and the package's `exports` point at `.ts` with extension-less imports, so a plain Node script cannot import it without a loader. vitest imports the real TS arrays, so there is no fragile regex over source. |
| C3 | The stored `romanization` is always the unhyphenated RR string. A hyphenated form exists only as a **computed** display helper, `syllableSplit('한글날') === 'han-geul-lal'`; it is never stored and never compared. | One value to validate; hyphens vary by author, not by language (27 hand-hyphenated entries today). |
| C4 | A romanization has the same number of space-separated words as the Korean (`손 씻기` → `son ssitgi`). Compound spacing follows standard Korean spacing: `가족 식탁` (two words), not `가족식탁`. | Lets the checker compare word by word; matches the dictionary (audit F13). |
| C5 | Titles and English glosses keep the established English name (`Yut Game`, `K-pop`, `Hangul Day`). Only the `romanization` field, and bare romanized Korean words inside English prose, follow RR. A card may say once, in prose, "also written yutnori". | `K-pop` is an English word; the card exists to show how the Korean is *said* (`keipap`). |
| C6 | Isolated jamo are not romanized as words. Their `romanization` is a **sound value** from a fixed table (§3.5), checked by lookup, not by the converter. | `g/k`, `d/t` are teaching notation, not RR words. |
| C7 | Words the rule-based converter cannot know (see §3.2 "Known limits") go in an explicit **exceptions** list where every entry carries a reason; an exception with no reason or no matching occurrence fails the build. | Keeps the list short, reviewed and self-cleaning. |
| C8 | Capitalisation is free (`Seoul`, `seoul`); apostrophes are not used. Comparison ignores case. | RR does not mandate case; proper-noun capitals are a style choice. |
| C9 | The avatar name `례이` is respelled `예리` in the catalogue and romanized `Yeri` (**owner confirmed 2026-10-10**). Fallback: keep `례이` and romanize `Ryei`. | The owner's own romanization was `Yeri`; no Hangul spelling of `례이` reads `Yeri` (audit F11). The name is not shown in the UI today (`avatar-catalog.ts:7-8`). |

## 3. Acceptance criteria

### 3.1 The policy (what authors follow)

1. **Standard**: Revised Romanization of Korean (국립국어원, 2000). `ㅓ eo`, `ㅡ eu`, `ㅢ ui`, `ㅅ s`, `ㅈ j`, `ㅊ ch`, double letters `kk tt pp ss jj`, `ㄹ r` between vowels and `l` at the end of a syllable or before another `ㄹ`.
2. **Pronunciation, not spelling**: transcribe what is said, applying the sound changes RR transcribes: liaison (`할아버지` `harabeoji`), nasalisation (`윷놀이` `yunnori`, `국립` `gungnip`, `승리` `seungni`), liquid assimilation (`한글날` `hangeullal`, `신라` `silla`), palatalisation (`같이` `gachi`), `ㅎ` aspiration/dropping (`좋아요` `joayo`, `놓고` `noko`), coda neutralisation (`젓가락` `jeotgarak`, `꽃` `kkot`). Tensification that RR does not mark is not marked (`학교` `hakgyo`).
3. **No hyphens, no apostrophes, no diacritics.** Lower case by default; capital letters only for names.
4. **Word spacing** follows Korean standard spacing; one romanized word per Korean word (C4).
5. **Teaching UI** may display syllable splits, computed by `syllableSplit()` from the Korean (C3). The split follows pronunciation: `음악` is `eu-mak`, `윷놀이` is `yun-no-ri`.
6. **Names and loanwords**: RR of the Hangul as written (`케이팝` `keipap`, `서울` `seoul`, `세종` `sejong`). A conventional English spelling that differs from RR goes in `titleEn`/`en`, not in `romanization`.
7. **Jamo letter names** use the standard RR names: 기역 `giyeok`, 니은 `nieun`, 디귿 `digeut`, 리을 `rieul`, 미음 `mieum`, 비읍 `bieup`, 시옷 `siot`, 이응 `ieung`, 지읒 `jieut`, 치읓 `chieut`, 키읔 `kieuk`, 티읕 `tieut`, 피읖 `pieup`, 히읗 `hieut` (the audit's converter reproduces all fourteen).
8. **Prose**: a romanized Korean word written inside English copy follows the same rules (`sebaetdon`, `jongihak`, `gangaji`), no hyphens.

Update `.claude/skills/content-skill/SKILL.md` §3.3 (it says "Revised Romanization", `:86`) with items 2 to 4 and 8, and `content/episodes/stage-1/README.md` (it describes only "romanization (Revised Romanization)").

### 3.2 The converter — TypeScript port of the audit's `rr.py`

Files, all new, exported from `packages/content-schema/src/index.ts`:

```
packages/content-schema/src/romanization/
  hangul.ts      // constants + decompose/compose helpers (no logic about sound change)
  rr.ts          // romanizeSyllables / romanizeWord / romanize / syllableSplit
  compare.ts     // normalizeRomanization, checkRomanization, RomanizationIssue
  extract.ts     // extractKoreanPairs(source, file): inline-literal scanner (§3.4 source class C)
  exceptions.ts  // ROMANIZATION_EXCEPTIONS, JAMO_SOUND_VALUES, JAMO_NAME_VALUES
  a11y.ts        // a11yRomanization('silent/ng') -> 'silent or ng' for screen-reader labels
```

Public API:

```ts
/** One romanized piece per syllable block, pronunciation-based. null if the word has any non-syllable character. */
export function romanizeSyllables(word: string): string[] | null;
/** romanizeSyllables(word)?.join(''), or null. */
export function romanizeWord(word: string): string | null;
/** Words split on whitespace; ASCII hyphens, . , ! ? ~ · … " ' stripped; unknown tokens returned as-is in `unknown`. */
export function romanize(text: string): { text: string; unknown: string[] };
/** 'han-geul-lal' for teaching UI; null when not all syllable blocks. */
export function syllableSplit(word: string): string | null;
```

Algorithm (a faithful port of `scratchpad/rr/rr.py`, reviewed rule by rule):

1. **Decompose** each Hangul syllable block `U+AC00..U+D7A3` into (initial, medial, final) by `index = code - 0xAC00`, `initial = index / 588`, `medial = index % 588 / 28`, `final = index % 28`. Tables: initials `g kk n d tt r m b pp s ss '' j jj ch k t p h`; medials `a ae ya yae eo e yeo ye o wa wae oe yo u wo we wi yu eu ui i`; finals as the 27 jamo, with compound finals split into (kept, moved) pairs (ㄳ ㄱ+ㅅ, ㄵ ㄴ+ㅈ, ㄶ ㄴ+ㅎ, ㄺ ㄹ+ㄱ, ㄻ ㄹ+ㅁ, ㄼ ㄹ+ㅂ, ㄽ ㄹ+ㅅ, ㄾ ㄹ+ㅌ, ㄿ ㄹ+ㅍ, ㅀ ㄹ+ㅎ, ㅄ ㅂ+ㅅ; ㄲ and ㅆ move whole).
2. **Between neighbouring syllables, left to right**:
   a. `ㅎ` finals (ㅎ, ㄶ, ㅀ): before ㄱ ㄷ ㅈ ㅂ the next initial is aspirated (ㅋ ㅌ ㅊ ㅍ) and the ㅎ drops; before ㅇ the ㅎ drops and liaison of any remaining final applies; before ㄴ a bare ㅎ final is pronounced ㄴ (`넣는` `neonneun`).
   b. A final followed by initial ㅎ aspirates (ㄱ→ㅋ, ㄷ/ㅅ/ㅆ/ㅈ/ㅊ/ㅌ→ㅌ, ㅂ→ㅍ; ㅈ+ㅎ→ㅊ).
   c. **Liaison**: a final before initial ㅇ moves onto the next syllable (compound finals move only their second part); ㄷ/ㅌ + `이` palatalise to ㅈ/ㅊ.
3. **Neutralise** remaining finals to `k t p l m n ng`.
4. **Assimilate** across the boundary: ㄹ after ㅁ/ㅇ/ㄱ/ㅂ/ㄷ-group becomes ㄴ; ㄱ/ㄷ/ㅂ-group before ㄴ/ㅁ become `ng`/`n`/`m`; ㄴ before ㄹ and ㄹ before ㄴ both become `ll`.
5. **Emit** `initial + medial + final` per block; an initial ㄹ is `l` when the previous final is `l`, else `r`; an initial ㅇ is empty.

The port must **not** add tensification, ㄴ-insertion or any dictionary logic.

**Known limits** (documented, and covered by exception entries when content hits them): ㄴ-insertion in compounds (`꽃잎` RR `kkonnip`, converter `kkochip`; `한여름` RR `hannyeoreum`, converter `hanyeoreum`; `색연필`, `담요`), the special final of `밟-` (`밟다` [밥따] `bapda`, converter `balda`), word-internal compound boundaries, Sino-Korean exceptions, `의` as a particle (RR still writes `ui`; fine). Cross-word sandhi is deliberately not applied (RR does not mark it). The converter is a **review aid with an escape hatch**, not an oracle.

**Golden vectors** (converter output from the audit's `rr.py`, re-run on 2026-10-10; every one is also correct RR by hand except the two marked *limit*). The TS port must reproduce each exactly:

| Korean | RR | Korean | RR |
|---|---|---|---|
| 윷놀이 | yunnori | 한글날 | hangeullal |
| 케이팝 | keipap | 거의 | geoui |
| 설날 | seollal | 젓가락 | jeotgarak |
| 세뱃돈 | sebaetdon | 벚꽃 | beotkkot |
| 감사합니다 | gamsahamnida | 좋아요 | joayo |
| 이름이 뭐예요 | ireumi mwoyeyo | 무궁화 | mugunghwa |
| 할아버지 | harabeoji | 같이 먹기 | gachi meokgi |
| 손 씻기 | son ssitgi | 상 차리기 | sang charigi |
| 잘 먹었습니다 | jal meogeotseumnida | 한복 입기 | hanbok ipgi |
| 세배 드리기 | sebae deurigi | 떡국 먹기 | tteokguk meokgi |
| 세뱃돈 받기 | sebaetdon batgi | 편 가르기 | pyeon gareugi |
| 윷 던지기 | yut deonjigi | 말 옮기기 | mal omgigi |
| 승리 | seungni | 새해 복 많이 받으세요 | saehae bok mani badeuseyo |
| 종이접기 | jongijeopgi | 국립 | gungnip |
| 신라 | silla | 학교 | hakgyo |
| 해돋이 | haedoji | 좋다 | jota |
| 놓고 | noko | 넣는 | neonneun |
| 닭고기 | dakgogi | 읽어요 | ilgeoyo |
| 맛있어요 | masisseoyo | 부엌에 | bueoke |
| 음악 | eumak | 여덟 | yeodeol |
| 강아지 | gangaji | 호랑이 | horangi |
| 거의 다 했어 | geoui da haesseo | 아깝다 | akkapda |
| 례이 | ryei | 예리 | yeri |
| 기역 … 히읗 | giyeok … hieut (all 14, §3.1 item 7) | 꽃잎 | kkochip (*limit*; RR `kkonnip`) |
| 밟다 | balda (*limit*; RR `bapda`) | | |

`romanizeSyllables('윷놀이')` is `['yun','no','ri']`, `syllableSplit('한글날')` is `'han-geul-lal'`, `syllableSplit('음악')` is `'eu-mak'`.

### 3.3 The checker and its rules

`checkRomanization(ko: string, given: string, ctx?: { exceptions?: readonly RomanizationException[] }): RomanizationIssue[]`. Normalisation `normalizeRomanization(s)`: NFC, lower case, remove `'` and `’`, strip `. , ! ? ~ · …` and quotes, collapse whitespace, trim. Hyphens are kept until R2 has looked at them, then removed for the comparison, so `gang-a-ji` gives exactly one finding (R2), not two.

| Rule id | Severity | Fires when | Example message |
|---|---|---|---|
| `romanization-mismatch` (R1) | error | the hyphen-less normalised `given` differs from `romanize(ko).text` and no exception allows it | `윷놀이: given "yutnori", Revised Romanization is "yunnori"` |
| `romanization-hyphen` (R2) | error | `given` contains `-` (not allowed in stored romanization, C3) | `gang-a-ji: remove hyphens → "gangaji"` |
| `romanization-spacing` (R3) | error | the number of space-separated words differs from the Korean | `가족식탁 / gajok siktak: 1 Korean word, 2 romanized` |
| `romanization-missing` (R4) | error | a registered Korean field has no sibling romanization (§3.4 table) or it is empty | `labelKo "손 씻기" has no romanization` |
| `romanization-inconsistent` (R5) | error | the same Korean string appears in two sources with different normalised romanizations | `호랑이: "horangi" (heritage-cards.ts:94) vs "ho-rang-i" (cards.json:175)` |
| `romanization-prose` (R6) | error | an English prose field contains the syllable-hyphenated form of a registered word, or `romanized (한글)` / `한글 (romanized)` where the pair fails R1/R2 | `"gang-a-ji" in cards.json:9 (use "gangaji")` |
| `jamo-value-unknown` (R7) | error | a jamo `romanization` is not in `JAMO_SOUND_VALUES` for its character, or a jamo name suffix is not in `JAMO_NAME_VALUES` | `ㅇ: "∅/ng" is not a listed value` |
| `romanization-exception-stale` (R8) | error | an exception has no `reason`, or matches nothing in any scanned source | `exception 꽃잎 matched no source` |

R6 has a bounded purpose: it catches the prose spellings of words that are in the registry. It does not guess at arbitrary hyphenated English (`left-to-right`, `half-moon` are fine). Words not in the registry (`jong-i-hak` at `heritage-cards.ts:34`) are fixed in review and by the content list in §3.7.

`ROMANIZATION_EXCEPTIONS: readonly { ko: string; allowed: readonly string[]; reason: string }[]` ships **empty**: today's 12 mismatches are real errors, and no current entry hits a known limit. Each entry added later needs a reason that names the limit (ㄴ-insertion, `밟-`, a proper-noun convention).

`JAMO_SOUND_VALUES` (what `JamoSchema.romanization` may hold; C6): ㄱ `g/k`, ㄴ `n`, ㄷ `d/t`, ㄹ `r/l`, ㅁ `m`, ㅂ `b/p`, ㅅ `s`, ㅇ `silent/ng`, ㅈ `j`, ㅊ `ch`, ㅋ `k`, ㅌ `t`, ㅍ `p`, ㅎ `h`, ㅏ `a`, ㅑ `ya`, ㅓ `eo`, ㅕ `yeo`, ㅗ `o`, ㅛ `yo`, ㅜ `u`, ㅠ `yu`, ㅡ `eu`, ㅣ `i`, and the six batchim `k n l m p ng`. (`∅/ng` at `apps/mobile/src/content/jamo.ts:71` is replaced by `silent/ng`; `JamoSchema.romanization` is `.max(8)` at `schemas/jamo.ts:13`, so it is raised to `.max(12)`; screen-reader labels turn `/` into "or" through `a11yRomanization()` (`romanization/a11y.ts`, unit-tested in `romanization-compare.test.ts`; callers pass its result as the `accessibilityLabel` of `KoreanText`, F-I18N-001 §3.5) so VoiceOver does not say "empty set slash n g".) The dual values `g/k` stay as taught; showing or dropping final values for ㅅ ㅈ ㅊ ㅌ ㅎ is a pedagogy decision for F-AUDIO-004/F-QUEST-002, not this spec (audit F15).

### 3.4 What the validator scans (sources and mechanism)

Every source that puts Korean in front of a learner is listed here; the suites fail if a listed file disappears (so the list cannot rot) and a new Hangul-bearing file outside the list fails the **coverage check** below.

| Class | Source | Korean → romanization pairing | Enforced by |
|---|---|---|---|
| A. JSON | `content/**/*.json` (today `episodes/stage-1/{jamo,cards}.json`; later `content/stories/*.json`, `content/vocab/*.json`, D4) | any object with `ko` and `romanization`; `exampleWord.{ko,romanization}`; jamo-name suffix `"g (giyeok)"`; `rr` accepted as an alias of `romanization` in story/vocab JSON (the research drafts use `rr`, `F-STORY-003:123`) | `packages/content-schema/src/__tests__/romanization-content.test.ts` (reads the repo `content/` tree with `node:fs`; it is data, not a code import) |
| B1. TS data, mobile | `apps/mobile/src/content/heritage-cards.ts` (`stage1Cards`, `stage2Cards`, `stage4Cards`): `subtitleKo` → `romanization` | | `apps/mobile/src/content/__tests__/romanization.test.ts` (alongside `content-integrity.test.ts`; vitest `include` has `src/content/**`, `apps/mobile/vitest.config.ts:20-27`) |
| | `apps/mobile/src/content/jamo.ts` (`jamoAll`): `exampleWordKo` → `exampleWordRomanization` (new); `char`/`romanization` → R7 | | same |
| | `apps/mobile/src/logic/minigame-config.ts` (`minigameScopes`): `cardPairs[].ko`, `syllables[].ko`, `dialogue[].npcKo` → `npcRomanization`, `dialogue[].options[].ko`, `storySteps[].labelKo` → `romanization` (new). `romanization?` is optional at `:12,:18`: the checker treats absence as R4 | | same |
| | `apps/mobile/src/content/quests.ts`: `steps[].hoyaLineKo.{ko,romanization,en}` (new, §3.5) and any Hangul inside `hoyaLineEn`/`bodyEn`/`titleEn` is a `korean-in-ui-field`-style finding (`quests.ts:49` `Build "가"` is allowed: an isolated syllable in a title, listed in the ignore table) | | same |
| | `apps/mobile/src/logic/profiles/avatar-catalog.ts` (`AVATAR_PRESETS`): `pillarName` → `romanization` | | same |
| | `apps/mobile/src/content/episodes.ts` / `heritage-cards.ts` English prose (`blurbEn`, `factEn`, `hoyaIntroEn`) | R6 prose scan | same |
| B2. TS data, web | `apps/web/src/data/stage1-cards.ts` (`stage1Cards`): `ko` → `romanization`; `blurb`/`en` prose | | `apps/web/src/data/__tests__/romanization.test.ts` (next to `stage1-cards.test.ts`) |
| B3. TS data, API | `packages/backend/src/routes/content.ts` seed (jamo `char`/`romanization`) → R7 | | `packages/backend/src/__tests__/content-route.test.ts` (new) |
| C. Inline literals in pages | `apps/web/src/components/landing/MeetHoya.tsx` (`거의! · geo-eui · almost!` at `:66`, `“거의!”` at `:122`); `apps/web/src/app/design-preview/page.tsx` (`:1234-1239`, plus `:417` `오늘의 학습`); `design-preview/cards/page.tsx` (`:22-59`); `design-preview/components/page.tsx` (`:563` `오늘의 학습`); `apps/web/src/app/page.tsx` (isolated jamo only); `apps/mobile/src/screens/minigames/VoiceEchoGame.tsx:37` (fallback target `'안녕'`) | `extractKoreanPairs(source, file)` finds `ko: '…'` … `romanization: '…'` inside one object literal, and the middot pattern `한글 · romanized · gloss` in JSX text | `apps/web/src/__tests__/romanization-sources.test.ts` (reads the files with `fs`; the web vitest `include` is `src/**/*.test.ts(x)`, `apps/web/vitest.config.ts:18-20`) |
| D. Comments and tooling | `packages/design-system/src/tokens.ts` comments, `HeritageCardArt.tsx` comments, `scripts/*.mjs`, `vitest.config.ts` comments, `jamo-strokes.ts` (isolated jamo, coordinates) | ignored | listed in `ROMANIZATION_SCAN_IGNORE` with a reason each |

**Coverage check** (the guard for "the audit found it only scans 2 files"): `romanization-coverage.test.ts` in `packages/content-schema` walks `apps/**/src`, `packages/**/src` and `content/**` (excluding `node_modules`, `.next`, `coverage`, `__tests__`), finds every file containing a Hangul syllable (`[가-힣]`), and fails unless the file is in the table above or in `ROMANIZATION_SCAN_IGNORE`. Adding Korean to a new file therefore forces its author to register it — in the same PR. Known upcoming registrations: F-QUEST-002 adds `apps/mobile/src/logic/stage1/spoken.ts` (syllable carriers 가 나 …) and `hangul-check.ts` (word items) to class B1, and its rewritten `content/quests.ts` / `minigame-config.ts` scopes stay registered; F-STORY-001 / F-VOC-001 JSON under `content/stories/` and `content/vocab/` is covered by class A automatically. (Isolated jamo `[ㄱ-ㆎ]` do not count; `jamo.ts`, `content.ts` and `jamo-strokes.ts` are registered for R7 or ignored.)

CI wiring: `.github/workflows/content-validation.yml` `paths:` gains `apps/mobile/src/content/**`, `apps/mobile/src/logic/minigame-config.ts`, `apps/mobile/src/logic/profiles/avatar-catalog.ts`, `apps/web/src/data/**`, `apps/web/src/components/landing/**`, `apps/web/src/app/design-preview/**`, `packages/backend/src/routes/content.ts`, `packages/content-schema/**`, and the job adds `pnpm --filter @hangul-route/mobile test`, `… web test`, `… backend test` runs limited to the romanization suites (`-t romanization`). The full `ci.yml` job already runs everything.

### 3.5 Schema and type changes (additive)

- `JamoSchema` (`schemas/jamo.ts`): `exampleWordRomanization: z.string().min(1).optional()`, `.max(12)` on `romanization`, and `.refine`: when `exampleWordKo` is present, `exampleWordRomanization` is required.
- `HeritageCardSchema` (`schemas/heritage-card.ts`): `.refine`: when `subtitleKo` is present, `romanization` is required.
- `MinigameScope` (`apps/mobile/src/logic/minigame-config.ts:13`): `storySteps[].romanization?: string`. **This spec is the single owner** of that field and of the twelve legacy values (§3.7; PR 2a adds the field, PR 2b the values); F-STORY-003 §3.1 reads it and adds nothing. Dialogue `options[].romanization` (`:18`) and `cardPairs[].romanization` (`:12`) stay optional in the type; R4 makes them mandatory in data.
- `QuestStepSchema` (`schemas/quest.ts:15-24`): `hoyaLineKo: z.object({ ko, romanization, en }).optional()` — structurally a subset of the shared `KoTextSchema` (`schemas/ko-text.ts`, created by whichever of F-CNT-002 PR 2a / F-QUEST-002 Q-1 / F-STORY-001 / F-VOC-001 lands first with the full field set `{ ko, romanization, en, spokenKo?, audioRef?, syllables? }`); use `KoTextSchema.pick({ ko: true, romanization: true, en: true })` as soon as it exists, otherwise the inline object above. `hoyaLineEn` must contain no Hangul. `NarrativeStepBody` (`QuestPlayerScreen.tsx:157`; it is used at `:147-151` with `message={step.hoyaLineEn ?? step.bodyEn}`) renders the Korean line with its romanization and English gloss when present, plus a "Hear it" button (audio belongs to F-AUDIO-004; the field and the visible text are in scope here).
- Rendering gaps: `TapRespondGame.tsx:90` builds the option label from `ko` and `en` only, dropping `romanization` (a live CLAUDE.md §1 violation on the Stage 4 taste quest) — **fixed in PR 2a** (label `ko · romanization · en`; the data already carries `romanization`, `minigame-config.ts:18`). `VoiceEchoGame.tsx:37` shows its target without a guaranteed romanization; the game is behind `flags.voiceEchoEnabled` (off), so it stays with F-AUDIO-004. Noted so the validator is not mistaken for proof that every learner screen shows the text.

### 3.6 Computed syllable display

`syllableSplit()` (§3.2) is used by teaching UI only; call sites are not part of this spec. The rule that matters here: **no stored string may contain a hyphen**; a UI that wants `han-geul-lal` calls the helper.

### 3.7 Content fixes (exact locations, verified)

Pronunciation errors (R1; each also R2 where hyphenated):

| File:line | Given | Change |
|---|---|---|
| `apps/mobile/src/content/heritage-cards.ts:35` | `hangeul-nal` (한글날) | `hangeullal` |
| `apps/mobile/src/content/heritage-cards.ts:62` | `yutnori` (윷놀이) | `yunnori`; blurb may add "also written yutnori" |
| `apps/web/src/data/stage1-cards.ts:36` | `K-pop` (케이팝) | `keipap` (title and `en` keep "K-pop") |
| `apps/web/src/data/stage1-cards.ts:47` | `yut-no-ri` | `yunnori` |
| `apps/web/src/app/design-preview/page.tsx:1239` | `yutnori` | `yunnori` |
| `apps/web/src/app/design-preview/cards/page.tsx:27` | `hangeul-nal` | `hangeullal` |
| `apps/web/src/app/design-preview/cards/page.tsx:54` | `yutnori` | `yunnori` |
| `content/episodes/stage-1/jamo.json:141` | `K-pop` (ㅋ example) | `keipap` (or replace the example with `코 ko`, as `jamo.ts:74`) |
| `content/episodes/stage-1/jamo.json:284` | `yut-no-ri` (ㅠ example) | replace the example word with `유리` / `yuri` / "glass" (as `jamo.ts:88`); a ㅊ final plus nasalisation is a poor first ㅠ word |
| `content/episodes/stage-1/cards.json:136` | `K-pop` | `keipap` |
| `content/episodes/stage-1/cards.json:279` | `yut-no-ri` | `yunnori` |
| `apps/mobile/src/logic/profiles/avatar-catalog.ts:28` | `pillarName: '례이'`, `romanization: 'Yeri'` | `pillarName: '예리'`, `romanization: 'Yeri'` (C9); update `docs/specs/F-PROF-001-device-profiles.md:54` and the wireframe `design/wireframes/profiles/create-learner.md` |
| `apps/web/src/components/landing/MeetHoya.tsx:66` and `:122` | `거의! · geo-eui · almost!`, "Hoya says “거의!”" | `거의 다 했어! · geoui da haesseo · almost there!` and "Hoya says “거의 다 했어!”" (natural, encouraging; RR checked by the golden vectors) |
| `apps/mobile/src/content/episodes.ts:74` | `hoyaIntroEn: 'Let us play yutnori. …'` | `'Let us play yunnori. Throw the sticks!'` (prose rule, §3.1 item 8) |

Hyphenation (R2, remove hyphens, keep every letter; each value below is the converter's output for the Korean):

- `apps/mobile/src/content/heritage-cards.ts:34` `jong-i-jeop-gi` → `jongijeopgi` (and its prose `jong-i-hak` → `jongihak`), `:43` `가족식탁` / `gajok-siktak` → `가족 식탁` / `gajok siktak` (C4).
- `apps/web/src/data/stage1-cards.ts:26,27,28,29,30,32,33,34,37,38,39,40,41,42,43,44,46,48,49` (`gang-a-ji` … `i-bul`, plus `:36`, `:47` above).
- `apps/web/src/app/design-preview/cards/page.tsx:26` `jong-i-jeop-gi`, `:35` `gajok-siktak` (also `:27`, `:54` above).
- `content/episodes/stage-1/cards.json:6,19,32,45,58,84,97,110,149,162,175,188,201,214,227,240,266,292,305` and the prose `gang-a-ji` at `:9`.
- `content/episodes/stage-1/jamo.json:11,24,50,63,89,102,115,154,167,180,193,206,219,232,245,271,297,310`.

(The grep for hyphenated `romanization` values, run on 2026-10-10, finds 65 `romanization:` sites in four files (`stage1-cards.ts` 21, `cards.json` 21, `jamo.json` 20, `design-preview/cards/page.tsx` 3) plus the three positional `make(…)` rows in `heritage-cards.ts` (`:34`, `:35`, `:43`). Re-run it when starting the PR: `grep -rnE "romanization['\"]?: ?['\"][^'\"]*-[^'\"]*['\"]" apps packages content`.)

Missing romanization (R4):

- `apps/mobile/src/logic/minigame-config.ts:122-125` → `son ssitgi`, `sang charigi`, `gachi meokgi`, `jal meogeotseumnida`; `:147-150` → `hanbok ipgi`, `sebae deurigi`, `tteokguk meokgi`, `sebaetdon batgi`; `:188-191` → `pyeon gareugi`, `yut deonjigi`, `mal omgigi`, `seungni`.
- `apps/mobile/src/content/jamo.ts:64-90` example words get `exampleWordRomanization`: 가족 `gajok`, 나무 `namu`, 달 `dal`, 라면 `ramyeon`, 물 `mul`, 밥 `bap`, 산 `san`, 아이 `ai`, 집 `jip`, 책 `chaek`, 코 `ko`, 토끼 `tokki`, 포도 `podo`, 하늘 `haneul`, 아빠 `appa`, 야구 `yagu`, 엄마 `eomma`, 여우 `yeou`, 오리 `ori`, 요리 `yori`, 우유 `uyu`, 유리 `yuri`, 으뜸 `eutteum`, 이름 `ireum` (all converter outputs). The helper factories `c`, `v` (`jamo.ts:7-59`) take the new argument.
- `apps/mobile/src/content/quests.ts:92`: move `새해 복 많이 받으세요.` out of `hoyaLineEn` into `hoyaLineKo: { ko: '새해 복 많이 받으세요.', romanization: 'saehae bok mani badeuseyo', en: 'Happy New Year!' }`; `hoyaLineEn` becomes "Happy New Year! Let's learn the greeting."

Related content errors found in the same audit that are **not** romanization (listed so they are not lost; separate content PR, see audit F13): `감사` glossed "A polite thank you" (`heritage-cards.ts:87`, `minigame-config.ts:319`), `사과` "also means I'm sorry" (`cards.json:87`), `으뜸` "first" containing the untaught ㄸ (`jamo.ts:89`), "Hoya means tiger" (`quests.ts:108`).

Out of this spec: the landing page and the app showing different Stage 1 card sets (audit F14); unifying them is D4's generation work. R5 (`romanization-inconsistent`) at least keeps their spellings equal.

### 3.8 Avatar name

Per C9, `AVATAR_PRESETS[2]` becomes `{ kind: 'hoya-green', pillarName: '예리', romanization: 'Yeri', theme: 'rites', label: 'Feast Tiger' }`. The checker accepts it (`예리` → `yeri`). If the owner rejects the respelling, keep `례이`, set `romanization: 'Ryei'`, and the checker accepts that instead; no exception entry is needed in either case.

### 3.9 States and failure output

- Findings are printed one per line as `::error file=<path>,line=<n>::<rule>: <message>` so GitHub annotates the PR, inside the vitest failure message; `pnpm --filter @hangul-route/content-schema test -t romanization` reproduces locally.
- A scan error (unreadable file, invalid JSON) is a failing test with the path; there is no "skip".
- The suites are deterministic and offline.
- Authors can try a word with a one-line vitest `it.only`, or by copying a row of the golden table; no CLI is shipped (C2).

### 3.10 Behaviours (Given / When / Then)

- **Given** `윷놀이` stored as `yut-no-ri`, **when** the content suite runs, **then** it fails with `romanization-hyphen` and `romanization-mismatch` ("Revised Romanization is \"yunnori\""), naming the file and line.
- **Given** `강아지` stored as `gang-a-ji`, **then** exactly one finding (`romanization-hyphen`, suggestion `gangaji`) is reported, not two.
- **Given** `손 씻기` stored as `sonssitgi`, **then** `romanization-spacing` fails (2 Korean words, 1 romanized).
- **Given** a `labelKo` in `minigame-config.ts` with no sibling `romanization`, **then** `romanization-missing` fails.
- **Given** `호랑이` as `horangi` in `heritage-cards.ts` and as `ho-rang-i` in `cards.json`, **then** `romanization-inconsistent` fails once, citing both files.
- **Given** the jamo ㅇ with romanization `∅/ng`, **then** `jamo-value-unknown` fails; with `silent/ng` it passes and `a11yRomanization('silent/ng')` is `silent or ng`.
- **Given** `꽃잎` stored as `kkonnip` (true RR) and no exception, **then** `romanization-mismatch` fails (the converter's known limit); **given** an exception `{ ko: '꽃잎', allowed: ['kkonnip'], reason: 'n-insertion' }`, **then** it passes; **given** that exception while no source contains `꽃잎`, **then** `romanization-exception-stale` fails.
- **Given** a new file under `apps/*/src` that contains a Hangul syllable and is neither registered in §3.4 nor in `ROMANIZATION_SCAN_IGNORE`, **then** `romanization-coverage.test.ts` fails and names the file.
- **Given** `TapRespondGame` renders an option whose data has a romanization, **then** the label shows Korean, romanization and gloss.

## 4. Out of scope

- Teaching-UI call sites for `syllableSplit()`; the "hide romanization until tap" setting and any rendering change (F-I18N-001, F-STORY-003, F-QUEST-002).
- What the voice says (letter names vs sounds, carrier vowels, MP3s: F-AUDIO-004, audit F01/F02/F09).
- Other-language glosses or locale overlays (F-I18N-001).
- Dictionary-grade romanization (ㄴ-insertion and exceptions are handled by explicit entries only).
- Pedagogy of jamo dual values (audit F15) and CEFR vocabulary linting (F-CNT-003).
- Unifying the landing and app card sets; generating the web data from the shared source.
- Changing `scripts/validate-content.mjs` (its F-CNT-001 behaviour and `scripts/__tests__/validate-content.test.mjs` stay as they are).

## 5. Tests

Coverage: `packages/content-schema` 100 % lines and branches for `romanization/**`; the suites in apps are data-driven and not part of the logic-lane percentage.

| File | Level | Coverage |
|---|---|---|
| `packages/content-schema/src/__tests__/romanization-rr.test.ts` (new) | unit | every golden vector in §3.2; `romanizeSyllables` splits; `syllableSplit`; non-syllable input → `null`; each sound-change branch (liaison, ㅎ rules, palatalisation, nasalisation, liquid assimilation, compound finals, neutralisation); limit cases `꽃잎`, `밟다` are asserted as *known* converter output so a future fix is a conscious change |
| `…/romanization-compare.test.ts` (new) | unit | normalisation (case, punctuation, apostrophes); R1 to R3, R6, R7 positive and negative; hyphen produces one finding; exception match, stale exception (R8), exception without reason |
| `…/romanization-extract.test.ts` (new) | unit | `extractKoreanPairs` on fixture strings: single-line object literal, multi-line, the middot JSX pattern, `romanized (한글)` prose, and no false positive on comments |
| `…/romanization-content.test.ts` (new) | integration | scans `content/**/*.json`; fails today on 12+ sites until §3.7 lands; a temp-dir fixture proves a bad file would fail |
| `…/romanization-coverage.test.ts` (new) | integration | every Hangul-bearing source file is registered or ignored; deleting a registered file fails |
| `…/schemas.test.ts` (extend) | unit | `JamoSchema` and `HeritageCardSchema` refinements; `QuestStepSchema.hoyaLineKo` |
| `apps/mobile/src/content/__tests__/romanization.test.ts` (new) | integration | imports `stage1Cards/stage2Cards/stage4Cards`, `jamoAll`, `minigameScopes`, `questsAll`, `AVATAR_PRESETS`; runs R1 to R7; asserts every `storySteps[]` label has a romanization that passes R1 (the twelve legacy values from §3.7 while those sequences exist; F-QUEST-002 retires eight of them (the meal and Yut sequences; the Seollal one survives as quest 9's apply step), so the test is a rule, not a table of values) |
| `apps/web/src/data/__tests__/romanization.test.ts` (new) | integration | `stage1Cards` (landing) R1 to R3, R6; R5 against the mobile cards that share a `ko` |
| `apps/web/src/__tests__/romanization-sources.test.ts` (new) | integration | inline pages: `MeetHoya.tsx`, design-preview pages |
| `packages/backend/src/__tests__/content-route.test.ts` (new; no content-route test exists in `packages/backend/src/__tests__/` today) | integration | seed jamo values pass R7 |
| `scripts/__tests__/validate-content.test.mjs` | regression | unchanged; still passes |

## 6. Rollout

Lands as a content-and-tooling change with no user-visible behaviour except corrected text and new romanization lines. Enforcement turns on only after the data is clean (PR 3 follows PR 2b), so `main` never goes red. Because the new rules read the apps' data, any in-flight content PR (stories, vocab: D4) must rebase and pass them; the failure messages name the fix.

## 7. PR breakdown (small PRs, dependency order)

| PR | Content | Depends on |
|---|---|---|
| 1 | `feat(content-schema)`: `romanization/` modules (including `a11y.ts`), `JAMO_*` tables, empty exceptions, golden and rule tests (the suites that read repo data are not added yet) | — |
| 2a | `feat`: additive schema/type changes of §3.5 without the new refinements — `JamoSchema.exampleWordRomanization?` and `.max(12)`, `HeritageCardSchema` unchanged until 2b, `QuestStepSchema.hoyaLineKo?`, `MinigameScope.storySteps[].romanization?`, `NarrativeStepBody` renders `hoyaLineKo`, the `TapRespondGame` option label gets its romanization (§3.5), `a11yRomanization()` in the jamo screens | 1 |
| 2b | `content`: all fixes in §3.7 (the sixty-odd data lines, the twelve `storySteps` values, 24 example-word romanizations, the Seollal line moved to `hoyaLineKo`), then the `.refine` rules of §3.5 (a Korean field needs its romanization); `docs`: F-PROF-001 name line | 2a |
| 3 | `test`/`ci`: the data-reading suites (content, mobile, web, backend, inline pages, coverage check) and the workflow `paths`/steps | 2b |
| 4 | `docs`: `content-skill/SKILL.md` §3.3, `content/episodes/stage-1/README.md`, F-CNT-001 §4 pointer to this spec | 3 |

**Cross-spec order**: F-QUEST-002 Q-7 (quest 7 intro) needs PR 2a/2b; F-STORY-003 PR 3.5a (Story Order romanization display) needs PR 2a (field) and, for correct text on screen, PR 2b (values). Any story / vocab content PR (D4) merged after PR 3 must pass the new suites.

## 8. Dependencies

- **Upstream**: F-CNT-001 (rules it builds on), the audit report `hangul-route-audit-2026-10-09.md` and `design-inputs/audio-pass-2.md` (findings and the reference converter).
- **Downstream**: F-STORY-003 (reads `storySteps[].romanization`, which this spec owns, and the rule), F-STORY-001 (story JSON `rr` alias), F-VOC-001..005 (vocab JSON), F-AUDIO-004, F-I18N-001, F-LEARN-001 (avatar name).
- **External**: owner confirmation of the `예리` respelling (C9).

## 9. Unverified assumptions (check while implementing)

1. The audit's converter was **re-run** (12 mismatches, 293 pairs) and about 190 further words were spot-checked against the RR rules (not against a dictionary); the TS port is a re-implementation, so the golden table, not the Python, is the contract. Words outside the table may expose converter bugs; add a vector and an exception only after checking the NIKL rule.
2. Node `fs` reads of the repo from a vitest test inside a workspace package behave the same in the CI job's checkout (paths are resolved from `import.meta.url`); not run here.
3. `engines` says `node >=20` but `.nvmrc` is 22; this spec avoids depending on either by not shipping a Node CLI (C2).
4. The `heritage-cards.ts` `make(…)` rows were checked through the exported arrays by the audit's extractor, not by this spec's suites (not yet written).
5. `design-preview` routes are shipped pages (they are under `apps/web/src/app`); if they are excluded from the production build, class C can drop them to the ignore table.
