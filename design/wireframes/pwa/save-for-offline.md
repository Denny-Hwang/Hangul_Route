# PWA/Save for offline — the Offline lessons card and a later volume offline (wireframe v1, web only)

Spec: `docs/specs/F-CURR-002-category-expansion-and-mastery.md` §10 item 4 and row CM-5B (decision record "row CM-5B"); `docs/specs/AMENDMENTS-AUDIO-CLIPS.md` AC-B6 ("the Save for offline pack of CM-5B includes the stage's audio pack") and G5.
Audience: **grown-up** for the card (the Grown-up area, behind the PIN; plain words, may address the grown-up), **learner** for the one line on a later volume's page (Pre-A1, calm, no blame).
Mock: `design/screens/app-shell/save-for-offline.md`.

## Scenario (Given-When-Then)

Given: the web app is installed or opened once with the internet (a service worker in control), and the build has later volumes (a cell's Volume 2, Stage 5's book 2)
When: a grown-up opens the Grown-up area, or a learner opens a Volume 2 page with no network
Then: the grown-up sees what is always offline, each stage's later volumes with their size, and can save or remove them; the learner sees one calm line that the volume needs the internet the first time, never a crash

## Screen goal

"Say what works offline, let a grown-up keep more, and never surprise a learner with a broken lesson."

## Box diagram

```
A. Grown-up area, below the Lecture mode card (web only)
+------------------------------------------+
| Offline lessons                     (H)  |
| Stage 1 and the first volume of every    |
| stage are always on this device. Save    |
| later volumes here to use them without   |
| the internet.                            |
| A volume opened once with the internet   |  <- muted caption
| is kept for offline too.                 |
| [offline: "You are offline. Saving       |  <- only while offline
|  needs the internet."]                   |
|------------------------------------------|
| Stage 2: Words              [ Save ]     |  <- one row per stage with
| About 0.4 MB · Not saved yet             |     a later volume
|------------------------------------------|
| Stage 5: Stories   [ Save ] [ Remove ]   |  <- partly: both
| About 0.1 MB · Partly saved              |
|------------------------------------------|
| Stage 6: Sentences         [ Remove ]    |  <- saved: Remove only
| About 0.3 MB · Saved on this device      |
|------------------------------------------|
| [[            Save all            ]]     |  <- only with 2+ rows not saved
| Saving: 0.2 of 0.4 MB                    |  <- polite live region, while saving
| Space left for this app: about 950 MB    |  <- when the browser gives an estimate
+------------------------------------------+

B. A Volume 2 page, offline, not saved and not loaded this session
+------------------------------------------+
| < Back                              Aa   |
| (Words) (Nature & Animals)               |
| ( Vol 1 ) [ Vol 2 ]                      |
| +--------------------------------------+ |
| | This volume needs the internet the   | |  <- sunken card, secondary text
| | first time. After that, it works     | |
| | offline too.                         | |
| +--------------------------------------+ |
| Outdoor Words 2                          |
| ...                                      |
| (1) Outdoor Words                        |
|     ( ) Needs the internet               |  <- words, never a disabled button
+------------------------------------------+
```

## Rules

- Always offline (precached): Stage 1, the first volume of every cell, every shelf and book 1 tale, the start-up chunks, the jamo-s1 clips. Later (runtime-cached on first use, or saved here): each cell's Volume 2, each tale only a book 2 holds, and with a saved stage its audio pack (`stage<n>`).
- One row per stage that has a later volume; nothing else is listed. The size is the whole stage pack in decimal MB, one decimal, never "0 MB".
- States: **Saved on this device** (every file is in), **Partly saved** (some are: a lesson opened online once, or an update changed a file), **Not saved yet**.
- Save keeps the choice on this device; after an app update the chosen stages are saved again in the background (before the update applies, and again once it runs). Remove forgets the choice and frees the space; a clip another saved stage shares stays.
- A save that would not fit (the browser's estimate) does not start; it says so. A save that stops keeps what it saved.
- Problems are one plain line in the card, secondary tone, never the danger colour: no internet, no space, or an app update (reload).
- The card is device-wide (the caches are the browser's), so it sits outside the learner cards.

## States

- **success**: A and B as drawn.
- **empty** (no later volume in the build; native app, where everything is in the app; a page with no service worker in control, such as the iOS 14 home-screen issue or an in-app webview): no card. The rest of the area is unchanged.
- **loading**: no card until the index and the caches are read (a few ms, from the precache).
- **saving**: every Save, Save all and Remove is disabled; the progress line counts up.
- **offline**: the offline line shows; Save and Save all are disabled; Remove still works.
- **error**: the last problem's line under the rows; Save stays available to try again.
- **learner, online**: no line; Start as always. **learner, offline, volume saved or opened before**: no line; it plays.

## Data needs

- reads: `/offline-packs.json` (precached, written by the build: each stage's files, bytes and cache), Cache Storage (`caches.match`), `navigator.storage.estimate()`, `navigator.onLine`, the device record `device:offline-saved` (the chosen stages)
- writes: Cache Storage (`hr-later-v1` for later chunks, `hr-offline-audio-v1` for clips: neither expires, and the clip rules read the second on a miss), `device:offline-saved`; asks for persistent storage on Save
- telemetry: none in this row (no new event names; Worker first applies if one is added later)

## Accessibility

- Each Save and Remove is named with its stage ("Save: Stage 2: Words"), so a screen reader never hears a list of bare "Save" buttons.
- Rows are at least the touch target high and wrap at 320 px and at the Largest text size; the buttons drop under the row's text.
- The progress and problem lines are a polite live region.
- The learner line is plain text in a sunken card, read in order after the volume tabs; the "Needs the internet" row text uses the closed row's pattern (a dotted pip and words), never a disabled button.
