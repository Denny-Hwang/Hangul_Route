# Classroom/Lecture-phone — a lesson on a phone: the stage sideways with a floating bar, the rotate page upright, the phone start screen (wireframe v1)

Spec: `docs/specs/F-TCH-004-lecture-mode.md` §3.5 (phone start screen, "History"), §3.6 (phone exception to README D1) · `docs/specs/AMENDMENTS-LECTURE-V2.md` section 18 (row **LV-M1**) · amends `classroom/lecture-presenter.md` B (start screen) and C (stage) for phone windows only
Audience: **teacher, parent or caregiver presenting from a phone** (to a TV over a cable or casting, or to a small group around the phone)
Route: `app.hangulroute.com/present` (no new route)
Mock: `design/screens/presenter/stage-and-bar.md` "Phone", `states.md` (rotate page), `start-screen.md` "Phone"

## Scenario (Given-When-Then)

Given: a grown-up opens a lesson on a phone (`isPhoneWindow`: short side under 600, long side at most 1000)
When: they tap Start and turn the phone sideways
Then: the slide fills the screen (no 120 px band, no "make the window bigger" page); a small bar floats over the bottom and hides by itself; upright, a rotate page says to turn the phone, with a way back

## Screen goal

"Show the slide on the whole phone screen." (secondary: step back or leave)

## Box diagram

Panel A — 640 x 360 sideways, bar shown (just after a tap)

```
+--------------------------------------------------------------+
|                                                      5 / 18  |  <- counter (stage caption, floored)
|                                                              |
|     [ glyph ]      [ stroke guide ]      sound · name        |  <- the slide, stage units, unit 0.5
|        ㄱ                                 example word        |
|       g/k                                                    |
|  +--------------------------------------------------------+  |
|  | [< Back]   [[  Next  >  ]]   [ Sound ]   [ More ]      |  |  <- compact bar: floats over the stage bottom
|  +--------------------------------------------------------+  |     inside the bottom safe-area inset
+--------------------------------------------------------------+
```

Panel B — 640 x 360, bar hidden (3 s after the last touch)

```
+--------------------------------------------------------------+
|                                                      5 / 18  |
|                                                              |
|     [ glyph ]      [ stroke guide ]      sound · name        |
|        ㄱ                                 example word        |
|       g/k                                                    |
|                                                              |  <- the slide is drawn in full; nothing moved
|                                                              |
+--------------------------------------------------------------+
   tap anywhere: shows the bar only (does not advance)
```

Panel C — 844 x 390 sideways (a notched phone), bar shown; the stage box is the window minus the insets

```
+-----+----------------------------------------------------------------+-----+
|notch|                                                       5 / 18   |     |  <- left / right insets stay empty
|     |   [ glyph ]        [ stroke guide ]        sound · name        |     |
|     |      ㄱ                                    example word         |     |
|     |     g/k                                                        |     |
|     |  +----------------------------------------------------------+  |     |
|     |  | [< Back]    [[   Next   >   ]]    [ Sound ]    [ More ]   |  |     |
|     |  +----------------------------------------------------------+  |     |
+-----+----------------------------------------------------------------+-----+
                              (home indicator inset below)
```

Panel D — More (a sheet over the stage; the slide stays underneath)

```
+--------------------------------------------------------------+
|  Lesson controls                              [ Close ]       |
|  (No Korean voice here. You say it!)          <- status chips, when any
|  [ Slides ]  [ Timer ]  [ Blank ]  [ Full screen ]            |  <- Full screen only where the browser has it
|  [ Keys and help ]                     [ Exit ]               |
+--------------------------------------------------------------+
```

Panel E — 360 x 640 upright during a lesson: the rotate page (never a letterboxed strip)

```
+------------------------+
| [< Back]               |  <- top-left; opens the Exit confirm
|                        |
|        (Hoya)          |
|                        |
|  Turn your phone       |  <- title
|  sideways              |
|                        |
|  The lesson shows when |
|  the phone is          |
|  sideways. Nothing is  |
|  lost.                 |
|                        |
+------------------------+
```

Panel F — phone start screen, 360 x 640 upright (a teacher page; scrolls; the footer stays)

```
+------------------------+
| (Aa)                   |  <- Display control, top-right (AMENDMENTS-DISPLAY-NAV)
| Lecture mode           |
| Hangul week 1     (h1) |
| 46 slides · about 19   |
| min                    |
| (✓) Ready to start     |  <- ONE line; or "Some checks need a look: see Details."
| [ v Details ]          |  <- disclosure: the check list, skipped parts, What's in this lesson
|                        |
| Turn your phone        |  <- hint while upright; never a blocker
| sideways for the       |
| lesson.                |
|========================|
| [ Back ] [[  START  ]] |  <- sticky footer over the bottom inset
+------------------------+
```

Panel G — the same start screen at 640 x 360 sideways: one column, the same sticky footer, no turn hint

```
+--------------------------------------------------------------+
| Lecture mode                                          (Aa)   |
| Hangul week 1                  46 slides · about 19 min      |
| (✓) Ready to start   [ v Details ]                           |
|==============================================================|
| [ Back ]                       [[          START          ]] |
+--------------------------------------------------------------+
```

## Interaction points

- Tap the stage while the bar shows: right two thirds next, left third back (F-TCH-004 §3.5); restarts the 3 s hide timer.
- Tap the stage while the bar is hidden: shows the bar only.
- Swipe left or right: next / back, bar shown or not.
- [ Next ] / Reveal, [< Back], [ Sound]: as the docked bar.
- [ More ] → Panel D; [ Close ] or `Esc` closes it. Its buttons do what the docked bar's do; [ Exit ] opens the Exit confirm.
- Rotate the phone upright during a lesson → Panel E; back sideways → the same slide and build.
- Panel E [< Back] → the Exit confirm (Keep going / Exit).
- Browser or phone back during a lesson → the Exit confirm (with an overlay open: closes the overlay).
- Panel F / G [ Back ] → the presenter home (nothing saved to Recent); [[ START ]] → the lesson (Panel A or, upright, Panel E); [ v Details ] → opens the full check list in place.
- (Aa) → the Display sheet (`shell/display-sheet.md`).

## Navigation graph

Enter from: presenter home (`classroom/lecture-presets.md` A) · a deck link opened on a phone · Recent Resume
Exit to: presenter home (Back, Exit) · the Exit confirm · Display sheet

## States

- **success**: Panels A to G.
- **no Korean voice**: the chip shows in More's header and, for 3 s, at the top of the stage when a sound build cannot play; sound builds show the teacher-says text.
- **no full screen** (iPhone): Full screen is not drawn in More.
- **split-screen phone under 560 px wide**: the too-small page (`design/screens/presenter/states.md`).
- **loading** (font wait): Start disabled with "Getting the big letters ready", as on the wide page.
- **invalid link**: the invalid page, as on the wide page.

## Data needs

- Window size and safe-area insets; `document.fullscreenEnabled`; the deck (fragment or Recent); the device record for the chrome language (AMENDMENTS-DISPLAY-NAV).
- Writes: Recent at Start (unchanged); history entries per phase (F-TCH-004 §3.5).

## Open questions

- None blocking. Casting a phone to a TV mirrors the phone's window, so the TV shows the same 16:9-ish stage; a wired HDMI phone that reports a larger window is a desktop window and keeps the docked bar.
