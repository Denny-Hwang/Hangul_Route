# Start screen: deck facts, device checks and Start (screen spec v1)

Spec: F-TCH-004 sections 3.2 (roster hand-off steps 2 and 5), 3.5 (states), 3.6 (font wait), 3.7, 3.8 · wireframe B · PR 6
Mock: `mock/start.html` and `start-{numbers,resumed,novoice,notready,skipped,loading,phone}.html` · shots `start-375`, `-1280`, `-320-text200`, `start-*-375`, `start-projected-1280x720`, `-1920x1080`
Code: `screens/presenter/StartScreen.tsx` (PR 6)

## Anatomy (top to bottom, `layout.maxWidth.reading`, centred)

1. **Back to lessons** (`start.back.cta`, a ghost pill, PR 8): back to the presenter home before Start; the tab forgets the held deck and nothing is saved to Recent or sent. Then "Lecture" (`learner.presenter.home.title`, `text.secondary`), then the deck title as h1 (`size.hero`, teacher text, wraps anywhere).
2. Facts: "71 slides · about 56 minutes" (`start.slides`, `start.minutes`; plural keys; the separator is a middle dot between two whole strings).
3. **Before you start** (h2) and the checks list. Each row: a `check-circle` glyph in `feedback.success` when ready, a `dash` glyph in `text.secondary` when not, and one sentence. None blocks Start.
   - Offline: "Ready for offline" or "Open this page once with Wi-Fi to use it offline." with the plain-text install hint under it, "You can also add it to the home screen from the browser menu." (`start.installHint`, section 3.8; `InstallGuideSheet` is not mounted) (`isOfflineReady()`).
   - Voice: "Korean voice: Yuna, on this device" (`voiceLocal`), "... uses the internet" (`voiceNetwork`), "Korean voice needs the internet" (existing `learner.audio.voice.needsInternet`, offline with a network voice) or "No Korean voice on this device. You say the sounds; the slides show them." (`voiceNone`). The voice name comes from `describeKoVoice()` and is never sent anywhere.
   - Full screen: "Full screen opens when you start" or "This browser has no full screen. The lesson still works."
   - Wake lock: "The screen stays on during the lesson" or "Keep the screen awake in system settings."
   - Skipped parts (only when `skipped.length > 0`): "6 parts of this lesson are not shown as slides." with **See which** (`aria-expanded`), which opens a list on `surface.sunken`: per part, the lesson that holds it (bold) and the reason line `start.reason.<SkipReason>` (README D10).
4. **Helper picker** row (absent when `deck.picker` is null): title, then
   - names or initials received from the console tab: "12 names received" / "12 initials received" (a count only; no label is ever listed here);
   - no opener (a copied, typed or bookmarked link): "Numbers 1 to 12" and "Names come from the console page that opened this lesson. Using numbers." with a stepper (`dash` / `plus` icon buttons named Fewer / More, the count in an `output`, 1 to 60);
   - a lesson resumed from Recent: the same with "Names are not kept on this device. Using numbers." (section 3.5 Exit);
   - a deck that asked for numbers (`deck.picker.mode` is `numbers`, as a Quick lesson or a [ Present this ] deck sends): only "Numbers 1 to 12" and the stepper, with no noOpener or notKept line, because no names were ever expected.
5. **Start**: the one primary button (`brand.primaryDark`, 1.25 x hero tall, `size.display`), focused on arrival. While `document.fonts.load` runs (at most 1.5 s) it is disabled and "Getting the big letters ready" shows under it with a static `replay` glyph (no spinner motion).

## States drawn

names received (`start.html`), numbers without an opener, resumed, no Korean voice, not ready offline (offline and wake lock rows), skipped list open, font loading, a phone browser without full screen or wake lock (`start-phone.html`).

## Notes

- The page is the same on a projector before Start (`start-projected-*`); it is a teacher page, so it is not stage-scaled. The Start tap unlocks audio, fullscreen, the wake lock and landscape (section 3.5).
- A 375 px window can still present (a phone on a TV): the stage then shows the too-small state (`states.md`) until the window is 600 px wide.
