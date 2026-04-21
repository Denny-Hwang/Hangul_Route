# Playbook Overview — 12 Weeks

## 로드맵 (큰 그림)

| Week | 주제 | 산출물 | 코드 의존성 (풀어주는 작업) |
|---|---|---|---|
| **01** | Foundations | 색 · 타이포 · 간격 · 호야 · 아이콘 v1 | `packages/design-system/src/tokens.ts` 채우기, 첫 컴포넌트 착수 |
| 02 | Wireframes core | 인트로 · 홈(Route) · 에피소드 선택 · 카드 수집 wireframe | `apps/mobile` / `apps/web` 화면 골격 |
| 03 | Components v1 | Button · Card · Bubble · Progress 시안 | `packages/design-system/src/components/` 최초 3-4개 |
| 04 | Stage 1 game shells | 타일 매칭 · 드래그 조합 · 음성 반복 게임 시안 | `apps/mobile/src/games/` 착수 |
| 05 | Screens mid-fi | 인트로·홈·에피소드 mid-fi 시안 | `apps/mobile/src/screens/` 초안 |
| 06 | Hoya expressions | 표정 10종 · 액션 5종 | 피드백·동기부여 시스템 |
| 07 | Illustration v1 | 문화유산 카드 5장 (단청·한복·태극·한옥·김치) | 카드 수집 화면 데이터 |
| 08 | Beta prep | 알파 빌드용 화면 최종 · 온보딩 플로우 | 알파 배포 빌드 |
| 09 | Beta iteration 1 | 사이클-1 피드백 반영 시안 | 알파 → 베타 업데이트 |
| 10 | Stage 2/4 taste | Stage 2 단어 · Stage 4 대화 맛보기 시안 | MVP 범위 확장 |
| 11 | Animations | 성공·실패·전환 애니메이션 컨셉 | RN Animated / Lottie 적용 |
| 12 | Polish + launch | 랜딩 페이지 · 마케팅 이미지 · ASO 스크린샷 | 정식 런치 준비 |

## Code 의존성 매핑 (상세)

### Week 1 이 풀어주는 것
- `packages/design-system/src/tokens.ts` 에 colors / typography / spacing / radii / shadows 채움.
- `design-token-sync.yml` 최초 green (빈 tokens → 실제 값으로 이동).
- 첫 컴포넌트 (Button 예상) 구현 착수 가능 — 토큰 확정이 전제.
- 인트로 화면 와이어프레임 (Week 2) 이 호야 v1 기반으로 진행 가능.

### Week 2–3 이 풀어주는 것
- 모바일·웹 `apps/*/src/screens/` 화면 골격.
- `design-system/src/components/` 의 1세대 컴포넌트 3-4개.
- Storybook 설치 (component Skill 트리거 시점).

### Week 4 이 풀어주는 것
- Stage 1 미니게임 3종 구현 착수 — `apps/mobile/src/games/` 분리 구조.
- 비즈니스 로직 (`src/logic/`) vs 플랫폼 (`src/platform/`) 분리 기준이 시안과 함께 확정.

### Week 5–8 이 풀어주는 것
- 알파 빌드 (한글학교 베타 준비).
- 호야 피드백 시스템, 카드 수집 화면.
- `docs/beta/cycle-01-plan.md` 문서화.

### Week 9–12 이 풀어주는 것
- 베타 피드백 반영 → 정식 런치.
- Stage 2/4 맛보기 컨텐츠 연결.
- 애니메이션 / 랜딩 / ASO.

## 롤오버 규칙

- 주 금요일에 해당 주 `README.md` 에 미완 항목을 **반드시** 목록화한다.
- 그 다음 주 월요일 "사전 준비" 에서 롤오버 항목 먼저 처리.
- 2주 연속 롤오버되면 로드맵을 재검토 (범위 축소 또는 일정 재배치).

## 참고
- 스타일 기준: `docs/design/illustration-style.md`
- 인터랙션 기준: `docs/design/interaction-patterns.md`
- 코드 승격 흐름: `docs/workflows/design-to-code.md`
- 운영 원칙: `docs/workflows/daily-design-session.md`
