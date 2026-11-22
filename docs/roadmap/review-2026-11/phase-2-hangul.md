# Phase 2 — Stage 1 한글 교육 (WO-10 – WO-18)

먼저 `README.md` 를 읽는다. 이 Phase 의 목적은 "Stage 1 을 마치면 한글을 읽을 수 있다"를 참으로 만드는 것이다. 콘텐츠를 바꾸는 WO 는 `.claude/skills/content-skill/SKILL.md` 와 `docs/workflows/new-content.md` 를 따른다.

Stage 1 의 실제 위치(리뷰에서 확인):
- 퀘스트 16개: `apps/mobile/src/content/quests.ts`
- 게임 스코프: `apps/mobile/src/logic/minigame-config.ts`
- 자모 레코드와 소리 힌트: `apps/mobile/src/content/jamo.ts`
- 웹 사이트용 레코드: `content/episodes/stage-1/jamo.json`, `cards.json`
- Stage 1 로직: `apps/mobile/src/logic/stage1/` (`hangul-check.ts`, `discover-flow.ts`, `stage-complete.ts`, `confusables.ts` …)
- 사양: `docs/specs/F-QUEST-002-discover-check-stage1-complete.md`, `AMENDMENTS-AUDIO-CLIPS.md`, `F-CURR-002-category-expansion-and-mastery.md`, `F-CNT-002`(로마자 정책)

이미 지켜지고 있어서 **깨면 안 되는 것**: (1) 읽기 단어와 음절 선택지는 그때까지 배운 기호만 쓴다(해독 가능성, 위반 0건). (2) 로마자는 국어의 로마자 표기법, 변환기 대조 lint. (3) 받침 선택지는 종성만 다르게(`lp.syl`).

---

## WO-10 Hangul Check 와 퀘스트 Check 가 해독을 측정하게

> 재확인 2026-11-21 (main `d5ba0217c`): 일부 완료 — DC-1 의 "퀘스트 Check" 부분은 `AMENDMENTS-AUDIT-2026-11.md` AU-8 (#1035, 오너 결정 2026-11-15) 이 했다: 소리를 들려주는 퀘스트 Check(Listen and Pick 의 Quick check)에서 선택지의 로마자는 정답을 누를 때까지 그리지 않고(자리는 남김, opacity 0, 접근성 트리 밖), 접근성 이름은 그대로다(`apps/mobile/src/logic/listen-pick-flow.ts:304-317` 의 `heldRomanization`, `KoreanText`·`ChoiceCard` 의 `romanizationReserved`). CLAUDE.md §1 과 F-CNT-002 머리말에 이 예외 한 줄이 들어갔다. 남은 것: Hangul Check, Stage Check, Daily Review 의 read/produce 단계, 텍스트 프롬프트 Check, Read Pick Meaning Check 의 프롬프트 로마자(AU-8 As built 의 "Not covered"), 다른 게임으로 만든 Check, Build a Letter, 그리고 DC-2 · DC-3 전부. DC-1 은 새 override 를 만들지 말고 AU-8 의 `heldRomanization` 방식을 넓힌다. 아래 줄 번호는 고쳤다.

**선행.** OD-R1 중 "Check 계열은 로마자 숨김" 부분.

**목표.** Stage 1 의 평가가 "글자를 보고 소리를 안다"를 측정한다. 로마자 대조나 이름 맞히기로는 통과할 수 없다.

**근거.**
- 확인: `packages/content-schema/src/schemas/locale.ts:39` `romanizationMode` 기본 `'always'`. `apps/mobile/src/logic/locale/romanization-mode.ts` 의 `resolveRomanizationMode` 가 override → 프로필 설정 → `always` 순.
- 확인: 배치 평가에는 해독 문항이 이미 있다. `content/placement/syllable-reading.json:383` `pitem:syl-cv-see-geu` 등. `packages/content-schema/src/placement/run.ts:141-143` 은 `leaks` 플래그가 있는 문항을 `revealMode === 'always'` 일 때 건너뛴다.
- 보고: `apps/mobile/src/logic/listen-pick-flow.ts:309` 글자 선택지에 로마자가 붙는다(AU-8 뒤로 퀘스트 Check 에서는 `:316-317` 에서 보류). `screens/minigames/BuildLetterGame.tsx:210, 323-330` 목표 음절과 타일에 로마자.
- 보고: `apps/mobile/src/logic/stage1/hangul-check.ts` — 글자 24문항이 "이름 듣고 글자 고르기", 단어 5문항이 "듣고 그림 고르기". 보호자용 판정 `stage1Anchor.met`(27/30)이 이 문항으로 계산된다.
- 보고: F-QUEST-002 §3.8 Stage 완료는 "at any star count".

**사양.** `docs/specs/AMENDMENTS-STAGE1-DECODING-CHECK.md` — F-QUEST-002 §3.8, §3.9(Hangul Check), F-RVW-001 수정.

| 행 | 모델 | 내용 |
|---|---|---|
| DC-0 | Opus 5.5 | 사양 + `design/wireframes/reviews/hangul-check.md` 갱신 |
| DC-1 | Sonnet 5.5 | Check·Hangul Check·Stage Check 화면에서 로마자 숨김(override) |
| DC-2 | Opus 5.5 | Hangul Check 에 해독 구간 추가(문항 생성 로직 + 테스트) |
| DC-3 | Sonnet 5.5 | 단어 문항을 "글자 보고 그림 고르기"로, `stage1Anchor.met` 재정의, 보호자 문구 |

**사양이 정해야 할 것 (DC-0).**
1. **로마자 숨김 범위.** 퀘스트의 Check 단계, Hangul Check, Stage Check, Daily Review 의 read/produce 단계에서 채점 전에는 로마자를 그리지 않는다. 정답 확정 뒤에는 보여준다(학습 기회). 구현은 화면이 `resolveRomanizationMode` 에 override 를 넘기는 방식. 데이터의 `romanization` 필드는 그대로 둔다. 스크린리더 레이블(로마자 음가로 읽는 `logic/korean-labels.ts`)은 그대로 둔다: 시각 숨김이지 접근성 정보 삭제가 아니다. 이 점을 사양에 명시한다.
2. **해독 문항 형식.** `see-pick-sound`: 음절을 보여주고 소리 3–4개 중 고른다(녹음 클립). 선택지는 소리로 확실히 구별되는 것만: 초성이 다른 것, 모음이 다른 것. 평음/격음처럼 클립 품질에 좌우되는 대립은 WO-16 이 다룬다.
3. **구성(권고).** 기존 35문항 중 이름 문항 24개를 이름 12 + 해독 12(CV 6, CVC 6)로 바꾼다. 총 길이를 늘리지 않는다. 해독 문항의 음절은 **퀘스트에서 읽기 단어로 나오지 않은 조합**을 우선한다(외운 단어가 아니라 해독인지 보려는 것).
4. **`met` 재정의.** 보호자 리포트의 Stage 1 anchor 는 "해독 문항 12개 중 11개 이상 + 글자 문항 기준 유지". 비게이트 원칙은 유지: 학습자 화면은 통과/실패를 말하지 않는다.
5. **이미 Hangul Check 를 본 학습자.** 과거 결과는 그대로 두고 새 버전에 `version` 을 붙인다. 리포트는 최신 버전 결과를 쓴다.
6. F-CURR-002 CM-32 의 Decoding Sprint held-out probe 와의 관계(중복인지, 대체인지).

**테스트.** 문항 생성: 해독 12문항이 모두 Stage 1 30기호 안의 조합이고 퀘스트 읽기 단어 목록과 겹치지 않음. 선택지 간 소리 대립이 허용 목록 안. 화면: Check 중 로마자 텍스트가 렌더되지 않고 정답 뒤 렌더됨. 접근성 레이블은 변하지 않음.

**수용 기준.** 로마자만 읽을 줄 아는 가상의 응답자(한글을 무시하고 로마자 일치로 답하는 테스트 봇)가 Check 를 우연 수준 이상으로 통과하지 못한다. 이 봇을 테스트로 만든다.

**하지 말 것.** 학습자에게 점수나 불합격을 보여주지 않는다. 문항 수를 늘려 4분을 넘기지 않는다. 데이터에서 로마자를 지우지 않는다.

**예상.** 사양 0.75d, 구현 2d.

---

## WO-11 로마자 의존을 단계적으로 줄이기

**선행.** OD-R1.

**목표.** 학습이 진행될수록 로마자가 기본으로 덜 보인다. 언제든 한 번 탭으로 볼 수 있다.

**근거.** WO-10 의 근거. 설정은 `'always' | 'tap'` 둘뿐이고 단계에 따른 전환이 없다. `packages/i18n/src/romanization.ts:9` `romanizationShown(mode, revealed)`.

**사양.** `docs/specs/AMENDMENTS-ROMANIZATION-FADE.md` — F-CNT-002, F-I18N-001 D2 수정.

| 행 | 모델 | 내용 |
|---|---|---|
| RF-0 | Opus 5.5 | 사양 |
| RF-1 | Sonnet 5.5 | "자동" 모드 추가와 단계별 해석 |
| RF-2 | Sonnet 5.5 | Profile 의 설정 UI, 전환 시 한 번 보이는 안내 |

**설계(권고, OD-R1 로 확정).**
- 모드를 셋으로: `auto`(새 기본), `always`, `tap`. 기존 프로필의 명시적 설정은 건드리지 않는다. 설정이 없던 프로필은 `auto`.
- `auto` 의 해석(순수 함수, `logic/locale/`):
  - Stage 1 q1–q10: 표시.
  - Stage 1 q11 이후: **배운 기호만으로 된 읽기 단어**는 `tap`, 주제어(아직 못 읽는 글자가 든 단어)는 표시.
  - Word Builder(Stage 2 letters) 완료 후: 전부 `tap`.
- 처음 `tap` 으로 바뀌는 순간 Hoya 한 줄: "You can read these now. Tap a word to see the letters in English." (문구는 사양에서 Pre-A1 로 확정.)
- 한국어 UI 에서의 로마자 정책은 F-I18N-001 의 기존 결정을 따른다.

**테스트.** 해석 함수의 표(진도 × 단어 종류 → 표시 여부). 스키마 마이그레이션: 기존 `always` / `tap` 저장값 보존.

**수용 기준.** 새 프로필이 q11 에서 읽기 단어의 로마자가 접힌 상태로 시작하고 탭하면 보인다. 기존 프로필의 선택은 그대로다.

**하지 말 것.** 로마자를 완전히 없애는 모드를 만들지 않는다(CLAUDE.md: 가르치는 한국어는 항상 로마자를 가진다 → `tap` 으로 닿을 수 있어야 한다).

**예상.** 1.5d.

---

## WO-12 Stage 1 콘텐츠 정확도 일괄 수정

> 재확인 2026-11-21 (main `d5ba0217c`): 일부 완료 — #8 의 그림은 `AMENDMENTS-PICTURES-2026-11.md` PX-2 (#1039) 가 방패연(직사각형, 가운데 구멍)으로 다시 그렸다(`docs/design/picture-review-2026-11/triage.md:40`, `HeritageCardArt/__tests__/stage1-art.test.ts`). 남은 것은 문구: `apps/mobile/src/content/heritage-cards.ts:65` 가 아직 "A diamond kite painted with a tiger's face.". #12 와 같은 방향의 일은 AU-15 (#1035) 가 했다: Stage 1 한 줄 소개, 완료 화면("You can read basic Hangul now!", "the basic letters and six final sounds"), 사전 6줄, Stage 2 Letters Volume 2 소개를 en/es/ko 에서 낮췄다(`apps/mobile/src/content/stages.ts`, `packages/i18n/src/__tests__/stage1-claims.test.ts`). 그러나 #12 가 가리키는 `quests.ts:595` 의 "Now you can read it too!" 는 그대로다. 나머지 행(#1–#7, #9–#11, #13)의 인용 파일(`jamo.json`, `jamo.ts`, `minigame-config.ts`, `quests.ts`)은 바뀌지 않았다. ko 오버레이 `content/i18n/ko/stage1-jamo.json` 은 #1044 의 한국어 다듬기로 일부 바뀌었지만 #1 의 ㅡ 설명("u와 i 사이")은 그대로다.

**목표.** 리뷰가 찾은 작은 오류와 불일치를 한 번에 고친다. 결정이 필요 없는 것만 모았다.

**사양.** `docs/specs/AMENDMENTS-STAGE1-CONTENT-FIXES.md`. 표 하나에 행마다 "현재 → 변경" 을 적는다.

| 행 | 모델 | 내용 |
|---|---|---|
| CF-0 | Opus 5.5 | 사양(아래 표를 인용 재확인 후 확정, 변경 문구 작성) |
| CF-1 | Sonnet 5.5 | 앱 콘텐츠(`quests.ts`, `minigame-config.ts`, `jamo.ts`) |
| CF-2 | Sonnet 5.5 | 웹 레코드(`jamo.json`)와 es/ko 오버레이의 대응 항목 |

**고칠 것.**

| # | 현재 (근거) | 변경 |
|---|---|---|
| 1 | 확인: `content/episodes/stage-1/jamo.json:292` `"EU — a soft sound between 'u' and 'i'"`. ko 오버레이도 같은 설명(보고) | 앱 힌트와 통일: "say oo with flat lips". `apps/mobile/src/content/jamo.ts` 의 `SOUND_HINTS` 가 기준 |
| 2 | 보고: `jamo.json` 의 `"G — sounds like the start of 'go'"`, `'door'`, `'boy'`. `jamo.ts:19` 의 규칙 "no voiced English claims" 와 충돌 | `SOUND_HINTS` 문구로 교체 |
| 3 | 보고: `jamo.json` 의 `으뜸` gloss `"first"` | "the best" |
| 4 | 확인: `apps/mobile/src/logic/minigame-config.ts:151` `word('설', 'seol', 'New Year (short for seollal)')` | "New Year's Day" (설은 줄임말이 아니다) |
| 5 | 보고: `minigame-config.ts:383` 첫 받침 퀘스트 Check 가 `lp.word(W.seollal, [W.seol, W.nal, W.dal])`. `quests.ts:283` 설날 `syllables: ['seol', 'lal']` | Check 단어를 달/물/문/산 조합으로. 설날은 주제어 페이지에만 두고 `noteEn`: "seol + nal sounds like seollal." |
| 6 | 보고: `jamo.ts:160` ㄹ 의 IPA `'r'` | `'ɾ'` |
| 7 | 보고: 받침 ㄹ 힌트 "like l in ball" | "a light l. The tip of your tongue stays up." |
| 8 | 보고: `card:kite` 의 "diamond kite" 와 "Bangpaeyeon(방패연)" 불일치 | 방패연은 직사각형 방패 모양. **그림은 PX-2 (#1039) 로 방패연이 됐다.** 남은 것: `heritage-cards.ts:65` 의 "A diamond kite …" 문구를 그림에 맞춘다 |
| 9 | 보고: `jamo.ts` 의 `exampleWordKo` 토끼(ㄲ), 책(ㅐ), 아빠(ㅃ), 으뜸(ㄸ) — Stage 1 에서 안 배운 글자. `deck-builder.ts:485` 와 ko 힌트에 노출 | Stage 1 기호만으로 된 단어로: ㅌ 토마토, ㅊ 차, ㅇ 아기, ㅡ 그림 등. 각 글자의 도입 퀘스트 시점에 해독 가능한 단어인지 표로 검산 |
| 10 | 보고: q6(`life-q3`) 읽기 단어 4개가 모두 외래어(쿠키, 토마토, 코코아, 토스트) | 고유어·한자어를 절반 이상: 코, 키, 도토리, 기타 등. 해독 가능성 검산 필수 |
| 11 | 보고: 연음 설명이 놀이(`quests.ts:535`) 한 번뿐 | q11–q15 읽기 통합 퀘스트에 연음 단어 2–3개와 같은 형식의 `noteEn` 추가(음악, 한국어, 목요일 중 해독 가능한 것) |
| 12 | 확인: `quests.ts:595` "King Sejong made Hangul so everyone could read. Now you can read it too!" (Stage 1 은 받침 6개, ㅐㅔ·경음·이중모음 없음) | "Now you can read your first words too!" 수준으로. WO-15 가 범위를 넓히면 그때 되돌릴 수 있다 |
| 13 | 보고: 초성 ㅇ 을 "이응"으로만 들려줘 묵음을 귀로 확인할 수 없음 | Discover 의 ㅇ 페이지에 "아 · 오 · 우" 연속 재생 버튼. 새 클립이 필요하면 F-AUDIO-004 파이프라인(음성 고정, QA, 오너 청취)을 따른다 |

**검산 스크립트.** 리뷰는 q1–q15 읽기 단어를 자모로 분해해 "그때까지 배운 기호만 쓰는지" 스크립트로 확인했다. 같은 검사가 lint(`packages/content-schema/src/lesson-lint*.ts`)나 테스트로 이미 있는지 확인하고, 없으면 CF-1 에서 테스트로 추가한다. #9, #10, #11 은 이 검사를 통과해야 한다.

**테스트.** 위 검산. 로마자 변환기 대조 lint 통과. `jamo.json` ↔ `SOUND_HINTS` 일치 테스트(둘이 다시 어긋나지 않게).

**수용 기준.** 표 13행이 모두 반영되고 해독 가능성 위반 0건이 유지된다.

**하지 말 것.** 자모 도입 순서를 바꾸지 않는다(그건 별도 판단: §"이 Phase 에 넣지 않은 것"). 한국어 문장을 새로 쓰는 범위로 넓히지 않는다.

**예상.** 사양 0.5d, 구현 1d. 새 클립(#13)은 별도.

---

## WO-13 Discover 에서 소리를 먼저 듣게

> 재확인 2026-11-21 (main `d5ba0217c`): 줄 이동·맥락 변경 — `learner.ts:761` 은 `:765` 로 옮겨졌다. AU-10 (#1035) 이 Look and learn 페이지가 열릴 때 첫 글자의 `hear` 를 한 번 자동 재생하게 했고(QS-3 (#1038) 으로 350ms 뒤), 그 `hear` 는 지금 자음의 **이름**(기역)이다(`apps/mobile/src/logic/stage1/discover-flow.ts:214, 228` `loneLetterVoice`, `:417-420` `autoHearId`). 그래서 q1 학습자는 ㄱ 페이지에서 누르기도 전에 "기역" 을 듣는다. 이 WO 의 근거가 더 강해졌다. 자동 재생은 `item.hear` 를 따르므로 SF-1 이 버튼 순서를 바꾸면 자동 재생도 소리로 바뀐다(테스트로 고정). `design/wireframes/quest/discover.md` 에는 QB 절(Previous)이 추가됐다. SF-0 은 그 위에 고친다.

**선행.** OD-R2.

**목표.** 글자를 처음 만나는 화면에서 첫 번째 버튼이 소리(가, 나…)이고 이름(기역)은 두 번째다. 화면의 힌트 문구와 재생되는 소리가 일치한다.

**근거.**
- 확인: `docs/specs/AMENDMENTS-AUDIO-CLIPS.md:78` — AU-OD-1(2026-10-29) 이름 규칙, "option B … is one table change; tests are written against `jamoVoice`". `:507` 같은 내용.
- 확인: `packages/i18n/src/messages/en/learner.ts:765` `soundWith: { cta: 'Hear it with a vowel' }` (두 번째 버튼).
- 보고: 글자 아래 힌트는 소리를 설명("a soft, light g")하는데 메인 버튼은 이름을 재생한다.

**사양.** `AMENDMENTS-AUDIO-CLIPS.md` 에 절 추가(오너 결정 날짜 인용).

| 행 | 모델 | 내용 |
|---|---|---|
| SF-0 | Opus 5.5 | 사양 + `design/wireframes/quest/discover.md` 갱신 |
| SF-1 | Sonnet 5.5 | Discover 버튼 순서·라벨, 퀘스트 Check 1번을 소리 문항으로 |

**설계.** Discover: 큰 버튼 "Hear the sound" → 결합 음절(가). 작은 버튼 "Hear its name" → 기역. 퀘스트 Check 1번은 기존 문구 `startsWith`("어떤 글자로 시작하나요?")를 쓰는 소리 문항. 이름 문항은 Hangul Check 의 이름 구간(WO-10)에만 남긴다. Match Sound 등 게임의 `jamoVoice` 표를 어디까지 바꿀지는 OD-R2 의 결정 범위에 따른다.

**테스트.** `jamoVoice` 표 테스트(사양 §6 의 기존 테스트)를 결정에 맞게 갱신. Discover 화면의 첫 버튼이 결합 음절 클립을 재생.

**수용 기준.** q1 학습자가 ㄱ 을 처음 누르면 "가"를 듣는다.

**예상.** 0.75d.

---

## WO-14 새 글자마다 따라 쓰기

**선행.** WO-02, WO-03(SO-2 까지).

**목표.** 글자를 가르치는 퀘스트(q1–q10)마다 새 글자를 한 번씩 따라 쓴다.

**근거.** 보고: 30기호 중 따라 쓰기 대상은 q2 의 ㅁㅇㅗㅜ 와 q12 의 받침 ㅁㅂㄹㅇ 뿐이다. 쓰기는 닮은 글자(ㅓ/ㅏ, ㄷ/ㄹ) 변별에 유효하다.

**사양.** `AMENDMENTS-STAGE1-CONTENT-FIXES.md` 와 별도로 `AMENDMENTS-STAGE1-TRACE-COVERAGE.md`. F-QUEST-002 의 퀘스트 길이 규칙(4–5분, 3–7단계)을 지켜야 한다.

| 행 | 모델 | 내용 |
|---|---|---|
| TC-0 | Opus 5.5 | 사양: 퀘스트별 단계 표(무엇을 빼거나 줄여 시간을 맞추는지) |
| TC-1 | Sonnet 5.5 | `minigame-config.ts` 스코프와 `quests.ts` 단계 |

**설계 제약.** 퀘스트 시간을 늘리지 않는다. 방법은 둘 중 하나를 사양에서 고른다: (a) practice 단계의 Match Sound 라운드 수를 줄이고 Trace 2–4라운드를 넣는다. (b) Trace 를 Discover 직후의 짧은 1획 연습("한 번 써 보기", 채점 없음)으로 넣는다. (b) 가 anti-shame 과 시간 면에서 유리하다(권고).

**수용 기준.** q1–q10 의 새 기호 30개가 모두 한 번 이상 따라 쓰기에 나온다. 퀘스트 예상 시간이 5분을 넘지 않는다.

**예상.** 1d.

---

## WO-15 [t] 받침, 겹받침, ㅎ 받침

**선행.** OD-R9.

**목표.** 본문에 나오는데 어디서도 가르치지 않는 받침을 가르친다.

**근거.**
- 보고: Stage 1 의 받침은 ㄱㄴㄹㅁㅂㅇ 6개(`jamoBatchim`). [ㄷ] 류(ㅅㅈㅊㅌㄷㅆ)는 Stage 2 `content/episodes/stage-2/letters.json` q5, ㅋㄲㅍ 는 q6.
- 보고: F-CURR-002 §5.2 "A batchim quest for the 7 representative final sounds" 는 "later row" 로 미구축. 겹받침과 받침 ㅎ 은 어느 경로에서도 읽기 대상으로 가르치지 않는데 Stage 2–4 본문에 않고, 많이, 없는, 읽는, 좋아요, 넣고가 나온다. 그래서 `없어요, 읽어요` 가 채점 라운드에서 제외돼 있다(F-CURR-002 597행 부근).

**사양.** F-CURR-002 §5.2 의 미구축 행을 구체화하는 `AMENDMENTS-BATCHIM-COMPLETE.md`.

| 행 | 모델 | 내용 |
|---|---|---|
| BC-0 | Opus 5.5 | 사양: 퀘스트 2개의 학습 목표, 단어, 발음 노트, 위치 |
| BC-1 | Opus 5.5 | 콘텐츠 작성(Word Builder 에 "7 final sounds" 정리 퀘스트, "two letters at the bottom" 퀘스트) |
| BC-2 | Sonnet 5.5 | 스코프·lint·오디오 매니페스트 연결, 채점 제외 목록에서 해당 단어 해제 |

**콘텐츠 지침 (BC-1).**
- 퀘스트 A "일곱 가지 끝소리": 받침 글자는 많지만 끝소리는 [ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅇ] 일곱이라는 것을 표 하나로 정리. 예: 옷·꽃·낮·밭 이 모두 [ㄷ] 으로 끝난다. Stage 2 q5, q6 을 대체하지 않고 그 뒤의 정리 퀘스트로.
- 퀘스트 B "아래에 글자가 둘": 인식 목표만. 고빈도 다섯 가지 — ㄶ(많이, 않아요), ㄺ(읽어요, 닭), ㅄ(없어요, 값), ㄻ(삶), 받침 ㅎ(좋아요, 넣어요). 규칙 전체가 아니라 "뒤에 모음이 오면 뒤 글자가 넘어간다"(읽어요 [일거요], 없어요 [업써요])와 "ㅎ 은 모음 앞에서 사라진다"(좋아요 [조아요]) 두 가지만.
- 퀘스트당 새 항목 수 규칙(F-CURR-001 §3.1: 1문형·4단어 이하)에 맞추려면 B 를 둘로 나눌 수 있다. 사양에서 정한다.
- **로마자 주의.** `packages/content-schema/src/romanization/rr.ts` 는 ㄺ+ㄱ(읽고 → `ikgo`, 올바른 값 `ilgo`) 등을 잘못 낸다(WO-17). 이 퀘스트의 단어는 변환기 출력과 대조해 틀리면 예외로 등록한다. WO-17 을 먼저 하거나 함께 한다.
- 발음 표기는 Stage 2 letters.v2 q3 의 기존 형식(`국물[궁물]`)을 따른다.

**수용 기준.** Stage 2–4 채점 라운드의 제외 목록에서 겹받침·ㅎ 받침 단어가 빠진다(가르친 뒤이므로). 해독 가능성 lint 통과.

**하지 말 것.** 표준 발음법 조항 전체를 가르치려 하지 않는다. Stage 1 의 16퀘스트 구성을 바꾸지 않는다(OD-R9 권고대로라면).

**예상.** 사양 0.75d, 콘텐츠 1.5d, 연결 0.5d. 새 클립 QA 별도.

---

## WO-16 평음·격음·경음 듣고 구별하기

**목표.** 영어·스페인어 화자에게 가장 어려운 세 갈래 대립을 귀로 훈련한다.

**근거.**
- 보고: `apps/mobile/src/logic/minigame-config.ts:710-713` 주석 — 소리로만 구별되는 선택지(바/파, 어/오)를 Check 에서 의도적으로 뺀다("a device voice must not decide this Check").
- 보고: Stage 2 q2(경음)는 그림-단어와 받아쓰기뿐이고 최소대립쌍이 없다.
- 보고: 클립은 이제 단일 음성(Polly Seoyeon) + 강제 선택 QA + 오너 청취를 거친다. `content/audio/pronunciation-overrides.json` 에 "바 → 파로 들림", "까 → 가로 들림" 같은 실제 문제 기록이 있다. 즉 **이 대립은 TTS 가 가장 자주 틀리는 곳**이다.

**사양.** `docs/specs/AMENDMENTS-MINIMAL-PAIRS.md` — F-QUEST-002, F-AUDIO-004 수정.

| 행 | 모델 | 내용 |
|---|---|---|
| MP-0 | Opus 5.5 | 사양: 쌍 목록, 클립 품질 관문, 폴백 규칙 |
| MP-1 | Sonnet 5.5 | 클립 생성·QA 파이프라인 실행(F-AUDIO-004 절차), 매니페스트 |
| MP-2 | Sonnet 5.5 | Listen & Pick 스코프 추가(q6, Stage 2 q2), 폴백 시 건너뛰기 |
| MP-3 | 오너 | 클립 청취 승인 |

**설계.**
- 음절 쌍: 가/카/까, 다/타/따, 바/파/빠, 자/차/짜, 사/싸. 단어 쌍(Stage 2): 달/탈/딸, 불/풀/뿔, 방/빵, 자다/차다/짜다 중 그 시점에 해독 가능한 것.
- Stage 1 q6 은 평음/격음만(경음은 Stage 2 에서 배운다).
- **품질 관문.** 한 묶음(예: 가/카/까)의 세 클립이 모두 QA 를 통과하고 오너 청취로 "서로 구별된다"가 확인된 묶음만 출제한다. 통과하지 못한 묶음은 스코프에서 빠진다.
- **폴백.** 녹음 클립이 없고 기기 음성으로 재생되는 상황이면 이 라운드를 건너뛴다(주석의 기존 원칙 유지).
- **채점.** 연습(practice) 단계에만 넣고 Check 에는 넣지 않는다. 이 대립은 초보자에게 원래 어렵다. 별에 불리하게 작용하지 않게 한다.
- 오답 피드백: 두 소리를 연달아 다시 들려주고("Listen: 가 … 카") 차이를 한 줄로("카 has a puff of air").

**수용 기준.** 승인된 묶음만 출제된다. 클립이 없으면 라운드가 조용히 빠진다. 별 계산에 영향이 없다(테스트).

**하지 말 것.** 기기 TTS 로 이 대립을 채점하지 않는다.

**예상.** 사양 0.5d, 클립 1d, 구현 1d.

---

## WO-17 로마자 변환기의 빈 규칙을 lint 로 막는다

**목표.** 변환기가 틀리게 내는 패턴의 단어가 콘텐츠에 들어올 때, lint 가 "변환기와 일치"를 강제해 오답을 굳히지 않게 한다.

**근거.** 보고(리뷰가 `packages/content-schema/src/romanization/rr.ts` 를 직접 실행): 읽고 → `ikgo`(ilgo), 맑게 → `makge`(malge), 깻잎 → `kkaesip`(kkaennip), 색연필 → `saegyeonpil`(saengnyeonpil), 서울역 → `seouryeok`(seoullyeok), 맛없어요 → `maseopseoyo`(madeopseoyo), 첫인상 → `cheosinsang`(cheodinsang), 못해요 → `mothaeyo`(motaeyo), 좁히다 → `jophida`(jopida). 문서에 적힌 한계는 ㄴ 첨가, 밟-, 잡혀뿐이다. 현재 콘텐츠에는 이런 단어가 없다.

**사양.** `F-CNT-002` 수정 `AMENDMENTS-ROMANIZER-GAPS.md`.

| 행 | 모델 | 내용 |
|---|---|---|
| RG-0 | Opus 5.5 | 사양: 패턴별로 "변환기를 고친다 / lint 로 예외 등록을 강제한다" 중 선택 |
| RG-1 | Sonnet 5.5 | 규칙적으로 고칠 수 있는 것 구현(ㄺ+ㄱ → ㄹ 발음, 용언 ㅎ 축약 표기) |
| RG-2 | Sonnet 5.5 | 사전 지식이 필요한 패턴 감지 lint(ㄴ 첨가, 사이시옷, 절음 후 연음) |

**지침.** 규칙으로 결정되는 것(ㄺ 이 ㄱ 앞에서 [ㄹ], ㄼ 의 일반형, 용언의 ㅎ 축약을 표기에 반영하지 않는 로마자법 규정)은 변환기를 고친다. 형태소 경계를 알아야 하는 것(깻잎, 색연필, 맛없-, 첫인-)은 변환기가 알 수 없으므로 **감지해서 예외 등록을 요구**한다: 해당 패턴이면 `romanizationOverride` 같은 명시 필드와 사유가 없을 때 lint 실패. 각 규정은 국어의 로마자 표기법과 표준 발음법 조항 번호를 사양에 인용한다(웹에서 원문 확인, URL 기재).

**테스트.** 위 9개 단어가 표의 올바른 값을 내거나(RG-1) 예외 요구로 실패한다(RG-2). 기존 콘텐츠 전체가 그대로 통과(회귀 0).

**예상.** 1.5d.

---

## WO-18 레벨 체크의 문장·어휘 관문

**목표.** 문장 관문을 통과했다는 것이 "문장을 읽는다"를 뜻하게 하고, 듣기가 강한 계승어 학습자를 과소평가하지 않는다.

**근거.**
- 보고: `content/placement/sentences.json` read 32문항 중 22문항이 명사만 읽어도 풀린다("밥을 먹어요" → Rice/Book/Sea/New Year bow 그림). 통과하면 Stage 2 전체를 건너뛰고 Stage 3 시작(`packages/content-schema/src/placement/scoring.ts` 의 `levelOf`).
- 보고: `content/placement/vocabulary.json` 에 청자, 먹, 연등, 가야금, 종이접기, 밥상, 무궁화 등 문화 카드 어휘가 다수. Stage 2 가 가르치는 낱말과 다르다.
- 보고: 관문당 3문항 중 2개 통과. 4지선다 우연 통과 약 15.6%, 3지선다 reply-pick 약 26%.
- 보고: 듣기 수준 `oralStageOf` 는 경로를 올리지도 내리지도 않는다.
- 보고: 배치 문항의 검수 표기는 `reviewedBy: "ai-3-lens"`.

**사양.** `docs/specs/AMENDMENTS-PLC-VALIDITY.md` — F-PLC-001 수정. 기존 `AMENDMENTS-PLC-THREE-MODES.md`, `AMENDMENTS-PLC-PLAN-HANDOFF.md` 와 충돌하지 않게 읽고 시작한다.

| 행 | 모델 | 내용 |
|---|---|---|
| PV-0 | Opus 5.5 | 사양: 문항 설계 규칙, 통과 기준, 듣기/읽기 분리 보고 |
| PV-1 | Opus 5.5 | 문장 read 문항 재작성(같은 명사·다른 동사 오답) |
| PV-2 | Opus 5.5 | 어휘 듣기 문항을 생활 고빈도어로 교체 |
| PV-3 | Sonnet 5.5 | lint: 문장 문항의 오답이 정답과 명사를 공유하는지 검사 |
| PV-4 | Sonnet 5.5 | 보호자 결과 화면에 듣기 / 읽기 분리 표기 |
| PV-5 | Opus 5.5 | (선택) 듣기 통과 + 해독 미통과 프로필용 "문해 집중" 경로. 별도 사양으로 뺄 수 있음 |

**문항 지침 (PV-1).**
- 문장 read 문항의 오답 3개 중 **적어도 2개는 정답과 명사가 같고 동사나 조사·부정이 다르다.** 예: 정답 "밥을 먹어요" 그림 / 오답 "밥을 만들어요" 그림, "밥이 없어요" 그림, (하나는 다른 명사 허용).
- 그림으로 구별되지 않는 대립은 쓰지 않는다. 그림 수요가 생기면 `scripts/art-demand.mjs` 흐름을 따른다.
- 문장은 Stage 2–3 이 실제로 가르치는 문형 안에서. "천만에요." 는 "아니에요." 로 교체(WO-20 #3 과 같은 건).
- 통과 기준 변경 제안: 문장 관문은 3문항 중 2개에서 **4문항 중 3개**로(우연 통과율을 약 5% 로 낮춘다). 모드별 길이 제한(Quick/Standard/Take my time)과 맞는지 사양에서 계산한다.

**어휘 지침 (PV-2).** 듣기 어휘는 가정에서 쓰는 고빈도어(물, 엄마, 학교, 먹어요, 가요, 주세요)로. 문화 어휘는 읽기 쪽에 일부만 남긴다. 교체 목록은 Stage 2 의 실제 교수 어휘와 대조한 표로 제시한다.

**수용 기준.** "명사만 읽는 봇"(문장의 첫 명사만 보고 그림을 고르는 테스트 봇)이 문장 관문을 우연 수준 이상으로 통과하지 못한다. 보호자 화면이 듣기와 읽기를 따로 말한다.

**하지 말 것.** 학습자에게 실패를 표시하지 않는다. "not sure" 선택지를 없애지 않는다. 근거가 없을 때 보수적으로 Stage 1 에서 시작하는 규칙을 바꾸지 않는다.

**예상.** 사양 0.75d, 문항 2d, 구현 1d. 그림은 별도.

---

## 이 Phase 에 넣지 않은 것

- **자음 도입 순서 재배치**(리뷰 Stage 1 "개선" I1: ㅅㅎ 를 앞으로, 격음을 가획 묶음으로, ㅑㅕㅛㅠ 를 받침 앞으로). 근거는 타당하지만 16퀘스트·오디오·카드·진도 데이터 전체에 닿는 변경이라, 이 계획의 수정들이 들어간 뒤 실사용 데이터(어느 퀘스트에서 miss 가 몰리는지)를 보고 판단한다. 가획 설명 한 줄(ㅈ → ㅊ)은 WO-12 에 추가해도 된다.
- **성인용 반절표 참조 화면**, **"아는 말 → 글자" 계승어 경로**, **테마 간 선행 조건**(Crafts 부터 시작하면 글자를 배우기 전에 읽기 퀘스트에 들어감). 각각 새 기능이라 사양부터 필요하다. WO-18 의 PV-5 와 함께 다음 계획에서 다룬다.
