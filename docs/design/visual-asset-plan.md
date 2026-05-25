# Visual Asset Plan — 시각 자산 계획

> 일러스트·캐릭터(호야)·Heritage 카드·배경 등 **시각 자산을 무엇을, 어떻게,
> 어떤 순서로 확보·저장·승격하는가**에 대한 계획.
> 토큰/컴포넌트 규약은 `docs/design/tokens.md`·`docs/design/components.md`,
> 그림 스타일은 `docs/design/illustration-style.md`, 시안 브리프는
> `design/brief/` 를 따른다. 이 문서는 그 위의 "조달 로드맵"이다.

**Status**: draft · **Owner**: solo dev · **Scope**: design assets · **Updated**: 2026-05-25

---

## 1. 현황

- **토큰 v1 락** — `design/tokens/*.v1.md` ↔ `packages/design-system/src/tokens.ts`
  (colors / spacing / typography / radii / shadows / motion / z). CI(`design-token-sync`)가 동기 검증.
- **시안 브리프 37종** — `design/brief/` (visual-identity, 컴포넌트 11, 화면 20,
  `hoya-character-sheet.md`, `heritage-card-art.md`, `scene-backgrounds.md`, `prompt-library.md`).
- **코드 placeholder** — `Hoya` 5 포즈(SVG primitive), `HeritageCardArt` 30 ID(기하 도형 placeholder).
- **실제 아트 0** — `design/illustrations|characters|screens` 등은 빈 디렉토리. PNG/JPG 자산 없음.

→ **준비된 것**: 토큰·브리프·placeholder 컴포넌트. **빈 것**: 실제 그림 자산 + 저장 구조.

## 2. 자산 인벤토리 (필요 목록)

### 2.1 캐릭터 — 호야 (P0)
- 5 포즈 최종 아트: `waving` / `idle` / `thinking` / `cheering` / `reading`.
- 감정 변형(피드백 채널용): 응원·재시도·생각. (`docs/design/interaction-patterns.md` §호야 피드백)
- 현재: SVG primitive(`packages/design-system/src/components/Hoya/Hoya.tsx`). → 실제 일러스트로 교체.

### 2.2 Heritage Card 아트 — 30종 (P0)
- Stage 1 카드 30종(테마 5 × 약 6). `design/brief/illustrations/heritage-card-art.md` 규약.
- 스타일: 민화(minhwa), 둥근 형태, 순흑 금지 (`docs/design/illustration-style.md`).
- 현재: `HeritageCardArt.tsx` 기하 placeholder. → 실제 아트.

### 2.3 화면 배경 / 씬 (P1)
- `design/brief/illustrations/scene-backgrounds.md`. 스테이지/테마 무드 배경.
- 홈·저니·퀘스트·보상 화면.

### 2.4 아이콘 / UI 일러스트 (P2)
- 빈 상태·로딩·에러 일러스트(`interaction-patterns.md` §오류 — "빈 상태 모두 일러스트").

## 3. 조달(Sourcing) 전략

1. **AI 생성 초안** — `design/brief/illustrations/prompt-library.md` 프롬프트로 생성.
   스타일 일관성(팔레트·선·형태) 수동 검수 필수.
2. **공공누리(KOGL)** — 문화재 기반 카드는 박물관 자료 활용(`content-skill` §3.7).
   **KOGL Type 4(상업·변경 금지) 사용 금지.**
3. **일러스트레이터 commissioning** — 예산 확보 시 호야·핵심 카드 최종본.
- 흐름: AI 초안 → 검수 → (필요 시) 전문 리터치/commission.

## 4. 저장 · 네이밍 · 버전

- 카드: `design/illustrations/heritage-cards/{theme}/{card-id}__YYYY-MM-DD.png` (브리프 규약).
- 캐릭터: `design/characters/hoya/{pose}__YYYY-MM-DD.png`.
- 배경: `design/illustrations/scenes/{stage}-{theme}__YYYY-MM-DD.png`.
- 원본(레이어/벡터) + export(png/webp) 분리 보관. export만 앱 번들.

## 5. 승격(Handoff) 파이프라인

- 시안 확정 → `design-handoff-skill` → `packages/design-system` 컴포넌트 교체 (1:1, 값 변경 없음).
- `HeritageCardArt.tsx` / `Hoya.tsx` 의 placeholder를 최적화 자산(`<Image>` / 압축 webp)으로 교체.
- 토큰은 손대지 않음(시각 자산만).

## 6. 라이선스

- **`content/assets-license.csv` 신규** — `asset_path, source, license, attribution, url`.
- 공공누리 KOGL Type 1–3만. AI 생성물 라이선스 표기. 2차 저작 명시.
- 향후 `content-validation` CI가 자산↔csv 행 일치 검증.

## 7. 우선순위 / 마일스톤

| 단계 | 자산 | 비고 |
|---|---|---|
| **P0 (알파)** | 호야 5 포즈 + Stage 1 카드 30 | 전 화면·핵심 보상 |
| **P1** | 홈/저니/퀘스트/보상 배경 | 무드 형성 |
| **P2** | 아이콘·빈 상태·씬 디테일 | 마감도 |

- `design/playbook/` 12주 일정에 매핑(Week 2+ 스케치 존재).

## 8. 후속 문서 (갭)

- `design/tokens/motion.md` — motion 토큰은 코드엔 있으나 명세 문서가 없음.
- 시각 철학 통합 문서 — 현재 철학이 brief 전반에 분산.
