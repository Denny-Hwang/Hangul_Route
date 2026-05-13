---
date: week-02 / Friday
duration: 30 min (08:00 – 08:30 KST — review block)
deliverables:
  - design/wireframes/_review-week-02.md
  - design/playbook/week-02/README.md (회고 섹션 채움)
depends_on:
  - 이번 주 모든 wireframe (Mon–Thu)
unblocks:
  - Week 03 component work (Button / Card / Bubble / Progress)
  - F-001 의 §5 UI sketch 가 실재함을 정식 확인
---

# Day 05 — Friday · Wireframe review + Week 02 handoff

## 오늘의 목표
이번 주 만든 **10여 개 wireframe** 의 (1) 그래프 무결성 (2) wireframe-skill 7-섹션 충족 (3) anti-pattern 부재 를 한 번에 검수하고, Week 03 컴포넌트 작업으로 인계한다.

## 왜 오늘
- 월–목 동안 화면별로 진행 — 화면 간 enter/exit ID 가 어긋날 수 있음. 한 번에 그래프를 닫는다.
- F-001 spec 의 §5 가 가리키는 sketch 가 실재하는지 확정해야 spec 이 진짜 `ready`.
- Week 03 의 Component spec 들이 어느 wireframe 자리를 채울지 mapping 을 미리 세운다.

## 사전 준비 (2분)
- 이번 주 PR 들의 wireframe 파일 목록을 한 줄로 정리:
  - onboarding/welcome / language-pick / first-quest-preview
  - journey/home / episode-select
  - quest/player / results
  - stage1/match-sound / match-sound-results
  - library/gallery / card-detail
- `.claude/skills/wireframe-skill/SKILL.md` §5 검증 체크리스트 펼쳐두기.

## Claude Design 프롬프트 (복붙)

```prompt
Audit the following 11 wireframes against the wireframe-skill §5
checklist:

[paste each file path + content here]

For each file report:
- 7-section completeness (Y/N per section: Scenario, Goal, Box,
  Interaction, Navigation, Data, Open questions).
- 3-state coverage (success, empty, error).
- Anti-pattern flags (shame language / SNS / competitive / signup-wall
  on welcome / pixel-level decisions / final copy / color decisions).
- Navigation graph: list any enter ID or exit ID that does not appear
  as the corresponding exit / enter of another file. Goal is a closed
  graph with no orphan IDs.

Then output:
1. A table of (file, ✅/⚠️/❌, top issue).
2. A consolidated graph (Mermaid) of the 11 screens, showing all
   enter/exit relationships, so I can eyeball the flow.
3. A short list (≤ 5 bullets) of must-fix items before Week 03 starts.

Save the report to design/wireframes/_review-week-02.md.
```

## 작업 흐름 (25분)
1. 프롬프트 실행 (10 분). Claude 가 11 파일을 함께 읽음.
2. 결과 테이블 검토 (5 분). ⚠️ 또는 ❌ 항목이 있으면 우선순위 정렬.
3. 그래프(Mermaid) 시각 검토 (5 분) — orphan ID, dead-end 가 있는지.
4. Must-fix 5 개 중 5 분 안에 닫을 수 있는 것은 즉시 패치 (오타·exit ID 정정 수준만).
5. 5 분 초과하는 fix 는 INBOX 로 넘김 (T-XXX 추가, Week 03 안에 처리).

## 결과 저장 (3분)
1. `_review-week-02.md` 가 자동 저장됨.
2. `design/playbook/week-02/README.md` 의 "금요일 회고" 체크박스 채움.
3. 커밋: `design(wireframe): week 02 review + handoff to week 03`.

## Code 다음 단계 안내
- Week 03 의 4 컴포넌트가 어느 wireframe 자리에 매핑되는지 확정:
  - **Button** (primary / secondary / tertiary) — 거의 모든 화면.
  - **Card** — episode-select, library/gallery, library/card-detail.
  - **Bubble** (Hoya speech) — onboarding/welcome, quest/player.
  - **Progress** (Stage 진도, 5-round dots) — journey/home, quest/player.
- F-001 §5 의 두 sketch 가 존재함을 spec 본문 footer 에 commit hash 로 인용 (선택).

## 막힐 때 대응
- Mermaid 그래프 너무 복잡 → onboarding · journey · quest · library 4 그룹으로 분할 후 4 개 부분 그래프로.
- ❌ 항목이 너무 많음 (≥ 5) → 이번 주 wireframe 작업 자체에 무리가 있었다는 신호. Week 03 시작을 늦추는 결정을 sprint 회고에 명시.
- 30 분 초과 → 검수만 종료, fix 는 전부 INBOX 로.

## 검토 체크리스트
- [ ] 11 파일 모두 7-섹션 완전
- [ ] 11 파일 모두 success / empty / error 3 상태
- [ ] enter / exit ID 그래프 닫힘 (orphan 0)
- [ ] anti-pattern 0 (shame / SNS / competitive / signup-wall on welcome)
- [ ] F-001 spec 의 §5 sketch 2 개 존재 확인
- [ ] 다음 주 컴포넌트 ↔ wireframe 매핑 표 작성

## 다음 시안 연결
- Week 03 Monday: Button v1 시안 — 모든 wireframe 의 CTA 자리 채움.
- Week 03 Wednesday: Bubble v1 — onboarding / quest 의 Hoya 자리.
- Week 03 Friday: 컴포넌트 4종 일괄 승격 PR (`design: promote W3 components to design-system`).
