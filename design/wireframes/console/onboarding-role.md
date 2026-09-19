# Console/Onboarding-role — pick a role, create the first space (wireframe v1)

Spec: `docs/roadmap/multi-persona-sync-platform.md` §1 (personas), §2 (`spaces`, `memberships`), §6 step 1, §8 `POST /spaces` · `docs/specs/F-TCH-001-teacher-classroom.md` §3.1
Audience: **parent / teacher / school admin** (first sign-in only)

## Scenario (Given-When-Then)

Given: an adult just signed in for the first time and owns no space
When: they land here
Then: they pick who they are (parent / teacher / school admin) and, with one more step, own their first space — a teacher sees the class join code immediately so it can go on the board today

## Screen goal

"Create exactly one space of the right kind and hand the adult its first useful thing (join code, or the learner-link step)."

## Box diagram

```
Step 1 - role                              Step 2 - name + create
+------------------------------------+     +------------------------------------+
| [< back to sign-in]                |     | [< back]                           |
|                                    |     |                                    |
|  "Who are you?" (placeholder)      |     |  Space name                        |
|                                    |     |  [ text field, prefilled:          |
|  +------------------------------+  |     |    "<name> family" / "Class A" /   |
|  | [ ] Parent / caregiver       |  |     |    "<school>" ]                    |
|  |     1 line: home, my kids    |  |     |                                    |
|  +------------------------------+  |     |  (teacher only)                    |
|  | [ ] Teacher                  |  |     |  "Students join with a code -      |
|  |     1 line: my class         |  |     |   no accounts for kids" (1 line)   |
|  +------------------------------+  |     |                                    |
|  | [ ] School admin             |  |     |  [[ CREATE ]]                      |
|  |     1 line: teachers + classes| |     +------------------------------------+
|  +------------------------------+  |
|                                    |     Step 3 (teacher path only) - code
|  [[ CONTINUE ]]                    |     +------------------------------------+
+------------------------------------+     |  "Your class code"                 |
                                           |  +----------------------------+    |
  Parent path -> family space              |  |      K 7 M 2 X 9           |    |  <- large, read-aloud size
  Teacher path -> class space              |  +----------------------------+    |
  Admin path   -> school space             |  expires in 30 days - [ copy ]     |
                                           |  "Write it on the board" (1 line)  |
                                           |  [[ GO TO MY CLASS ]]              |
                                           +------------------------------------+
```

- One role per account at onboarding; more spaces of any kind can be added later from `console/home` (a teacher can also be a parent).
- Role cards are radio-style; the first tap does not auto-advance (choice → recommend, not force).

## Interaction points

- Role card tap → selects; [[ CONTINUE ]] → step 2 with the matching prefill
- [[ CREATE ]] → `POST /spaces {kind}` + owner membership (`role: owner`; teachers also `teacher`, admins also `admin`)
  - parent → `parent/dashboard` (empty state there guides "link your learners")
  - teacher → step 3 (join code, roadmap §6 step 1) → [[ GO TO MY CLASS ]] → `console/roster`
  - school admin → `console/school-admin` (empty state there shows the teacher invite code)
- [ copy ] → clipboard; no share sheet on web
- [< back] → previous step; from step 1 → `console/sign-in` (signs out)

## Navigation graph

Enter from: `console/sign-in` (first sign-in, no space) · `console/home` "+ New space" (returns to home instead of the role-specific landing)
Exit to:    `parent/dashboard` · `console/roster` · `console/school-admin` · `console/home` (when opened from home) · `console/sign-in` (back)

## States

- **success**: step 3 for teachers; direct landing for parents / admins.
- **empty**: n/a — this screen *creates* the first record. If the adult already has a space (deep link), skip straight to `console/home`.
- **error**:
  - create fails (network / 5xx) → stay on step 2, inline "couldn't create it yet" + [ TRY AGAIN ]; nothing is partially created (space + membership in one call).
  - join code generation fails → space exists; step 3 shows "code not ready" + [ TRY AGAIN ] which calls `POST /spaces/:id/code`.

## Data needs

- reads: Clerk profile (display name for the prefill)
- writes: `spaces` (kind, name, owner_account_id, join_code for class) · `memberships` (account, owner + role) · `settings_json` defaults (`anonymize_roster` on for school-owned classes)
- telemetry: `console_onboarding_role_picked{role}`, `console_space_created{kind}`

## Open questions

- Should a family space also get a join code at creation (co-parent invite, roadmap §2 comment) or only on demand from `console/space-settings`? Default: on demand — avoids showing parents a code they don't need yet.
- Consent mode for school-owned classes (roadmap §11 Q1) is **deferred**; step 2 for teachers deliberately has no consent choice so the flow does not change either way.
- "School admin" wording for 한글학교 volunteers — "School organizer"? Validate in the F-TCH-001 pilot.
