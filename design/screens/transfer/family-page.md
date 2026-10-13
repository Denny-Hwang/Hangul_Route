# /teach/space/transfers: the family page (design mock v1, for T-6d)

Wireframe: `design/wireframes/console/class-transfer.md` screen 3 · spec 4.2 (guardian predicate, guard 13), 4.8 (family page), 4.9, 4.13 · mock: `mock/family.html`, `mock/family-states.html` · shots: `shots/family-375.png`, `-1280.png`, `-320-text200.png`, `family-states-375.png`, `-1280.png`

Same route as the class page with a family `id`; adult frame with the Family persona. The visible heading carries the family space name from the roster (never a literal "Our family"); the document title stays "Class moves - Hangul Route".

## Layout

```
 < Back to Kim family
 Class moves (h1)
 Kim family
 Asked about your learners (h2)
 +--------------------------------------------------+
 | (chip) Mina     Asked by Sunday Class A's teacher · 1 day ago
 | Sunday Class A  >  Saturday Class B              |   route line (the arrow has the hidden word "to")
 |  - Family            waiting                     |
 |  v Sunday Class A    said yes                    |   class names on the family side
 |  - Saturday Class B  waiting                     |
 |  (( Review and agree ))            ( Not now )   |
 +--------------------------------------------------+
 | (chip) Jun                                       |
 | Sunday Class A  >  Saturday Class B              |
 |  v Family said yes · - Sunday Class A waiting · - Saturday Class B waiting
 |  Waiting for the other classes. The move happens after Oct 14 if both say yes. You can cancel any time.
 |  (one class left: "Waiting for the other class. The move happens after {date} if it says yes. ...")
 |                                      ( Cancel )  |
 +--------------------------------------------------+
 Start a move (h2)
 | Learner [ Mina v ]   Now in [ Sunday Class A v ] |   options: this family's learners in a live class
 | New class code                                   |
 | [  A B C 1 2 3  ]  (( Find class ))              |   -> consent sheet (consent-sheet.md)
 Move requests from teachers (h2)
 | Mina   [ ] Do not accept move requests from teachers
 | Jun    [x] Do not accept move requests from teachers
 | Grace  Grace manages their own classes. Ask them to start a move on their device.
```

- **The family sees names.** The learner side view carries both class names, the destination owner, school, class age and size (4.2 Views); the step list names the classes instead of "This class" / "New class".
- **Review and agree** and **Find class** both open the consent sheet (`consent-sheet.md`). **Not now** on a teacher-started request ends it quietly for everyone (`declined`), with no one named; because it also starts the 30-day `cannot_send` rule for teachers, the card shows "Not now ends this request. You can start a move yourself any time." under its buttons, as Not now's description.
- **Start a move**: Learner, then Now in (the learner's live classes), then the code. Find class is the primary of this section. Errors as in `start-sheet.md` (same place, one at a time), plus these learner-side answers:

| Answer | Line |
|---|---|
| `429 cooldown` | "You can ask again in about a week." |
| `409 learner_manages_own` | "{Name} manages their own classes. Ask them to start a move on their device." (the spec 4.8 line) |
| `409 already_open`, started by a class | "A class already asked about moving {Name}. Its card is above." |
| `409 already_open`, started by the learner side | "A move for {Name} is already waiting. Its card is above." |
| `422 consent_locale_unavailable` at create | "Not available in your language yet." |
| `422 family_too_new`, `409 conflicted_guardian` | the guardian-predicate notices below |

  The `already_open` body says only which side started the open one (`class` or `learner_side`), never a name.
- **Move requests from teachers** (`blockTeacherRequests`): one checkbox row per learner, labelled with the learner's name as the row heading and the switch words. Turning it on needs guard 9a; turning it off needs the whole guard 9 (a failure reads as the matching notice below). A self-managed learner's row has no switch, only the line.

## Cards and lines

| Situation | Card |
|---|---|
| A teacher asked | route line, steps, **Review and agree** (primary), **Not now** |
| After Yes, waiting for both classes | steps, "Waiting for the other classes. The move happens after {date} if both say yes. You can cancel any time.", **Cancel** |
| After Yes, one class still waiting (the usual teacher-started case: the source already said yes) | steps, "Waiting for the other class. The move happens after {date} if it says yes. You can cancel any time.", **Cancel** |
| Scheduled (cooling-off) | `check-circle` + "A move is planned for {date}.", **Cancel** (any caregiver of the learner's families) |
| Approved, no room | steps all yes, room block "Waiting for room in the new class." (not a live region; the page's one polite region announces changes), **Cancel** |
| `cap_learner` at execution (rare) | room block "{Name} is in the most classes allowed. Leave one, then the move can go ahead." |
| Consent reset (`terms_changed`, `guardian_changed`, `lapsed`) | route line, "Please check this again.", **Review and agree**, **Not now** |
| Moved | "Moved. {Name} is now in {Class}. Cards and stars stayed with {Name}." on `feedback.successLight`; plus "A tablet that joined through {Source} needs to join again." when `relinkAffected` |
| A self-managed adult moved on their own device | notice "{Name} moved to {Class} on their own." (information, no action) |
| Ended | history row "This request ended." with the date; the family alone may also read "Ended from {Name}'s tablet." (`endedFrom: device`) |
| Empty | "Nothing waiting." |

## Notices (one neutral line on `surface.sunken`, no icon)

| Case | Line |
|---|---|
| Guardian predicate (b): family or memberships younger than a day | "Moves open one day after a family is set up." |
| Guardian predicate (c): the account holds a role in either class | "A teacher of this class can't answer for the family." |
| No learner of this family is in a live class (Start a move) | "No learner here is in a class right now." |
| 401, 403, locked, loading, action failed | as the class page (`requests-page.md`) |

The answer buttons are not drawn when a notice of guardian predicate (b) or (c) applies; **Cancel** and **Not now** stay (the safe direction needs only predicate (a)).

## Tokens

As `requests-page.md`, plus: route line `size.body` semibold with the `arrow-right` glyph in `text.secondary`; Start a move panel `surface.paper`, `radii.lg`, `border.subtle`; selects `.select` (pill, 64 px); switch rows `.check` (64 px, `borderWidth.base` `border.strong`, ticked `brand.primary`).

## Accessibility

Each checkbox has its own visible label; the learner name above it is the row's heading text and joins the accessible name through the list item (T-6d gives the input `aria-describedby` naming the name line). Selects have visible labels. At 320 with 200 % text the two selects stack and never scroll sideways (`family-320-text200.png`).
