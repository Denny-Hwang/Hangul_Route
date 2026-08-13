# Design Prompts Log

본인이 매일 Claude Design 세션에서 **실제 사용한 프롬프트** 와 산출물 메모를 기록하는 로그.

## 포맷

```
## YYYY-MM-DD (week-NN, day-NN)

### Goal
한 줄 요약

### Prompt used
<복붙한 프롬프트 — playbook day 가이드에서 가져왔다면 "same as guide" 만 써도 됨>

### Output
- 저장 위치: design/...
- 쓸만한 것: ...
- 버린 것: ...

### Note
다음에 바꿀 부분, 배운 점 등.
```

## Entries

## 2026-08-13 (launch-assets, session 1)

### Goal
App icon (iOS + Android adaptive) + splash + PH thumbnail v1 — the store-submission
blockers from `design/brief/launch-assets.md` §1–§3, §6.

### Prompt used
Same as `design/brief/launch-assets.md` §1–§3 §6, executed as code (SVG composed
from the in-app `Hoya.tsx` geometry, rendered to PNG with headless Chromium)
instead of an image-generation session.

### Output
- 저장 위치: `design/illustrations/launch/` (+ wired into `apps/mobile/assets/`
  and `apps/mobile/app.json`)
- 쓸만한 것: all 5 renders; icon face reads at 60×60; SVG sources committed for
  re-rendering
- 버린 것: first icon iteration — mouth sat left of the face axis (inherited from
  `Hoya.tsx`, where the offset is invisible at 96px but obvious at 1024px);
  re-centered mouth to x=64 for the icon/splash renders only

### Note
- v1 uses the geometric placeholder Hoya on purpose — icon, splash, and in-app
  mascot stay the same character. Re-run with illustrated art (v2) when the
  5-pose sheet lands in `design/characters/hoya/v1/`.
- Splash wordmark renders in a system bold sans; pick the rounded display font
  before v2.
