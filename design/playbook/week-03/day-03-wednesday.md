---
date: week-03 / Wednesday
duration: 20 min (08:10 – 08:30 KST — 5분 추가 허용)
deliverables:
  - design/components/HoyaBubble/spec.md
  - design/components/HoyaBubble/v1.png
  - design/components/HoyaBubble/tones.png
  - docs/specs/F-002-hoya-feedback-bubble.md (status: ready)
depends_on:
  - design/characters/hoya/v1/{idle,cheering,thinking}.png (W1 Thursday)
  - design/components/Button/spec.md (tertiary CTA 가 bubble 내부 inline link)
  - design/wireframes/onboarding/welcome.md, quest/player.md, quest/results.md
unblocks:
  - 목 Progress (HoyaBubble 과 동시 화면 등장 — 시각 충돌 사전 회피)
  - 금 promotion PR (HoyaBubble → packages/design-system/src/components/HoyaBubble/)
  - F-001 §3.2 wrong-answer path 의 "Hoya thinking + hint" 자리
---

# Day 03 — Wednesday · Hoya Bubble component v1 (F-002)

## 오늘의 목표
**HoyaBubble v1** — 호야의 대사·힌트·격려를 담는 speech bubble 컴포넌트의 시각 + 코드 spec 확정. 동시에 `docs/specs/F-002-hoya-feedback-bubble.md` 를 `ready` 로 승격.

세 가지를 한 자리에서 결정:
1. Visual tone 3종 (idle / cheering / thinking) — Hoya pose × bubble color
2. Bubble 내부 컴포지션 (Hoya thumbnail + message + optional romanization line + optional tertiary CTA)
3. F-002 spec 의 acceptance criteria (a11y label, dismiss 동작, reduced-motion fallback)

## 왜 오늘
- HoyaBubble 은 "호야의 *목소리*" — 학습자가 만나는 첫 인터랙티브 표현. 톤이 잘못되면 첫 30 초에 신뢰가 깨진다.
- F-001 §3.2 의 wrong-answer 처리("Listen again. This says **giyeok**.") 는 HoyaBubble 의 thinking 톤이 정확히 그 자리에 들어간다는 가정 — 오늘 그 자리를 확정한다.
- 20 분 (5 분 추가) — visual + spec 두 산출물이라서 시간 버퍼.

## 사전 준비 (2분)
- 어제 Card v1 의 shadow.sm 값 확인 (HoyaBubble 도 동일 shadow 사용).
- Hoya v1 4-pose 폴더 (`design/characters/hoya/v1/`) 가 존재하는지 확인 — 없으면 idle 만으로 진행하고 cheering/thinking 은 W4 보완.
- F-001 spec 의 §3.2 wrong-answer 케이스를 1 분 정독 — 이 자리가 HoyaBubble thinking 톤의 첫 user story.

## Claude Design 프롬프트 (복붙)

```prompt
Design HoyaBubble v1 for Hangul Route — Hoya's speech bubble that
delivers prompts, hints, and celebrations to English-speaking child
learners 5–11. This is the F-002 reference implementation.

Audience: P5 child 5–7 primary. UI text English. Korean appears only
in the optional romanization slot for jamo / word learning.

Strict constraints:
- component-skill §3 & §4: function + hooks, named export, token-only,
  ≥ 64dp tap target on any in-bubble CTA, accessibilityRole + label
  mandatory.
- Inherit radius.md and shadow.sm from Button v1 / Card v1.
- prefers-reduced-motion: skip entrance pop animation, fade only.
- Korean in romanization slot is ALLOWED (this is the "learning target"
  field per content-skill §3.3 + F-CNT-001 allow-list); UI message
  remains English.
- No final copy decisions — placeholder strings only.

Tones (3, matching Hoya v1 poses):
1. idle      — greeting / prompt. bg = colors.surface.bubble, border
                tail pointing to Hoya idle thumbnail (top-left).
2. cheering  — celebration / correct-answer. bg = colors.surface.bubble,
                accent border in colors.brand.primary. Hoya cheering
                thumbnail.
3. thinking  — encouragement after wrong answer / hint delivery. bg =
                colors.surface.bubble, accent border in colors.feedback
                .nudge (NOT colors.feedback.danger — anti-shame).
                Hoya thinking thumbnail.

Composition slots (4):
- hoyaThumbnail (≥ 48dp square, top-leading; clickable to "say it
  again" via TTS — out of scope for F-002 v1)
- message       (English string, 2 lines max, body typography token)
- romanization  (optional Korean + romanization line, smaller token;
                allowed Korean target field per F-CNT-001)
- ctaInline     (optional Button tertiary variant, max 1, ≥ 64dp)

States (3):
- default  — full opacity, shadow.sm
- pressed  — only when entire bubble is tappable to dismiss; opacity
             .pressed
- dismissed — fades out 200ms, then unmounts (instant if reduced-motion)

Entrance:
- 120ms pop (scale 0.96 → 1.0) + fade-in.
- Skipped under prefers-reduced-motion (fade only, 100ms).

Output:
- design/components/HoyaBubble/v1.png  (idle tone with placeholder
  English prompt "Tap the letter you hear" + Korean+romanization line
  "ㄱ · giyeok")
- design/components/HoyaBubble/tones.png  (3 tones side by side, each
  with the matching Hoya thumbnail)
- design/components/HoyaBubble/spec.md with:
  1. Purpose
  2. Tones × states matrix
  3. Props table (tone, message, romanization, hoyaThumbnail, ctaInline,
     onDismiss, dismissAfterMs)
  4. Accessibility: role="status" (live region) when tone=cheering/
     thinking; accessibilityLabel = `Hoya says: ${message}`;
     romanization announced as separate sibling node.
  5. Token usage table
  6. Anti-patterns (5+ bullets, MUST include: no red/❌ on thinking
     tone, no shame-language placeholder, no Korean character in
     `message` field — only in `romanization` slot, no auto-dismiss
     shorter than 1.5s on thinking tone)
  7. Open questions (≤ 3)

Then write the F-002 spec to docs/specs/F-002-hoya-feedback-bubble.md
following the docs/specs/README.md template. Status: ready.
```

## 작업 흐름 (15분)
1. 프롬프트 실행 (10 분). Hoya v1 thumbnails 첨부.
2. **thinking 톤의 border 색이 red/danger 면 즉시 거부** → "use colors.feedback.nudge (warm amber), this is encouragement not shaming".
3. **dismiss 가 너무 빠름** (≤ 1s) → "1.5s minimum on thinking tone; user must read the hint".
4. romanization 슬롯의 Korean 위치 확인 — F-CNT-001 가 통과하려면 `romanization` 슬롯 안에서만 한국 문자.
5. spec.md 의 props 표 + F-002 의 §3 AC 가 일치하는지 마지막 확인.

## 결과 저장 (3분)
1. `design/components/HoyaBubble/` 아래 3 파일.
2. `docs/specs/F-002-hoya-feedback-bubble.md` 저장 (status: ready).
3. `design/prompts.md` 로그.
4. 커밋: `design(component): add HoyaBubble v1 + F-002 spec`.

## Code 다음 단계 안내
- 금요일 promotion PR 에 HoyaBubble 5-파일 세트가 포함.
- F-001 §3.2 wrong-answer 구현 시 HoyaBubble `tone="thinking"` 호출.
- TTS 재생 (hoyaThumbnail 탭) 은 F-002 의 §4 out of scope — F-CNT-004 (TTS pipeline) 로 분리.

## 막힐 때 대응
- thinking 톤이 자꾸 sad/red 로 표현됨 → 강하게 "this is 'let's try again together', NOT 'you failed'".
- romanization 슬롯이 message 와 색·크기 동일 → "romanization smaller (typography.caption), distinct from message".
- 20 분 초과 → spec.md 의 §6 / §7 / F-002 §4 out-of-scope 는 목요일 앞 5 분으로 분리.

## 검토 체크리스트
- [ ] 3 톤이 시각·token 양쪽 모두 명시
- [ ] thinking 톤이 red/danger 아닌 nudge/amber 사용
- [ ] romanization 슬롯에만 한국어 허용 (F-CNT-001 통과)
- [ ] in-bubble CTA 64dp 보장 (Button tertiary 재사용)
- [ ] auto-dismiss 1.5s 이상 (특히 thinking)
- [ ] role="status" 또는 동등한 live-region a11y
- [ ] F-002 spec 의 §3 AC 가 spec.md props 와 1:1 매칭
- [ ] F-002 §8 dependencies 에 Hoya v1 poses + Button v1 + 토큰 W1 + Card v1 (shadow) 명시

## 다음 시안 연결
- 목(Thu) Progress 는 HoyaBubble 과 동시 화면에 나올 때 시각 무게가 충돌하지 않도록 shadow 한 단계 약하게.
- F-001 의 §3.1 prompt 자리 = HoyaBubble idle + Korean romanization slot.
- F-001 의 §3.2 wrong-answer = HoyaBubble thinking.
