# Classroom/Lecture-nav — moving through a lesson: visible Previous and Next, swipe, and no hidden tap zones (wireframe v1)

Spec: `docs/specs/AMENDMENTS-PRESENTER-NAV.md` (rows **PN-2** to **PN-5**) · amends `docs/specs/F-TCH-004-lecture-mode.md` §3.5 "Touch and mouse" and "Control bar", §3.6 phone exception · amends `classroom/lecture-presenter.md` C (stage and bar) and `classroom/lecture-phone.md` A to C (the phone bar and its strip)
Audience: **teacher, parent or caregiver presenting** a lesson from a tablet, a laptop at a projector, an interactive whiteboard or a phone
Route: `app.hangulroute.com/present` (no new route)
Mock: row PN-0b (`design/screens/presenter/stage-and-bar.md`, `overlays.md`, `slide-quiz.md`, `slide-listen-reply.md`)

## Scenario (Given-When-Then)

Given: a grown-up is presenting a question slide with four answer options to a room
When: they tap an option to show the room's pick, then want to go on
Then: the tap points at the option and nothing moves; Previous and Next are on the screen where they can see them (or a swipe moves), so going on or back is always a deliberate act

## Screen goal

"Move through the lesson only when I mean to." (secondary: point at an answer without giving it away)

## Box diagram

Panel A — docked window with touch (tablet sideways, or a whiteboard): a 2 x 2 question slide; Previous and Next pinned at the two ends of the band

```
+--------------------------------------------------------------------------+
|                                                                 6 / 32   |  <- counter
|   Which one is "water"?                              [ (spk) ]           |  <- prompt; speaker = stage button
|                                                                          |
|  +-------------------------------+   +-------------------------------+   |
|  | (circle)  물                  |   | (triangle)  불                |   |  <- option 1, option 2 (content targets:
|  |           mul                 |   |             bul               |   |     a tap never steps)
|  +-------------------------------+   +-------------------------------+   |
|  +-------------------------------+   +-------------------------------+   |
|  | (square)  산                  |   | (star)  눈                    |   |  <- option 3, option 4
|  |           san                 |   |         nun                   |   |
|  +-------------------------------+   +-------------------------------+   |
+--------------------------------------------------------------------------+
| [< Previous]  (chips)   [Exit] [Full] [Slides] [Blank] [Timer] [Sound] [[ Reveal > ]] |
+------------------------------------------------------------------------------------+
   ^ always shown on touch                                  always shown on touch ^
     (the tools between them fade after 3 s and come back on any touch)
```

Panel B — the same slide after a tap on option 1 (owner choice O2: pointing)

```
|  +- - - - - - - - - - - - - - - -+   +-------------------------------+   |
|  : (circle) (pin)  물            :   | (triangle)  불                |   |  <- dashed outline + pin: "pointed at"
|  :                 mul           :   |             bul               |   |     no colour, no reveal, nothing moved
|  +- - - - - - - - - - - - - - - -+   +-------------------------------+   |
   tap option 1 again: the outline goes · tap option 3: the outline moves there
   [[ Reveal ]]: the answer shows and the outline goes (any step clears it)
```

Panel C — docked window with a mouse only (a laptop at a projector): the same band, everything fades after 3 s

```
+--------------------------------------------------------------------------+
|                         (the slide, full)                                |
+--------------------------------------------------------------------------+
|                         (band: empty while faded)                        |  <- the band stays; no slide moves
+--------------------------------------------------------------------------+
   mouse move, a key or a clicker: the bar comes back
   click on a slide with nothing to point at (title, letter, story...): next
   click on a question slide outside the options: nothing
```

Panel D — phone sideways with the rail (844 x 390 class; also 667 x 375 and wider)

```
+-----+------------------------------------------------------+---------+-----+
|notch|                                              6 / 32  | [More]  |     |
|     |  Which one is "water"?               [ (spk) ]       |         |     |
|     |  +--------------------+  +--------------------+      | [Sound] |     |  <- rail: always shown,
|     |  | (circle) 물  mul   |  | (triangle) 불 bul  |      |         |     |     never over the slide
|     |  +--------------------+  +--------------------+      | [< Prev]|     |
|     |  +--------------------+  +--------------------+      |         |     |
|     |  | (square) 산  san   |  | (star) 눈  nun     |      |[[Next >]]|    |  <- Next: tallest, under the thumb
|     |  +--------------------+  +--------------------+      |         |     |
+-----+------------------------------------------------------+---------+-----+
                          (home indicator inset below)
   the stage box is the window minus the insets minus the rail; the slide letterboxes inside it
```

Panel E — small phone without room for the rail (568 x 320, 640 x 360): bar hidden, no strip, no grabber

```
+--------------------------------------------------------------+
|                                                      6 / 32  |
|  Which one is "water"?                     [ (spk) ]         |
|  +------------------------+  +------------------------+      |
|  | (circle) 물  mul       |  | (triangle) 불  bul     |      |
|  +------------------------+  +------------------------+      |
|  +------------------------+  +------------------------+      |
|  | (square) 산  san       |  | (star) 눈  nun         |      |  <- the bottom row is a target like the others:
|  +------------------------+  +------------------------+      |     a tap points, never shows the bar
+--------------------------------------------------------------+
   swipe left / right: next / previous
   tap empty slide area (outside every option): shows the bar (as lecture-phone.md Panel A)
```

Panel F — Keys and controls (Help), the new group above the key rows

```
+----------------------------------------------------------+
|  Keys and controls                              [Close]  |
|  (On this phone, tap the slide to show the controls.)    |  <- Panel E layout only
|                                                          |
|  Touch and mouse                                         |
|   Swipe left to go on, right to go back.                 |
|   Or tap Previous and Next.                              |
|   With a mouse, click the slide to go on                 |
|   (not on question slides).                              |
|   Tap an answer to point at it. It does not show         |  <- O2 only
|   the answer.                                            |
|                                                          |
|  [->][v][Space][PageDown][Enter]   Next                  |  <- key rows unchanged
|  [<-][^][PageUp][Backspace]        Previous              |
|  [1][2][3][4]                      Point at an answer    |  <- O2 only
|  ...                                                     |
|  [ ] Keep controls visible                               |
+----------------------------------------------------------+
```

Panel G — the first lesson on a touch device: the start hint (6 s, top of the stage, takes no taps)

```
+--------------------------------------------------------------+
|        ( Swipe, or tap Previous and Next. )                  |  <- small phone: "Swipe to move. Tap the
|                                                              |     slide to show the controls."
|                     (the first slide)                        |
+--------------------------------------------------------------+
```

## Interaction points

- Tap or click an answer option: points at it (dashed outline and pin; O2), or does nothing (O2 (b)); never steps, never reveals, never shows or hides a bar.
- Tap or click an order step, a sentence tile, a write-together chip: nothing.
- Tap the speaker or Start timer: their own action (unchanged).
- Touch tap on empty stage area: nothing (Panels A, D); shows or hides the bar (Panel E).
- Mouse click on empty stage area: next on a slide with nothing to point at; nothing on a slide with targets (Panel C).
- Swipe left: next (or Reveal); swipe right: previous; anywhere on the stage, over options too; one finger, mostly sideways, at least a short drag; not from the very edge of the screen (the system's back gesture).
- Vertical drag, two-finger move, a short wobble: nothing.
- [< Previous], [[ Next / Reveal > ]]: one step; on Panel E they also hide the bar.
- Keys and clicker: unchanged; `1` to `4` point at an option (O2).
- [More] (Panel D): the More sheet beside the rail (Slides, Timer, Blank, Full screen, Keys and help, Exit).
- Help (`H`, `?`, or Keys and help): Panel F.

## Navigation graph

Enter from: the start screen (Start) · a deck link · Recent Resume (`classroom/lecture-presenter.md` B, `classroom/lecture-phone.md` F)
Exit to: the Exit confirm (Exit, the browser or phone back) · the grid (Slides, `G`) · Help · the More sheet (Panel D) · the rotate page (phone upright, `classroom/lecture-phone.md` E)

## States

- **success**: Panels A to G.
- **empty** (a slide with no content targets: title, letter, story, end): no pointing; a mouse click steps forward; touch taps do nothing; Previous and Next as in Panels A, C, D.
- **error** (no Korean voice): the no-voice chip shows in the bar's chips (docked) or More's header (phone) and for 3 s at the top of the stage; navigation unchanged.
- **covering overlay open** (grid, help, blank, pause, full timer, Exit confirm): swipes and taps never step the lesson (unchanged).
- **reduced motion**: no fades; the outline appears at once.
- **kill switch off** (`EXPO_PUBLIC_PRESENTER_RAIL`): every phone window uses Panel E.
- **loading** (font wait): the start screen, as today; nothing here.

## Data needs

- Window size, safe-area insets, `isPhoneWindow`, the pointer kind (`pointerdown.pointerType`, `(pointer: coarse)`).
- The slide's kind (`slideHasTargets`) and the DOM marker `data-stage-target` of the touched part.
- Local storage `lecture:navHint` (`'1'` once the start hint was seen; nothing else).
- Writes: `lecture.complete` counts (`navLayout`, `stepsButton`, `stepsSwipe`, `stepsKey`, `stepsClick`, `quickBacks`, `points`); no ids, no coordinates.

## Open questions

- Owner choices O1 to O8 (`AMENDMENTS-PRESENTER-NAV.md` section 3); the panels show the recommended defaults.
- Rail labels in Spanish at the body floor ("Siguiente"): measured in PN-0b; a two-line label is allowed, a broken word is not.
