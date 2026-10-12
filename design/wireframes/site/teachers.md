# Site/Teachers — `/teachers`, running Hangul Route with a class (wireframe v1)

Spec: `docs/specs/F-SITE-002-marketing-site-layered.md` §3.6, §3.8 (links), §3.9 (claims), appendix B.4
Replaces: the landing's only teacher entry, a "For teachers" link straight into the console sign-in (F-CONSOLE-001 §3.6, amended)
Audience: **teachers** — school, Sunday-school, Hangul-school and tutors (teacher surface: may address teachers directly; no age range, no ranking, no price)
Shared chrome: `site/header-footer.md`

## Scenario (Given-When-Then)

Given: a teacher is deciding whether to use Hangul Route with a class
When: they open "Teachers" from the home page or the header
Then: they understand the setup (sign in, share a code, students need no accounts), what they can plan and see, and how student privacy is kept, and they sign in on the app or try it as a learner first

## Screen goal

"Show a teacher that setup takes minutes and students need no accounts, then send them to sign in."

## Box diagram

Phone:

```
+--------------------------------------+
| header (Teachers marked current)     |
+--------------------------------------+
| H1 For teachers                      |
| one-line lead                        |
| [[ SIGN IN AS A TEACHER ]]           |  -> app sign-in ?as=teacher (before the flip: /teach)
| [ Try it as a learner ]              |  -> app (learner start), secondary
+--------------------------------------+
| H2 Set up in minutes                 |
|  1 sign in, create a class space     |
|  2 share the class code (no student emails or accounts)
|  3 students learn on any device with a browser
+--------------------------------------+
| H2 Plan and assign                   |
|  - pick quests for the week          |
|  - or let the planner build a term route
+--------------------------------------+
| H2 See how the class is doing        |
| base line (weekly view; never a ranking)
|  + reports line         (claim teacherReports)
|  + notes line           (claim feedbackNotes)
|  + preview lessons line (claim browseAsLearner)
|  + teach-from-the-front (claim lectureMode)
+--------------------------------------+
| H2 Privacy for classes               |
|  - initials only on the class list   |
|  - no ads, no data sold              |
+--------------------------------------+
| H2 Plans                             |
| cost line (no price) · "managed in the app after you sign in"
+--------------------------------------+
|  > Do students need accounts?        |  <- 3 folded questions
|  > Is there a leaderboard?           |
|  > Can I try it first?               |
+--------------------------------------+
| one closing line                     |
| [[ SIGN IN AS A TEACHER ]]           |
+--------------------------------------+
| footer                               |
+--------------------------------------+
```

Wide: the three setup steps sit in one row; "Plan and assign" and "See how the class is doing" side by side; privacy, plans and questions full width.

## Interaction points

- [[ SIGN IN AS A TEACHER ]] → `siteLinks.signIn('teacher')` (same origin `/teach` until S-10). Telemetry `site.cta_tapped {cta:'sign_in', page:'teachers', place:'hero'|'closing'}`.
- [ Try it as a learner ] → learner app. Telemetry `{cta:'start'}`.
- Folded questions → open in place. Telemetry `site.fold_opened {fold:'faq_students'|'faq_ranking'|'faq_try'}`.

## Navigation graph

Enter from: `site/home` persona card · header / footer "Teachers" · search results · old links to the landing's "For teachers" (they now reach the home page)
Exit to:    app sign-in (teacher) · learner app · `site/learners` · `site/parents` · `site/home` · `/privacy` · `/terms`

## States

- **success** (claims off, today): base lines only, each true today (plan builder, term planner, weekly roll-up, anonymize setting).
- **claims on**: up to four extra lines under "See how the class is doing"; cost line follows the claims.
- **empty**: none — no runtime data.
- **error**: app unreachable → the app host's own page; JavaScript off → everything works; hidden locale → 404 page.

## Data needs

- reads (build time): `landing.persona.teachers`, `landing.plans`, `SITE_CLAIMS`, `site-links` (`signIn('teacher')`, `learnerStart`).
- writes: anonymous `site.*` telemetry only.

## Open questions

- Should the page name the free class size? Default: no number (a plan limit is a commercial claim; standing pricing rule) — the cost line only.
- School admins (F-SCHOOL-001): a separate line? Default: no; schools sign in the same way, and a school line can come with the school plan launch.
