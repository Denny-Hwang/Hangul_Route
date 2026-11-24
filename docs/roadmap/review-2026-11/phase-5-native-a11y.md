# Phase 5 — 네이티브 다듬기와 접근성 (WO-35 – WO-42)

먼저 `README.md` 를 읽는다. 범위는 `apps/mobile` 과 `packages/design-system`. 근거는 표시가 없으면 **보고**(리뷰 단계 판독, 재확인 필요)다. 경로 앞의 `M/` 은 `apps/mobile/src/`, `D/` 는 `packages/design-system/src/` 를 뜻한다.

UI 가 바뀌는 WO 는 와이어프레임 → 시안 → 구현 순서를 지킨다(README §5.1).

---

## WO-35 네이티브에서도 가입 전에 첫 레슨

> 재확인 2026-11-21 (main `d5ba0217c`): 줄 이동 — `flags.ts:332` `guestLessonEnabled: !isNativeBundle()` 는 그대로. 온보딩 Privacy 단계는 `CreateProfileScreen.tsx:743-780` 에서 `:748-785` 로 옮겨졌다(AU-17e 입력 테두리, #1035). 게스트 run 은 AU-12 의 저장 대상이 아니다(GU-D6, GU-D12). GN-1 은 이 점을 그대로 둔다.

**선행.** OD-R10.

**목표.** 스토어에서 설치한 사람이 웹 방문자와 같은 길이로 첫 학습에 닿는다.

**근거.**
- 확인: `M/config/flags.ts:332` `guestLessonEnabled: !isNativeBundle()`.
- 보고: 네이티브 첫 실행 — Welcome → 누가 배우나 → 이름/수준/아바타 → Privacy(동의, 아이는 PIN 2회 입력) → "Where should we start?" → First quest preview → 퀘스트 1단계. `M/navigation/onboarding.tsx:13-18`, `M/screens/onboarding/CreateProfileScreen.tsx:748-785`.
- 사양: `docs/specs/AMENDMENTS-GUEST-FIRST-LESSON.md` 가 웹의 게스트 첫 레슨을 정의한다. 네이티브에서 꺼 둔 이유가 거기 적혀 있을 수 있다 — **먼저 읽는다.**

**사양.** `AMENDMENTS-GUEST-FIRST-LESSON.md` 에 네이티브 절 추가.

| 행 | 모델 | 내용 |
|---|---|---|
| GN-0 | Opus 5.5 | 사양: 꺼 둔 이유 확인, App Review 관점(5.1.4, 2.3.8) 점검, 게스트 진도의 프로필 이관 |
| GN-1 | Opus 5.5 | 네이티브 게스트 스택 활성화와 이관 |
| GN-2 | Sonnet 5.5 | (GN-1 이 불가할 때의 대안) First quest preview 화면을 생략하고 "I am new" 가 곧바로 퀘스트를 연다 |

**주의.** 게스트 레슨 동안 기기를 떠나는 데이터가 없어야 한다(로컬 전용). 게스트로 얻은 별·카드는 프로필을 만들 때 그대로 넘어간다("얻은 것은 빼앗지 않는다"). WO-34 의 조사 결과와 어긋나지 않게 한다.

**수용 기준.** 새로 설치한 네이티브 앱에서 두 번 탭 안에 첫 퀘스트의 Discover 가 보인다. 게스트 진도가 프로필 생성 뒤 남아 있다(테스트).

**예상.** 사양 0.5d, 구현 1.5d.

---

## WO-36 보호자·교사 네이티브 화면

**목표.** 매주 들어오는 어른이 덜 헤매고, 화면이 "그래서 무엇을 하면 되는지" 를 말한다.

**사양.** `AMENDMENTS-GROWNUP-UX.md` 에 절 추가. 사양·와이어프레임·시안 Opus 5.5, 구현 Sonnet 5.5.

| # | 현재 | 변경 |
|---|---|---|
| 1 | Grown-up area 까지 약 6동작: Home 아바타 → Profile → 스크롤 → 접힌 "For grown-ups"(`M/screens/profile/ProfileScreen.tsx:106` `useState(false)`) → 버튼 → PIN → Unlock | Profile 상단에 조용한 "Grown-ups" 행. PIN 자동 제출은 WO-33 PR-4 |
| 2 | 교사·가족 화면이 오프라인이 되면 불러온 데이터를 버림: `M/screens/account/TeacherHome.native.tsx:45, 66`(`!online ? 'offline'` 이 데이터 유무보다 먼저), `AccountSpaceScreen.native.tsx:59-72`, `AccountClassReportScreen.native.tsx:106, 118` | 데이터가 있으면 유지하고 상단에 "Showing what we loaded · Try again" 띠. 데이터가 없을 때만 offline 박스 |
| 3 | 보호자 대시보드에서 도구 카드가 학습자 카드보다 먼저, 통계에 기간·"마지막 연습일" 없음: `M/screens/parent/ParentDashboardScreen.tsx:138-223` | 학습자 카드를 먼저. 카드에 "Last practice: 2 days ago" 와 다음 한 걸음("Next: 받침 ㄴ, ㄹ") |
| 4 | 교사 roster 가 이름과 "See report" 뿐: `M/screens/account/AccountSpaceScreen.native.tsx:91-106` | 이름 옆에 "Practiced this week" / "Not yet this week". **점수·정렬·색 구분 없음**(공개 비교 금지). 정렬은 가입 순서 유지 |
| 5 | PIN 통과 뒤 최대 2초 빈 캔버스: `M/navigation/grown-up-stack.native.tsx:278`. `AccountGate.native.tsx:321-329` 대기에 타임아웃 없음 | 600ms 뒤 "Loading…", 대기 상한과 재시도 |

**4번 주의.** "아직" 상태가 아이를 지목하는 표시가 되지 않게 한다. 교사 개인 화면에서만 보이고, 수업 모드(presenter)와 화면 공유용 뷰에는 나오지 않는다. WO-30 의 접힘 규칙과 같은 원칙이다.

**수용 기준.** 반 리포트를 보던 중 네트워크를 끊어도 내용이 남는다. 대시보드 첫 화면에 학습자별 다음 한 걸음이 보인다.

**예상.** 사양·시안 1d, 구현 2.5d.

---

## WO-37 네이티브 플랫폼 기본기

> 재확인 2026-11-21 (main `d5ba0217c`): 줄 이동 — `App.tsx` 의 foreground 처리는 `:176-189` 에서 `:183-188` 로, `StatusBar style="dark"` 는 `:237` 에서 `:247` 로 옮겨졌다(foreground 에서 `syncAll` 을 부르지 않는 것은 그대로). `EditProfileScreen.tsx` 의 Save 는 `:533`, `JoinSpaceScreen.tsx:419-451`, `MoveClassScreen.tsx:165-210`, `RestoreScreen.tsx:127-168`(각 한 줄씩 밀림: AU-17e (#1035) 가 입력 테두리를 `border.shape` 로 바꿈). 퀘스트 나가기의 `destructive: true` 는 `QuestPlayerView.tsx:313-318` 에서 `:328-336` 으로 옮겨졌다. `online.ts`, `dialog.ts`, `haptics*.ts`, `audio.ts`, `audio-player.ts`, `voice-help.ts`, `app.json` 은 그대로. 참고: QS-2 (#1038) 의 페이드아웃은 웹 플레이어만이고 네이티브는 plain stop 을 유지한다(NB-6 과 겹치지 않음).

**목표.** 플랫폼 수준의 빠진 연결을 채운다. 각 행은 작고 독립적이다.

**사양.** `docs/specs/AMENDMENTS-NATIVE-PLATFORM-BASICS.md`. 사양 Opus 5.5(0.5d), 구현 전부 Sonnet 5.5.

| 행 | 현재 | 변경 |
|---|---|---|
| NB-1 키보드 | 확인: `KeyboardAvoidingView`, `automaticallyAdjustKeyboardInsets` 가 `M/` 와 `D/` 에 0건. `D/components/Screen/Screen.tsx:148-162` 의 ScrollView. 노출 화면(보고): `RestoreScreen.tsx:127-168`, `EditProfileScreen.tsx:306`(Save `:533`), `JoinSpaceScreen.tsx:419-451`, `MoveClassScreen.tsx:165-210` | `Screen` 의 ScrollView 에 `automaticallyAdjustKeyboardInsets`, `keyboardDismissMode="interactive"`. Android 는 `windowSoftInputMode` 확인(`android/` 폴더가 없으면 app.json 의 설정) |
| NB-2 온라인 감지 | 확인: `M/platform/online.ts:9` 항상 `true`. 보고: `App.tsx:183-188` foreground 에서 `syncAll` 을 부르지 않고 back-online 동기화가 네이티브에서 no-op. `M/logic/audio/controller.ts:250` 네트워크 TTS 가 프롬프트마다 1.5초 대기 | `expo-network`(이미 의존성에 있는지 `package.json` 에서 확인, 없으면 오너 승인)로 `online.ts` 구현. foreground 에서 `syncAll`. 오프라인이면 네트워크 TTS 를 기다리지 않고 바로 텍스트 |
| NB-3 다크 모드 | 보고: `apps/mobile/app.json:7` `userInterfaceStyle: "automatic"`, `App.tsx:247` `StatusBar style="dark"` 고정, `useColorScheme` 0건, `D/tokens.ts` 는 라이트 한 벌 | 다크 팔레트가 생기기 전까지 `"light"` 로 고정. (다크 테마 자체는 새 디자인 작업 — 이 계획 범위 밖) |
| NB-4 확인 시트 | 보고: `M/platform/dialog.ts:25-40` 네이티브는 시스템 `Alert`. `M/screens/quest/QuestPlayerView.tsx:328-336` 퀘스트 나가기가 `destructive: true`(iOS 빨간 버튼). `EditProfileScreen.tsx:163-168` 도 | 네이티브에도 앱의 `ConfirmSheet` presenter 등록. 학습자 화면의 확인에서 `destructive` 제거. (WO-06 이 이 행을 쓴다) |
| NB-5 햅틱 | 보고: `M/platform/haptics.ts:10`, `haptics.web.ts:18` 의 `setHapticsEnabled` 호출처 0건 | Display 시트(또는 Profile 의 Sound 카드)에 "Vibration" 스위치, 프로필 설정에 저장 |
| NB-6 오디오 | 보고(추정 포함): `M/platform/audio.ts:212` 백그라운드 진입 시 `stop()` 없음. `M/platform/audio-player.ts:307` iOS `MixWithOthers` 라 음악이 글자 소리를 덮음(Android 는 duck) | 백그라운드에서 stop. iOS `DuckOthers`. **[실기기]** 음악 재생 중 확인 |
| NB-7 Voice help | 보고: `M/logic/audio/voice-help.ts:56` 모든 OS 안내를 나열 | 네이티브에서 `Platform.OS` 로 필터 (WO-05 와 같은 PR 가능) |
| NB-8 가로 방향 | 보고: `apps/mobile/app.json:6` 폰 세로 고정. iPad 는 전 방향. 웹은 가로 레이아웃과 "Keep sideways" 가 있음 | 폰 가로 허용 + PortraitGuard 를 네이티브에 적용(WCAG 1.3.4). 게임 레이아웃이 가로에서 깨지는지 **[실기기]** 확인 뒤 |

**수용 기준.** 각 행에 테스트. NB-1: **[실기기]** iPhone SE 급 화면에서 코드 입력 중 Save 버튼이 보인다.

**예상.** 3d.

---

## WO-38 학습자 화면 다듬기

> 재확인 2026-11-21 (main `d5ba0217c`): 충돌(#1 일부)·줄 이동 — #1 의 첫 안 "launcher 를 없앤다" 는 이제 upstream 과 어긋난다. QB-2 (#1037) 가 launcher 를 되돌아온 단계의 화면으로 썼고(본 버튼 Continue, 둘째 버튼 Play again, 왼쪽 Previous), AU-9 (#1035) 의 "Skip for now" 별 상한도 launcher 의 Skip 에 걸려 있다(`apps/mobile/src/logic/quest-flow/check-launcher.ts` `launcherView(kind, copy, revisit)`, `screens/quest/StepActions.tsx`). 사양은 둘째 안(게임 종류별 한 줄과 아이콘)을 기본으로 하고, launcher 를 없애려면 QB-2 와 AU-9 를 함께 고치는 별도 결정으로 뺀다. 줄 번호: launcher 는 `QuestPlayerView.tsx:557-610`, 문구 `learner.ts:747-753`, Home 은 `HomeScreen.tsx:995-1049`(중복 행 `:203-217`, 빈 별 줄 숨김 `:441`), Route 탭 `tabs.tsx:91-96`(FN-5 (#1044) 로 탭 화면이 `frozenWhenBlurred` 로 감싸짐), 코드 입력 `JoinSpaceScreen.tsx:419-447`, `MoveClassScreen.tsx:165-195`. 나머지(#3, #5–#8, #10)의 인용 파일은 그대로다.

**목표.** 다음 행동이 눈에 먼저 들어오고, 같은 것이 두 번 나오지 않고, 막다른 길이 없다.

**사양.** `docs/specs/AMENDMENTS-LEARNER-SCREENS-2026-11.md`. `AMENDMENTS-DISPLAY-NAV.md`, F-STORY-004(Home), F-ROUTE-001 과 맞춘다. 와이어프레임·시안이 필요한 행에 표시. 사양·시안 Opus 5.5, 구현 Sonnet 5.5.

| # | 현재 | 변경 | 시안 |
|---|---|---|---|
| 1 | 게임마다 같은 launcher: `M/screens/quest/QuestPlayerView.tsx:557-610` "Ready for a quick game? / Play minigame"(`learner.ts:747-753`). QB-2 뒤로 같은 화면이 되돌아온 단계의 Continue / Play again 과 Previous 를 맡는다. 어떤 게임인지 말하지 않고 "minigame" 은 제작 용어 | launcher 를 없애고 게임 첫 화면에 한 줄 방법 안내와 Skip. 없앨 수 없으면 게임 종류별 한 줄("Listen and tap the letter")과 아이콘 | 필요 |
| 2 | Home 이 빽빽함: `M/screens/home/HomeScreen.tsx:995-1049` hero 위에 인사·Goals·pill 행. `:203-217` hero 와 같은 레슨이 Today's mission 에 비활성 행으로 중복. `:1047-1048` 신규 학습자에게 "0 cards", "0 three-star quests". `M/screens/home/CardsChip.tsx:14-41` 같은 모양 pill 중 Cards 만 눌림 | 0 일 때 pill 숨김. 중복 행 제거. hero 를 인사 바로 아래로. 눌리는 chip 에 chevron | 필요 |
| 3 | Journey 가 현재 위치로 스크롤하지 않음: `scrollTo` 가 `screens/journey`, `my-route`, `library` 에 0건. Stage 4 학습자가 Stage 1 맨 위에서 시작 | 포커스 시 Next 셀의 stage 행으로 스크롤(reduce-motion 이면 애니메이션 없이) | — |
| 4 | Route 탭이 Home hero 와 겹침: `M/navigation/tabs.tsx:91-96`, `M/screens/my-route/MyRouteScreen.tsx:66-73`. "Learning Route" 와 "Heritage Journey" 구분이 어려움 | **구현하지 않는다.** 탭 구조 변경은 사용성 테스트 뒤 오너 결정. 사양에 관찰만 기록 | — |
| 5 | 잠긴 카드 상세가 막다른 길: `M/screens/library/CardDetailView.tsx:308-320` "Finish the episode: X" 문구만. `:344` 부근 `Icon name="lock"`. Library 는 "silhouette, never a lock"(`LibraryScreen.tsx:497`) | "Open this lesson" 버튼. 자물쇠를 실루엣으로 통일 | 필요 |
| 6 | Results: `M/screens/results/ResultsScreen.tsx:498-568` Hoya·헤드라인·별·배너 5종 뒤 `:609-648` CTA. `:506` 0점에도 `StarRow stars={0}`. Home 은 빈 별 줄을 숨김(`HomeScreen.tsx:441`) | 주 CTA 를 `Screen` 의 `footer` 로 고정. 0점에서는 별 줄 대신 "Try it again?" | 필요 |
| 7 | Homework: `M/screens/homework/HomeworkScreen.tsx:91-102` "All clear!" 에 버튼 없음. `:152-162` "Recently done" 행에 `minHeight` 없고 하드코딩 `✓` 글리프. `:203, 230` "From class / From home" pill 이 `tone="nudge"`(miss 색) | Today 로 가는 버튼. `minHeight: touchTarget.min`, `Icon name="check"`. `tone="neutral"` | — |
| 8 | Restore 의 죽은 버튼: `M/screens/sync/RestoreScreen.tsx:177-178` 영구 disabled "Sign in" + "coming soon"(네이티브 로그인은 이미 있음) | 실제 로그인으로 연결하거나 버튼 제거. F-RESTORE, F-AUTH-004 확인 | — |
| 9 | 코드 입력: `JoinSpaceScreen.tsx:419-447`, `MoveClassScreen.tsx:165-195` 에 `returnKeyType`·`onSubmitEditing` 없음. 로그인 코드 6자리 자동 제출 없음(`SignInScreen.native.tsx:451`) | 키보드의 완료 키로 제출. 6자리에서 자동 제출 | — |
| 10 | Words 가 네이티브에서 꺼져 있는데(`M/config/flags.ts:318`) 주간 계획의 단어 링크로는 들어감: `M/screens/route/parts.tsx:177` | 조건을 `wordsOffered() && …` 로 | — |

**수용 기준.** 신규 프로필의 Home 에 0 이 보이지 않는다. Results 의 주 버튼이 스크롤 없이 보인다(**[실기기]** 작은 폰). 잠긴 카드에서 한 번 탭으로 해당 레슨에 간다.

**예상.** 사양·시안 1.5d, 구현 3.5d.

---

## WO-39 화면 구조: 제목 수준, 랜드마크, 문서 제목, 포커스

> 재확인 2026-11-21 (main `d5ba0217c`): 줄 이동 — `NavigationContainer` 는 `App.tsx:235` 에서 `:245` 로 옮겨졌고 `documentTitle` 은 여전히 없다. `Heading.tsx:40` 은 그대로. 참고: FN-2 (#1044) 의 정적 스플래시가 첫 페인트 전에 `<html lang>` 을 정하고, AU-17c (#1035) 가 탭 바의 role(`tablist` 안 `tab`, `aria-selected`)을 고쳤다. 둘 다 이 WO 의 행을 대신하지 않는다.

**목표.** 스크린리더와 키보드 사용자가 화면의 구조를 따라갈 수 있다(WCAG 1.3.1, 2.4.1, 2.4.2, 2.4.3, 2.4.6).

**근거.**
- 확인: `D/components/Heading/Heading.tsx:40` — level 과 무관하게 `accessibilityRole="header"`. 보고: react-native-web 은 `aria-level` 이 없으면 `h1` 을 낸다. `<Heading` 229곳 중 `aria-level` 18곳. `level="caption"` 도 제목으로 읽힌다.
- 보고: `apps/mobile/App.tsx:245` `NavigationContainer` 에 `documentTitle` 설정 없음 → 문서 제목이 내부 route 이름. `role="main"` 은 presenter 화면에만. 새 화면으로 포커스를 옮기는 곳은 22개 파일뿐.
- 웹 사이트·콘솔은 skip link, `<main>`, `:focus-visible` 링이 이미 있다(`W/…/AdultFrame.tsx:184`).

**사양.** `F-A11Y-001` 에 절 추가.

| 행 | 모델 | 내용 |
|---|---|---|
| SS-0 | Opus 5.5 | 사양: level → heading 수준 매핑 표, 화면별 제목 규칙 |
| SS-1 | Sonnet 5.5 | `Heading`: `display`/`title` → 1–2, `prompt` → 2–3, `body`/`caption` 은 header role 제거. 웹에 `aria-level` |
| SS-2 | Sonnet 5.5 | `documentTitle.formatter` 로 현지화된 화면 제목("Home · Hangul Route") |
| SS-3 | Opus 5.5 | `Screen` 에 `role="main"`, 화면 전환 시 `ScreenHeader` 의 제목으로 포커스를 옮기는 공통 훅(22개 파일의 개별 구현을 대체하지 말고 없는 화면에만 적용) |
| SS-4 | Sonnet 5.5 | 학습자 PWA 에 skip link |

**SS-1 주의.** `Heading` 을 본문 스타일 용도로 쓰는 곳이 많다. role 을 빼면 기존 테스트(약 397개의 role/label 단언 중 일부)가 깨질 수 있다. 깨지는 테스트는 "그 요소가 정말 제목인가" 를 보고 테스트를 고치거나 `level` 을 고친다. 화면당 `h1` 은 하나.

**테스트.** 대표 화면 6개에서 heading 수준 스냅샷(h1 하나, 건너뛰는 수준 없음). 문서 제목이 route 이름이 아님. 화면 전환 뒤 `document.activeElement` 가 제목.

**수용 기준.** WO-08 의 axe 스모크에서 heading-order, landmark-one-main, document-title, page-has-heading-one 위반이 0.

**예상.** 사양 0.5d, 구현 2.5d.

---

## WO-40 한글은 한국어 음성으로, 뜻은 UI 언어 음성으로

> 재확인 2026-11-21 (main `d5ba0217c`): 줄 이동 — `KoreanText.tsx` 의 레이블·언어 줄은 `:121-122, 138-139` 에서 `:135-136, 152-153` 으로(AU-8 (#1035) 의 `romanizationReserved` 추가), `a11y.koreanItem` 은 `a11y.ts:288-291` 에서 `:293-` 으로, Tap & Respond 버튼 레이블은 `TapRespondGame.tsx:176` 에서 `:183`, Culture Quiz 의 한글 Heading 은 `CultureQuizGame.tsx:118` 에서 `:123` 으로 옮겨졌다. 구조(한 덩어리 레이블에 `accessibilityLanguage="ko"`)는 바뀌지 않았다. AU-8 의 보류된 로마자는 접근성 트리 밖이고 접근성 이름은 그대로다.

**목표.** 스크린리더가 가르치는 한글을 한국어로, 로마자와 gloss 를 UI 언어로 읽는다(WCAG 3.1.2). 발음이 곧 학습 내용인 앱이라 우선순위가 높다.

**근거 (보고, 실제 발화는 추정).**
- `D/components/KoreanText/KoreanText.tsx:135-136, 152-153` — 접근성 레이블이 `a11y.koreanItem` 이 만든 "Korean: 사과, sagwa, apple" 한 덩어리(`packages/i18n/src/messages/en/a11y.ts:293-`)이고 여기에 `ko` 가 걸린다. KoreanText 62곳 중 약 23곳이 이 레이블을 넘긴다.
- iOS: `accessibilityLanguage="ko"` 가 레이블 전체에 적용돼 로마자와 영어 gloss 까지 한국어 음성으로 읽힐 것이다.
- 웹: 바깥 Pressable 에 `lang` 이 없고 `aria-label` 이 안쪽 `lang="ko"` Text(`:14`)를 덮는다. 페이지 언어 음성으로 한글이 읽히거나 빠진다.
- Android: `accessibilityLanguage` 는 iOS 전용.
- 같은 계열: `M/screens/minigames/TapRespondGame.tsx:183` 버튼 레이블 `ko · romanization · en`, `CultureQuizGame.tsx:123` `<Heading>{round.promptKo}</Heading>`, `HoyaBubble` 의 `korean` 줄, `VoiceEchoGame.tsx` 의 `{target}`.
- 기존 설계: 자모 레이블은 로마자 음가로 읽는다(`M/logic/korean-labels.ts`).

**사양.** `F-A11Y-001` 에 절 추가. **이 WO 는 실기기 조사가 먼저다.**

| 행 | 모델 | 내용 |
|---|---|---|
| LP-0 | 오너 + Opus 5.5 | **[실기기]** 현재 발화 기록: iOS VoiceOver, Android TalkBack, 웹(NVDA 또는 VoiceOver + Safari)에서 KoreanText 타일 하나, TapRespond 버튼 하나, 한글 Heading 하나가 어떻게 읽히는지. 결과를 사양에 표로 |
| LP-1 | Opus 5.5 | 사양: 플랫폼별 전략 |
| LP-2 | Opus 5.5 | `KoreanText` 구조 변경 |
| LP-3 | Sonnet 5.5 | `Heading`, `Button`, `HoyaBubble` 에 `lang` prop, 같은 계열 4곳 적용 |

**LP-0 에 더할 것 (axe, 2026-11-24).**
- Match Sound 낱자 타일의 보이는 글자 "ㄱ g/k" 와 접근성 이름 "Korean letter g or k, tap to select" 가 다르다(WCAG 2.5.3 `label-content-name-mismatch`, 4 노드). 낱자는 로마자 음가 레이블로 읽는다는 규칙과 부딪힌다. 음성 제어 사용자가 보이는 글자를 말할 수 있어야 하는지, 이름에 한글을 넣지 않는 규칙을 지킬지는 실기기 결과로 오너가 정한다. 근거: `apps/mobile/e2e/web/fixtures/axe-baseline.json` 의 `match-sound-round-1` · `label-content-name-mismatch` 항목(`expectedFix` `none`)과 `AMENDMENTS-A11Y-CI.md` "AC-1 as built".

**전략(권고, LP-0 결과로 확정).**
- 한 레이블로 뭉치지 않는다. 한글 Text(`lang="ko"` / `accessibilityLanguage="ko"`), 로마자, gloss 를 각각의 텍스트 노드로 두고, 누를 수 있는 부모는 웹에서 `aria-labelledby` 로 자식 id 들을 참조한다(각 자식의 `lang` 이 살아남는다).
- iOS: 부모를 `accessible` 한 그룹으로 두면 자식의 언어 속성이 무시될 수 있다. LP-0 에서 확인하고, 필요하면 한글 부분만 별도 접근성 요소로 둔다(스와이프 한 번이 늘어나는 비용과 비교).
- Android: 요소 단위 언어 지정이 없으므로 TalkBack 의 다국어 자동 감지에 맡긴다. 한글이 든 레이블에서 로마자를 한글 앞에 두지 않는다(자동 감지 방해).
- 낱자(ㄱ)는 지금처럼 로마자 음가 레이블을 유지한다: 한국어 TTS 가 낱자를 이름("기역")으로 읽기 때문.

**수용 기준.** **[실기기]** iOS VoiceOver 에서 "사과" 는 한국어 음성, "apple" 은 영어 음성으로 들린다. 웹 DOM 에서 한글이 든 모든 접근성 이름이 `lang="ko"` 요소에서 온다(테스트).

**하지 말 것.** LP-0 없이 구조를 바꾸지 않는다. 실기기 확인 없이 "고쳤다" 고 보고하지 않는다.

**예상.** 조사 0.5d(오너 시간 포함), 사양 0.5d, 구현 2d.

---

## WO-41 접근성 다듬기 일괄

> 재확인 2026-11-21 (main `d5ba0217c`): 일부 완료 — `AMENDMENTS-AUDIT-2026-11.md` AU-17 (#1035) 가 두 행을 끝냈다. **#9 완료:** 모든 progress bar 에 이름과 값 문장("2 of 6")이 있다(`packages/design-system/src/components/Progress/Progress.tsx:51-59`, `labels-context.ts`, `apps/mobile/src/components/ProgressLabelsHost.tsx`; warm-up 점은 장식). **#1 대부분 완료:** 앱의 텍스트 입력(`CreateProfileScreen.tsx:80-88` `fieldStyle`, `EditProfileScreen.tsx:320-321`, `JoinNameField.tsx:51-52`, `RestoreScreen.tsx:160-161`)과 idle Tile·ChoiceCard 테두리가 `border.shape` 이고 `contrast.test.ts` 가 그 쌍을 canvas·paper·sunken 위에서 고정한다. #1 에서 남은 것: 콘솔 `Field`(`W/components/console/ui.tsx:108`, 그대로 `border.strong`)와 VoiceEcho 빈 체크박스(`VoiceEchoGame.tsx:160`). **#3 일부:** ChoiceCard 의 상태가 테두리 색만으로 idle 과 갈리지 않는다는 테스트가 들어갔다. `feedback.info`, overlay, disabled 합성 쌍은 남았다. 탭 바의 선택 표시는 FN-8 (#1044) 이 색 외의 막대를 더했다(이 표에는 없던 항목). 줄 이동: #6 의 자동 재생은 `MatchSoundGame.tsx:102-104`, `TraceStrokeGame.tsx:167-171` 이고 QS-3 (#1038) 으로 첫 라운드만 350ms 기다린 뒤 재생한다. 스크린리더 확인은 여전히 없다(AU-10 의 Discover 자동 재생은 스크린리더가 켜져 있으면 건너뛴다 — 본보기). #7 의 탭 라벨은 `tabs.tsx:34-55`, #8 의 Tile 기본 레이블은 `Tile.tsx:111`.

**사양.** `F-A11Y-001` 에 절 추가. 사양 Opus 5.5(0.5d), 구현 Sonnet 5.5.

| # | 현재 (보고. 대비 수치는 리뷰가 토큰 값으로 계산) | 변경 | WCAG |
|---|---|---|---|
| 1 | 입력·체크박스 경계: RN TextInput `border.subtle` paper 위 1.32:1 — **앱 입력은 AU-17e (#1035) 로 완료**(`CreateProfileScreen.tsx:80-88`, `EditProfileScreen.tsx:320-321`, `sync/JoinNameField.tsx:51-52`). 남은 것: 콘솔 `Field` `1px border.strong` 1.95:1(`W/components/console/ui.tsx:108`), VoiceEcho 빈 체크박스 `border.strong`(`VoiceEchoGame.tsx:160`) | 입력·체크박스 경계를 `border.shape`(#857360, paper 위 4.55:1)로. 이 쌍을 `D/__tests__/contrast.test.ts` 계약에 추가 | 1.4.11 |
| 2 | `feedback.danger` 텍스트: canvas 위 4.38:1, sunken 위 3.91:1(`W/components/console/ui.tsx:76-78`) | 텍스트용 어두운 danger 토큰 추가, 계약 테스트. `design/tokens/` 와 함께 고친다(design-token-sync CI) | 1.4.3 |
| 3 | 대비 계약에 없는 쌍: `feedback.info` 텍스트, rgba overlay, disabled 의 opacity 0.6 합성, 상태 간 구분 대비 | 계약에 추가(`contrast.ts` 의 `compositeOver` 사용) | 1.4.3 |
| 4 | Decoding Sprint 60초 고정: `M/logic/syllable-build/sprint.ts:31` `SPRINT_MS = 60_000`. Speed Round 의 `clockScale`(1 / 1.5 / 2, 스크린리더 켜짐이면 2배)을 읽지 않음 | 프로필 `clockScale` 과 스크린리더 2배 적용 | 2.2.1 |
| 5 | Voice Echo: `VoiceEchoGame.tsx:132, 178` "I said it" 을 체크해야만 Continue, Skip 없음(현재 플래그로 꺼짐) | "Listen only" / Skip. WO-26 의 ST-3 보다 먼저 | 2.5.6 취지 |
| 6 | 자동 재생이 스크린리더 낭독과 겹침(추정): `isScreenReaderEnabled` 로 막는 곳은 placement 뿐. `MatchSoundGame.tsx:102-104`, `TraceStrokeGame.tsx:167-171` 는 라운드 시작 때 재생(QS-3 뒤로 첫 라운드만 350ms 대기, 스크린리더 확인 없음). 웹 감지는 항상 false(`M/platform/screen-reader.web.ts`) | placement 의 `announceAndWait` 패턴을 공통화. 웹은 감지가 안 되므로 "Play sounds by themselves" 설정(기본 켬)을 둔다 | 1.4.2 취지 |
| 7 | 고정 14px: `M/components/JourneyGrid.tsx:501, 559` `maxFontSizeMultiplier={1}`. `M/navigation/tabs.tsx:34-55` 네이티브 1.3배 상한, 웹 14px 고정. 앱 내 글자 크기는 최대 1.5배(`D/text-size.ts:25-30`) | 그리드 단어는 큰 글자 단계에서 줄바꿈하도록(시안 필요). 탭 라벨 상한 상향 | 1.4.4 |
| 8 | 영어 하드코딩: `D/components/Hoya/Hoya.tsx:111` 기본 레이블 "Hoya the tiger, {pose}", `HoyaBubble.tsx:69` 가 레이블 없이 Hoya 를 그림, `Tile.tsx:111` 기본 레이블 영어 | 버블 안 Hoya 는 장식 처리(세 플랫폼에서 숨김). design-system 기본 레이블을 없애고 호출자가 사전 문자열을 넘기게 | 3.1.2 |
| 9 | ~~`D/components/Progress/Progress.tsx:31, 62` `progressbar` 에 접근성 이름 없음~~ **완료(AU-17d, #1035). 집행 불필요** | — | 4.1.2 |
| 10 | Trace 피드백 문구가 1.1–2.0초 뒤 바뀜 | WO-02 의 TI-2 가 처리. 여기서는 중복 구현하지 않는다 | 2.2.1 취지 |

**1–3 주의.** 토큰 값을 바꾸면 `design/tokens/` 와 `packages/design-system` 이 함께 바뀌어야 CI(`design-token-sync.yml`)가 통과한다. `border.subtle` 자체를 어둡게 하지 않는다(장식 구분선에도 쓰인다). 입력 경계가 쓰는 토큰을 바꾼다.

**수용 기준.** `contrast.test.ts` 가 새 쌍을 포함해 통과한다. WO-08 의 기준선 파일에서 해당 위반이 사라진다.

**예상.** 3d.

---

## WO-42 실기기 점검 (오너가 하는 일)

**목표.** 코드 리뷰로는 확인하지 못한 것을 한 번 확인한다. 리뷰 전체가 코드 읽기였다.

| 행 | 담당 | 내용 |
|---|---|---|
| RD-1 | Sonnet 5.5 | 점검표 `docs/roadmap/review-2026-11/device-checklist.md` 작성: 이 계획의 **[실기기]** 항목을 모으고 기기·OS·절차·기대 결과를 한 줄씩 |
| RD-2 | 오너 | 점검 수행, 결과 기록 |
| RD-3 | Opus 5.5 | 결과로 드러난 새 문제를 WO 로 정리 |

**점검표에 들어갈 것(최소).**
- 스크린리더: iOS VoiceOver, Android TalkBack, 웹 한 가지. 첫 퀘스트 한 개를 끝까지. 결과 알림, 한글 발음, 포커스 이동.
- 작은 화면(iPhone SE 급, 320px 웹): Home 의 Start 버튼, Results 의 주 버튼이 스크롤 없이 보이는가. 키보드가 버튼을 가리는가.
- 글자 크기 최대, 브라우저 200% 확대: 잘리는 글자.
- es / ko UI: 넘치는 문자열.
- 소리: iOS 무음 스위치, 음악 재생 중, 헤드폰 분리, 백그라운드 전환.
- 저장 공간 부족 기기에서 퀘스트 완료(WO-01 이후).
- 가로 방향(WO-37 NB-8 이후).
- 오디오 클립 청취: 평음/격음/경음 묶음(WO-16).

**예상.** 점검표 0.25d, 점검은 오너 일정.
