# VoiceHelp: Sound card voice status, help sheet, `speaker-off` glyph (component spec v1)

Spec: `docs/specs/F-AUDIO-004-korean-voice-quality.md` §3.7 (Sound card second line), §3.13 (`speaker-off` goes through a design mock first), PR A-4b in §6 · wireframe: `design/wireframes/minigame/audio-fallback.md` W7 (Profile Sound card and the help sheet) and W3 (the "How to add a voice" link in the no-voice panel)
Code: `apps/mobile/src/components/VoiceHelpSheet.tsx` (sheet paint) · `apps/mobile/src/screens/profile/ProfileScreen.tsx` (Sound card) · `apps/mobile/src/components/PromptPanel.tsx` (the link) · `apps/mobile/src/logic/audio/voice-help.ts` (pure view models and the steps, unit-tested) · copy in `logic/audio/copy.ts` · glyph in `packages/design-system/src/components/Icon/glyphs.ts`

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

The switch row (glyph, label, voice line, pill) is one accessibility group: "Sound, on. Korean voice ready." The How-to button sits outside the switch so a tap on it never toggles the sound.

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

A bottom sheet over a dimmed screen (`colors.surface.overlay`), plain text, scrolls.

```
 +--------------------------------------------+
 | Add a Korean voice                    [x]  |   Heading prompt + close (Icon close, 64 target)
 | Menu names can differ on your device.      |   Caption, muted
 |                                            |
 | iPhone or iPad                             |   Body semibold
 |  1. Open Settings, then Accessibility.     |   Body
 |  2. Tap Spoken Content, then Voices.       |
 |  3. Tap Korean and download a voice.       |
 |                                            |
 | Android                                    |
 |  1. ...                                    |
 | Computer                                   |
 |  1. ...                                    |
 |                                            |
 | You can still play: the sound is written   |   Body, secondary
 | on screen.                                 |
 | [[ OK ]]                                   |   primary Button, md
 +--------------------------------------------+
```

- Sections are static text per OS family, English now (`logic/audio/copy.ts`, catalog keys later). All three families show; no OS sniffing, so a grown-up setting up another device reads the right one.
- Closing: OK, the close icon, a tap on the dimmed area, or Escape / hardware back (`onRequestClose`). Focus returns to the control that opened it.
- Steps (verified against Apple, Google and Microsoft help pages on 2026-10-10; menu names still vary by OS version, which is why the sheet says so):
  - iPhone or iPad: Settings > Accessibility > Spoken Content > Voices > Korean > download a voice (Yuna, or one marked Enhanced or Premium). Then reopen the app.
  - Android: Settings > System > Languages & input (or Accessibility) > Text-to-speech output > Speech Services by Google > gear > Install voice data > Korean. Then reopen the app.
  - Computer: Mac, System Settings > Accessibility > Spoken Content > System Voice > Manage Voices > Korean. Windows, Settings > Time & language > Speech > Manage voices > Add voices > Korean. Chrome and Edge: also check you are online (some Korean voices need the internet).
- A voice added while the app is open is picked up when the browser reports it (`voiceschanged`); otherwise reload the page. The sheet says "Then reopen the app."

Accessibility: `role` dialog, modal, titled by the heading; focus enters the sheet and the close button is first; text >= 18; at 200 % text the sheet grows and scrolls, the OK button stays reachable (sticky under the scroll area). No emoji, no red, no age words.

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
