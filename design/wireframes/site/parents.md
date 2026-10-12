# Site/Parents — `/parents`, what a parent needs to know (wireframe v1)

Spec: `docs/specs/F-SITE-002-marketing-site-layered.md` §3.5, §3.8 (links), §3.9 (claims), appendix B.3
Replaces: the landing's "For parents" section and pricing aside, and the header's "Dashboard" link to the `/parent` demo
Audience: **parents and other caregivers** (caregiver surface: may address parents directly; still no age range, no price)
Shared chrome: `site/header-footer.md`

## Scenario (Given-When-Then)

Given: a parent wants to know whether Hangul Route is safe, what their learner will do and what they will be able to see
When: they open "Parents" from the home page or the header
Then: they get those three answers in short blocks and either sign in on the app (to set up a family space and follow along) or hand the device over and start learning

## Screen goal

"Reassure a parent in one read and send them to sign in on the app."

## Box diagram

Phone:

```
+--------------------------------------+
| header (Parents marked current)      |
+--------------------------------------+
| H1 For parents                       |
| one-line lead                        |
| [[ SIGN IN AS A PARENT ]]            |  -> app sign-in ?as=parent (before the flip: /teach)
| [ Start learning ]                   |  -> app (learner start), secondary
+--------------------------------------+
| H2 What they learn                   |
| one line · "What learners do" >      |  -> site/learners
+--------------------------------------+
| H2 Safe by design                    |
|  - no ads, no data sold              |
|  - data stays on the device until a grown-up signs in
|  - grown-up gate for money and deleting
|  - siblings share a device, each keeps their own stars and cards
+--------------------------------------+
| H2 Follow along                      |
| base line (family space: the week at a glance)
|  + reports line          (claim parentReports)
|  + encouragement notes   (claim feedbackNotes)
|  + browse lessons as your learner sees them (claim browseAsLearner)
+--------------------------------------+
| H2 Plans                             |
| cost line (no price) · "managed in the app after you sign in"
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

- [[ SIGN IN AS A PARENT ]] → `siteLinks.signIn('parent')`: app sign-in with the `?as=parent` hint (same origin `/teach` until S-10). Telemetry `site.cta_tapped {cta:'sign_in', place:'hero'|'closing', page:'parents'}`.
- [ Start learning ] → learner app. Telemetry `{cta:'start'}`.
- "What learners do" → `site/learners`.
- Folded questions → open in place. Telemetry `site.fold_opened {fold:'faq_account'|'faq_learn_along'|'faq_what_see'}`.

## Navigation graph

Enter from: `site/home` persona card · header / footer "Parents" · search results
Exit to:    app sign-in (parent) · learner app · `site/learners` · `site/teachers` · `site/home` · `/privacy` · `/terms` · `/about`

## States

- **success** (claims off, today): "Follow along" shows only the base line, which is true today on the console's family space.
- **claims on**: up to three extra lines under "Follow along"; the "What can I see?" answer adds the reports line; the cost line follows `freePlan` / `paidPlans`.
- **empty**: none — the page has no runtime data.
- **error**: app sign-in unreachable → the app host's own page (the site shows no error); JavaScript off → everything works; hidden locale → 404 page.

## Data needs

- reads (build time): `landing.persona.parents`, `landing.plans`, `SITE_CLAIMS`, `site-links` (`signIn('parent')`, `learnerStart`).
- writes: anonymous `site.*` telemetry only. No form, no email field on this page.

## Open questions

- Should the parent page show a static picture of the family view? Default: no picture until the parent home on the app is final (persona app shell spec); text only, so nothing goes stale.
- "Follow along" base line names the family space and its code; confirm the term "family space" with the persona app shell spec's wording before S-3. Default: "family space", as the console says today.
