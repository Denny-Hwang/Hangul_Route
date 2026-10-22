# Site / `/parents` and `/teachers` — create first, sign in second, see the product (wireframe)

Spec: `docs/specs/AMENDMENTS-SITE-NEWUSER.md` §3.5, §3.6, §3.13 (amends F-SITE-002 §3.5, §3.6), row SN-1. Earlier
frames: `parents.md`, `teachers.md`.
Audience: a parent, grandparent or caregiver; a teacher or a school's coordinator. Most have no account yet.

## User scenario (Given-When-Then)

- Given a teacher who has never used Hangul Route opens `/teachers`,
- When they decide to try it with a class,
- Then the biggest button creates a free class (no "Sign in" wall first), a quiet line under it serves the few who
  already have an account, and before deciding they can see the real class page and a Lecture mode slide.
- And a school coordinator finds, on the same page, how a whole school works (admins, moves, size) without a new page.

## Screen goal

1. Primary: create a free family space / a free class (`/signin?mode=create&persona=<p>`).
2. Secondary: try the app as a learner (unchanged); tertiary text link: sign in.

## Box diagram

Page head, both pages (phone stacks, wide puts the two buttons on one row):

```
│ H1 + lead (unchanged)                                     │
│ [[ CREATE A FREE FAMILY SPACE ]]  [ Start learning ]      │  ← /teachers: CREATE A FREE CLASS · Try it as a learner
│ Already have an account? Sign in                          │  ← one text link, 64 px tall, under the buttons
```

`/parents` body (wide: two columns as today):

```
│ What they learn          │ Follow along (lines)             │
│ Safe by design           │ ┌phone┐ ← report capture (alt)   │
│                          │ │     │                          │
│                          │ └─────┘                          │
│                          │ Plans                            │
│ questions (folded) · closing: line + [[CREATE…]] + "Already have an account? Sign in" │
```

`/teachers` body:

```
│ Set up in minutes 1 · 2 · 3                                         │
│ Plan and assign            │ See how the class is doing              │
│ ┌ class page capture ────┐ ┌ Lecture mode slide (dark frame) ─┐      │  ← one row wide, stacked on phones
│ └────────────────────────┘ └──────────────────────────────────┘      │
│ H2: Use it across a whole school                                     │  ← NEW section
│  - create a school space, invite teachers or create classes          │
│  - up to {admins} more administrators, invite link, what they can do │
│  - move a student to another class, family told, no new code         │
│  - up to {students} students; more: write to {email} (OD-SN-13)      │
│ Privacy for classes · Plans · questions · closing (create + sign in) │
```

States:
- **Success**: as drawn, with today's claims (`SITE_CLAIMS`).
- **Empty**: none (static).
- **Error**: a capture that fails keeps its frame size and shows its alt text.
- **Claims**: lines behind claims behave as in F-SITE-002 §3.9; the schools section is not behind a claim (school
  administrators, the school cap and teacher moves are live: SA-1 to SA-6 #762, TV-B to TV-D #696 #700 #701).
  **Captures follow claims** (review round 3): the report capture shows only under `parentReports` in the page's locale,
  the class page capture only under `teacherReports`, the Lecture mode slide only under `lectureMode`; a capture whose
  claim is off is not rendered (the media row keeps the other one, full width; with both off the row is gone). No
  capture shows a feature whose claim is off: the class page capture is the class code, join link and "This week" (no
  student cards, which carry the Learning Route row and the level check's starting spot).

## Interaction points

- CREATE (head and closing) → `siteLinks.createAccount(persona, locale)` = `${grownUpOrigin()}/signin?mode=create&persona=<p>` plus
  `&lang=<locale>` from `/es`, `/ko`; `signin/page.tsx` already opens the create view for `mode=create`.
- "Already have an account? Sign in" → `siteLinks.signIn(persona, locale)` (the persona intro, with `lang`).
- Start learning / Try it as a learner → learner app (unchanged).
- The email address in the schools section is plain text inside the sentence (it is a value, `CONTACT_EMAIL`); the
  footer's Contact link stays the tappable one (no new small inline link on the page).

## Navigation graph

- Enter from: the home hero's "I'm a parent / I'm a teacher", the `#who` cards, the header nav (wide), the footer.
- Exit to: `/signin?mode=create&persona=…`, `/signin?persona=…`, the learner app, `/learners` (parents' "What learners do").

## Data needs

- `SCHOOL_ADMIN_CAP` (2) and `SCHOOL_LEARNER_CAP` (50) from `@hangul-route/content-schema`, `CONTACT_EMAIL`, passed into
  the strings. Captures per locale from `public/site/<locale>/`.

## Open questions

- OD-SN-4: a future `/schools` page is the owner's call; this pass adds a section to `/teachers` only.
- OD-SN-5: the secondary "Start learning" stays on `/parents` (default) — it lets a parent try the first quest before
  making anything.
