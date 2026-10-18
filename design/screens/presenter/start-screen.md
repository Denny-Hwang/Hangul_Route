# Start screen: deck facts, device checks and Start (screen spec v1)

Spec: F-TCH-004 sections 3.2 (roster hand-off steps 2 and 5, removed 2026-10-16), 3.5 (states; the phone start screen, amended 2026-10-16), 3.6 (font wait), 3.7, 3.8 · wireframe B, `classroom/lecture-phone.md` F and G · PR 6; phone version LV-M1
Mock: `mock/start.html` and `start-{resumed,novoice,notready,skipped,loading}.html`; phone: `start-phone.html`, `start-phone-details.html`, `start-phone-check.html` (`start-numbers.html` deleted 2026-10-16) · shots `start-375`, `-1280`, `-320-text200`, `start-*-375`, `start-projected-1280x720`, `-1920x1080`; phone: `start-phone-360x640`, `-640x360`, `start-phone-details-360x640`, `-320-text200`, `start-phone-check-360x640`
Code: `screens/presenter/StartScreen.tsx` (PR 6)

## Anatomy (top to bottom, `layout.maxWidth.reading`, centred)

1. **Back to lessons** (`start.back.cta`, a ghost pill, PR 8): back to the presenter home before Start; the tab forgets the held deck and nothing is saved to Recent or sent. Then "Lecture" (`learner.presenter.home.title`, `text.secondary`), then the deck title as h1 (`size.hero`, teacher text, wraps anywhere).
2. Facts: "71 slides · about 56 minutes" (`start.slides`, `start.minutes`; plural keys; the separator is a middle dot between two whole strings).
3. **Before you start** (h2) and the checks list. Each row: a `check-circle` glyph in `feedback.success` when ready, a `dash` glyph in `text.secondary` when not, and one sentence. None blocks Start.
   - Offline: "Ready for offline" or "Open this page once with Wi-Fi to use it offline." with the plain-text install hint under it, "You can also add it to the home screen from the browser menu." (`start.installHint`, section 3.8; `InstallGuideSheet` is not mounted) (`isOfflineReady()`).
   - Voice: "Korean voice: Yuna, on this device" (`voiceLocal`), "... uses the internet" (`voiceNetwork`), "Korean voice needs the internet" (existing `learner.audio.voice.needsInternet`, offline with a network voice) or "No Korean voice on this device. You say the sounds; the slides show them." (`voiceNone`). The voice name comes from `describeKoVoice()` and is never sent anywhere.
     - **Test the sound** (2026-10-17, F-TCH-004 section 3.7, F-AUDIO-004 row A-11): under the voice line, in the same row, a ghost pill "Test the sound" (`start.testSound.cta`, `touchTarget.min` tall, the row's text column, left-aligned). A tap says one Korean greeting (heard only, never printed) and the outcome appears under the pill in `text.secondary` body type, in a polite live region (`role="status"`): "Did you hear it? If not, turn up the volume." (`testSound.played`) or "The sound did not play here. You can say each word yourself." (`testSound.failed`); with the sound switched off, "Sound is off." (`learner.audio.soundIsOff`, the same `text.secondary` line) and under it the shipped **Turn sound on** pill (`learner.audio.action.turn_on.cta`), which switches it on and tests again. On a device whose row reads ready from the bundled recordings alone, the tap plays a letter's recording instead of the greeting. No glyph changes: the row's `check-circle` / `dash` still follows the voice check only, so a failed test never turns a ready voice into a "not ready" row, and the phone's Ready line never waits for a test. Nothing shows while the voice check runs. Shots: `presenter-start-test-sound-915x412`, `presenter-start-test-sound-played-915x412` (`audio-engine.spec.ts`, `HR_SHOTS=1`).
   - Full screen: "Full screen opens when you start" or "This browser has no full screen. The lesson still works."
   - Wake lock: "The screen stays on during the lesson" or "Keep the screen awake in system settings."
   - Skipped parts (only when `skipped.length > 0`): "6 parts of this lesson are not shown as slides." with **See which** (`aria-expanded`), which opens a list on `surface.sunken`: per part, the lesson that holds it (bold) and the reason line `start.reason.<SkipReason>` (README D10).
4. ~~**Helper picker** row~~ **Removed 2026-10-16** (`AMENDMENTS-LECTURE-V2.md` section 18.5, row LV-M1): no picker row, no count stepper, no noOpener or notKept line; a legacy deck's `picker` is ignored. Every start mock is redrawn without it.
5. **Start**: the one primary button (`brand.primaryDark`, 1.25 x hero tall, `size.display`), focused on arrival. While `document.fonts.load` runs (at most 1.5 s) it is disabled and "Getting the big letters ready" shows under it with a static `replay` glyph (no spinner motion).

## States drawn

ready (`start.html`), resumed, no Korean voice, not ready offline (offline and wake lock rows), skipped list open, font loading; the phone version below (`start-phone*.html`, which replaces the earlier "phone browser" state).

## Notes

- The page is the same on a projector before Start (`start-projected-*`); it is a teacher page, so it is not stage-scaled. The Start tap unlocks audio, fullscreen, the wake lock and landscape (section 3.5).
- ~~A 375 px window can still present (a phone on a TV): the stage then shows the too-small state (`states.md`) until the window is 600 px wide.~~ Superseded 2026-10-16: a phone sideways shows slides (`stage-and-bar.md` "Phone"); upright it shows the rotate page (`states.md`).

## Phone (owner report 2026-10-16; F-TCH-004 section 3.5 amendment; row LV-M1)

Wireframe `classroom/lecture-phone.md` Panels F (upright) and G (sideways). Rules in `mock/presenter-or.css`.

1. **Top row**: "Lecture mode" (`home.title`) and the **Display (Aa)** control at the top right (`common.display.*`, `AMENDMENTS-DISPLAY-NAV.md` section 3.6).
2. The deck title (h1, `size.hero`; `size.title` on a window under `layout.shortHeight`, 480, a phone sideways) and the facts line.
3. **One line**: the `check-circle` glyph and **Ready to start** (`start.ready`), with **Details** (`start.details.cta`, a disclosure with `plus` / `dash`, `aria-expanded`) on the same row. When a check is not ready, "Some checks need a look: see Details." (`start.someChecks`) under it (`start-phone-check-360x640.png`: an iPhone, no full screen, no wake lock). Details opens What's in this lesson, Before you start and the skipped parts exactly as on the wide page (`start-phone-details-360x640.png`).
4. **Turn hint**, only while upright: "Turn your phone sideways for the lesson." (`start.turnHint`) on `surface.sunken`, `text.secondary`; information, never a blocker.
5. **Sticky footer** (`.sticky-foot`): it stays at the bottom of the window while the page scrolls, on paper with a `border.subtle` rule: **Back** (`common.buttons.back`, secondary, left) and **Start** (primary, the rest of the row, at least `touchTarget.hero` tall; `touchTarget.child` on a window under 480 px tall, so the Ready line stays above the footer at 640 x 360). Start is focused on arrival; it is disabled during the font wait as on the wide page.

Measured: no sideways scroll at 360 x 640, 640 x 360 and 320 at 200 % text; nothing below 18 px; every control at least 64 px.
