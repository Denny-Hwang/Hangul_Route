# R8 — Translation Sync

영어 UI 사전(`packages/i18n/src/messages/en/`)에 번역이 없는 키, 또는 영어가 바뀐 뒤 다시 검토가 필요한 namespace 를 찾아 스페인어(`es`) / 한국어(`ko`) **초안** PR 을 만든다. 초안일 뿐이며, 원어민 검토(§3.10 step 3)와 공개(`LOCALE_STATUS` 를 `'shipped'` 로)는 사람이 한다.

명세: `docs/specs/F-I18N-001-ui-locales.md` §3.10 (이 루틴은 F-I18N-001 PR 13 에서 활성화). 블루프린트: `docs/blueprints/08-claude-code-routines.md` R8.

## Trigger
- Manual: "Run now" / `workflow_dispatch` — 입력 `locale` (`es` | `ko`), `namespace` (선택; 없으면 missing 이 가장 많은 namespace 하나).
- PR merged to `main` that changes `packages/i18n/src/messages/en/**` — `node scripts/i18n-status.mjs` 가 missing 또는 stale 을 보고한 locale 마다 1회.
- 동시에 열린 R8 PR 은 locale x namespace 당 하나. 같은 브랜치가 이미 열려 있으면 그 PR 에 커밋을 추가한다.

## Input
- `node scripts/i18n-status.mjs --list` — locale / namespace 별 missing 키 경로, review 상태 (current / stale / not reviewed), `LOCALE_STATUS`.
- `packages/i18n/src/messages/en/<namespace>.ts` — 원문 (source of truth). 함수 메시지는 인자 목록 그대로.
- `packages/i18n/src/messages/<locale>/` — 기존 번역.
- `packages/i18n/src/messages/review-ledger.json` — 원어민 검토 기록 (읽기 전용; 이 루틴은 쓰지 않는다).
- `packages/i18n/src/banned-words.json` — locale x surface 금지어.
- 콘텐츠 overlay 를 초안할 때: `content/i18n/README.md`, `scripts/overlay-fields.mjs` (허용 필드).

## Steps
1. `node scripts/i18n-status.mjs --list` 로 대상 locale / namespace 와 missing 경로를 고른다. stale namespace 는 English 가 바뀐 키만 다시 초안한다 (`git log -p` 로 ledger 의 `reviewedAt` 이후 바뀐 키 확인).
2. 브랜치 `claude/i18n-<locale>-<namespace>` 를 `origin/main` 에서 만든다.
3. `packages/i18n/src/messages/<locale>/<namespace>.ts` 에 초안을 쓴다: `export const <namespace> = { ... } satisfies DeepPartial<Messages['<namespace>']>;` 를 `messages/<locale>/index.ts` 에 연결. 영어에 없는 키는 쓰지 않는다 (`satisfies` 가 막는다). 함수 메시지는 영어와 같은 인자, 문장 전체를 그 locale 의 어순으로 (`plural(locale, n, ...)` 은 자기 locale 로).
4. 아래 **Style guide** 를 그대로 따른다 (이 루틴의 프롬프트).
5. 건드리지 않는 것: `messages/en/**` (원문), `landing.legal.privacy.*` / `landing.legal.terms.*` (영어가 정본, 결정 L10 — overlay 가 쓰면 테스트가 실패), `LOCALE_STATUS`, `review-ledger.json`, `HANGUL_ROUTE_STRICT_LOCALES`. 가르치는 한국어(자모·단어·문장)는 메시지에 넣지 않는다 — `KoreanText` 가 콘텐츠에서 그린다 (결정 L5).
6. 로컬 검증: `pnpm --filter @hangul-route/i18n test` (구조, Hangul 규칙, 금지어, 길이 예산), `pnpm --filter @hangul-route/i18n typecheck`, `node scripts/check-i18n.mjs`, `node scripts/i18n-status.mjs` (missing 수가 줄었는지). 콘텐츠 overlay 면 `node scripts/validate-content.mjs` 와 `node scripts/build-overlays.mjs --check`.
7. PR 을 연다: 제목 `content(i18n): <locale> <namespace> draft (R8)`, 라벨 `routine-generated` (R3 가 리뷰). 본문에 번역한 키 수, 남은 missing 수, 길이 예산을 넘긴 키 (있으면), 원어민 검토자가 볼 곳 (어조, 반-수치심, 길이, 변수에 조사 없음).

### Style guide (prompt)

```
You are drafting UI strings for Hangul Route, an app for anyone learning Hangul from zero, at any age.
Translate from the English source; never change the English.

- Plain and short. English is CEFR Pre-A1; Spanish and Korean target the same simplicity, so a young
  reader and an adult beginner both read it. Never name an age range or say the app is for kids.
- Spanish: neutral international Spanish, informal "tú" everywhere (no "usted", no voseo, no regional
  slang). Avoid adjectives that must agree with the learner's gender ("¡Bienvenido/a!" -> "¡Hola!").
  Numbers and dates come from the formatters, never typed into a string.
- Korean: 해요체 on all app surfaces (learner, grown-up, console); 합니다체 only on legal and pricing
  text. Never attach a particle (은/는, 이/가, 을/를) to a variable: the right form depends on a final
  consonant the code cannot know. Write around it ("학생: {name}", "{name}님", or a colon form).
  Hoya is "호야" only in Korean; the app name stays "Hangul Route".
- Hoya speaks in short warm sentences in every locale: warmth yes, nursery tone no.
- All locales: a sentence is one message (whole sentences, no concatenation); a function message keeps
  the English parameters and owns its word order; no emoji; the anti-shame rules hold (no failure
  nouns, nothing from banned-words.json for the surface; a wrong answer is a gentle nudge).
- Taught Korean never goes inside a message; it is rendered from content with romanization and a gloss.
- The app teaches reading, listening and writing; do not add speaking prompts or wording that measures
  speech.
```

## Output
- PR: `claude/i18n-<locale>-<namespace>` -> `main`, 라벨 `routine-generated`.
- 파일: `packages/i18n/src/messages/<locale>/<namespace>.ts` (+ `index.ts` 연결), 또는 `content/i18n/<locale>/<domain>.json` (+ `node scripts/build-overlays.mjs` 로 재생성한 `i18n-overlays.generated.ts`).
- 원어민 검토자는 PR 리뷰 후 같은 PR 에 `review-ledger.json` 항목을 추가한다: `{ "<locale>": { "<namespace>": { "enSha": "<sha256 of messages/en/<namespace>.ts>", "reviewedBy": "<initials>", "reviewedAt": "YYYY-MM-DD" } } }` (namespace 파일 단위). 이 루틴은 그 항목을 만들지 않는다.

## Failure modes
- missing 0, stale 0 → PR 없이 종료 ("nothing to sync").
- 테스트 실패 (Hangul 이 `es` 에, 금지어, 길이 예산, 영어 정본 legal 경로) → 해당 키를 고쳐 1회 재시도; 그래도 실패하면 PR 을 draft 로 열고 실패한 키 목록과 함께 `blocked` 라벨.
- 영어 원문이 모호해서 번역이 갈리는 키 → 추측하지 않고 PR 본문에 질문으로 남긴다 (키는 영어 fallback 그대로).
- `LOCALE_STATUS` 가 `'shipped'` 인 locale 의 stale namespace → 초안 PR 에 `needs-native-review` 메모; ledger 는 검토자가 갱신할 때까지 stale 경고로 남는다 (CI 는 경고만).
