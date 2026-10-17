# States: invalid link, loading, too small, portrait (screen spec v1)

Spec: F-TCH-004 sections 3.1, 3.2 (invalid), 3.6 (`tooSmall`; the phone exception, 2026-10-16), 3.8 (portrait) · wireframe L, `classroom/lecture-phone.md` E · PR 6; rotate page LV-M1
Mock: `mock/state-invalid.html`, `state-loading.html`, `state-too-small.html`, `state-portrait.html`, `state-rotate.html` · shots `state-invalid-1280x720.png`, `state-loading-1280x720.png`, `state-too-small-375x667.png`, `state-portrait-768x1024.png`, `state-rotate-360x640.png`

| State | Drawn |
|---|---|
| Invalid, oversize or wrong-version link, or a deck with zero slides | Hoya `thinking`, "This link does not work" (`size.display`), "Open a Quick lesson, or get a new link from the console page.", **Open Quick lesson** (primary, focused). Emits `lecture.deck_rejected`; the fragment is already gone from the address bar |
| Loading a large deck | Hoya `idle` and "Loading lesson" as a status line |
| Too small (`stageScale().tooSmall`, a stage box under 600 px wide; in a phone window under `PHONE_STAGE_MIN`, 560, amended 2026-10-16) | Hoya `thinking`, "Make the window bigger or turn the screen." and **Exit**; no slide is drawn, so floored text never overflows. A phone sideways (568 x 320 and up) no longer reaches this state (`stage-and-bar.md` "Phone") |
| **Rotate page** (a phone upright during a lesson: `isPhoneWindow` and taller than wide; LV-M1) | **Back** top-left (`common.buttons.back`; it opens the Exit confirm, F-TCH-004 section 3.5 "History" rule 4), Hoya `idle` at 1.5 x `touchTarget.hero`, "Turn your phone sideways" (`state.rotate.title`, `size.display`) and "The lesson shows when the phone is sideways. Nothing is lost." (`state.rotate.line`). Never a letterboxed strip. Turning the phone returns to the same slide and build; keys still advance the hidden slide (`state-rotate-360x640.png`) |
| Portrait wide enough (an iPad upright) | the stage letterboxed at the full width (unit 0.6) and a non-blocking pill "Turn the screen for a bigger view" at the top of the stage box; the bar wraps to two rows |
| Unknown path under `/present/…` | the presenter home (no 404) |
