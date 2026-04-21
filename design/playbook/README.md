# design/playbook/

**일일 디자인 플레이북.** 매일 아침 15분, 본인이 Claude Design 세션을 수동으로 돌리기 위한 가이드 모음.

## 왜 있는가

- 디자인은 v2.2 에서 **자동 루틴 없음** (R5 Design Sync 는 제거).
- 대신 매일 아침 이 폴더의 그날 가이드를 열어 — 복붙 프롬프트 → 세션 → 저장 — 3단계로 끝낸다.
- 12주 로드맵(`overview.md`)이 무엇을 언제 할지 정해두었으므로 "오늘 뭐 하지?" 고민이 없다.

## 매일 흐름 (08:15 – 08:30 KST)

1. `design/playbook/overview.md` 에서 오늘이 week-NN / day-NN 인지 확인.
2. 해당 `week-NN/day-NN-*.md` 파일 열기.
3. "사전 준비" 1분.
4. "Claude Design 프롬프트" 섹션의 ` ```prompt ` 블록 그대로 복붙 → Claude Design 세션 시작.
5. "작업 흐름" 대로 10분.
6. "결과 저장" 대로 `design/` 하위에 커밋, `design/prompts.md` 로그.
7. "검토 체크리스트" 로 자가 점검.

자세한 SOP 는 `docs/workflows/daily-design-session.md`.

## 구성

```
playbook/
├── README.md
├── overview.md                       # 12주 로드맵 + 코드 의존성 매핑
├── week-01/
│   ├── README.md                     # 이번 주 목표
│   ├── day-01-monday.md              # Color Palette v1
│   ├── day-02-tuesday.md             # Typography Scale
│   ├── day-03-wednesday.md           # Spacing tokens
│   ├── day-04-thursday.md            # Hoya Character v1
│   └── day-05-friday.md              # Icon Set v1
├── week-02/ ... week-12/             # placeholder (본문은 sprint 시작 시 채움)
└── templates/                        # 재사용 프롬프트 템플릿
    ├── color-palette.md
    ├── character.md
    ├── icon-set.md
    ├── screen-mockup.md
    ├── illustration.md
    └── animation-concept.md
```

## 원칙

- **복붙해서 바로 쓰는 프롬프트.** 사용자 커스터마이즈는 "추가 제약" 섹션에서.
- **산출물 위치 고정.** 각 day 가이드의 "결과 저장" 섹션이 어디에 넣을지 지정한다.
- **코드 의존성 명시.** 해당 시안이 풀어주는 다음 코드 작업을 각 가이드 끝에 링크.
- **막힐 때 스킵 가능.** 금요일에 롤오버. 디자인이 개발 병목이 되지 않도록.
