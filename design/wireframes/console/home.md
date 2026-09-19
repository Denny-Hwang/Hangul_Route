# Console/Home — my spaces hub (wireframe v1)

Spec: `docs/roadmap/multi-persona-sync-platform.md` §1–2 (an adult can own / belong to several spaces), §4 (sync hints), §8 · `docs/blueprints/10-app-map.md` §4.3
Audience: **parent / teacher / school admin**

## Scenario (Given-When-Then)

Given: a signed-in adult with 1+ spaces (family, class, school — possibly mixed: a teacher who is also a parent)
When: they open the console
Then: they see every space they belong to, grouped by kind, with one line of status each, and reach the right surface for it in one tap

## Screen goal

"Pick the space to work in; everything else is one tap away."

## Box diagram

```
+------------------------------------------------------+
| [logo] Console                    [ Account ] [ Billing ] |  <- top bar, always here
|                                                      |
|  Family                                              |
|  +------------------------------------------------+  |
|  | Kim family                                     |  |
|  | 2 learners - last synced today                 |  |  <- 1 status line
|  |                                  [ Open >  ]   |  |  -> parent/dashboard
|  +------------------------------------------------+  |
|                                                      |
|  Classes                                             |
|  +------------------------------------------------+  |
|  | Sunday Class A                                 |  |
|  | 12 students - plan "Week 3" published          |  |
|  | 3 students haven't synced since Tue            |  |  <- hint, neutral tone
|  | 1 re-link request waiting          [ Open > ]  |  |  -> console/roster
|  +------------------------------------------------+  |
|  | Saturday Class B (archived)        [ Open > ]  |  |  <- archived shown dimmed, last
|  +------------------------------------------------+  |
|                                                      |
|  School                                              |
|  +------------------------------------------------+  |
|  | Seoul Hangul School                            |  |
|  | 4 classes - 38 / 300 seats         [ Open > ]  |  |  -> console/school-admin
|  +------------------------------------------------+  |
|                                                      |
|  [ + New space ]                                     |  -> console/onboarding-role
+------------------------------------------------------+
```

- Reading surface: no `[[ ]]` primary CTA. Each row has one secondary [ Open > ].
- Status lines are aggregates only (counts, sync freshness, plan state). No learner names, no percentages here.
- Groups render only when non-empty; a parent-only account sees just "Family".

## Interaction points

- Family row [ Open > ] → `parent/dashboard`
- Class row [ Open > ] → `console/roster` (a pending re-link line deep-links to `console/relink-approval`)
- School row [ Open > ] → `console/school-admin`
- [ Account ] → `console/account` · [ Billing ] → `console/billing`
- [ + New space ] → `console/onboarding-role` (returns here after creation)
- Seat / cap warnings on a row (e.g. "20 / 20 students — placeholder cap") → `console/billing`

## Navigation graph

Enter from: `console/sign-in` (has ≥1 space) · `console/onboarding-role` (when opened from here) · [< back] from any `console/*` screen · `console/school-admin` / `console/roster` breadcrumb
Exit to:    `parent/dashboard` · `console/roster` · `console/school-admin` · `console/account` · `console/billing` · `console/onboarding-role` · `console/relink-approval`

## States

- **success**: groups as above, most recently active space first within each group.
- **empty** (signed in, no memberships — e.g. left every space): one centered card "you're not in any space yet" + [[ CREATE A SPACE ]] → `console/onboarding-role`; [ enter a code I was given ] for teachers invited to a school (account join via space join code, roadmap §8 `/spaces/:id/join`).
- **error** (memberships fetch fails): cached list from last visit with a "showing last known" line + [ TRY AGAIN ]; if no cache, the empty card is *not* shown (would mislead) — error card only.
- **entitlement past_due**: a one-line banner above the groups → `console/billing`; nothing is locked on this screen.

## Data needs

- reads: `memberships` for this account joined to `spaces` (kind, name, archived) · per-space counts (learners, classes) · per-class: latest published plan title, count of learners whose `summary.lastActiveAt` is older than the plan's `published_at` ("haven't synced since"), pending re-link count · school: seats used vs `entitlements.seats`
- writes: none · telemetry: `console_home_viewed{families, classes, schools}`
- copy: F-PAR-001 §3.6 banned-substring lint applies (this is a caregiver surface)

## Open questions

- Sort order across groups when an adult has many classes (school with 10+): alphabetical vs recent activity? Default recent; revisit at S7.
- Should the family group show the child names (parent-only account, no privacy issue) or stay count-only for symmetry with classes? Default count-only; the dashboard is one tap away.
- Teacher free cap value (roadmap §11 Q4: 20 vs 30) is **deferred** — the row warning shows "placeholder cap".
