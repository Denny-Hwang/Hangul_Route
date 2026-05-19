# design/brief/

**Claude Design 프롬프트 라이브러리 + 화면·캐릭터·일러스트 설계 브리프.**

각 브리프는 단순한 가이드라인이 아니라 **복사해서 바로 Claude Design 세션에 붙여넣을 수 있는 prompt 블록**을 포함합니다. Claude Design 이 산출한 PNG/SVG/Figma 는 다음 경로에 저장합니다 (CLAUDE.md §2):

- 캐릭터 시안 → `design/characters/hoya/v1/`
- 일러스트 시안 → `design/illustrations/`
- 컴포넌트 시안 → `design/components/<name>/`
- 화면 시안 → `design/screens/<area>/<name>/`

## 디렉토리

```
design/brief/
├── README.md                       # 이 문서
├── 00-visual-identity.md           # 마스터 — palette/type/mood + 핵심 prompt 3개
├── prompt-library.md               # 모든 prompt 한 곳에 모아놓은 색인
├── character/
│   └── hoya-character-sheet.md     # 호야 5 pose × 표정 × 스케일
├── illustrations/
│   ├── heritage-card-art.md        # 30 Heritage 카드 일러스트 prompt
│   └── scene-backgrounds.md        # 한지 텍스처 · 무드 배경
├── components/                     # 12 컴포넌트 디자인 spec + prompt
└── screens/                        # 20 화면 시안 brief
```

## 워크플로

### 1. 문서 작성 (이 PR)
설계 브리프를 깃에 저장. 각 브리프에 "Claude Design prompt" 블록이 들어있음.

### 2. Claude Design 세션 (수동)
매일 `design/playbook/week-NN/day-NN.md` 가이드 → 해당 영역의 brief 를 열어 prompt 블록을 복사 → Claude Design 에 붙여넣기 → 산출물 다운로드.

### 3. 산출물 저장
`design/screens/`, `design/characters/`, `design/illustrations/` 에 시안 저장. 파일명은 `<brief-id>__<variant>__<date>.png` 형식.

예: `design/screens/onboarding/welcome__v1__2026-05-20.png`

### 4. 리뷰 + promotion
- 리뷰: `design/components/_review-week-NN.md` 또는 `design/screens/_review-week-NN.md` 에 시안 vs spec drift 0 확인 기록.
- promotion: 확정본 → `packages/design-system/` 로 이전 (CLAUDE.md §2 `tokens.ts` / 5-file component set).
- 토큰 drift 검증은 `.github/workflows/design-token-sync.yml` 이 자동.

## 브리프 작성 규약

모든 brief 문서는 다음 8 섹션을 따른다:

1. **Context** — 누가 / 어디서 / 왜 본다
2. **Layout** — 화면/요소 계층, 공간 구조
3. **Visual style** — 토큰 참조 (색·타이포·간격), 무드 키워드
4. **Exact copy** — 화면에 나오는 모든 문자열 (UI=영어, 한국어는 학습 대상만)
5. **Reference** — 영감 키워드 (실제 이미지 X, 텍스트 참조만)
6. **Claude Design prompt** ← copy-paste 블록
7. **Acceptance checklist** — 시안 검수 항목
8. **Output path** — 산출물 저장 위치

## 핵심 원칙 (모든 brief 에 자동 적용)

- **UI = English** · Pre-A1 / 5–7세 어휘
- **Korean = 학습 대상만** · 항상 romanization + 영어 gloss 동반
- **Anti-shame** — 오답 색은 amber `nudge`, 절대 red 금지
- **터치 타깃** — 최소 64dp, 주요 액션 80dp, hero 96dp
- **토큰만** — 색·간격·타이포 하드코드 금지 (모든 값은 `tokens.ts` 참조)
- **Hoya 등장** — 화면에 따라 idle / cheering / thinking / reading / waving
- **한지 (hanji) 무드** — 크림 surface, paper-like 그림자, 따뜻한 정렬

## 입력 자산 참조

각 prompt 가 참조하는 토큰/캐릭터/카피의 단일 출처:

| 자산 | 출처 |
|---|---|
| 색 토큰 | `packages/design-system/src/tokens.ts` (colors.* 객체) |
| 타이포 | `packages/design-system/src/tokens.ts` (typography.size.*) |
| 간격 | `packages/design-system/src/tokens.ts` (spacing.*) |
| Hoya 5 pose | `design/brief/character/hoya-character-sheet.md` |
| Heritage 카드 카탈로그 | `apps/mobile/src/content/heritage-cards.ts` (30장) |
| 자모 | `apps/mobile/src/content/jamo.ts` (30개) |
| Episode / Quest | `apps/mobile/src/content/episodes.ts`, `quests.ts` |

## 인덱스

- [`00-visual-identity.md`](./00-visual-identity.md) — 시작점. 다른 모든 brief 가 이 문서의 palette/type 을 상속.
- [`prompt-library.md`](./prompt-library.md) — 모든 prompt 를 한 페이지에 모은 색인.
- [`character/hoya-character-sheet.md`](./character/hoya-character-sheet.md) — Week 1 첫 산출물 후보.
- [`illustrations/heritage-card-art.md`](./illustrations/heritage-card-art.md) — Stage 1 카드 30장.
- `components/*` — Button / Card / Tile / HoyaBubble / Progress / StarRow / Pill / Heading / Screen / Icon (10개).
- `screens/*` — onboarding 3 + main 4 + episode/quest/results 3 + minigames 6 + library/card 2 + parent 2 = 20개.

## Out of scope (이 PR)

- 시안 자체의 PNG/SVG 생성 (수동 Claude Design 세션에서 진행)
- 컴포넌트 코드 변경 (이미 v1.0 PR 에서 placeholder 로 구현 완료)
- 토큰 값 변경 (현재 v1 토큰을 사실상 확정으로 가정; 변경 시 별도 PR)
