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
| Build variables (빌드 시 코드에 박힘) | `NODE_VERSION` = `22` · `EXPO_PUBLIC_API_BASE_URL` = API 주소 (Step 3 후) · (선택) `EXPO_PUBLIC_CONSOLE_URL` (F-BILL-002 가 더 읽지 않으면 삭제, §E S-3) · `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (§E S-1, 앱 호스트의 어른 페이지) · `EXPO_PUBLIC_SITE_URL` · `EXPO_PUBLIC_GROWN_UP_HOME` (§E S-3) | `NODE_VERSION` = `22` | `NODE_VERSION` = `22` · `NEXT_PUBLIC_API_BASE_URL` = API 주소 · `NEXT_PUBLIC_CONSOLE_DEV_AUTH` = `true` (Step 7 전까지만, 그때 삭제) · `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Step 7) |
| Runtime: Variables (Type: Text) | 없음 | `ALLOWED_ORIGINS` · `STRIPE_PRICE_FAMILY_YEARLY` · `STRIPE_PRICE_GROUP_LICENSE_YEARLY` · `CONSOLE_URL` · (법률 검토 후) `SCHOOL_CONSENT_MODE` | 없음 |
| Runtime: Secrets (Type: Secret) | 없음 | `CLERK_SECRET_KEY` · `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · (권장, 한 번만) `RESCUE_PEPPER` | 없음 |
| Custom domain | `app.hangulroute.com` | (workers.dev 주소 사용) | `hangulroute.com` · `www.hangulroute.com` |

> **F-APP-001 (2026-10-11)**: `hangul-route-app` 이 학습자 앱과 함께 **어른 페이지 (콘솔)** 도 `app.hangulroute.com` 의 `/signin` · `/start` · `/teach` · `/parent` · `/account` 에서 서빙한다 (빌드 명령은 그대로; A-3 부터 같은 빌드가 콘솔도 만든다). hangulroute.com 은 소개·가이드 전용이 되고 (F-SITE-002 S-10), 결제는 앱 호스트 `/account/billing` 에서만 한다 (F-BILL-002 B-10). 오너 작업은 §E 의 S-1 → S-2 → S-0 → S-3 순서.

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
   이후 PR 이 마이그레이션을 추가하면 다음 배포 로그에 새 파일 이름이 ✅ 로 이어진다 (예: audit SEC-4 의 `0003_device_scope.sql` — `learner_devices` 에 컬럼 하나를 더하고, 기존 행은 모두 `full` 로 그대로 둔다. 실패하면 업로드는 멈추고 이전 Worker 가 계속 돈다).
3. 프로젝트 홈의 `https://hangul-route-api.<계정>.workers.dev` 가 **API 주소**다. 메모.
4. Settings → Variables and Secrets (런타임) 는 아직 비워 둔다 (Step 6·7·8 에서 채운다).

(F-INFRA-003 머지 후 API 는 이 D1 에 읽고 쓴다 — 재배포해도 데이터가 남는다.)

**확인**: 브라우저에서 API 주소를 열면 JSON 응답이 보이고, 대시보드 D1 → `hangul-route` → Tables 에 `learners` · `spaces` · `entitlements` 등이 보인다.

### Step 4. 랜딩 + 교사 콘솔 Worker `hangul-route-web` (15분)
§0 표의 셋째 열대로 Import a repository. Build variables: `NODE_VERSION=22` · `NEXT_PUBLIC_API_BASE_URL` = Step 3 의 API 주소 · `NEXT_PUBLIC_CONSOLE_DEV_AUTH=true`. **Save and Deploy**.
**확인**: `https://hangul-route-web.<계정>.workers.dev` 에서 랜딩이 뜨고, `/teach` 에서 dev 로그인 화면이 뜬다.

### Step 5. 앱과 API 연결 (10분)
`hangul-route-app` → Settings → Build → Variables and Secrets → `EXPO_PUBLIC_API_BASE_URL` = Step 3 의 API 주소 → **Retry deployment**. (선택) `EXPO_PUBLIC_CONSOLE_URL` = 콘솔 주소 — 기본값은 hangulroute.com 이라 도메인 연결 전에는 workers.dev 주소를 넣으면 페이월 버튼이 바로 열린다. 이 값은 반드시 `https://` 주소여야 한다: F-BILL-002 B-9 이후 Plan 화면의 Open billing 은 https 만 연다 (`http://localhost:3000` 같은 주소는 열지 않고 "브라우저에서 여세요" 줄에 주소만 보여 준다).
**확인 1**: 앱에서 프로필 생성 → 설정 → Backup 카드 → Save my progress 에 Rescue Code (단어 4개 + 숫자 6자리, 예: `TIGER-MOON-RIVER-APPLE-482139`) 가 생긴다.
**확인 2**: 콘솔 `/teach` → 교사로 로그인 → 학급 생성 → 6자리 코드 → 앱 설정 *Classes & family* 에 입력 → 콘솔 roster 에 학생이 보인다.
- 참고 (audit SEC-2, 2026-10-09): 배포된 API 는 fail closed 라서, `CLERK_SECRET_KEY` 가 등록되기 전(Step 7)에는 콘솔 dev 로그인 뒤의 API 호출이 503 `auth_not_configured` 로 막힌다. 새로 배포하는 경우 확인 2 는 Step 7 뒤에 한다 (확인 1 의 학습자 기기 경로는 D1 만 있으면 된다).

### Step 6. 도메인 (10분)
`hangulroute.com` 은 Cloudflare Registrar 로 구매해 이미 Cloudflare DNS 에 있다 (2026-10-07). 네임서버 변경·전파 대기는 없다. Custom domain 을 붙이면 DNS 레코드와 인증서가 자동으로 만들어진다 (보통 몇 분).
1. `hangul-route-app` → Settings → Domains & Routes → Add → Custom domain `app.hangulroute.com`
2. `hangul-route-web` → 같은 메뉴 → `hangulroute.com`, 그리고 한 번 더 `www.hangulroute.com`
3. `hangul-route-api` → Settings → Variables and Secrets → Add → Type **Text** → `ALLOWED_ORIGINS` = `https://hangulroute.com,https://www.hangulroute.com,https://app.hangulroute.com` → Deploy. (비워 두면 같은 기본값 + localhost + `*.workers.dev` 가 허용되므로 도메인 전엔 생략해도 된다.) 이 목록은 Clerk 로그인 토큰의 `authorizedParties` 이기도 하다 (F-APP-001 A-9): 여기서 빠진 사이트에서 발급된 로그인 토큰은 API 가 401 로 거절하므로, 세 주소 중 하나라도 빼면 그 사이트의 콘솔 로그인이 API 에서 막힌다. 프로덕션 (`ENVIRONMENT` 미설정) 에서는 비워 두어도 토큰에는 localhost · `*.workers.dev` 가 허용되지 않는다.

**확인**: https://app.hangulroute.com 과 https://hangulroute.com/teach 가 열린다 (DNS 탭에 Worker 가 만든 레코드가 보인다). Step 5 의 `EXPO_PUBLIC_CONSOLE_URL` 은 지워도 된다 (지우면 Retry deployment).
- F-APP-001 이후 (§E S-1 뒤): 콘솔 주소는 **https://app.hangulroute.com/signin** 이다. 확인은 https://app.hangulroute.com/signin 이 로그인 위젯을 보여 주는지로 한다. hangulroute.com/teach 는 F-SITE-002 S-10 전까지 그대로 열리고, 그 뒤에는 앱 호스트의 같은 경로로 리다이렉트된다. 학습자 앱의 개인정보 링크 등 사이트 주소는 `EXPO_PUBLIC_SITE_URL` (기본 `https://hangulroute.com`) 이 `EXPO_PUBLIC_CONSOLE_URL` 을 대신한다.

## B. 외부 키 (Step 7–9)

### Step 7. Clerk 키 등록 (10분)
Clerk 애플리케이션은 2026-10-07 에 만들었다 (Development 인스턴스, Consumer, Email + Google). 콘솔 코드는 Clerk 위젯을 쓴다 (F-AUTH-002, 머지됨). 키는 **대시보드에만** 넣는다 — 저장소에는 없다.
- Clerk → API Keys → **Secret key** (`sk_test_…`) → `hangul-route-api` → Settings → Variables and Secrets → Add → Type **Secret** → 이름 `CLERK_SECRET_KEY` → Deploy. 이 순간부터 API 는 bearer 를 진짜 세션 JWT 로만 받는다 (dev 로그인 토큰은 거부됨). 키가 없으면 로그인이 필요한 API 는 503 `auth_not_configured` 로 닫힌다 (fail closed — `ENVIRONMENT` 변수는 프로덕션에서 설정하지 않는다).
- Clerk → API Keys → **Publishable key** (`pk_test_…`) → `hangul-route-web` → Settings → Build → Variables → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → 같은 화면에서 `NEXT_PUBLIC_CONSOLE_DEV_AUTH` 는 **삭제** → **Retry deployment**.
- 두 키는 같은 Clerk 인스턴스의 것이어야 한다 (둘 다 `_test_` 또는 둘 다 `_live_`). 나중에 Production 인스턴스로 바꾸면 키 두 개가 모두 바뀌고 Clerk 쪽에 `hangulroute.com` 도메인을 등록해야 한다; 코드 변경은 없다.

**확인**: 콘솔 `/teach` 에 Clerk 로그인 위젯(이메일·Google)이 뜨고, 로그인하면 `/teach/home` 으로 간다. 학급을 하나 만들어 roster 가 열리면 API 쪽 검증까지 통과. API 주소의 `/health` 가 `"status":"ok"` 와 `"bindings":{"db":true,"clerk":true,…}` 를 돌려주면 바인딩도 정상 (값은 노출되지 않고 true/false 만).

### Step 8. Stripe (40분, Test mode 먼저)
> **2026-10-11 변경**: Family 상품은 더 이상 일회 결제(평생)가 아니다. **Family Plan — $15.30 / 년, 매년 자동 갱신, 언제든 해지** (Group License 와 같은 연간 구독 방식). 근거와 동작은 `docs/specs/AMENDMENTS-BILLING-FAMILY-YEARLY.md`. Stripe 는 계속 **Test mode (샌드박스)** 만 쓴다. Live 는 오너가 켜라고 할 때까지 하지 않는다.

https://dashboard.stripe.com → **Test mode**

1. **Family Plan 연간 가격 만들기** — Product catalog → 가족용 상품 (이전 이름 `Family Lifetime`) 을 열어 이름을 **Family Plan** 으로 바꾼다 (없으면 새 상품 **Family Plan**) → **Add another price** → Pricing model *Flat rate* · **Recurring** · Billing period **Yearly** · Amount **15.30** · Currency **USD** → Save → price id (`price_…`) 복사.
2. **예전 일회 가격 보관(Archive)** — 같은 상품의 **$15.30 One-off** 가격 → **Archive price**. (지난 결제 기록은 그대로 남고 새 결제에는 쓰이지 않는다.)
3. **Group License** — 이미 있으면 그대로 둔다: Price **$153, Recurring, Yearly**. 없으면 같은 방법으로 만들고 price id 복사.
4. **Worker 변수** — Cloudflare → `hangul-route-api` → Settings → Variables and Secrets → Type **Text** 로
   - **`STRIPE_PRICE_FAMILY_YEARLY`** = 1번의 price id (**새 변수**)
   - `STRIPE_PRICE_GROUP_LICENSE_YEARLY` = 3번의 price id (기존)
   - `CONSOLE_URL` = `https://hangulroute.com` (기존; F-APP-001 S-4 때 `https://app.hangulroute.com`)
   - **`STRIPE_PRICE_FAMILY_LIFETIME` 은 삭제** (코드가 더 이상 읽지 않는다. 남겨 둬도 무해)
   → Deploy.
   - **순서**: `STRIPE_PRICE_FAMILY_YEARLY` 는 BY-1 머지가 API Worker 와 웹 콘솔을 **둘 다** 배포한 뒤에 넣는다 (결제 화면에 "$15.30 / year" 가 보이면 완료). 그 전까지 Family Plan 결제는 `stripe_not_configured` 로 막혀 있어서, 예전 "$15.30 once" 화면에서 연간 구독이 시작되는 일은 없다.
5. **Secret** — Developers → API keys → Secret key (`sk_test_…`) → 같은 화면에 Type **Secret** 으로 `STRIPE_SECRET_KEY` (기존이면 그대로).
6. **웹훅** — Developers → Webhooks → 엔드포인트 `https://hangul-route-api.<계정>.workers.dev/api/entitlements/stripe/webhook` (없으면 Add endpoint) → **Select events** 에 7개:
   - 지금 필요한 4개: `checkout.session.completed` · `customer.subscription.created` · `customer.subscription.updated` · `customer.subscription.deleted`
   - 영수증·결제 기록용 3개 (F-BILL-002 B-3 배포 전에는 Worker 가 `applied: false` 로 200 응답): `invoice.paid` · `invoice.payment_failed` · `charge.refunded`
   - 새로 만들었다면 Signing secret (`whsec_…`) → Type **Secret** 으로 `STRIPE_WEBHOOK_SECRET` → Deploy. (기존 엔드포인트에 이벤트만 추가하면 secret 은 그대로다.)
   - 엔드포인트의 **API version** 을 여기에 적어 둔다: `____________` (Developers → Webhooks → 그 엔드포인트 → 상단의 *API version*). Worker 는 2025-03-31.basil 이전 형식과 그 이후 형식 (새 샌드박스 기본값 2025-09-30.clover 포함) 을 모두 읽는다 (F-BILL-002 B-3). 버전을 바꿀 필요는 없다. 나중에 이 값이 바뀌면 여기 다시 적는다.
7. **Customer portal** — Settings → Billing → **Customer portal**:
   - **Cancel subscriptions** 켜기 → 방식 **Cancel at end of billing period** (즉시 해지 아님)
   - **Update payment methods** 켜기 · **Invoice history** 켜기
   - **Switch plans** 끄기 · 수량 변경 끄기
   - Business information: 개인정보 처리방침 `https://hangulroute.com/privacy` · 이용약관 `https://hangulroute.com/terms` → Save
8. **구독 이메일과 실패 결제** — Settings → Billing → **Subscriptions and emails**:
   - **Send emails about upcoming renewals** 켜기 → **30일 전** (연 단위 갱신 사전 고지; 정확한 기간은 Live 전에 법률 검토)
   - 고객 이메일: **Successful payments** (영수증) 켜기 · **Failed payments** (카드 갱신 링크) 켜기
   - **Manage failed payments**: Smart Retries 유지 → *If all retries for a payment fail* → **Cancel the subscription**

**확인 (샌드박스)**:
- 결제 화면 (`/teach/billing`, 나중에 `/account/billing`) → **Family Plan** → **Choose** → 테스트 카드 `4242 4242 4242 4242` → 돌아오면 카드가 "active · renews {1년 뒤 날짜}" 로 보인다.
- **Manage subscription** → Cancel → 돌아오면 "cancelled · ends {날짜}" — 그 날짜까지는 학습자에게 전체 경로가 계속 열린다.
- (선택) Developers → **Test clocks** 로 구독을 1년 앞으로 돌려 갱신이 되는지 본다.
- Live mode 는 오너가 켤 때 1, 2, 3, 4, 6, 7, 8 을 Live 에서 한 번 더 한다 (Live 는 상품·가격·키·웹훅·포털 설정이 모두 따로다).
- **Live 전 필수**: 이용약관 (`/terms`) 에 연간 자동 갱신·해지 방법 (Billing → Manage subscription)·남은 기간까지 이용·갱신 사전 고지 기간이 들어가야 한다 (F-SITE-002 S-7, 법률 검토 OD-13). 포털이 `/terms` 를 링크하므로 그 전에는 Live 를 켜지 않는다.
- **중복 구독**: 한 space 에 구독이 두 개 보이면 (두 탭에서 거의 동시에 결제), 새 것의 인보이스를 환불하고 Customers → 해당 고객 → Subscriptions 에서 **즉시 해지** 한다.
  - **해지 직후 확인**: 한 space 의 플랜 행은 하나라서, 그 행이 마침 방금 해지한 구독을 가리키고 있었다면 남은 구독이 있어도 space 가 무료로 바뀔 수 있다. 결제 화면에서 그 space 가 "active · renews …" 가 아니라 Free 나 ended 로 보이면, Developers → Webhooks → 엔드포인트 → *Event deliveries* 에서 **남은 구독**의 가장 최근 `customer.subscription.updated` (없으면 `customer.subscription.created`) 를 열어 **Resend** 한다. Worker 가 그 구독을 Stripe 에서 다시 읽어 space 를 다시 연다 (BY-D5). 학습자의 별·카드·진도는 그 사이에도 그대로다.
  - B-3 배포 후에는 두 결제가 모두 결제 기록 (`billing_events`; B-8c 이후 결제 화면의 Receipts) 에 남고, 환불하면 **Refund** 행이 하나 더 생긴다. 환불만 하고 해지하지 않으면 그 구독은 내년에 다시 갱신되니, **환불과 즉시 해지를 함께** 한다.
  - 진단용 이벤트 `billing.checkout_completed { duplicate: true }` 가 Worker 에 남는다 (메모리에만, 조회 경로 없음). 중복은 Stripe 대시보드에서 찾는다.

**결제 기록 (F-BILL-002 B-3 배포 후)**:
- 6번의 이벤트 3개 (`invoice.paid` · `invoice.payment_failed` · `charge.refunded`) 를 Worker 가 D1 `billing_events` 에 기록한다. 금액·날짜·Stripe id 만 저장하고, 카드·이름·이메일·주소·영수증 URL 은 저장하지 않는다.
- **확인**: 위의 테스트 결제 뒤 Developers → Webhooks → 엔드포인트 → *Event deliveries* 에서 `invoice.paid` 가 **200** 이고 응답에 `"recorded":true` 가 있으면 된다. `"applied":false` 이면 그 인보이스가 어느 space 의 것인지 찾지 못한 것이다 (대시보드에서 직접 만든 구독처럼 우리 결제 화면을 거치지 않은 결제). 기록되지 않을 뿐, 이용 기간에는 영향이 없다.
- **환불은 기록만 한다** (OD-6, BY-D8): 환불해도 Family Plan / Group License 의 이용 기간은 바뀌지 않는다. 기간은 Stripe 의 구독 이벤트만 정한다. 환불한 플랜을 **바로** 끝내려면 Customers → 해당 고객 → Subscriptions → **Cancel subscription → Immediately** (기간 끝이 아니라 즉시). `customer.subscription.deleted` 가 오면 학습자는 무료 범위로 돌아가고, 이미 얻은 별·카드·진도는 그대로 남는다.
- 같은 결제를 여러 번 나눠 부분 환불하면, 환불할 때마다 **새로 환불된 금액만** 한 행씩 기록된다. 같은 웹훅이 다시 와도 행이 늘지 않는다.
- `charge.refunded` 가 *Event deliveries* 에 **503** 으로 보이면, Stripe 가 알아서 다시 보내고 성공하면 200 이 된다. 응답의 `code` 로 이유를 본다:
  - `stripe_unavailable`: 환불을 결제에 맞추려고 Stripe 를 조회하다 실패했다. 보통은 잠시 후 저절로 풀린다. **한 시간 넘게** 계속되면 Worker 의 `STRIPE_SECRET_KEY` 를 확인한다 (키를 바꿨거나 폐기했거나, 인보이스 읽기 권한이 없는 제한 키). 키를 고치면 다음 재전송에서 기록된다.
  - `payment_not_recorded`: 그 결제의 `invoice.paid` 가 아직 기록되지 않았다 (Stripe 는 이벤트 순서를 보장하지 않는다). `invoice.paid` 가 들어오면 다음 재전송에서 기록된다. 환불 후 **72시간**이 지나면 더 기다리지 않고 200 (`"applied":false`) 으로 받는다. 그래서 이 엔드포인트가 `invoice.paid` 를 받기 **전에** 결제된 건의 환불은 결제 기록에 남지 않는다 (Stripe 대시보드에는 그대로 있다).
- 분쟁 (`charge.dispute.*`) 은 기록하지 않는다. Stripe 대시보드에서 처리한다.

**결제 전 본인 확인과 Live 잠금 (F-BILL-002 B-5 배포 후)**:
- **confirm `fva` in a production token** (한 번만): 결제·구독 관리 (B-4 이후 영수증 링크도) 는 최근 10분 안에 다시 로그인한 경우에만 열린다 (Clerk 세션 토큰의 `fva` 클레임). 토큰에 `fva` 가 없으면 결제가 계속 거절된다 (`reverify_required`). 확인 방법: app.hangulroute.com (또는 hangulroute.com 콘솔) 에 로그인 → 브라우저 개발자 도구 Console 에서 `JSON.parse(atob((await window.Clerk.session.getToken()).split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).fva` 를 실행한다 → `[숫자, 숫자]` 가 나오면 된다 (`undefined` 면 없음). 토큰 문자열을 jwt.io 같은 외부 사이트에 붙여 넣지 않는다. 없으면 Clerk Dashboard 에서 인스턴스의 **session token version** 을 v2 로 올린다 (Dashboard 의 Updates 또는 Sessions 설정 화면에 있다; 코드 변경 없음). 올린 뒤 다시 로그인해서 같은 방법으로 `fva` 를 확인한다.
- 그 전까지 (그리고 B-8b 의 확인 창이 나오기 전까지) 예전 결제 화면에서 로그인한 지 10분이 지났으면 "Couldn't start checkout" 이 보인다. 로그아웃 후 다시 로그인하면 된다.
- **`BILLING_LIVE_ALLOWED` 는 넣지 않는다** (OD-12). 이 값 없이 Live 키 (`sk_live_…`) 를 넣으면 결제·구독 관리·코드 확인이 `503 live_not_enabled` 로 막힌다 (웹훅은 계속 받는다). `GET /health` 의 `bindings.stripeLive` / `bindings.billingLiveAllowed` 로 상태를 본다. 테스트 키를 넣었는데 `stripeLive: true` 면 키 문자열이 잘못된 것이다 (`sk_test_` 또는 `rk_test_` 로 시작해야 한다; 알 수 없는 키는 Live 로 보고 막는다). Live 를 열 때만 Type **Text** 로 `BILLING_LIVE_ALLOWED` = `true`.

### Step 9. 프로모·레퍼럴 코드 (15분, 배포 불필요)
Stripe → Product catalog → **Coupons** → New: 퍼센트 또는 정액 · Duration (`once` = Family Plan 과 라이선스 모두 **첫 해만**, `forever` = 매년 갱신까지, `repeating` = 지정한 개월 수) · 선택: 총 사용 횟수, 만료 → 그 쿠폰에서 **Add promotion code** → 고객이 입력할 문자열 (런치용 `HOYA20`, 추천 교사별 `MSPARK`) · 코드별 최대 사용 / 만료 / 첫 구매만 / 최소 금액. 끄기 = inactive.
- **100% 할인 Once 코드**: Family Plan 은 그래도 카드를 받는다 (`payment_method_collection=always`) → 첫 해 무료, 그 다음 해부터 그 카드로 $15.30 갱신 (갱신 사전 고지 메일 후). Group License 는 카드를 받지 않는다 (`if_required`) → 첫 갱신 때 결제가 안 되어 `past_due` 후 재시도가 끝나면 해지된다. 갱신 사전 고지 메일이 Manage subscription 에서 카드를 넣으라고 안내한다; 카드가 없으면 무료 1년 뒤 끝난다. 계속 후원할 학급이면 **Forever** 코드를 쓴다.
**확인**: 콘솔 billing 에 코드 입력 → Apply → 행의 가격이 "$12.24 / year with HOYA20 (20% off, first year), was $15.30 / year" 로 바뀐다.

### 권장 — Rescue Code 키 `RESCUE_PEPPER` (5분, 한 번만, audit SEC-5)
Rescue Code 는 서버에 해시로만 저장된다. 이 키를 넣으면 **새로 발급되는** 코드가 `HMAC-SHA-256(키, 코드)` 로 저장되어, DB 사본만 유출돼도 오프라인에서 코드를 추측할 수 없다. 이미 발급된 코드(단어 2개 + 숫자 4자리, 예: `PADDLE-GLACIER-4992`)는 키를 넣기 전·후 모두 그대로 복원된다.
1. 로컬 터미널에서 `openssl rand -hex 32` → 64자 문자열을 복사하고 비밀번호 관리자에도 저장한다 (wrangler 가 아니므로 회사 프록시와 무관).
2. `hangul-route-api` → Settings → Variables and Secrets → Add → Type **Secret** → 이름 `RESCUE_PEPPER` → 값 붙여넣기 → Deploy.
- **한 번 넣으면 바꾸거나 지우지 않는다.** 그 키로 저장된 코드는 키가 없거나 다르면 전부 복원되지 않는다 (404 `code_not_found`). 분실에 대비해 비밀번호 관리자에 보관한다.
- 넣지 않으면: 지금과 똑같이 동작한다. 새 코드(단어 4개 + 숫자 6자리, 약 52비트)가 평문 SHA-256 해시로 저장될 뿐이다. 키는 나중에 언제든 추가할 수 있고, 추가 전에 발급된 코드도 계속 복원된다.

**확인**: API 주소의 `/health` 가 `"bindings":{…,"rescuePepper":true}` 를 돌려준다 (값은 노출되지 않는다). 모니터가 있다면 `rescuePepper` 가 `true` → `false` 로 바뀔 때 경고하게 한다. 앱에서 코드를 새로 발급 (설정 → Save my progress → Get a new code) 한 뒤 다른 브라우저에서 그 코드로 복원되는지 본다.

## C. 검증과 콘텐츠 (Step 10–12)

### Step 10. 설치 + 오프라인 실기기 (30분)
- iPhone Safari: app.hangulroute.com → 공유 → 홈 화면에 추가 → 아이콘으로 실행 → 주소창 없는 전체화면
- Android Chrome: 설치 배너 또는 메뉴 → 앱 설치 · 데스크톱 Chrome: 주소창 설치 아이콘
- 오프라인: 설치한 앱으로 퀘스트 1개 완주 → 비행기 모드 → 앱 완전 종료 후 재실행 → 프로필·카드가 남아 있고 다음 퀘스트도 된다

### Step 11. Lighthouse (15분)
데스크톱 Chrome → app.hangulroute.com → F12 → Lighthouse → Mobile → Performance + Best practices/PWA → Analyze. 설치 가능 항목 전부 녹색, Performance 80 이상. 빨간 항목은 캡처해서 저에게.

### Step 12. 자모 소리 30개 녹음 (T-017, 1일, 틈날 때)
**무엇을 말할지와 파일 이름은 [`audio-recording-script.md`](audio-recording-script.md) 표 그대로** 따른다 (앱 콘텐츠에서 자동 생성되므로 앱과 어긋나지 않는다). 자음은 이름이 아니라 소리를 녹음한다: ㄱ 은 "기역" 이 아니라 **가**, 받침 ㄱ 은 **악**. ㅇ 만 이름 **이응** 을 말한다 (첫소리 ㅇ 은 소리가 없어서 "아" 로 하면 모음 ㅏ 와 같아진다).
- **한 사람이** 30개를 모두 녹음한다. 표준 서울말. 같은 방, 같은 거리 (입에서 약 15 cm, 입 정면에서 살짝 비켜서). 울림 없는 조용한 방이면 스마트폰 음성메모로 충분하다.
- 한 항목을 **차분한 평서문 한 번**으로 말한다. 묻는 억양, 길게 늘이기, 말 앞의 숨소리·"어" 는 넣지 않는다.
- 한 파일에 **두 번 연속** 녹음하고 사이에 **2초** 쉰다. 저장소 쪽에서 첫 번째를 쓴다. 두 번째가 더 좋으면 파일 이름에 `.2` 를 붙인다 (`giyeok.2.m4a`).
- **파일 이름 = 표의 `file id` + 녹음기 확장자** (`giyeok.m4a`, `giyeok-batchim.m4a`). 글자로 이름 붙이지 않는다 (`ㄱ.mp3` 는 첫소리와 받침이 같은 이름이 되어 여섯 쌍이 겹친다).
- **귀로 확인 (보내기 전)**: 악 · 압 · 안 · 알 · 암 · 앙 을 이어서 들어 보고 여섯 개가 서로 구별되는지 확인한다. 구별되지 않으면 모음을 아주 짧게 하고 닫으며 다시 녹음한다. 그래도 안 되면 다시 녹음하지 말고 저에게 알려 준다 (대비용 클립을 따로 추가한다).
- 녹음한 분의 **음성 사용 동의서** (짧은 서명본) 를 받아 둔다. **저장소는 공개(public)** 이므로 동의서와 원본 녹음 파일은 **저장소 밖** (본인 개인 드라이브) 에만 보관하고 절대 커밋하지 않는다. 저장소에는 처리된 MP3 만 들어간다. 원본을 저장소 안에 둘 때는 gitignore 된 `apps/mobile/recordings/` 에만 둔다 (`audio:process` 는 그 밖의 저장소 폴더를 거부한다).
- `content/assets-license.csv` 에는 클립마다 한 줄씩 기록하되, `attribution` 에는 녹음한 분이 동의한 표기만 쓴다 (이니셜, 활동명, 또는 `Hangul Route (voice-use release on file)`). 실명은 본인이 동의한 경우에만.
- 2차 (선택, 나중에): 자음 이름 14개 (`giyeok-name` = 기역 …), 표의 Batch 2.

폴더째 (개인 드라이브 공유 링크 등, 저장소 밖으로) 보내면 저장소 쪽에서 `audio:process` (자르기 · 앞뒤 0.3초 여백 · -16 LUFS 정규화 · 모노 44.1 kHz 64 kbps MP3) → `audio:check` (길이 · 음량 · 피크 · 크기 검사) → `audio:map` 순서로 처리하고, 커밋 전에 **처리된 받침 클립 6개** (악 · 압 · 안 · 알 · 암 · 앙) 를 이어서 다시 들어 구별되는지 확인한 뒤, 코드 변경 없이 콘텐츠 PR (`content(audio): jamo clips`, F-AUDIO-004 A-9) 하나로 넣는다. 아직 없는 클립 목록은 `pnpm --filter @hangul-route/mobile audio:status`.

## D. 연락 주소 (Step 13)

### Step 13. 문의 메일 받기 — Cloudflare Email Routing (10분, 공개 전 필수)
**왜**: 랜딩 푸터 · About · 개인정보처리방침 · 이용약관의 연락처는 모두 `hello@hangulroute.com` 이다 (`/teach/billing` 의 학교 계약 문의 링크도 같은 주소). 지금 `hangulroute.com` 에는 메일을 받는 설정 (MX) 이 없어서 이 주소로 보낸 메일은 반송된다. 개인정보처리방침이 학부모의 열람·삭제 요청에 30일 안에 답한다고 약속하므로, 공개 전에 이 주소가 실제로 받아야 한다. 도메인이 이미 Cloudflare DNS 에 있어서 별도 메일 서비스 없이 무료로 된다 (Step 6 과 순서 무관).
1. Cloudflare 대시보드 → `hangulroute.com` → **Email** → **Email Routing** → **Get started** (또는 Enable Email Routing).
2. Cloudflare 가 필요한 DNS 레코드 (MX · SPF) 를 보여 준다 → **Add records and enable**.
3. **Routing rules** → **Create address** → Custom address `hello` → Action **Send to an email** → Destination 에 **오너 본인의 받은편지함 주소** → Save.
4. 그 받은편지함에 Cloudflare 가 보낸 확인 메일의 링크를 누른다. **Destination addresses** 에서 상태가 **Verified** 가 되기 전에는 아무것도 전달되지 않는다.

**확인**: 다른 계정 (예: 개인 Gmail) 에서 `hello@hangulroute.com` 으로 메일을 보내면 몇 분 안에 4 의 받은편지함에 도착한다 (스팸함도 확인). Routing 탭에서 `hello@hangulroute.com` 규칙이 Active 로 보인다.
- 참고: Email Routing 은 받는 것만 전달한다. 답장은 받은편지함 주소에서 나가므로, 발신자를 `hello@hangulroute.com` 으로 보이게 하려면 메일 서비스 쪽 설정 (예: Gmail 의 "다른 주소에서 메일 보내기") 이 따로 필요하다. 선택 사항이고 공개 전 필수는 아니다.

## E. 앱 호스트의 어른 영역 (F-APP-001, S-1 → S-2 → S-0 → S-3)

> 목적: app.hangulroute.com 에서 어른이 페르소나 (Family · Teacher) 로 로그인하고, hangulroute.com 은 소개·가이드만 맡는다. 모든 단계는 대시보드에서만 하고, 각 단계는 되돌릴 수 있다 (F-APP-001 §3.13). **Stripe Live 는 이 절과 무관하며 계속 꺼 둔다.**

### 빌드 변수 표 (`hangul-route-app` → Settings → Build → Variables and Secrets)

| 변수 | 값 | 언제 | 없으면 |
|---|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `hangul-route-web` 과 **같은** `pk_live_…` | S-1 (A-4b 머지 후) | 앱 호스트의 어른 페이지가 "sign-in is not set up on this build" 한 줄만 보여 준다 (아무 데서도 링크하지 않으므로 무해) |
| `NEXT_PUBLIC_LECTURE_MODE` · `NEXT_PUBLIC_SCHOOL_CONSENT_MODE` | (선택) `hangul-route-web` 과 같은 값 | S-1 | 해당 콘솔 기능이 앱 호스트에서 꺼진 채로 |
| 형제 스펙의 콘솔 플래그 (`NEXT_PUBLIC_REPORTS_ENABLED` · `NEXT_PUBLIC_NOTES_ENABLED` · `NEXT_PUBLIC_LEARNING_ROUTE_ENABLED`) | 각 스펙이 켤 때 `true` (All lessons 는 `NEXT_PUBLIC_BROWSE=enabled`, F-BROWSE-001 BR-14) | 각 형제 스펙의 단계 | 해당 메뉴·카드가 숨겨진다 |
| `EXPO_PUBLIC_GROWN_UP_HOME` | `true` | S-3 (M3) | 학습자 앱에 어른 진입점 (Welcome 페르소나 행 · Profile "Grown-up home" · 대시보드 카드) 이 보이지 않는다 |
| `EXPO_PUBLIC_SITE_URL` | `https://hangulroute.com` | S-3 | 기본값도 `https://hangulroute.com` (그다음 `EXPO_PUBLIC_CONSOLE_URL`) |
| `EXPO_PUBLIC_CONSOLE_URL` | 삭제 | S-3 뒤, F-BILL-002 가 더 읽지 않을 때 | — |

`NEXT_PUBLIC_API_BASE_URL` 은 넣지 않아도 된다: 빌드가 `EXPO_PUBLIC_API_BASE_URL` 을 넘겨 준다 (A-3). 변수를 바꾸면 **Retry deployment**.

### S-1. 앱 호스트 빌드에 Clerk 키 (5분, A-4b 머지 후)
A-3 이 아니라 **A-4b 머지 후**에 한다: A-4b 의 공통 어른 레이아웃이 모든 어른 페이지에 잠금 (`GrownUpLock`) 을 씌우고, 아래 확인에 쓰는 `/signin` 도 A-4b 와 함께 생긴다.
`hangul-route-app` → Settings → Build → Variables → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `hangul-route-web` 의 것과 같은 `pk_live_…` (Secret key 가 아니라 publishable key). 선택: 위 표의 콘솔 플래그를 사이트와 같은 값으로. `NEXT_PUBLIC_CONSOLE_DEV_AUTH` 는 **복사하지 않는다** (앱 호스트 빌드는 이 값을 항상 끈다). → **Retry deployment**.
**확인**: https://app.hangulroute.com/signin 에 Clerk 로그인 위젯이 뜬다. https://app.hangulroute.com 의 학습자 앱은 그대로다 (아직 어디서도 어른 페이지로 링크하지 않는다).

### S-2. Clerk Production 확인 + M2 실기기 로그인 (30분, A-4b 와 A-5c 가 앱 호스트에 배포된 뒤)
1. Clerk 대시보드 (Production 인스턴스) → `https://app.hangulroute.com/signin` 로그인이 되는지 본다 (루트 도메인의 서브도메인은 같은 인스턴스가 서빙). 허용 redirect origin 목록이 보이면 `https://app.hangulroute.com` 을 추가. "verify email at sign-up" 이 켜져 있는지 확인.
2. M2: 데스크톱 브라우저에서, 그리고 **설치한 PWA** (iPad 또는 iPhone, Android Chrome) 에서 각각 Google 과 이메일 코드로 로그인 → 학급 하나 열기 → `/parent` → `/account/billing` 열기.
**확인**: 여섯 조합 (기기 3 × 방식 2) 이 모두 페르소나 홈에 도착하고, 설치한 PWA 창 안에 **Back to learning** 이 보인다. 안 되는 조합은 기기·방식·화면 캡처를 보낸다.

### S-0. 운영 서비스 워커 확인 (5분, S-3 바로 전)
1. 브라우저에서 `https://app.hangulroute.com/sw.js` 를 열고 `/signin`, `/teach`, `/parent`, `/account` 가 들어 있는 거부 목록 (denylist) 과 `grown-ups-offline.html` 이 보이는지 찾는다 (Ctrl/Cmd+F).
2. A-2 PR 이 머지된 날짜를 보고 **오늘이 그로부터 7일 이상** 지났는지 확인한다 (설치된 옛 워커가 새 워커로 바뀔 시간).
**확인**: 두 가지 모두 예. 아니면 S-3 를 미룬다 (F-SITE-002 S-10, F-BILL-002 B-10 도 같은 이유로 S-0 뒤).

### S-3. 학습자 앱의 어른 진입점 켜기 (5분, M3: S-0 과 M2 뒤)
`hangul-route-app` 빌드 변수 `EXPO_PUBLIC_GROWN_UP_HOME` = `true`, `EXPO_PUBLIC_SITE_URL` = `https://hangulroute.com` → **Retry deployment**. (`EXPO_PUBLIC_CONSOLE_URL` 은 F-BILL-002 가 더 읽지 않게 된 뒤 삭제.) 같은 창에서 F-SITE-002 S-10 (사이트가 `out-site/` 와 리다이렉트를 서빙) 과 F-BILL-002 B-10 (`hangul-route-api` 의 `BILLING_URL=https://app.hangulroute.com/account/billing`) 도 각 스펙 순서대로 한다.
**확인**: 학습자 프로필이 없는 브라우저의 Welcome 에 "Here to support a learner?" 행이 보이고 **Parent or caregiver** 가 `/signin?persona=parent` 로 간다. 학습자 프로필이 있는 기기에서는 Profile → 어른 영역 → **Grown-up home** → PIN → 어른 영역이 열린다.

**되돌리기**: S-3 는 `EXPO_PUBLIC_GROWN_UP_HOME` 을 `false` 로 (또는 삭제) → Retry deployment. S-10 은 F-SITE-002 쪽 되돌리기, B-10 은 `BILLING_URL` 삭제. 앱 호스트의 어른 페이지는 남아 있어도 무해하고, 데이터는 어느 방향으로도 바뀌지 않는다. 마지막 단계 A-10 (기본값 켜기) 은 M3 후 14일 이상 지나 머지된다.

## F. 어른의 쪽지 (Notes from grown-ups, F-FEEDBACK-001)

> 목적: 신고 확인, 결과 기록, 보내기 정지 (hold) 와 해제, 보내기 스위치 `NOTES_SEND`, 요청에 따른 쪽지 삭제. 모든 쿼리는 대시보드 **Workers & Pages → D1 → `hangul-route` → Console** 에 한 문장씩 붙여 넣는다 (로컬 `wrangler` 는 쓰지 않는다). `<...>` 자리만 바꾼다. 시각은 앱과 같은 형식 (`2026-10-13T12:00:00.000Z`) 으로 `strftime('%Y-%m-%dT%H:%M:%fZ','now')` 가 만든다.
> 개인정보: 신고 검토에 필요한 것 (쪽지 본문, 보낸 계정의 이메일, 공간 이름) 만 본다. 학습자 이름이나 기기 id 는 조회하지 않고, 쿼리 결과를 저장소·채팅·이슈에 붙이지 않는다.
> 안전 경로 (받은 쪽지, 숨기기, 신고, 보내는 사람 막기, 가족 보기, 설정) 에는 스위치가 없고 항상 동작한다. 오너가 켜고 끄는 것은 **보내기** 뿐이다.

### F-1. 열린 신고 보기 (매일, 5분, OD-11)

보호자 확인 없는 기기의 `unsafe` 신고 (예: 교실 태블릿) 가 맨 위에 온다. 이 신고는 쪽지를 숨기기만 하고 자동 정지를 걸지 않으므로 오너가 먼저 판단한다. 그다음은 다른 `unsafe`, 그다음은 나머지를 오래된 순서로 보여 준다.

```sql
SELECT r.id AS report_id, r.note_id, r.reason, r.via, r.attest, r.created_at AS reported_at,
       n.status, n.sender_role, n.sender_account_id, a.email AS sender_email, s.name AS space_name,
       n.preset_id, n.body, n.created_at AS sent_at,
       (SELECT COUNT(*) FROM feedback_reports x WHERE x.note_id = r.note_id) AS reports_on_note,
       (SELECT h.reason FROM feedback_sender_holds h WHERE h.account_id = n.sender_account_id AND h.lifted_at IS NULL) AS hold_reason,
       (SELECT h.created_at FROM feedback_sender_holds h WHERE h.account_id = n.sender_account_id AND h.lifted_at IS NULL) AS hold_created_at
FROM feedback_reports r
JOIN feedback_notes n ON n.id = r.note_id
LEFT JOIN accounts a ON a.id = n.sender_account_id
LEFT JOIN spaces s ON s.id = n.space_id
WHERE r.reviewed_at IS NULL
ORDER BY CASE WHEN r.reason = 'unsafe' AND r.via = 'device' AND COALESCE(r.attest, '') <> 'grown_up_pin' THEN 0
              WHEN r.reason = 'unsafe' THEN 1 ELSE 2 END,
         r.created_at, r.id
LIMIT 100;
```

- `hold_reason` 이 비어 있지 않으면 보낸 계정이 지금 정지돼 있다 (`unsafe`·`reports` 는 자동 정지, `owner` 는 오너가 건 정지). `hold_created_at` 이 이 신고의 `reported_at` 과 같거나 바로 뒤면 이 신고가 정지를 건 것이다.
- 결과가 없으면 끝. 신고된 쪽지는 이미 모든 기기에서 사라졌고 (다음 받은 쪽지 동기화 때), 보낸 사람 목록에는 `not_shown` 으로 보인다.
- `body` 가 비어 있으면 미리 만든 문구 (`preset_id`) 만 있는 쪽지다. 문구는 `packages/i18n/src/messages/en/common.ts` 의 `notes.presets` 에서 찾는다.
- 아동 안전이 걱정되는 내용 (연락 시도, 만남 제안, 성적 내용, 위협) 이면 F-2 의 `sender_held` 로 기록하고, 필요하면 해당 기관에 신고한다. 쪽지와 신고 행은 지우지 않는다 (증거; 신고 뒤 90일 동안 남는다).

### F-2. 결과 기록 (쪽지 하나당, 2분)

쪽지의 열린 신고를 모두 한 번에 닫는다. 결과는 셋 중 하나다.

**(a) `kept_hidden` — 숨긴 채로 둔다** (가장 흔한 결과). 쪽지는 `reported` 상태 그대로 모든 기기에서 숨겨져 있고, 마지막 신고 뒤 90일에 신고 행과 함께 지워진다 (명세 8.7). 상태를 `hidden` 으로 바꾸지 않는 이유: 기기에서 신고된 가족 쪽지를 보낸 어른의 화면이 검토 뒤에 바뀌지 않게 하려는 것이다 (규칙 8.2-c — 집의 어른이 아이가 자기를 신고했다는 것을 알면 안 된다).

```sql
UPDATE feedback_reports SET reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), outcome = 'kept_hidden'
WHERE note_id = '<note_id>' AND reviewed_at IS NULL;
```

**(b) `restored` — 되돌린다** (신고가 실수였을 때만; 예: "not_for_me" 를 잘못 누름). 쪽지는 신고 전 상태 (보이는 쪽지, 가족이 숨긴 쪽지, 또는 보낸 사람이 거둔 쪽지) 로 돌아가고, 보이는 쪽지면 학습자의 다음 동기화 때 다시 나타난다. 되돌린 신고는 자동 정지 횟수에 들어가지 않는다. 두 문장을 순서대로 실행한다.

```sql
UPDATE feedback_notes
SET status = CASE WHEN withdrawn_at IS NOT NULL THEN 'withdrawn'
                  WHEN hidden_at IS NOT NULL AND hidden_via IS NOT NULL THEN 'hidden'
                  ELSE 'live' END
WHERE id = '<note_id>' AND status = 'reported';
```

```sql
UPDATE feedback_reports SET reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), outcome = 'restored'
WHERE note_id = '<note_id>' AND reviewed_at IS NULL;
```

이어서 정지를 확인한다. 되돌린 신고는 다음 신고부터 횟수에 들어가지 않지만, 그 신고가 이미 건 자동 정지는 저절로 풀리지 않는다. F-1 결과에서 이 쪽지의 `hold_reason` 이 `unsafe` 또는 `reports` 이고 `hold_created_at` 이 이 신고 시각과 같거나 바로 뒤이면, 아래 문장으로 그 계정에 되돌리지 않은 다른 신고 (최근 30일) 가 있는지 본다. `0` 이면 F-3 의 **정지 풀기** 를 실행한다. `0` 이 아니면 그 신고들을 먼저 검토한다.

```sql
SELECT COUNT(*) FROM feedback_reports
WHERE sender_account_id = '<sender_account_id>' AND COALESCE(outcome, '') <> 'restored'
  AND created_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days');
```

**(c) `sender_held` — 숨긴 채로 두고 보낸 계정을 정지한다.** 아래 F-3 의 정지 문장을 먼저 실행하고, 이어서:

```sql
UPDATE feedback_reports SET reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), outcome = 'sender_held'
WHERE note_id = '<note_id>' AND reviewed_at IS NULL;
```

**확인**: F-1 을 다시 실행하면 그 쪽지가 목록에서 빠져 있다.

### F-3. 보내기 정지 (hold) 와 해제

정지된 계정은 누구에게도 쪽지를 보낼 수 없고 (`403 sending_paused`), 콘솔에는 "Sending notes is paused for this account. Write to hello@hangulroute.com." 이 보인다. 그 계정의 다른 콘솔 기능은 그대로다. 정지는 이전 쪽지를 숨기지 않는다 (신고된 쪽지는 이미 숨겨져 있다). 자동 정지 (서로 다른 두 가족의 신고, 또는 가족·PIN 확인 기기의 `unsafe` 신고) 도 같은 표에 기록되고, 해제는 오너만 한다.

정지된 계정 보기:

```sql
SELECT h.account_id, a.email, h.reason, h.created_at
FROM feedback_sender_holds h LEFT JOIN accounts a ON a.id = h.account_id
WHERE h.lifted_at IS NULL ORDER BY h.created_at;
```

정지 걸기 (`sender_account_id` 는 F-1 결과에서, 또는 `SELECT id FROM accounts WHERE email = '<email>';`). 이미 정지돼 있으면 아무것도 바꾸지 않는다.

```sql
INSERT INTO feedback_sender_holds (account_id, reason, created_at, lifted_at)
VALUES ('<sender_account_id>', 'owner', strftime('%Y-%m-%dT%H:%M:%fZ','now'), NULL)
ON CONFLICT(account_id) DO UPDATE SET reason = excluded.reason, created_at = excluded.created_at, lifted_at = NULL
WHERE feedback_sender_holds.lifted_at IS NOT NULL;
```

정지 풀기 (그 계정과 메일로 이야기한 뒤). 해제 시각 이전의 신고는 다시 세지 않으므로, 다음 신고 하나로 곧바로 다시 정지되지 않는다.

```sql
UPDATE feedback_sender_holds SET lifted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE account_id = '<sender_account_id>' AND lifted_at IS NULL;
```

**확인**: "정지된 계정 보기" 에 그 계정이 보이거나 (걸기) 사라진다 (풀기). 해제된 행은 365일 뒤 자동으로 지워진다.

### F-4. 보내기 스위치 `NOTES_SEND` 켜기·끄기 (1분, 배포 불필요)

`NOTES_SEND` 가 없거나 `enabled` 가 아니면 아무도 쪽지를 보낼 수 없다 (보내기 두 경로가 `404`). 받은 쪽지·숨기기·신고·정지·가족 보기는 스위치와 무관하게 항상 동작한다.

- **켜기는 FB-14 가 배포된 뒤, 이 절을 읽은 다음에만** (OD-19). 지금은 켜지 않는다.
- 켜기: `hangul-route-api` → Settings → **Variables and Secrets** → Add → Type **Text**, 이름 `NOTES_SEND`, 값 `enabled` → **Deploy**. (`keep_vars = true` 라서 이후 배포에도 남는다.)
- 끄기 (문제가 생기면 즉시): 같은 화면에서 `NOTES_SEND` 를 삭제 (또는 값을 `off` 로) → **Deploy**. 이미 보낸 쪽지는 그대로 남고, 신고·숨기기는 계속 된다.

**확인**: API 주소의 `/health` 응답에서 `features.notesSend` 가 켜면 `true`, 끄면 `false`.

### F-5. 요청에 따라 쪽지 지우기 (10분)

요청은 `hello@hangulroute.com` 으로 온다. **요청 메일의 발신 주소가 아래 쿼리의 계정 이메일과 같은지** 먼저 확인한다. 누가 요청했는지에 따라 할 수 있는 일이 다르다. 가족의 확인 (명세 D5, D9, 8.3 항목 3) 이 보낸 사람의 요청보다 앞선다: 보낸 사람은 가족이 보기 전에 쪽지를 지울 수 없다.

**보낸 사람 본인이 요청한 경우 — 지우지 않는다.** 그 계정이 보낸 쪽지:

```sql
SELECT n.id, n.created_at, n.status, n.withdrawn_at, s.name AS space_name, n.preset_id, n.body,
       (SELECT COUNT(*) FROM feedback_reports r WHERE r.note_id = n.id) AS reports
FROM feedback_notes n JOIN accounts a ON a.id = n.sender_account_id LEFT JOIN spaces s ON s.id = n.space_id
WHERE a.email = '<email>' ORDER BY n.created_at DESC LIMIT 50;
```

- 답장: 콘솔의 보낸 쪽지 목록에서 **거두기** (take back) 를 하면 쪽지가 학습자의 기기에서 바로 사라진다고 안내한다. 거둔 쪽지는 학습자의 가족에게 "Taken back by the sender" 로 남고, 보낸 날부터 180일에 자동으로 지워진다.
- `reports` 가 `0` 보다 크면 (신고된 적이 있으면, 결과와 상관없이) 그 쪽지와 신고 행은 지우지 않는다. 신고 기록은 자동 정지 횟수의 근거이고, 마지막 신고 뒤 90일 규칙을 따른다.
- 그보다 일찍 지우는 것은 학습자의 가족 어른이 같은 쪽지의 삭제를 따로 요청했을 때만이다 (아래).

**학습자의 가족 어른 (가족 공간의 owner 또는 caregiver) 이 요청한 경우 — 지운다.** 그 가족 어른이 속한 가족 공간의 학습자가 받은 쪽지:

```sql
SELECT n.id, n.created_at, n.status, s.name AS space_name, n.preset_id, n.body,
       (SELECT COUNT(*) FROM feedback_reports r WHERE r.note_id = n.id) AS reports,
       (SELECT COUNT(*) FROM feedback_reports r WHERE r.note_id = n.id AND r.reviewed_at IS NULL) AS open_reports
FROM feedback_notes n
JOIN memberships ml ON ml.member_kind = 'learner' AND ml.member_id = n.learner_id AND ml.role = 'student'
JOIN memberships ma ON ma.space_id = ml.space_id AND ma.member_kind = 'account' AND ma.role IN ('owner','caregiver')
JOIN accounts a ON a.id = ma.member_id
JOIN spaces f ON f.id = ml.space_id AND f.kind = 'family'
LEFT JOIN spaces s ON s.id = n.space_id
WHERE a.email = '<email>' ORDER BY n.created_at DESC LIMIT 50;
```

- `open_reports` 가 `0` 보다 크면 먼저 F-2 로 결과를 기록한다. 아동 안전 사안 (F-1 의 연락 시도, 만남 제안, 성적 내용, 위협) 이면 지우지 않고 90일 규칙을 따른다 (증거).
- 신고 행을 지우면 그 신고는 이후 자동 정지 횟수에서 빠진다. 그래서 보낸 사람이 지금 정지돼 있으면 (F-3 의 정지된 계정 보기) 정지를 유지할지 먼저 정하고 (F-3) 그다음에 지운다.

요청한 날짜·공간·문구로 쪽지 하나를 고른 뒤, 두 문장을 순서대로 (신고 행은 가족의 요청이고 모든 신고에 결과가 기록된 때만 지운다):

```sql
DELETE FROM feedback_reports WHERE note_id = '<note_id>' AND reviewed_at IS NOT NULL;
```

```sql
DELETE FROM feedback_notes WHERE id = '<note_id>' AND NOT EXISTS (SELECT 1 FROM feedback_reports r WHERE r.note_id = '<note_id>');
```

**확인**: `SELECT COUNT(*) FROM feedback_notes WHERE id = '<note_id>';` 가 `0`. `1` 이면 결과가 기록되지 않은 신고가 남아 있다는 뜻이니 F-2 부터 다시 한다. 기기의 사본은 다음 동기화 때 사라진다. 요청한 사람에게 지웠다고 (보낸 사람에게는 거두기 안내와 보관 기간을) 답장한다 (30일 안에, 개인정보 처리방침의 약속). 학습자의 데이터 전체를 지우는 요청이면 콘솔의 학습자 데이터 삭제 (`DELETE /api/spaces/:id/learners/:learnerId/data`) 가 쪽지·신고·설정·막기 행을 모두 함께 지운다.

## G. Turn on the free plan (web) — 무료 플랜 켜기 (F-ENT-003 E3-11, OD-2)

> 목적: 웹 앱에서 무료 플랜의 경계를 켠다. Stage 1 전체가 무료로 열리고 (OD-1), Stage 2 부터는 미리보기 (Not open yet) 가 된다. **오너만 켠다. Stripe Live 와 같은 릴리스에서만 켠다.** Stripe Live 가 꺼져 있는 동안에는 이 단계를 하지 않는다 (학습자가 결제할 수 없는 경계를 만나게 된다). 이 PR 은 단계만 적어 두며, 운영 변수는 하나도 바꾸지 않는다.

**선행 조건 (모두 예일 때만)**
1. F-ENT-003 E3-12b 와 E3-12c 가 머지됨 (어른 화면의 무료 레슨 줄).
2. 다음 문구 그룹의 ko · es 오버레이가 들어 있고 원어민 검토를 마침: `console.access`, `console.curriculum.freeDays`, `caregiver.access`, `caregiver.plan.freePlan`. 없으면 한국어·스페인어 콘솔과 Plan 화면이 이 줄들을 영어로 보여 준다.
3. 배포할 커밋에서 스위치를 켠 e2e 레인이 통과함 (저장소 쪽에서 돌리고 결과를 PR 에 남긴다):
   - 스위치를 켠 빌드: `EXPO_PUBLIC_CONTENT_GATING_ENABLED=true pnpm --filter @hangul-route/mobile build:web`, 그다음 `E2E_CONTENT_GATING=1 pnpm --filter @hangul-route/mobile exec playwright test free-days plan-next plan-free-lines free-end episode-access dashboard-free-line`
   - 게이팅 픽스처 번들: `pnpm --filter @hangul-route/mobile build:web:fixtures:gated`, 그다음 `STORY_FIXTURES_GATED=1 pnpm --filter @hangul-route/mobile exec playwright test story-shelf-gated.spec free-days`
   - 같은 커밋의 CI `Build PWA · offline e2e` 가 초록 (shard 1 이 게이팅 픽스처 번들에서 `story-shelf-gated.spec` 을 돌린다, F-STORY-004 PR 4.8b 의 릴리스 게이트).
4. F-STORY-004 PR 4.8d (고정된 Home 카드의 접근 재확인, #488) 와 PR 4.8e (Home 카드를 누를 때의 접근 확인) 가 머지됨.
5. F-ENT-003 OD-14 에 답이 있거나 기본값 그대로 둔다.
6. Stripe Live 를 켜는 릴리스와 같은 창 (§B Step 8 의 Live 절차와 `BILLING_LIVE_ALLOWED`).

**단계 (5분, 위 조건이 모두 예일 때)**
1. `hangul-route-app` → Settings → Build → Variables and Secrets → `EXPO_PUBLIC_CONTENT_GATING_ENABLED` = `true`. 같은 빌드가 앱 호스트의 어른 화면 (콘솔) 도 만들므로, 여기에 `NEXT_PUBLIC_CONTENT_GATING_ENABLED` = `true` 도 넣는다. → **Retry deployment**.
2. `hangul-route-web` → Settings → Build → Variables and Secrets → `NEXT_PUBLIC_CONTENT_GATING_ENABLED` = `true` → **Retry deployment**.
3. 사이트의 무료 문구 "Stage 1 is free." (`landing.plans.free.stage1`) 는 그대로 둔다 (OD-1). 사이트 쪽 변경은 없다.

**확인**: 새 학습자 프로필로 https://app.hangulroute.com 을 열면 Journey 에서 Stage 1 칸에는 고리가 없고, Stage 2 · Stage 4 칸에는 점선 고리 (Not open yet) 가 보인다. Stage 2 칸을 누르면 미리보기와 **Ask a grown-up** 이 나온다. 가격·"Premium"·"trial" 같은 말은 학습자 화면 어디에도 없다.

**되돌리기**: 세 변수를 `false` 로 (또는 삭제) → 두 프로젝트 모두 Retry deployment. 학습자가 끝낸 레슨·카드·별은 어느 방향으로도 바뀌지 않는다.

## 나중에 (법률 검토 후)
학교 동의 모드 (c) 를 열 때만: `hangul-route-api` 런타임 변수 `SCHOOL_CONSENT_MODE=enabled` + `hangul-route-web` 빌드 변수 `NEXT_PUBLIC_SCHOOL_CONSENT_MODE=enabled` (Retry deployment). 그 전엔 콘솔에서 선택 불가로 잠겨 있다.

## 보내줄 것 ↔ 시작되는 PR

| 오너가 보내는 것 | 저장소 쪽 다음 PR |
|---|---|
| Step 3 첫 배포 로그 (마이그레이션 ✅ 또는 오류) | 오류면 수정 PR (F-INFRA-003 은 머지됨) |
| Step 7 확인 결과 (위젯이 뜨고 학급 생성이 되는지) | F-AUTH-005 계정 페이지 (이메일·동의 기록·학습자 데이터 삭제) |
| Step 11 빨간 항목 캡처 | 성능 수정 |
| §E S-2 M2 결과 (여섯 조합) · S-0 확인 | F-APP-001 S-3 시점 결정, A-10 (M3 후 14일) |
| Step 12 녹음 폴더 (`audio-recording-script.md` 의 file id 이름, 저장소 밖 공유) + 동의서는 본인 보관, attribution 표기만 전달 | `content(audio): jamo clips` (F-AUDIO-004 A-9): 처리된 MP3 30개 + `audio:map`, 오프라인 e2e 활성화, 랜딩의 오프라인 발음 문구 복원 |

## 문제가 생기면
- 빌드 실패: 프로젝트 → Deployments → 실패한 빌드 → 로그 **마지막 30줄**을 보낸다.
- Node 버전이 22 가 아니라고 로그에 나오면: Build variables 에 `NODE_VERSION=22` 가 있는지 확인.
- "Ignored build scripts" 경고: 정상이다 (`pnpm-workspace.yaml` 의 `neverBuiltDependencies` 가 의도한 정책). 빌드·배포에 필요한 스크립트는 없다.
- wrangler "outdated" 경고 (API Worker 는 wrangler 3.114): 배포에 영향 없는 안내 문구다. 업그레이드는 별도 PR 로 한다.
- API Worker 를 이전 버전으로 되돌릴 때 (롤백): 커리큘럼 플랜(주차가 있는 긴 플랜, F-PLAN-002)이 하나라도 게시된 뒤에는 F-PLAN-002 P2-4 (PR #232) 이전 버전으로 되돌리지 않는다. 이전 Worker 는 `plans.meta_json` 을 모르고 `?cap=curriculum` 확인도 없어서, 31–260개짜리 플랜을 모든 앱에 그대로 보낸다. 꼭 되돌려야 하면 콘솔에서 커리큘럼 플랜을 먼저 보관(Archive)하거나, 되돌리는 대신 수정 PR 을 새로 배포(roll forward)한다. D1 열(`meta_json`)은 그대로 둬도 된다.
