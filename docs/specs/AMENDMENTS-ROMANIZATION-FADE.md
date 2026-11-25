# AMENDMENTS-ROMANIZATION-FADE — romanization steps back as the learner reads

Status: ready (row RF-0, 2026-11-25; multi-agent review §12; OD-RF-1 to OD-RF-6 adopted provisionally as recommended, §11). Owner decision 2026-11-22 (OD-R1, review-2026-11 README §4): "Stage 1 q11 부터 배운 글자만으로 된 읽기 단어는 `tap`, Word Builder 완료 후 기본 `tap`. Check 계열은 항상 숨김", approved as recommended. Work order WO-11 of `docs/roadmap/review-2026-11/phase-2-hangul.md` (its 근거 reuses WO-10's).

**Amends** (each got its "Amended 2026-11-25 by AMENDMENTS-ROMANIZATION-FADE [RF]" line in row RF-0):
- `F-I18N-001-ui-locales.md` decision **D2** where it is written down: §3.1 "Romanization display setting" (`RomanizationMode` stays the *shown* mode; a new stored choice has three values), §3.2 (`ProfileSettingsSchema` gains two optional fields), §3.3 "Settings — Profile" (the reading-practice switch becomes three choices), §3.5 rule 3 and its second Given (the default is `auto`, not `always`), §4 telemetry (`romanization.mode_changed` payload gains `'auto'`).
- `F-CNT-002-romanization-policy.md` §2, the **D2** binding line ("romanization is visible by default"): visible by default while the learner is learning the letters, then one tap away on words the learner can read.
- `F-QUEST-002-discover-check-stage1-complete.md` §3.2 (Discover): a `word` card's romanization now follows the item-level mode, with the same **Show how to say it** reveal as an example word (today it is always drawn, §1.2 item 4). A letter card's own sound value is never folded.

**Not amended:** `AMENDMENTS-AUDIT-2026-11.md` AU-8 and the sibling `AMENDMENTS-STAGE1-DECODING-CHECK.md` (WO-10), which own every Check surface (§3.7). F-PLC-001's `revealMode` (the level check's own reveal). F-TCH-004 / `AMENDMENTS-LECTURE-V2.md` deck romanization (the presenter has no learner profile). F-BROWSE-001 §4.9 (the All lessons display override still wins). The data rule: every taught Korean string still carries its romanization, and the F-CNT-002 validator still requires it.

**Scope:** `packages/content-schema/src/schemas/locale.ts` (additive) · `apps/mobile/src/logic/locale/romanization-mode.ts`, `logic/locale/romanization-fade.ts` (new) · `apps/mobile/src/i18n/use-romanization-mode.tsx` · `apps/mobile/src/store/locale-store.ts` · `screens/minigames/MinigameScreen.tsx` and `screens/reviews/StageReviewScreen.tsx` (the Check scope, §3.7) · `screens/minigames/use-answer-announcement.ts` (the shared screen-reader holder, §3.13) · `apps/mobile/src/components/ReadingPracticeCard.tsx` · `apps/mobile/src/screens/vocab/VocabCardsScreen.tsx` (its switch) · the three item-level surfaces of §3.6 (`logic/stage1/discover-flow.ts` + `screens/quest/DiscoverStep.tsx`, `logic/listen-pick-flow.ts` + `screens/minigames/ListenPickGame.tsx`, `logic/pic-word-flow.ts` + `screens/minigames/PicWordMatchGame.tsx`) · the reach audit sites of §3.8 · `screens/quest/QuestPlayerView.tsx` (the line) · `packages/i18n/src/messages/{en,es,ko}/learner.ts` · `design/wireframes/profile/reading-practice.md` (new) and a mock under `design/screens/romanization-fade/` (row RF-0b) · `CLAUDE.md` §1 (one line, row RF-3).
**Owner:** solo dev
**Rollout:** RF-1a to RF-1c change nothing for a profile that never chose `tap` (the default stays `always` until RF-2); RF-2 turns `auto` on as the default. §7.
**Wireframe:** `design/wireframes/profile/reading-practice.md` (new: the Reading practice card, Hoya's line, a folded Discover word).

---

## 1. Context

### 1.1 The citations of WO-11 (and the WO-10 근거 it reuses), re-read on main `8676b5de5`

| # | WO says | On `8676b5de5` | Verdict |
|---|---|---|---|
| 1 | `packages/content-schema/src/schemas/locale.ts:39` `romanizationMode` default `'always'` | `:39` `romanizationMode: RomanizationModeSchema.default('always')`, inside `ProfileSettingsSchema` (`:33-58`); the enum is `:17` `z.enum(['always', 'tap'])` | correct |
| 2 | `apps/mobile/src/logic/locale/romanization-mode.ts` `resolveRomanizationMode`: override → profile → `always` | `:9-14`, `return override ?? settings?.romanizationMode ?? 'always'` | correct |
| 3 | "the setting is `'always' \| 'tap'` only, with no change by stage" | True. Nothing reads progress to choose a mode | correct |
| 4 | `packages/i18n/src/romanization.ts:9` `romanizationShown(mode, revealed)` | `:9-11`, `mode === 'always' \|\| revealed` | correct |
| 5 | (WO-10) `listen-pick-flow.ts:309` options carry romanization; AU-8 holds it at `:316-317` | moved: `:335` (`romanizationMode === 'always' \|\| touched`), AU-8 hold `:337` and `:343` | correct, lines moved |
| 6 | (WO-10) `placement/run.ts:141-143` skips `leaks` items when `revealMode === 'always'` | `:143` | correct (not used here) |
| 7 | (WO-10) `BuildLetterGame.tsx:210, 323-330` romanization on the target and tiles | the target's romanization is a caption at `:252`, tiles at `:415`, `:422` | correct, lines moved (not changed here: §3.6) |

Where the profile stores the setting: `hr:settings:<profileId>` (`apps/mobile/src/store/locale-store.ts:50-51`, `SETTINGS_KEY`), parsed with `ProfileSettingsSchema.safeParse` in `hydrate` (`:272`), local to the device, never synced (F-I18N-001 §3.2). Who writes it: `setRomanizationMode` (`:354-363`, the only writer of `tap`), and three other writers that fill `romanizationMode: 'always'` into a record that had none: `setReadToMe` (`:367`), `setChallengeMode` (`:375`), `setClockScale` (`:387`); `hydrate` also rewrites a record when it strips a retired language (`:294`), with the parsed default filled in. Who reads it: `useRomanizationMode()` (`apps/mobile/src/i18n/use-romanization-mode.tsx:37-43`) for every screen (28 call sites under `screens/` and `components/`, kept on the hook by `logic/__tests__/romanization-hook-scan.test.ts`), and `ReadingPracticeCard.tsx:23` (the one editor). Who switches it: the Profile card (`components/ReadingPracticeCard.tsx:29-43`) and the Words cards screen (`screens/vocab/VocabCardsScreen.tsx:391-392`, `:482-497`).

No citation is wrong in a way that changes the plan. Four facts the WO does not mention do shape it (§1.2 items 2 to 5).

### 1.2 What happens today

1. Every profile shows romanization on every surface unless it switched **Reading practice: hide romanization until I tap** on. A Stage 1 learner who has read 산, 강 and 바다 for a week still sees *san*, *gang*, *bada* under each, and Listen & Pick can be answered by matching the sound to the Latin letters, not by reading.
2. **A stored `'always'` is not a choice.** The old switch had two states, Off (the default) and On; Off stores `'always'`, the default value (the e2e test says "switching back stores the default again", `apps/mobile/e2e/web/language-picker.spec.ts:81-87`). And three writers store `'always'` into records that never had a mode (item above). So a stored `'always'` means "default" for every profile, and only a stored `'tap'` records a learner's choice.
3. **`RomanizationMode` has about 60 consumers that test `=== 'always'`** (for example `logic/listen-pick-flow.ts:335`, `logic/pic-word-flow.ts:364`, `logic/sentence-builder/view.ts:68`, `screens/library/StoryTileGrid.tsx:84`) and a lecture schema field (`packages/content-schema/src/schemas/lecture.ts:138`). Adding `'auto'` to that enum would silently fold romanization on all of them. The stored choice and the shown mode must be two types.
4. **Discover's `word` cards ignore the mode.** `DiscoverStep.tsx:504-510` draws a card's own romanization with no `romanizationShown`, so it is always shown; only an example word and an exchange line follow the mode (`logic/stage1/discover-flow.ts:621`, `:657`). F-QUEST-002 §3.2 wrote the `tap` rule for the example word only. WO-11's acceptance ("a new profile starts q11 with the reading words folded") starts on a Discover word page (F-QUEST-002 §3.6, q11 pages: words 산 · 강, 바다 · 하늘), so the word card must learn the mode.
5. **Some surfaces hide romanization in `tap` mode with no way to see it.** `tap` is an opt-in today, so few learners meet this; once `auto` folds everything after Word Builder (§3.5), it becomes the default path. Candidates are listed in §3.8.

## 2. User story

- As a learner who has met all the Stage 1 letters, I want the words I can read to show only Hangul, so that I practise reading them, and I want the romanization one tap away when I am stuck.
- As a learner who is still meeting letters, I want romanization on everything, as now.
- As a learner (or a grown-up beside a child) who prefers it one way, I want to choose **Always** or **Only when I tap** and keep that choice.
- As a learner who uses a screen reader, I want nothing to change unless I choose it.

## 3. Acceptance criteria

### 3.1 The data model: a stored choice with three values, a shown mode with two

```ts
// packages/content-schema/src/schemas/locale.ts (additive; RomanizationModeSchema and its .default('always') field unchanged)
export const ROMANIZATION_CHOICES = ['auto', 'always', 'tap'] as const;
export const RomanizationChoiceSchema = z.enum(ROMANIZATION_CHOICES);
export type RomanizationChoice = z.infer<typeof RomanizationChoiceSchema>;

// ProfileSettingsSchema gains (additive, optional, lenient like challengeMode at :55):
  /** The learner's reading choice (AMENDMENTS-ROMANIZATION-FADE §3.1). Absent: read the legacy field (§3.2). */
  romanizationChoice: RomanizationChoiceSchema.optional().catch(undefined),
  /** When Hoya's reading line was shown (§3.9), ISO 8601. Absent: not shown yet. */
  romanizationNoticeAt: z.string().datetime({ offset: true }).optional().catch(undefined),
```

- `RomanizationMode` (`'always' | 'tap'`) stays the **shown** mode: what a surface draws. Every consumer of §1.2 item 3 keeps its type and its tests. `RomanizationChoice` is what a profile **stores**; it is never passed to a surface.
- The legacy field `romanizationMode` stays in the schema exactly as it is (`:39`), so an older cached build (the PWA keeps one until it updates) reads every record unchanged. A build of this spec writes it as a **mirror** of the choice (§3.2) and never reads it when a `romanizationChoice` is present.
- Why a new field and not `'auto'` in `romanizationMode`: an older build parses that field strictly (`.default('always')` with no `.catch`), so a stored `'auto'` would fail its `safeParse`, drop the profile's whole record from memory (`locale-store.ts:273`, `continue`) and let its next write lose Read to me and Challenge. A new optional field is stripped by the older build's parse and costs nothing else.

### 3.2 Reading a profile's choice (the migration)

`romanizationChoiceOf(settings, defaultChoice = ROMANIZATION_DEFAULT_CHOICE)` (`logic/locale/romanization-mode.ts`, pure; the second argument lets the tests run both defaults):

| Stored | Choice | Why |
|---|---|---|
| `romanizationChoice` present | that value | written by this build: a real choice |
| no `romanizationChoice`, `romanizationMode: 'tap'` | `tap` | the old switch's On: the only stored value that was ever a choice (§1.2 item 2) |
| no `romanizationChoice`, `romanizationMode: 'always'` | `ROMANIZATION_DEFAULT_CHOICE` | the old switch's Off, or a value filled by another writer: the default (OD-RF-1) |
| no record, or a record that does not parse | `ROMANIZATION_DEFAULT_CHOICE` | as today |

- `ROMANIZATION_DEFAULT_CHOICE` is one exported constant: `'always'` from RF-1a, `'auto'` from RF-2 (the switch-on, §7). Under `'always'` the table above gives every profile exactly what it shows today.
- Nothing is rewritten on hydrate: no migration write, no new key on a record the learner never touched. A record gains `romanizationChoice` only when the learner chooses (§3.10).
- **Writing** (`setRomanizationChoice(profileId, choice)`, added in RF-1a beside `setRomanizationMode` (`locale-store.ts:354-363`), which RF-2 removes when it moves the two switches over): writes `romanizationChoice: choice` and the mirror `romanizationMode: choice === 'tap' ? 'tap' : 'always'` (an older build then shows `tap` for `tap` and its own default for the rest). It reports `romanization.mode_changed { mode: choice }` when `romanizationChoiceOf` of the record changes (§3.15). The other writers (`setReadToMe`, `setChallengeMode`, `setClockScale`) keep spreading the previous record, so they keep `romanizationChoice` and `romanizationNoticeAt`; their `romanizationMode: 'always'` fill stays (harmless: §3.2 reads it as the default).
- **Mixed builds.** From RF-1a, `setRomanizationMode` (still used by the two switches until RF-2) writes `{ ...previous, romanizationMode: mode }` **without** `romanizationChoice`, so the record is read by the legacy rows. Otherwise an RF-1 build still open in another tab after RF-2 stored a choice could write `{ romanizationChoice: 'auto', romanizationMode: 'tap' }` and lose the learner's `tap`.
- **Rollback.** An older build strips the two new fields when it parses, and writes the stripped record on its next settings write. The profile then reads back by the legacy rows: `tap` stays `tap`; an explicit **Always** or **As I learn** reads as the default; the line may show once more. Accepted (rare, and nothing earned is touched).

### 3.3 The fade phase: what the learner has met

`logic/locale/romanization-fade.ts` (new, pure; no React, no store, no clock):

```ts
export type FadePhase = 'letters' | 'reading' | 'all';
/** F-QUEST-002 §3.6 rule R5: from quest 11 (nature-q2) no quest teaches a symbol; quests 1-10 teach all 30. */
export const FADE_READING_FROM_QUEST = 'quest:stage1-nature-q2';
/** Word Builder, volume 1 (F-CURR-001 §3.3): the rest of the Hangul inventory. */
export const FADE_ALL_FROM_EPISODE = 'episode:stage2-letters';

export interface FadeInput {
  doneQuestIds: ReadonlySet<string>;      // finished quests
  placedOutQuestIds: ReadonlySet<string>; // the level check's placed-out quests
  testedOut: Readonly<Record<string, string>>; // the snapshot's test-out latch (`snapshot.testedOut ?? {}`)
}
/** The snapshot -> { phase, met } memo (a module-level WeakMap keyed by the snapshot object), tested here. */
export function fadeOfSnapshot(snapshot: ProgressSnapshot): { phase: FadePhase; met: ReadonlySet<string> };
export function metSymbols(input: FadeInput, stage1Quests?: readonly Quest[]): Set<string>;
export function fadePhase(input: FadeInput, met: ReadonlySet<string>, stage1Quests?: readonly Quest[], episodes?: readonly Episode[]): FadePhase;
```

- **Done quests** = `completedQuestIdsOf(snapshot.quests)` (`logic/route/self-route.ts:41-43`, quests with `completedAt`) together with the keys of `snapshot.questDoneAt` (the quest latch, `packages/content-schema/src/schemas/progress.ts:431`, which only gains keys). A quest is done at any star count.
- **Placed-out quests** = `placedOutSkipSet(snapshot.placements, questsAll, episodesAll)` (`logic/placement/route-skip.ts:46-61`): the effective route's placed-out set, every level check combined, minus what a grown-up put back. It returns `undefined` when there is no result (`route-skip.ts:52`): use `?? new Set()`.
- **Met symbols** = the union of `questTeaches(q)` (`logic/stage1/curriculum.ts:27-30`, the jamo ids q's Discover introduces) over every quest q of `STAGE1_QUESTS` (`curriculum.ts:21`) that is done or placed out. This is the letter wall's own reading (`logic/my-route/letter-wall.ts:9-15`, `:63-64`: "met" by a finished quest, "known" by the level check), so the Learning Route and the fade never disagree about which letters the learner has. For in-order play it equals `symbolsMetThrough(<last done quest>)` (`curriculum.ts:51-55`); for out-of-order play (every Stage 1 quest is open) it counts only what was actually met.
- **Phase `all`** when Word Builder is complete: every id of `requiredQuestIds(<FADE_ALL_FROM_EPISODE>)` (`packages/content-schema/src/schemas/episode.ts:75-79`) is done or placed out, **or** `testedOut` holds `episode:stage2-letters` or `stage2` (F-CURR-002 test-out and Stage Jump keys, `progress.ts:446`). Volume 2 (`episode:stage2-letters-v2`) is not required. A placement at `stage3` band 0 or above places out every Stage 2 grid quest (F-PLC-001 §3.6), so it reaches `all` here.
- **Phase `reading`** when not `all` and every id of `symbolsMetThrough(FADE_READING_FROM_QUEST)` is in the met symbols, and that list is not empty. On today's content the list is the 30 symbols of quests 1 to 10 (q11 teaches none), so `reading` starts when the learner has finished (or placed out of) quests 1 to 10, which for in-order play is the moment q11 opens: OD-R1's "q11 부터".
- **Phase `letters`** otherwise, and whenever an input is missing: no profile, a snapshot not read yet, `FADE_READING_FROM_QUEST` not in `STAGE1_QUESTS` (a content change; then `reading` never starts, never the other way), or `FADE_ALL_FROM_EPISODE` not in the bundle (then `all` never starts).
- **It only moves forward.** Its inputs only gain entries (finished quests, the latch, placements, test-outs) except a grown-up's **reset** of a profile's progress, which is meant to start over. A miss, a low star count or a forgotten word never moves the phase back (§3.14).
- **When it changes.** Normally at a quest's completion, a level-check result or a test-out, between games. It can also change under an open screen: progress read late, a merge from another tab or a sync. So the item-level surfaces (§3.6) take the resolver **once per mount** (a Discover step, a game) and keep it; a change applies from the next screen. Surface-level readers stay live, as today.
- **Cost.** `placedOutSkipSet` runs the effective-route merge. `fadeOfSnapshot` computes `{ phase, met }` once per snapshot object (a `WeakMap` in `romanization-fade.ts`, so it is in a tested `logic/` file), so the 30 hook calls (in 28 files) share one computation. The hook selects the phase string and memoizes the resolver (and its `forText`) on `[override, choice, phase, screenReader]`, so a progress write that leaves the phase as it is re-renders nothing.
- **WO-15 (finals).** If WO-15 adds final consonants to Stage 1 (`jamoBatchim`), `symbolsOf` will accept words with them; the met-symbol test of §3.4 keeps such a word shown until its quest is done. If WO-15's quest sits before q11 in `STAGE1_QUESTS`, `reading` waits for it too, as it should.

### 3.4 Decodable text

`isDecodable(text, met)`: true when

1. `text` holds at least one Hangul syllable block (U+AC00 to U+D7A3);
2. every other character is white space or one of `. , ! ? ~ … · ' " ( ) -` (straight or curly quotes);
3. for every block, `symbolsOf(block)` (`logic/stage1/hangul.ts:59-75`) is not `null` (the block is built only from the 30 Stage 1 symbols: no tense or compound letters, no final outside the six taught) and every id it returns is in `met`.

Otherwise false: an isolated letter (`ㄱ`, a compatibility jamo, is not a block), Latin letters or digits, a word with ㄲ (까치), ㅐ (세배) or a final ㅅ (젓가락). Examples on today's content, in phase `reading`: 산, 강, 바다, 하늘, 김치, 김밥, 호랑이, 한글 are decodable; 까치, 떡국, 젓가락, 팽이, 세뱃돈 are not.

A **reading word** (F-QUEST-002 §3.6 R3) is decodable by construction; a **theme word** may be either. This rule decides by the letters, not by the content's label, which is what OD-R1 says ("배운 글자만으로 된 읽기 단어").

### 3.5 The resolution tables

Two functions in `logic/locale/romanization-mode.ts` (pure):

```ts
export interface FadeContext { phase: FadePhase; met: ReadonlySet<string>; screenReader: boolean }
export interface RomanizationResolver {
  /** The mode a surface shows for anything it does not resolve per text. */
  surface: RomanizationMode;
  /** The mode inside a Check (§3.7): as `surface`, except that `auto` is always `always` there. */
  check: RomanizationMode;
  /** The mode for one Korean text, on the item-level surfaces of §3.6 only. */
  forText: (ko: string) => RomanizationMode;
}
export function romanizationResolver(
  override: RomanizationMode | null,
  settings: Pick<ProfileSettings, 'romanizationChoice' | 'romanizationMode'> | undefined,
  fade: FadeContext | null,
): RomanizationResolver;
/** Kept for every existing caller: `romanizationResolver(...).surface`. */
export function resolveRomanizationMode(override, settings, fade?: FadeContext | null): RomanizationMode;
```

The choice is `romanizationChoiceOf(settings)` (§3.2; `settings` undefined, a profile with no record or no profile at all, gives the default choice). `fade` is `null` when there is no active profile or its progress snapshot has not been read; the hook builds it otherwise.

**Surface mode** (every surface; the first matching row wins):

| # | Condition | `surface` |
|---|---|---|
| S1 | an override is set (All lessons, F-BROWSE-001 §4.9; the Hangul Check's and Stage Check's own providers) | the override |
| S2 | choice `always` | `always` |
| S3 | choice `tap` | `tap` |
| S4 | choice `auto`, `fade` is `null` (no profile, or progress not read yet) | `always` |
| S5 | choice `auto`, a screen reader in use (§3.13) | `always` |
| S6 | choice `auto`, phase `letters` or `reading` | `always` |
| S7 | choice `auto`, phase `all` | `tap` |

With no profile the choice is the default, so S2 (before RF-2) or S4 (after it) gives `always`, as every screen with no profile shows today (`romanization-mode.ts:13`).

**Check mode** (`check`): S1, then choice `tap` → `tap`, otherwise (`always` or `auto`, any phase) → `always`. A Check therefore shows a profile on **As I learn** exactly what it shows a profile on the default today, in every phase; what a Check holds before the answer is AU-8's and WO-10's (§3.7).

**Per-text mode** (`forText`, on the item-level surfaces of §3.6; by phase × kind of text):

| Choice (no override) | Phase | Symbol (a letter on its own) | Decodable text (§3.4) | Other text (a theme word, a sentence with an unmet letter) |
|---|---|---|---|---|
| `always` | any | shown | shown | shown |
| `tap` | any | folded | folded | folded |
| `auto` | `letters` (quests 1-10) | shown | shown | shown |
| `auto` | `reading` (after quest 10, before Word Builder is complete) | shown | **folded** | shown |
| `auto` | `all` (Word Builder complete) | folded | folded | folded |
| `auto`, screen reader in use | any | shown | shown | shown |
| any, override set | any | the override | the override | the override |

Precedence in both tables: override > explicit choice (`always`, `tap`) > screen reader > phase. "Shown" is `always`, "folded" is `tap`; `forText` returns the surface mode except in the bold cell. A Discover **letter card**'s own sound value (`g/k`, `ieung`) is never passed to `forText` and is always shown, in every mode (F-QUEST-002 §3.2: it is the thing being taught). "Folded" means exactly what `tap` means on that surface today, plus §3.8.

### 3.6 Where it applies

- **Surface level, every surface.** `useRomanizationMode()` keeps its signature and returns `surface`. With choice `auto` it gives `always` until Word Builder is complete and `tap` after it, on every screen that reads the hook (stories, Words, Library, upper-stage games, the quest warm-up and Try these again), except inside a Check (§3.7). In phase `all` every surface outside the Checks therefore behaves as for a profile that chose **Only when I tap** today.
- **Item level, three surfaces, quest host only.** A new hook `useRomanizationResolver()` returns the resolver, taken once per mount (§3.3); these surfaces call `forText(ko)` per word instead of reading one mode, and only in a quest's non-Check steps (`host.mode === 'quest'`; Discover is a quest step). Every other host (`check`, `review`, `vocab`, `preview`, Hidden Heritage's fallback) keeps the one mode it reads today:
  1. **Discover** (`logic/stage1/discover-flow.ts` `pageRender` `:604-646`, `exchangeRender` `:648-670`; `screens/quest/DiscoverStep.tsx:145`, `:284`): a `word` card (and the texts `wordItem` builds for sentence, pattern and realia items, `:246-260`, `:316-323`), a letter card's example word, and an exchange line. A `word` card gains `romanizationShown` and `showReveal` like the example word (`:621-627`), drawn with the existing **Show how to say it** (the example's reveal, `DiscoverStep.tsx:622-624`); while folded the card keeps the romanization line's room (`KoreanText` `romanizationReserved`, `packages/design-system/src/components/KoreanText/types.ts:14-19`), so revealing moves nothing; its accessible name follows the shown state as the example's does (`logic/stage1/example-label.ts:13-15`); after a reveal the button goes and screen-reader focus moves to the word (`focusForScreenReader`). Never passed to `forText`: a letter card's own value, its `spokenLine` and `soundWith` lines (`DiscoverStep.tsx:536-559`), and the audio-failure "Say it out loud" lines. Discover is shared with the upper-stage lesson quests, so in phase `reading` an upper-stage Discover word built only from met letters folds too (for example 사자); one with a Word Builder letter does not. `pageRender(model, state, mode, copy)` keeps its signature (about 15 test calls) and gains an optional fifth argument `modeOf?: (ko: string) => RomanizationMode`.
  2. **Listen & Pick** (`logic/listen-pick-flow.ts` `OptionViewContext` `:277-290`, `optionView` `:335`; `screens/minigames/ListenPickGame.tsx:153`) on the `quest` host only (practice and apply steps), never on `check`, `review`, `vocab` or `preview` (§3.7). The context gains `romanizationModeOf?: (ko: string) => RomanizationMode`; absent, the one mode is used as now.
  3. **Pic-Word Match** (`logic/pic-word-flow.ts` `wordTileView` `:355-368`; `screens/minigames/PicWordMatchGame.tsx:133`): the same optional `romanizationModeOf` on its context, on the `quest` host only (the game also runs as a Stage 2 Check, `PicWordMatchGame.tsx:312`, in Words, `screens/vocab/VocabMatchScreen.tsx:117`, and as Hidden Heritage's fallback, `HiddenHeritageGame.tsx:468`).
- These are the Stage 1 surfaces that show reading words and read the mode today. Build a Letter, Match Sound, Trace, Odd One Out and Culture Quiz (Stage 1's other games) draw romanization as a prompt or a letter value and do not read the mode; Story Sequence reads it (`StorySequenceGame.tsx:155`) at surface level. They stay as they are (§4).
- Upper-stage surfaces (stories, Words, Sentence Builder and the others) stay at surface level: during phase `reading` they show romanization (most of their words hold a letter the learner has not met yet), and from phase `all` they fold. Making them item-level during `reading` is a follow-up (OD-RF-4).

### 3.7 Checks: the boundary with WO-10

- Check surfaces: the quest's Check step (any game, hosted with `mode: 'check'` by `screens/minigames/MinigameScreen.tsx:228`; AU-8 holds Listen & Pick's options), the Hangul Check (`screens/reviews/StageReviewScreen.tsx`, Listen & Pick host `review`), the Stage Check (`screens/stage-check/StageCheckScreen.tsx`, its own switch and override, `:442`), the Cell Check and Daily Review's read and produce rounds (`screens/reviews/ReviewRounds.tsx`, `DailyReviewScreen.tsx`, `screens/cell-check/`; they do not read the profile's mode). What they hold and when they show it is owned by AU-8 and by `AMENDMENTS-STAGE1-DECODING-CHECK.md` (WO-10 row DC-1: held until answered, whatever the mode). This spec does not redesign it.
- **`auto` never folds anything inside a Check.** A Check reads the resolver's `check` mode (§3.5): `always` for **As I learn** in every phase, `tap` only for a profile that chose **Only when I tap**, as today. So no phase changes what a Check shows, and the default path never meets today's `tap` gap on Checks (under `tap`, a quest Check shows only the touched options' romanization after the answer, `logic/__tests__/listen-pick-flow.test.ts:557-565`); that gap stays an explicit-`tap` matter for WO-10.
- Mechanism (RF-1a): `MinigameScreen` wraps a `check` step's game in `RomanizationCheckScope` (a context in `i18n/use-romanization-mode.tsx`), inside which `useRomanizationMode()` returns `check`; the Hangul Check seeds its switch from `check` (`startReviewFlow({ romanizationMode })`, `StageReviewScreen.tsx:120-126`). The Stage Check's override is unchanged. `forText` is never used inside a Check. When DC-1 lands it may replace these with its own holds; nothing here needs to change then.
- The quest warm-up and **Try these again** (`screens/quest/quest-review-chunk.tsx:299`, `:368`) are practice, not Checks: surface level. The warm-up runs before the Hello step, so in phase `all` it can fold before Hoya's line shows; accepted (its options show at the answer, `:368`).

### 3.8 The romanization is always one tap away

CLAUDE.md §1: taught Korean always has its romanization. No mode removes it: the data keeps it (F-CNT-002), and on screen a folded romanization is reachable by one of:

- (a) a reveal control on the item (**Show how to say it**, or the surface's existing equivalent);
- (b) the tap the surface already reveals on (a Pic-Word tile when selected, a Listen & Pick option when touched);
- (c) the answer: when a round resolves, every option it folded shows its romanization;
- (d) the screen one tap opens shows the same item with its romanization or a reveal (a list tile that opens the item).

Required changes, all modes that fold (`tap` and `auto` alike, so `tap` is never stricter in what it can reach):

- **Discover word cards** (§1.2 item 4): reveal (a), RF-1b.
- **Listen & Pick, every non-Check host** (`quest`, `vocab`, `preview`): today an option folded under `tap` shows only once touched, so the distractors' romanization is never reachable without a wrong answer. From RF-1b, once the round resolves (`state.status` `resolved` or `done`), every text option shows its romanization (c), as the quest Check already does for a default profile once AU-8's hold ends. A change for profiles that chose `tap` too, in the same direction.
- **Pic-Word Match**: already (b) and (c) (every tile ends matched).
- **The reach audit (row RF-1c).** The sites that fold on `tap` with no reveal argument in the expression, found by `grep "=== 'always'"` and `romanizationShown(..., false)` on `8676b5de5`: `logic/realia-read-flow.ts:338` (the realia title), `logic/sentence-builder/view.ts:68` (tray and line tiles, used at `:86`, `:121`, `:154`), `logic/vocab/topic-view.ts:74` (topic tiles), `screens/minigames/RealiaReadGame.tsx:363`, `screens/minigames/HiddenHeritageGame.tsx:540`, `:600` (found and story lists), `screens/library/StoryTileGrid.tsx:84` (story tiles), `screens/vocab/VocabCardsScreen.tsx:587`, `screens/vocab/VocabResultsScreen.tsx:51`, `screens/vocab/VocabSpeedRoundScreen.tsx:368`, `screens/minigames/ListenPickGame.tsx:208` (a text-prompt round's prompt, `romanizationShown(romanizationMode, false)`). RF-1c records for each one which of (a) to (d) holds, with the test or file:line that shows it, and adds (a) or (c) where none does. `screens/browse/HomeSections.tsx:433` is All lessons only (override; no learner `auto`) and is out of the audit. A timed Speed round in Challenge mode may meet the rule by (c) at its end (its result list) rather than (a) during the clock.

A reveal never costs anything: no star, no mark, no count shown to the learner. On the two surfaces whose own specs already treat a reveal before a scored answer as help (Type Hangul's hear mode, `logic/type-hangul/hear-mode.ts:122-125`; Syllable Build, `logic/syllable-build/flow.ts:14-15`: "hinted", which neither promotes nor demotes in the memory store), a reveal means exactly what it means for a `tap` profile today. This spec adds no consequence.

### 3.9 Hoya's line, once

- **Text (English, CEFR Pre-A1):** "You can read Hangul now! Need help with a word? Tap Show how to say it." Key `learner.quest.readingNotice` (§3.11). The WO's draft said "see the letters in English"; romanization is not English (and in the Spanish and Korean UI it is the same Latin letters). The line names the button (not "tap the word": on Listen & Pick a tap on an option is an answer) and says nothing about the words of a step the learner has not seen yet.
- **Due** when all of: the profile's choice is `auto`; no screen reader in use (§3.13); `romanizationNoticeAt` is absent; and either phase is `all`, or phase is `reading` **and** the quest is in `STAGE1_QUESTS` (where its reading words fold). So a learner in phase `reading` who opens a Word Builder quest (개, 노래: nothing folds) does not get it there. Pure function `readingNoticeDue({ choice, phase, screenReader, noticeAt, stage1Quest })` in `romanization-fade.ts`.
- **Where:** on the Hello step (step 1) of the next quest run that starts while it is due (OD-RF-2), as a second Hoya bubble under the quest's own line, inside the same card (`QuestPlayerView.tsx` `NarrativeStepBody` `:495-550`, a new optional prop beside `note`; wireframe Panel B). Tone `idle`, Hoya's pose unchanged (`waving`). Not a live region; read in order. Continue is never held.
- **Marked** when that step mounts: `romanizationNoticeAt` is written (now, ISO 8601) by a new store action `markRomanizationNotice(profileId, at)` that spreads the previous record (keeping the choice, Read to me and Challenge), so it shows once per profile, on this device. Leaving the quest after it showed does not bring it back.
- Not on a guest run (guests play quest 1 only, phase `letters`), not in All lessons or the presenter (no profile), not on a profile that chose Always or Only when I tap.
- A learner whose first fold is outside a quest (phase `all` reached by a level check, then the Words tab first) meets the fold before the line; the line comes at their next quest. Accepted: every folded item has its reveal (§3.8).

### 3.10 The setting in Profile

`components/ReadingPracticeCard.tsx` (wireframe Panel A): heading **Reading practice** (existing), then a radio group labelled **Show romanization** with three options:

| Option | Stores | Hint line |
|---|---|---|
| **As I learn** | `auto` | "Shows less as you read more." |
| **Always** | `always` | — |
| **Only when I tap** | `tap` | — |

- The checked option is the stored choice, `romanizationChoiceOf(settings)` (never the resolved mode, never an override), so a profile on the default shows the default checked: **Always** until RF-2's switch-on, **As I learn** after it.
- Each option is one row at least `touchTarget.min` high, the whole row pressable, `accessibilityRole="radio"` with `accessibilityState={{ checked }}` (and `aria-checked` on the web, as the current switch does at `:35`), inside a `radiogroup` whose accessible name is the visible label. Tokens only. A choice is stored at once (no confirm sheet: display only, reversible; F-I18N-001 L7) and not behind the grown-up gate.
- **The Words cards switch** (`VocabCardsScreen.tsx:482-497`) stays a two-state switch: it shows **On** while the screen's resolved mode is `tap` and stores `tap` (On) or `always` (Off) as an explicit choice (OD-RF-5). Going back to **As I learn** is in Profile. Trade-off, accepted in OD-RF-5: a learner on **As I learn** in phase `all` who switches it Off stores **Always** for every surface, which also ends the Stage 1 fade, until they choose **As I learn** again.
- The source scan `logic/__tests__/romanization-hook-scan.test.ts` keeps its rule (screens read the mode only through the hooks) and extends it to `romanizationChoice`; `ReadingPracticeCard` stays the one editor allowed to read the stored value.

### 3.11 Strings

`packages/i18n/src/messages/en/learner.ts`:

| Key | English | Row |
|---|---|---|
| `learner.profile.reading.groupLabel` | Show romanization | RF-2 |
| `learner.profile.reading.auto.label` | As I learn | RF-2 |
| `learner.profile.reading.auto.hint` | Shows less as you read more. | RF-2 |
| `learner.profile.reading.always.label` | Always | RF-2 |
| `learner.profile.reading.tap.label` | Only when I tap | RF-2 |
| `learner.quest.readingNotice` | You can read Hangul now! Need help with a word? Tap Show how to say it. | RF-2 |

- Reused, unchanged: `learner.profile.reading.title` "Reading practice", `.on` / `.off` (the Words cards switch), the reveal CTAs "Show how to say it". `learner.profile.reading.hideUntilTap` loses its reader (the old switch) and is removed from en, es and ko in RF-2 if a `grep` finds no other reader.
- Spanish and Korean are **shipped** locales (`packages/i18n/src/locales.ts:31-35`), so a missing key fails `es-coverage.ts` / `ko-coverage.ts`. R8 runs only after a merge to `main`, so RF-2 drafts the es and ko values itself, has them reviewed under F-I18N-001 §3.10 (the two-lens review R8 uses) and re-signs the ledger in the same PR, as AMENDMENTS-AUDIO-CANT-HEAR §3.10 did. This spec writes English only.
- Translator note: "romanization" is Korean written in Latin letters (Revised Romanization), not English and not the Hangul; "Show how to say it" in the line must be the same words as the existing reveal button in that locale.
- No age framing, no "for kids"; no word of loss ("hide", "lose", "remove", "less help") in learner copy.

### 3.12 The Korean (and Spanish) UI

F-I18N-001 §3.5 rule 3 makes romanization a property of the taught Korean, not of the UI locale: "always visible by default in every locale including `ko`". This spec keeps it locale-independent: the choice, the phase and both tables of §3.5 are the same in the English, Spanish and Korean UI; the romanization shown is the same Revised Romanization string in every locale (F-CNT-002 D13); the gloss in the UI language and the picture are never folded (F-I18N-001 §3.5 rules 3 and 4; OD-R5's gloss policy for the Korean UI is unaffected). Only the card's words and Hoya's line change with the locale (§3.11). A Korean-UI heritage learner who wants the old default chooses **Always**.

### 3.13 Screen readers

With a screen reader in use, `auto` resolves as `always` (row S5, OD-RF-3): the fade is a scaffold for reading Hangul by sight, and on a folded item today's accessible name drops the romanization (`logic/stage1/example-label.ts:13-15`), leaving the Hangul to a voice that may not read Korean. "In use" is the native signal (`platform/screen-reader.ts` `isScreenReaderEnabled` / `subscribeScreenReader`, `:12-25`) or, on the web, which cannot tell, the device's **I use a screen reader** (`DeviceSettings.screenReader`, `packages/content-schema/src/schemas/locale.ts:106`; `useLocaleStore` `screenReader`). The rule is `readerPath({ platform, nativeReader, webFlag }) === 'reader'` (`logic/answer-feedback.ts:126-135`), the one F-A11Y-001 uses; RF-1a moves the native subscription that `screens/minigames/use-answer-announcement.ts:39` keeps per game into one module-level holder in `i18n/use-romanization-mode.tsx` (subscribed once, on first use), read by both. Explicit **Only when I tap** is unchanged for a screen-reader user (their choice). No Hoya line while S5 applies.

### 3.14 Anti-shame

- The fade is framed as progress ("You can read Hangul now!"), never as help taken away; no copy says "hide", "remove" or "without help".
- It only moves forward (§3.3): a miss, a low star count or a forgotten word never brings the romanization back by itself and never moves a meter back. The learner brings it back with a tap, at no cost (§3.8).
- No counter of reveals is shown, stored for the learner or compared between learners. Stars, cards and collection progress are untouched.
- No red, no new feedback colour; Hoya's tone is `idle`.

### 3.15 Telemetry

`romanization.mode_changed` (already in `TELEMETRY_EVENT_NAMES`, `packages/content-schema/src/schemas/telemetry.ts:34`; payload not validated by name) keeps its name; its payload becomes `{ mode: 'auto' | 'always' | 'tap' }`, sent by `setRomanizationChoice` when the read choice changes. Resolving a default, reaching a phase and showing the line send nothing (no new event, no `TELEMETRY_EVENT_NAMES` change, `docs/roadmap/TELEMETRY-NAMES-2.md` row unchanged).

### 3.16 Given / When / Then

- **Given** a new profile (no settings record) that finished quests 1 to 10, after RF-2, **when** it opens q11 (Mountain, River, Sea), **then** the Hello step shows Hoya's reading line once; on Look and learn, 산 and 강 show no romanization until **Show how to say it**, which shows *san* / *gang*; the gloss and picture stay. (WO-11's acceptance.)
- **Given** the same profile, **when** it plays q11's practice (Listen & Pick, words 산 강 바다 하늘 별 곰), **then** no option shows romanization while the question is open; the touched option shows it; when the round resolves every option shows it. **When** it reaches q11's Check, **then** the options behave exactly as they do for a default profile today (AU-8 holds them until the answer, then all show).
- **Given** a profile in phase `reading`, **when** a page or tile shows 까치 or 떡국, **then** its romanization shows with no reveal.
- **Given** a profile that finished quests 1 to 9 only, **when** it opens q11, **then** every romanization shows and there is no line (phase `letters`).
- **Given** a profile placed at Stage 1 band 3 (q1-q10 placed out) by the level check, **then** it is in phase `reading`.
- **Given** a profile on **As I learn** that completed Word Builder (or placed at `stage3` band 0), **then** every surface outside the Checks shows the mode a `tap` profile shows today; every Check shows what it shows a default profile today (§3.7); Discover's letter cards still show their sound values; the line shows at the next quest of any stage.
- **Given** a profile on **As I learn** in phase `reading` that opens a Word Builder quest, **then** no line shows there (§3.9); it shows on its next Stage 1 quest.
- **Given** the line was shown on one quest, **when** the learner opens another quest, **then** it does not show again.
- **Given** a profile in phase `reading`, **when** it plays q4's or q14's Pic-Word Match, **then** a decodable word tile (김밥, 한지) shows no romanization until selected and a theme word with an unmet letter (까치) shows it; in the same game played from Words (host `vocab`) nothing changes from today.
- **Given** progress has not been read when a screen first draws, **then** it resolves as S4 (`always`); an item-level surface that mounted then keeps that until it is opened again (§3.3).
- **Given** **As I learn** in phase `all`, **when** the learner switches the Words cards switch Off, **then** the choice becomes **Always** for every surface (OD-RF-5), and Profile shows **Always** checked.
- **Given** a stored record `{ romanizationMode: 'tap' }`, **then** the choice is **Only when I tap** and nothing folds or shows differently from today, except §3.8's additions; no line.
- **Given** a stored record `{ romanizationMode: 'always', readToMe: true }` (Read to me was switched on), after RF-2, **then** the choice is **As I learn** (OD-RF-1).
- **Given** a learner chooses **Always** in Profile, **then** the record holds `romanizationChoice: 'always'` and `romanizationMode: 'always'`, one `romanization.mode_changed { mode: 'always' }` is sent, and every surface shows romanization in every phase.
- **Given** VoiceOver is on and the choice is **As I learn** in phase `all`, **then** every surface shows romanization (S5) and no line shows.
- **Given** All lessons with its display setting **Only when I tap**, **then** that override wins on every surface it wraps; no phase is read.
- **Given** the Korean UI, **then** the same items fold as in English, and the card and line read in Korean.

## 4. Out of scope

- What a Check holds and when (AU-8, WO-10 / `AMENDMENTS-STAGE1-DECODING-CHECK.md`).
- Item-level fading on stories, Words, Library and the upper-stage games during phase `reading` (OD-RF-4, follow-up).
- Stage 1's prompt-style romanization: Build a Letter's target caption (`BuildLetterGame.tsx:252`), Trace headings, Match Sound tiles (letter values), Hoya's Korean lines (`hoyaLineKo`), quest titles. These say what to do or which letter is taught, not a word to read.
- A fade driven by the memory store (per-word mastery). The memory flags are off (OD-R8), and a mastery-driven fade could come back on a miss, which §3.14 forbids.
- The level check's `revealMode`, the presenter's deck romanization, All lessons' setting.
- Syncing the choice across devices (settings stay local, F-I18N-001 §3.2).

## 5. UI sketch

`design/wireframes/profile/reading-practice.md` (new): Panel A the Reading practice card, Panel B Hoya's line on the Hello step, Panel C a folded Discover word with its reveal, Panel D a theme word that stays shown; states for each choice, a screen reader, no profile, the Korean and Spanish UI. `profile/profile-split.md` got a pointer to it in row RF-0 (its "Reading practice ... Off" row is replaced). Mock: `design/screens/romanization-fade/` (row RF-0b).

## 6. Tests

All unit tests in the `logic/` vitest lanes unless named; one commit = test + implementation.

1. `packages/content-schema/src/__tests__/locale.test.ts` (RF-1a): `{}` still parses to `{ romanizationMode: 'always' }`; `romanizationChoice` `auto` / `always` / `tap` round-trip; an unknown choice (`'never'`) or a bad `romanizationNoticeAt` reads as absent and the rest of the record survives (`readToMe`, `challengeMode` kept); `romanizationMode: 'never'` still fails as today.
2. `apps/mobile/src/logic/locale/__tests__/romanization-mode.test.ts` (RF-1a): `romanizationChoiceOf` for every row of §3.2, with `ROMANIZATION_DEFAULT_CHOICE` injected as both `'always'` and `'auto'`; `surface` for rows S1-S7; `check` for every choice and phase (never `tap` for `auto`); `forText` for every cell of the per-text table, including the bold cell with a decodable and a non-decodable word, and a lone letter; the three existing cases unchanged.
3. `apps/mobile/src/logic/locale/__tests__/romanization-fade.test.ts` (RF-1a): `metSymbols` (done; placed out; done through the latch only; out-of-order q11 alone gives nothing); `fadePhase`: q1-q10 done → `reading`; q1-q9 → `letters`; q11 alone → `letters`; placed out q1-q10 → `reading`; Word Builder's required quests done → `all`; its quests placed out → `all`; `testedOut` `episode:stage2-letters` or `stage2` → `all`; Word Builder done but q1-q10 not → `all`; an unknown `FADE_READING_FROM_QUEST` → never `reading`; no placements (`placedOutSkipSet` `undefined`) and no `testedOut` handled; `fadeOfSnapshot` returns the same object for the same snapshot; `isDecodable` for every example of §3.4 plus `'산!'` true, `'san'` false, `''` false, `'ㄱ'` false, `'산 강'` true. **Content drift guard:** `FADE_READING_FROM_QUEST` is in `STAGE1_QUESTS`, teaches nothing, and `symbolsMetThrough` of it has 30 distinct ids; `FADE_ALL_FROM_EPISODE` is in `episodesAll` with six required quests.
4. `apps/mobile/src/store/__tests__/locale-store.test.ts` (RF-1a): `setRomanizationMode` drops `romanizationChoice` (mixed builds, §3.2); `setRomanizationChoice` writes the choice and the mirror (`auto` → `always`), reports `romanization.mode_changed` once with the choice and not for a repeat; `setReadToMe`, `setChallengeMode`, `setClockScale` keep `romanizationChoice` and `romanizationNoticeAt`; hydrate writes nothing for a record with no choice.
5. `logic/__tests__/romanization-hook-scan.test.ts` (RF-1a, then RF-1b and RF-2): RF-1a extends the direct-read patterns to `romanizationChoice`; RF-1b lets `DiscoverStep`, `ListenPickGame` and `PicWordMatchGame` call `useRomanizationResolver(` instead of `useRomanizationMode(` (the scan's call-site list, `:41-56`); RF-2 changes the editor rule (`:101-106`) from `resolveRomanizationMode(null, settings)` to `romanizationChoiceOf(settings)`. A screen test (RF-1a) shows a game inside `RomanizationCheckScope` reading `check`.
6. `logic/stage1/__tests__/discover-flow.test.ts` (RF-1b; its case at `:550-555`, word items keep their romanization under `tap`, is reversed by DEP-2): a word card folded by `forText` has `romanizationShown: false`, `showReveal: true`, and after the reveal action `romanizationShown: true`; a letter card's own value never folds; explicit `tap` folds word cards too.
7. `logic/__tests__/listen-pick-flow.test.ts` (RF-1b): with `romanizationModeOf`, per-option folding on the `quest` host; ignored on `vocab`, `preview`, `check`, `review`; every option shows once resolved on non-Check hosts; on `check` and `review` nothing changes and AU-8's cases (`:557-565` included) stay green.
8. `logic/__tests__/pic-word-flow.test.ts` (RF-1b): per-tile folding on the `quest` host; ignored on `check` and `vocab`; a selected tile shows.
9. RF-1c: one test per audited site that lacked a way to reach the romanization (§3.8), and the audit table in the PR body.
10. `components`/screens (RF-2): the Reading practice card's three radios (role, checked state, the stored choice shown, a press stores the choice); the line's due rule as a pure function (`readingNoticeDue`, §3.9) with each negative case (choice not `auto`, screen reader, already shown, phase `letters`, phase `reading` on a non-Stage 1 quest); `markRomanizationNotice` keeps the rest of the record (`store/__tests__/locale-store.test.ts`); `setRomanizationMode` and its test (`locale-store.test.ts:639`) removed.
11. e2e (RF-2, `apps/mobile/e2e/web/`): `language-picker.spec.ts` (`:70-90`, the switch becomes the radio group; storage expectations: `{ romanizationMode: 'tap', romanizationChoice: 'tap' }` after **Only when I tap**, `{ romanizationMode: 'always', romanizationChoice: 'always' }` after **Always**); a new case seeding a profile with q1-q10 done, opening q11: the line once (not on a second quest), the folded word and its reveal; `story-reader.spec.ts:267` unchanged (`setReadToMe` still fills the legacy field). The other specs that seed `romanizationMode` (`story-checks`, `vocab-speed`, `vocab-topics`, `vocab-cards`) keep passing: a seeded `tap` stays `tap`, a seeded `always` becomes the default (`auto`), which on a fresh profile is phase `letters`, so nothing they assert changes. Specs that seed Stage 1 as complete (`stage1-complete`, `text-size-fit`, `hangul-check`) are in phase `reading`, and those that seed Word Builder as done (`letters-volume2`, `syllable-build-cant-hear`, `cant-hear-stage-check`) in phase `all`; RF-2 runs every one of them and fixes any assertion that read a romanization the fade now folds (or seeds `romanizationChoice: 'always'` where the spec is not about the fade).

Coverage: `apps/mobile` business logic 90 % (CLAUDE.md §6); the new pure files are fully covered by tests 2, 3 and 10.

## 7. Rollout

- RF-1a, RF-1b, RF-1c ship with `ROMANIZATION_DEFAULT_CHOICE = 'always'`: a profile that never chose `tap` sees nothing new. A profile that chose `tap` sees §3.8's additions (word cards fold on Discover with a reveal; Listen & Pick shows every option at the answer; audited sites gain a reveal).
- RF-2 sets `ROMANIZATION_DEFAULT_CHOICE = 'auto'` together with the Profile card, the Words switch change and the line. From that release, every profile whose record holds no choice and no `tap` is on **As I learn**: an existing learner past quest 10 sees words fold at once on Stage 1 practice surfaces, and one past Word Builder sees every surface fold; the line explains at the next quest. RF-3 updates CLAUDE.md §1 in the same release.
- **[실기기] Device checks (owner).** On an iPhone (Safari and the installed PWA) and an Android phone: a fresh profile through q10 into q11 (the line once; 산 folded; Show how to say it; Listen & Pick resolves with every option shown); Profile's three radios with VoiceOver and TalkBack (names, checked state); VoiceOver on with **As I learn** in phase `all` (nothing folds); the Korean UI (same folds, Korean card and line); 320 x 568 at 200 % text (the card fits, rows stay one target each).
- Watch: `romanization.mode_changed` with `mode: 'always'` after RF-2 (learners leaving the fade).

## 8. Dependencies

- OD-R1 (approved 2026-11-22). No spec blocks RF-1a.
- AU-8 (shipped) and `AMENDMENTS-STAGE1-DECODING-CHECK.md` (WO-10, being written in a sibling session): they own the Checks; §3.7 is the only contact. If DC-1 lands first, RF-1b's Listen & Pick change must keep its `check` / `review` paths as DC-1 leaves them.
- WO-15 (finals in Stage 1): §3.3 last bullet.
- Shared files (`docs/roadmap/review-2026-11/README.md` §6): `screens/quest/DiscoverStep.tsx` and `logic/stage1/discover-flow.ts` with WO-12 (#13), WO-13 and WO-14 (b) → RF-1b merges serially with them. `screens/minigames/ListenPickGame.tsx` and `PicWordMatchGame.tsx` with WO-04's game rows. `packages/i18n/src/messages/en/learner.ts` with almost every UI WO (mechanical rebase). The README's §6 lists WO-11 under `logic/minigame-config.ts` and `content/quests.ts`; this design touches neither.
- Existing pieces: `symbolsOf` (`logic/stage1/hangul.ts`), `questTeaches` / `symbolsMetThrough` / `STAGE1_QUESTS` (`logic/stage1/curriculum.ts`), `placedOutSkipSet` (`logic/placement/route-skip.ts`), `completedQuestIdsOf` (`logic/route/self-route.ts`), `requiredQuestIds` (content-schema), `KoreanText`'s kept romanization room (`packages/design-system/src/components/KoreanText/types.ts:14-19`), the screen-reader wrappers (`platform/screen-reader*.ts`).

## 9. Rows

| Row | Model | Work | Files | Tests | Acceptance | Depends on | Branch |
|---|---|---|---|---|---|---|---|
| RF-0 | Opus 5.5 | This spec; the wireframe and a pointer in `profile/profile-split.md`; the "Amended" lines in F-I18N-001, F-CNT-002, F-QUEST-002; the index lines | `docs/specs/AMENDMENTS-ROMANIZATION-FADE.md`, `design/wireframes/profile/reading-practice.md`, `design/wireframes/profile/profile-split.md`, `design/wireframes/README.md`, three spec headers, `docs/specs/README.md` | — | multi-agent review done (§12), status `ready` | OD-R1 | `docs/romanization-fade` |
| RF-0b | Opus 5.5 | Mock of Panel A (phone, tablet landscape, 320 x 568 at 200 % text, the Korean UI), Panel B, Panel C; multi-agent review | `design/screens/romanization-fade/` | — | mock approved by the review (CLAUDE.md §5) | RF-0 | `design/romanization-fade` |
| RF-1a | Sonnet 5.5 | §3.1 schema fields; §3.2 `romanizationChoiceOf`, `setRomanizationChoice` and its mirror (added beside `setRomanizationMode`; the two existing switches keep calling `setRomanizationMode` unchanged until RF-2, so no stored shape and no e2e expectation changes in this row); §3.3-3.5 `romanization-fade.ts`, `romanizationResolver`, `resolveRomanizationMode(…, fade)`; `useRomanizationMode()` phase- and screen-reader-aware; `useRomanizationResolver()`; `RomanizationCheckScope` and its two users (§3.7); the shared screen-reader holder (§3.13); `fadeOfSnapshot`; `setRomanizationMode` drops the choice; `ROMANIZATION_DEFAULT_CHOICE = 'always'` | `packages/content-schema/src/schemas/locale.ts`, `apps/mobile/src/logic/locale/romanization-mode.ts`, `logic/locale/romanization-fade.ts` (new), `i18n/use-romanization-mode.tsx`, `store/locale-store.ts`, `screens/minigames/MinigameScreen.tsx`, `screens/reviews/StageReviewScreen.tsx`, `screens/minigames/use-answer-announcement.ts`, and the test files of tests 1-5 | §6 tests 1-5 | no visible change for any profile; every existing test green | RF-0 | `feat/romanization-fade-model` |
| RF-1b | Sonnet 5.5 | §3.6 item level on Discover, Listen & Pick and Pic-Word Match (`quest` host only); Discover word-card reveal; Listen & Pick shows every option once resolved on non-Check hosts (§3.8) | `logic/stage1/discover-flow.ts`, `screens/quest/DiscoverStep.tsx`, `logic/listen-pick-flow.ts`, `screens/minigames/ListenPickGame.tsx`, `logic/pic-word-flow.ts`, `screens/minigames/PicWordMatchGame.tsx`, `logic/stage1/__tests__/discover-flow.test.ts`, `logic/__tests__/listen-pick-flow.test.ts`, `logic/__tests__/pic-word-flow.test.ts`, `logic/__tests__/romanization-hook-scan.test.ts` | §6 tests 6-8 | with a test profile forced to `auto` in phase `reading`, q11's words fold with a reveal and theme words do not; Checks unchanged | RF-1a, RF-0b not needed (reveal reuses the existing control) | `feat/romanization-fade-items` |
| RF-1c | Sonnet 5.5 | §3.8 reach audit of the listed sites; add a reveal or show-at-answer where none holds; the audit table in the PR | the §3.8 sites that need a change | §6 test 9 | every listed site has (a)-(d) with evidence | RF-1a | `fix/romanization-reach` |
| RF-2 | Sonnet 5.5 | §3.10 the three-radio card, the Words switch semantics (both on `setRomanizationChoice`; `setRomanizationMode` removed); §3.9 the line (`readingNoticeDue`, `markRomanizationNotice`, the Hello-step bubble); §3.11 strings en + es / ko drafts with the two-lens review and ledger; `ROMANIZATION_DEFAULT_CHOICE = 'auto'`; e2e | `components/ReadingPracticeCard.tsx`, `screens/vocab/VocabCardsScreen.tsx`, `screens/quest/QuestPlayerView.tsx`, `store/locale-store.ts` and `store/__tests__/locale-store.test.ts`, `logic/locale/romanization-fade.ts`, `logic/locale/romanization-mode.ts`, `logic/__tests__/romanization-hook-scan.test.ts`, `packages/i18n/src/messages/{en,es,ko}/learner.ts`, `packages/i18n/src/messages/review-ledger.json`, `apps/mobile/e2e/web/language-picker.spec.ts`, the e2e specs of §6 test 11 that need a change, a new e2e spec | §6 tests 10-11 | §3.16 all pass; WO-11's acceptance ("a new profile starts q11 with its reading words folded, a tap shows them; an existing choice is kept") | RF-1a, RF-1b, RF-1c, RF-0b | `feat/romanization-fade-default` |
| RF-3 | Sonnet 5.5 | Closing docs: CLAUDE.md §1 Languages gains one line (below AU-8's exception): "Second exception: with the reading setting **As I learn** (the default), once a learner has met the Stage 1 letters the words they can read show their romanization one tap away, and after Word Builder all taught Korean outside the Checks does; a tap (or the answer) always shows it (owner decision 2026-11-22, OD-R1, `docs/specs/AMENDMENTS-ROMANIZATION-FADE.md`)"; this spec's status and As built; the README index line's status; the WO-11 line in `docs/roadmap/review-2026-11/phase-2-hangul.md` marked done | `CLAUDE.md`, this spec, `docs/specs/README.md`, `docs/roadmap/review-2026-11/phase-2-hangul.md` | — | status `shipped` only after §7's device checks | RF-2 (same release) | `docs/romanization-fade-done` |

Estimates: RF-0b 0.5d, RF-1a 0.75d, RF-1b 0.75d, RF-1c 0.5d, RF-2 0.75d, RF-3 0.1d.

## 10. Departures from WO-11

- **DEP-1 — a stored `'always'` is read as the default, not kept as a choice** (OD-RF-1). WO-11's test line says "기존 `always` / `tap` 저장값 보존". The stored values are preserved byte for byte (nothing is rewritten, §3.2), and `tap`, the only value that ever recorded a choice, keeps its meaning. A stored `'always'` is read as the default because it never recorded one (§1.2 item 2). The WO's goal ("기존 프로필의 명시적 설정은 건드리지 않는다") is kept; its literal test is not.
- **DEP-2 — Discover word cards learn the mode, for `tap` too** (§3.8). Needed for WO-11's own acceptance (q11 starts on a Discover word page). A profile that chose `tap` sees word cards fold from RF-1b; F-QUEST-002 §3.2 is amended.
- **DEP-3 — the reach audit (RF-1c)** is not in WO-11. Without it, `auto` would make "romanization with no way to see it" the default path after Word Builder, which WO-11's "하지 말 것" forbids.
- **DEP-5 — `auto` does not fold on Checks** (§3.7). OD-R1 says "Check 계열은 항상 숨김"; that hiding is AU-8's and WO-10's (held until the answer, then shown). If `auto` also turned a Check to `tap` after Word Builder, the default path would meet today's `tap` gap on Checks (distractors never shown), so `auto` reads as `always` there and leaves the hiding to the Check's own hold.
- **DEP-4 — Hoya's line text** changes the WO's draft (§3.9: romanization is not English).

## 11. Open decisions (each adopted provisionally as recommended; the owner may change any before RF-2)

- **OD-RF-1 — what a stored `'always'` means.** (a) Keep it as an explicit **Always** (WO-11's literal test): profiles that ever switched Read to me, Challenge or the clock scale, or switched the old Reading practice off again, stay on Always for good, while profiles with no record get the fade; and a record with no choice must then be told apart from a filled one, which needs the three writers changed and still cannot recover the records already filled. (b) **Read it as the default** (§3.2), keep `tap`. **Recommended: (b)** — the old switch's Off was the default, so (a) splits identical learners by whether they once touched another setting. Adopted provisionally; it is one row of `romanizationChoiceOf`, so (a) costs RF-1a one line plus the writer changes.
- **OD-RF-2 — where Hoya's line shows.** (a) **The Hello step of the next quest** (§3.9); (b) inline on the first surface that folds (a banner over a game or a story); (c) a Home card. **Recommended: (a)** — a quiet narrative step already in Hoya's voice, before any game, on every route; (b) would interrupt a game and needs a slot on every surface; (c) is easy to miss and is not where the change is felt. Adopted provisionally.
- **OD-RF-3 — screen readers.** (a) As `tap` today (the accessible name drops the romanization when folded); (b) **`auto` resolves as `always` while a screen reader is in use** (§3.13); (c) fold visually but keep the romanization in every accessible name (AU-8 style) on every surface. **Recommended: (b)** — one rule in the resolver; (a) leaves screen-reader users with Hangul a voice may not read; (c) touches every surface's label. Adopted provisionally.
- **OD-RF-4 — item-level fading beyond Stage 1 during phase `reading`.** (a) **Only the three Stage 1 surfaces now** (§3.6); stories, Words and Library show until phase `all`; (b) every surface item-level now. **Recommended: (a)** — the reading words OD-R1 names live on those three surfaces; most words elsewhere hold a letter not yet met; (b) touches about 30 call sites. Follow-up when wanted. Adopted provisionally.
- **OD-RF-5 — the Words cards switch.** (a) **Keep it two-state, storing explicit `tap` / `always`** (§3.10); (b) remove it (Profile only); (c) a three-state control there too. **Recommended: (a)** — learners use it today (the e2e `vocab-cards` spec) and a two-state "Reading practice" fits a card screen; going back to **As I learn** from Profile is one tap. Cost: Off under **As I learn** in phase `all` stores **Always** everywhere and ends the Stage 1 fade too (§3.10). Adopted provisionally.
- **OD-RF-6 — Listen & Pick at the answer (non-Check hosts).** (a) **Every option shows its romanization once the round resolves**, for `tap` and `auto` (§3.8); (b) only for options folded by `auto`; (c) as today (only touched options). **Recommended: (a)** — the distractors' romanization is otherwise unreachable without a wrong answer, and one rule for both modes keeps `tap` never stricter in reach than `auto`. Adopted provisionally.

## 12. Review log

- 2026-11-25, multi-agent review of the RF-0 draft (two independent lenses: learner UX, pedagogy and accessibility; engineering feasibility against `8676b5de5`). Every cited file:line was re-checked and holds; the two-field migration, the content facts (quests 1-10 teach 30 distinct ids, nature-q2 is the 11th quest and teaches none, `episode:stage2-letters` is in `episodesAll` with six required quests) and the decodability examples were confirmed. Adjudicated in revision 2:
  - **Fixed, majors.** (1) In phase `all` the default path would have turned every Check to `tap`, where the distractors' romanization is never shown (`listen-pick-flow.test.ts:557-565`): `auto` now reads as `always` inside a Check (resolver `check`, `RomanizationCheckScope`, §3.5, §3.7, DEP-5). (2) The line could show on a quest where nothing folds (a Word Builder quest in phase `reading`): due in phase `reading` only on a Stage 1 quest (§3.9). (3) Item-level folding reached hosts the spec excluded (Pic-Word Match as a Stage 2 Check, in Words and in Hidden Heritage; Listen & Pick's `vocab` host): `quest` host only (§3.6). (4) RF-1b and RF-2 broke tests they did not list (`discover-flow.test.ts:550-555`, the hook scan's call-site and editor rules, `locale-store.test.ts:639`) and RF-2 lacked the store files: listed, with `markRomanizationNotice` (§6, §9).
  - **Fixed, minors.** Mixed-build write hazard (`setRomanizationMode` drops the choice from RF-1a); the phase can change under an open screen (item-level surfaces take the resolver once per mount); the screen-reader signal's home (`readerPath`, one holder); `placedOutSkipSet` `undefined` and optional `testedOut`; the default made injectable; `ListenPickGame.tsx:208` added to the reach audit; Story Sequence does read the mode; the e2e specs seeded at Stage 1 complete or Word Builder done listed for RF-2; the snapshot cache moved into tested `logic/`; call-site count (30 calls in 28 files) and the reveal citation (`DiscoverStep.tsx:622-624`). Copy: the line names the button and no longer says "these words" or "tap to see" (a tap on a Listen & Pick option answers it); the hint no longer says "less help". The CLAUDE.md line of RF-3 now says what folds after Word Builder. Daily Review's citation corrected and the warm-up placed (practice). Precedence stated; Discover lines never passed to `forText` listed; the folded word card keeps its room and moves focus to the word after a reveal; the Words switch trade-off stated (OD-RF-5); G/W/T added for the line not repeating, the Word Builder quest, Pic-Word Match, late progress and the Words switch. Wireframe: no pixel width, Panel B note reworded, Panel C buttons stack, the screen goal says it is an amendment over three screens.
  - **Kept.** OD-RF-1 to OD-RF-6 recommendations (both reviewers found (b), (a), (b), (a), (a), (a) sound). The reviewer's nit that q11's pages have no title: `discover-flow.ts` gives an all-word page `wordsTitle` ("Words you can read now") when it has no caption, so Panel C's title stands.
