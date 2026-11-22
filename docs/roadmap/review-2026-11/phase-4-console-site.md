# Phase 4 — 콘솔과 사이트 (WO-28 – WO-34)

먼저 `README.md` 를 읽는다. 범위는 `apps/web`: 마케팅 사이트 `(en)`, `(loc)/[locale]` 와 어른용 콘솔 `(console)`(/signin, /start, /parent, /teach, /account). 학습자 레슨 화면은 여기 없다(`apps/mobile` 의 Expo web 빌드).

이 Phase 의 근거는 모두 **보고**(리뷰 단계에서 코드로 확인, 계획 작성 시 재확인하지 않음)다. 예외는 WO-28 의 `api.ts` 한 곳(확인). 집행 세션은 README §5.1 의 1번(인용 재확인)을 반드시 한다.

아래에서 경로 앞의 `W/` 는 `apps/web/src/` 를 뜻한다.

---

## WO-28 콘솔 API 요청에 시간 제한을 둔다

**목표.** 네트워크가 "끊김"이 아니라 "멈춤"일 때도 화면이 오류와 재시도로 간다.

**근거.**
- 확인: `W/lib/console/api.ts:386-391` — `call()` 이 `fetchImpl(url, { ...init, headers })` 를 AbortController 없이 부른다.
- 보고: 멈춤의 결과 — 로그인 직후 "Taking you to your home…" 정지(`W/components/console/GrownUpRouter.tsx:109-112`), 플랜 저장 "Saving…" 고정과 하단 바 비활성(`W/app/(console)/teach/space/plan/page.tsx:234, 469-470`), NotesHub 스켈레톤 유지(`W/components/console/NotesHub.tsx:34-39`), 결제 복귀 "checking" 고정(`W/app/(console)/account/billing/page.tsx:99-103`).
- 보고: 같은 저장소의 `W/lib/waitlist.ts:43-44` 는 15초 abort 를 쓴다.

**사양.** `docs/specs/AMENDMENTS-CONSOLE-RESILIENCE.md` (WO-28, WO-29 공용) — F-CONSOLE-*, `AMENDMENTS-GROWNUP-UX.md` 수정.

| 행 | 모델 | 내용 |
|---|---|---|
| CR-0 | Opus 5.5 | 사양(WO-28 + WO-29) |
| CR-1 | Sonnet 5.5 | `call()` 에 타임아웃 → `{ ok: false, error: 'network' }` |
| CR-2 | Sonnet 5.5 | 네 화면이 `network` 오류에서 기존 Try again 경로로 가는지 테스트로 고정 |
| CR-3 | Sonnet 5.5 | 빈 캔버스 대기에 600ms 뒤 "Loading…" 한 줄, Clerk 대기 시간 이월 |

**지침.**
- 타임아웃 기본 12초. 쓰기(POST/PUT/DELETE)도 같은 값이지만, **타임아웃된 쓰기는 서버에서 성공했을 수 있다.** 재시도가 중복을 만들지 않는지 엔드포인트별로 확인한다(플랜 저장은 id 기반 upsert 인지, 초대·결제는 멱등 키가 있는지). 멱등하지 않은 쓰기는 자동 재시도하지 않고 "확인 중" 상태에서 재조회한다. 이 표를 사양에 넣는다.
- 호출자가 넘긴 `init.signal` 이 있으면 합친다.
- CR-3 근거(보고): `W/components/console/GrownUpLayout.tsx:33-35` 의 `aria-busy` 빈 div, `GrownUpLock.tsx:440`. 대기 상한 `RECORD_WAIT_MS = 1500`(`W/lib/i18n/locale-context.tsx:113`), `CLERK_LOAD_TIMEOUT_MS = 15_000`(`W/lib/console/signin-flow.ts:31`), `LOCK_READ_TIMEOUT_MS = 3_000`(`GrownUpLock.tsx:52`). Clerk 가 죽으면 15초 뒤 `/signin` 으로 가서 `ClerkSignIn.tsx:100` 의 시계가 다시 시작된다. 경과 시간을 넘겨 재시도 패널을 바로 띄운다.

**테스트.** fetch 가 영원히 pending 인 mock + fake timers: 12초 뒤 `network` 반환. 네 화면 각각 재시도 버튼이 보임. 600ms 전에는 로딩 문구가 없고 뒤에는 있음.

**수용 기준.** 어떤 콘솔 화면도 20초 넘게 아무 안내 없이 멈춰 있지 않다.

**예상.** 사양 0.5d, 구현 1d.

---

## WO-29 교사의 작성 내용을 잃지 않는다

**선행.** WO-28 의 CR-0.

**목표.** 플랜 빌더와 설정 화면에서 저장 실패, 취소, 이탈, 잠금이 입력을 지우지 않는다.

**근거 (모두 보고).**
- 저장 실패 뒤 "Try again" 이 재저장이 아니라 재조회다: `plan/page.tsx:242` `setError(… 'saveFailed')`, `:311` `<Button onClick={() => void load()}>`, `:189-190` `openDraft(draftOf(current))`, `:119-121` `setDirty(false)`. `load()` 안의 `builderOnLoad` 분기(`W/lib/console/placement.ts:141`)는 리뷰가 직접 읽지 않았다 — **반드시 읽고 실제 동작을 확정한다.**
- 이탈 가드 없음: `beforeunload` 가 `apps/web/src` 에 0건. Cancel 은 `plan/page.tsx:474-478` 에서 `openDraft(EMPTY); setEditing(false);` 를 바로 실행. 확인은 다른 플랜을 열 때(`:268`)뿐.
- 비활성 이유가 안 보임: `plan/page.tsx:469` `disabled={busy || !api || draft.items.length === 0 || draft.title.trim().length === 0 || (draft.targets !== null && draft.targets.length === 0)}`. 상태 줄(`:466-467`)은 개수와 분만. 본보기 `W/app/(console)/teach/space/lecture/page.tsx:430-432`.
- 잠금이 페이지를 언마운트: `W/components/console/GrownUpLock.tsx:441-445` locked 면 `children` 대신 `GrownUpLockScreen`. `:308-310` 15분 무입력, `:276-283` 숨김 5분. `:446` 주석의 "half-typed form survives" 는 재확인 중 덮개에만 해당.
- 기존 초안 저장 패턴: `W/lib/console/composer-draft.ts`(노트 작성기의 세션 초안).

| 행 | 모델 | 내용 |
|---|---|---|
| CR-4 | Sonnet 5.5 | 저장 오류의 버튼이 `save(publish)` 를 다시 실행. `dirty` 인 동안 `load()` 가 초안을 덮어쓰지 않음 |
| CR-5 | Sonnet 5.5 | 플랜 빌더 세션 초안(`composer-draft` 패턴) + Cancel 확인(ConfirmSheet) + `beforeunload` |
| CR-6 | Sonnet 5.5 | 하단 바에 비활성 이유 한 줄("Add a title", "Pick who this is for", "Add a lesson") |
| CR-7 | Opus 5.5 | 잠금 중에도 children 을 마운트한 채 덮개로 가린다 |

**CR-7 주의.** 보안 요구가 먼저다. 덮개 아래 내용이 (a) 시각적으로 보이지 않고 (b) `inert` 로 키보드·스크린리더에 닿지 않으며 (c) PIN 경로의 전체 페이지 이동 뒤에는 어차피 사라지므로 CR-5 의 세션 초안이 복구를 맡는다는 것을 사양에 적는다. 잠금 사양(`AMENDMENTS-GROWNUP-UX.md`, F-APP-001 §3.9)이 "잠기면 내용이 DOM 에 없어야 한다"고 요구하는지 먼저 읽는다. 요구한다면 CR-7 은 하지 않고 CR-5 로 충분하다.

**테스트.** 저장 mock 실패 → Try again → 저장 재호출, 편집 내용 유지. dirty 상태에서 Cancel → 시트, "Keep editing" 이 기본 포커스. 새로고침 뒤 초안 복원. 비활성 조건 세 가지 각각의 문구.

**수용 기준.** 플랜을 고치다 저장 실패·취소·새로고침·잠금 중 어느 것이 일어나도 편집 내용을 되찾을 수 있다.

**하지 말 것.** 세션 초안에 학습자 이름 외의 민감 정보를 새로 저장하지 않는다. 저장소는 `W/lib/i18n/safe-storage.ts` 래퍼로.

**예상.** 2d.

---

## WO-30 수업 화면: 코드만 크게 보기 (Phase 1 과 함께 진행)

**목표.** 교사가 참여 코드를 교실 화면에 띄울 때 학습자별 정보가 보이지 않는다.

**근거 (보고).** `W/app/(console)/teach/space/page.tsx:740` `{classPage && !empty ? invite : null}` 가 명단 **뒤**에 온다. 명단 카드마다 `needsPractice` 글자가 있다(`:685-690`). `anonymizeRoster` 는 이름만 이니셜로 바꾼다. 늦게 온 아이에게 코드를 보여주려고 프로젝터에 띄우면 서로의 "다시 볼 글자" 가 보인다. CLAUDE.md §1 의 공개 비교 금지에 닿는다.

**사양.** `docs/specs/AMENDMENTS-CLASS-CODE-OVERLAY.md` — F-SPACE-001, `AMENDMENTS-TEACHER-VISIBILITY-TRANSFER.md` 수정.

| 행 | 모델 | 내용 |
|---|---|---|
| CO-0 | Opus 5.5 | 사양 + 와이어프레임 + 시안 |
| CO-1 | Sonnet 5.5 | 액션 바의 "Show the code" → 전체 화면 오버레이 |
| CO-2 | Sonnet 5.5 | 명단의 학습자별 약점을 기본 접힘으로(교사가 카드를 열어야 보임) |

**설계.** 오버레이에는 반 이름, 코드(아주 크게, 글자 사이 간격), QR, 만료 시각, 닫기만. 명단·이름·진도 없음. 오버레이가 열린 동안 뒤 내용은 `inert`. Escape 와 닫기 버튼으로 닫고 포커스는 연 버튼으로 돌아간다(기존 `ConfirmSheet` 의 포커스 규칙). 코드 재발급 버튼은 오버레이에 두지 않는다. CO-2 는 화면 공유 중 실수 노출을 줄이는 두 번째 방어다: 약점 글자는 카드를 펼쳤을 때만.

**수용 기준.** 오버레이 스크린샷에 학습자 이름이나 진도가 하나도 없다. 키보드만으로 열고 닫을 수 있다.

**예상.** 사양·시안 0.5d, 구현 1d.

---

## WO-31 콘솔 다듬기 일괄

**목표.** 작은 불일치를 한 번에 정리한다. 각 항목은 독립적이라 한 PR 에 2–3개씩 묶는다.

**사양.** `docs/specs/AMENDMENTS-CONSOLE-POLISH-2026-11.md`. 표 형태. 사양 행(Opus 5.5)에서 인용을 재확인하고, 구현은 전부 Sonnet 5.5.

| # | 현재 (보고) | 변경 |
|---|---|---|
| 1 | 반 페이지 오류에 "Loading…" 제목과 소용없는 재시도: `teach/space/page.tsx:481` `title={roster ? undefined : c.space.loading}`, `:551-555` forbidden/gone 에도 Try again. 본보기 `teach/space/route/page.tsx:103` | 오류 시 제목 없음. 재시도는 `cantReach` 에만, 나머지는 "Back to the list" |
| 2 | 코드 복사 피드백 불일치: `teach/space/page.tsx:283-289` 실패 시 무음, `:272-280` 재발급이 `copied` 를 리셋하지 않음. `start/page.tsx:62-69`, `parent/page.tsx:453-456` | `W/components/console/JoinLinkParts.tsx:23-61` 의 idle/copied/failed + 상시 마운트 status 를 공용 훅으로 만들어 네 곳에 적용. 재발급 시 리셋 |
| 3 | 설정의 성공·실패가 모두 맨 위 amber: `teach/space/settings/page.tsx:242` `<Notice tone="nudge">` | 성공은 success 톤, 알림으로 포커스·스크롤 |
| 4 | Unarchive 가 danger 스타일: `W/components/console/SettingsParts.tsx:248` | 보조 버튼 |
| 5 | 리포트 기간 탭마다 스켈레톤과 재조회: `teach/space/learner/page.tsx:94` `if (!background) setLoad(null);` 본문은 기간과 무관(`W/lib/console/report-view.ts:1004` 주석) | 받은 데이터로 즉시 그리고 조회 기록만 백그라운드 |
| 6 | 조용한 주의 리포트가 0 을 나열: `report-view.ts:735, 742`. 홈 카드는 "never a zero"(`parent/page.tsx:88-89`) | **먼저 사양을 확인.** 의도된 디자인이 아니면 `days.count === 0` 일 때 타일을 빼고 헤드라인과 팁만 |
| 7 | 재연결 Deny 가 한 번 탭: `W/components/console/FamilyNeedsYou.tsx:290`. Approve 는 팝업 경유(`:282-285`) | Deny 도 팝업을 거치거나 5초 Undo |
| 8 | 오프라인일 때 버튼이 이유 없이 비활성: `RelinkPopup.tsx:134` `const off = busy \|\| !online;`, `FamilyNeedsYou.tsx:259` | `W/components/console/TransferParts.tsx:477` 처럼 `t.states.offline` 문구 |
| 9 | `/start` 오류가 회색 문장: `start/page.tsx:135` `<Muted>`. "Please sign in again." 에 링크 없음 | `Notice` + `role="alert"` + Sign in 버튼 |
| 10 | `/start` 가 페르소나를 두 번 물음: `?persona=parent` 로 와도 `:74-112` "Who are you?" | 유효한 hint 가 있으면 이름 단계에서 시작 |
| 11 | 잠금 화면의 "Sign in again" 이 경고 없이 로그아웃: `GrownUpLayout.tsx:112` | 라벨을 "Sign out and sign in again" 수준으로. 보안상 의도이므로 동작은 유지 |
| 12 | Display 시트만 배경 inert 없음: `inertOthers` 사용처에 `W/components/console/DisplaySheet.tsx` 없음 | 다른 시트와 같게 |
| 13 | 명단 그리드 `minmax(280px, 1fr)`: `teach/space/page.tsx:645`. 안전한 예 `plan/page.tsx:359` `minmax(min(300px, 100%), 1fr)` | 같은 패턴. 30명 기준 이름 검색은 사양에서 결정 |
| 14 | `feedback.danger` 텍스트 대비: `W/components/console/ui.tsx:76-78`, canvas 위 4.38:1 | WO-41 의 토큰 행과 함께 |
| 15 | 가족 연결에 링크·QR 없음: `W/lib/console/join-link.ts:13` `if (input.kind !== 'class' …) return null;`. "open-app" 버튼은 가족이 비어 있을 때만(`parent/page.tsx:828-841`), 추가 패널 `:766` 에는 없음 | 자녀 추가 패널에 open-app 버튼. 가족용 링크·QR 은 **OD-R7(동의) 뒤에만** |

**수용 기준.** 표의 각 행에 테스트 하나 이상. 15번의 링크·QR 부분은 OD-R7 전에는 구현하지 않는다.

**예상.** 사양 0.5d, 구현 3d.

---

## WO-32 사이트

**목표.** 첫 화면에서 버튼이 밀리지 않고, 이메일이 주소창에 남지 않고, 고른 언어가 기억된다.

**사양.** `AMENDMENTS-SITE-NEWUSER.md` 에 절 추가. 사양 Opus 5.5, 구현 Sonnet 5.5.

| # | 현재 (보고) | 변경 |
|---|---|---|
| 1 | 대기자 폼이 hydration 전에 눌리면 네이티브 GET: `W/components/landing/WaitlistForm.tsx:125-130` `<form noValidate onSubmit>` 에 `action`·`method` 없음 → `/?email=…` 가 주소와 히스토리에 남음 | `method="post"` 와 실제 action(서버가 받지 못하면 마운트 전 버튼 비활성 + `<noscript>` 안내). 어느 쪽인지 사양에서 결정 |
| 2 | 로케일 배너가 hydration 뒤에 끼어듦: `W/components/landing/LocaleBanner.tsx:16-29`(`useState(null)` → `useEffect`), `SiteShell.tsx:41` 에서 `<main>` 의 첫 자식 | 레이아웃을 밀지 않는 위치(고정 띠 또는 헤더 안)로. paint 전 인라인 스크립트는 CSP 와 맞는지 확인 뒤에만 |
| 3 | 언어 선택이 기억되지 않음: 배너 닫힘이 세션 한정(`W/lib/locale-banner.ts:54`), 선택 로케일 저장 없음 | 선택을 `safe-storage` 에 저장하고 루트 방문 시 존중. 서버 리다이렉트로 하지 않는다(SEO·캐시): 클라이언트에서 배너 대신 "Continue in 한국어" 한 줄 |
| 4 | 대기자 폼만 px 글자: `WaitlistForm.tsx:120, 154, 175, 194, 210` `fontSize: typography.size.*`. 나머지는 `rem()` | `rem()` |
| 5 | 입력 테두리 대비 약 1.85:1: `WaitlistForm.tsx:63` `colors.border.strong` | WO-41 의 토큰 변경을 따른다 |
| 6 | 서버 오류에 "연결을 확인하세요": `W/lib/waitlist.ts:55` 비-200 을 모두 `error` | 5xx 문구 분리 |
| 7 | 히어로의 안심 문구가 가장 작은 글자: `W/components/landing/HomePage.tsx:79` caption + `text.muted` (추정) | 본문 하한 18 이상 |
| 8 | 말풍선이 320px 에서 좁음: `W/app/globals.css:340-346` `max-width: 34%`, `:53-54` `overflow-wrap: anywhere` (추정) | 좁은 폭에서 말풍선을 아래로. **[실기기]** 320px, es/ko 확인 |

**수용 기준.** Lighthouse CLS 가 한국어 브라우저 설정에서 0.1 미만(배너 포함). JS 를 끈 상태에서 폼을 눌러도 주소창에 이메일이 없다.

**예상.** 1.5d.

---

## WO-33 PIN 재설정 흐름 (웹과 네이티브)

**목표.** PIN 을 잊은 보호자가 막다른 길 없이 되찾는다.

**근거 (보고, 표시된 것만 확인).**
- 웹: `W/components/console/PinResetPage.tsx:142` `if (outcome !== 'done') return finish({ kind: 'refused', line: 'unavailable' });` — Clerk 창을 닫은 것(취소)을 장애와 같이 처리. `:108-109` `started.current` 가 재실행을 막음. 안내 문구(`packages/i18n/src/messages/en/console.ts:2511`)가 "앱에서 Forgot PIN? 을 쓰세요" 인데 그 경로가 방금 온 길이다.
- 웹(추정): 재설정 자격이 로그인을 다 마친 뒤에야 판정(`W/lib/console/pin-reset.ts:69-72`). 이메일 코드까지 받고 나서 "Rescue Code 나 24시간 대기" 를 읽는다.
- 네이티브: 확인 `apps/mobile/src/config/flags.ts:328` `pinResetSignInEnabled: false`. 보고 `apps/mobile/src/screens/parent/PinResetScreen.tsx:184-304` — Rescue Code 또는 24시간 대기뿐.
- 네이티브: 보고 `apps/mobile/src/screens/parent/PinEntryScreen.tsx:935-942` — 4자리를 넣어도 Unlock 을 눌러야 한다.

**사양.** `AMENDMENTS-GROWNUP-UX.md` 에 절 추가 또는 `AMENDMENTS-PIN-RESET-FLOW.md`. F-AUTH-004(네이티브 로그인)와 맞춘다.

| 행 | 모델 | 내용 |
|---|---|---|
| PR-0 | Opus 5.5 | 사양: 상태 기계(취소 / 장애 / 자격 없음 / 성공), 보안 검토 |
| PR-1 | Sonnet 5.5 | 웹: 취소는 "Check it is you again" 버튼으로 재시작. 안내 문구 정정 |
| PR-2 | Sonnet 5.5 | 웹: 자격 안내를 로그인 전에(자격을 서버가 로그인 없이 말해 줄 수 없으면 "로그인 뒤에 24시간이 걸릴 수 있어요" 사전 고지) |
| PR-3 | Opus 5.5 | 네이티브: `pinResetSignInEnabled` 를 켤 조건 정리와 구현. 24시간 대기는 화면 맨 위에서 먼저 말한다 |
| PR-4 | Sonnet 5.5 | 네이티브: PIN 4번째 숫자에서 자동 제출 |

**보안 주의 (PR-0).** PIN 은 아이로부터 어른 영역을 지키는 장치다. 재설정을 쉽게 하는 변경은 "아이가 부모 기기에서 이메일 코드를 받아 재설정" 같은 우회를 만들 수 있다. 24시간 대기와 Rescue Code 가 왜 있는지 기존 사양(`AMENDMENTS-ONE-ACCOUNT-MANY-USERS.md`, F-APP-001 §3.9)에서 읽고, 플래그가 꺼져 있는 이유가 기록돼 있으면 그대로 인용한다. PR-4 의 자동 제출은 틀린 PIN 의 시도 제한(rate limit)과 함께 본다: 자동 제출이 시도 횟수를 빠르게 태우지 않는지.

**수용 기준.** 웹에서 Clerk 창을 닫아도 같은 화면에서 다시 시작할 수 있다. 안내 문구가 가리키는 길이 실제로 다른 길이다.

**예상.** 사양 0.75d, 구현 2d.

---

## WO-34 부모 동의: 현황 조사 (구현 아님)

**목표.** "개인 데이터가 계정에 연결되기 전에 검증 가능한 부모 동의" (CLAUDE.md §1)가 지금 코드에서 어떻게 지켜지는지 사실을 정리해 오너와 법률 검토에 넘긴다.

**근거 (보고).** 콘솔 가입의 유일한 관문은 자기 선언 체크박스("I am a parent, guardian or teacher", `W/components/console/SignInParts.tsx:235-246`). 설정 문구는 "A parent consents (email at join — coming later)"(`packages/i18n/src/messages/en/console.ts:1450`). 학습자 앱 쪽 동의 단계(온보딩의 Privacy 화면, `apps/mobile/src/screens/onboarding/CreateProfileScreen.tsx:743-780`)는 리뷰가 깊이 보지 못했다.

| 행 | 모델 | 내용 |
|---|---|---|
| CA-1 | Opus 5.5 | 조사 보고서 `docs/roadmap/review-2026-11/consent-audit.md` |

**보고서가 답해야 할 것.**
1. 데이터 흐름 표: 어떤 데이터가(이름, 아바타, 진도, 기기 식별자, 이메일) 언제 기기를 떠나는가. 로컬 전용 프로필, 가족 연결, 반 참여, 동기화(F-SYNC-002), 결제 각각.
2. 각 흐름 앞에 있는 동의·확인 단계와 그 강도(자기 선언 / PIN / 이메일 확인 / 결제 수단).
3. 관련 사양이 약속한 것과 구현된 것의 차이: F-LEARN-001(all-ages onboarding, "counsel review gates the store release"), F-AUTH-001/002/004, F-SPACE-001, `AMENDMENTS-ONE-ACCOUNT-MANY-USERS.md`, 네이티브 child-safety suite(CS-N1–N15).
4. "coming later" 로 표시된 것의 목록과 각각이 막고 있어야 할 기능.
5. 오너와 법률 자문에게 물을 질문 목록. 법적 결론은 내리지 않는다.

**하지 말 것.** 이 WO 에서 코드를 바꾸지 않는다. 법률 판단을 단정하지 않는다("COPPA 를 위반한다 / 준수한다" 대신 "이 흐름에는 이메일 확인 단계가 없다").

**수용 기준.** 보고서의 모든 주장에 `파일:줄` 이 있다. OD-R7 을 결정할 수 있는 정보가 모인다.

**예상.** 1d.
