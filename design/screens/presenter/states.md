# States: invalid link, loading, too small, portrait (screen spec v1)

Spec: F-TCH-004 sections 3.1, 3.2 (invalid), 3.6 (`tooSmall`), 3.8 (portrait) · wireframe L · PR 6
Mock: `mock/state-invalid.html`, `state-loading.html`, `state-too-small.html`, `state-portrait.html` · shots `state-invalid-1280x720.png`, `state-loading-1280x720.png`, `state-too-small-375x667.png`, `state-portrait-768x1024.png`

| State | Drawn |
|---|---|
| Invalid, oversize or wrong-version link, or a deck with zero slides | Hoya `thinking`, "This link does not work" (`size.display`), "Open a Quick lesson, or get a new link from the console page.", **Open Quick lesson** (primary, focused). Emits `lecture.deck_rejected`; the fragment is already gone from the address bar |
| Loading a large deck | Hoya `idle` and "Loading lesson" as a status line |
| Too small (`stageScale().tooSmall`, a stage box under 600 px wide) | Hoya `thinking`, "Make the window bigger or turn the screen." and **Exit**; no slide is drawn, so floored text never overflows |
| Portrait wide enough (an iPad upright) | the stage letterboxed at the full width (unit 0.6) and a non-blocking pill "Turn the screen for a bigger view" at the top of the stage box; the bar wraps to two rows |
| Unknown path under `/present/…` | the presenter home (no 404) |
