---
date: week-02 / Thursday
duration: 15 min (08:15 – 08:30 KST)
deliverables:
  - design/wireframes/library/gallery.md
  - design/wireframes/library/card-detail.md
depends_on:
  - design/wireframes/journey/home.md (어제·그제 산출물 — Library 진입)
  - design/wireframes/quest/results.md (어제 산출물 — "See cards" 도착지)
unblocks:
  - F-007 (Heritage Card 수집, deferred) 의 UI sketch 사전 정의
  - 격자(Grid) 시각화 — Stage × Theme 한 화면에 처음 등장
---

# Day 04 — Thursday · Library / Heritage Card collection

## 오늘의 목표
**Library / Gallery** + **Card detail** 두 화면 와이어프레임. 학습자가 모은 Heritage Card 를 보고, 격자(Stage × Theme) 위에 자기가 어디까지 와 있는지를 *처음* 보는 화면. blueprint 04 §6 (Heritage Card) + blueprint 02 §3 (Library view) 의 시각적 첫 표현.

## 왜 오늘
- Home 화면이 격자 전체를 피했다면, 격자는 어딘가에서 한 번은 나와야 한다. 그 자리가 Library.
- Heritage Card 가 "engagement 은 강하지만 retention 미입증" (서비스 리뷰)이므로, **A/B 측정을 후일 가능하도록 자리를 잡는다** (카드 슬롯 + 빈 슬롯의 구분).
- F-001 결과 화면(`quest/results`)의 "See cards" 도착지가 비어 있으면 그래프가 끊김.

## 사전 준비 (1분)
- 어제 `quest/results.md` 의 "See cards" exit ID 가 무엇이었는지 확인.
- blueprint 04 §6 (Heritage Card) 의 5 pillar (Letters / Life / Rites / Nature / Crafts) 환기.
- Anti-pattern 상기: 카드 거래 / SNS 공유 / 친구 카드 비교 (전부 금지).

## Claude Design 프롬프트 (복붙)

```prompt
Produce 2 low-fidelity wireframes for the Hangul Route Library flow.

Audience: English-speaking children 5–11. Child-first (no parent widgets).

Strict rules (from wireframe-skill):
- ASCII box diagrams only.
- 7 sections each: Scenario, Goal, Box, Interaction, Navigation, Data,
  Open questions.
- 3 states each: success, empty, error.

Screens:

1. library/gallery
   - The first place the Stage × Theme grid appears.
   - Visual structure: rows = Stages 1–7 (only Stage 1 unlocked in MVP),
     columns = 5 Themes (A Letters / B Life / C Rites / D Nature /
     E Crafts).
   - Each cell shows: empty slot (locked or earnable), or earned Card
     thumbnail placeholder.
   - DO NOT show competitive elements (no "friends have this card").
   - DO NOT show trading / SNS share.
   - Empty: brand-new learner, 0 cards. All cells "empty slot" except
     Stage 1·Theme A which is "the next card to earn".
   - Error: card list fetch fails → grid shell visible with shimmer
     placeholders, retry tertiary link bottom.

2. library/card-detail
   - Opened when learner taps an earned card.
   - Shows the artifact image placeholder (real artifact, public-domain
     source — blueprint 03 §4).
   - Caption: English name + romanized Korean + Korean (3 lines).
   - "[[ Back to gallery ]]" primary CTA.
   - One tertiary "Who made this?" link → micro-attribution screen
     (NOT designed today; just note exit ID `library/attribution`).
   - Empty / error: an earned card whose asset failed to load → text
     metadata only, image placeholder visible.

Note "≥ 64dp" on all tappable cells.

Output exactly 2 Markdown files:
- design/wireframes/library/gallery.md
- design/wireframes/library/card-detail.md
```

## 작업 흐름 (10분)
1. 프롬프트 실행.
2. **격자 시각화** 검토 — 7×5 = 35 셀이 5-7세에게 압도적이지 않은지. 압도적이면 "Stage 1 row prominent, Stages 2-7 dimmed/hinted" 한 줄 추가.
3. 거래 / 공유 / 비교 anti-pattern 이 안 들어왔는지 스캔.
4. card-detail 의 3-line caption(영문 + 로마자 + 한글)이 wireframe-skill §4 의 "최종 카피 미정" 규칙을 깨지 않는지 — 자리·길이 지시만이어야 함.

## 결과 저장 (3분)
1. `design/wireframes/library/` 아래 2 파일 저장.
2. `design/prompts.md` 로그.
3. 커밋: `design(wireframe): add library gallery + card-detail`.

## Code 다음 단계 안내
- F-007 (Heritage Card 수집, deferred) 의 UI sketch §5 가 가리킬 두 파일이 미리 존재 — F-007 작성 시 즉시 ready.
- packages/content-schema 의 Card schema 가 들어갈 자리 — Friday 회고에서 Card schema 작성을 INBOX 추가.

## 막힐 때 대응
- 격자가 너무 차갑게 보임 → "still child-friendly, large cells, lots of breathing room — not Excel".
- 카드 거래/공유 자꾸 들어옴 → 강하게 "no trading, no SNS, no friend leaderboards — explicit anti-pattern from CLAUDE.md".
- 15 분 초과 → card-detail 은 금요일 review 5 분에 분리.

## 검토 체크리스트
- [ ] 격자(Stage × Theme) 시각이 5-7세에게 압도적이지 않음
- [ ] 거래 / SNS / 비교 anti-pattern 없음
- [ ] 빈 슬롯 vs 잠긴 슬롯 구분 (A/B 측정 가능 자리 확보)
- [ ] card-detail 의 "Who made this?" 라벨 자리 (출처 표기, blueprint 03 §4)
- [ ] enter / exit ID 가 quest/results · journey/home 과 닫힘

## 다음 시안 연결
- 내일(Fri) review 에서 전체 그래프(welcome → ... → library) 닫힘 확인.
- Week 3 Card 컴포넌트 가 gallery + episode-select 두 곳에서 재사용 가능한지 확인.
- F-007 spec 작성 시 §5 가 이 두 파일을 가리킴.
