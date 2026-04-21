# Template — Animation Concept Prompt

애니메이션 컨셉(성공·재시도·전환) 시안 베이스.

```prompt
Design an animation concept for [MOMENT, e.g. "correct-answer celebration
in Stage 1 tile matching"].

Context:
- Audience: English-speaking kids 5-11.
- Emotional target: [e.g. "small proud moment, not a parade"]
- Duration: 120–300ms for transitions, up to ~1s for celebrations.
- Respects prefers-reduced-motion (provide a static fallback).

Constraints:
- Ease-out as default curve.
- Use design tokens only — no hardcoded colors or offsets.
- Compatible with React Native Animated and/or Lottie export.
- No sound-only feedback — always paired with a visual cue.

Deliverables:
- Storyboard of 3–5 keyframes with timing in ms.
- State diagram if multiple states (idle → triggered → complete).
- Notes for engineering: which RN Animated primitives or Lottie shapes,
  performance caveats at 60fps on mid-tier Android.
- Reduced-motion alternative.

Tone anti-patterns:
- Over-celebration for every tap (reserve for meaningful moments).
- Retry animations that feel like "wrong!! try again!!" — we want
  "let's try together".

[ATTACH prior animation concepts or reference clips if any.]
```

## 사용 팁
- 컨셉만 먼저. 실제 Lottie JSON 은 주간 후반에 별도 세션.
- 타이밍 숫자는 엔지니어링 구현 전까지 플레이스홀더 — 한두 번 조정 예상.
