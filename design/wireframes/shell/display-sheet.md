# Shell/Display-sheet — language and text size for everyone on this device, from an Aa button on every screen (wireframe v1)

Spec: `docs/specs/AMENDMENTS-DISPLAY-NAV.md` sections 3.6 and 4 (rows DN-3, DN-5, DN-7; LV-3 for the presenter) · amends `profile/language-picker.md` (the Profile Language card goes; Welcome's chips stay) and `browse/show-as.md` (its Language row goes)
Audience: **anyone on the device** (a learner, a parent, a teacher); not behind the grown-up gate
Surfaces: learner app (every `ScreenHeader`, tab roots), All lessons, the presenter home and start screen, the console frame (`app.hangulroute.com`)
Mock: `design/screens/app-shell/display-sheet.md`

## Scenario (Given-When-Then)

Given: someone who reads Spanish better, or needs bigger text, on any screen of the app
When: they tap **Aa** at the top right
Then: one sheet changes the language and the text size for this whole device (learner, grown-up pages, All lessons, the presenter), right away, and a mis-tapped language is one tap from undone

## Screen goal

"Read the app comfortably." (one sheet, two choices)

## Box diagram

Panel A — the control (top right of every header)

```
+--------------------------------+
| [< Back]  Title        ( Aa )  |   <- learner ScreenHeader: Aa is the last control in the row
+--------------------------------+
| (Hoya) Hi, Mina!  ( Aa )(Profile)|  <- Home root: Aa beside the Profile button
+--------------------------------+
```

Panel B — the sheet, phone (320 to 599): a bottom sheet

```
+--------------------------------+
|  ......  (page dimmed) ......  |
|+------------------------------+|
|| Display                 (h2) ||
||                              ||
|| Language                     ||  <- only when 2+ locales are offered
||  (•) English                 ||     endonyms, each lang-tagged
||  ( ) Español                 ||
||  ( ) 한국어                    ||
||                              ||
|| Text size                    ||
||  (•) Standard                ||  <- each row's label drawn at that size
||  ( ) Large                   ||
||  ( ) Larger                  ||
||  ( ) Largest                 ||
||  "This is how text looks."   ||  <- live preview line
||                              ||
|| "For everyone on this device.||
||  Change it any time."        ||
||             [[  Done  ]]     ||
|+------------------------------+|
+--------------------------------+
```

Panel C — the sheet from 600 px (here 768): a centred dialog (reading width), the two groups side by side

```
+------------------------------------------------------------+
|                         Display                            |
|  Language                      |  Text size                |
|   (•) English                  |   (•) Standard            |
|   ( ) Español                  |   ( ) Large               |
|   ( ) 한국어                     |   ( ) Larger              |
|                                |   ( ) Largest             |
|                                |   "This is how text looks."|
|  "For everyone on this device. Change it any time."        |
|                                          [[  Done  ]]      |
+------------------------------------------------------------+
```

Panel D — choosing another language: the confirm step, written in the language chosen

```
|| ¿Usar Español en este        ||
||  dispositivo?                ||
||  [[ Usar Español ]]          ||
||  [ Volver a English ]        ||
```

## Interaction points

- ( Aa ) → opens the sheet (focus on the sheet's title; the history bridge adds an entry, so the back closes it).
- Language radio (another locale) → Panel D in that language; [[ Use … ]] → writes the device record (`uiLocale`, `uiLocaleAt`), every open tab follows (`hr-prefs`), the sheet re-renders in the new language; [ Back to … ] → nothing changes.
- Text size radio → applies at once to the screen behind (no confirm), writes `textSize`.
- [[ Done ]], `Esc`, the backdrop or the back → closes; focus returns to ( Aa ).
- Console signed in → a language choice also writes the account copy (Clerk), section 5.

## Navigation graph

Enter from: any learner screen header · Home · All lessons header · presenter home and start screen · console frame header (where it replaces the Language select)
Exit to: the same screen (closes in place)

## States

- **success**: Panels A to D.
- **one locale offered** (an English-only build): the Language group is not drawn; Text size only.
- **storage blocked** (private window): choices apply to this page only, as today; nothing else is said.
- **a session clock running** (Speed Round Challenge, Daily test, a timed placement item): ( Aa ) is not drawn until the clock ends.
- **presenter during a lesson**: no ( Aa ) on the stage or the bar; the slides keep stage units.

## Data needs

- Reads: `hr:device:settings` (`uiLocale`, `uiLocaleAt`, `textSize`), `availableLocales()`; console: the signed-in user's `unsafeMetadata`.
- Writes: `hr:device:settings`; console signed in: Clerk `unsafeMetadata` (merged, `adultAffirmedAt` kept). Posts `hr-prefs`.
- No telemetry.

## Open questions

- None blocking. The site (hangulroute.com, another origin) keeps its own switcher and the browser's text size.
