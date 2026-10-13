# The consent sheet: one keyed text on every surface (design mock v1, for T-6d and T-7c)

Wireframe: `design/wireframes/console/class-transfer.md` screens 3 (sheet) and 5 (app step 2) · spec 4.11, 4.2 guard 7, T17, T18 · text: `packages/content-schema/src/schemas/transfer-consent.ts` (`TRANSFER_CONSENT_LINES`, `TRANSFER_CONSENT_TEXT.en`, `TEACHER_VISIBLE_ITEM_IDS`), drawn word for word · mock: `mock/consent-sheet.html`, `mock/consent-sheet-states.html`, the app variants on `mock/app-sheets.html` · shots: `shots/consent-sheet-375.png`, `-1280.png`, `-320-text200.png`, `-390-first.png`, `consent-sheet-states-375.png`, `-1280.png`

This sheet is the record of the learner side's yes, so its rules are stricter than any other screen's: what is drawn is what is recorded (`l_shown_json`, `l_text_version`, `l_locale`, `termsDigest`).

## Order: canonical, fixed by the code

The sheet renders `transferConsentLineIds(ctx)` in that order, the same on the console and in the app (layout may differ, wording may not):

```
 Move Mina to Saturday Class B?                     ( x )      h2, takes focus first
 Language [ English v ]                                         en / 한국어 / Español
 +--------------------------------------------------------+
 | moving        Mina would move from Sunday Class A to   |    summary block: the first three ids,
 |               Saturday Class B.                         |    brand.secondaryLight, first line bold
 | new_teacher   The teacher of Saturday Class B will see  |
 |               Mina's progress.                          |
 | old_teacher   The teacher of Sunday Class A stops ...   |
 +--------------------------------------------------------+
 keeps          Cards, stars and finished lessons stay with Mina.
 cooling_off    The move happens after 2 days. Anyone in the family can cancel before then.
 visible_list   What the new teacher sees:                       plain line and list, always open, no toggle (D15)
   - one item per TEACHER_VISIBLE_ITEM_IDS entry (8 items)
 nothing_else   Nothing else from the app is shared with the teacher.
 visible_today  Today these people can see Mina:
   - Sunday Class A (teacher Mr Han)
   - Kim family (you)
 +-- Who is the new class? ---------------------------------+  identity facts from the preview (not a line id)
 | Saturday Class B                                        |
 | Teacher: Ms Park · Riverside school                     |
 | A few months old · 8 learners                           |
 | typed_names  Class and teacher names are typed by ...   |
 +---------------------------------------------------------+
 | from_teacher        (initiator source)                     conditional lines: a border.strong bar
 | premium_may_change  (premiumChange may_change)             marks "this applies to this move"
 | school_delete       (destination consent mode school)
 | device_relink       (relinkAffected)
 | homework_drops      (sourcePlansAffected)
 cannot_undo    A move can't be undone. Mina can still leave a class in Profile at any time.
 [ ] introduce  Tell Saturday Class B where Mina is coming from.   off by default
 Not now ends this request. You can start a move yourself any time.   teacher-started only
 (( Yes, move Mina ))     ( Not now )                              buttons after the last line; Yes waits for the end
```

- **Canonical order wins over the wireframe's grouping.** The wireframe drew `keeps` and `cooling_off` in an "Also" group near the end; the code's list (and the parity test of 4.11) puts them right after the summary, so the mock does too. Changing the order would be a text-version bump and a spec change, not a layout choice.
- **The identity block** ("Who is the new class?": class name, "Teacher: {owner}", school, then the age bucket and the count) sits directly above `typed_names`, which speaks about those names; it is preview data, not a consent line, and is rendered for the learner side only.
- **Class age is a bucket, never a number.** The server sends `ageBucket` only (`transfer-views.ts` `ageBucket()`: under 7 days `days`, under 60 `weeks`, under 365 `months`, else `years`; null when unknown), as spec 4.2 says ("class age bucket"). The block reads "Less than a week old" (`days`), "A few weeks old" (`weeks`), "A few months old" (`months`), "More than a year old" (`years`), joined to "{n} learners" by a middle dot when the count is known; with a null bucket the age is left out. The design asks for no finer field.
- **`visible_today`** items read "{space} (teacher {owner})" for a class or school and "{family} (you)" for the viewer's own family; a family the viewer is not in reads "{family} (family, {owner})" (the app's self-managed case).
- **Conditional lines** carry a `borderWidth.thick` `border.strong` left bar so a reader sees which sentences are about this move; the bar is decoration, the sentence carries the meaning.

## The buttons and the reading rule

Spec 4.11: the primary becomes active only after the sheet has been scrolled to the end, and never sits above an unread conditional line. The mock keeps both rules on both surfaces (D2):

- **Position.** The buttons are the last element of the sheet, in the DOM and on screen, never pinned in a sticky footer.
- **The end sentinel.** An empty marker directly after `cannot_undo` (the last consent line). **Yes** stays `aria-disabled` (still focusable, so a keyboard or screen-reader user finds it and hears why) until the sentinel has been in view once, then turns active for the life of the sheet. Its description is the hint "Read to the end to continue.", shown above it while it waits. On a screen tall enough to show the whole sheet, the sentinel is in view at once and the hint never shows.
- **What the sentinel is not.** It is a scroll-position rule, as spec 4.11 words it, not evidence of reading. It does not stop a keyboard skip: tabbing to the `introduce` checkbox or to Yes scrolls that control into view, which brings the sentinel (just above it) into view too, and Yes turns active. Whether that is enough is counsel's call at G2.
- **The list is always open on every surface** (spec 4.11 "expanded by default", D15): "What the new teacher sees:" is a plain line followed by the list, with no toggle, so nobody can fold the core disclosure on a sheet that records a yes.
- **The record.** The client sends the consent only after the sentinel was seen; `l_shown_json` is computed by the server from the sheet terms (it is not a client field), so the sentinel is a client rule, tested by T-6d and T-7c with tests that can fail: on a sheet taller than the viewport, Yes starts `aria-disabled` and turns active only after the sentinel intersects; on a sheet shorter than the viewport, Yes starts active; the primary follows the last line and is not `position: sticky`. Adding it to the record would be a strict-schema change, out of this design pass.

Focus: the heading (`tabindex="-1"`) on open, never the primary; then the language switch, the introduce checkbox, Yes, Not now. Screen readers hear the lines in the order above.

**Not now on a teacher-started sheet.** Not now there ends the request for everyone and starts the 30-day `cannot_send` rule for teachers (4.9), while on a guardian-started create it only closes the sheet. So a teacher-started sheet (and the family card's own Not now) shows one neutral line above the buttons, "Not now ends this request. You can start a move yourself any time.", which is also Not now's description. The label stays "Not now" (the wireframe's word); no reason, no blame.

## Console and app

| | Console (T-6d) | App (T-7c) |
|---|---|---|
| Frame | dialog over the family page (full screen below 45em, centred card from 45em) | a stack screen behind the grown-up gate |
| Title | "Move {Name} to {Destination}?" | the same; self audience "Move to {Destination}?" |
| Visible list | always open, no toggle | always open, no toggle (the same; D15) |
| Primary | "Yes, move {Name}" | "Yes, move {Name}"; self audience "Yes, move me" |
| Language switch | visible select (en / ko / es) | the same visible select under the title, starting at the app's UI locale (guard 7); a locale without a reviewed text shows the same notice |
| Identity block | from the family preview | MoveClass: from the device preview (with the count); ApproveTransfer: from the inbox, no count until `to.learnerCount` ships (`app-sheets.md`) |
| Secondary | **Not now**: closes the sheet (guardian-started create) or ends the request quietly (teacher-started, with the line above) | **Not now** |

The lines themselves are third person in every audience ("Grace would move from ..."): one canonical text, one record.

## States (drawn on `consent-sheet-states.html`)

| State | Drawn |
|---|---|
| guardian-started, no conditional line | the ten always lines and `introduce` |
| every conditional line | all five, the list open as everywhere; teacher-started, so the Not now line shows |
| the last line not yet in view | Yes `aria-disabled`, the hint "Read to the end to continue." as its description |
| locale without a reviewed text (`consent_locale_unavailable`; only `en` exists today) | "Not available in your language yet." replaces the lines; no Yes; the switch stays |
| text version or terms changed (`consent_text_stale`, `terms_changed`) | the sheet reloads with "This text was updated. Please read it again." on top (`role="status"`) |
| Yes failed | the sheet stays; "Didn't go through" and **Try again** |
| after Yes | the sheet closes to the family card "Waiting for the other classes. ..." (`family-page.md`) |

## Tokens

| Part | Tokens |
|---|---|
| Summary block | `brand.secondaryLight`, `radii.md`, padding `spacing.lg`, `text.primary` `size.body` `leading.relaxed`, first line bold |
| Lines | `size.body`, `leading.relaxed`, gap `spacing.md` |
| Visible list heading | a plain `consent-line` (`leading.relaxed`), as the `visible_today` heading; the list below in `text.secondary` |
| Item lists | `text.secondary`, disc bullets |
| Identity block | `borderWidth.thin` `border.subtle`, `radii.md`; class name `size.bodyLg` semibold |
| Conditional bar | `borderWidth.thick` `border.strong`, `spacing.md` inset |
| introduce | `.check` row (64 px) |
| Notices | `surface.sunken`, `text.primary` |

Reading level: every line is the schema's Pre-A1 text (16-word cap enforced by its copy test); the new UI words around it follow the same cap.
