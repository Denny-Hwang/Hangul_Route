# PromptPanel (component spec v1)

Spec: `docs/specs/F-AUDIO-004-korean-voice-quality.md` §3.8 and PR A-5a in §6 · wireframe: `design/wireframes/minigame/audio-fallback.md` screens W2, W3, W4 (state machine W8) · Korean content is drawn with `design/components/KoreanText/spec.md`
Code: `apps/mobile/src/components/PromptPanel.tsx` (paint), `use-prompt-slot.ts` (hook), `apps/mobile/src/logic/audio/prompt-view.ts` (pure view model, tested), copy in `logic/audio/copy.ts`

## What it is

The one visible text fallback for a sound prompt: when a letter's sound cannot be heard (sound is off, no Korean voice on the device, the browser blocked the sound, the engine failed) the learner reads the same sound on screen and plays on. Match Sound uses it now; Discover, Listen & Pick and the story chips reuse it. It is a panel, not a dialog: it never takes focus and nothing about it looks like a miss.

## Anatomy

```
 +------------------------------------+
 |             가   (KoreanText md)   |   spoken syllable, taught content
 |             ga                      |   its romanization (D2)
 |     No sound? Read it here.        |   body, muted
 |     Sound is off.                  |   caption, muted: why (not for "blocked")
 |        [ Turn sound on ]           |   secondary button, only when there is an action
 +------------------------------------+
```

**Korean already on screen** (the story reader's Korean block, F-STORY-002 §3.4): the screen passes no `ko` / `romanization`, and the panel shows only the read line, the reason and the action, directly under the Korean it refers to, so the Hangul is never drawn twice. Unlike the status variant below, it shows as soon as the text does (on a scene's opening, before any play), because the reader's "No Korean voice" line and help link must be there from the start (F-STORY-002 §3.14 row 7):

```
 +------------------------------------+
 |     No sound? Read it here.        |
 |     No Korean voice on this device.|
 |        [ How to add a voice ]      |
 +------------------------------------+
```

The speaker button stays on the screen that owns the prompt (Match Sound keeps its own); the panel never replaces it. Its label states the state ("Play sound", "Play sound, sound is off", "Tap to hear").

## States (from `promptPanelView`)

| Reason | Detail line | Action | Heading above the speaker |
|---|---|---|---|
| `muted` | Sound is off. | Turn sound on | Tap the letter for this sound |
| `no_voice` | No Korean voice on this device. | none (a ghost link **How to add a voice** opens the help sheet) | Tap the letter for this sound |
| `error` | The sound did not play. | Try again | Tap the letter you hear |
| `blocked` | none (the speaker reads "Tap to hear") | Tap to hear | Tap the letter you hear |
| none (sound turned back on, text kept for the round) | none | none | Tap the letter for this sound |

Not shown while the voice check is still running (no flash). Once shown it stays for the round and resets with the next round.

## Status variant (`variant="status"`, PR A-5b)

For a screen that already prints the Korean and its romanization next to its speaker: Build Letter (the syllable box), Card Match (each word card), Tap & Respond (the NPC line and the reply buttons), Culture Quiz (the prompt word), Voice Echo (the word under the speaker) and the card detail (the card's Korean name). That printed line is the text fallback, so the panel does not repeat it.

```
 +------------------------------------+
 |     Sound is off.                  |   body, muted: why (not for "blocked")
 |        [ Turn sound on ]           |   secondary button, only when there is an action
 +------------------------------------+
```

- Shown only after the slot has tried to play (the learner tapped the speaker, or the screen said its prompt on open, as Tap & Respond does), and only when it has something to say (`promptPanelView(...).statusShown`). A muted device does not get a "Sound is off" line on every screen it never asked to hear.
- Same reasons and actions as the table above; the "No Korean voice" reason shows the **How to add a voice** link.
- `audio.fallback_shown` fires when this panel appears (`usePromptSlot({ textOnScreen: true })`), not when the slot first learns sound is off.
- The detail line is `Body` (not `Caption`), since it is the panel's only line.

## Compact status (`variant="status" compact`, 2026-10-17)

For a screen that must keep its own controls on screen and must not shrink its drawing surface by a whole card: Trace Stroke and Trace a Word (their canvas is sized from the height the controls leave, and Done and Skip always stay in view, UX-09). Same reasons, actions, timing and telemetry as the status variant; only the paint differs:

```
 Sound is off.  [ Turn sound on ]          one wrapping row, no card
 No Korean voice on this device.  [ How to add a voice ]
```

- No `Card`: the detail is a `Caption` (muted), the action a `Button` secondary size `sm`, the help link a `Button` ghost size `sm` (both `touchTarget.min` 64 high), in one row that wraps under 200 % text.
- The row carries its own top space (`spacing.sm`), so the always-mounted live region takes no height while nothing is shown.
- In the side-by-side layout the prompt column above the controls scrolls if the row makes it too tall, so Done and Skip stay on screen.
- The row appears after the learner asked to hear (Show me, a block speaker), never from a round's opening sound.
- While a finger is on the canvas the screen passes the view it had when the stroke began (`useHeldWhile`, `components/use-held-while.ts`): a late result waits for the finger to lift, so the row never appears or goes mid-stroke and the canvas never moves under the finger. Wireframe: `design/wireframes/minigame/audio-fallback.md` W10.

## Tokens (no literals)

| Part | Token |
|---|---|
| Surface | `Card` tone `paper`, elevation `flat`, padding `lg` (neutral card tone; no red, no amber, no X) |
| Gap between lines | `spacing.sm` |
| Hangul + romanization | `KoreanText` size `md` |
| Lines | `Body` (18 floor) and `Caption`, `colors.text.muted` via the `tone` prop |
| Action | `Button` secondary, size `md` (`touchTarget.min` 64) |

## Accessibility

- The wrapper is a polite live region that stays mounted, so the arrival of the text is announced; focus does not move.
- No audio-only information: the panel is the text of the sound.
- Button label is the visible label; targets at least 64.
- Under 200 % text the card grows and the tiles below wrap (F-LAYOUT-001).

## Copy

English until F-I18N-001's catalog exists (`logic/audio/copy.ts`, then `learner.audio.*`). Pre-A1, no emoji, no age words.

## Not in this component

The sheet itself and the Profile Sound card line (`design/components/VoiceHelp/spec.md`, A-4b); Discover's Letter name chip (F-QUEST-002).
