# Illustration Style

## 타겟 독자 이해
- 한글을 처음(또는 거의 처음) 배우는 모든 연령의 학습자 (CLAUDE.md §1). 한국어는 신규이고, UI 언어는 학습자가 고른다.
- 따라서 **UI 외관은 어느 연령에게나 편안하고 읽기 쉬운 비주얼**, **문화 콘텐츠 영역은 한국 문화 모티브**. 유아용 말투·유아용 그림체는 쓰지 않는다.

## 레퍼런스
- ✅ DragonBox
- ✅ 단순하고 굵은 선의 픽토그램·플랫 일러스트 (WordArt 가 기준: `design/brief/illustrations/word-art.md`)
- ❌ 한국 학습지 (네모 체크박스, 빨간 동그라미)
- ❌ 큰 머리·작은 몸 (3.0 head 미만) 비율
- ❌ 배경 장식으로서의 한자/한글 벽지

## 스타일 키워드
- 기하학적 플랫 일러스트 (geometric minhwa)
- 진한 잉크 윤곽선 (**[PX]** R1 참조)
- 따뜻한 톤 (과채도 금지), 실제 사물은 실제 색 (**[PX]** R4)
- 명확한 실루엣 (썸네일 크기 식별 가능)

## [PX] 문제에 나올 수 있는 모든 그림의 규칙

`docs/specs/AMENDMENTS-PICTURES-2026-11.md` §3 (2026-11-17 오너 요청: 몇몇 그림이 너무 추상적이라 알아보기 어렵다). WordArt 에서 이미 잘 읽히는 방식을 카드 그림과 숨은 유산 찾기 그림에도 적용한다.

- **R1 Ink outline.** The subject's outline is `text.primary` and at least 3 % of the grid's width (3 units on a 100 grid, 6 on a 200 grid); inner detail lines are at least 2 % (2 on 100, 4 on 200). Nothing the picture needs is drawn thinner.
- **R2 The subject fills the tile.** 60 to 70 % of the frame, one subject, at most two supporting things.
- **R3 Told by shape.** A picture that is told from another one of its set only by colour is rejected (WordArt C9, now for cards too). Sets: a vocabulary topic, the cards of one stage and theme, and the look-alike groups of the amendment's section 4 (the bowls, the moons, the bows).
- **R4 Real colours for real things.** Card art and hidden-heritage things may use the `colors.vocab.*` tones, as WordArt does (kimchi is red). `feedback.danger` stays out of every picture. Scene settings and story props keep their own palette rule.
- **R5 No picture names itself in print** where it can be a question's picture. A card that shows its own word as text is never used as a question picture (a test holds this).
- **R6 A word's picture is a glyph.** A vocabulary word no longer borrows a card: each has its own `word:` glyph. The cards stay as collectibles.

## 캐릭터 (호야 Hoya)
- 어린 호랑이
- 3.5-head 비율
- 털색: primary 팔레트 기반 (주황/노랑)
- 의상 아이덴티티: 줄무늬 티셔츠 (호랑이 무늬 패러디)

## 문화 모티브
- 한국 전통 모티브 (단청, 창호지, 기와 등) 는 **콘텐츠 배경·카드·일러스트** 에서 자유롭게.
- **UI 외관** (버튼·메뉴·네비게이션) 에는 자제 — 모든 학습자에게 익숙하고 읽기 쉬운 것이 우선.
