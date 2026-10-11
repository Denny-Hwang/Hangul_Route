# Placement: the level check, from the "I already know some Korean" fork to the result, the parent report and the roster line (wireframe v2: three check lengths)

Spec: `docs/specs/F-PLC-001-placement-test.md` (section 3.1 flow, 3.2 test language and sound guide, 3.5 engine, 3.6 result, 3.7 route seed, 3.9 grown-up and teacher surfaces, 3.10 entry points)
Audience: anyone learning Hangul, any age (CLAUDE.md section 1). The learner screens work for a child alone (big targets, spoken prompts) and for an adult (short, quiet). Grown-up and teacher screens are separate and behind the PIN gate or in the console.
Code (planned): `screens/onboarding/PlacementInviteScreen.tsx`, `screens/placement/{LanguageScreen,OptionsScreen,HandoffScreen,WarmupScreen,SoundNeededScreen,ItemScreen,PauseSheet,ResultScreen}.tsx`, `screens/parent/PlacementReportScreen.tsx`, `screens/home/HomeScreen.tsx` (card), `screens/profile/ProfileScreen.tsx` (row), `screens/journey/JourneyScreen.tsx` (placed-out look), `apps/web/src/app/teach/space/page.tsx` (roster line)
Notation: `[[ X ]]` the one primary action, `[ X ]` secondary or ghost, `~~ ko ~~` taught Korean drawn with `KoreanText`, `(o)` / `( )` a radio, `[x]` a switch on. No colours, no fonts, no pixel sizes, no final copy: every sentence in a box is a placeholder that says what the sentence does.

This file holds the screens in one place (house style is one file per screen; split when promoted to `design/wireframes/placement/`):

- A. Fork (`placement/invite`)
- B. Test language (`placement/language`)
- C. Options (`placement/options`): C1 the pre-filled card (*Pictures first*), C2 the full screen with the three lengths
- C3. Hand-off (`placement/handoff`)
- D. Warm-up (`placement/warmup`)
- E. Items: five question formats, "not sure", exit (`placement/item`)
- E2. Short items (`placement/item`, Short layout, promoted as `item-short`)
- F. Pause (`placement/pause`) and F2. Rest card (Deep)
- G. Result: new route, stories only, route unchanged (`placement/result`)
- H. Entry points: Home card, Profile row (`home/todays-mission`, `profile/settings`)
- I. Journey: placed-out look and the start pin (`journey/grid`)
- J. Parent report and "choose a different start" (`parent/placement-report`)
- K. Console roster line and "suggest a different start" (`console/roster`)
- L. Empty, error, offline and no-sound states, and L2. Sound needed (`placement/sound-needed`)

## Scenario (Given-When-Then)

Given: someone has just made a profile (or opens the check later from Home, Profile or the parent report) and may already know some Korean
When: they choose "I already know some Korean", pick the language of the check, and answer a short run of friendly questions
Then: Hoya shows where their route starts, the Journey cursor skips what they know without marking it done, a grown-up can read a plain report, and nobody sees a score

## Screen goal

"Find a good starting spot in a few minutes (Short), usually under ten (Standard) or carefully (Deep), in the learner's own language, without a single number or a wrong-answer sound, and without taking anything away from the route they already have." (F-PLC-001 AM-15 to AM-42, W-1)

---

## A. Fork (`placement/invite`) — after CreateProfile, before the first-quest preview

```
┌──────────────────────────────────┐
│ (no back: the profile exists)     │
│        [Hoya waves]               │
│  "Where should we start?" (hear)  │  <- spoken once, replay button
│                                   │
│ ┌───────────────────────────────┐ │
│ │ [icon: seed]                  │ │
│ │ "I am new to Korean"          │ │  <- equal size, equal weight
│ └───────────────────────────────┘ │
│ ┌───────────────────────────────┐ │
│ │ [icon: speech bubble]         │ │
│ │ "I already know some Korean"  │ │
│ │ a few minutes                 │ │
│ └───────────────────────────────┘ │
│  one line: you can stop any time  │
└──────────────────────────────────┘
```

- "I am new to Korean" -> `onboarding/first-quest-preview` (unchanged); records only that the fork was declined.
- "I already know some Korean" -> B (or C when only one language ships).
- Neither choice is a default; neither looks like a warning or a reward.

## B. Test language (`placement/language`) — only when more than one language ships

```
┌──────────────────────────────────┐
│ [<]  "Pick the language for the   │
│       check" (hear)               │
│ ┌──────────┐ ┌──────────┐ ┌─────┐ │
│ │ English  │ │ 한국어    │ │Espa-│ │  <- endonyms; default = the app language,
│ │   (o)    │ │   ( )    │ │ ñol │ │     already selected
│ └──────────┘ └──────────┘ └─────┘ │
│  tapping a tile speaks one short  │
│  instruction in that language     │
│  [ no Korean voice here ]         │  <- shown instead of the 한국어 tile's
│                                   │     radio when no Korean voice exists
│  [ no voice for this language     │  <- under an en / es tile whose instruction
│    here ]                         │     voice is missing: still selectable,
│                                   │     but Short is unavailable (W-5)
│ [[ CONTINUE ]]                    │
│  note: this does not change the   │
│  app language                     │
└──────────────────────────────────┘
```

- Choosing a language changes the instructions, Hoya's lines and the picture labels read by screen readers; the Korean being tested is the same in every language.
- Back goes to A.

## C. Options (`placement/options`) — a grown-up screen; every label is spoken when tapped (W-3)

```
C1. Pictures first (levelOrder 0) with Short pre-selected — one pre-filled card
┌──────────────────────────────────┐
│ [<]  "Set up the check" (hear)    │
│ ┌───────────────────────────────┐ │
│ │ [icon: ear] Short              │ │  <- pre-selected; help + duration lines
│ │ picture and sound questions    │ │
│ │ just a few minutes   [ Change ]│ │  <- opens C2
│ └───────────────────────────────┘ │
│ [[ (icon) START ]]                │  <- nothing else to read or choose -> C3 hand-off
└──────────────────────────────────┘

C2. Everyone else: Standard pre-selected (any levelOrder), after Change, or after "Check without sound" (L2)
┌──────────────────────────────────┐
│ [<]  "A few choices" (hear)       │
│ How long?                         │
│ ┌────────┐ ┌────────┐ ┌────────┐  │
│ │ Short  │ │Standard│ │ Deep   │  │  <- three equal tiles; one pre-selected; no badge
│ │ (help) │ │ (help) │ │ (help) │  │     duration line under each, hidden with Take my time
│ └────────┘ └────────┘ └────────┘  │     Short disabled + "needs sound" line when no sound/voice
│ Sound guide (Standard and Deep)   │  <- asked first, nothing pre-selected (AM-14)
│  ( ) Always show it               │
│  ( ) Show it only when I tap      │
│  one neutral line (consequence)   │
│ [ ] Take my time (no time limits) │  <- on by default with a screen reader
│ Why Korean? (optional) [family] [K-culture] [curious] [friend] [ Skip ]
│ [[ NEXT ]]                        │  <- disabled until the sound guide is answered (Standard, Deep)
└──────────────────────────────────┘
```

- Pre-selection (`defaultMode`, the first rule that matches, spec section 3.1 step 3): a newest Short whose hint fired -> Standard; a route above `stage1` band 0 -> Standard; *Pictures first* with sound and a voice for the test language -> Short; *Pictures first* without -> Standard; everyone else -> Standard. Deep never. The Short tile is disabled with the "needs sound" line whenever Short is unavailable.
- C1 is shown only when Short is pre-selected. A *Pictures first* learner with Standard pre-selected gets C2, so the sound-guide question is always answered before a Standard or Deep run.
- The three tiles sit side by side only at a content width of 480 pt or more and a font scale of 1.3 or less; otherwise they stack in one full-width column. On wide windows C1 and C2 stay centred in the reading width (F-LAYOUT-001). The tiles are radios with selected and disabled state; a disabled Short tile announces the "needs sound" line.
- Every label is spoken when tapped. No age, no "kids", no "easy" or "hard", no "test". Each choice has a one-sentence helper; none uses words like "test score", "pass" or "fail". The profile's sound-guide setting is never written.
- "Why Korean?" only changes the order of themes on the route.
- NEXT -> C3 when Short is chosen or `levelOrder` is 0, else -> D.

## C3. Hand-off (`placement/handoff`) — after C when Short is chosen or the learner is *Pictures first* (W-4)

```
┌──────────────────────────────────┐
│                                   │
│        [[ (Hoya, big) ]]          │  <- the whole Hoya is the button; spoken:
│   "Ready? Tap Hoya to start."     │     "Ready? Tap Hoya to start."
│                                   │
│  for a grown-up, written + spoken │
│  once: "Helping? Let them choose. │
│  'Not sure' is a fine answer."    │
└──────────────────────────────────┘
```

- Tapping Hoya -> D (after "Check without sound": straight to E, the warm-up is not repeated). No age words and no shame words.
- With a screen reader on, the line is not auto-played; it plays when the focused Hoya button is activated.

## D. Warm-up (`placement/warmup`)

```
┌──────────────────────────────────┐
│  [Hoya: "Listen, then tap the     │
│          picture."]               │
│        [ ( ) speaker ]            │  <- first audio needs a tap
│ ┌────────┐ ┌────────┐             │
│ │picture │ │picture │             │  <- 3 pictures; one is the heard word
│ └────────┘ └────────┘             │
│ ┌────────┐                        │
│ │picture │                        │
│ └────────┘                        │
│  footsteps: ·                     │
└──────────────────────────────────┘
```

- Not scored. Its tap unlocks audio for the run. If the sound cannot play: in Standard or Deep for a learner who is not listen-first, a line says the check will use pictures and reading, and the audio-only questions are skipped; in Short, or for a listen-first learner, L2 opens instead (W-5).
- Any answer -> E (first scored question).

## E. Items (`placement/item`) — every question has the same frame

```
┌──────────────────────────────────┐
│ [Let us start learning]   (exit)  │  <- always visible, top left; opens F
│  [Hoya line, one short sentence]  │  <- never names the answer
│                                   │
│  PROMPT (one of the formats below)│
│                                   │
│  CHOICES (2 to 4 big cards)       │
│                                   │
│ [ I am not sure ]                 │  <- same size as a choice, never red
│  footsteps: · · · ·               │  <- fills only; no count
└──────────────────────────────────┘
```

Formats (one frame each; romanization and glosses stay hidden unless the learner taps "Show how it sounds"):

```
1. shape-odd-one-out          2. hear-pick-written
   [Which one is different?]     [ (speaker) ]  [hear it again]
   [ㅂ] [ㅂ] [ㅁ] [ㅂ]            [ㅏ] [ㅓ] [ㅑ] [ㅣ]

3. see-pick-sound             4. build-syllable
   ~~ ㄱ ~~  [Show how it       [ (speaker) ]   slots: [   ][   ]
              sounds]            tiles: [ㄱ] [ㅏ] [ㄴ] [ㅓ]
   [ga] [ka] [na] [da]

5. read / hear-pick-picture   6. reply-pick
   ~~ 김치 ~~ or [ (speaker) ]   [ (speaker) hear the line ]
   [pic] [pic] [pic] [pic]       ~~ 안녕하세요 ~~ ~~ 감사합니다 ~~ ~~ 잘 가요 ~~
   (no labels on pictures)
```

- A choice is final on tap: a neutral "Got it" (not in Short, E2), then the next question. No colour change, no sound for right or wrong, no retry, no hint.
- "Show how it sounds" reveals the romanization for this question only; the answer then counts like "not sure".
- "I am not sure" moves on. Three in a row opens F.
- No per-question timer. 45 seconds without any touch opens the pause sheet (F), records nothing and keeps the question (not with "Take my time"). No timer is shown anywhere.
- Every third question Hoya says one encouraging line, whatever the answers were.
- Prompts play on open (the warm-up tap unlocked audio). The first question after Continue or a cold start plays on a tap of a large speaker. With a screen reader on, nothing auto-plays.
- Screen readers: "Question, four choices"; picture choices read their meaning in the test language; the footsteps are skipped.

## E2. Short items (`placement/item`, Short layout; promoted as `item-short`) (W-4)

```
E2. Short items, portrait (fits 320 x 568 up to 200 % text without scrolling)
┌──────────────────────────────────┐
│ [(icon) exit] (spoken label)      │  <- opens F as an exit pause
│ [Hoya]  (speaker, plays on open)  │  <- instruction spoken on the first item of a rung only
│ ┌────────────┐ ┌────────────┐     │
│ │   card     │ │   card     │     │  <- 2 x 2, >= touchTarget.child;
│ └────────────┘ └────────────┘     │     enabled when the prompt ends or after the fallback delay
│ ┌────────────┐ ┌────────────┐     │
│ │   card     │ │   card     │     │
│ └────────────┘ └────────────┘     │
│ [ (shrug) I am not sure ] (spoken)│  <- its own full-width row, large, never red
│  footsteps: · · ·                 │  <- the only acknowledgement (no "Got it" word)
└──────────────────────────────────┘
```

```
E2. Short items, landscape (two columns; fits 568 x 320 at the default text size)
┌───────────────────────────────────────────────────────────┐
│ [(icon) exit] (spoken)        ┌────────────┐ ┌────────────┐ │
│                               │   card     │ │   card     │ │
│ [Hoya]                        └────────────┘ └────────────┘ │
│ (speaker, plays on open)      ┌────────────┐ ┌────────────┐ │
│                               │   card     │ │   card     │ │
│  footsteps: · · ·             └────────────┘ └────────────┘ │
│                               [ (shrug) I am not sure ]     │
└───────────────────────────────────────────────────────────┘
```

- Portrait: no scrolling at 320 x 568 up to 200 % text. Landscape: the two-column layout above. Where landscape cannot fit (large text), the grid scrolls while the prompt and "I am not sure" stay pinned.
- The prompt plays on open (the warm-up tap unlocked audio); the first item after Continue or a cold start plays on a tap of a large speaker.
- The cards are enabled when the prompt reports its end or after a fallback delay (the prompt's estimated length plus 3 s, at most 8 s), whichever comes first. "I am not sure" and the exit are always enabled.
- With a screen reader on, the prompt does not auto-play; it plays when the focused speaker is activated.
- Hoya cheers every 2 answers with an effort-only line ("Thanks for listening!").
- No Latin sound chips and no tile building in Short, or for any *Pictures first* learner in any mode.
- No "three not sure" sheet in Short.

## F. Pause (`placement/pause`) — a bottom sheet over E

```
┌──────────────────────────────────┐
│ [Hoya, calm]                      │
│ "Need a break?"                   │  <- after three "not sure" (not in Short), 45 s untouched, or from the exit
│ [[ (icon) KEEP GOING ]]           │
│ [ (icon) That is enough, start learning ]  -> G with what we know so far
│ [ For grown-ups: finish now ]     │  -> PIN gate -> G
└──────────────────────────────────┘
```

- Also opens when the app goes to the background or the screen locks; it is shown on return, and the hidden clock did not run meanwhile.
- Nothing is lost: ending early still produces a result from the answers so far. "That is enough" (here or on F2) ends the run with the answers so far.
- Closing the app mid-run keeps the run for 24 hours (see L).
- The hidden backstop clock does not run while F or F2 is open (W-6).

```
F2. Rest card (Deep, once, after 18 answers)
┌──────────────────────────────────┐
│ [Hoya stretching]                 │
│ "Hoya is stretching. Keep going?" │  <- spoken; no number
│ [[ (icon) KEEP GOING ]]           │
│ [ (icon) That is enough, start learning ]
└──────────────────────────────────┘
```

## G. Result (`placement/result`)

```
┌──────────────────────────────────┐
│        [Hoya cheering]            │
│ "Hoya found your starting spot!"  │
│  mini map  (7 rows x 5 columns)   │
│    pin on the start cell,         │
│    light outline on cells you     │  <- placed-out cells are NOT completed cells
│    can skip ahead of              │
│ ┌ Start here ─ title of quest ───┐│
│ ├ Next ─ one or two quests ──────┤│
│ └ Later ─ title of the next stage┘│
│ [[ START ]]                       │  -> quest player on the start quest (Main underneath)
│ [ See the whole map ]             │  -> journey/grid
│  for grown-ups  (link)            │  -> PIN gate -> parent/placement-report
└──────────────────────────────────┘
```

- Words about level are the stage title and a band label ("Letters and sounds", "Reading words"). No number, ratio, percent or comparison anywhere.
- G2, no quest left for this tier: "You know a lot! More adventures are coming." with `[[ OPEN STORIES ]]` (Library) when a reviewed story exists, else `[[ SEE THE WHOLE MAP ]]`. No purchase button for the learner.
- G3, retake that does not change the route: "Your route stays right where it is." and the same buttons.
- A result with parts not tested (no sound, sound guide set to always, ended early) says so in one calm line for grown-ups only (J), never on this screen.
- **Amended (F-PLC-001 AM-1, AM-2, AM-12, AM-14; F-ROUTE-001 R-0):** the button row above is replaced by `journey/my-route-overview.md` J1 (self profile: weekly plan strip with **Use this plan** as the only primary, **Change**, **Just start**, links **See my route** and **For grown-ups**) and J2 (child profile: **Start**, **See my route**, **For grown-ups: set up a weekly plan**); a not-tested run uses J3's headline. **See the whole map** remains only while `flags.myRouteEnabled` is off. G3's learner line becomes "Your plan stays right where it is." when a plan exists; a retake that raises the start shows K3 there. Promoted later as `placement/result.md`.
- **After a Short run (W-7):** no text to read for a child. "Hoya found your starting spot!", or "Here is a good place to start" when reading was not tested. A self profile also gets the quiet link "Try the standard check" when the Short hint fires. Never "for younger learners".

## H. Entry points

```
Home (below the mission cards, above the progress bar)       Profile (a row under the stats)
┌───────────────────────────────┐                             ┌───────────────────────────┐
│ "Already know some Korean?"   │                             │ Find my starting spot     │
│ [ Take the level check ]      │                             │ again                [ > ] │
│                  [ Not now ]  │                             └───────────────────────────┘
└───────────────────────────────┘
```

- The Home card shows only when no result exists, fewer than 3 quests are done and it was not dismissed. "Not now" hides it until the learner opens Profile. While a run can be resumed it reads "Continue the level check".
- Profile row is not behind the PIN (a learner may do it alone).
- Only one quiet card shows between the mission cards and the progress bar: this one while eligible, then the route card of `curriculum-planner.md` H.
- Both -> B (or C with one language), `source` home / profile.

## I. Journey: placed-out look and the start pin (`journey/grid`)

```
 Stage 1  Hangul      [L:✓○] [F:✓○] [R:•] [N:  ] [C:  ]
                        ^ light outline + small check-in-circle = "you can skip ahead here"
                        • = pin on the start cell
 completed cells keep their own (filled) look; placed-out cells are different and still tappable
```

- Tapping a placed-out cell opens the episode as any other; its quests play and award normally.
- The explainer card gains one sentence about the pin and the outline.

## J. Parent report (`parent/placement-report`, behind the PIN gate)

```
┌──────────────────────────────────┐
│ [<]  Name — "Starting spot"       │
│ Stage 1 · Letters and sounds      │  <- date taken, language of the check
│ What we saw                       │
│  Letters (shapes)     secure      │  <- secure | getting there | not yet | not tested
│  Sounds of letters    getting there  "knows ㅏ ㅓ ㄱ ㄴ; ㅕ ㅠ are new" (KoreanText)
│  Reading syllables    not yet     │
│  Words                not tested  │  <- reason: no sound on this device / sound guide on
│  Sentences            not tested  │
│  Short: "Shapes of letters and sentences are not part of the short check"
│    (both rows read: not tested (short check))
│  Deep: each rung "secure, checked twice" | "not finished";
│    "Spelling with tiles  getting there" when a tile item was asked
│  numbers allowed for Short and Standard, framed as growth ("3 of 3"); Deep shows status words only
│ Where the route starts            │
│  quest title    [ Choose a different start ]
│  note when a stage is not included│  <- plain note, no price, no buy button here
│ [[ TAKE THE CHECK AGAIN ]]        │  <- the length is pre-selected by defaultMode
│  "A new check can only move the route forward."
│  after a Short with the hint: "The short check looks at the   │
│  first letters only. The standard check can find a later      │
│  starting spot."  [ Try the standard check ]                   │
└──────────────────────────────────┘

Choose a different start (sheet)
┌──────────────────────────────────┐
│ the learner's quests in order     │
│  (o) title … (placed out) …       │  <- pick one; everything before it is skipped,
│  [[ SAVE ]]   [ Cancel ]          │     it and everything after stay on the route
└──────────────────────────────────┘
```

- No comparison with other learners, no "behind" wording (F-PAR-001 section 3.6).
- **Amended (F-PLC-001 AM-5, AM-12; F-ROUTE-001 R-0):** the report opens with the "Suggested weekly plan" card of `journey/my-route-overview.md` K2 (when `flags.routeEnabled`) and carries the skills note `caregiver.skillsNote` under "What we saw". Promoted later as `placement/report.md`.

## K. Console roster line (`console/roster`) and the advisory hand-off

```
 Student card:  Sam   last active: today
                Starting spot: Stage 1 · Letters and sounds · Oct 9      [ Suggest a different start ]
                (Changed by a grown-up)         <- only when overridden
```

- [ Suggest a different start ] opens the plan builder on a new draft with one quest, a short note, "only this student" selected. It is an ordinary plan; it never edits the student's check or progress.
- No class average, no level distribution, no sorting by level.

## L. Empty, error, offline, no-sound

- Bank cannot load: the Home card, the Profile row and the fork disappear; nothing else changes.
- No sound: in Standard or Deep (not listen-first) D says so; audio-only questions are left out; the report names it. In Short or for a listen-first learner, L2 opens.

```
L2. Sound needed (a grown-up screen; W-5)
┌──────────────────────────────────┐
│ [icon: speaker off]               │
│ "Turn on sound to play"           │
│ [[ TRY AGAIN ]]                   │
│ [ Start learning ]                │  <- nothing is stored
│  Check without sound   (link)     │  <- back to C2: Standard selected, Short disabled,
└──────────────────────────────────┘     sound guide unanswered, listen-first off; no second warm-up
```
- Links ("Check without sound", "Change", "For grown-ups") have a hit area of at least `touchTarget.min`.
- A rung with fewer than three questions available: it is skipped and reported as not tested.
- Offline: identical; the result syncs later.
- A saved run older than a day: dropped silently; a newer one: B shows "Continue" / "Start again".
- Storage full or unavailable: the run continues in memory; the result is retried on the next write.

---

## Interaction points

- Tap a choice: records the answer, shows "Got it" (Short: the footstep trail only, no "Got it"), moves on after a short beat; double taps within 50 ms count once.
- "Show how it sounds": reveals romanization for this question; the answer is then assisted (only when the run hides the guide until tap).
- "I am not sure": records it, moves on; three in a row open the pause sheet (not in Short).
- Exit: opens the pause sheet; "start learning" ends the run with the answers so far.
- START on the result: resets the stack to Main plus the quest player on the start quest.

## Navigation graph

Enter from: `onboarding/create-profile` (fork), `home/todays-mission` (card), `profile/settings` (row), `parent/placement-report` (retake), deep link `Placement { source }`
Exit to: `onboarding/first-quest-preview` (new learner, or Start learning on L2), `quest/player` (start), `journey/grid` (map), `library/gallery` (stories), `parent/placement-report` (via PIN)

## States

- **success**: as drawn.
- **empty**: nothing to place (beyond content) -> G2; no result yet -> report shows "No check taken yet" with the take-it button.
- **error / offline / no sound**: L.
- **small phone / landscape / 200 % text**: choices stack in one column, the exit and "not sure" stay reachable (Screen scrolls). Exception: the Short item screen (E2) keeps its 2 x 2 grid and does not scroll in portrait; in landscape it uses its two-column layout (see E2).
- **reduced motion**: Hoya and footsteps change state without animation.

## Data needs

- reads: the placement bank (generated), profile (`ageGroup` -> level order -> default length and listen-first), the instruction voice of the test language, device and profile locale, audio capability, progress snapshot (`placements`, quests done), tier, the route catalogue
- writes: `placement-run:<profileId>` after each answer, `placement-ui:<profileId>`, the finished result in the snapshot (`placements`), telemetry (ids and counts only)

## Open questions

- Should `testLocale: 'ko'` be listen-first? (default: no, until beta data; spec assumption 19)
- Recalibrate the length durations from `placement.item_answered.ms` after beta (spec assumption 4).
- Is a Korean-speaking parent of a young learner expected to pick the Korean test language for the child? (default: yes; instructions are spoken, so the child can still follow)
- Where in the design system do footsteps live (a new fill-only `TrailDots`), and does it share the Home route card's dots? (default: one component)
