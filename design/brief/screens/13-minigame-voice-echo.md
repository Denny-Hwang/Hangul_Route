# Screen 13 — Minigame · Voice Echo (placeholder UI)

**Interaction family ⑦.** Listen, say it out loud, tap "I said it."

## 1. Context

Real STT grading is deferred. v1 ships an honor-system version: TTS plays the prompt, child speaks aloud, taps a big checkmark when done. The visual must telegraph "we trust you" — not "we're listening."

## 2. Layout

```
┌─────────────────────────────────────┐
│  Say it out loud  (centered title)   │
│                                      │
│          ┌─────────────────┐         │
│          │       🔊        │         │
│          │      안녕       │         │
│          │   (tap to hear) │         │
│          └─────────────────┘         │
│                                      │
│ 🐯 Listen to me, then say it back    │
│    out loud. Tap 'I said it' when    │
│    done.                             │
│                                      │
│ ┌────────────────────────────────┐ │
│ │ ✓ I said it!                    │ │
│ └────────────────────────────────┘ │
│ Voice grading is coming soon — for   │
│ now it's honor system 🐯              │
│                                      │
│ [Continue]                           │
└─────────────────────────────────────┘
```

## 3. Visual style

- Big circular tap-to-hear target: 200×200, brand-primaryLight fill with primary border, speaker icon + Korean prompt centered
- HoyaBubble idle below with instructions
- "I said it" checkbox row — large tappable, success-tint when checked
- Footnote in caption muted (sets expectation)
- Continue CTA hero primary (disabled until checkbox)

## 4. Exact copy

- Title: **"Say it out loud"**
- Hoya line: **"Listen to me, then say it back out loud. Tap 'I said it' when done."**
- Checkbox label: **"I said it!"**
- Footnote: **"Voice grading is coming soon — for now it's honor system 🐯"**
- CTA: **"Continue"**

## 5. Claude Design prompt

```prompt
Design the Voice Echo minigame screen for Hangul Route. Output: 1170 ×
2532 PNG showing the IDLE state (checkbox unchecked, CTA disabled).

Layout (top to bottom, 48px horizontal padding):

1. 60px status bar
2. 96px top gap (no progress bar — this is single-prompt)
3. Title "Say it out loud" — 84sp weight 700 #2A1F14 center-aligned
4. 36px gap

5. Big tap-to-hear circle (centered):
   - 600 × 600 sp circle, fill #FAD9C6 (brand light), 9px border
     #E8743B (primary), full circle radius
   - Inside (vertical stack centered):
     • Speaker icon 192 × 192 sp (64dp at 3x) color #2A1F14
     • 24px gap
     • Korean prompt "안녕" — 84sp weight 700 #2A1F14

6. 48px gap

7. HoyaBubble idle: fill #FFFFFF, 6px border #E8DFCD, 72px radius,
   48px padding, 216sp Hoya IDLE + "Listen to me, then say it back out
   loud. Tap 'I said it' when done." — 60sp weight 600

8. Flex space

9. Big checkbox row (tappable rectangle):
   - Full-width, 240sp tall, fill #FFFFFF (unchecked) / #D6EFDF
     (checked), 6px border #E8DFCD / #4FA871, 48px radius (lg)
   - Left padding 48px: 84 × 84 sp checkbox square, 6px border
     #C5B8A1 / #4FA871, fill transparent / #4FA871. When checked, a
     white check icon inside.
   - 48px gap
   - Label "I said it!" — 60sp weight 600 #2A1F14

   For this render, show the UNCHECKED state.

10. 24px gap

11. Footnote (center-aligned): "Voice grading is coming soon — for now
    it's honor system 🐯" — 42sp #8A7860 italic

12. 36px gap

13. Primary CTA disabled state: full-width 288sp tall pill, fill
    #F2EBDE (disabled bg), label "Continue" 66sp weight 600 #8A7860,
    opacity 0.6

14. 72px bottom safe-area

Background: warm hanji cream #FCF8F1.

Anti-patterns:
- Recording icon (microphone) anywhere — we're NOT recording in v1
- "Listening…" UI — we're not listening
- Red checkbox when unchecked
- CTA enabled when checkbox unchecked
- Footnote in body size (must be caption)

Deliverable: 1170 × 2532 PNG.
```

## 6. Acceptance checklist

- [ ] Big tap-to-hear circle (60dp+ touch)
- [ ] Checkbox visibly unchecked
- [ ] CTA disabled state (opacity 0.6)
- [ ] Footnote sets expectation about honor system
- [ ] NO microphone icon anywhere (we're not recording)

## 7. Output path

- `design/screens/minigames/voice-echo__v1__YYYY-MM-DD.png`
