# AMENDMENTS-ROMANIZER-GAPS — the romanization lint stops freezing the converter's wrong answers

Status: **ready** (row RG-0 of work order WO-17, `docs/roadmap/review-2026-11/phase-2-hangul.md`; revision 2 after the two-lens multi-agent review, §10). Open decisions OD-RG1 to OD-RG6 (§9) are adopted provisionally as recommended until the owner confirms them. Every `file:line` below is at `origin/main` `8676b5de5`.

**Owner decision 2026-11-25**: the open decisions OD-RG1 to OD-RG6 (OD-RG1: option (a), a 하다 predicate is romanized with the aspirate, RR 제3장 제1항 4) are approved as recommended ("권고대로 진행해줘"); they are no longer provisional.

**Amends**: F-CNT-002 §3.2 (converter algorithm, known limits, golden vectors), §3.3 (checker rules R1 and R8, the exceptions list, decision C7), §5 (tests) · tag **[RG]**
**Not amended**: F-CNT-002 §3.1 (the policy: Revised Romanization, pronunciation-based, unhyphenated; this amendment applies it more exactly, it does not change it), §3.4 (what is scanned), C3/C4/C8.
**Scope**: `packages/content-schema/src/romanization/{rr.ts,compare.ts,exceptions.ts}`, `packages/content-schema/src/romanization/gaps.ts` (new), `packages/content-schema/src/__tests__/romanization-{rr,compare,gaps}.test.ts`, `packages/content-schema/src/romanization/reviewed.ts` (new), the build step, run-time call sites and tests listed in §3.3 (row RG-2a), `packages/content-schema/src/lesson-lint-items.ts`, the test files and data strings listed in §6 and §3.7 (row RG-2b), `docs/specs/F-CNT-002-romanization-policy.md` (row RG-3). No UI string, schema shape, Worker or migration change.
**Owner**: solo dev
**Rollout**: content tooling, no flag (§7)

---

## 1. Context

F-CNT-002 made every stored romanization equal to the output of a rule-based converter (`packages/content-schema/src/romanization/rr.ts`), with a short reviewed escape hatch (`ROMANIZATION_EXCEPTIONS`, decision C7). The weak spot: where the converter is wrong, the lint *forces* the wrong value, because an author who types the right one gets `romanization-mismatch` and the path of least resistance is to copy the converter.

### 1.1 The work order's citations, re-checked

**Converter outputs (measured).** A throwaway `npx tsx` script (scratch area, not committed) imported `romanizeWord` / `syllableSplit` from `rr.ts` at `8676b5de5`:

| Word | Converter output | Syllable split | Standard pronunciation | Correct RR |
|---|---|---|---|---|
| 읽고 | `ikgo` | ik-go | [일꼬] | `ilgo` |
| 맑게 | `makge` | mak-ge | [말께] | `malge` |
| 깻잎 | `kkaesip` | kkae-sip | [깬닙] | `kkaennip` |
| 색연필 | `saegyeonpil` | sae-gyeon-pil | [생년필] | `saengnyeonpil` |
| 서울역 | `seouryeok` | seo-u-ryeok | [서울력] | `seoullyeok` |
| 맛없어요 | `maseopseoyo` | ma-seop-seo-yo | [마덥써요] | `madeopseoyo` |
| 첫인상 | `cheosinsang` | cheo-sin-sang | [처딘상] (see §1.3, item 6) | `cheodinsang` |
| 못해요 | `mothaeyo` | mot-hae-yo | [모태요] | `motaeyo` |
| 좁히다 | `jophida` | jop-hi-da | [조피다] | `jopida` |

All nine outputs in the work order are **reproduced exactly**.

**Where the lint lives.** Rule R1 `romanization-mismatch` is `packages/content-schema/src/romanization/compare.ts:113-133` (`romanize(ko)` at `:113`, the comparison at `:124`, `isAllowed` at `:158-161`, a whole-string match on `exception.ko`). It runs from about 35 call sites; the ones that read shipped data are `packages/content-schema/src/__tests__/helpers/romanization-json-scan.ts:125,128` (every `content/**/*.json`, class A), `packages/content-schema/src/__tests__/helpers/vocab-rules.ts:146,187`, `packages/content-schema/src/__tests__/placement-bank.test.ts:171`, `apps/mobile/src/content/__tests__/romanization.test.ts:51,58,216` (lesson chunks, cards, scopes), `apps/web/src/data/__tests__/romanization.test.ts:25` and `apps/web/src/__tests__/romanization-sources.test.ts:29`. About a dozen other suites call `checkRomanization(ko, given)` **without** the exceptions list (for example `apps/mobile/src/content/__tests__/upper-cell-cards.test.ts:114`, `apps/mobile/src/logic/cloze-pick/__tests__/round.test.ts:14`, `apps/web/src/data/__tests__/vocab-catalog.test.ts:25`). R8 `romanization-exception-stale` is `compare.ts:167-181`, fed by `seenExceptionKo` (`packages/content-schema/src/__tests__/helpers/romanization-registry.ts:307-312`, a substring search of every registered file) from `romanization-coverage.test.ts:125`.

**The documented limits.** The work order says the documented limits are "only ㄴ-insertion, 밟-, 잡혀". On `main` they are: `rr.ts:13-17` (ㄴ-insertion with 꽃잎 and 솔잎, the final of 밟-, 잡혀 "verb ㅎ after a simple stop", plus "word-internal compound boundaries and Sino-Korean exceptions" and cross-word sandhi); F-CNT-002 §3.2 `:99` (ㄴ-insertion with 꽃잎, 한여름, **색연필** and 담요, 밟-, compound boundaries, Sino-Korean exceptions, `의`); `packages/content-schema/src/__tests__/romanization-rr.test.ts:253-267` (asserts 꽃잎 `kkochip`, 솔잎 `sorip`, 한여름, **색연필 `saegyeonpil`**, 담요, 밟다 `balda` and 잡혀 `japhyeo` as known wrong output). So 색연필 is already documented. Not documented anywhere: ㄺ before ㄱ, 사이시옷 before 이, the juncture before a content morpheme (맛없-, 첫인-), and the passive / causative / adverb suffix 히 after a stop (only 잡혀 is named).

**"Current content has no such words."** Only partly true. The romanization checker was instrumented for one run (a temporary log in `checkRomanization`, reverted, not committed) and the vitest suites of `content-schema`, `mobile`, `web` and `backend` were run: 17,715 checks over **2,236 distinct Korean strings**. Result:

- ㄺ+ㄱ, 밟-, the 히 suffix, 사이시옷 before 이 and the juncture patterns: **no** taught string (the only hits are unit-test literals). The words that have these patterns elsewhere in the repo (읽기, 읽고, 맑고, 특히, 익혀, 젖혀진, …) sit in Korean UI copy (`content/i18n/ko/**`, `packages/i18n/src/messages/ko/**`) or in source quotes (`quoteOrLocator`), which carry no romanization.
- ㄴ-insertion: 솔잎 (`sollip`) ships, already covered by two exception entries (`exceptions.ts:23-27, 33-37`; the second is the sentence `송편은 솔잎을 깔고 쪄요.`).
- **The predicate ㅎ pattern ships, in two incompatible forms.** 기록했어요 / 기록할까요 / 척해요 are stored aspirated (`girokaesseoyo`, `cheokaeyo`) through six exception entries (`exceptions.ts:28-32, 38-63`), while **따뜻해요 `ttatteuthaeyo`** (`content/episodes/stage-7/nature.v2.json:64,71,76,211,524,730,842`, `content/weekly/2026-11-23.json:40`, `content/weekly/2027-01-11.json:34`), **딱딱해요 `ttakttakhaeyo`** (`content/stories/daeboreum-full-moon.json:108,705,711`) and **축하해요 `chukhahaeyo`** (`content/stories/hangeul-day.json:8`) are stored with the ㅎ kept, as the converter gives them. By the official rule (§1.2, row 4) the aspirated form is right for a predicate, so those 13 stored strings are the converter's wrong answer already frozen into content. The noun 북한산 `bukhansan` (`content/episodes/stage-4/nature.v2.json:562,735,862,925,954,1015,1461`) is correct as stored (romanization lines `:563,736,863,926,955,1016,1462`).

**The work order's guidance misstates one rule.** It lists "the RR rule that does not reflect ㅎ contraction in predicates (용언의 ㅎ 축약을 표기에 반영하지 않는 로마자법 규정)" as a rule to build into the converter. The official text says the opposite (§1.2, row 4): aspiration with ㅎ **is** written (`좋고 joko`, `잡혀 japyeo`, `굳히다 guchida`); its 다만 keeps the `h` only **in a noun (체언)** after ㄱ, ㄷ, ㅂ (`묵호 Mukho`, `집현전 Jiphyeonjeon`); the unnumbered [붙임] of 제1항 is about tensification (된소리되기), not ㅎ. The work order's own expected values (`motaeyo`, `jopida`) already follow RR; only its prose is wrong. And because the 다만 depends on the part of speech, only part of this pattern is rule-determined (§3.1).

### 1.2 The official rules

Sources, read on 2026-11-25:

- **RR** — 국어의 로마자 표기법, 문화관광부 고시 제2000-8호 (2000-07-07), current text 문화체육관광부 고시 제2014-42호 (2014-12-05): <https://korean.go.kr/kornorms/regltn/regltnView.do?regltn_code=0004>
- **SP** — 표준어 규정 제2부 표준 발음법, current text 문화체육관광부 고시 제2017-13호 (2017-03-28): <https://korean.go.kr/kornorms/regltn/regltnView.do?regltn_code=0002>
- **SKD** — 표준국어대사전 (국립국어원), the pronunciation of a single word: <https://stdict.korean.go.kr/> (now served from `https://kdict.korean.go.kr/standard/`)

RR 제3장 제1항 ("음운 변화가 일어날 때에는 변화의 결과에 따라 다음 각 호와 같이 적는다") has four items: 1 consonant assimilation (`백마 Baengma`, `신라 Silla`), **2 "'ㄴ, ㄹ'이 덧나는 경우"** (`학여울[항녀울] Hangnyeoul`, `알약[알략] allyak`), 3 palatalisation (`해돋이 haedoji`, `같이 gachi`, **`굳히다[구치다] guchida`**), **4 "'ㄱ, ㄷ, ㅂ, ㅈ'이 'ㅎ'과 합하여 거센소리로 소리 나는 경우"** (`좋고[조코] joko`, `놓다[노타] nota`, **`잡혀[자펴] japyeo`**, `낳지[나치] nachi`). Item 4 has **다만**: "체언에서 'ㄱ, ㄷ, ㅂ' 뒤에 'ㅎ'이 따를 때에는 'ㅎ'을 밝혀 적는다" (`묵호 Mukho`, `집현전 Jiphyeonjeon`). The unnumbered **[붙임]** after item 4's 다만, which applies to all of 제1항: "된소리되기는 표기에 반영하지 않는다" (`압구정 Apgujeong`, `샛별 saetbyeol`). RR therefore writes ㄴ/ㄹ insertion, palatalisation and predicate aspiration, and leaves out only tensification and the noun ㅎ. The 다만 names ㄱ ㄷ ㅂ only; the converter also keeps `h` after a noun's ㅈ or ㅊ (낮하 `natha`, a test at `romanization-rr.test.ts:152`) because those finals are heard [ㄷ], not because the text names them.

| # | Pattern | Rule (article, quoted or close paraphrase) | Official example | Converter today |
|---|---|---|---|---|
| 1 | ㄺ before ㄱ | SP 제11항: ㄺ ㄻ ㄿ are [ㄱ ㅁ ㅂ] word-finally and before a consonant (`닭[닥]`, `흙과[흑꽈]`); **다만** "용언의 어간 말음 'ㄺ'은 'ㄱ' 앞에서 [ㄹ]로 발음한다" (`맑게[말께]`, `묽고[물꼬]`, `얽거나[얼꺼나]`) | 맑게 [말께] | always [ㄱ] (`NEUTRAL` `rr.ts:49`): 읽고 `ikgo` |
| 2 | ㄼ | SP 제10항: ㄳ ㄵ ㄼ ㄽ ㄾ ㅄ are [ㄱ ㄴ ㄹ ㅂ] word-finally and before a consonant (`여덟[여덜]`, `넓다[널따]`); **다만** "'밟-'은 자음 앞에서 [밥]으로 발음하고, '넓-'은 다음과 같은 경우에 [넙]으로 발음한다" (`밟다[밥ː따]`, `밟는[밥ː는→밤ː는]`, `밟고[밥ː꼬]`; `넓죽하다[넙쭈카다]`, `넓둥글다[넙뚱글다]`; the 해설 adds `넓적하다` [넙쩌카다]) | 밟다 [밥따] | general form right (`rr.ts:52`: 넓다 `neolda`); 밟- wrong: 밟다 `balda`, 밟는 `balleun` |
| 3 | stop + suffix 히 / 혀 | SP 제12항 붙임 1: a final ㄱ(ㄺ), ㄷ, ㅂ(ㄼ), ㅈ(ㄵ) joins a following ㅎ as [ㅋ ㅌ ㅍ ㅊ] (`각하[가카]`, `먹히다[머키다]`, **`좁히다[조피다]`**, `앉히다[안치다]`); SP 제17항 붙임: "'ㄷ' 뒤에 접미사 '히'가 결합되어 '티'를 이루는 것은 [치]로 발음한다" (`굳히다[구치다]`, `닫히다[다치다]`); RR 제3장 제1항 4 writes it (`잡혀 japyeo`, 3: `굳히다 guchida`) | 잡혀 japyeo | `h` kept after any simple stop (`rr.ts:89-109`, the owner-requested noun convention): 좁히다 `jophida`, 잡혀 `japhyeo`, 굳히다 `guthida`, 맞히다 `mathida`, 특히 `teukhi` |
| 4 | stop + 하다 form | RR 제3장 제1항 4 and its 다만 (above); SP 제12항 붙임 1 and **붙임 2** (a final ㅅ ㅈ ㅊ ㅌ heard as [ㄷ] before ㅎ: `옷 한 벌[오탄벌]`, `숱하다[수타다]`) | 못해요 [모태요] | `h` kept: 못해요 `mothaeyo`, 따뜻해요 `ttatteuthaeyo` |
| 5 | ㄴ-insertion | SP 제29항: in a compound or derived word whose first part ends in a consonant and whose second part begins with 이 야 여 요 유, ㄴ is added (`솜이불[솜ː니불]`, `꽃잎[꼰닙]`, `한여름[한녀름]`, **`색연필[생년필]`**, `담요[담ː뇨]`, `식용유[시굥뉴]`, `밤윷[밤ː뉻]` and 13 more); 붙임 1: after ㄹ the added sound is [ㄹ] (`솔잎[솔립]`, **`서울역[서울력]`**, `물약[물략]`, `휘발유[휘발류]`); 다만: some allow both (`검열`, `금융`); 붙임 2: across two words said as one (`서른여섯[서른녀섣]`, `스물여섯[스물려섣]`), and its 다만, no insertion: `6·25[유기오]`, `3·1절[사밀쩔]`, `송별연[송ː벼련]`, `등용문[등용문]` | 색연필 [생년필] | plain liaison: `saegyeonpil` |
| 6 | 사이시옷 before 이 | SP 제30항 3: "사이시옷 뒤에 '이' 음이 결합되는 경우에는 [ㄴㄴ]으로 발음한다" (`베갯잇[베갠닏]`, **`깻잎[깬닙]`**, `나뭇잎[나문닙]`, `뒷윷[뒨ː뉻]`). (제30항 1 and 2, tensification and 사이시옷 before ㄴ ㅁ, are right today: RR does not write tensification, and `콧날` gives `konnal`.) | 깻잎 [깬닙] | ㅅ moved as liaison: `kkaesip` |
| 7 | juncture (절음) before a content morpheme | SP 제15항: "받침 뒤에 모음 'ㅏ, ㅓ, ㅗ, ㅜ, ㅟ' 들로 시작되는 실질 형태소가 연결되는 경우에는, 대표음으로 바꾸어서 뒤 음절 첫소리로 옮겨 발음한다" (`밭 아래[바다래]`, `젖어미[저더미]`, `겉옷[거돋]`); **다만** "'맛있다, 멋있다'는 [마싣따], [머싣따]로도 발음할 수 있다"; 붙임: a compound final moves only one part (`값어치[가버치]`) | 맛없어요 [마덥써요] | the full final moves: `maseopseoyo`, `cheosinsang`, `geotot` |

Rows 1 to 3 are decided by the letters plus a closed list the rule itself gives. Rows 4 to 7 depend on where a morpheme boundary is, or on the part of speech: the converter sees a string of syllable blocks and cannot know either.

### 1.3 Also found

1. **The converter is used at run time, not only by the lint.** `apps/mobile/src/logic/write-frame/view.ts:48-50` (`sentenceRomanization`: the romanization of the sentence a learner builds in Write Frame), `apps/mobile/src/logic/lecture/deck-builder.ts:1044` (the example line of a lecture card), `apps/mobile/src/logic/ko-tokens.ts:19-24` (`{ko:}` tokens in a Discover note), `apps/mobile/src/logic/story-order/story-order-view.ts:36` (a fallback), `apps/mobile/src/screens/minigames/VoiceEchoGame.tsx:68` (a fallback) and the typed-text labels of `WriteFrameGame.tsx:237` and `TypeHangulGame.tsx:164` romanize Korean with no stored value. One build step goes further: `scripts/build-week-drops.mjs:141` throws unless a ready week drop's stored romanization **equals** `romanize()` exactly, with no exceptions list. So a corrected stored value can disagree with what the same word shows when the app composes it (the Stage 7 Write Frame bank holds 따뜻해요, `content/episodes/stage-7/nature.v2.json:524`, and composes "봄은 따뜻해요." with `romanize()`). The search terms of the lesson chooser (`packages/content-schema/src/schemas/lesson-chooser.ts:136`) and the label and fallback romanization of a review item (`stable-ids.ts:344, 522`) are built the same way. Row RG-2a.
2. **Stable ids do not move.** `koSlug` (`packages/content-schema/src/review-items/stable-ids.ts:147-158`) slugs a new review item from `romanize()`, but every existing id is frozen in `items-stable-id.json`, keyed by the **Korean** (`"lex|따뜻해요": "lex:ttatteuthaeyo"`, `:552`). A converter change gives a different slug only to an item first built after it; ids in content (`"id": "ttatteuthaeyo"`) and the overlay keys built from them (`content/i18n/es/lessons-stage7-nature-v2.json:105`) are ids, not romanizations, and are never renamed by this amendment.
3. **Other rule-only users.** `pronunciationKey` and `hasSoundChange` (`packages/content-schema/src/lesson-lint-items.ts:280-282, 334-339`) compare the converter with a spelled reading. The RG-1 fixes make them more exact (특히 then reads as a sound change, which it is). But `hasSoundChange` decides whether a word may be a Dictation target (`packages/content-schema/src/lesson-lint.ts:576`), and after RG-2b a corrected predicate (따뜻해요 [따뜨태요]) or any ㄴ-insertion word would still read as "no sound change" by the rule converter alone; row RG-2b closes that (§3.5). Stage 7's Dictation uses only 봄 and 여름, so no lesson lint result changes today.
4. **ㅈ + 히** (맞히다 `mathida`, 꽂히다 `kkothida`, 잊혀 `ithyeo`) is wrong today too: F-CNT-002 §3.2 step 2b says "ㅈ+ㅎ→ㅊ", but the code reaches that branch only for ㄵ (`rr.ts:93-102`). Row 3 covers it.
5. **Sino-Korean words insert ㄴ too** (색연필, 식용유, 휘발유, 영업용, 백분율 are SP 제29항's own examples), and some compounds do not (송별연, 등용문). A detector cannot use "native vs Sino-Korean" as its test.
6. **첫인상.** SP 제15항 lists ㅏ ㅓ ㅗ ㅜ ㅟ, not ㅣ, and NIKL's survey of Seoul speech reports ㄴ-insertion in 첫인상 ([천닌상]). The work order's value `cheodinsang` is not backed by 제15항 either: its 해설 says a following content morpheme beginning with ㅣ ㅑ ㅕ ㅛ ㅠ takes ㄴ-insertion instead (`앞일[암닐]`, `꽃잎[꼰닙]`). The SKD entry could not be opened from this session (its search page shows no pronunciation). The test below therefore asserts only that 첫인상 **needs an override**; whoever adds the entry records the SKD pronunciation in its reason.
7. A full `mobile` run on `8676b5de5` has one failing test unrelated to romanization (`src/store/__tests__/goals.test.ts`, "a session's local day (CM-4) …", `expected '2098-12-31' to be '2099-01-01'`), a date-boundary test; every romanization suite passes.

Who this hurts: every learner who reads a romanization to sound out a word. A wrong value teaches a wrong sound (`ikgo` for [일꼬]) on the exact screens that exist to teach the sound.

## 2. User story

> As a learner, the romanization under a word tells me how it is really said: 읽고 is `ilgo`, 깻잎 is `kkaennip`.
>
> As a content author, when I add a word the converter cannot get right, the build tells me so and names the rule, instead of making me copy a wrong value.

## 3. Acceptance criteria

### 3.1 The decision per pattern

| # (§1.2) | Pattern | Decided by | Choice | Row |
|---|---|---|---|---|
| 1 | ㄺ before ㄱ | letters + a closed noun list (the ㄺ nouns: 닭 흙 칡 삵, in compounds 수탉 암탉 통닭 까닭 기슭) | **fix the converter** | RG-1 |
| 2 | 밟- and 넓죽- / 넓둥- / 넓적- | letters + the list in SP 제10항 다만 and its 해설 | **fix the converter** (the general ㄼ form is already right; tests pin it) | RG-1 |
| 3 | stop + suffix 히 / 혀 / 혔 / 힌 / 힐 | letters (no native or Sino-Korean noun has these blocks after a stop: Sino-Korean "hi" is written 희, and 집현전's 현 and 박혁거세's 혁 are not in the set; a loanword compound such as 빅히트 takes a `proper-noun` entry) | **fix the converter** | RG-1 |
| 4 | stop + 하다 form (하 한 할 함 합 해 했) | part of speech (북한산 noun, `bukhansan`; 못해요 predicate, `motaeyo`) | **detect, require an override** | RG-2b |
| 5 | ㄴ-insertion | morpheme boundary and lexicon | **detect, require an override** | RG-2b |
| 6 | 사이시옷 before 이 | morpheme boundary (깻잎 vs the particle in 옷이) | **detect, require an override** | RG-2b |
| 7 | juncture before a content morpheme | morpheme boundary (맛없어요 vs 맛이) | **detect, require an override** | RG-2b |

The work order put all of "용언 ㅎ 축약" in RG-1. Only row 3 is rule-determined; row 4 needs the part of speech, so it moves to RG-2b (§1.1).

### 3.2 Row RG-1: the converter fixes (`rr.ts`)

All three are applied in `romanizeSyllables` and change no other output; `romanize`, `romanizeWord` and `syllableSplit` follow.

- **F1 (ㄺ before ㄱ).** When a block's final is ㄺ and the next block's initial is ㄱ, the final is heard [ㄹ]: coda `l`, the next initial stays `g` (읽고 `ilgo`, 맑게 `malge`, 밝고 `balgo`, 읽기 `ilgi`), **unless** the block is one of the ㄺ-final noun syllables `닭 탉 흙 칡 삵 슭` (a constant, `RIEUL_GIYEOK_NOUNS`), which keep `k` (닭고기 `dakgogi`, a golden vector; 흙과 `heukgwa`). Before any other consonant and at the end ㄺ stays `k` (읽다 `ikda`, 읽지 `ikji`, 읽는 `ingneun`); before ㅇ liaison is unchanged (읽어요 `ilgeoyo`); before ㅎ the compound-final rule is unchanged (밝히다 `balkida`).
- **F2 (밟-, 넓죽-, 넓둥-).** The block 밟 before a consonant other than ㅎ is heard [ㅂ] (coda `P`, then the usual nasalisation): 밟다 `bapda`, 밟고 `bapgo`, 밟지 `bapji`, 밟는 `bamneun`. The block 넓 directly before 죽, 둥 or 적 is heard [ㅂ] (넓둥글다 `neopdunggeulda`, 넓적다리 `neopjeokdari`). Unchanged: 밟아 `balba`, 밟히다 `balpida`, 넓다 `neolda`, 넓히다 `neolpida`, 여덟 `yeodeol`, 짧게 `jjalge`.
- **F3 (stop + suffix 히).** When a block's final is a simple stop (ㄱ ㄲ ㅋ ㄷ ㅅ ㅆ ㅈ ㅊ ㅌ ㅂ ㅍ) and the next block is one of `히 혀 혔 힌 힐` (a constant, `SUFFIX_HI`), the ㅎ merges with the stop as in a compound final today: ㄱ ㄲ ㅋ → ㅋ, ㅂ ㅍ → ㅍ, ㄷ → ㅊ (SP 제17항 붙임), ㅅ ㅆ ㅌ → ㅌ, ㅈ ㅊ → ㅊ, and the final drops. 좁히다 `jopida`, 잡혀 `japyeo`, 잡혔어요 `japyeosseoyo`, 잡힌 `japin`, 먹히다 `meokida`, 굳히다 `guchida`, 닫히다 `dachida`, 묻혀 `muchyeo`, 맞히다 `machida`, 꽂히다 `kkochida`, 잊혀 `ichyeo`, 특히 `teuki`, 급히 `geupi`. The vowel is written as spelled: `muchyeo`, `ichyeo`. That is a house convention, not the pronunciation: SP 제5항 다만 1 says the 활용형 '져, 쪄, 쳐' are said [저, 쩌, 처] (묻혀 [무처]), which pronunciation-based RR would write `mucheo`. The converter already writes 가져 `gajyeo` the same way, and §4 keeps that rule out of scope. The noun convention for every other ㅎ block is unchanged: 집현전 `jiphyeonjeon`, 묵호 `mukho`, 입학 `iphak`, 축하 `chukha`, 금속활자 `geumsokhwalja`, 풍속화 `pungsokhwa`, 북한산 `bukhansan`, 낮하 `natha`, 꽃한 `kkothan`.
- **Prototyped (scratch, not committed).** A copy of `rr.ts` with F1 to F3 (about 20 added lines: the codas of F1 and F2 set right after `NEUTRAL` is applied, F3 as a branch before `keepsH`) reproduces every RG-1 vector of §3.8 and every F-CNT-002 golden vector except 밟다 (`bapda`). Over the 2,236 distinct Korean strings the checker sees today (§1.1) its output differs from `main` for **one** string, the unit-test literal 밟다: no shipped value changes. With `predicateH` (§3.5 item 5) the same copy gives `girokaesseoyo`, `girokalkkayo` and `cheokaeyo`, exactly the values the six existing predicate entries allow, and `motaeyo`, `ttatteutaeyo`, `ttakttakaeyo`, `chukahaeyo`.
- The header comment of `rr.ts` (`:13-17`) lists the limits that remain (rows 4 to 7) and points at this amendment.

### 3.3 Row RG-2a: one reviewed romanization, used everywhere a value is composed

Lands **before** the detector (RG-2b) so that no window exists in which a stored value and a composed line disagree.

**`romanizeReviewed(text, exceptions = ROMANIZATION_EXCEPTIONS): { text: string; unknown: string[] }`** (new file `packages/content-schema/src/romanization/reviewed.ts`, pure; imports `rr.ts` and `exceptions.ts`; exported from `src/index.ts`):

1. If an entry's `ko` equals the trimmed `text`, the result is `normalizeRomanization(entry.allowed[0])` with sentence marks stripped (so it has the shape `romanize()` returns: lower case, no `. , ! ?`, single spaces).
2. Otherwise `text` is split and stripped exactly as `romanize()` does (`rr.ts:180-195`); a token that equals a **word entry**'s `ko` gives that entry's normalised `allowed[0]`; every other token gives `romanizeWord(token)` (or stays in `unknown`).
3. With no matching entry the result is identical to `romanize(text)`. On `main` today the only entries are whole strings (§1.1), so in RG-2a the function changes output only for those eight strings (for example `송편은 솔잎을 깔고 쪄요.` composes `songpyeoneun sollipeul kkalgo jjyeoyo` instead of `… soripeul …`), which are corrections.

**Call sites that switch to it in RG-2a** (they compose or demand a romanization the learner sees):

| Kind | Sites |
|---|---|
| build step that demands exact equality | `scripts/build-week-drops.mjs:141` (`buildDrops` throws unless `item.romanization === m.romanize(item.ko).text`; both drops holding 따뜻해요 are `ready`) and its display twin `:113` (`noteParts`); its test in `scripts/__tests__/` |
| app display | `apps/mobile/src/logic/write-frame/view.ts:49` (`sentenceRomanization`) and `:60` (`nameGloss`), `apps/mobile/src/logic/lecture/deck-builder.ts:1044`, `apps/mobile/src/logic/ko-tokens.ts:20-22`, `apps/mobile/src/logic/story-order/story-order-view.ts:36`, `apps/mobile/src/screens/minigames/VoiceEchoGame.tsx:68`, `WriteFrameGame.tsx:237`, `TypeHangulGame.tsx:164` |
| content-schema derived values | `packages/content-schema/src/schemas/lesson-chooser.ts:136` (search terms: a learner who types the romanization on screen must find the item), `packages/content-schema/src/review-items/stable-ids.ts:150` (`koSlug`: a slug only for an item not yet frozen; every frozen id stays, `items-stable-id.json` gets no diff; the precedent is the hand-corrected `lex:girokaesseoyo`, `content/stories/research/read-tiers.signoff.md:61`), `:344` (`labelOfKey`), `:522` (fallback when nothing is stored) |
| tests that assert a stored multi-block value equals the converter | `packages/content-schema/src/__tests__/vocab-food.test.ts:75`, `vocab-v5.test.ts:134,150`, `vocab-v6a.test.ts:157,177,364`, `vocab-v6b.test.ts:156,176,347`, `role-play.test.ts:51-53`, `catalogue-fields.test.ts:82-85`, `placement-bank.test.ts:207,214,301,347,422`; `apps/mobile/src/logic/story-order/__tests__/story-order-player.test.ts:50`, `apps/mobile/src/screens/minigames/__tests__/HiddenHeritageLetters.test.tsx:143`, `apps/mobile/src/logic/stage1/__tests__/spoken.test.ts:48`, `apps/mobile/src/logic/reviews/__tests__/yut-board.test.ts:49` |

**Stay on the rule-only converter** (they need a deterministic reading of the letters, or read one block): `review-items/review-item.ts:247` (packs a stored value that equals the converter as `''`; a reviewed value is simply stored), `lesson-lint-items.ts:281,306,338` (`pronunciationKey`, `spelledReading`, `hasSoundChange`; see §3.5 item 6), `pillars.ts:62`, `logic/scope-builders.ts:28`, `logic/trace-word/rounds.ts:43`, `logic/syllable-build/pool.ts:41`, `logic/audio/jamo-voice.ts:63`, `logic/story/spoken-label.ts:12`, and the single-block tests (`syllable-build/__tests__/pool.test.ts:62`, `audio/__tests__/jamo-voice.test.ts:253`, `content/__tests__/jamo-audio.test.ts:122`).

Test fixtures already spell the predicate the RR way (`축하해요 chukahaeyo`, `apps/mobile/src/logic/story/__tests__/scene-view.test.ts:161`, `reader-effects.test.ts:241`).

### 3.4 Row RG-2b: the override (where, what, why)

**Where.** The override is an entry in the existing registry `ROMANIZATION_EXCEPTIONS` (`packages/content-schema/src/romanization/exceptions.ts:22`), not a new field on each content item (OD-RG2). The type `RomanizationException` (`exceptions.ts:11-15`) becomes:

```ts
/** The converter gaps a detector names (AMENDMENTS-ROMANIZER-GAPS §3.6). */
export type RomanizationGap = 'n-insertion' | 'saisiot' | 'juncture' | 'predicate-h';

export interface RomanizationException {
  /** A whole Korean string (as today), or one word: a whitespace-free token, sentence marks stripped (new). */
  ko: string;
  /** The accepted romanizations. A word entry holds exactly one; its value is the reviewed one (romanizeReviewed). */
  allowed: readonly string[];
  /** Why the converter is wrong, or why this word needs no change: names the article (표준 발음법 제N항, 로마자 표기법 제3장 제1항) or the 표준국어대사전 pronunciation. */
  reason: string;
  /** Which converter gap the entry covers (required, new). */
  gap: RomanizationGap | 'proper-noun' | 'other';
}
```

The romanization modules import nothing outside `romanization/` (F-CNT-002 C1), so the shape is a TypeScript type checked by `tsc` and by R8 below, not a zod schema.

### 3.5 Row RG-2b: the checker rules

1. **R1 compares with the reviewed value.** `romanization-mismatch` fires when the compact `given` differs from the compact `romanizeReviewed(ko).text` and no whole-string entry for `ko` lists it (`isAllowed`, `compare.ts:158-161`, keeps alternates for whole-string entries only). **An entry now excludes the converter's value unless the entry lists it**: once `따뜻해요` has an entry with `ttatteutaeyo`, a stored `ttatteuthaeyo` fails, so an author cannot copy the converter for a reviewed word. R1's message names the reviewed value (`Revised Romanization is "<romanizeReviewed(ko).text>"`). No word-by-word alignment is needed: `romanizeReviewed` already works token by token, so R3's raw whitespace count (`compare.ts:101`, which also counts tokens `romanize` drops) plays no part in R1.
2. **Default list.** `checkRomanization(ko, given)` with no `ctx` uses `ROMANIZATION_EXCEPTIONS`; `{ exceptions: [] }` means none. Today about a dozen suites pass no `ctx` (§1.1); without the default they could never satisfy R9. No data suite fails because of this (checked by prototype); the unit tests that relied on "no ctx = no entries" are rewritten (§6).
3. **R9 `romanization-gap`** (new, severity `error`): for each token of `ko` (split and stripped as `romanize` does), when `detectGaps(token)` (§3.6) is not empty and **no** entry covers it (a word entry whose `ko` is the token, or a whole-string entry whose `ko` is the trimmed string), report `<token>: <gap> (<article>); the converter cannot tell. Check 표준국어대사전 and add { ko: '<token>', allowed: ['…'], gap: '<gap>', reason: '…' } to ROMANIZATION_EXCEPTIONS`. R9 fires even when `given` equals the converter output: that is the point. When R1 already fires for the string, R9 is not added; R1's message gains ` (converter gap: <gap>, AMENDMENTS-ROMANIZER-GAPS)`. `checkProse` keeps filtering to R1 and R2, so prose never reports R9. `checkFrameRomanization` runs R9 on each piece between slots, like R1.
4. **R8 extended** (`checkExceptions`, `compare.ts:167-181`). An entry fails when: its `reason` is blank (as today); it matches nothing (below); a detector-gap entry (`gap` is one of the four) cites no article (`/제\s*\d+\s*항|표준국어대사전/`); a word entry holds more or fewer than one `allowed`; or a `predicate-h` entry fails item 5. (`gap` itself is required by the type, so no run-time check is needed for it.) **Matching**: a whole-string entry keeps today's substring search (`seenExceptionKo`, `romanization-registry.ts:307-312`); a word entry must match as a **whole token** of a Korean string that a data suite actually checks, not anywhere in a file's text. The scan helpers already collect those strings (`koSeen` in `romanization-json-scan.ts`, the extracted pairs of the TS sources); `seenExceptionKo` takes them as its input for word entries. Otherwise source quotes keep an entry alive for ever: `북한산` appears inside `북한산국립공원` in `content/episodes/stage-6/nature.v2.json:1675,1678,1682`, and the coverage test already notes that 꽃잎 sits in a source quote (`romanization-coverage.test.ts:129`).
5. **The predicate reading check.** `romanize(text, { predicateH: true })` and `romanizeWord(word, { predicateH: true })` (new option): in a token that has a 하다-form block (하 한 할 함 합 해 했) after its first block, **every** simple-stop + ㅎ junction aspirates. Before a 히 / 혀 block F3 applies; before any other ㅎ block the stop is first heard [ㄷ] and then [ㅌ] (SP 제12항 붙임 2, `숱하다[수타다]`; the 해설: `낮 한때` is [나탄때], not [나찬때]): ㄱ ㄲ ㅋ → ㅋ, ㄷ ㅅ ㅆ ㅈ ㅊ ㅌ → ㅌ, ㅂ ㅍ → ㅍ. This reads RR's 다만 at word level, as the shipped entries already do: 축하해요 is a predicate, so its ㄱ+ㅎ inside 축하 aspirates (`chukahaeyo`), and so does 입학해요 (`ipakaeyo`) and 약혼해요 (`yakonhaeyo`). A test asserts, for each `predicate-h` entry (whole strings included, compared in compact form): either its first `allowed` equals `romanize(ko, { predicateH: true })`, or it equals `romanize(ko)` and its `reason` says it is a noun (`/체언|noun/`), as for 북한산.

6. **Sound change for Dictation** (`lesson-lint-items.ts:334-339`): `hasSoundChange(ko)` is also true when a word has a non-empty `detectGaps` or a word entry whose value differs from `romanizeWord`. The Dictation gate (`lesson-lint.ts:576`) then keeps those words out until recordings exist, as it does for every other sound change. No current Dictation target is affected (Stage 7 uses 봄 and 여름).

### 3.6 Row RG-2b: the detectors (`romanization/gaps.ts`, new)

`detectGaps(token: string): RomanizationGap[]`, pure, imports only `hangul.ts`. A token with a non-syllable character, or of one block, gives `[]`. For each neighbouring pair (block *i*, block *i+1*), with *tail* = the token from block *i+1* to its end:

| Gap | Fires when | Lists (exported constants, data) |
|---|---|---|
| `predicate-h` | block *i* has a simple stop final (ㄱ ㄲ ㅋ ㄷ ㅅ ㅆ ㅈ ㅊ ㅌ ㅂ ㅍ), block *i+1* has initial ㅎ, and some block after the first is a 하다 form | `HADA_BLOCKS` = 하 한 할 함 합 해 했 |
| `n-insertion` | block *i* has a final other than ㅅ, block *i+1* has initial ㅇ, and *tail* starts with a listed head; **or** the token **starts with** a listed word | `N_INSERTION_HEADS` = 잎 잇 윷 엿 이불 이야기 여름 연필 역 약 열차 율 여비 여성 요기 여우 유들 여섯 여덟 일곱; `N_INSERTION_WORDS` = 담요 식용유 휘발유 맨입 막일 삯일 들일 집안일 부엌일 바깥일 앞일 밭일 논일 뒷일 훗일 큰일 볼일 궂은일 일일이 영업용 늑막염 설익 십육 |
| `saisiot` | block *i* has final ㅅ, block *i+1* has initial ㅇ and medial ㅣ ㅑ ㅕ ㅛ ㅠ, *tail* is not grammatical and does not start with 있 | grammatical tails (below) |
| `juncture` | block *i* has a final whose liaison differs from its neutralised sound (ㅅ ㅆ ㅈ ㅊ ㅌ ㅍ ㅋ ㄲ and every compound final except ㄶ ㅀ) and *tail* starts with a listed head, except 있 after 맛 or 멋 (SP 제15항 다만); **or** *i* = 0, the token starts with a listed prefix, block 1 has initial ㅇ, and *tail* is not grammatical | `JUNCTURE_HEADS` = 없 있 옷 웃음 아래 어른 앞 위 어미 어치; `JUNCTURE_PREFIXES` = 첫 헛 겉 덧 옛 홑 |

A *tail* is **grammatical** when it is empty; or is one of 이 가 은 는 을 를 도 와 과 랑 이랑 에 에서 에게 의 만 로 으로 하고 처럼 보다 까지 부터 이나 이고 이면 이지 이다 이야 이요 이에요 이예요 이죠 이네요 이며 이어서 이든지 이지만 이라도 이래요 이잖아요; or is 이 followed by one of those; or starts with a copula stem 이었 이라 이니 이지 이에 입니 이세 이시; or is one of the copula forms 인데 인데요 인지 인지요 인가 인가요 일까 일까요 일지 임 입니까 (것인데, 것일까요, 무엇인가요, 곳인가요).

The lists come from the articles' examples and the work order's words: every SP 제29항 body and 붙임 1 example is detected (the body's 20 and 들일 솔잎 설익다 물약 불여우 서울역 물엿 휘발유 유들유들), and so are the 붙임 2 numerals written as one word (서른여섯 스물여섯, and 열여섯 열여덟 열일곱), 제30항 3's four and 제15항's 젖어미, 겉옷 and 값어치; the no-insertion words of 제29항 붙임 2 다만 (송별연, 등용문) are not. The 다만 reduplications (이죽이죽, 야금야금) are not covered.

**False-positive policy.** A detector hit on a word the converter already gets right is cleared by an entry that *confirms* the converter: `allowed` holds the converter's value and `reason` gives the rule or the SKD pronunciation (for example `{ ko: '북한산', allowed: ['bukhansan'], gap: 'predicate-h', reason: 'a noun (체언): RR 제3장 제1항 4 다만 keeps the ㅎ (Bukhansan)' }`). Authors should expect confirmations for: Sino-Korean words after a listed head (번역 [버녁], 통역, 영역, 절약 [저략], 한약, 공약, 독약, 환율, 운율, 선율); a noun with a 하다-form block (북한산, 낙하산, 백합, 집합, 축하 used as a noun); and every **predicate** with a stop before 하다 (생각해요, 시작해요, 행복해요, 따뜻한), which needs a word entry with the `predicateH` value — Stage 3 and later content will add these regularly (OD-RG1, OD-RG6). The lists are never narrowed to make one word pass; if one content PR needs more than five confirmations of the same kind, the author proposes a narrower list in an amendment to this spec instead.

**False negatives.** A compound whose second part is not listed (a new 앞일-type word, a number such as 삼십육 that contains 십육 but does not start with it) passes unflagged, as today. The lists are data: a content PR that adds such a word adds it to the list in the same PR. The converter's remaining limits stay documented in `rr.ts` and F-CNT-002 §3.2.

**Measured on today's content** (the 2,236 checked strings of §1.1, with a prototype of this table): the detectors fire on **10 tokens**: 북한산, 북한산에, 따뜻해요, 딱딱해요, 축하해요 (`predicate-h`, new entries in §3.7), 기록할까요, 기록했어요, 척해요 (`predicate-h`, covered by existing entries), 솔잎, 솔잎을 (`n-insertion`, covered). No `saisiot` or `juncture` hit and no other `n-insertion` hit ships.

R9 is an error from the start (as the work order asks); §3.7 makes today's content pass in the same row.

### 3.7 Row RG-2b: what today's content needs (0 regressions)

No currently passing string starts failing. Entries the row adds (OD-RG1 (a), adopted provisionally):

| Entry `ko` | `allowed` | `gap` | Covers (romanization lines) |
|---|---|---|---|
| 북한산 | `bukhansan` | `predicate-h` (noun confirmation) | `content/episodes/stage-4/nature.v2.json:563,863,926,955,1016` |
| 북한산에 | `bukhansane` | `predicate-h` (noun confirmation) | `:736` (`북한산에 가요.`), `:1462` |
| 따뜻해요 | `ttatteutaeyo` | `predicate-h` | 9 strings below |
| 딱딱해요 | `ttakttakaeyo` | `predicate-h` | 3 strings below |
| 축하해요 | `chukahaeyo` | `predicate-h` | 1 string below |

and the stored values it corrects (romanization only; Korean, ids, overlay keys and audio unchanged):

| File:line | From | To |
|---|---|---|
| `content/episodes/stage-7/nature.v2.json:64` | `___eun/neun ttatteuthaeyo` | `___eun/neun ttatteutaeyo` |
| `…/stage-7/nature.v2.json:71,211,730` | `bomeun ttatteuthaeyo` | `bomeun ttatteutaeyo` |
| `…/stage-7/nature.v2.json:76` | `oneureun ttatteuthaeyo` | `oneureun ttatteutaeyo` |
| `…/stage-7/nature.v2.json:524,842`, `content/weekly/2026-11-23.json:40`, `content/weekly/2027-01-11.json:34` | `ttatteuthaeyo` | `ttatteutaeyo` |
| `content/stories/daeboreum-full-moon.json:108,705` | `ttakttakhaeyo` | `ttakttakaeyo` |
| `content/stories/daeboreum-full-moon.json:711` | `Hoduga ttakttakhaeyo.` | `Hoduga ttakttakaeyo.` |
| `content/stories/hangeul-day.json:8` | `Hangeullareul chukhahaeyo!` | `Hangeullareul chukahaeyo!` |

The existing eight entries get their `gap` (`솔잎` and `송편은 솔잎을 깔고 쪄요.`: `n-insertion`; the six 기록- / 척- entries: `predicate-h`) and article-citing reasons. A search of every tracked file found no other stored copy of these romanizations: the TTS manifest, the overlays and `items-stable-id.json` hold ids or Korean only; the story keyword check (`story.test.ts:411-417`) still holds because a keyword and its line change together. If the owner picks OD-RG1 (b) or (c) instead, the three predicate entries hold the stored `h` values with the reason that OD-RG1 decides, and the 13 strings are not edited.

### 3.8 Test tables

**The nine words of the work order.**

| Word | RG-1: `romanizeWord` | RG-2b: `checkRomanization(word, converterOutput, { exceptions: [] })` | RG-2b: with the entry |
|---|---|---|---|
| 읽고 | `ilgo` | `[]` | — |
| 맑게 | `malge` | `[]` | — |
| 좁히다 | `jopida` | `[]` | — |
| 깻잎 | `kkaesip` (unchanged) | `romanization-gap` (`saisiot`, SP 제30항 3) | `{ ko: '깻잎', allowed: ['kkaennip'], gap: 'saisiot' }`: `kkaennip` passes, `kkaesip` fails R1 |
| 색연필 | `saegyeonpil` (unchanged) | `romanization-gap` (`n-insertion`, SP 제29항) | `saengnyeonpil` passes |
| 서울역 | `seouryeok` (unchanged) | `romanization-gap` (`n-insertion`, SP 제29항 붙임 1) | `seoullyeok` passes |
| 맛없어요 | `maseopseoyo` (unchanged) | `romanization-gap` (`juncture`, SP 제15항) | `madeopseoyo` passes |
| 첫인상 | `cheosinsang` (unchanged) | `romanization-gap`, gaps include `juncture` (the 첫 prefix) and `saisiot` (첫 ends in ㅅ) | the SKD value passes (§1.3 item 6) |
| 못해요 | `mothaeyo` (unchanged) | `romanization-gap` (`predicate-h`, RR 제3장 제1항 4; SP 제12항 붙임 2) | `motaeyo` passes and equals `romanizeWord('못해요', { predicateH: true })` |

For each of the six detected words, the **correct** value with **no** entry gives `romanization-mismatch` whose message carries the gap hint, and no separate R9. Detector tests assert that the expected gap is **included** (홑이불 gives `n-insertion` and `juncture`; 첫인상 and 뒷일 give two).

**RG-1 vectors** (`romanization-rr.test.ts`; the two "limit" cases at `:261-267` move into the rule tests; `romanization-compare.test.ts:114` now expects `[]` for `밟다 bapda`): 읽고 `ilgo`, 맑게 `malge`, 맑고 `malgo`, 밝고 `balgo`, 늙고 `neulgo`, 읽기 `ilgi`; 닭고기 `dakgogi`, 흙과 `heukgwa`, 칡과 `chikgwa`, 닭과 `dakgwa`; 읽다 `ikda`, 읽지 `ikji`, 읽는 `ingneun`, 읽어요 `ilgeoyo`, 밝히다 `balkida`; 밟다 `bapda`, 밟고 `bapgo`, 밟지 `bapji`, 밟는 `bamneun`, 밟아 `balba`, 밟히다 `balpida`, 넓둥글다 `neopdunggeulda`, 넓적다리 `neopjeokdari`, 넓다 `neolda`, 넓히다 `neolpida`, 여덟 `yeodeol`, 짧게 `jjalge`; 좁히다 `jopida`, 잡혀 `japyeo`, 잡혔어요 `japyeosseoyo`, 잡힌 `japin`, 먹히다 `meokida`, 굳히다 `guchida`, 닫히다 `dachida`, 맞히다 `machida`, 꽂히다 `kkochida`, 특히 `teuki`, 급히 `geupi`; the house convention for the vowel (§3.2): 묻혀 `muchyeo`, 잊혀 `ichyeo`; unchanged noun convention: 집현전 `jiphyeonjeon`, 묵호 `mukho`, 입학 `iphak`, 축하 `chukha`, 북한산 `bukhansan`, 금속활자 `geumsokhwalja`, 낮하 `natha`. Every golden vector of F-CNT-002 §3.2 still passes except 밟다, which becomes `bapda`.

**`predicateH` vectors** (RG-2b): 못해요 `motaeyo`, 따뜻해요 `ttatteutaeyo`, 딱딱해요 `ttakttakaeyo`, 축하해요 `chukahaeyo`, 입학해요 `ipakaeyo`, 약혼해요 `yakonhaeyo`, 숱하다 `sutada`, 기록했어요 `girokaesseoyo`, 기록할까요 `girokalkkayo`, 척해요 `cheokaeyo`; and without a 하다 block nothing changes (입학 `iphak`).

**Detector vectors** (`romanization-gaps.test.ts`, new):

- fire: the SP 제29항 body (솜이불 홑이불 막일 삯일 맨입 꽃잎 내복약 한여름 남존여비 신여성 색연필 직행열차 늑막염 콩엿 담요 눈요기 영업용 식용유 백분율 밤윷) and 붙임 1 (들일 솔잎 설익다 물약 불여우 서울역 물엿 휘발유 유들유들), 서른여섯 스물여섯 열여섯 열일곱 십육 큰일 볼일 일일이 → `n-insertion`; 깻잎 나뭇잎 뒷윷 베갯잇 → `saisiot`; 맛없어요 덧없다 겉옷 헛웃음 뜻있다 첫아이 첫인상 젖어미 값어치 → `juncture`; 못해요 따뜻해요 생각해요 착하다 입학해요 약혼해요 북한산 낙하산 → `predicate-h`.
- do not fire: 송별연 등용문 (제29항 붙임 2 다만); 맛있어요 멋있어요 (SP 제15항 다만; F-CNT-002 golden `masisseoyo`); particles and copula after ㅅ or a stop: 옷이 맛이 것이에요 뜻이에요 붓이에요 이곳이 겉은 것인데 것일까요 무엇인가요 곳인가요 것이었습니다; a listed word not at the token start: 받아들일 마지막일 사람들일; Sino-Korean 일 / 요: 생일 십일 삼일 월요일 금요일 필요해요 중요해요 민요예요; the noun convention outside 하다 forms: 입학 집현전 국화전 풍속화; two words: `못 해요`, `밭 아래`; one block; non-Hangul.

**0 regressions.** After each row: `pnpm --filter @hangul-route/content-schema test`, `… mobile test`, `… web test` and `… backend test` pass (the unrelated `goals.test.ts` date test of §1.3 item 7 excepted, if it still fails on `main`); `node scripts/generate.mjs --check` is clean; `packages/content-schema/src/review-items/items-stable-id.json` has no diff; `git diff --stat content/` is empty for RG-1 and RG-2a, and for RG-2b lists exactly the 13 strings of §3.7 (or none under OD-RG1 (b) or (c)); no lesson-lint result changes.

## 4. Out of scope

- Tensification (RR does not write it), cross-word sandhi (F-CNT-002 §3.2 keeps it out).
- Any dictionary or morphological analyser; the converter stays dependency-free (F-CNT-002 C1).
- The `[져 쪄 쳐]` → `[저 쩌 처]` vowel (SP 제5항 다만 1): the converter writes the vowel as spelled, as today (§3.2).
- Rewriting the six sentence-level 기록- / 척- entries as word entries (allowed after RG-2b, not required).
- Hangul in UI copy (`packages/i18n`, `content/i18n/ko`): it carries no romanization.

## 5. UI sketch

None: no screen changes. RG-2a and RG-2b change the romanization text on existing screens (13 stored values; the composed line on the Write Frame, lecture and Discover-note screens), in the existing layout.

## 6. Tests

| File | Level | Row | Covers |
|---|---|---|---|
| `packages/content-schema/src/__tests__/romanization-rr.test.ts` | unit | RG-1, RG-2b | §3.8 RG-1 vectors; the limit block `:253-267` keeps ㄴ-insertion only; `predicateH` vectors (RG-2b) |
| `…/romanization-reviewed.test.ts` (new) | unit | RG-2a | whole-string entry, word entry inside a sentence and a frame piece, no entry = `romanize`, normalised output |
| `scripts/__tests__/` (the `build-week-drops` test) | unit | RG-2a | a drop item with an entry word passes with the entry value and fails with the converter value |
| the tests and call sites of §3.3 | unit | RG-2a | unchanged expectations (no entry word in their data today) |
| `…/romanization-gaps.test.ts` (new) | unit | RG-2b | §3.8 detector vectors; every list constant non-empty and duplicate-free |
| `…/romanization-compare.test.ts` | unit | RG-1, RG-2b | `:114` flips (RG-1); in RG-2b: `:113` (`솔잎 sollip` with no ctx now passes via the default list), `:118` (`꽃잎 kkochip` with a `kkonnip` entry now fails R1), the shipped-entries loop `:123-130` rewritten (with `{ exceptions: [] }`, and excluding confirmation entries), the literals at `:115,134` gain `gap`; R9 present / absent / folded into R1; R8's new checks; the nine-word table |
| `…/romanization-coverage.test.ts`, `…/romanization-content.test.ts`, `…/vocab-content.test.ts` | unit / integration | RG-2b | literals at `romanization-coverage.test.ts:130,135`, `romanization-content.test.ts:149`, `vocab-content.test.ts:255-256` gain `gap`; `:137` expects `[]` with a `gap`; R8 word-entry matching by checked token (`:125` still passes) |
| `…/__tests__/romanization-exceptions.test.ts` (new, or a block in the compare test) | unit | RG-2b | every shipped entry: `gap`, article, one value per word entry, the predicate reading check of §3.5 item 5 |
| `…/lesson-lint*.test.ts` | unit | RG-2b | `hasSoundChange` true for a gap word and for an entry word; no lesson finding changes |
| the data suites of §1.1 | integration | RG-2b | unchanged code; pass on the §3.7 data |

Coverage stays at 100 % lines and branches for `packages/content-schema/src/romanization/**` (CLAUDE.md §6).

## 7. Rollout and rows

No flag. Each row is one PR, merged in this order; `main` stays green after each.

| Row | Model | Content | Files | Tests | Acceptance |
|---|---|---|---|---|---|
| RG-0 | Opus 5.5 | this amendment; "Amended" line in F-CNT-002; index line | `docs/specs/AMENDMENTS-ROMANIZER-GAPS.md`, `docs/specs/F-CNT-002-romanization-policy.md` (header only), `docs/specs/README.md` | — | multi-agent review adjudicated (§10); status `ready` |
| RG-1 | Sonnet 5.5 | F1, F2, F3 (§3.2) | `packages/content-schema/src/romanization/rr.ts`, `__tests__/romanization-rr.test.ts`, `__tests__/romanization-compare.test.ts` (`:114`) | §3.8 RG-1 vectors | §3.8 "0 regressions"; no `content/` diff. **Built 2026-11-25 on `fix/romanizer-rules`**: F1 (ㄺ before ㄱ, nouns kept), F2 (밟-, 넓죽- / 넓둥- / 넓적-) and F3 (stop + 히 혀 혔 힌 힐) in `rr.ts`; the §3.8 RG-1 vectors in `romanization-rr.test.ts`; `romanization-compare.test.ts` expects `[]` for `밟다 bapda`; the `rr.ts` header lists the remaining limits |
| RG-2a | Sonnet 5.5 | `romanizeReviewed` and its users (§3.3) | `romanization/reviewed.ts` (new), `src/index.ts`, `scripts/build-week-drops.mjs`, the 7 app call-site files, `lesson-chooser.ts`, `stable-ids.ts`, the tests named in §3.3, their own tests | §6 RG-2a | §3.8 "0 regressions"; every output identical except the eight whole-string entry strings. **Built 2026-11-25 on `feat/romanize-reviewed`**: `romanizeReviewed` in `romanization/reviewed.ts` (whole-string and word entries, normalised output, entry index cached per list), exported from `src/index.ts`; `build-week-drops.mjs`, `lesson-chooser.ts`, `stable-ids.ts` and the app call sites of §3.3 (Write Frame sentence and name gloss, lecture example line, `{ko:}` tokens, story-order slot face, Voice Echo fallback, Write Frame and Type Hangul typed-text labels) switched; the §3.3 tests switched, plus new tests for each; no `content/` and no `items-stable-id.json` diff. **§3.3 step 1 compares edge-stripped text**: the text and an entry's `ko` are compared after their edge marks (`- ! ? . , ~ · …`, quotes) and spaces are removed, the way `normalizeKo` strips the end mark before `koSlug`, so `송편은 솔잎을 깔고 쪄요.` and `송편은 솔잎을 깔고 쪄요` are one entry (marks inside the text are not edges). **Accepted deviation from "identical except the eight strings"**: a whitespace-free entry also applies per token (§3.3 step 2), so over `content/**/*.json` (50,785 distinct Hangul strings and tokens) 20 outputs differ: the eight whole-string entry strings, `기록했어요.` (with its period), `호랑이가 엄마인 척해요` (without its period; an edge-stripped match of an entry), and 10 long story and source-quote prose strings that hold the token `기록했어요` (`girokhaesseoyo` becomes `girokaesseoyo`); those carry no romanization and no suite checks them. **Start bundle**: `PRECACHE_BUDGET.startBundleRaw` 4,544,600 B to 4,546,000 B; the release `build:web` (CI=1) measures 4,544,073 B raw / 1,248,797 B gzip on RG-1 and 4,545,421 B raw / 1,249,206 B gzip with RG-2a (+1,348 B raw, +409 B gzip). Splitting the `reason` texts out of `exceptions.ts` was tried and measured 4,546,245 B (Metro does not tree-shake the package, the split added a module), so it was not kept |
| RG-2b | Sonnet 5.5 | `gaps.ts`, R1 via the reviewed value, the default list, R9, R8, the `gap` field, `predicateH`, `hasSoundChange`, the §3.7 entries and corrections | `romanization/{gaps.ts,compare.ts,exceptions.ts,rr.ts}`, `src/index.ts`, `lesson-lint-items.ts`, `__tests__/helpers/{romanization-registry.ts,romanization-json-scan.ts}`, the test files of §6, the 5 content files of §3.7 | §3.8 nine-word, `predicateH` and detector tables | §3.8 "0 regressions"; `content/` diff is exactly §3.7 |
| RG-3 | Sonnet 5.5 | closing docs: F-CNT-002 §3.2 (algorithm steps for F1 to F3, "Known limits" = rows 4 to 7 and their detection, the 밟다 golden vector `bapda`), §3.3 (R1 against the reviewed value, R8, R9 in the rule table, C7 wording), §5; one line in the content skill ("a `romanization-gap` finding needs an entry; look the word up in 표준국어대사전"); status and index line of this file | `docs/specs/F-CNT-002-romanization-policy.md`, `.claude/skills/content-skill/SKILL.md` (§3.3 only, as F-CNT-002's scope allows), this file, `docs/specs/README.md` | — | F-CNT-002 reads true for `main` |

## 8. Dependencies

- **Upstream**: F-CNT-002 (converter, checker, C7); the work order WO-17; the official texts of §1.2.
- **Downstream**: every content PR after RG-2b (a flagged word needs an entry); WO-15 (7-final quest; `docs/roadmap/review-2026-11/phase-2-hangul.md:213` asks its words to be checked against the converter, so RG-1 and RG-2b should merge first or with it); F-STORY-003 and F-CURR-002 lesson content (stored values).
- **Files shared with other open work**: `packages/content-schema/src/romanization/**` is touched by no other open work order. `apps/mobile/src/logic/write-frame/view.ts` and the minigame screens of §3.3 are not in the review plan's serial-merge table (`docs/roadmap/review-2026-11/README.md` §6) except `WriteFrameGame.tsx`/`TypeHangulGame.tsx`, which no WO lists; rebase mechanically if they move.

## 9. Open decisions

Each is adopted provisionally as recommended so the rows can proceed; the owner confirms or changes it.

| ID | Question | Options | Recommendation (adopted provisionally) |
|---|---|---|---|
| OD-RG1 | A noun + 하다 predicate after a stop (따뜻해요, 딱딱해요, 축하해요, 기록했어요, 척해요): write the aspiration? | (a) RR as written, read at word level: predicates aspirate (`ttatteutaeyo`), nouns keep `h` (`bukhansan`); the 13 strings of §3.7 are corrected · (b) a house rule keeping `h` everywhere (`ttatteuthaeyo`): no content edit, but the six 기록- / 척- entries are reverted and 못해요 becomes `mothaeyo`, against RR 제3장 제1항 4 · (c) defer: RG-2b confirms today's `h` values with a "pending OD-RG1" reason, a later row decides | **(a)**: it is the official rule, it is what the repo's six entries and its test fixtures already do |
| OD-RG2 | Where an override lives | (a) the shared registry `ROMANIZATION_EXCEPTIONS` with word entries and `gap` (§3.4) · (b) a per-item field `romanizationOverride: { reason }` beside each `romanization` | **(a)**: C7 already chose a reviewed registry that cleans itself (R8); every data suite already passes it; (b) needs the field in every content schema and TS type, in `extract.ts` and in all ~35 call sites, a word used in ten places would carry ten reasons, and run-time composition (§3.3) could not see it |
| OD-RG3 | Run-time romanization uses the reviewed values (row RG-2a) | (a) yes, before the detector · (b) no: a composed line can differ from the stored value of the same word | **(a)** |
| OD-RG4 | 맛있- / 멋있- (SP 제15항 다만 allows [마싣따] beside the rule form [마딛따]) | (a) keep `masisseoyo` (the converter and F-CNT-002's golden vector), detector exempt · (b) switch to `madisseoyo` | **(a)**: both are standard; no content change |
| OD-RG5 | R9 severity | (a) error at once · (b) warning for one release | **(a)**: today's content passes after §3.7, so an error costs nothing now |
| OD-RG6 | Every stop + 하다 predicate needs a word entry (one per inflected form: 생각해요, 생각했어요, …) | (a) accept, entries are cheap and the R9 message gives the exact line to paste · (b) make the converter assume a predicate when the 하다 block is followed by a verb ending, and require entries for nouns instead | **(a)** for now: (b) guesses the part of speech from endings (북한 / 착한 both end in 한) and would put a guess into the converter; revisit if Stage 3+ PRs add more than about 20 such entries |

## 10. Multi-agent review

Two independent reviewers read revision 1: one checked Korean phonology and RR against the official texts (fetched separately), one checked engineering feasibility against the converter, checker and content (with its own prototypes of RG-1 and the detectors). Their findings and what revision 2 did:

| # | Lens | Finding | Verdict | Change |
|---|---|---|---|---|
| E1 | eng (blocker) | An entry only *added* an allowed value: after `따뜻해요 → ttatteutaeyo`, a stored `ttatteuthaeyo` still passed R1 and R9 stayed quiet, the exact trap this amendment closes | accepted | R1 compares with `romanizeReviewed`; an entry excludes the converter value unless it lists it (§3.5 item 1); `:118` flips |
| E7, E6 | eng | Word-by-word alignment on R3 is fragile (R3 counts tokens `romanize` drops); R1's message and fallback still named the converter | accepted | alignment removed; R1 and its message use the reviewed value |
| E2, E3 | eng | Unnamed tests break: `compare.test.ts:113,123-130`; literals with no `gap` in 4 more test files; `coverage.test.ts:137` | accepted | listed in §6 and RG-2b's files |
| E4 | eng | R8's substring search over raw file text keeps a word entry alive for ever (북한산 inside 북한산국립공원 in a source quote) | accepted | word entries match whole tokens of checked strings (§3.5 item 4) |
| E5 | eng | Entry counts wrong (6 predicate, 2 n-insertion); the predicate check could not run on whole-string entries | accepted | counts fixed; `predicateH` on `romanize` too, compact comparison, a machine-checkable noun reason |
| E8, E15, E17, E18 | eng | More strict-equality tests and run-time sites (vocab tables, role-play, catalogue fields, stable-id label and fallback, lesson-chooser search); `allowed[0]` not normalised; a window between RG-2 and RG-2b in which Write Frame disagrees; `koSlug` could use the reviewed value for new items | accepted | new row **RG-2a** lands `romanizeReviewed` and every user first (§3.3), normalised output; the detector row became RG-2b |
| E9 | eng | `hasSoundChange` gates Dictation but would still call a corrected predicate or a ㄴ-insertion word "no sound change" | accepted | §3.5 item 6 |
| E10, E13 | eng | 10 tokens fire, not 8; 홑이불 gives two gaps | accepted | §3.6 count; tests assert inclusion |
| P2 | phon | `predicateH` only aspirated the stop right before the 하다 block: 입학해요 gave `iphakaeyo`, 약혼해요 went undetected, while 축하해요 was read at word level | accepted | word-level reading: in a token with a 하다 block, every stop + ㅎ aspirates and is detected (§3.5 item 5, §3.6) |
| P9, E14 | phon, eng | Before a 하다 block ㄷ must give ㅌ, not ㅊ (SP 제12항 붙임 2; 낮 한때 [나탄때]) | accepted | §3.5 item 5 |
| P3 | phon | 묻혀 `muchyeo` and 잊혀 `ichyeo` are not the pronunciation: SP 제5항 다만 1 gives [무처], [이처] | accepted | kept as a declared house convention (spelled vowel, as 가져 `gajyeo`), not called correct RR (§3.2, §3.8) |
| P4, E12 | phon, eng | The closed grammatical-tail list misses copula forms after ㅅ (것인데, 것일까요, 무엇인가요, 곳인가요) | accepted | copula stems and forms added (§3.6) |
| P5 | phon | "token contains a listed word" over-fires (받아들일, 마지막일, 사람들일) | accepted | the token must start with the word |
| P6, P7, E11 | phon, eng | Misses: native numbers (붙임 2 서른여섯 스물여섯; 열여섯 열여덟 열일곱), 십육, 큰일, 볼일, 일일이, 유들유들, 제15항's 젖어미 and 값어치 | accepted | heads 유들 여섯 여덟 일곱 어미 어치 and words 십육 큰일 볼일 일일이 궂은일 뒷일 훗일 added; the coverage claim narrowed (the 다만 reduplications are not covered) |
| P8 | phon | SP 제10항 해설 also names 넓적하다 [넙쩌카다] | accepted | F2 covers 넓 before 적; vector 넓적다리 `neopjeokdari` |
| P10 | phon | 역, 약, 율 fire on common Sino-Korean words with no insertion | accepted | named in the false-positive policy (§3.6) |
| P11, P12, P13 | phon | Cite 제29항 붙임 2 다만 for 송별연 / 등용문; the RR [붙임] is unnumbered and covers all of 제1항; the 다만 names ㄱ ㄷ ㅂ only (ㅈ/ㅊ nouns rest on [ㄷ]); loanword compounds can hold 히 | accepted | §1.2, §3.1 |
| P14 | phon | 제15항 해설 sends a following ㅣ-type content morpheme to ㄴ-insertion, so `cheodinsang` is not backed by 제15항 | accepted | §1.3 item 6; the test still only requires an override |
| P1 | phon | "첫 ends in ㅊ, so `saisiot` cannot fire on 첫인상" | **rejected** | 첫 is ㅊ + ㅓ + final **ㅅ**; the detector prototype gives `juncture` and `saisiot`, and the engineering reviewer confirmed it (E13) |
| E16 | eng | §3.6 cited 북한산's `ko` lines and 따뜻해요's romanization lines | accepted | all romanization lines |

Both reviewers confirmed: the nine measured outputs; every `file:line` citation checked at `8676b5de5`; the official quotes of RR 제3장 제1항 (items, 다만, [붙임]) and of SP 제10, 11, 12, 15, 17, 29 and 30항; the RG-1 vectors (an independent prototype changed 33 outputs over 24,092 Hangul runs in tracked files, none of them a stored romanization); the ㄺ noun list; the F3 block set; the §3.7 inventory (no other stored copy, generated chunks untracked, ids and overlays untouched); `build-week-drops.mjs` as the only build step demanding the converter's exact output; and that the rows merge in order with `main` green.
