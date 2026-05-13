---
date: week-02 / Wednesday
duration: 20 min (08:10 – 08:30 KST — 5분 추가 허용)
deliverables:
  - design/wireframes/journey/episode-select.md
  - design/wireframes/quest/player.md
  - design/wireframes/quest/results.md
  - design/wireframes/stage1/match-sound.md
  - design/wireframes/stage1/match-sound-results.md
depends_on:
  - design/wireframes/journey/home.md (어제 산출물)
unblocks:
  - F-001 §5 UI sketch 링크 두 개 충족
  - Week 3 Card / Bubble / Progress 컴포넌트 자리 확정
---

# Day 03 — Wednesday · Episode select + Quest player + Match Sound

## 오늘의 목표
하루를 늘려 **3 화면 + Match Sound 전용 2 변형** 와이어프레임 확정. 학습자가 Home Continue CTA 를 누른 직후 어떤 길로 가는지 닫는다. F-001 §5 가 참조하는 두 sketch (`stage1/match-sound.md`, `stage1/match-sound-results.md`) 가 이 날 산출된다.

## 왜 오늘
- F-001 ready 상태인데 §5 UI sketch 가 비어 있음 — 화요일 회의 전에 이걸 닫지 않으면 구현 PR 을 열 수 없음.
- `quest/player` 는 모든 미니게임(Match Sound, Build a Letter, Trace Stroke, Voice Echo)이 공유하는 외피. 한 번 잘 그리면 F-003/004/005 모두 재사용.
- 결과 화면(`quest/results.md`)은 1·2·3 stars 분기 + Heritage Card 슬롯 자리 결정 — F-007 (deferred) 전에 자리만 잡아둠.

## 사전 준비 (2분)
- 어제 `journey/home.md` 의 Continue CTA exit ID 가 무엇이었는지 확인.
- F-001 §3 (Acceptance criteria) 다시 훑기 — 4 tiles, 5 rounds, 1/2/3 stars, 64dp.
- blueprint 06 §2 Match Sound 흐름(Hook → Discover → Play → Check → Celebrate, 3–4 분) 환기.

## Claude Design 프롬프트 (복붙)

```prompt
Produce 5 low-fidelity wireframes (one Markdown file each) for the Hangul
Route Quest player flow.

Audience: English-speaking children 5–7 (P5 primary). UI text English.

Strict rules (from wireframe-skill):
- ASCII box diagrams only.
- 7 sections each: Scenario, Goal, Box, Interaction, Navigation, Data,
  Open questions.
- 3 states each: success, empty, error.
- Touch targets visually large; document "≥ 64dp" in Box as a note.
- No color / font / icon decisions.

Screens:

1. journey/episode-select
   - Filters the current Stage's Episodes (here Stage 1 has 5).
   - Each Episode as a Card-sized tappable row: name (placeholder),
     completion % bar, lock badge if not yet unlocked.
   - Empty: brand-new learner, only Episode 1·A1 unlocked.
   - Error: progress fetch fails → all shown, locks stale.

2. quest/player (shared shell for ALL minigames)
   - Top: Stage / Episode breadcrumb tiny, Hoya thumbnail.
   - Center: minigame slot (variant-specific content).
   - Bottom: 5-round progress dots + a Pause button (parent-mode-only
     fast-exit; child-mode shows nothing here).
   - Variant-specific content is referenced by a slot id so siblings
     match-sound / build-letter can plug in.

3. quest/results (shared)
   - Hoya cheering pose placeholder.
   - 1–3 stars (animated reveal — visual only, no anim spec).
   - "[[ Next ]]" primary CTA → next Quest or journey/home.
   - "[ See cards ]" tertiary → library/gallery.
   - Empty: 0 stars edge case (re-try only, no shaming language).
   - Error: result write fails → "Saved locally, will sync" toast slot,
     CTA still works.

4. stage1/match-sound  (variant of quest/player slot)
   - Hoya speech-bubble placeholder at top "Tap the letter you hear".
   - 4 tiles in a 2×2 grid, each with a jamo placeholder (e.g. ㄱ, ㄴ,
     ㄷ, ㄹ). Note "≥ 64dp tile size, ≥ 8dp spacing".
   - Tiny replay-audio icon, bottom-right.
   - Empty: audio not yet loaded — placeholder text prompt visible per
     F-001 §3.3.
   - Error: audio load fails → text fallback shown, retry icon visible.

5. stage1/match-sound-results (variant of quest/results)
   - Same shell as quest/results but with mini round-by-round dots
     showing which rounds were correct.
   - "[[ Next round ]]" or "[[ Done ]]" depending on round index.

Output exactly 5 Markdown files in these paths:
- design/wireframes/journey/episode-select.md
- design/wireframes/quest/player.md
- design/wireframes/quest/results.md
- design/wireframes/stage1/match-sound.md
- design/wireframes/stage1/match-sound-results.md
```

## 작업 흐름 (15분)
1. 프롬프트 실행.
2. `quest/player` 의 **slot 추상화** 확인 — Match Sound 외 다른 미니게임이 같은 외피를 쓸 수 있게 슬롯 id 가 명시되었나.
3. `stage1/match-sound` 의 4-tile 격자 — 한 화면에 5-round 진도 + 4 tiles + Hoya bubble 이 들어가 비좁아 보이지 않는지.
4. `quest/results` 의 0-star 처리가 비난 톤이 아닌지 (blueprint 02 anti-shame).
5. F-001 §5 가 가리키는 두 파일이 실제로 생성됐는지 마지막 확인.

## 결과 저장 (3분)
1. 5 개 .md 저장.
2. `design/prompts.md` 로그.
3. 커밋: `design(wireframe): add quest player + match-sound variants`.

## Code 다음 단계 안내
- F-001 §5 가 이제 실재하는 sketch 두 개를 가리킴 — spec status `ready` 가 진짜로 ready.
- Week 3 Component v1 들이 들어갈 자리:
  - Card (episode row, card slot) — Library 에서도 재사용.
  - Bubble (Hoya speech) — onboarding / quest 둘 다 사용.
  - Progress (Stage 진도, 5-round 진도) — 변형 2종 필요할 가능성.

## 막힐 때 대응
- 한 프롬프트로 5 화면이 너무 묵직 → 3 + 2 로 쪼개고 5분 휴식.
- `quest/player` 가 너무 minigame-specific 으로 그려짐 → "shell only, content comes via slot id".
- Results 화면에 별이 너무 화려 → "this is wireframe, no visual celebration; just box + label".
- 20 분 초과 → `episode-select` 와 `match-sound-results` 는 목요일 앞 5 분으로 미룬다.

## 검토 체크리스트
- [ ] F-001 §5 의 두 파일 (`stage1/match-sound.md`, `stage1/match-sound-results.md`) 존재
- [ ] `quest/player` 가 slot 추상화로 다른 미니게임에 재사용 가능
- [ ] 0-star (실패) 케이스에 shaming language 없음
- [ ] Audio 실패 시 텍스트 fallback 자리 (F-001 §3.3 정합)
- [ ] 진입·이탈 ID 가 어제 home + 어제 onboarding 과 닫힘

## 다음 시안 연결
- 내일(Thu) `library/gallery` 는 results 의 "See cards" 도착지.
- 금(Fri) review 에서 5 화면 간 graph 무결성 일괄 검토.
- Week 3 Components 의 Bubble / Card / Progress 가 이 화면들의 자리를 채운다.
