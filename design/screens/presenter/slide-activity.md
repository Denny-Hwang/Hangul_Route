# Activity slide (screen spec v1)

Spec: F-TCH-004 sections 3.3 rule 8, 3.4 (`activity`), 3.5 (timer) · PR 7 (the timer it opens: PR 9)
Mock: `mock/slide-activity.html` (Write it in the air, 3 minutes) · shots `slide-activity-1280x720.png`, `-1920x1080`

## Anatomy

- Hoya `cheering` (240 units); "Activity" (kind label); the preset name (`learner.presenter.activity.<preset>`, the same values as `console.lecture.activity`) at `presenter.size.title`; "3 minutes" (`presenter.size.prompt`, `text.secondary`); **Start timer** (a stage button, `brand.primaryDark`, at least 96 px tall).
- Start timer opens the corner timer with the slide's minutes (`{ startTimer: ms }`); the timer never starts by itself. One build.
