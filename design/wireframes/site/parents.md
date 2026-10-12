# Site/Parents — `/parents`, what a parent or caregiver needs to know (wireframe v2)

Spec: `docs/specs/F-SITE-002-marketing-site-layered.md` §3.5, §3.8 (links), §3.9 (claims), appendix B.3
Replaces: the landing's "For parents" section and pricing aside, and the header's "Dashboard" link to the `/parent` demo
Audience: **parents, grandparents and other caregivers** (caregiver surface: may address them directly; still no age range, no price)
Shared chrome: `site/header-footer.md`

## Scenario (Given-When-Then)

Given: a parent or caregiver wants to know whether Hangul Route is safe, what their learner will do and what they will be able to see
When: they open "Parents" from the home page, the wide header or the footer
Then: they get those three answers in short blocks and either sign in on the app (to set up a family space and follow along) or hand the device over and start learning

## Screen goal

"Reassure a parent or caregiver in one read and send them to sign in on the app."

## Box diagram

Phone:

```
+--------------------------------------+
| header (one row: brand, Sign in)     |
+--------------------------------------+
| H1 For parents and caregivers        |
| one-line lead (parents, grandparents, every caregiver)
| [[ SIGN IN AS A PARENT ]]            |  -> /signin?persona=parent (same origin until CONSOLE_ORIGIN, then app host)
| [ Start learning ]                   |  -> app (learner start), secondary
+--------------------------------------+
| H2 What they learn                   |
| one line · "What learners do" >      |  -> site/learners
+--------------------------------------+
| H2 Safe by design                    |
|  - no ads, no data sold              |
|  - nickname and progress kept on the device and backed up to our servers
|    (restore with a Rescue Code); a class or family a learner joins with a code
|    sees the joining name and their progress; family grown-ups can restore it
|  - grown-up gate for money and deleting
|  - siblings share a device, each keeps their own stars and cards
+--------------------------------------+
| H2 Follow along                      |
| base line (family space: the week at a glance)
|  + reports: today, week, month, all time   (claim parentReports)
|  + open each learner's Learning Route      (claim learningRoute)
|  + encouragement notes                     (claim feedbackNotes)
|  + with the Family Plan, browse lessons    (claim browseAsLearner AND paidPlans = inApp)
+--------------------------------------+
| H2 Plans                             |
| free line (+ "more stages are coming" while plans are coming)
| "managed at app.hangulroute.com after you sign in"  (host named once)
+--------------------------------------+
|  > Does my learner need an account?  |  <- 3 folded questions
|  > Can I learn alongside them?       |
|  > What can I see?                   |
+--------------------------------------+
| one closing line                     |
| [[ SIGN IN AS A PARENT ]]            |
+--------------------------------------+
| footer                               |
+--------------------------------------+
```

Wide: two columns under the h1 — left "What they learn" + "Safe by design", right "Follow along" + "Plans"; questions and closing full width.

## Interaction points

- [[ SIGN IN AS A PARENT ]] → `siteLinks.signIn('parent')` = `/signin?persona=parent` (F-APP-001 §3.7: parent intro, Parent or caregiver preselected on `/start` for a new account). Never `/teach`, so a parent never enters the teacher flow.
- [ Start learning ] → learner app.
- "What learners do" → `site/learners`.
- Folded questions → open in place.
- No billing link: plans are named, never priced, and managed after sign-in (F-BILL-002).

## Navigation graph

Enter from: `site/home` persona card · wide header / footer "Parents" · search results
Exit to:    app sign-in (parent) · learner app · `site/learners` · `site/teachers` · `site/home` · `/privacy` · `/terms` · `/about`

## States

- **success** (claims off, today): "Follow along" shows only the base line, which is true today on the console's family space.
- **claims on**: up to four extra lines under "Follow along"; the browse line needs paid plans on sale too; the "What can I see?" answer switches to its reports variant (`faq.whatSee.reports`); the cost line follows `freePlan` / `paidPlans`.
- **empty**: none — the page has no runtime data.
- **error**: app sign-in unreachable → the app host's own page (the site shows no error); JavaScript off → everything works; hidden locale → 404 page.

## Data needs

- reads (build time): `landing.persona.parents`, `landing.plans`, `SITE_CLAIMS`, `CLAIM_REQUIRES_PAID`, `site-links` (`signIn('parent')`, `learnerStart`).
- writes: nothing. No form, no email field on this page.

## Open questions

- Should the parent page show a static picture of the family view? Default: no picture until the parent home on the app is final (F-APP-001 A-5b); text only, so nothing goes stale.
- "Family space" is the term F-APP-001 and the console use ("family space", "Family settings"); keep it. Re-check before S-3.
