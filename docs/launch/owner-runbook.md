# 오너 런북 — 대시보드만으로 배포하기 (2026-10-07)

> 이 문서가 오너 작업의 **유일한 순서표**다. 로컬에서 `wrangler`(login · deploy · d1 · secret)를 실행하지 않는다 — 회사 프록시가 Cloudflare API 를 막고, 그럴 필요도 없다. 모든 배포는 **Cloudflare Workers Builds (GitHub 연동)** 와 **대시보드**로만 한다.
> 저장소 변경(wrangler.toml 등)은 전부 **PR → required checks 통과 → 머지 → 자동 재배포** 순서다. Step 1 이후에는 main 에 직접 push 할 수 없다.
> 각 Step 끝의 **확인** 이 통과되면 다음으로 넘어간다. 막히면 Step 번호와 화면·로그를 보낸다.

## 0. 공통 — 대시보드에 입력할 값

Workers & Pages → **Create** → Workers 탭 → **Import a repository** → `Denny-Hwang/Hangul_Route`. 프로젝트 3개를 같은 저장소에서 만든다.

| | `hangul-route-app` (학습자 PWA) | `hangul-route-api` (API) | `hangul-route-web` (랜딩 + 교사 콘솔) |
|---|---|---|---|
| Production branch | `main` | `main` | `main` |
| Root directory | `/` | `/` | `/` |
| Build command | `pnpm install --frozen-lockfile && pnpm --filter @hangul-route/mobile build:web` | `pnpm install --frozen-lockfile` | `pnpm install --frozen-lockfile && pnpm --filter @hangul-route/web build` |
| Deploy command | `pnpm --filter @hangul-route/mobile exec wrangler deploy` | `pnpm --filter @hangul-route/api exec wrangler d1 migrations apply hangul-route --remote && pnpm --filter @hangul-route/api exec wrangler deploy` | `pnpm --filter @hangul-route/web exec wrangler deploy` |
| Build variables (빌드 시 코드에 박힘) | `NODE_VERSION` = `22` · `EXPO_PUBLIC_API_BASE_URL` = API 주소 (Step 3 후) · (선택) `EXPO_PUBLIC_CONSOLE_URL` | `NODE_VERSION` = `22` | `NODE_VERSION` = `22` · `NEXT_PUBLIC_API_BASE_URL` = API 주소 · `NEXT_PUBLIC_CONSOLE_DEV_AUTH` = `true` (Clerk 전까지만) · `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Step 7 후) |
| Runtime: Variables (Type: Text) | 없음 | `ALLOWED_ORIGINS` · `STRIPE_PRICE_FAMILY_LIFETIME` · `STRIPE_PRICE_GROUP_LICENSE_YEARLY` · `CONSOLE_URL` · (법률 검토 후) `SCHOOL_CONSENT_MODE` | 없음 |
| Runtime: Secrets (Type: Secret) | 없음 | `CLERK_SECRET_KEY` · `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` | 없음 |
| Custom domain | `app.hangulroute.com` | (workers.dev 주소 사용) | `hangulroute.com` · `www.hangulroute.com` |

- **Build variables** 는 프로젝트 → Settings → **Build** → Variables and Secrets. `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` 는 빌드 때 번들에 박히므로 값을 바꾸면 **Retry deployment** (또는 다음 머지) 로 다시 빌드해야 반영된다.
- **Runtime Variables / Secrets** 는 프로젝트 → Settings → **Variables and Secrets** (런타임). API Worker 의 `wrangler.toml` 이 `keep_vars = true` 라서 재배포해도 대시보드 변수가 지워지지 않고, Secret 은 원래 지워지지 않는다. 바인딩(D1 등) 만은 toml 이 원본이라 PR 로 바꾼다.
- **API 의 Deploy command 는 두 단계**: 먼저 `apps/api/migrations/*.sql` 을 D1 `hangul-route` 에 적용(`--remote`; D1 이 적용된 파일을 `d1_migrations` 표에 기록하므로 재배포 때는 no-op, 비대화형 환경이라 확인 프롬프트 없음), 그 다음 Worker 업로드. 마이그레이션이 실패하면 업로드도 멈추고 로그에 남는다. 한 줄로 붙여 넣는다.
- Node: 저장소의 `.nvmrc` 가 22 다. Workers Builds 빌드 이미지는 `.nvmrc` 를 읽지만, 로그에서 다른 버전이 보이면 위 표의 `NODE_VERSION=22` 빌드 변수가 확실한 방법이다 (처음부터 넣어 두길 권장). pnpm 은 `package.json` 의 `packageManager` 로 10.33.0 이 자동 선택된다.

## A. 배포 (Step 1–6)

### Step 1. GitHub main 보호 (10분)
https://github.com/Denny-Hwang/Hangul_Route/settings/branches → Add rule (또는 ruleset), 패턴 `main`
- Require a pull request before merging
- Require status checks to pass → 검색해서 3개 추가: `lint · typecheck · test · build` · `Build PWA · offline e2e` · `Measure coverage vs rolling targets`
- Do not allow bypassing → Save

이후로는 모든 저장소 변경이 PR 과 위 3개 체크를 통과해야 main 에 들어가고, Workers Builds 는 main 만 배포한다.
**확인**: 규칙 목록에 `main` 이 보인다.

### Step 2. 학습자 앱 Worker `hangul-route-app` (20분)
§0 표의 첫 열대로 Import a repository. Build variables 에 지금은 `NODE_VERSION=22` 만. **Save and Deploy**.
**확인**: `https://hangul-route-app.<계정>.workers.dev` 에서 온보딩 화면이 뜬다.

### Step 3. API Worker `hangul-route-api` (20분)
D1 `hangul-route` 는 2026-10-07 에 대시보드에서 만들었고 (Database ID `4d338c01-0a0d-46c5-b7f4-16936cf32907`, 위치 자동 / WNAM), `apps/api/wrangler.toml` 에 바인딩되어 있다. 스키마는 `apps/api/migrations/` 의 파일이고 Deploy command 가 매 배포 때 적용한다 — 오너가 따로 할 일은 없다.
1. §0 표의 둘째 열대로 Import a repository. Build command 는 `pnpm install --frozen-lockfile` 뿐 (wrangler 가 배포 때 번들). Deploy command 는 §0 의 **두 단계 한 줄**. Build variable `NODE_VERSION=22`. **Save and Deploy**.
2. 첫 배포 로그에서 `0001_schema_v1.sql` · `0002_schema_v2.sql` 이 ✅ 로 적용된 뒤 Worker 가 업로드되는지 본다. 마이그레이션 단계가 권한 오류로 실패하면 로그를 보낸다 (Workers Builds 토큰에 D1 쓰기 권한이 없는 경우 — 그때는 대시보드 D1 콘솔에서 두 파일을 순서대로 실행하고 Deploy command 를 `wrangler deploy` 만으로 줄인다).
3. 프로젝트 홈의 `https://hangul-route-api.<계정>.workers.dev` 가 **API 주소**다. 메모.
4. Settings → Variables and Secrets (런타임) 는 아직 비워 둔다 (Step 6·7·8 에서 채운다).

(F-INFRA-003 이 끝나기 전까지 API 는 인메모리 store 를 쓰므로 재배포마다 데이터가 초기화된다. D1 에는 빈 표만 있다.)

**확인**: 브라우저에서 API 주소를 열면 JSON 응답이 보이고, 대시보드 D1 → `hangul-route` → Tables 에 `learners` · `spaces` · `entitlements` 등이 보인다.

### Step 4. 랜딩 + 교사 콘솔 Worker `hangul-route-web` (15분)
§0 표의 셋째 열대로 Import a repository. Build variables: `NODE_VERSION=22` · `NEXT_PUBLIC_API_BASE_URL` = Step 3 의 API 주소 · `NEXT_PUBLIC_CONSOLE_DEV_AUTH=true`. **Save and Deploy**.
**확인**: `https://hangul-route-web.<계정>.workers.dev` 에서 랜딩이 뜨고, `/teach` 에서 dev 로그인 화면이 뜬다.

### Step 5. 앱과 API 연결 (10분)
`hangul-route-app` → Settings → Build → Variables and Secrets → `EXPO_PUBLIC_API_BASE_URL` = Step 3 의 API 주소 → **Retry deployment**. (선택) `EXPO_PUBLIC_CONSOLE_URL` = 콘솔 주소 — 기본값은 hangulroute.com 이라 도메인 연결 전에는 workers.dev 주소를 넣으면 페이월 버튼이 바로 열린다.
**확인 1**: 앱에서 프로필 생성 → 설정 → Backup 카드에 Rescue Code (단어-단어-숫자) 가 생긴다.
**확인 2**: 콘솔 `/teach` → 교사로 로그인 → 학급 생성 → 6자리 코드 → 앱 설정 *Classes & family* 에 입력 → 콘솔 roster 에 학생이 보인다.

### Step 6. 도메인 (10분)
`hangulroute.com` 은 Cloudflare Registrar 로 구매해 이미 Cloudflare DNS 에 있다 (2026-10-07). 네임서버 변경·전파 대기는 없다. Custom domain 을 붙이면 DNS 레코드와 인증서가 자동으로 만들어진다 (보통 몇 분).
1. `hangul-route-app` → Settings → Domains & Routes → Add → Custom domain `app.hangulroute.com`
2. `hangul-route-web` → 같은 메뉴 → `hangulroute.com`, 그리고 한 번 더 `www.hangulroute.com`
3. `hangul-route-api` → Settings → Variables and Secrets → Add → Type **Text** → `ALLOWED_ORIGINS` = `https://hangulroute.com,https://www.hangulroute.com,https://app.hangulroute.com` → Deploy. (비워 두면 같은 기본값 + localhost + `*.workers.dev` 가 허용되므로 도메인 전엔 생략해도 된다.)

**확인**: https://app.hangulroute.com 과 https://hangulroute.com/teach 가 열린다 (DNS 탭에 Worker 가 만든 레코드가 보인다). Step 5 의 `EXPO_PUBLIC_CONSOLE_URL` 은 지워도 된다 (지우면 Retry deployment).

## B. 외부 키 (Step 7–9)

### Step 7. Clerk (20분)
https://dashboard.clerk.com → Create application → 이름 `Hangul Route`, 로그인 Email + Google → 생성 → API Keys
- Secret key (`sk_…`) → `hangul-route-api` → Settings → Variables and Secrets → Add → Type **Secret** → 이름 `CLERK_SECRET_KEY` → Deploy
- Publishable key (`pk_…`) → `hangul-route-web` → Settings → Build → Variables → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Retry deployment 는 F-AUTH-002 머지 후에 해도 된다)
- 끝나면 저에게 알린다 → F-AUTH-002 (진짜 로그인 위젯) 착수, 머지 후 `NEXT_PUBLIC_CONSOLE_DEV_AUTH` 를 지운다.

**확인**: 두 값이 저장되어 있다 (화면 변화는 F-AUTH-002 이후).

### Step 8. Stripe (40분, Test mode 먼저)
https://dashboard.stripe.com → Test mode
1. Product catalog → 상품 2개 / 가격 2개
   - `Family Lifetime` → Price **$15.30, One-off** → price id 복사
   - `Group License` → Price **$153, Recurring, Yearly** → price id 복사
2. `hangul-route-api` → Settings → Variables and Secrets → Type **Text** 로 `STRIPE_PRICE_FAMILY_LIFETIME`, `STRIPE_PRICE_GROUP_LICENSE_YEARLY`, `CONSOLE_URL` = `https://hangulroute.com` (도메인 전엔 `hangul-route-web` 의 workers.dev 주소)
3. Developers → API keys → Secret key → 같은 화면에 Type **Secret** 으로 `STRIPE_SECRET_KEY`
4. Developers → Webhooks → Add endpoint → URL `https://hangul-route-api.<계정>.workers.dev/api/entitlements/stripe/webhook` → 이벤트 4개: `checkout.session.completed` · `customer.subscription.created` · `customer.subscription.updated` · `customer.subscription.deleted` → 생성 후 Signing secret (`whsec_…`) → Type **Secret** 으로 `STRIPE_WEBHOOK_SECRET` → Deploy

**확인**: 콘솔 `/teach/billing` → Family Lifetime **Choose** → 테스트 카드 `4242 4242 4242 4242` → 돌아오면 "active · yours for good" 카드가 보인다. 실결제는 Live mode 에서 1–4 를 한 번 더 (키·price id 가 모두 다르다).

### Step 9. 프로모·레퍼럴 코드 (15분, 배포 불필요)
Stripe → Product catalog → **Coupons** → New: 퍼센트 또는 정액 · Duration (`once` = Lifetime 결제와 라이선스 첫 해만, `forever` = 매년 갱신까지) · 선택: 총 사용 횟수, 만료 → 그 쿠폰에서 **Add promotion code** → 고객이 입력할 문자열 (런치용 `HOYA20`, 추천 교사별 `MSPARK`) · 코드별 최대 사용 / 만료 / 첫 구매만 / 최소 금액. 끄기 = inactive.
**확인**: 콘솔 billing 에 코드 입력 → Apply → 행의 가격이 "$12.24 once with HOYA20 (20% off), was $15.30 once" 로 바뀐다.

## C. 검증과 콘텐츠 (Step 10–12)

### Step 10. 설치 + 오프라인 실기기 (30분)
- iPhone Safari: app.hangulroute.com → 공유 → 홈 화면에 추가 → 아이콘으로 실행 → 주소창 없는 전체화면
- Android Chrome: 설치 배너 또는 메뉴 → 앱 설치 · 데스크톱 Chrome: 주소창 설치 아이콘
- 오프라인: 설치한 앱으로 퀘스트 1개 완주 → 비행기 모드 → 앱 완전 종료 후 재실행 → 프로필·카드가 남아 있고 다음 퀘스트도 된다

### Step 11. Lighthouse (15분)
데스크톱 Chrome → app.hangulroute.com → F12 → Lighthouse → Mobile → Performance + Best practices/PWA → Analyze. 설치 가능 항목 전부 녹색, Performance 80 이상. 빨간 항목은 캡처해서 저에게.

### Step 12. 자모 MP3 30개 녹음 (1일, 틈날 때)
자음 14 + 모음 10 + 받침 6. 조용한 방, 스마트폰 음성메모면 충분. 글자당 파일 하나, 앞뒤 0.3초 여백, 두 번 녹음해 좋은 것 선택. 파일명은 글자 그대로 (`ㄱ.mp3`, `ㅏ.mp3`) 로 폴더에 모아 전달 → 변환·노멀라이즈·프리캐시 등록은 저장소 쪽에서 처리.

## 나중에 (법률 검토 후)
학교 동의 모드 (c) 를 열 때만: `hangul-route-api` 런타임 변수 `SCHOOL_CONSENT_MODE=enabled` + `hangul-route-web` 빌드 변수 `NEXT_PUBLIC_SCHOOL_CONSENT_MODE=enabled` (Retry deployment). 그 전엔 콘솔에서 선택 불가로 잠겨 있다.

## 보내줄 것 ↔ 시작되는 PR

| 오너가 보내는 것 | 저장소 쪽 다음 PR |
|---|---|
| Step 3 첫 배포 로그 (마이그레이션 ✅ 또는 오류) | F-INFRA-003 (인메모리 → D1, 데이터 초기화 해결) 착수 |
| Step 7 완료 알림 | F-AUTH-002 Clerk 로그인 위젯 + dev 로그인 제거 |
| Step 11 빨간 항목 캡처 | 성능 수정 |
| Step 12 녹음 파일 | 오프라인 발음 인제스트 |

## 문제가 생기면
- 빌드 실패: 프로젝트 → Deployments → 실패한 빌드 → 로그 **마지막 30줄**을 보낸다.
- Node 버전이 22 가 아니라고 로그에 나오면: Build variables 에 `NODE_VERSION=22` 가 있는지 확인.
- "Ignored build scripts" 경고: 정상이다 (`pnpm-workspace.yaml` 의 `neverBuiltDependencies` 가 의도한 정책). 빌드·배포에 필요한 스크립트는 없다.
- wrangler "outdated" 경고 (API Worker 는 wrangler 3.114): 배포에 영향 없는 안내 문구다. 업그레이드는 별도 PR 로 한다.
