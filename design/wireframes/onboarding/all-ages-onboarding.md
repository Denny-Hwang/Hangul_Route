# Onboarding / All-ages create profile, grown-up PIN, Forgot PIN, avatars (wireframe v1)

Spec: `docs/specs/F-LEARN-001-all-ages-onboarding.md` (§3.2 to §3.7, §3.11)
Audience: **learner (any age, incl. pre-readers)** and, on the child path, the **adult who sets it up**. No kids-only or adults-only framing (CLAUDE.md §1).
Code: `apps/mobile/src/screens/onboarding/CreateProfileScreen.tsx` (route `Onboarding/CreateProfile`), `screens/parent/PinEntryScreen.tsx` (route `PinEntry`), new `PinResetScreen` (route `PinReset`), new `EditProfileScreen` (route `EditProfile`), `screens/profile/ProfileScreen.tsx`, `screens/parent/ParentDashboardScreen.tsx`, `apps/web/src/app/teach/space/page.tsx`
Not respecified here: the Home "Profile" entry label and accessible name (merged in PR #95), the responsive PIN pad sizing (PR #95, `pin-pad-layout.ts`), sticky footer (F-LAYOUT-001), locale chooser on Welcome (F-I18N-001).

This file holds eleven screens or states in one place (house style is one file per screen; split when copied into `design/wireframes/`):

- A. Create profile, step 1 (nothing chosen yet)
- B. Create profile, "My child or a student" (grown-up card with PIN)
- C. Create profile, "Me" (agreement card)
- D. Inline PIN pad (create and confirm)
- E. Add a profile later (grown-up added, family or self-only device)
- F. PIN entry with Forgot PIN
- G. Reset the PIN (Rescue Code and 24-hour wait)
- H. Profile switcher with cubs and level labels
- I. Edit profile
- J. Grown-up dashboard card and teacher roster card
- K. Home Profile entry (the cub and ring change here; the label already exists since PR #95)

All copy in boxes is placeholder or an English suggestion; final strings sit in `LEARNER_LEVELS` and `audience-copy`.

## Scenario (Given-When-Then)

Given: a cold launch with no profile (`Welcome` then `CreateProfile { firstRun: true }`), or a verified or ungated "Add a profile"
When: someone sets up a learner
Then: they say who is learning, then name, reading level and cub; the consent they give matches who they are (a learner 13+ for themselves, or an adult for a child); on a device where a child can reach it, the adult leaves with a PIN already set

## Screen goal

"Tell the app who is learning, in a way that is true for a seven-year-old, a teenager and a grandmother, and never ask anyone to say they are somebody else."

Secondary goal: make the grown-up PIN something an adult creates once, at setup, and can recover.

---

## A. Create profile, step 1

```
┌──────────────────────────────────┐
│                                  │
│  "Who is learning?" (title)      │
│                                  │
│  ┌────────────────────────────┐  │
│  │ ( ) Me                     │  │  <- radio card, >= 80 tall
│  │     I'm 13 or older        │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ ( ) My child or a student  │  │  <- radio card
│  │     A grown-up sets it up  │  │
│  └────────────────────────────┘  │
│                                  │
│  (nothing else is drawn yet)     │
│                                  │
│  [[ CONTINUE ]] disabled         │
│  caption: "Choose who is         │
│            learning"             │
└──────────────────────────────────┘
```

- No card is preselected (consent text depends on the answer).
- No back control on first run (it is the first form after Welcome's "Let's start"); in E a back control sits top-left.

## B. Create profile, "My child or a student"

```
┌──────────────────────────────────┐
│ "Who is learning?"               │
│  (x) My child or a student       │
│  ( ) Me                          │
│                                  │
│  Their name                      │
│  [ text field, 1-12 chars     ]  │
│  (hint line slot, calm)          │
│                                  │
│  How do they like to learn?      │
│  ┌────────────────────────────┐  │
│  │ ( ) Pictures first         │  │
│  │     big tiles, few words   │  │
│  ├────────────────────────────┤  │
│  │ (x) Some reading           │  │  <- middle pre-selected
│  │     short words, sentences │  │
│  ├────────────────────────────┤  │
│  │ ( ) Reads easily           │  │
│  │     stories, conversations │  │
│  └────────────────────────────┘  │
│  "You can change this any time   │
│   in Profile."                   │
│                                  │
│  Pick a Hoya                     │
│  [cub][cub][cub]                 │  <- 5 tinted cubs, wrap to 2 rows
│  [cub][cub]     label under each │     at 320 wide, radio + label
│                                  │
│  ┌ For a grown-up ────────────┐  │
│  │ short line: sets up the    │  │
│  │ account, no ads            │  │
│  │ Email (optional)           │  │
│  │ [ field ]  caption         │  │
│  │ Create a grown-up PIN      │  │
│  │ [ PIN pad, see D ]         │  │
│  │ [ ] I'm a parent or        │  │
│  │     guardian ... and I     │  │
│  │     agree to the Privacy   │  │
│  │     Policy (link)          │  │
│  └────────────────────────────┘  │
│  [Hoya] "Ready to go!" card      │
│  [[ CONTINUE ]]                  │
│  caption slot: next missing step │
└──────────────────────────────────┘
```

## C. Create profile, "Me"

Same as B for sections 2 to 4 with first-person wording ("Your name", "How do you like to learn?"), then:

```
│  ┌ Before you start ──────────┐  │
│  │ short line: little data,   │  │
│  │ no ads                     │  │
│  │ Email (optional)           │  │
│  │ [ field ]  caption         │  │
│  │ [ ] I'm 13 or older and I  │  │
│  │     agree to the Privacy   │  │
│  │     Policy (link)          │  │
│  │ v Protect settings with a  │  │  <- collapsed row, optional
│  │   PIN (optional)           │  │     expands to the pad (D)
│  └────────────────────────────┘  │
```

## D. Inline PIN pad (create, confirm)

```
 Create a grown-up PIN                 Type it again
        o o o o  (dots only)                  o o o .
      [1] [2] [3]                           [1] [2] [3]
      [4] [5] [6]                           [4] [5] [6]
      [7] [8] [9]                           [7] [8] [9]
      [<] [0]                               [<] [0]
  state line slot (empty)               "Those didn't match. Let's start
                                         again." (calm, amber, not red)
```

- Keys are laid out by `pinPadLayout` (PR #95): 3 x 4 with keys 64 dp in the scrolling form; on the full-screen PinEntry it may switch to 4 x 3 or 6 x 2 on short screens.
- 4th digit moves from step "create" to "again" automatically; a matching second entry shows a quiet "PIN set" line in place of the pad, with "Change" to redo.

## E. Add a profile later

```
 from Profile "+ Add a profile"
   gate required?  ----yes----> PinEntry(verify) --ok--> CreateProfile{firstRun:false}
        |
        no (self-only, no PIN) ------------------------> CreateProfile{firstRun:false}

 CreateProfile{firstRun:false}:  A, then
   "My child..." on a device with no guardian consent -> grown-up card (B) with PIN, mandatory
   "My child..." on a family device                     -> no card, no PIN (already set)
   "Me"           on any device that has consent        -> no card
```

- Back control top-left returns to Profile.

## F. PIN entry with Forgot PIN

```
┌──────────────────────────────────┐
│ [x close]                        │
│  "Grown-up zone" (or "Settings   │
│   PIN" on a self-only device)    │
│  "Enter your 4-digit PIN"        │
│        o o . .                   │
│     [PinPad]                     │
│  [[ UNLOCK ]]                    │
│  [ Cancel ]                      │
│  hint / cooldown line slot       │
│  Forgot PIN?  (quiet text button)│  -> G
└──────────────────────────────────┘
```

- "Forgot PIN?" exists only in verify mode. It is plain text with no icon.
- Cooldown state: keypad and Unlock disabled, countdown line (existing behaviour); "Forgot PIN?" stays available.

## G. Reset the PIN

```
┌──────────────────────────────────┐
│ [<- back]                        │
│  "Reset the PIN"                 │
│  "Your learners, cards and       │
│   progress are kept."            │
│                                  │
│  ┌ Use a Rescue Code ─────────┐  │  <- only if a local profile
│  │ [ TIGER-MOON-RIVER-... ]   │  │     has a stored code
│  │ [[ CONTINUE ]]             │  │
│  │ calm line slot             │  │
│  └────────────────────────────┘  │
│                                  │
│  v I don't have the code         │  <- disclosure; open by default
│  ┌ Wait 24 hours ─────────────┐  │     when no code exists
│  │ "You can set a new PIN     │  │
│  │  after <date and time>"    │  │  <- after Start
│  │ [ START THE WAIT ]         │  │  <- becomes SET A NEW PIN when due
│  └────────────────────────────┘  │
└──────────────────────────────────┘
        |  code ok  or  wait due + button
        v
   PinEntry(mode: setup) -> create + confirm -> back to the invoking destination
```

States: waiting (date shown, button disabled), ready (button live), code wrong (calm line, shares the PIN throttle: 5 tries/60 s then 30 s cooldown with countdown), no stored code (card hidden), already unlocked by remembering the PIN (request cleared on the next successful PIN).

## H. Profile switcher

```
┌──────────────────────────────────┐
│ [<- back]                        │
│  "Profiles & settings"           │
│  "Tap a profile to switch."      │
│  ┌──────────┐ ┌──────────┐       │
│  │  [cub]   │ │  [cub]   │       │  <- each learner's own tinted cub
│  │  Mina    │ │  Leo     │       │
│  │  Some    │ │  Reads   │       │  <- level label, never "Age"
│  │  reading │ │  easily  │       │
│  │ Playing  │ │ [ Edit ] │       │
│  │ [ Edit ] │ │          │       │
│  └──────────┘ └──────────┘       │
│  [ + Add a profile ]             │
│  ... stats, sound, plan, backup, │
│      classes, install (existing) │
│  [ Grown-up zone ] / "Account    │
│    & backup" on self-only        │
└──────────────────────────────────┘
```

## I. Edit profile

```
┌──────────────────────────────────┐
│ [<- back]  "Edit profile"        │
│  Name        [ field ]           │
│  Level       three radio cards   │
│  Hoya        five tinted cubs    │
│  Who is learning?  [Me | My child or a student]
│     change to Me: needs the PIN (if any) + "I'm 13 or older ..." box
│     change to child: needs the grown-up card (consent + PIN if none)
│  [[ SAVE ]]                      │
└──────────────────────────────────┘
```

## J. Grown-up dashboard card and teacher roster card

```
 Grown-up dashboard (mobile)             Teacher roster (web /teach)
 ┌──────────────────────────────┐        ┌──────────────────────────────┐
 │ [cub 40]  Mina   [Some       │        │ (o) Mina        [Some reading]│
 │                  reading]    │        │  Last active ...              │
 │ Quests Cards Sessions Minutes│        │  Quests 3 / 12 - 5 cards      │
 │ Recent ...                   │        └──────────────────────────────┘
 └──────────────────────────────┘          (o) = colour chip from the cub's
                                              variant; no name or initial when
                                              the class hides names
```

Pill hidden when the stored id is unknown to this build.

## K. Home Profile entry (glyph only)

```
 ... [ cub in a ring in its own colour ]
     Profile        <- label and accessible name "Profile and settings" exist since PR #95
```

---

## Interaction points

- Radio card (who, level, avatar) tap: select, announce "selected"; one tap, no confirm.
- Section 1 answer: reveals sections 2 to 6 below; changing the answer later swaps the label wording and the bottom card (an already-ticked box is cleared when its wording changes).
- Privacy Policy link: opens the policy in the browser; a failure shows "Open hangulroute.com/privacy in a browser."
- PIN pad 4th digit: advances create to confirm; mismatch clears and restarts with a calm line.
- Continue: enabled only when valid; when disabled, the caption names the next missing step (who, name, agree box, PIN).
- Forgot PIN?: opens G; Rescue Code field: submit on the keyboard's done key; wrong code uses the PIN throttle.
- Edit: opens I behind the PIN gate only when the gate is required.

## Navigation graph

Enter from: `onboarding/welcome` "Let's start" (A, first run) - `profile/settings` "+ Add a profile" (E) - `PinEntry` after a verified PIN with `next: AddProfile` (E)
Exit to: `onboarding/first-quest-preview` (after first run) - `profile/settings` (after add) - `PinEntry` setup (from G) - `profile/settings` (from I)

Enter F from: `profile/settings` grown-up actions (Grown-up zone, Add a profile, Unlock the journey, Save my progress, Restore) when the gate is required
Exit F to: the invoking destination (`parent/dashboard`, `onboarding/create-profile`, `sync/restore`, `sync/save-progress`, `paywall/upgrade`) - `PinReset` (Forgot PIN) - back (Close or Cancel)

## States

- **success**: as drawn; first run ends on `first-quest-preview`.
- **empty**: A (nothing chosen; Continue disabled with a reason). G with no stored Rescue Code (the code card is absent).
- **error**: name hints (too long, not Latin letters) in calm text; invalid email in the amber nudge, never red; PIN mismatch and wrong Rescue Code as calm lines; PIN hashing or storage failure shows "Couldn't set the PIN. Try again." and keeps the entries; privacy link failure as above.
- **offline**: everything works; only the privacy link needs a browser.
- **small phone (320 x 568)**: cards stack, no horizontal scroll, the form scrolls, Continue is last; keypad keys 64 dp.
- **legacy device (no PIN, existing profiles)**: F opens in setup mode on the first gate exactly as today.

## Data needs

- reads: `LEARNER_LEVELS`, `AVATAR_PRESETS` labels, `useAccountStore` (`guardianConsentAcceptedAt`, `selfConsentAcceptedAt`, `parentPinHash`, `pinAttempts`, `pinResetRequestedAt`), `useProfileStore.profiles` (`learnerType`), `useSyncStore.byLearner[id].rescueCode`, hoya variant tokens
- writes: `profiles` (new fields `learnerType`; `updateProfile`), `account:guardianConsentAcceptedAt`, `account:selfConsentAcceptedAt`, `account:parentPinHash`, `account:parentEmail`, `account:pinResetRequestedAt`, telemetry events (no free text)
- never sent to the server: `learnerType`, PIN, email (in this build)

## Open questions

- Should the self path also be offered a nudge to save a Rescue Code, since it is the only recovery for a forgotten PIN? (default: no; the PIN is optional there)
- Does "My child or a student" need a third answer for an adult class run by a teacher on a shared device? (default: no; the teacher chooses "My child or a student" and the PIN protects the device)
- Level descriptions are reader-descriptions today because the level changes nothing yet; revisit wording when F-PLC-001 consumes it.
- Final tint colours for the four non-orange cubs (design step), including a non-colour cue beyond the visible English label.
- Whether the edit screen should also expose "Hide romanization until tap" per profile (belongs to F-I18N-001).
