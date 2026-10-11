# Later: speaking (roadmap note)

Committed with F-ROUTE-001 R-0 (`docs/specs/F-ROUTE-001-my-route-overview.md` section 10). Status: plan only. Nothing here is in scope for any screen now.

**Decision (owner, 2026-10-10).** Hangul Route focuses on **reading, listening and writing**. Speaking is not shown anywhere in the app's progress UI: no meter, no "coming" badge, no explanatory line, no "not measured" text. The tracked skills in F-ROUTE-001 are read, listen and write, and the minigame kind `voice-echo` maps to no tracked skill.

**Why not now.** No bundled quest has a speaking step, the Voice Echo placeholder is off (`flags.voiceEchoEnabled`, default `false`, `apps/mobile/src/config/flags.ts:30, 66`), and the app has no way to hear or check speech. Showing speaking in the UI would promise something the app does not do.

**Possible future work** (each needs its own spec and owner decision before any code):

1. **Pronunciation support through what exists.** Every taught item already carries romanization and native audio (CLAUDE.md section 1; F-CNT-002, F-AUDIO-004). A later spec may add spoken forms as listening aids, for example sound-change notes (국물 -> [궁물], romanized), without any scoring.
2. **Teacher- and parent-assisted practice.** Off-screen "say it together" activities for teachers (F-TCH-004 lecture mode) and parents, marked done by the grown-up, never scored by the app and never shown as a learner meter that can stay empty.
3. **Voice Echo as an honor-system step.** Only if the owner wants it: a step where the learner listens and repeats, credited as practice ("you tried it out loud"), never as accuracy.
4. **Speech recognition.** Only after the T-013 decision, a child-privacy review (no audio leaves the device without verifiable parental consent), and evidence that recognition works for young learners' Korean voices. A speaking row in `SKILL_OF_KIND` and in any progress view would be added then, as a new owner decision, following the anti-shame rules (meters only fill, no red-X, no ranking).

**Until then.** Specs and copy tests keep speaking words out of learner, caregiver and console strings for the progress features (F-ROUTE-001 section 3.13).
