# VoiceHelp: Sound card voice status, help sheet, `speaker-off` glyph (component spec v1)

Spec: `docs/specs/F-AUDIO-004-korean-voice-quality.md` §3.7 (Sound card second line), §3.13 (`speaker-off` goes through a design mock first), PR A-4b in §6 · wireframe: `design/wireframes/minigame/audio-fallback.md` W7 (Profile Sound card and the help sheet) and W3 (the "How to add a voice" link in the no-voice panel)
Code: `apps/mobile/src/components/VoiceHelpSheet.tsx` (sheet content) · `apps/mobile/src/components/SheetFrame.tsx` (the frame it shares with the "Can't hear it?" sheet: scrim, focus on the title, width cap, scroll cue) · `apps/mobile/src/screens/profile/ProfileScreen.tsx` (Sound card) · `apps/mobile/src/components/PromptPanel.tsx` (the link) · `apps/mobile/src/logic/audio/voice-help.ts` (pure view models and the steps, unit-tested) · copy in `logic/audio/copy.ts` · glyph in `packages/design-system/src/components/Icon/glyphs.ts`

## What it is

Three small pieces that answer one question a grown-up asks on a shared device: "why is there no sound?" The Sound card says whether this device has a Korean voice; when it has none, a plain sheet says how to add one. The text fallback (PromptPanel) keeps every game playable meanwhile, so the sheet is help, never a gate.

## 1. Sound card (Profile, wireframe W7)

```
 +---------------------------------------------+
 | [speaker]  Sound                      [ On ] |   switch row (one Pressable, role switch)
 |            Korean voice: ready               |   Caption, muted
 |  [ How to add a voice ]                      |   ghost Button, only when there is no voice
 +---------------------------------------------+
```

The switch row (glyph, label, voice line, pill) is one accessibility group: "Sound. Korean voice ready." (`a11y.soundSwitch`, built by `soundSwitchLabel`). The name does not say on or off: that state is the switch's own (`accessibilityState.checked`, and `aria-checked` for the web, which ignores `accessibilityState`), so a reader does not say it twice. The How-to button sits outside the switch so a tap on it never toggles the sound. Under the Sound switch, **Always show the letters** is a second device switch (`screens/profile/AlwaysShowLettersRow.tsx`, row CH-2).

| Voice state (`audio-store.tts`) | Voice line | How-to button |
|---|---|---|
| `unknown` | Looking for a Korean voice | no |
| `ready` | Korean voice: ready | no |
| `none` / `offline_network_only` | Korean voice needs the internet | yes |
| `none` / `no_korean_voice`, `no_engine` | No Korean voice on this device | yes |

| Sound | Glyph | Colour |
|---|---|---|
| on | `speaker` | `colors.brand.primary` |
| off (muted) | `speaker-off` | `colors.text.muted` |

Tokens: existing `Card` (padding `md`, default tone), `Body` semibold for the label, `Caption` tone `muted` for the voice line, `Pill` (`success` on, `neutral` off), `Button` tone `ghost` size `md` (`touchTarget.min` 64). The row keeps `minHeight: touchTarget.min`. No literals.

## 2. Help sheet "Add a Korean voice" (W7)

*Revised 2026-11-24 by AMENDMENTS-AUDIO-CANT-HEAR row CH-0b (spec section 3.9; built by CH-1a):*
- *one device's section only;*
- *the scrim leaves the accessibility tree;*
- *focus starts on the title;*
- *owner decision 2026-11-24: from window class `regular` the sheet's width is capped at 720 (mock MD6, README Q2).*

*Mock: `design/screens/audio-cant-hear/` (H1 to H3; mock decisions MD6 and MD11).*

*Amended 2026-11-25 by AMENDMENTS-AUDIO-CANT-HEAR [CH]: built by CH-1a (#1090). `VoiceHelpSheet` passes `currentDeviceFamily()` to `voiceHelpContent`, so it draws one section; both sheets sit in the shared `SheetFrame` (`components/SheetFrame.tsx`): the scrim is a tap target for sight only and not an accessibility element, focus starts on the title, and the width is capped at 720 from window class `regular`. The Sound card's switch name no longer says on or off (§1).*

A bottom sheet over a dimmed screen (`colors.surface.overlay`), plain text, scrolls.

```
 +--------------------------------------------+
 | Add a Korean voice                    [x]  |   Heading prompt + close (Icon close, 64 target)
 | Menu names can differ on your device.      |   Caption, muted
 |                                            |
 | iPhone or iPad                             |   Body semibold: this device's section only
 |  1. Open Settings, then Accessibility.     |   Body
 |  2. Tap Spoken Content, then Voices, then  |
 |     Korean.                                |
 |  3. Download a voice, such as Yuna. ...    |
 |  4. Come back and reopen Hangul Route.     |
 |                                            |
 | You can still play: the sound is written   |   Body, secondary
 | on screen.                                 |
 | [[ OK ]]                                   |   primary Button, md
 +--------------------------------------------+
```

- Sections are static text per device family (`learner.audio.voiceHelp.sections`). **Only this device's section shows** (revised 2026-11-24, spec 3.9, review item P2-22, WO-37 NB-7): `VoiceHelpSheet` passes `currentDeviceFamily()` (`platform/device-family.ts`) to `voiceHelpContent(copy, family)`. The family rule:
  - an iPhone or iPad, in the app or the browser, is `apple`;
  - Android is `android`;
  - anything else is `computer`.
  On the web the family comes from the user agent, because `Platform.OS` is `'web'` in every browser. Title, note and footer do not change. *Before: all three families showed, so that a grown-up setting up another device read the right one. The cost of the change: that grown-up now reads that device's steps on that device.*
- Closing: OK, the close icon, a tap on the dimmed area, or Escape / hardware back (`onRequestClose`). Focus returns to the control that opened it.
- The dimmed area is **not** an accessibility element (revised 2026-11-24): it was a second "Close" button for a screen reader (`VoiceHelpSheet.tsx:26-32`). It stays a tap target for sight only, built as `ConfirmSheet.tsx`'s backdrop: `accessible={false}`, `focusable={false}`, `aria-hidden`, `importantForAccessibility="no-hide-descendants"`, `accessibilityElementsHidden` and `tabIndex -1`.
- Width: full width, as today. *Owner decision 2026-11-24 (mock MD6, README Q2): from window class `regular` (600), capped at `layout.maxWidth.reading` (720) and centred at the bottom, the same as the "Can't hear it?" sheet (`design/components/CantHear/spec.md`).*
- Scroll (revised 2026-11-24): the title row, the note, the steps and the footer scroll as one, and OK stays under them. When they scroll, a `border.strong` rule is drawn over OK, with the native scroll cues (mock MD11).
- Steps (verified against Apple, Google and Microsoft help pages on 2026-10-10; menu names still vary by OS version, which is why the sheet says so):
  - iPhone or iPad: Settings > Accessibility > Spoken Content > Voices > Korean > download a voice (Yuna, or one marked Enhanced or Premium). Then reopen the app.
  - Android: Settings > System > Languages & input (or Accessibility) > Text-to-speech output > Speech Services by Google > gear > Install voice data > Korean. Then reopen the app.
  - Computer: Mac, System Settings > Accessibility > Spoken Content > System Voice > Manage Voices > Korean. Windows, Settings > Time & language > Speech > Manage voices > Add voices > Korean. Chrome and Edge: also check you are online (some Korean voices need the internet).
- A voice added while the app is open is picked up when the browser reports it (`voiceschanged`); otherwise reload the page. The sheet's last step says so: "Come back and reopen Hangul Route." (iPhone or iPad, Android) or "Reload this page." (computer).

Accessibility: `role` dialog, modal, titled by the heading; focus enters the sheet on the title (a header; revised 2026-11-24, spec 3.9 and 3.7), then the close button; text >= 18; at 200 % text the sheet grows and scrolls, the OK button stays reachable (sticky under the scroll area). No emoji, no red, no age words.

Tokens: sheet surface `colors.surface.paper`, top radius `radii.xl`, padding `spacing.lg`, section gap `spacing.md`, scrim `colors.surface.overlay`, max height 85 % of the window.

## 3. "How to add a voice" in the no-voice PromptPanel (W3)

When the panel's reason is `no_voice`, a `ghost` text button "How to add a voice" sits under the detail line and opens the same sheet (the sheet returns to its caller; the game state is untouched). Not shown for `muted`, `error` or `blocked`. See `design/components/PromptPanel/spec.md`.

## 4. Glyph `speaker-off` (24 x 24 grid, stroke 2.6 where stroked, filled solids)

The `speaker` body (the same solid cone, so the pair reads as one family) with the sound waves replaced by a small cross to its right.

```
 speaker:      body  M4 9 H8 L13 5 V19 L8 15 H4 Z    + two wave arcs
 speaker-off:  body  M4 9 H8 L13 5 V19 L8 15 H4 Z    + stroke M16 9.5 L21 14.5, stroke M21 9.5 L16 14.5
```

- It is a mute sign, drawn in `colors.text.muted`, never red; it is not the "wrong answer" mark (that is amber and a different shape language).
- Added to `IconName` and `iconGlyphs`; the existing glyph tests (distinct, in-bounds, stroke band 1.5 to 3) cover it.
- Minimum size 24; the Sound card uses 24.

## Copy (Pre-A1, calm, English until F-I18N-001's catalog)

Add a Korean voice · Menu names can differ on your device. · iPhone or iPad · Android · Computer · How to add a voice · You can still play: the sound is written on screen. · OK · Korean voice: ready · No Korean voice on this device · Korean voice needs the internet · Looking for a Korean voice.

## Not in this component

Lecture mode's "Check this device" row (F-TCH, reads `describeKoVoice()`); picking a voice by hand (spec §4 out of scope); any voice name on screen or in telemetry.
