# PWA/System-Banners — offline-ready, update, offline, portrait guard (wireframe v1, web only)

Spec: `docs/roadmap/web-pwa-offline.md` §3.1 (offline-ready toast) · §3.2 (update banner) · §3.4 (portrait guard) · §2 (telemetry queue) — proposal, not yet an F-spec
Audience: **learner** (the three banners and the guard render on the child's surface; copy must be Pre-A1) — a parent may act on the update banner

## Scenario (Given-When-Then)

Given: the app runs as a web page or installed PWA
When: the service worker finishes precaching, finds a new version, or the network drops — or the device is turned sideways in a browser tab
Then: a small non-modal banner (or, for orientation, a full guard) tells the learner in one line, and nothing interrupts a quest in progress

## Screen goal

"Say one system thing quietly, at the right moment, without blocking play."

## Box diagram

```
1. offline-ready (once, after first precache)        non-modal, top
+----------------------------------+
| [hoya-small] "All set! You can   |  <- toast, auto-hides after a
|  play without Wi-Fi now."  [x]   |     beat; also swipeable
+----------------------------------+
|  home content                    |

2. update-available (only on home, never mid-quest) non-modal, top
+----------------------------------+
| [hoya-small] "New lessons ready" |
|              [[ TAP TO REFRESH ]]|  <- the banner itself is the
+----------------------------------+     button; [x] snoozes
|  home content                    |

3. currently-offline (persistent while offline)     status chip
+----------------------------------+
| [cloud-off] offline              |  <- small chip in the header,
|  home / quest content unchanged  |     no alarm treatment, no modal
+----------------------------------+

4. portrait guard (phones only, landscape;          full screen
   browser tab or installed app)  -- amended by F-LAYOUT-001 PR 3, matches layout/wide.md E
+------------------------------------------------------------+
|                                                            |
|                     [hoya - thinking]                      |
|               "Turn your phone upright"  (one line)        |
|                     [ Keep sideways ]                      |
|                                                            |
+------------------------------------------------------------+
```

- Banners 1–2 share a single slot; at most one is visible at a time, plus the offline chip. None of them cover a tap target that a quest needs. Where the slot sits (F-LAYOUT-001 PR 3): on a tab screen, above the tab bar; on a screen with no tab bar (onboarding, quest, games, PIN pad), at the top, under the status bar or notch and below the screen's header row (its top gutter plus one 64 pt touch target), so it never sits on "Leave quest", the PIN pad's close X, Back or the bottom CTA. The toast and the chip only inform and never take a tap.
- Banner 2 is queued while `quest/player`, `minigame/shell`, `results/celebrate` or any `reviews/*` screen is active; it appears on the next `home/todays-mission` render (roadmap §3.2 "wait until the results screen"). As built: it waits for any tab screen (Home and the other tabs), so it never shows on a screen with no tab bar, the PIN pad and onboarding included.
- The offline chip is informational. Everything in Stage 1 works offline, so it never says "some features unavailable". Telemetry queues silently.
- The portrait guard (F-LAYOUT-001 §3.4, LD5; layout/wide.md E) renders on phones only, in a browser tab and in the installed app when the runtime lock fails or is missing (iPhone): the manifest says `orientation: any`. "Phone" and "landscape" come from the device (physical screen size, `screen.orientation`), not the window, so a soft keyboard or a zoomed / windowed tablet never shows it, and it never shows while a text field has focus. Rotating upright dismisses it for the session; **[ Keep sideways ]** dismisses it and is remembered on the device (`device:layout`).

## Interaction points

- Banner 1 [x] / swipe / timeout → hides; never shown again for this cache version
- Banner 2 [[ TAP TO REFRESH ]] → service worker `skipWaiting` + reload; lands back on `home/todays-mission`
- Banner 2 [x] → snooze until the next cold start; the new version still applies on the next natural reload
- Chip 3: no interaction (tap → no-op); disappears on `online`
- Guard 4: rotate → returns to whatever screen was active with state intact; [ Keep sideways ] → the same, and the guard stays away on this device

## Navigation graph

Enter from: any screen (system events: service worker `installed` / `waiting`, `offline` / `online`, orientation change); banner 2 additionally gated to `home/todays-mission`
Exit to:    same screen (banners never navigate) · `home/todays-mission` after a refresh (banner 2)

## States

- **success**: each of 1–4 as drawn; at most one banner + the chip at once.
- **empty** (service worker unsupported, e.g. an in-app webview): no banners 1–2; chip 3 still works from `navigator.onLine`; guard 4 still works. The app is fully usable without any of them.
- **error** (service worker registration fails / precache partially fails): banner 1 is not shown (the offline promise would be false); a one-line "couldn't save for offline — try again later" appears in `profile/settings` only, not on the child's home. Refresh failure on banner 2: the banner stays with "try again".
- **offline when an update is found**: banner 2 does not show; the check re-runs on `online`.

## Data needs

- reads: service worker lifecycle events (`installed`, `waiting`, `activated`) · `navigator.onLine` + `online`/`offline` events · `screen.orientation` / screen size / pointer type · `display-mode` (standalone tries the runtime lock first) · current route (to gate banner 2) · `CONTENT_VERSION` of the current vs waiting bundle (for the "new lessons" wording)
- writes: "offline-ready shown" flag per cache version and the banner-2 snooze (per-viewer local convenience, optional) · telemetry offline-queue flush on `online`
- telemetry: `pwa.offline_ready.shown`, `pwa.update.shown | applied | snoozed`, `pwa.offline.entered | exited` (duration); the guard reports `layout.guard_shown` and `layout.guard_dismissed` (via rotated | keep_sideways), F-LAYOUT-001 §3.13

## Open questions

- Does the offline-ready toast belong on the child's screen at all, or only in the parent's settings? The roadmap gives it Hoya copy (child-facing); a 5-year-old has no concept of Wi-Fi. (beta: watch for confusion)
- Should banner 2 distinguish "new lessons" (content version changed) from a plain code update? Only the former is worth the child's attention; the latter could apply silently on the next cold start.
- ~~Landscape on tablets / Chromebooks: does the guard show on tablets, or only on phones?~~ Answered: phones only (F-LAYOUT-001 LD5); tablets get the landscape layout.
- Copy for the offline chip: the single word "offline" is not Pre-A1; consider icon-only with a tooltip for adults.
