# PWA/Install-Guide — "Add to Home Screen" overlay (wireframe v1, web only)

Spec: `docs/roadmap/web-pwa-offline.md` §3.1 steps 3–4 · §3.3 (iOS 7-day eviction) · §5 (iOS install friction) — proposal, not yet an F-spec
Audience: **parent** (the roadmap puts installation in the "parent's hands" onboarding step); the child sees it only as a dismissible card

## Scenario (Given-When-Then)

Given: the web app has finished caching for offline use, the site is not yet installed, and this is roughly the third visit
When: the learner lands on home (never mid-quest)
Then: a per-platform overlay shows the two or three taps needed to add the app to the home screen, can be dismissed with one tap, and never blocks play

## Screen goal

"Get a grown-up to install the app once, so progress is safe and it works offline."

## Box diagram

```
(home/todays-mission underneath, still tappable above the sheet)
+----------------------------------+
|  home content (cards etc.)       |
|                                  |
|  +----------------------------+  |
|  |  [x]                       |  |  <- dismiss, top-right of sheet
|  |  [hoya - small]            |  |
|  |  "Ask a grown-up to add    |  |  <- one line: child-readable,
|  |   me to your home screen." |  |     points to an adult
|  |                            |  |
|  |  step row (platform-       |  |
|  |  specific, 2-3 icons):     |  |
|  |  [share]->[add to home]    |  |  <- iOS Safari
|  |     or                     |  |
|  |  [[ INSTALL ]]             |  |  <- Android Chrome / desktop:
|  |     or                     |  |     fires the native prompt
|  |  [browser icon]->[install] |  |  <- desktop fallback (no
|  |                            |  |     prompt event available)
|  |  [ not now ]               |  |
|  +----------------------------+  |
+----------------------------------+
```

Platform branches (one is rendered, chosen at runtime):

- **iOS Safari**: no install API. Show the share-sheet icon → "Add to Home Screen" as a two-step pictogram row; no button, because the app cannot trigger it. Step art is illustration-stage work.
- **Android Chrome / Chromium**: `beforeinstallprompt` was captured earlier; [[ INSTALL ]] fires it. If the event never came, fall back to the desktop pictogram.
- **Desktop (Chrome/Edge)**: [[ INSTALL ]] if the prompt event exists; otherwise point to the address-bar install icon.
- **Already installed (standalone display mode)**: the overlay never renders.

The sheet is a bottom card, not a full-screen modal: the home cards above remain tappable, so a child who ignores it can still start a quest.

## Interaction points

- [[ INSTALL ]] → native install prompt → on accept: toast "added" and the guide never shows again; on dismiss: same as [ not now ]
- [ not now ] / [x] / tap outside → hide; snooze for N visits (per-viewer convenience flag only)
- Tap anywhere on home behind the sheet → normal navigation; the sheet closes
- No link into the guide from a quest or minigame; the trigger only evaluates on `home/todays-mission` render

## Navigation graph

Enter from: `home/todays-mission` (web only; conditions: precache complete via `pwa/system-banners` offline-ready, not standalone, ≥ 3 visits — or a parent tapped "Install" in `profile/settings`)
Exit to:    `home/todays-mission` (dismiss) · OS install prompt / share sheet (system UI, returns to home)

## States

- **success**: sheet with the correct platform branch; dismiss works.
- **empty** (already installed, or browser unknown / an in-app webview such as a social app's): nothing renders; if the parent tapped "Install" from settings inside an in-app browser, show a single line "open this page in Safari or Chrome first" with a copy-link button instead of steps.
- **error** (install prompt throws, or the user rejected it at OS level): treat as dismissal; do not re-prompt this session; log only.
- **offline at trigger time**: still allowed (installation needs no network once cached); no change.

## Data needs

- reads: `display-mode: standalone` media query · captured `beforeinstallprompt` event (if any) · platform class (ios-safari | android-chrome | desktop | unknown) · visit counter and snooze flag (per-viewer local convenience, wrapped so the page works without it) · precache-complete flag from the service worker
- writes: snooze / installed flag (local) · `navigator.storage.persist()` request on install accept (roadmap §3.3)
- telemetry: `pwa.install_guide.shown` (platform, visit), `pwa.install_guide.dismissed`, `pwa.install.accepted | rejected`

## Open questions

- Trigger threshold: "3 visits" comes from the app map; the roadmap says only "install prompt after caching". Should the first show instead be tied to the first card unlock (a moment with something worth keeping)?
- Should `profile/settings` carry a permanent "Install this app" row so a parent can find it later without waiting for the overlay? (recommend yes — a settings row is the iOS-friendly path)
- Step-art fidelity: platform screenshots date quickly; pictograms are safer for the design pass but less exact for a parent unfamiliar with the share icon.
- Chromebook users (a stated target in roadmap §0) are desktop-class; verify the prompt event fires in the managed/kiosk modes common in schools.
