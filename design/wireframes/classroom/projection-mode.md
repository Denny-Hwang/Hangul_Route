# Classroom/Projection-Mode — teacher-only display toggle (wireframe v1)

Spec: `docs/specs/F-TCH-001-teacher-classroom.md` §3.4 (draft) · `docs/blueprints/02-core-feature-spec.md` §6 (Classroom / Projection)
Audience: **teacher** (a `teacher`-role profile on a mobile device driving a classroom TV); the students watch the projected screen and are not the interacting user

## Scenario (Given-When-Then)

Given: a teacher-role profile is active on the device that is mirrored to the classroom screen
When: the teacher flips "Projection mode" in settings
Then: every following screen renders at 200 % font scale with tap targets ≥ 128 dp and louder audio, plus a small pause / next control bar — and the flag clears when the teacher profile is exited

## Screen goal

"Make one device readable from the back of the room, for this session only."

## Box diagram

```
A. settings row (only when the active role is teacher)
+----------------------------------+
| [<- back]  Settings              |
|   ...existing rows...            |
|   ----------------------------   |
|   Classroom                      |  <- section only for teacher
|   [ Projection mode      (off) ] |  <- toggle row
|   "Bigger text and buttons for   |
|    a classroom screen. Turns     |
|    off when you leave this       |
|    profile." (helper line)       |
+----------------------------------+

B. any screen while projection is on (quest/player shown)
+----------------------------------+
| [<- back]           [PROJ]       |  <- persistent chip so the
|                                  |     teacher knows it is on
|                                  |
|   BIGGER PROMPT (200% scale)     |
|                                  |
|   +------------+ +------------+  |
|   |            | |            |  |  <- targets >= 128 dp; grid
|   |  choice    | |  choice    |  |     may drop from 4 to 2 per
|   |            | |            |  |     row to keep them on screen
|   +------------+ +------------+  |
|                                  |
|  +----------------------------+  |
|  | [pause]  [play]  [next >]  |  |  <- teacher control bar,
|  +----------------------------+  |     docked bottom, on-screen
+----------------------------------+
```

- The toggle lives in a "Classroom" section that does not exist for learner or parent roles; a child can never find it.
- Panel B is not a new screen. It is a rendering mode: existing screens pick up the scale from a per-device flag through the design-system tokens (`fontScale`, `touchTarget`). Layouts must reflow (fewer columns) rather than overflow.
- The control bar is presentation only (F-TCH-001 §3.4): it pauses timers/audio, replays the current prompt, and advances — it never answers on the students' behalf. Student prompts on screen are unchanged.
- No student names or roster data appear in projection mode: the projected surface is the ordinary learner flow, so nothing anti-shame-sensitive is introduced.

## Interaction points

- Toggle on → no confirmation; flag set; a short Hoya line ("ready for the big screen") and the [PROJ] chip appears on all screens
- Toggle off → flag cleared; layout returns to normal on the next render
- [PROJ] chip tap → `profile/settings` (jumps to the Classroom section)
- [pause] / [play] → freezes / resumes round timers and audio in `minigame/shell`; input stays enabled so a volunteer student at the device can still answer
- [next >] → advances to the next round / step, marking the current one `skipped` (not wrong) if unanswered
- Profile exit (`profiles/switch-button` or `profiles/picker`) → flag reset automatically, no prompt

## Navigation graph

Enter from: `profile/settings` (Classroom section, teacher role only)
Exit to:    `profile/settings` (toggle off / chip tap) · any learner screen continues as normal with the mode applied · `profiles/picker` (profile exit resets the flag)

## States

- **success**: toggle on → all screens scaled, chip visible, control bar docked on quest/minigame screens only.
- **empty** (active role is learner or parent): the Classroom section is not rendered; no hidden or disabled toggle, simply absent. Teacher role with the `classroom.enabled` flag off: same — absent.
- **error** (a screen cannot reflow at 200 % — content clipped): that screen falls back to 150 % with a small warning glyph on the chip; logged as `projection.reflow_failed` (screen id) so the layout gets fixed. Audio boost unavailable on the platform (web): silently skipped, no error surfaced.
- **rotation**: projection mode is the one context where landscape is expected (TV mirroring); the PWA portrait guard (`pwa/system-banners` panel 4) is suppressed while the flag is on.

## Data needs

- reads: active profile role (F-PROF-001, `teacher` reserved) · feature flag `classroom.enabled` · per-device projection flag (local, not part of `ProgressSnapshot`, never synced) · `logic/projection/scale` for font, volume and target math
- writes: per-device projection flag (set / clear) · nothing to the learner's progress; rounds advanced via [next >] are recorded as `skipped`
- telemetry: `projection.enabled | disabled` (reason: toggle | profile_exit), `projection.control` (pause | play | next), `projection.reflow_failed`

## Open questions

- F-TCH-001 §5 lists this wireframe as `design/wireframes/teacher/projection-mode.md`; the app map places it at `classroom/projection-mode` (this file). Update the spec's §5 path list when F-TCH-001 is promoted.
- Whose progress does a projected quest write to? The teacher profile has no journey. Options: a throwaway "class demo" learner, or no writes at all in projection mode. (recommend no writes — the roster must never show the teacher's demo run as a student)
- Audio +6 dB (spec) is a platform capability question: iOS caps media volume at the system level, so "louder" may only be achievable with louder assets. Confirm with the platform lane before promising it.
- Should the control bar also exist for a parent driving a shared tablet with two siblings? Out of scope for F-TCH-001, but the same component would work — note for an F-PAR-001 follow-up.
