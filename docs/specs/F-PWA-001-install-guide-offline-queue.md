# F-PWA-001 — Install guide + offline telemetry queue (web)

**Status**: `ready`
**Scope**: `apps/mobile` (web build; native no-op)
**Owner**: solo dev
**Rollout**: Web launch follow-up (docs/launch/web-app-launch.md §4 items 2–3)

Parent docs: `docs/roadmap/web-pwa-offline.md` §3.1, §3.3 · wireframes `design/wireframes/pwa/install-guide.md`, `pwa/system-banners.md`

---

## 1. Context

The PWA shell (P2) caches the app after one visit, but two gaps remain:

1. **iOS Safari evicts script-writable storage after 7 days without use unless the site is added to the home screen.** A child who plays in the browser tab and comes back two weeks later can lose their cards. The only durable fix is installation, and iOS offers no install API — the app has to *ask an adult*.
2. **Telemetry events fired while offline are dropped.** Offline play is the point of the PWA, so `quest.complete` and `card.unlocked` from a plane ride must survive until the device is back online.

## 2. User story

> As a parent, I want the app to tell me once, clearly, how to put it on the home screen so my child's progress does not disappear — and then leave us alone.

> As the developer, I want offline sessions to count in the launch funnel.

## 3. Acceptance criteria

### 3.1 Install guide sheet (`pwa/install-guide`)

- **Given** the web build is running in a browser tab (not standalone),
  **when** `home/todays-mission` renders and *all* hold: the service worker controls the page (offline-ready), the app has been opened ≥ 3 times on this device, and the guide is not snoozed,
  **then** a bottom sheet renders over Home (Home stays tappable) with one platform-specific branch:
  - `ios-safari`: two-step pictogram (share → Add to Home Screen), no button.
  - `prompt`: an **Install** button that fires the captured `beforeinstallprompt`.
  - `desktop-hint`: point to the address-bar install icon.
  - `in-app-browser` (Instagram / Facebook / KakaoTalk / Line webviews): one line "open in Safari or Chrome" + a **Copy link** button.
  - `none` (already installed, unknown browser, native): nothing renders.
- **Given** the sheet is dismissed ([not now], ×, tap outside),
  **when** the app is opened again,
  **then** it stays hidden for the next **5 opens** (snooze), then may show again. Accepting the install prompt hides it permanently.
- **Given** a parent taps **"Install on this device"** in `profile/settings` (web, not standalone),
  **then** the sheet opens immediately regardless of visit count.
- Visit count, snooze and installed flags are per-device conveniences stored through `platform/storage` (never synced).
- Copy is addressed to an adult and never blocks play: "Ask a grown-up to add me to your home screen."

### 3.2 Offline telemetry queue

- **Given** `track()` is called with the network unavailable or the POST fails/throws,
  **when** an API base URL is configured (the placeholder still sends nothing),
  **then** the event is appended to a persisted queue (`telemetry:queue`, cap **200**, oldest dropped first) with its original timestamp.
- **Given** the browser fires `online`, or the app starts, or a later `track()` succeeds,
  **then** the queue is flushed in order; events that fail again stay queued.
- The queue never throws into a game and never delays the caller (fire-and-forget preserved).

### 3.3 Decision logic is pure

- `logic/pwa/install-guide.ts`: `installGuideVariant(env)` and `shouldShowInstallGuide(state)` are pure and 100 % unit-tested.
- `logic/telemetry/queue.ts`: `enqueue` / `takeBatch` / `requeue` are pure over arrays.

## 4. Out of scope

- Native install / App Store (`docs/launch/app-store-submission.md`).
- Illustrated step art for the iOS pictogram (illustration stage; ships with glyph placeholders from `Icon`).
- Background Sync API (Chrome-only); the `online` event + app-start flush is enough.

## 5. UI sketch

- `design/wireframes/pwa/install-guide.md` (sheet) · `design/wireframes/pwa/system-banners.md` (existing banners)

## 6. Tests

| File | Coverage |
|---|---|
| `logic/pwa/__tests__/install-guide.test.ts` | variant detection per UA / standalone / prompt; show/snooze/installed rules |
| `logic/telemetry/__tests__/queue.test.ts` | cap, order, batch take/requeue |
| `platform/__tests__/telemetry.test.ts` | failure → enqueue, flush order, placeholder endpoint sends nothing |
| `store/__tests__/pwa-store.test.ts` | visits increment, snooze window, installed flag persistence |
| `e2e/web/install-guide.spec.ts` | third open in a browser tab shows the sheet; dismiss snoozes |

## 7. Rollout

- Web build only; native builds compile the same components but `pwa.ts` returns `none`, so nothing renders.

## 8. Dependencies

- Upstream: P2 PWA shell (service worker events `hr:offline-ready`), `platform/storage`.
- Downstream: Rescue Code (F-RESTORE-001) reuses the same "ask a grown-up" sheet pattern.
