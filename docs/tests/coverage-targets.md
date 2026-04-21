# Coverage Targets (rolling)

`R4 Coverage Monitor` 와 `.github/workflows/coverage-gate.yml` 이 이 수치를 참조한다.

## 영역별 목표

| 영역 | W4 (알파) | 6 months | 측정 도구 |
|---|---|---|---|
| `packages/content-schema` | 100% | 100% | vitest --coverage |
| `packages/backend` (Cloudflare Workers) | 90% | 90% | vitest --coverage (miniflare) |
| `packages/design-system` | 85% | 85% | vitest --coverage |
| `apps/mobile` — business logic | 90% | 100% | vitest --coverage |
| `apps/mobile` — platform-dependent | 70% | 80% | vitest --coverage |
| `apps/web` — verification logic | 90% | 100% | vitest --coverage |

## 분리 규칙 (business vs platform)

`apps/mobile` 은 반드시 두 폴더로 쪼갠다 (또는 tag 로 분류):

- `src/logic/` — pure TS. vitest 만으로 테스트 가능. business target 적용.
- `src/platform/` — RN `Animated`, `Camera`, `AsyncStorage` wrapper 등. platform target 적용.

coverage-gate.yml 은 vitest 설정에서 두 경로를 분리 리포트한다.

## Rolling 의미
- "W4" = 알파(한글학교 베타) 직전 시점.
- "6 months" = 정식 런치 목표 시점.
- 미달 시: 머지 차단은 `coverage-gate.yml` 이, 경고/리포트는 R4 가 담당.

## 측정 제외
- `**/*.d.ts`, `**/*.stories.tsx`, `**/index.ts` (단순 재export only)
- generated 파일 (`**/__generated__/**`)
- `scripts/` (일회성)
