# Onboarding / Setup in steps: who, profile, privacy (wireframe v1)

Spec: `docs/specs/F-LEARN-001-all-ages-onboarding.md` §3.15 (owner decision 2026-10-14, option A). Amends the layout of `onboarding/all-ages-onboarding.md` A to C and E; D (inline PIN pad), F to K are unchanged.
Audience: **anyone setting up a learner**: a learner of any age for themselves, or a parent, guardian or teacher for someone they look after. No age wording on step 1; the "13 or older" statement appears only on the Privacy step.
Code: `apps/mobile/src/screens/onboarding/CreateProfileScreen.tsx` (route `Onboarding/CreateProfile { firstRun }`, one route, three steps held in screen state), rules in `apps/mobile/src/logic/onboarding/setup-steps.ts`; `screens/profile/EditProfileScreen.tsx` (route `EditProfile`) for panel G.

Panels:

- A. Step 1, Who is learning (320 dp)
- B. Step 2, Profile (320 dp)
- C. Step 3, Privacy, "Me" (320 dp)
- D. Step 3 after "I'm under 13" (320 dp)
- E. Step 3, Privacy, "Someone I look after" (320 dp)
- F. Tablet (768 and wider), step 1 and step 3
- G. Edit profile, becoming "Me"
- H. States: incomplete, error, offline, add a profile later

Copy in boxes is the English the spec fixes in §3.15; everything else is a placeholder. Strings live in `packages/i18n` (`learner.createProfile`, `learner.editProfile`) with `es` and `ko`.

## User scenario (Given-When-Then)

Given: a cold launch with no profile (Welcome "Let's start" then `CreateProfile { firstRun: true }`), or "+ Add a profile" (behind the PIN when the gate is required)
When: someone sets up a learner
Then: they first say who is learning (nobody is asked an age, and they are told the answer does not change the lessons), then name, reading level and cub, then, on a step of its own, the agreement that fits them (a learner who is 13 or older for themselves, or a grown-up who agrees and creates the PIN); then the level check and the suggested plan, as today

## Screen goal

"One small question per step, and the privacy agreement clearly separate from anything that shapes the lessons."

Secondary goal: a learner under 13 who picked "Me" can hand over to a grown-up on the Privacy step without starting again.

---

## A. Step 1, Who is learning (320 dp)

```
┌────────────────────────────────┐
│ (no back on first run;         │
│  [<- back] when adding later)  │
│ "Step 1 of 3" (caption)        │
│ "Who is learning?" (title)     │  <- focus lands here
│                                │
│ ┌────────────────────────────┐ │
│ │ ( ) Me                     │ │  <- radio card, >= child target
│ │     I'm setting this up    │ │
│ │     for myself.            │ │
│ └────────────────────────────┘ │
│ ┌────────────────────────────┐ │
│ │ ( ) Someone I look after   │ │  <- radio card
│ │     (a child or a student) │ │
│ │     I'm a parent, guardian │ │
│ │     or teacher, setting it │ │
│ │     up for them.           │ │
│ └────────────────────────────┘ │
│                                │
│ "This doesn't change the       │  <- plain caption; second sentence
│  lessons. The level check      │     only when the level check is on
│  comes next and sets them."    │
│                                │
│ [[ CONTINUE ]]  disabled       │
│ "Choose who is learning"       │  <- missing-step caption
└────────────────────────────────┘
```

- Nothing is preselected (L4). No number, age range or "older/younger" anywhere on the step.
- After "I'm under 13" (D) the step is latched: "Me" is drawn disabled (sunken surface, muted label, announced unavailable), "Someone I look after" is checked, and the caption "A grown-up finishes setting this up." sits under the cards.
- Continue -> B.

## B. Step 2, Profile (320 dp)

```
┌────────────────────────────────┐
│ [<- back]                      │  -> A, answers kept
│ "Step 2 of 3"                  │
│ "Your profile" / "Their        │  <- heading follows the answer
│  profile" (title)              │
│                                │
│ Your name / Their name         │
│ [ text field, 1-12 chars    ]  │
│ (calm hint line slot)          │
│                                │
│ How do you / they like to      │
│ learn?                         │
│ ┌────────────────────────────┐ │
│ │ ( ) Pictures first         │ │
│ │ (x) Some reading           │ │  <- middle preselected (L5)
│ │ ( ) Reads easily           │ │
│ └────────────────────────────┘ │
│ "You can change this any time  │
│  in Profile."                  │
│                                │
│ Pick a Hoya                    │
│ [cub][cub][cub]                │  <- five tinted cubs + label,
│ [cub][cub]                     │     wrap to two rows
│                                │
│ (last step only: Ready card)   │
│ [[ CONTINUE ]]                 │  -> C/E, or creates the profile
│ "Type a name"                  │     when no Privacy step is needed
└────────────────────────────────┘
```

## C. Step 3, Privacy, "Me" (320 dp)

```
┌────────────────────────────────┐
│ [<- back]                      │  -> B, values kept
│ "Step 3 of 3"                  │
│ "Privacy" (title)              │
│ ┌ Before you start ──────────┐ │
│ │ short line: little data,   │ │
│ │ no ads                     │ │
│ │ Email (optional)           │ │
│ │ [ field ]  caption         │ │
│ │ + Protect settings with a  │ │  <- collapsed, optional (D of
│ │   PIN (optional)           │ │     all-ages-onboarding.md)
│ │ [ ] I'm 13 or older and I  │ │  <- checkbox
│ │     agree to the Privacy   │ │
│ │     Policy.                │ │
│ │     Read the Privacy Policy│ │  <- link -> hangulroute.com/privacy
│ └────────────────────────────┘ │
│ I'm under 13                   │  <- quiet text button -> D
│                                │
│ "Agreeing doesn't change the   │
│  lessons."                     │
│ [Hoya] Ready to go! card       │
│ [[ CONTINUE ]]                 │  -> level check fork / preview
│ "Tick the box to agree"        │
└────────────────────────────────┘
```

## D. Step 3 after "I'm under 13" (320 dp)

```
┌────────────────────────────────┐
│ [<- back]                      │  -> B (still "Your profile")
│ "Step 3 of 3"                  │
│ "Privacy"                      │
│ "A grown-up finishes this      │  <- note; focus lands here
│  step: they agree and create a │
│  PIN. The name and Hoya stay   │
│  the same."                    │
│ ┌ For a grown-up ────────────┐ │
│ │ short line: a parent,      │ │
│ │ guardian or teacher sets   │ │
│ │ it up; no ads              │ │
│ │ Email (optional) [ field ] │ │  <- cleared: the learner typed it
│ │ Create a grown-up PIN      │ │
│ │   o o o o                  │ │
│ │ [1][2][3] [4][5][6]        │ │  <- PinPad, 64 dp keys
│ │ [7][8][9] [<][0]           │ │
│ │ [ ] I'm a parent or        │ │  <- unticked after the switch
│ │     guardian of this       │ │
│ │     learner ... Privacy    │ │
│ │     Policy.                │ │
│ │     Read the Privacy Policy│ │
│ └────────────────────────────┘ │
│ "Agreeing doesn't change the   │
│  lessons."                     │
│ [Hoya] Ready to go! card       │
│ [[ CONTINUE ]]                 │
│ "Tick the box to agree" /      │
│ "Create the PIN"               │
└────────────────────────────────┘
```

- No "I'm under 13" button here. The statement is latched for the form: Back walks B and A with every value kept, but "Me" stays disabled on A and Continue brings D back. Leaving the screen starts a fresh form.
- Nothing is stored and no event fires on the switch; Continue runs the guardian path (§3.3).

## E. Step 3, Privacy, "Someone I look after" (320 dp)

Same as D without the note: the grown-up card (email, mandatory PIN when the device has none, guardian checkbox, link), the plain line, Ready card, Continue.

## F. Tablet (768 and wider)

```
┌──────────────────────────────────────────────────────┐
│            ┌──────────────────────────────┐          │
│            │ "Step 1 of 3"                │          │
│            │ "Who is learning?"           │          │
│            │ ┌──────────────────────────┐ │          │
│            │ │ ( ) Me                   │ │          │
│            │ │     I'm setting this up  │ │          │
│            │ │     for myself.          │ │          │
│            │ └──────────────────────────┘ │          │
│            │ ┌──────────────────────────┐ │          │
│            │ │ ( ) Someone I look after │ │          │
│            │ │     (a child or a        │ │          │
│            │ │     student) ...         │ │          │
│            │ └──────────────────────────┘ │          │
│            │ lessons line                 │          │
│            │ [[ CONTINUE ]]               │          │
│            └──────────────────────────────┘          │
│        one centred column at the Screen width;       │
│        steps 2 and 3 use the same column, the PIN    │
│        pad stays 3 x 4 with 64 dp keys               │
└──────────────────────────────────────────────────────┘
```

- Nothing goes side by side on a tablet: the order of questions is the point of this change.

## G. Edit profile, becoming "Me"

```
┌────────────────────────────────┐
│ [<- back]  "Edit profile"      │
│ Name / Reading level / Hoya    │  (unchanged, §3.11)
│ Who is learning?               │
│  (x) Me                        │
│  ( ) Someone I look after ...  │
│ "This doesn't change the       │
│  lessons."                     │
│ ── Privacy ───────────────────│  <- own block, shown only when the
│ [ ] I'm 13 or older and I      │     who change needs a consent
│     agree to the Privacy       │
│     Policy.                    │
│     Read the Privacy Policy    │
│ I'm under 13                   │  -> who row back to "Someone I
│ "Agreeing doesn't change the   │     look after", block hidden,
│  lessons."                     │     caption "This profile stays
│ [[ SAVE ]]                     │     with a grown-up."; "Me" then
│                                │     disabled until the screen is left
└────────────────────────────────┘
```

## H. States

| State | What shows |
|---|---|
| Incomplete | Continue disabled; one calm caption under it naming the step's next gap: "Choose who is learning" (A), "Type a name" / "Check the name" hint (B), "Tick the box to agree", "Create the PIN", "Check the email, or leave it empty" (C to E). Never red. |
| PIN mismatch | "Those didn't match. Let's start again." under the pad, amber nudge (D of all-ages-onboarding.md). |
| PIN hash failure | "Couldn't set the PIN. Try again." under the pad; entries kept; no profile created. |
| Policy link fails (offline, no browser) | "Open hangulroute.com/privacy in a browser." under the link. |
| Offline | The whole flow is local; nothing else changes. |
| Add a profile later, consent already on the device | No Privacy step: B is "Step 2 of 2", carries the Ready card, and its Continue creates the profile. |
| Add a child on a self-only device | C is replaced by E with the mandatory PIN. |
| Add a child, guardian consent on the device but no PIN | E shows only the PIN pad: no checkbox, so no "Agreeing doesn't change the lessons." line. |
| Empty | Not applicable: there is no list on these steps. |
| Loading | None: no network on any step. |

## Interaction points

- Radio card (A): selects the answer; Continue enables. Changing it later keeps name, level, cub and email, clears the box and the PIN.
- Continue (A, B): next step, scroll to top, focus on the new heading. Continue on the last step: `submitProfile`.
- Back control / Android back (B to E): previous step, nothing cleared. On A: leave the screen (Profile when adding later; Welcome on first run via system back only). The iOS swipe-back is off on B to E (native-stack cannot cancel it) and on as today on A.
- "I'm under 13" (C): the switch to D, focus on the note.
- Checkbox, link, PIN pad, optional PIN row: as §3.3 / §3.4.

## Navigation graph

```
Welcome --"Let's start"--> A --> B --> C --Continue--> PlacementInvite (level check on) | FirstQuestPreview (off)
                                    \--> E --Continue--> (same)
                               C --"I'm under 13"--> D --Continue--> (same)
Profile --"+ Add a profile"--> [PinEntry when gated] --> A --> B --> (C/E only when a consent or PIN is needed) --> PlacementInvite | FirstQuestPreview
Profile --Edit--> [PinEntry when gated] --> G --Save--> Profile
```

## Data needs

- Reads (local): `account-store` `guardianConsentAcceptedAt`, `selfConsentAcceptedAt`, `parentPinHash` (decide whether C/E is drawn and whether the PIN is mandatory); `flags.placementEnabled` + bundled bank (the second sentence of the lessons line and the route after Continue).
- Writes (local, on the last Continue only): consent timestamp, PIN hash, optional email, the profile (`learnerType`, `ageGroup`, `avatar`, `displayName`). Nothing is written when moving between steps or on the under-13 switch.
- Telemetry: unchanged (`onboarding.who_selected` once, `level_selected`, `consent_given { basis }`, `pin.created`, `onboarding.started`); `learnerType` is never sent.

## Open questions

- None blocking. Counsel's review of the plain "13 or older" statement (§9 item 7) is unchanged by this layout and still gates the store release, not the code.
