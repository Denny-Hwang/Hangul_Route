# Journey/Route-class-blend — class days and practice days on the learner's device (wireframe v1)

Spec: `docs/specs/AMENDMENTS-ROUTE-CLASS-BLEND.md` sections 7 (what the learner sees), 8 (the own weekly plan rests), 9.4 (learner practice days, BL-8), 13 (anti-shame), 19 (draft strings) · Siblings: `journey/learning-route.md` (the route card and its weekly plan line), `home/todays-mission.md` and `homework/list.md` (card (2) rows and the From class pill), `profile/settings.md`
Mocks: `design/screens/route-blend/` (`route-line.html`, `route-line-board.html`, `learner-home.html`, `profile.html`; shots at 320 and 1280 in en, es and ko)
Built by: BL-7 (line, pill glyph, Refresh, Class today, resting row, proposal line) and BL-8 (practice-days setting), behind `flags.routeBlendEnabled` (`EXPO_PUBLIC_ROUTE_BLEND_ENABLED`, default off until BL-10)
Audience: **learner** (any age) in a class whose weekly plan has practice days (layer *Class with practice*). Nothing here shows in the Solo or Class only layers.
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary, `(glyph)` a decorative glyph with no name of its own.

## Scenario (Given-When-Then)

Given: Mina's class meets on Tuesday and its weekly plan has practice on Wednesday, Friday and Sunday
When: she opens Route, Home or Profile
Then: she sees, in calm words, when class is and when she practises; lessons from class keep one From class pill; a practice day with room offers a Refresh; her own weekly plan rests instead of competing; nothing counts what she did not do

## Screen goal

"Know when class is and when to practise, with nothing to catch up on."

## B1. Route tab: the weekly plan line (under the route card)

```
┌───────────────────────────────┐
│ Route                          │
│ ┌ route card (LR-11, unchanged)┐│
│ │ Stage 1 · Hangul: ...        ││
│ │ From your class's weekly plan││
│ │ Next: Family at the Table    ││
│ │ [[ Continue ]]               ││
│ └──────────────────────────────┘│
│ Your class's weekly plan: class │  <- one text node, body size, text.secondary
│ on Tuesday, practice on         │
│ Wednesday, Friday, and Sunday.  │
└───────────────────────────────┘
```

The practice part depends on the learner's practice days (her own, when she moved them, BL-OD-7; else the class's):

| Practice days | Practice part (en) | es | ko |
|---|---|---|---|
| 1 to 3 | practice on Wednesday, Friday, and Sunday | práctica el miércoles, viernes y domingo | 수요일·금요일·일요일 연습 |
| 4 or 5 | practice on most days | práctica casi todos los días | 거의 매일 연습 |
| 6 | practice every day except Tuesday | práctica todos los días menos el martes | 화요일 빼고 매일 연습 |
| 7 | practice every day | práctica todos los días | 매일 연습 |

- Weekday names are long names from `Intl.DateTimeFormat(locale, { weekday: 'long' })`, in week order from Monday, joined by `Intl.ListFormat` in en and es and by a middle dot in ko (the Korean list form "및" is formal and its commas run into the comma between the class part and the practice part).
- Two class days: "class on Monday and Thursday". The count rule is by practice days alone, so 1 class + 6 practice days (Wednesday to Monday) reads "every day except Tuesday", which is true: Tuesday has the class and no practice session.
- Never a date, a count above 3, "Week n of N" for the class plan or a countdown. **Open plan** stays hidden (it is the own plan's link).
- Assumption d (section 17): measured at 320 x 568 for 1 to 3 weekday names and every collapsed form: at most 3 lines in en and es, 2 in ko (README of the mocks). Korean wraps between words (`lineBreakStrategyIOS="hangul-word"` on iOS).

## B2. Home on a class day: "Class today." and the From class pill

```
┌───────────────────────────────┐
│ Hi, Mina                       │
│ Class today.                   │  <- one calm line above card (2); no button, no question
│ ┌ Today ───────────────────────┐│
│ │ First letters 2              ││
│ │ ((class) From class)         ││  <- lesson met in class (lectureDate): glyph inside the same pill
│ │ First letters 3              ││
│ │ (From class)                 ││  <- a practice-only lesson (split): the plain pill
│ └──────────────────────────────┘│
└───────────────────────────────┘
```

- One pill per row, its words the existing `from.teacher` key ("From class"); a lesson met in class adds the small `class` glyph in front of the words, never a second tag, so no row shows two labels with the same words (checked in the mocks; BL-7's screen test).
- Accessible name of the glyph pill: "From class. You met this in class." (`a11y.route.blend.fromClassMet`); the glyph itself is hidden from screen readers.
- Nothing is assigned for the class itself; the class never counts as done; nothing asks "Did you go?".
- The `class` glyph is new (a board on an easel, 24 x 24 grid, outline 2.2; geometry in the mocks' README) and is added to `glyphs.ts` by BL-7.

## B3. Home on a practice day: Refresh in card (2)

```
│ ┌ Today ───────────────────────┐│
│ │ (replay) Refresh             ││  <- after the day's lessons are done, or when there are none
│ │ Look back at what class      ││
│ │ taught.                      ││
│ └──────────────────────────────┘│
```

- One tappable row (64 px floor), never a to-do, no count, no check mark. It opens the Cell Check of the first listed open cell, else Daily Review with Keep going (section 6.4). Accessible name "Refresh: look back at what class taught".

## B4. Weekly goal ring

Unchanged drawing; its target is the plan's distinct days (4 for 1 class + 3 practice). A class day fills only when the learner plays something that day.

## B5. Profile: the own weekly plan rests

```
│ ┌──────────────────────────────────────────┐ │
│ │ Your weekly plan                 [ See it ]│ │  <- read-only overview
│ │ Your own weekly plan is resting while     │ │
│ │ your class's plan has practice days.      │ │
│ └──────────────────────────────────────────┘ │
```

- Never "stopped", "paused by your teacher" or "cancelled". When the class plan ends, Hoya says once: "Your own weekly plan is back."
- **See it** has no key in section 19 yet: proposed `learner.route.blend.seeIt` (README).

## B6. Profile or Home without an own plan: the proposal line instead

```
│ Your class's weekly plan has practice days for you.  [ Make a weekly plan ] │
```

- Replaces "Hoya can make a weekly plan for you" while the layer is Class with practice. **Make a weekly plan** stays reachable (a plan made now starts the day after the class plan's last day).

## B7. My practice days (Profile -> weekly plan; BL-8)

```
┌ My practice days ───────────────────────────┐
│ Pick the days you practise. Your lessons    │
│ stay the same.                              │
│ (lock) PIN required                         │  <- child profile only (planChangesOpen false)
│ Days a week                                 │
│ (1) (2) (3*) (4) (5) (6) (7)                │  <- choices, 64 px each, wrap
│ (Sun*) (Mon) ((class) Tue) (Wed*) (Thu) (Fri*) (Sat) │  <- class day marked by the glyph; it may be picked
└─────────────────────────────────────────────┘
```

- Count chips 1 to 7 (radio) and weekday chips (checkbox). Picking a count keeps the chosen days and adds or removes from the end of the default order; picking days sets the count. A class day is allowed (its session comes after class with earlier classes' lessons or a Refresh).
- Weekday chip accessible name: "Practice day, Tuesday" (`a11y.route.blend.practiceDay`); on a gated child profile each control's name gains "(PIN required)" by the existing `caregiver.gated` rule, and a tap opens the grown-up gate first.
- The numbers on the count chips are choices, not counts of work, so the "no count above 3" rule does not apply to them.
- "Days a week" has no key in section 19 yet: proposed `learner.route.blend.practiceDays.count` (README). The KT-1 `TapTarget` wraps every chip.

## Navigation graph

Enter from: Route tab · Home · Profile -> weekly plan
Exit to: Cell Check or Daily Review (Refresh) · the quest (a row) · the read-only weekly plan overview (See it) · the grown-up gate (a child's practice days)

## States

- **class day / practice day / any other day**: B2 / B3 / card (2) as today.
- **learner moved their days**: B1 names the learner's days; the console never sees them.
- **two classes with practice**: the newest class plan leads B1 and Refresh.
- **offline**: everything here is local; Refresh opens local activities.
- **flag off**: no line, no glyph, no Refresh, no Class today, no setting; derivation still rests the own plan (not flagged, section 14).

## Data needs

- reads: the leading blended plan's `meta.params.blend`, items' `lectureDate` (`fromClass`), `meta.refresh`, `snapshot.practiceDays`
- writes: `snapshot.practiceDays` (BL-8)
- telemetry: `route.refresh_started { via }`, `route.practice_days_changed { days, by }` (section 18; no ids, no weekdays)
