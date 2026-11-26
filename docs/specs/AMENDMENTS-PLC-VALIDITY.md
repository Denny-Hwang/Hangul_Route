# AMENDMENTS-PLC-VALIDITY — the level check's sentence and word gates measure what they say

Status: ready (multi-agent review 2026-11-25, §11; open decisions PV-OD-1 to PV-OD-12 adopted as recommended, §10). Written for work order WO-18 of `docs/roadmap/review-2026-11/phase-2-hangul.md`, row PV-0, on main `803208a95`. No owner decision of `docs/roadmap/review-2026-11/README.md` §4 blocks WO-18; the decisions this row needed are in §10, each adopted as recommended (the owner asked to proceed with the recommendations).

**Amends** (each gets an "Amended 2026-11-25 by AMENDMENTS-PLC-VALIDITY [PV]" line in this PR; the closing row PV-7 folds the "as built" numbers into their text, as P-0c did for `AMENDMENTS-PLC-THREE-MODES.md`):
- `F-PLC-001-placement-test.md`: §3.4 (bank rules: sentence and word item design, tags, frequency source, per-format pools), §3.5 (the `sentence` rung is four questions and passes at 3 of 4; Standard 13 to 25, Deep 13 to 45; the sentence draws), §3.5 and §3.6 (E-1: `stepPassed` implemented as the spec already says), §3.8 (`GateResultSchema` and run-state bounds 3 → 4, Worker first, old readers), §3.9 (the report says reading and listening apart), §3.12 (strings), §5 (tests), §9 assumptions 1, 2, 11 and 12, appendices A.4, A.5, A.6, C and D.
- `F-VOC-002-wordart-svg-system.md`: §3.9 (one new WordArt family, `act`, every key `reserved`: action pictures for the level check's sentences, row PV-1a).
- `F-CURR-002-category-expansion-and-mastery.md`: §19 assumption 4 and the `freq-coverage` row (`:1475`): the NIKL list's licence is checked (KOGL Type 1, §3.3), so the list enters the repo and `freq-coverage` reads it there (row PV-3).
- `design/wireframes/placement/report.md` (section "[PV] Reading and listening").

**Not amended**: the conservative start (no decoding evidence → `stage1` band 0), the "I am not sure" button, the anti-shame rules of the check (no right/wrong feedback, no scores on learner screens), Short (it has no sentence rung; its word rung gets PV-2's words), the route rules of F-PLC-001 §3.6 and §3.7 (results combine by the maximum; listening never moves the route), the summary and roster shapes (`summary.placement` keeps its five strand statuses and `oralStage`), telemetry, F-REPORT-001 and the console roster line. PV-5 ("literacy focus" path) leaves this spec (§10 PV-OD-5).

**Scope of the implementing rows** (each row's own files are in §9): `content/placement/*.json` (with a new `sentence-families.json`), `content/i18n/{es,ko}/placement.json`, `content/audio/tts-manifest.json` (placement rows), `apps/mobile/src/content/placement.generated.ts` (built), `packages/content-schema/src/placement/{rungs,run,run-state,scoring,plan}.ts`, `packages/content-schema/src/schemas/placement.ts`, `packages/content-schema/src/__tests__/placement-*.test.ts` and the frozen v1 fixture, `packages/backend/src/__tests__/sync.test.ts`, `scripts/placement-rules.mjs` and `scripts/__tests__/placement-rules.test.mjs`, `scripts/validate-content.mjs` (`freq-coverage`), `scripts/nikl-vocab-2003.json` and `scripts/placement-lint-baseline.json` (new), `packages/design-system/src/word-art/{registry.ts,types.ts,glyphs/act.ts}` and their tests, `apps/mobile/src/logic/placement/{result-view,report-page}.ts`, `apps/mobile/src/screens/parent/PlacementReportScreen.tsx`, `packages/i18n/src/messages/{en,es,ko}/caregiver.ts`, `packages/i18n/src/messages/review-ledger.json`, `design/screens/placement/flow.md`.
**Owner**: solo dev
**Rollout**: content rows behind no flag (the bank is data; `flags.placementEnabled` stays the kill switch); the Worker carrying the new bounds is deployed before any app build that writes a four-question row (§3.7).

---

## 1. Context

### 1.1 Citations of WO-18, re-read on `803208a95`

| # | WO-18 says | On `803208a95` | Verdict |
|---|---|---|---|
| 1 | 22 of the 32 sentence `read` items can be answered by reading the noun alone ("밥을 먹어요" → Rice / Book / Sea / New Year bow) | `content/placement/sentences.json`: 32 read-form templates = 14 `n-ieyo` + 8 `n-eul-v` `read-pick-picture` + 10 `reply-pick`. In all 22 picture items the four options are four different `card:` pictures and the right one is the sentence's noun (e.g. `pitem:sent-v-read-babeulmeogeoyo`: `card:rice` right, `card:book`, `card:sea`, `card:sebae`). | correct |
| 2 | a pass skips all of Stage 2 and starts Stage 3 (`scoring.ts` `levelOf`) | `packages/content-schema/src/placement/scoring.ts:91-99` (`sentence` read passed → `stage3` band 0); `placement/level-map.ts:82` places out every grid quest of a lower stage, so all Stage 2 cells (10 episode files under `content/episodes/stage-2/`) | correct |
| 3 | `vocabulary.json` is full of culture-card words (청자, 먹, 연등, 가야금, 종이접기, 밥상, 무궁화), unlike what Stage 2 teaches | `content/placement/vocabulary.json`: 29 heard words, 19 read words, all `card:` pictures. Graded against the source of §3.3: of the 29 heard words, 9 are grade A, 3 grade B, 5 grade C and 12 are not in the list (청자, 가야금, 연등, 먹 as ink, 종이접기, 세배, 한지, 붓, 팽이, 제기, 윷놀이, 연 as kite); 9 of the 29 are not among Stage 2's words (청자, 가야금, 연등, 먹, 종이접기, 한지, 밥상, 무궁화, 호랑이) | correct |
| 4 | 2 of 3 per gate; a four-option guesser passes about 15.6 %, a three-option `reply-pick` about 26 % | `scoring.ts:32-43` (`gateResult`, `passAt` 2), `rungs.ts:105-106` (`passAtFor`: 3 only for Short's `syl-cv`), `rungs.ts:52-53` (`QUESTIONS_PER_RUNG = 3`). 3·(1/4)²·(3/4)+(1/4)³ = 0.156; three options 0.259. The real sentence read draw is two picture items and one reply (`run.ts:192-196`): 0.1875 | correct |
| 5 | the listening level `oralStageOf` neither raises nor lowers the route | `scoring.ts:101-114`; `levelOf` reads only `decode` and `read` rows. The planner reads it once: `focus = 'reading'` when the listening stage is two or more stages above the reading stage (`packages/content-schema/src/curriculum/propose.ts:203-216`, F-PLC-001 AM-4) | correct; the planner hook matters for PV-5 (§10) |
| 6 | the bank's review record is `reviewedBy: "ai-3-lens"` | every sentence template (`reviewedAt: "2026-10-11"`); vocabulary templates carry none (required for sentences only, F-PLC-001 §3.4 rule `placement-sentence-ready`) | correct |

Further citations this row relies on:

| What | Where |
|---|---|
| `leaks` items are not drawn with *Always show it* | `run.ts:140-148` (`usable`, `:143`) |
| a rung closes after three answers; a saved run holds three questions per rung | `run.ts:339-341`; `placement/run-state.ts:28` (`questions: z.array(...).length(3)`) |
| the longest run is labelled `cap` | `rungs.ts:89-90` (`questionCap`: Standard 24, Deep 42), `run.ts:232-235` |
| gate result bounds | `packages/content-schema/src/schemas/placement.ts:32-34` (`asked`, `correct`, `assisted` max 3) |
| tag grammar and picture prefix | `schemas/placement.ts:140-141` (`KNOWN_TAG`: `pattern:` only `n-ieyo`, `n-eul-v`, `reply`); `:247` (every option of a picture item has the `requires.picture` prefix) |
| bank pool rules | `schemas/placement.ts:275-330` (`PLACEMENT_MIN_READY = 9`, `PLACEMENT_MIN_FORMAT_READY`, `incompatibleWith`) |
| where placement lint rules live | `scripts/placement-rules.mjs` (`checkPlacementTree`, called by `validate-content.mjs`), tested by `scripts/__tests__/placement-rules.test.mjs`; rules that need the converter or the art are in `packages/content-schema/src/__tests__/placement-bank.test.ts` |
| the report merges reading and listening | `scoring.ts:55-57, 63-78` (a strand's best form counts); `apps/mobile/src/logic/placement/result-view.ts:250-266` (`rungStatus` by `rowsPassed`), `:331-344`; `apps/mobile/src/screens/parent/PlacementReportScreen.tsx:268-283` (one status pill per strand; the per-form lines are small captions, `rungLine` `:105-112`); strings `packages/i18n/src/messages/en/caregiver.ts:623-690` (`form: { decode: 'reading', read: 'reading', oral: 'listening' }` at `:643`) |
| `oralStage` is on no grown-up screen | stored (`run.ts:469`) and sent in telemetry (`logic/placement/events.ts:77`); `PlacementReportScreen.tsx`, `ResultScreen.tsx` and `apps/web/src/lib/console/placement.ts` never read it |
| `word:` pictures already resolve in the check | `apps/mobile/src/logic/picture-ref.ts:44-58`; the check's resolver `screens/placement/PlacementScreen.tsx:105` |
| the WordArt registry and `reserved` keys | `packages/design-system/src/word-art/registry.ts:27-41` (families), `:43` (key grammar), `:51-65` (plan), `:114-115` (`sport-swing`, `sport-slide`, `nature-sand` reserved) |
| the NIKL list is kept out of the repo today | F-CURR-002 §19 assumption 4 and its table row (`F-CURR-002…md:1475`), enforced by `scripts/validate-content.mjs:355-367` |

None of these changes the plan. Three facts found on the way widen it (§1.2, §1.3); the decisions they need are in §10.

### 1.2 What the bank does today

- **Sentence pictures are noun pictures.** Every sentence picture is a heritage card (`card:`), which shows one thing. The 14 `N-이에요` sentences ("호랑이예요") can never have a distractor that shares the noun: the sentence *is* the noun. The 8 `N을 V-요` sentences use the same cards, so the verb is never needed. F-PLC-001 already says so (§9 assumption 12).
- **Replies can be matched by echo.** In 6 of the 10 `reply-pick` items the right reply repeats a word of the line and no wrong reply does (안녕하세요! → 안녕하세요.; 잘 지냈어요? → 네, 잘 지냈어요.; 이거 김치예요? → 네, 김치예요.; 밥 먹었어요? → 네, 먹었어요.; 만나서 반가워요! → 저도 반가워요.; 안녕히 가세요. → 안녕히 계세요.). A responder who picks "the reply that sounds like the line" passes without reading the replies.
- **The heard sentences are heard nouns.** The `sentence` oral rung uses the same card options, so it measures what `vocab` oral measures (assumption 12), and its pass makes the listening level `stage3`.
- **The heard words are culture words** (§1.1 row 3). A heritage child who understands 물, 엄마, 학교 at home meets 청자, 가야금 and 연등, and is reported as not knowing words by ear.

### 1.3 Two findings outside WO-18's text

- **The decode strand has the pattern that AMENDMENTS-STAGE1-DECODING-CHECK (WO-10, open PR #1129) removes from the Hangul Check.** In all 60 syllable items of `content/placement/syllable-reading.json` (36 `hear-pick-written`, 24 `see-pick-sound`) the right option is the only one that is one letter away from every other option (e.g. `pitem:syl-cv-hear-ga`: 가 with 거, 나, 라; `pitem:syl-cvc-see-dal`: dal with dan, dak, deol), so a responder who compares the options without reading or listening finds it. And 26 of the 59 `hear-pick-written` items (sound-basic 6, sound-rest 7, syl-cv 5, syl-cvc 8) put next to the target a contrast that DC §3.4 rules out by ear (ㄱ-ㅋ, ㄷ-ㅌ, ㅂ-ㅍ, ㅈ-ㅊ, ㅇ-ㅎ, ㅓ-ㅗ, ㅡ-ㅜ, ㅕ-ㅛ, or two finals of one sound class). These gates move the route (band 1 places out q1 to q3). Row PV-6 (§3.5, PV-OD-4).
- **E-1: `stepPassed` is in the spec, not in the code.** F-PLC-001 §3.5 and §3.6 (AM-27, AM-28) say a pure `stepPassed(gates, gate, form)` in `scoring.ts` keeps a Deep row asked before an earlier confirmation failed from counting as passed, in the planner, in `strandStatuses` and in `oralStageOf`. The code has no such function (the name appears in the repo's history only in docs); `plan.ts:98` (`readsWords = clean(...)`), `strandStatuses` and `oralStageOf` use `rowsPassed` / `gatePassed`. The level and the placed-out set are right (they need consecutive steps; `placement-run.test.ts:542`), but on the Deep path "first `vocab` read draw passed, then the `syl-cvc` confirmation failed" the planner asks `sentence` oral only (it should ask the oral pair), the vocabulary strand reads *secure* and the unconfirmed read row stands in for `vocab` oral. PV-4 shows per-form statuses, so the predicate matters now. Row PV-1b implements it as specified, planner included (PV-OD-9).

### 1.4 What already exists to build on

- **Word pictures.** F-VOC-002's WordArt has glyphs for most everyday words (`food-water`, `food-milk`, `food-bread`, `food-rice`, `family-mom`, `family-dad`, `school-school`, `school-friend`, `animal-cat`, `nature-tree` …; `packages/design-system/src/word-art/glyphs/*.ts`), and the check already draws `word:` refs (§1.1). F-PLC-001 A.4 planned this: "When F-VOC-002 supplies `word:` art, Stage 2 words can be added back as new templates."
- **Builders for action pictures.** `word-art/glyphs/pose.ts` draws posed people from parts (`limb`, `head`; a kick, a run, a ski, a dance), and the animal glyphs exist (`animal-bear`, `-tiger`, `-rabbit`, `-cat`, `-bird`, `-puppy`, `-duck`, `-monkey`). No glyph shows an animal or a person doing something.
- **The confirming-draw machinery** (`drawsFor`, two rows per gate) and `passAtFor` (2 or 3).
- **Taught predicates.** Stage 3's episodes (`content/episodes/stage-3/*.json`) teach N이/가 V-요 with 뛰어요 (10 uses: 토끼가 뛰어요, 호랑이가 뛰어요), 헤엄쳐요 (5: 곰이 헤엄쳐요, 물고기가 헤엄쳐요) and 날아요 (6: 새가 날아요; 토끼가 날아요 and 호랑이가 날아요 occur only as **wrong** options, `stage-3/nature.json:1074, :1109`), and 먹어요 (53) and 마셔요 (25) with objects; Stage 2 has 자요 (4). Stage 3 pairs 던져요 with 공 and 윷, 차요 with 공 and 제기, 넣어요 only with cooking ingredients.

## 2. User story

> As a parent whose child understands Korean at home but reads only a few letters, I want the level check to tell me separately how much my child understands by ear and how much my child can read, so that I see the strength and know why the route starts with letters.

Companion stories:
- As a **learner who reads sentences**, I want the sentence part to ask me to read the whole sentence, so that skipping Stage 2 means I really can.
- As a **learner who reads only the first word**, I want the check not to skip Stage 2 for me by luck.
- As a **maintainer**, I want a lint that fails a sentence item a noun-only reader could answer, so that the bank stays valid as it grows.

## 3. Acceptance criteria

### 3.1 Item design rules: sentences (rows PV-1a, PV-1c; lint PV-3)

**S1. The predicate decides.** A `sentence` picture item (`read-pick-picture` read form, `hear-pick-picture` oral form) has four picture options:
- the right picture, noun N doing P;
- **two wrong pictures of the same N** doing P′ and P″ (the other two predicates of N's family, S5);
- **one wrong picture of another noun N′ doing X**, where X is none of P, P′, P″.

So a responder who reads only the noun chooses among three (1/3); a responder who compares the pictures for the one that shares most with the others finds no single "middle" picture (the right one and both same-noun ones tie, 1/3); and a responder who reads only the predicate finds the answer. That last one is intended: the predicate is what Stage 3 adds, and the noun was measured by the word rung the learner passed twice before a sentence is asked (F-PLC-001 §3.5). The oral form follows the same rule with the sentence heard.

**S2. Exactly one picture makes the sentence true.** Each wrong picture makes the sentence false, not merely less typical. Predicates whose pictures overlap are not used: "N이 있어요" (true of every picture of N), size and comparison (커요, 더 커요), direction (와요, 가요), and a second noun added to fix the action ("바구니에 넣어요": reading 바구니 alone would answer it). WO-18's own examples (밥을 만들어요, 밥이 없어요) are not used: 만들어요 is not taught in Stage 2-3, and "없어요" has no picture that makes "먹어요" false and itself true at once.

**S3. Only contrasts a picture shows.** The predicate is shown by what happens: the animal or person on the ground with motion lines (뛰어요), in water (헤엄쳐요), in the sky (날아요), lying with closed eyes (자요), eating from a bowl (먹어요). No text, number, arrow-only or emoji cue. The picture's accessible label is in the test language ("A bear swims"), never Korean (F-PLC-001 §3.2).

**S4. Taught and plausible.** One noun and one predicate per sentence, in the pattern N이/가 V-요 (new tag `pattern:n-i-v`), with nouns and predicates Stage 2-3 teach (§1.4). **Every sentence is true of something a learner could see**: no "토끼가 날아요" as a right answer (Stage 3 uses it only as a wrong option). `N-이에요` sentences leave the sentence gate (they are word items). The read form still reads chunks with picture support (assumption 12: 헤엄쳐요 holds ㅔ, ㅕ and ㅊ).

**S5. Families.** The pictures of one noun form a **family** of three (one per predicate), listed in `content/placement/sentence-families.json`, one row per family: noun (Korean, its romanization = the templates' `word:` tag, a hyphen-free English slug), three predicates (Korean, hyphen-free slug). `index.json` names it in a new key, `families` (not in `files`, so the bank builder does not read it as templates; `checkPlacementTree`'s "not listed in files" rule, `scripts/placement-rules.mjs:125-129`, accepts the file `families` names: PV-3). Keys are `word:act-<predicate-slug>-<noun-slug>` (e.g. `word:act-swim-bear`: exactly three hyphen-separated parts). **Each picture is the right option of exactly one template per form**, so a responder who picks "the typical action of the animal" gains nothing systematic. The bank holds **at least ten families**, using **at least five predicates**, with no predicate right in more than 40 % of a form's templates. A draw never asks two templates of one family (`spreadKey` = the `word:` tag), and the oral draw prefers families none of the run's read draws used (Deep asks `sentence` oral right after two read draws; §3.6).

Candidate families for PV-1c (non-binding; all art exists as a still glyph; PV-1c authors and reviews the final list):

| Noun (glyph) | Predicates |
|---|---|
| 곰 (`animal-bear`), 호랑이 (`animal-tiger`), 강아지 (`animal-puppy`) | 뛰어요 · 헤엄쳐요 · 자요 |
| 토끼 (`animal-rabbit`), 고양이 (`animal-cat`), 원숭이 (`animal-monkey`) | 뛰어요 · 먹어요 · 자요 |
| 새 (`animal-bird`) | 날아요 · 먹어요 · 자요 |
| 오리 (`animal-duck`) | 헤엄쳐요 · 날아요 · 자요 |
| 동생 (`family-dongsaeng`), 친구 (`school-friend`) | 뛰어요 · 헤엄쳐요 · 먹어요 |

That is 10 families, 30 pictures, 30 read and 30 oral templates. The N을 V-요 pattern stays in the bank only through replies (S6): no object has three taught, exclusive, plausible verbs in Stage 2-3 (공 has two: 던져요, 차요).

**S6. Replies (`reply-pick`).** Three written replies, as today, with `incompatibleWith` kept, and:
- **No echo win.** Split each sentence into words (spaces), drop punctuation and the words in `ECHO_STOP` (네, 아니요, 저, 저는, 저도, 이거). Two words *match* when their first two syllables are equal (a one-syllable word: when it is equal after removing one particle of 이, 가, 을, 를, 은, 는, 도). The right reply may not be the **only** reply with a word that matches a word of the line. So a canonical echo (안녕하세요! → 안녕하세요.) stays, with a wrong reply that also matches (안녕히 계세요.).
- **Every wrong reply is wrong in every context.** No 아니요 / 아니에요 / a negative reply to a yes/no line (they can be true); no reply that is right when both speakers act alike (안녕히 가세요. after 안녕히 가세요.).
- 천만에요 is replaced by 아니에요 (WO-18; WO-20 item 3), and no two templates share both the line and the right reply.
- WO-18's heard 주세요 enters here as a line: e.g. "물 주세요." → "네, 여기 있어요." (PV-1c checks the reply against the taught Stage 3-4 lines).

**S7. Counts.** Sentence read: at least **24** ready `read-pick-picture` and at least **6** ready `reply-pick`; sentence oral: at least **24** ready `hear-pick-picture`; at least 10 families. These join `PLACEMENT_MIN_FORMAT_READY` (`schemas/placement.ts:285`); the strand keeps F-PLC-001's 40-ready minimum.

**S8. Review record.** Every sentence template keeps `reviewedBy` / `reviewedAt` (rule `placement-sentence-ready`). PV-1c runs the three-lens review (F-PLC-001 assumption 1) and the owner reads the new lines before the merge (about 70 short sentences); they join WO-27's teacher read-through batch (HR-1). PV-OD-8.

### 3.2 Item design rules: words (row PV-2; lint PV-3)

**W1. Heard words are everyday words.** Every `vocab` oral target (`hear-pick-picture`) is an entry of **grade A** of the source of §3.3, or of grade B **and** taught in Stage 2 (a whole-string match on a `ko` value of `content/episodes/stage-2/*.json`). The template carries the entry's rank as a tag, `nikl:<rank>` (e.g. `nikl:3237` is 사과05 沙果, apple, grade A; 사과08 謝過, apology, is rank 4064, grade C), so homographs graded apart (눈, 달, 배, 차, 사과, 새) are never confused. The warm-up (`pitem:warmup-rice`, 밥, `nikl:353`) is unchanged.

**W2. Heard words are concrete and pictured, one prefix per item.** A heard target is a noun with a `word:` picture; all four options of an item use `word:` (`schemas/placement.ts:247` wants one prefix per item; `card:rice` has `word:food-rice`). Verbs and requests (WO-18's 먹어요, 가요, 주세요) are not word items: 먹어요 is a sentence predicate (S5), 주세요 a reply line (S6), and 가요 has no picture that tells it from 와요 (S2) (PV-OD-7).

**W3. No look-alikes.** A heard target is not on the lint's homonym list (picturable homonyms: 눈 eye / snow, 배 pear / boat / belly, 차 tea / car, 다리 leg / bridge, 밤 night / chestnut; it grows by review). **At most one person picture per item** (엄마, 할머니, 선생님, 아빠, 할아버지, 친구, 동생, 아기 look alike at tile size). Two pictures that show the same thing or belong to each other are never offered together (the bank test's conflict list, extended to `word:` keys).

**W4. Read words decode with Stage 1.** Every `vocab` read target is made only of the 24 basic jamo and the six taught finals (unchanged); **at least two thirds** of read templates carry a `nikl:` tag of grade A or B; the rest are culture words that a Stage 1 quest shows as a reading word or card name (no 가야금: a learner who reads it but does not know the instrument fails for want of culture, not reading). No read picture shows letters (`card:hangul-day`, `word:culture-hangul` and any glyph in the lint's `TEXT_PICTURES`).

**W5. Counts.** Oral: at least **24** ready templates; read: at least **18**. The strand keeps its 40-ready minimum.

Candidate heard words for PV-2 (rank and grade from the source of §3.3, read in this row; S2 = a `ko` value in Stage 2's episodes):

| Word | NIKL rank, grade | Picture | S2 | Word | NIKL rank, grade | Picture | S2 |
|---|---|---|---|---|---|---|---|
| 물 | 165, A | `word:food-water` | yes | 학교 | 125, A | `word:school-school` | yes |
| 우유 | 2065, A | `word:food-milk` | yes | 친구 | 147, A | `word:school-friend` | yes |
| 빵 | 2130, A | `word:food-bread` | yes | 선생님 | 204, A | `word:school-teacher` | — |
| 사과 (沙果) | 3237, A | `word:food-apple` | yes | 가방 | 1530, A | `word:school-bag` | yes |
| 바나나 | 7773, A | `word:food-banana` | yes | 책 | 215, A | `word:school-book` | yes |
| 딸기 | 8053, A | `word:food-strawberry` | yes | 의자 | 2292, A | `word:school-chair` | yes |
| 김치 | 2207, A | `word:food-kimchi` | yes | 연필 | 3703, A | `word:school-pencil` | yes |
| 엄마 | 240, A | `word:family-mom` | — | 고양이 | 1987, A | `word:animal-cat` | — |
| 아빠 | 379, A | `word:family-dad` | yes | 나무 | 540, A | `word:nature-tree` | yes |
| 할머니 | 536, A | `word:family-grandma` | — | 꽃 | 470, A | `word:nature-flower` | yes |
| 할아버지 | 682, A | `word:family-grandpa` | — | 하늘 | 344, A | `word:nature-sky` | yes |
| 아기 | 615, A | `word:family-baby` | — | 공 | 988, A | `word:sport-ball` | yes |
| 손 | 185, A | `word:body-hand` | yes | 버스 | 719, A | `word:travel-bus` | — |

Words of today's heard list that may stay heard (grade A, with a `word:` glyph): 밥, 김치, 산, 바다, 달 (달05 the moon, rank 1115), 책, 한복, 김밥. Words that leave the heard list: 떡국, 송편, 호랑이, 까치, 무궁화, 윷놀이, 제기, 연, 팽이, 청자, 가야금, 한지, 붓, 먹, 종이접기, 밥상, 설날, 추석, 세배, 연등, 젓가락 (no glyph; some stay in the read form under W4). Not every grade A word is taught by the app (엄마, 할머니, 선생님, 고양이 are not Stage 2 words; 아기 and 버스 appear in no Stage 2 or 3 episode): the heard rung asks what a home learner hears, which is the point of WO-18.

### 3.3 The frequency source

**국립국어원 「한국어 학습용 어휘 목록」 (National Institute of Korean Language, *Korean Learning Vocabulary List*, May 2003)**: 5,965 words in three grades, A (982 words), B (2,111), C (2,872), each with a frequency rank, a homograph number, part of speech and a gloss. Page: https://www.korean.go.kr/front_eng/down/down_02V.do?etc_seq=70 (text, Excel and Hangul 97 files). **Licence: KOGL (공공누리) Type 1, reuse with attribution** (stated on that page; read 2026-11-25).

- Read in this row: the text file from that page (CP949, tab-separated: 순위, 단어 with its homograph number, 품사, 풀이, 등급); every word of §1.1 row 3 and of the §3.2 table graded against it.
- PV-3 commits it as `scripts/nikl-vocab-2003.json` (rank, word, homograph number, part of speech, gloss, grade; converted to UTF-8 by a small script that is part of the row), with the source URL and the KOGL Type 1 attribution in its header and a notice under `scripts/third-party-notices/licenses/`. This resolves F-CURR-002 §19 assumption 4 ("its terms are checked before it enters the repo"): `freq-coverage` reads grade A from the committed file, and the "stays outside the repo" guard (`validate-content.mjs:359-367`) and `HANGUL_ROUTE_NIKL_GRADE_A` are retired in the same row.
- Why this source (PV-OD-6): public, graded for learners, downloadable, licensed for reuse, already the source F-CURR-002 named, and its grade A is the everyday core a home learner hears.

### 3.4 The lint (row PV-3)

Every rule is written **once**: structural rules in `scripts/placement-rules.mjs` (`checkPlacementTree`, run by `validate-content.mjs`, tested in `scripts/__tests__/placement-rules.test.mjs`); a rule that needs the converter or the art lives in `packages/content-schema/src/__tests__/placement-bank.test.ts`, as today. Each violation names the rule and the template id.

| Rule | Checks |
|---|---|
| `placement-sentence-options` | S1 on every `sentence` picture template: all four options are `word:act-*` keys of three hyphen-separated parts; the right option and exactly two others share the noun slug, with three different predicate slugs; the fourth has another noun and a predicate slug none of the three has |
| `placement-sentence-family` | S5: every family row has three pictures; every `act` picture of the bank is in a family; each picture is the right option of exactly one template per form; at least ten families, five predicates, no predicate right in more than 40 % of a form's templates; every template's `word:` tag is its family's noun romanization |
| `placement-reply-echo` | S6's no-echo-win rule on every `reply-pick` template (`ECHO_STOP` and the particle list are constants of the rule, with fixtures) |
| `placement-vocab-frequency` | W1: every `vocab` oral target has one `nikl:<rank>` tag; the rank's entry in `scripts/nikl-vocab-2003.json` is that word, and is grade A, or grade B with the word in Stage 2's episodes |
| `placement-vocab-pictures` | W2 and W3: `word:` options only; not on the homonym list; at most one person picture (the `PERSON_PICTURES` list) |
| `placement-text-picture` | W4: no read-form option in `TEXT_PICTURES` |
| `placement-vocab-read-share` | W4: at least two thirds of read templates carry a grade A or B `nikl:` tag |
| `placement-decode-balanced` | §3.5 D1 on every syllable item of `syl-cv` and `syl-cvc` |
| `placement-decode-ear` | §3.5 D2 on every `hear-pick-written` item |
| `placement-pools` | S7 and W5 (mirrored in `PLACEMENT_MIN_FORMAT_READY`) |

**Landing order** (PV-OD-10): PV-3 lands **first**, with `scripts/placement-lint-baseline.json`, a list of `{ rule, templateId }` pairs that fail today. A listed pair is reported, not failed; a failing pair **not** listed fails; a listed pair that now passes, or whose template is gone, must leave the file (it only shrinks, like `eslint-suppressions.json` of AMENDMENTS-A11Y-CI). PV-1c, PV-2 and PV-6 each empty their rules' entries; PV-7 checks the file is empty and deletes it. The rules read the tag `nikl:` and `pattern:n-i-v`, which PV-1b adds to `KNOWN_TAG`; until then no template carries them.

### 3.5 Decode items consistent with the Hangul Check (row PV-6)

AMENDMENTS-STAGE1-DECODING-CHECK (#1129, WO-10) redefines the Hangul Check's decoding items. Where the level check asks the same kind of question (a written syllable or letter and its sound), PV-6 follows the same rules, **as merged** (PV-6 starts after #1129 merges):

- **D1. Balanced option sets** (DC §3.4, OD-DC5 (a)). An open syllable item (`syl-cv`) offers {CV, C′V, CV′, C′V′} (e.g. 가: 가, 나, 거, 너); a closed one (`syl-cvc`) {CVF, C′V′F, C′VF′, CV′F′}, where every pair of options differs in exactly two positions and F′ is another final (never "no final"). Both `hear-pick-written` (written options) and `see-pick-sound` (Latin chips, compared by their parts) follow it, so no option is the "middle" one. Distractor letters stay within the gate's symbols (`basic` for `syl-cv`; `basic` and `rest` initials and the six finals for `syl-cvc`).
- **D2. Heard contrasts the ear can tell apart.** In a `hear-pick-written` item no option forms with the target a pair DC §3.4 rules out by ear, including the pairs it holds back until its listening pass (ㄴ-ㄷ, ㅁ-ㅂ) and its phonology exclusions (ㅈ or ㅊ with ㅑ ㅕ ㅛ ㅠ; ㅅ against ㅈ or ㅊ before ㅣ or a y-vowel). The pairs are **one list**: a constant `EAR_RULED_OUT` in `packages/content-schema` (the first of PV-6 and DC-2b to land adds it; the other imports it), mirrored in `placement-rules.mjs` with the existing "a content-schema test compares them" check. Plain against aspirated stays in the **seen** items (`see-pick-sound`: see ㅋ, pick "ka" among "ga" …), which test the letter shape, not the ear; the aural contrast belongs to WO-16.
- **What does not carry over**: DC's "not practised" rule (a level check is taken at the start and measures what a learner already knows), its clip-per-option rule (here only the prompt is heard; the options are written) and its probe-block exclusion (the Decoding Sprint's held-out probe compares a learner's own sprints after Stage 1; a placement taken at the start does not drill it).
- **Ids.** An item whose prompt and tags do not change keeps its id (only its distractors change), so stored results keep their report examples (`report-page.ts:86-110` reads `sym:` tags through the bank) and `exclude` keeps working; a changed prompt is a new id. The overlays' option keys follow the options (`options.<optionId>.gloss`: a new distractor id gets its es and ko gloss, a removed one leaves). Every symbol of `RUNG_SYMBOLS` stays covered by at least two templates of its gate, and `PLACEMENT_MIN_FORMAT_READY` holds.
- If #1129 changes these rules in review, PV-6 follows the merged text and PV-7 updates this section.

### 3.6 Pass criteria, per strand (rows PV-1b, PV-1c)

| Strand | Gate / form | Questions | Options | Pass | Uniform guesser | Noun-only (sentences) / middle-picking (syllables) responder | Predicate-only responder |
|---|---|---|---|---|---|---|---|
| Letter shapes | `recog` | 3 | 4 | 2 of 3 | 0.156 | — | — |
| Sounds of letters | `sound-basic`, `sound-rest` | 3 | 4 | 2 of 3 (Short: none) | 0.156 | — | — |
| Reading syllables | `syl-cv`, `syl-cvc` | 3 | 4 | 2 of 3 (Short's `syl-cv` 3 of 3) | 0.156 | today 1.0; after PV-6 at chance | — |
| Words, reading | `vocab` read | 3, two draws (Standard, Deep) | 4 | 2 of 3, both draws | 0.024 | — | — |
| Words, listening | `vocab` oral | 3 | 4 | 2 of 3 | 0.156 | — | — |
| **Sentences, reading** | `sentence` read | **4** (3 pictures + 1 reply); two draws in Deep | 4, 4, 4, 3 | **3 of 4** | **0.063** (Deep 0.004) | **≤ 0.148** (Deep ≤ 0.022) | passes (intended, S1) |
| **Sentences, listening** | `sentence` oral | **4** pictures | 4 | **3 of 4** | **0.051** | **0.111** | passes (intended, S1) |

The noun-only responder picks among the three pictures of the sentence's noun (1/3) and, on a reply, among the replies that match the line (at most 1/2 under S6). 3 of 4 on (1/3, 1/3, 1/3, 1/2) is 0.148; on four pictures 0.111. A learner who knows 90 % of items passes one draw of 3 of 4 in 94.8 % of draws (2 of 3: 97.2 %; 3 of 3: 72.9 %); Deep's two read draws, 89.8 %.

**The acceptance bar** (WO-18: "명사만 읽는 봇이 … 우연 수준 이상으로 통과하지 못한다"; PV-OD-12): the noun-only responder passes a `sentence` draw **no more often than a uniform guesser passes any other route-moving gate of the check, 0.156** (F-PLC-001 assumption 2: the level of chance the check already accepts for a step that moves the route). It is above this gate's own uniform rate (0.063, 0.051) because knowing the noun is knowledge, not chance; the bar keeps a noun-only reader from passing more often than luck passes anything else. PV-1c's test computes it exactly per seeded draw (from each drawn item's structure, no sampled guesses), averaged over 2,000 seeds per mode, for both forms.

**Why four questions** (PV-OD-1): 2 of 3 lets the noun-only responder through 26 % of the time; 3 of 3 holds back a 90 % learner 27 % of the time; two draws of three in Standard would add three questions and keep a stopped second draw's pass. Four questions at 3 of 4 sets the bar at 0.69 item accuracy (2 of 3: 0.50; 3 of 3: 0.79).

**Engine changes (PV-1b).** One switch, `SENTENCE_QUESTIONS` (`rungs.ts`), is 3 in PV-1b and 4 from PV-1c; **everything below is derived from it**, so PV-1b changes no run (E-1 aside):
- `questionsFor(gate)`: `SENTENCE_QUESTIONS` for `sentence`, 3 otherwise; it replaces `QUESTIONS_PER_RUNG` in `run.ts` (rung closing `:339-341`, `drawRung` counts `:178-209`) and `scoring.ts:41` (`gateResult(responses, asked, passAt, size)` uses `size` in its fail test).
- `passAtFor(mode, gate)`: `questionsFor(gate) − 1` for `sentence` (2 at size 3, 3 at size 4), else as today; the type stays `2 | 3`.
- `questionCap`: Standard `21 + SENTENCE_QUESTIONS` (24 → 25), Deep `33 + 3 · SENTENCE_QUESTIONS` (42 → 45), the longest normal paths, so `cap` keeps labelling the longest path and `placement-rungs.test.ts:72-73` holds in PV-1b.
- The sentence read draw is `SENTENCE_QUESTIONS − 1` picture items and one reply (`run.ts:192-196`: two and one today; three and one at size 4), topped up from what is left as today. The `sentence` oral draw is built after the read draws and prefers families they did not use (a soft preference, like the fresh-key rule of second draws).
- `run-state.ts:28`: `questions: z.array(...).min(3).max(4)` (the saved run holds the open rung's questions; with `.length(3)` a run saved inside a four-question rung would fail `SavedRunSchema` and be discarded by `resumableRun`, `apps/mobile/src/logic/placement/flow.ts:579-588`, losing the resume and the "finish" path). The state's `version` stays 1: every stored state still parses.
- `KNOWN_TAG` (`schemas/placement.ts:140-141`) gains `nikl:\d+` and `pattern:n-i-v`.
- **E-1** (§1.3), a separate commit: `stepPassed(gates, gate, form)` as F-PLC-001 §3.5 states, used by `plan.ts` (`readsWords`, `:98`), `strandStatuses` and `oralStageOf`. It changes one Deep path (a `syl-cvc` confirmation that fails after a passed first `vocab` read draw now asks the oral pair, as F-PLC-001 §3.5 and §3.14 already say); its tests are the exception to "no expectation changes".
- Counts with size 4: Standard 13, 16, 19, 21, 22, 24 or 25 questions (`recog` 3 and `sound-basic` 3 always; the oral pair is now 7); Deep 13 to 45; *Always show it* 10 (`recog` 3 + oral 7; F-PLC-001 assumption 11 said 9); a screen reader's floor without `recog` 10. Short is unchanged (6 or 9). `DEEP_REST_AT` stays 18. **Worst case 48 responses**: in Deep, a `sentence` oral rung whose four prompts all fail to play is `not-run`, and `vocab` oral follows (3 + 24 + 6 + 8 + 4 + 3 = 48), exactly `responses` max 48; PV-1c tests it.
- **Time.** The longest Standard path gains one sentence question and the action pictures take longer to scan. The Standard backstop stays 10 minutes (PV-OD-11); PV-1c re-runs `placement-modes-simulation.test.ts` with the time model's sentence picture items 2 s slower (read 16 s, heard 13 s) and keeps its bound (Standard p90 at most 10 minutes at the *Some reading* pace). A run that ends with `time` before the sentence rung is placed at `stage2`, the conservative side.

### 3.7 Stored data and a changed bank (rows PV-1b, PV-1c, PV-2, PV-6, PV-4)

- **Schema.** `GateResultSchema.asked`, `.correct`, `.assisted` go from max 3 to **max 4** (`schemas/placement.ts:32-34`), and the run state's rung from exactly 3 to 3 or 4 questions (§3.6). Every stored result and run state still parses (a superset). `responses` max 48 and `gates` max 16 hold (Deep's longest normal run is 45 responses and 14 rows; the worst case is 48, §3.6).
- **Worker first.** An older Worker answers 422 to a snapshot PUT whose `placements` hold a row with `asked: 4`, which would stop all progress sync for that learner (the P-3b lesson, F-PLC-001 §3.8). So the Worker carrying PV-1b's schema is deployed **before** the app build that carries PV-1c, and is never rolled back past PV-1b once PV-1c has shipped (PV-1b's PR body and the deploy note say so). `packages/backend/src/__tests__/sync.test.ts` round-trips a result with a four-question sentence row; 5 is a 422.
- **Older readers.** With size 4 every Standard result on the 13, 16, 19, 22 and 25 paths holds a four-question row (the oral or the read sentence rung); only the 21 and 24 paths (which end with `vocab` oral) still parse with the pre-change schema. So F-PLC-001 §3.8's "every Short and Standard result also parses with the pre-change schema" ends with PV-1c: Short results still do; Standard and Deep results usually do not. Older builds reject them in a backup file or a server snapshot. The PWA updates itself. The owner decision of 2026-10-14 rested on "no native build has been released to any store or to TestFlight"; PV-1b's PR re-checks that fact (F-AUTH-004's native rows came after it) and, if any store or TestFlight build without PV-1b's schema has shipped, PV-1c waits until a build carrying it has shipped one release earlier. Tests that pin the old fact change in PV-1c: `placement-schema.test.ts` (the frozen-schema cases), `placement-modes-simulation.test.ts` (its old-schema parse share), recorded as the new expectation.
- **Results already stored** (devices, server snapshots, backups, `summary.placement`): kept as they are. Results combine by the maximum (F-PLC-001 §3.7, P20) and D10 forbids moving the route backwards, so an old result whose noun-only sentence pass placed out Stage 2 keeps doing so. The parent report says so in one plain line and points at the existing **Choose a different start** (§3.8; PV-OD-3). The placed-out Stage 2 quests stay playable and award normally.
- **Bank version.** `content/placement/index.json` `version` goes from 1 to 2 in the first content row that changes a ready template, and up by one in each later content row. A run saved under an older version is discarded silently on reopening (F-PLC-001 §3.1 step 8): a learner mid-check when the app updates starts again. The previous result's `exclude` ids that are gone match nothing.
- **Report lookups.** `bankLookup` skips ids not in the bank (`report-page.ts:36-47`): an old result's retired sentence and word ids were never used for examples or the tiles line, and PV-6 keeps decode ids (§3.5), so old reports keep their examples.
- **Overlays and sound.** Every new template's `gloss` and `options.<id>.gloss` land in `content/i18n/{es,ko}/placement.json` in the same PR, reviewed by the F-I18N-001 §3.10 multi-agent review (es and ko are shipped locales); retired ids leave. New prompts get `placement`-pack rows in `content/audio/tts-manifest.json` (`--dry-run` by the agent, the owner's generate step, AMENDMENTS-AUDIO-CLIPS §7); until a clip exists the device voice speaks, as today (F-PLC-001 §3.11 (f)).

### 3.8 The caregiver report says reading and listening apart (row PV-4)

Wireframe: `design/wireframes/placement/report.md`, section "[PV] Reading and listening". The learner's result screen does not change (no levels or counts on learner screens).

1. **A "Reading and listening" block** opens "What we saw" (which reads the newest result; the header line above it keeps showing the route's level):
   - **Reading**: the band label of the newest result's level (`bandLabel`, the words the result screen uses: "Letters and sounds", "Reading words" …); "not checked" when its decoding strands are `not-tested` (the existing reason line follows).
   - **Listening**: from the newest result's `oralStage`, said as what happened in this check: `stage3` "Understood the short sentences we said", `stage2` "Knew most of the everyday words we said", `stage1` "Everyday words: new for now", `null` "not checked" (the existing reason line follows: no sound, the short check, a screen reader with Korean pictures).
   - When that listening stage is above that reading stage: one line, "In this check, {name} understood more Korean than {name} could read. That is common." It never says "behind", "only", "can't", "fail" or a number, and it does not speak about the route (an older, higher result may set it).
2. **Words and Sentences show each form.** Their row shows one status word per form that ran: "reading: getting there · listening: secure" (the `form` labels and status words already in `caregiver.placementReport`), with `rungStatus` (`result-view.ts:252-256`) using `stepPassed` per form (E-1). A form that did not run is left out of the row. The merged strand status (`result.strands`) stays the stored and synced value; only this row's display splits it. The per-rung captions stay ("Sentences, listening: 4 of 4").
3. **An older sentence part** (§3.7): when the route's level is `stage3` and the result that reached it has `bankVersion` 1 with a passed `sentence` read row: "An earlier version of the check asked easier sentence questions. If Stage 3 feels hard, choose a different start." next to **Choose a different start**. No other change, no retake push.
4. **Strings** (English; Pre-A1, caregiver surface, may address the parent; no age words, no shame words):

   | Key | English |
   |---|---|
   | `caregiver.placementReport.skills.title` | Reading and listening |
   | `caregiver.placementReport.skills.reading` / `.listening` | Reading / Listening |
   | `caregiver.placementReport.skills.notChecked` | not checked |
   | `caregiver.placementReport.listening.stage1` / `.stage2` / `.stage3` | Everyday words: new for now / Knew most of the everyday words we said / Understood the short sentences we said |
   | `caregiver.placementReport.skills.ahead(name)` | In this check, {name} understood more Korean than {name} could read. That is common. |
   | `caregiver.placementReport.formStatus(form, status)` | {form}: {status} |
   | `caregiver.placementReport.olderSentences` | An earlier version of the check asked easier sentence questions. If Stage 3 feels hard, choose a different start. |

   es and ko values ship in PV-4 with the F-I18N-001 §3.10 review and a re-signed `review-ledger.json`.
5. **Not changed**: the dashboard's Starting spot row, the console roster line, `summary.placement`, F-REPORT-001's reports. Showing listening there is a later step (the summary already carries `oralStage`).

### 3.9 Behaviours (Given / When / Then)

- **Given** the bank after PV-1c, **when** a responder that reads only the noun answers every `sentence` item, **then** over 2,000 seeded draws per mode it passes the read rung and the oral rung each in at most 15.6 % of draws, and is placed at `stage3` no more often than that.
- **Given** a learner who knows 90 % of sentence items, **then** one `sentence` read draw passes in at least 90 % of draws (Standard), and Deep's two draws in at least 88 %.
- **Given** a responder that picks the most typical action of the noun, or the picture that shares most with the others, **then** it does no better than the noun-only responder.
- **Given** a sentence picture item, **then** it has the S1 shape, and `placement-sentence-options` names the template if not.
- **Given** a reply item whose right reply alone matches a word of the line, **then** `placement-reply-echo` fails it.
- **Given** a heard word item, **then** its target's `nikl:` entry is that word, grade A (or B and taught in Stage 2), not on the homonym list, with at most one person picture among the options.
- **Given** a syllable item after PV-6, **then** no option is the unique "middle" option, and a middle-picking responder is at chance.
- **Given** a heard decode item after PV-6, **then** no option forms a pair of `EAR_RULED_OUT` with the target.
- **Given** a Standard run that reads through sentences, **then** it asks 25 questions and ends `cap`; **given** one that fails `sound-basic`, **then** it asks 13.
- **Given** a run saved inside a four-question sentence rung, **when** it is reopened within 24 hours, **then** Continue resumes it at the same question, and finish works.
- **Given** a stored result from bank version 1 with three-question rows, **then** it parses, keeps its level and placed-out set, and its report renders.
- **Given** a heritage child who passes `vocab` oral and `sentence` oral but not `syl-cv`, **then** the report's block reads "Reading: At the beginning" and "Listening: Understood the short sentences we said" with the "understood more … than … could read" line, the Words and Sentences rows read "listening: secure" (and their reading form, when it ran), and the route starts at Stage 1 quest 1.
- **Given** a route at `stage3` from a bank version 1 sentence pass, **then** the report shows the older-sentences line next to Choose a different start.

## 4. Out of scope

- **PV-5, a "literacy focus" route for strong listeners who do not read yet**: split out (PV-OD-5). The planner's existing `focus: 'reading'` (`propose.ts:203-216`) stays as it is.
- Changing the route from listening, the conservative start, "I am not sure", the Short mode's design, the result screen.
- New art beyond the action pictures of PV-1a (word pictures exist).
- The console roster, the dashboard row and F-REPORT-001 showing listening (§3.8 item 5); telemetry (no field added; item analyses split banks by the release date).
- Re-scoring stored results (§3.7, PV-OD-3).
- WO-16's aural plain/aspirated training; WO-20's other 천만에요 uses; WO-27's human review itself.
- A statistical item model (IRT); recalibration after about 200 runs per level stays as F-PLC-001 §4 says.

## 5. UI sketch

- `design/wireframes/placement/report.md` — section "[PV] Reading and listening" (this row).
- Action pictures: PV-1a's contact sheet on `/design-preview/word-art` (F-VOC-002 §3.10) and a section of `design/brief/illustrations/word-art.md`. WO-18 asks new art demand to follow `scripts/art-demand.mjs`; that script reads story scene briefs only (`content/stories/*.json`), so PV-1a follows its flow by hand: the family table is the brief, the registry check lists the missing `act` keys in the PR, then the drawing and the review. The item screen is unchanged (the same 2 × 2 picture grid).
- PV-4 adds its as-built note and screenshots to `design/screens/placement/flow.md`.

## 6. Tests

| File | Level | Row | Coverage |
|---|---|---|---|
| `scripts/__tests__/placement-rules.test.mjs` (extend) | unit | PV-3 | every rule of §3.4 on a passing and a failing fixture; the baseline only shrinks (a fixed pair still listed fails; a new failing pair fails) |
| `scripts/__tests__/validate-content.test.mjs` (extend) | unit | PV-3 | `freq-coverage` reads `scripts/nikl-vocab-2003.json`; the guard is gone |
| `packages/content-schema/src/__tests__/placement-bank.test.ts` (extend; its pinned counts change: 260 ready `:102`, patterns `:431-434`, `reviewedAt` `:105-108`) | content | PV-3, PV-1c, PV-2, PV-6 | the §3.4 rules that need the converter or the art; family spread per draw; the conflict list over `word:` keys |
| `…/placement-bank-schema.test.ts` (extend) | unit | PV-1b | S7 and W5 pools in `PLACEMENT_MIN_FORMAT_READY`; the new tags in `KNOWN_TAG` |
| `…/placement-scoring.test.ts` (extend) | unit | PV-1b | `gateResult` with `size` 4 (pass at 3, fail once 3 cannot be reached, not-run); `stepPassed` truth table; `strandStatuses` and `oralStageOf` through it |
| `…/placement-rungs.test.ts`, `…/placement-plan.test.ts`, `…/placement-run.test.ts` (extend) | unit | PV-1b, PV-1c | `questionsFor`, `passAtFor`, `questionCap` derived from `SENTENCE_QUESTIONS`; at 3 every existing expectation unchanged except E-1's Deep path (PV-1b); at 4 (PV-1c): Standard 13, 16, 19, 21, 22, 24, 25, Deep up to 45, the 48 worst case, `cap` only on the longest paths, *Always show it* 10; the read draw is three pictures and one reply; the oral draw prefers unused families; resume equality inside a four-question rung |
| `…/placement-schema.test.ts` (extend) | unit | PV-1b, PV-1c | bounds 4; run-state rung 3 or 4; a stored v1 result parses; the frozen schema rejects a four-question row (recorded) |
| `…/placement-bank-modes.test.ts` (`:125`), `…/placement-simulated.test.ts`, `…/placement-modes-simulation.test.ts` (extend) | integration | PV-1c, PV-6 | the noun-only, typical-action and middle-picking responders (exact per draw, §3.6) at most 0.156 per sentence form; the middle-picking responder at chance on syllable gates (PV-6); a 0.9 learner per §3.9; Standard p90 at most 10 minutes; question ranges 13-25 / 13-45; every existing guesser bound kept |
| `packages/backend/src/__tests__/sync.test.ts` (extend) | integration | PV-1b | a four-question sentence row round-trips; 5 is a 422 |
| `apps/mobile/src/logic/placement/__tests__/flow.test.ts` (extend) | unit | PV-1b | a saved run inside a four-question rung is resumable and finishable |
| `apps/mobile/src/logic/placement/__tests__/result-view.test.ts`, `report-page.test.ts` (extend) | unit, 100 % | PV-4 | the block (each `oralStage`, reading not checked, the ahead line only when listening is above reading), per-form rows with `stepPassed`, the older-sentences line (only for a `stage3` route from a version 1 sentence pass) |
| `packages/i18n` copy and ledger tests | unit | PV-4, PV-1c, PV-2, PV-6 | the new `caregiver.placementReport` strings in en, es, ko: no banned word, no age word, no "behind", "only", "fail", "can't"; es and ko reviewed and signed |
| `apps/mobile/e2e/web/placement.spec.ts` (extend) | e2e | PV-4 | the report block for a heritage-listener fixture result; 320 × 568 and 200 % text |
| `packages/design-system/src/word-art/__tests__/registry.test.ts`, `registry-lessons.test.ts` and the budget test (extend) | unit | PV-1a | the `act` family: `WORD_ART_PLAN.act = 0`, key grammar, every key `reserved`, the `HAND` source list, tones, bbox, budget (F-VOC-002 §3.8) |

Commands each implementing row runs and pastes: `pnpm --filter @hangul-route/content-schema test`, `node scripts/validate-content.mjs`, `node --test scripts/__tests__/placement-rules.test.mjs`, `node scripts/build-placement-bank.mjs --check`, `pnpm --filter @hangul-route/mobile test`, `pnpm --filter @hangul-route/i18n test`, `node scripts/check-i18n.mjs`, and for PV-1b `pnpm --filter @hangul-route/backend test`, for PV-1a `pnpm --filter @hangul-route/design-system test`.

## 7. Rollout

- Order: PV-3 (lint with baseline) → PV-1a (art) and PV-1b (engine; Worker deploy) in parallel → PV-1c (sentences; four questions on) → PV-2 (words) → PV-6 (after #1129 merges) → PV-4 (report; any time after PV-1b, its older-sentences line keyed on `bankVersion`) → PV-7.
- No flag: the bank is data and the report change is additive; `flags.placementEnabled` stays the kill switch.
- What to watch (existing telemetry, split by release date): share of Standard runs reaching `stage3` before and after PV-1c; the `sentence` read pass rate; how often the report's Choose a different start is used after the older-sentences line.

## 8. Dependencies

- F-PLC-001 (and its applied amendments THREE-MODES and PLAN-HANDOFF, whose numbers §3.6 updates), F-VOC-002 (WordArt builders, registry, budget), F-CURR-002 (`freq-coverage`), F-I18N-001 §3.10 (es and ko review), AMENDMENTS-AUDIO-CLIPS §7 (new clips).
- **#1129** (`AMENDMENTS-STAGE1-DECODING-CHECK.md`, open) for PV-6's rules and `EAR_RULED_OUT`.
- WO-20 item 3 (천만에요) and WO-27 HR-1 (the review batch includes the new placement items).
- Same files as most UI work orders: `packages/i18n/src/messages/en/caregiver.ts` (README §6: mechanical rebases).

## 9. Rows

| Row | Model | What | Files | Tests | Acceptance |
|---|---|---|---|---|---|
| **PV-0** | Opus 5.5 | this spec; the "[PV] Reading and listening" section of the report wireframe; the "Amended" lines in F-PLC-001, F-VOC-002 and F-CURR-002; the index line | docs only | — | multi-agent review done (§11); status `ready` |
| **PV-3** | Sonnet 5.5 | `ci(content)`: the lint of §3.4 with its shrinking baseline; `scripts/nikl-vocab-2003.json` from the source of §3.3 with its notice; `freq-coverage` reads it and its guard goes | `scripts/placement-rules.mjs`, `scripts/__tests__/placement-rules.test.mjs`, `scripts/validate-content.mjs`, `scripts/__tests__/validate-content.test.mjs`, `scripts/nikl-vocab-2003.json`, `scripts/placement-lint-baseline.json`, `scripts/third-party-notices/licenses/`, `packages/content-schema/src/__tests__/placement-bank.test.ts` | §6 PV-3 rows | today's bank passes with the baseline listing exactly today's failures, counted per rule in the PR body (expected: all 44 sentence picture items and the family rule, about 6 replies, all 29 heard words (no `nikl:` tag yet), 60 syllable items, 26 heard decode items). **Built 2026-11-25 on `ci/placement-lint`**: the ten rules of §3.4 in `scripts/placement-rules.mjs` (`lintPlacementTree`, `checkPlacementLint`; `index.json` `families` is accepted by `checkPlacementTree`), `scripts/placement-lint-baseline.json` listing today's 200 findings (decode-balanced 60, decode-ear 29, pools 2, reply-echo 5, sentence-family 1, sentence-options 44, vocab-frequency 29, vocab-pictures 29, vocab-read-share 1; `placement-text-picture` 0), `scripts/nikl-vocab-2003.json` (5,965 words) with `scripts/build-nikl-vocab.mjs` and the notice `scripts/third-party-notices/licenses/NIKL-KOGL-Type1.txt`, `freq-coverage` reading it with the guard and `HANGUL_ROUTE_NIKL_GRADE_A` gone. Counts that differ from the expectation: reply-echo 5 (the rule as written passes 안녕하세요!, whose wrong reply 안녕히 계세요. also repeats a word), decode-ear 29 (D2 as written also rules out the held-back ㄴ-ㄷ and ㅁ-ㅂ and the ㅅ and y-vowel exclusions: 26 plus 3), pools 2 (both sentence picture pools at 22 of 24), and sentence-family reports the bank once while no families file exists |
| **PV-1a** | Opus 5.5 | design pass: the action pictures of S3 and S5 (at least ten families of three), drawn with the WordArt builders as the `act` family, every key `reserved`; the brief section; contact sheet; multi-agent design review | `packages/design-system/src/word-art/glyphs/act.ts` (new), `registry.ts` (family, `WORD_ART_PLAN.act = 0`, `HAND`), `types.ts`, their tests, `design/brief/illustrations/word-art.md` | §6 PV-1a row | each picture shows one action a reviewer names without the sentence; review approves; budget numbers in the PR (if the start bundle grows, `act` glyphs load with the placement chunk). **Built 2026-11-26 on `design/word-art-act`**: 30 pictures, ten families of three (bear, tiger, puppy: run, swim, sleep; rabbit, cat, monkey: run, eat, sleep; bird: fly, eat, sleep; duck: swim, fly, sleep; sibling, friend: run, swim, eat), keys `act-<run|swim|sleep|eat|fly>-<noun>`, the family table `ACT_FAMILIES` / `ACT_KEYS` in `registry.ts`, every key `reserved` (`review`), `WORD_ART_PLAN.act = 0`; brief §10 of `design/brief/illustrations/word-art.md` with the review record; sheets `design/components/WordArt/pv1a-review.png` and `pv1a-blind.png`. Review: a blind "name the action" test in four rounds (each round a fresh reviewer with the unlabelled sheet; misnamed pictures redrawn: the swims read as a bath or as waving, the cat's fish and the monkey's banana as held, not eaten), round 4 named all 30 actions; visual consistency and engineering approved with fixes, made. Where it reads the spec differently: (1) the glyphs are not in `HAND`: with them there the start bundle would have grown about 9 KB over its line, so, as this cell says, they load with the placement chunk (`screens/placement/placement-chunk.tsx` calls `loadActWordArt()`, which hands them to the registry's `addWordArt`; the start bundle keeps only the names, and `PictureArt`'s `PICTURE_CONTEXT` lists them); (2) S3's "eating from a bowl" is a bowl for the people and food held at the mouth for the animals (the blind review read that more surely). Budget (release `build:web`, CI=1, on 46f721b2e): start bundle 4,562,459 → 4,563,710 B raw (+1,251: the names and the hand-over; line 4,565,800 unchanged), placement chunk 48,818 → 59,225 B (screen-chunk ceiling 60,000: 775 B left for PV-1c), learner precache 11,064,610 → 11,076,268 B; W7 source 158,239 / 47,056 → 182,330 / 54,391 B, so W7 moves to 184 / 56 KB (§8.1 (b); F-VOC-002's W7 lines are left for PV-7). `/design-preview/word-art` lists the start registry only, so the PNG sheets are this family's review surface |
| **PV-1b** | Sonnet 5.5 | `feat(content-schema,backend)`: `SENTENCE_QUESTIONS = 3` and everything derived from it (§3.6), the oral draw's family preference, run-state 3 or 4, bounds 4, `KNOWN_TAG`, and (own commit) `stepPassed` (E-1). **Deploy the Worker**; re-check the native-build fact (§3.7) | `placement/{rungs,run,run-state,scoring,plan}.ts`, `schemas/placement.ts`, their tests, `apps/mobile/src/logic/placement/__tests__/flow.test.ts`, backend sync test | §6 PV-1b rows | no expectation changes except E-1's Deep path; Worker deployed and stated in the PR. **Built 2026-11-25 on `feat/placement-validity-engine`** (two commits: E-1 first, then the switch): `rungs.ts` (`SENTENCE_QUESTIONS = 3`, `questionsFor`, `passAtFor(mode, gate, size)`, `questionCap(mode, n)`, `MAIN_STEPS`), `scoring.ts` (`stepPassed`, `gateResult(..., size)`), `plan.ts` (`readsWords` through `stepPassed`), `run.ts` (the draw's size, the sentence read draw `size - 1` pictures + 1 reply, the Deep oral draw's soft preference for nouns the read draws did not use), `run-state.ts` (`.min(3).max(4)`), `schemas/placement.ts` (`GateResultSchema` counts max 4, `KNOWN_TAG` takes `nikl:\d+` and `pattern:n-i-v`). Where it reads the spec a little differently: (1) a rung closes after the number of questions it was *built with* (`current.questions.length`), not after the switch, so a run saved by an older build resumes and finishes at its own size (a three-question rung at 2 of 3, a four-question rung at 3 of 4), in either direction; (2) the oral preference applies in Deep only (the only mode that asks a sentence read draw and then `sentence` oral in one run), so Short and Standard draws are byte-identical to before, and Deep's `sentence` oral draw on today's bank is not (it now avoids the nouns of the read draws: the one change besides E-1); (3) the S7 and W5 per-format pools are not added to `PLACEMENT_MIN_FORMAT_READY` here: today's bank holds 22 of 24 sentence read pictures, so the pools land with PV-1c and PV-2 and their content (the `placement-pools` lint rule keeps them in the baseline until then); (4) the engine rules at four are tested by `placement-run-four.test.ts`, which raises the switch for every importer of `rungs.ts` (a module mock), so PV-1c only changes the constant. Native-build fact (§3.7) re-checked in the repo: `docs/launch/owner-runbook.md` and the 2026-10-14 review log of `AMENDMENTS-PLC-PLAN-HANDOFF.md` record no store or TestFlight build, `docs/tasks/INBOX.md` T-042 (first TestFlight build) is still open, and no later commit says otherwise; the repo cannot prove what the owner's App Store Connect holds, so the owner confirms it before PV-1c merges. Deploy order: Workers Builds deploys the API Worker on the merge of this PR, and nothing in this PR writes a four-question row, so the order inside this merge is safe; PV-1c merges only after that Worker is live |
| **PV-1c** | Opus 5.5 | `content(placement)`: the sentence bank (S1-S8) with PV-1a's pictures and `sentence-families.json`, replies reworked, `N-이에요` retired, `SENTENCE_QUESTIONS = 4`, bank version bumped, simulations; es and ko overlays reviewed; manifest rows; the owner reads the new lines | `content/placement/{sentences,sentence-families,index}.json`, `content/i18n/{es,ko}/placement.json`, `content/audio/tts-manifest.json`, `placement.generated.ts`, `rungs.ts` (one line), `placement-bank*.test.ts`, simulation and schema tests | §6 PV-1c rows | §3.6 bar met; the sentence entries gone from the baseline |
| **PV-2** | Opus 5.5 | `content(placement)`: heard words (W1-W3, W5) and read words (W4) with `word:` pictures and `nikl:` tags; the §3.2 table completed; es and ko overlays reviewed; manifest rows | `content/placement/{vocabulary,index}.json`, overlays, `tts-manifest.json`, `placement.generated.ts`, `placement-bank.test.ts` conflict list | §6 rows | word entries gone from the baseline; every mode's word draw holds at least 3 heard words besides 밥 |
| **PV-6** | Opus 5.5 | `content(placement)`: decode items to D1 and D2 (after #1129 merges), ids kept where the prompt is unchanged, `EAR_RULED_OUT` | `content/placement/{syllable-reading,sound-letter,index}.json`, overlays, `placement.generated.ts`, `packages/content-schema` (the constant, if first), `scripts/placement-rules.mjs` mirror | §6 rows | decode entries gone from the baseline; middle-picking responder at chance |
| **PV-4** | Sonnet 5.5 | `feat(mobile,i18n)`: the report block, per-form rows with `stepPassed`, the older-sentences line, strings in en, es, ko (reviewed, ledger re-signed), as-built note | `logic/placement/{result-view,report-page}.ts` and tests, `screens/parent/PlacementReportScreen.tsx`, `packages/i18n/src/messages/{en,es,ko}/caregiver.ts`, `review-ledger.json`, `e2e/web/placement.spec.ts`, `design/screens/placement/flow.md` | §6 PV-4 rows; screenshots | the heritage-listener behaviour of §3.9 on screen; no learner screen changed |
| **PV-7** | Sonnet 5.5 | `docs(specs)`: close: fold the as-built numbers into F-PLC-001 (§3.4, §3.5, §3.6, §3.8, §3.9, §3.12, §5, assumptions 1, 2, 11, 12, appendices A, C, D, the comment at `schemas/placement.ts:80-82`), empty and delete the lint baseline, row PR numbers here and in the index, status `shipped` | this file, F-PLC-001, `docs/specs/README.md` | — | the docs say what main does |

PV-5 is not a row of this spec (PV-OD-5).

## 10. Open decisions (each adopted, as recommended; the owner asked to proceed with the recommendations)

- **PV-OD-1 — the sentence gate's size and bar.** (a) Four questions, pass at 3 of 4, both forms (§3.6). (b) Three at 3 of 3 (no schema change; holds back a 90 % learner 27 % of the time). (c) Two draws of three in Standard (no schema change; +3 questions; a stopped second draw keeps the first pass). (d) Keep 2 of 3 with all three distractors of the same noun (needs four exclusive pictures per noun; the noun-only responder still passes 15.6 %). **Recommendation: (a)**, WO-18's proposal and the only option that meets the bar while keeping strong listeners. Adopted.
- **PV-OD-2 — where the action pictures live.** (a) A new WordArt family `act`, keys `reserved`, drawn with the existing builders. (b) Story scene art (`scene:` / `prop:`): landscape scenes, not 2 × 2 tiles, and `PictureRefSchema` does not take them. (c) No picture items for sentences (replies only): too few templates and no oral form. **Recommendation: (a)**. Adopted.
- **PV-OD-3 — results already stored with a noun-only sentence pass.** (a) Keep, say nothing. (b) Re-score them (moves routes backwards: against D10 and P20). (c) Keep, and the report says so in one line next to Choose a different start. **Recommendation: (c)**. Adopted.
- **PV-OD-4 — the decode strand (§1.3).** (a) Row PV-6 here, after #1129. (b) A later spec. **Recommendation: (a)**: the same validity problem on route-moving gates, the same lint, one list of ruled-out pairs. Adopted.
- **PV-OD-5 — PV-5, the "literacy focus" path.** (a) Keep it here as an optional row. (b) Split it into its own spec, with the "known words → letters" heritage path that phase 2 defers ("이 Phase 에 넣지 않은 것"). **Recommendation: (b)**: it is a new route feature with its own content and planner rules; the planner already turns to `focus: 'reading'` when listening is two stages above reading (`propose.ts:203-216`); PV-4 gives the parent the information now. Whether that gap should become one stage once PV-1c makes the listening level trustworthy belongs to that spec. Adopted.
- **PV-OD-6 — the frequency source.** (a) NIKL 2003 학습용 어휘 목록, grade A, or B when Stage 2 teaches it. (b) The 국제 통용 한국어 표준 교육과정 vocabulary. (c) A corpus frequency list. **Recommendation: (a)**: graded for learners, public, KOGL Type 1, already named by F-CURR-002. Adopted.
- **PV-OD-7 — verbs as word items.** (a) Nouns only; 먹어요 is a sentence predicate, 주세요 a reply line, 가요 left out (no picture tells it from 와요). (b) Verb word items with PV-1a's pictures. **Recommendation: (a)**. Adopted.
- **PV-OD-8 — language review.** (a) Three-lens review, the owner reads the new lines before PV-1c and PV-2 merge, and the items join WO-27's teacher batch. (b) Wait for WO-27. **Recommendation: (a)**. Adopted.
- **PV-OD-9 — E-1.** (a) Implement `stepPassed` in PV-1b, planner included. (b) Remove it from F-PLC-001. **Recommendation: (a)**: the spec's rule is right, and PV-4 must not overstate an unconfirmed row or print a listening level from a path that asked no heard word. Adopted.
- **PV-OD-10 — the lint's landing order.** (a) First, with a shrinking baseline. (b) Last, after the content. **Recommendation: (a)**. Adopted.
- **PV-OD-11 — the Standard backstop.** (a) Keep 10 minutes; PV-1c re-measures. (b) 11 minutes. **Recommendation: (a)**: a timed-out strong reader is placed at `stage2`, the safe side, and "Usually under 10 minutes" stays true. Adopted.
- **PV-OD-12 — what "chance" means in WO-18's acceptance line.** (a) The guess rate the check accepts for any route-moving gate, 0.156. (b) This gate's own uniform rate (0.063 read, 0.051 oral): no noun-only responder could meet it, because knowing the noun narrows four pictures to three. (c) About 5 %, WO-18's figure for a uniform guesser at 3 of 4. **Recommendation: (a)**, with the responder's rates published in §3.6. Adopted.

## 11. Review log

- 2026-11-25, PV-0: written on `803208a95`.
- 2026-11-25, multi-agent review (two independent reviewers: assessment validity and Korean pedagogy; engineering against the placement code and content). Confirmed: every probability of §3.6, the bank counts of §1.1 and §1.3, the Standard and Deep question counts, the citations (with small line drift, fixed), the template's eight sections. Applied:
  - S1: the fourth picture shares neither the noun nor any of the item's predicates, so no picture is the "middle" one; the predicate-only responder is stated as intended, with its reason;
  - S2, S4, S5: families of three plausible, taught predicates (no "토끼가 날아요" as a right answer; no 바구니에 넣어요, no food-throwing, no 공을 넣어요); each picture right exactly once per form; ten families, oral draws avoid the read draws' families (Deep pre-exposure); the family table and hyphen-free slugs make the lint well defined;
  - S6: the echo rule by words, not syllables, with the copula and particles ignored; wrong replies wrong in every context; 아니에요 never a distractor of a yes/no line; 주세요 as a reply line;
  - W1-W4: `nikl:<rank>` tags for homographs, ranks in the table, one picture prefix per item, at most one person picture, read-form culture words limited to Stage 1's, the "app teaches every heard word" claim removed;
  - D2: one shared `EAR_RULED_OUT` list including DC's held-back pairs and phonology exclusions;
  - §3.6 / §3.7: `run-state.ts` rung of 3 or 4 (resume and finish), every engine number derived from one switch so PV-1b is neutral, `KNOWN_TAG`, E-1 in the planner too, the 48-response worst case, the old-reader impact stated plainly, telemetry addition dropped (it would have changed the privacy text);
  - §3.3: the licence checked (KOGL Type 1), F-CURR-002 §19 assumption 4 amended and `freq-coverage`'s guard retired in PV-3;
  - §3.4: rules in `scripts/placement-rules.mjs`, written once, baseline keyed by rule and template id;
  - §3.8: listening words say what happened in this check; the ahead line no longer speaks about the route;
  - §3.9: Deep's two-draw rate (89.8 %) and the acceptance per draw;
  - PV-OD-12 added; missing files added to the rows (run-state, flow test, bank and modes tests, overlays of PV-6, manifest rows, WordArt tests); `art-demand.mjs` addressed (§5).
