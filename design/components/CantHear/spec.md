# CantHear: the "Can't hear it?" link and sheet (component spec v1)

Spec: `docs/specs/AMENDMENTS-AUDIO-CANT-HEAR.md` sections 3.1 to 3.11 (row CH-1a builds it; CH-1b to CH-1d place it)
· wireframe: `design/wireframes/minigame/audio-cant-hear.md` C1 to C9 · mock: `design/screens/audio-cant-hear/`
(row CH-0b; values, mock decisions MD1 to MD12 and shots there)
Code (to be written by CH-1a): `apps/mobile/src/components/CantHear.tsx` (paint and the focus order) ·
`logic/audio/cant-hear.ts` (`cantHearLine(family, copy)`, pure) · `logic/device-family.ts` /
`platform/device-family.ts` (`deviceFamily`, `currentDeviceFamily()`) · the slot in `components/use-prompt-slot.ts`
(`cantHear`, `cantHearActive`, `showLetters()`) · words `learner.audio.cantHear.*`, `learner.audio.hearIt.cta`,
`common.buttons.close`

## What it is

The way out when a sound "plays" but nothing is heard: the iOS silent mode, a media volume at zero, a muted page. The
app cannot detect these. A small link sits in the speaker row of every sound-only round. It opens a sheet with one
line for this device and two ways on: **Show the letters** (this round's text fallback) and **Hear it** (play once
more). It is help, never a gate. Nothing is scored, stored or marked wrong.

## Props

```ts
interface CantHearCommon {
  /** The surface's round index or key; a new value closes an open sheet (spec 3.3). */
  round: number | string;
  /** False while the round holds (`slot.cantHearActive`): the link is drawn, softDisabled. */
  active: boolean;
  /** Plays the prompt once through the surface's own hear function. */
  onHear: () => void;
  testID?: string; // default 'cant-hear'
}
/** A full sheet must say what Show the letters does and where focus goes. */
interface CantHearFull extends CantHearCommon {
  guidanceOnly?: false;
  /** Asks the slot for the text (`slot.showLetters()`); called one beat after focus moves (3.7). */
  onShowLetters: () => void;
  /** Where focus goes after Show the letters (the surface's target, spec 3.1 column "Focus after"). */
  focusAfter: RefObject<View>;
}
/** The cue rule and Discover: no Show the letters, Hear it primary. */
interface CantHearGuidance extends CantHearCommon {
  guidanceOnly: true;
}
type CantHearProps = CantHearFull | CantHearGuidance;
```

The surface renders `<CantHear …/>` only while `slot.cantHear` is true (no text up), so the link is gone whenever a
text shows. An open sheet closes when `slot.cantHear` turns false (a text arrived) or `round` changes.

## Anatomy

```
 speaker row:  (speaker)  Tap to replay  [ Can't hear it? ]        link: Button ghost sm (64)

 sheet:
 +--------------------------------------------+
 | Can't hear it?                        [x]  |   Heading prompt, header, first focus · Icon close 22 in a 64 target
 | (one line for this device)                 |   Body, text.primary
 | [[        Show the letters              ]] |   Button primary md fullWidth   (absent when guidanceOnly)
 | [     (speaker) Hear it                  ] |   Button secondary md fullWidth (primary when guidanceOnly)
 +--------------------------------------------+
```

## States

| State | Link | Sheet |
|---|---|---|
| round holds (`active` false) | drawn, `softDisabled`, announced as disabled | cannot open |
| ready | active | closed |
| open | active, under the scrim | title, close, one line, the buttons |
| pressed (link or buttons) | the design-system Button's pressed fill (ghost: `brand.primaryLight` with `brand.primaryDark` text) | — |
| text up (any reason, or asked) | not rendered | closed if it was open |
| guidance only | as above | no Show the letters; Hear it primary |

Empty state: a step with no rounds has no speaker and no link. Error state: a failed play is the PromptPanel's
`error` reason (Try again), not this component.

## Tokens

- **Scroll**: the title row and the line scroll as one; the buttons stay under them. When the body scrolls, a `border.strong` rule is drawn over the buttons, and the native cues are on: `persistentScrollbar` on Android, `flashScrollIndicators()` on open (mock MD11).

- **Link**: `Button tone="ghost" size="sm"`: `touchTarget.min` high, `bodySm` semibold, `brand.primary` with a 2 px border.
- **Scrim**: `colors.surface.overlay`.
- **Sheet**:
  - `surface.paper`, padding `spacing.lg`;
  - top corners `radii.xl`, max height 85 %;
  - full width, as `VoiceHelpSheet`. *Owner decision 2026-11-24 (mock MD6, README Q2): from window class `regular`, max width `layout.maxWidth.reading` (720), centred at the bottom; `DisplaySheet` caps at the same width but becomes a centred dialog.*
- **Spacing**: `Spacer sm` between the title row and the line, `Spacer lg` between the line and the buttons, `spacing.sm` between the two buttons.
- **Hear it glyph**: `Icon speaker` at `spacing.xl` (as `ClozePickGame.tsx:322`), in `text.onSecondary`, or `text.onPrimary` on a guidance-only sheet.
- **Never used**: `feedback.danger`, `feedback.nudge` / `nudgeLight`, and Hoya.

## Behaviour and accessibility

- **The link**: its name is its words; it has no hint. It comes after the speaker (and Hear again) and before the
  answers. The speaker row gains `flexWrap: 'wrap'`, so at 320, or with large text, the link drops under the caption.
- **Opening**: focus goes to the title. `Heading` takes no ref (`Heading.tsx`), so the title sits in a focusable
  wrapper `View` with a ref (as `MyStoryGame.tsx:237`; `tabIndex -1` on the web) that gets the focus.
- **The scrim** is a tap target for sight only, built as `ConfirmSheet.tsx`'s backdrop:
  - `accessible={false}` and `focusable={false}`;
  - `aria-hidden` and `importantForAccessibility="no-hide-descendants"`;
  - `accessibilityElementsHidden` and `tabIndex -1`.
  So it is neither read nor reached by Tab.
- **Closing**: Close, the scrim, Android back (`onRequestClose`) and, on the web, the browser back and Escape close
  the sheet. On the web this goes through `useHistorySheet(visible, onClose)` (`platform/history-bridge.web.ts`), as
  `DeviceDisplaySheet.tsx` does. Closing changes nothing else and returns focus to the link.
- **Show the letters**, in this order:
  1. The sheet closes (on iOS, the next step waits for the `Modal`'s `onDismiss`).
  2. `focusForScreenReader(focusAfter)`.
  3. After `motion.duration.slow`, `onShowLetters()`. On iOS, `announceForScreenReader` then says the text once.
- **Hear it**: the sheet closes, focus returns to the link, then `announceAndWait(cta, gapMs)` (`platform/screen-reader.ts`; the gap as F-CURR-001 D-1 S3b), then `onHear()`.
- **Nothing is recorded**: no answer, attempt, star or storage, except the CH-4 count if OD-CH2 is approved.

## Motion

The sheet uses the `Modal`'s `slide`, as `VoiceHelpSheet`; there is no other motion. The one beat before the text
comes up is `motion.duration.slow` (a timing, not an animation).

## Not in this component

What "the letters" are on each surface: that is the surface's own text fallback (spec 3.1). The Checks (CH-1e, waits
for OD-CH6). The hinted mark (CH-1f, waits for OD-CH7). The Always show the letters switch, which lives on Profile's
Sound card (row CH-2, `design/screens/audio-cant-hear/README.md`).
