# Console + App / Teacher moves and the class-scope update (wireframe v1)

Spec: `docs/specs/AMENDMENTS-TEACHER-VISIBILITY-TRANSFER.md` (owner decisions 2026-10-14) on top of `docs/specs/F-SPACE-002-class-transfer.md` · extends `console/class-transfer.md` (start sheet, requests page), `console/space-settings.md` (learner rows), `console/home.md` (parent home), the learner report of F-REPORT-001 (`console/learning-route.md` neighbours) · app: `sync/join-space.md` neighbours, Home (F-HW-001)
Audience: **teacher** (the class the learner leaves and the class that takes them), **parent / caregiver** (parent home in the console), **learner or grown-up on the device**. Shared surfaces say "learner", "class", "grown-up"; teacher surfaces use the singular member noun. The user-facing word is **move**. Copy below is placeholder English; final wording is the `packages/i18n` dictionary (en, es, ko in the same PR).

URL rule (owner, 2026-10-10): no learner name, initial, class name or teacher name in any URL, path, query, fragment or page title. Console routes carry the space id only; the learner travels in request bodies; a move is addressed by an opaque `move:<uuid>` id on API paths.

Style rule (CLAUDE.md section 4): design-system tokens only. Ended and blocked states use `colors.feedback.nudge` and `colors.text.muted`, never `colors.feedback.danger`. The Move button stays outside the settings Danger zone. No ranking, no comparison between learners.

## Scenario (Given-When-Then)

Given: a teacher teaches Sunday A and Saturday B, and a student of Sunday A should be in Saturday B
When: the teacher opens the student's row in Sunday A's settings, picks **Move to another class**, picks Saturday B and presses **Move now**
Then: the student is in Saturday B and no longer in Sunday A at once; cards, stars and finished lessons stay; the family sees one notice "Mina moved to a new class: Saturday B." on the parent home and on the learner's Home, with **OK**

Given: the receiving class belongs to another teacher
When: the teacher types that class's code, presses **Find class**, then **Send**
Then: the receiving teacher sees an initials card under "Asked to join this class" with **Accept** and **Not now**; nothing moves until they accept

## 1. Console / Move sheet (teacher, from class settings)

```
+--------------------------------------------------------------+
| Move Mina                                               [x]  |
|                                                              |
|  Where to?                                                   |
|  ( ) Saturday Class B                     <- "Your classes"  |
|  ( ) Evening Class C                                         |
|  ( ) A class of another teacher                              |
|      Class code [ _ _ _ _ _ _ ]  [ Find class ]              |
|                                                              |
|                                        [ Back ] [ Continue ] |
+--------------------------------------------------------------+

step 2 (direct: a class you teach)
+--------------------------------------------------------------+
|  Move Mina to Saturday Class B?                              |
|  This happens now. The family gets a short notice.           |
|  Cards, stars and finished lessons stay with Mina.           |
|                                        [ Back ] [ Move now ] |
+--------------------------------------------------------------+

step 2 (another teacher's class)
+--------------------------------------------------------------+
|  Ask Weekday Class D to take Mina?                           |
|  The teacher of Weekday Class D needs to accept.             |
|                                        [ Back ] [ Send ]     |
+--------------------------------------------------------------+

done:   "Moved. Mina is now in Saturday Class B."   [ Done ]
        "Sent. Weekday Class D needs to accept."    [ Done ]
```

States: loading the list (skeleton, no blame text) · no other class of yours: the radio list is replaced by "You have no other class. Use a class code." · code errors reuse the join wording ("That code didn't work. Check it with the teacher.", "That code is too old. Ask for a new one.") · `cap_class`: "Saturday Class B is full right now." · `cap_learner`: "Mina is in as many classes as one learner can be." · `already_member`: "Mina is already in Saturday Class B." · `already_open`: "A move for Mina is already waiting." · offline: "This needs internet." · `transfers_locked`: "Class moves aren't available yet." Every error is one muted line under the step, amber icon, never red.

Accessibility: the sheet is a dialog with a heading; radios are one group with a legend "Where to?"; focus goes to the heading on open and back to the opener on close; Escape closes; the primary button is the last control.

## 2. Console / Class moves page, "Teacher moves" section (teacher)

```
+--------------------------------------------------------------+
| Class moves - Sunday Class A                                 |
|                                                              |
|  Teacher moves                                               |
|  Asked to join this class                                    |
|  +--------------------------------------------------------+  |
|  | (MK) M.K.  Level: Pictures first                        |  |
|  | From Weekday Class D                                    |  |
|  | Asked 2 days ago                 [ Not now ] [ Accept ] |  |
|  +--------------------------------------------------------+  |
|  Sent from this class                                        |
|  +--------------------------------------------------------+  |
|  | (avatar) Jun   to Saturday Class B                      |  |
|  | Waiting for the other class.              [ Cancel ]    |  |
|  +--------------------------------------------------------+  |
|  Done                                                        |
|   Jun moved to Saturday Class B. 12 Oct                      |
|   This move ended. 10 Oct                                    |
+--------------------------------------------------------------+
```

No room: under the card, "No room in this class right now." with **Try again** (amber icon). Empty section: "Nothing waiting." The family-request sections of `class-transfer.md` stay below, unchanged.

## 3. Console / Learner report additions (teacher and parent)

```
  Words                                   (full scope only)
   Words: 42 collected · 18 known well
   First try: 76 %
   Words to look at again: 사과 sagwa (apple) · 눈 nun (eye)

  Settings
   Notes from the class: on

  (base scope, one muted line instead of both blocks)
   Words and more show once the family has read the update.
```

Korean words are drawn with `lang="ko"` and always carry romanization and the gloss in the UI language. The "Words to look at again" line is the F-REPORT-001 P5 insight's words, never a ranking.

## 4. Console / Parent home cards (family)

```
+--------------------------------------------------------------+
|  An update about Mina's classes                              |
|  There is an update about the classes Mina is in.            |
|  The teacher of each class Mina is in can see all of         |
|  Mina's progress, including words.                           |
|  What a teacher sees:                                        |
|   - Mina's name, picture and level                           |
|   - ...  (every item, always open, never folded)             |
|  A teacher may move Mina to another class. We tell you when  |
|  it happens.                                                 |
|  Cards, stars and finished lessons always stay with Mina.    |
|  Mina can leave a class in Profile at any time.              |
|  Until you press OK, teachers see what they saw before.      |
|                                                     [ OK ]   |
+--------------------------------------------------------------+

+--------------------------------------------------------------+
|  Mina moved to a new class: Saturday Class B.       [ OK ]   |
+--------------------------------------------------------------+
```

Neither card is red; each goes away only after **OK**. OK on the update card writes the acknowledgement; OK on the notice records that the family saw it.

## 5. App / Home lines and the update screen

```
Home (child profile)                       Home (self profile)
+----------------------------------+       +----------------------------------+
| A grown-up has an update about   |       | There is an update about your    |
| your class.          [ Open ]    |       | class.               [ Open ]    |
+----------------------------------+       +----------------------------------+
        | grown-up gate (PIN)                      | (no gate)
        v                                          v
+--------------------------------------------------------------+
| Class update                                                 |
|  (the lines of section 4, same ids, same order)              |
|                                                     [ OK ]   |
+--------------------------------------------------------------+

Move notice (any profile, no gate: it names nothing private)
+----------------------------------+
| Mina moved to a new class:       |
| Saturday Class B.      [ OK ]    |
+----------------------------------+
```

Offline on the update screen: "This needs internet." and OK stays available to try again; nothing is queued. The child profile never sees the update screen without the gate.
