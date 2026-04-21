# Hangul Route

영어권 어린이(5–11세)를 위한 한국어 학습 모바일 앱. 해외 동포 어린이와 K-컬처에 관심 있는 해외 어린이를 주요 타겟으로, "Heritage Journey" — Stage(한글→단어→문형→대화→이야기→실전→자기표현) × 문화 테마(문자·생활·의례·자연·공예)의 격자 구조 위에서 학습자가 자신만의 Route(경로)를 그려나가는 구조를 지향한다. 가이드 캐릭터는 어린 호랑이 **호야(Hoya)**, 주요 보상은 **문화유산 카드 수집**.

MVP 범위: Stage 1(한글) 풀 구현 + Stage 2 / 4 맛보기.

## 문서

- 프로젝트 헌장 및 작업 규칙은 [`CLAUDE.md`](./CLAUDE.md) 참조.
- 설계 문서(블루프린트), 디렉토리 가이드, 주간 회고는 [`docs/`](./docs/) 참조.

## 기술 스택

Turborepo + pnpm workspaces · Expo React Native · Next.js · Cloudflare Workers(D1/R2) · TypeScript strict.

자세한 기술 선택 근거는 `docs/blueprints/03-engineering-blueprint-v2.md` 에 있다.
