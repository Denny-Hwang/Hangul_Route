# Onboarding / Guest first quest: from Start learning straight into quest 1 (wireframe v1)

Spec: `docs/specs/AMENDMENTS-GUEST-FIRST-LESSON.md` sections 5, 6, 7, 10, 14 (rows GU-3, GU-0b) · keeps `quest/player.md`, `quest/discover.md` and `onboarding/welcome.md` (Welcome gains one card, Panel D) · the save is `onboarding/guest-save.md`, the chooser's tiles `profiles/who-is-using-guest.md`
Audience: **anyone** who pressed Start learning on hangulroute.com (any age; many are children), on a device with **no learner profile**
Route: learner app, `Guest` stack (`QuestPlayer`, `Minigame`, `Results`, `CardDetail`, `GuestLater`); entry by the `try=1` boot intent (`https://app.hangulroute.com/?try=1`, `?lang=es&try=1`)
Web only (`EXPO_PUBLIC_GUEST_LESSON`, never set on native builds)

Panels:

- A. The site's Start learning lands in quest 1, step 1 (Hoya's hello), 360 x 740
- B. Step 2, Discover page 1: the first letter (tap 2)
- C. Close and the leave sheet in a guest run
- D. Welcome with a waiting quest (two states)
- E. Reload and return (flow)
- F. States: storage blocked, offline, switch off

Copy in boxes is the English the spec fixes in section 16; everything else is a placeholder. Strings live in `packages/i18n` (`learner.guest.*`) with `es` and `ko`.

## User scenario (Given-When-Then)

Given: a visitor on hangulroute.com who has never used the app in this browser
When: they press **Start learning**
Then: the app opens quest 1 at Hoya's hello with no setup screen in between; one Continue later they see and can hear ㅏ (a); nothing asks a name, an age or an email before the quest ends

## Screen goal

"Reach the first Korean letter in two taps." No setup, no account, no choice before the first win.

## Box diagram

Panel A — quest 1, step 1 (intro), reached from the site (tap 1 was Start learning)

```
+--------------------------------+
| [x Close]   ·o····      ( Aa ) |  <- the quest's usual ScreenHeader: Close, step dots, Display
| Hi from Hoya                   |  <- step title (content)
| ( Intro )                      |  <- step pill
|                                |
| +----------------------------+ |
| |        [HOYA waving]       | |
| | ( Korean letters join into | |  <- Hoya's line (content, UI language)
| |   blocks. Let us meet four!)| |
| +----------------------------+ |
|                                |
| [[        CONTINUE        ]]   |  <- the ONE primary -> Panel B (tap 2; also the gesture audio needs)
+--------------------------------+
```

- No Back to Welcome, no tabs, no Profile, no grown-up entry anywhere on the screen.
- The language is the device language, set from the site's `?lang=`; ( Aa ) still changes it.

Panel B — step 2, Discover page 1 (the measure of G1)

```
+--------------------------------+
| [x Close]   ··o···      ( Aa ) |
| Four New Letters               |
| +-----------+ +-----------+    |
| |    ㅏ     | |    ㅓ     |    |  <- ㅏ (a) on screen: tap count stops here (2)
| |    a      | |    eo     |    |     romanization + gloss as for every learner
| | [ Hear it ]| | [ Hear it ]|   |
| +-----------+ +-----------+    |
|            • o                 |  <- page dots
| [[        CONTINUE        ]]   |
+--------------------------------+
```

Panel C — Close in a guest run

```
+--------------------------------+
|  ( the quest's leave sheet,    |  <- unchanged sheet and words
|    as for every learner )      |
|  [[ Keep going ]]              |  -> back to the step
|  [ Stop ]                      |  -> Welcome with Panel D (no profile on the device)
+--------------------------------+     or "Who is using this?" (device with profiles)
```

Panel D — Welcome while a guest lives (device with no profile)

```
D1: quest 1 not done                 D2: quest 1 done, not saved
+--------------------------------+   +--------------------------------+
|          [HOYA waving]         |   |          [HOYA waving]         |
|   Hi! I'm Hoya. (as today)     |   |   Hi! I'm Hoya. (as today)     |
|                                |   |                                |
| +----------------------------+ |   | +----------------------------+ |
| | Your first quest is        | |   | | Add your name to keep your | |
| | waiting.                   | |   | | first quest.               | |
| | [ Back to my quest ]       | |   | | [ Add my name ]            | |  <- outlined, inside the card
| +----------------------------+ |   | +----------------------------+ |
| [[      LET'S START       ]]   |   | [[      LET'S START       ]]   |  <- the only filled button, in its place
| What you did in the first      |   | What you did in the first      |  <- line: Let's start keeps the guest's
| quest stays with the profile   |   | quest stays with the profile   |     progress (promotes the guest)
| you make.                      |   | you make.                      |
| [ I already have progress ]    |   | [ I already have progress ]    |  <- unchanged below
| Got a class code? · grown-ups  |   | ...                            |
| row · language chips · trust   |   |                                |
+--------------------------------+   +--------------------------------+
  Back to my quest -> Panel A           Add my name -> guest-save Panel C (or the gate, Panel B)
```

Panel E — reload and return (flow, no new screen)

```
reload or reopen the tab
  |-- live guest, last play < 30 min, quest 1 not done --> Panel A (quest 1 from step 1)
  |-- live guest, last play < 30 min, quest 1 done -------> guest-save Panel E (Not now card)
  |-- live guest, last play >= 30 min --------------------> Welcome, Panel D
  '-- the site's Start learning again (try=1) -------------> Panel A, or guest-save Panel E
```

Panel F — states

```
F1: storage blocked (hr:guest not writable)
| ( Hoya's hello as Panel A )    |
| This browser can't keep the    |  <- calm line under Hoya's card, not an error colour
| quest after you close it. Add  |
| a name at the end to keep it.  |
| [[        CONTINUE        ]]   |

F2: offline after the app loaded: Panel A and B as normal; events queue; nothing else shows
F3: offline before the app ever loaded: the existing offline page (F-PWA-001), no guest yet
F4: switch off: try=1 is ignored -> Welcome exactly as today (no card)
```

## Interaction points

- Site **Start learning** (`try=1`) -> Panel A (no profile on the device); on a device with profiles -> `profiles/who-is-using-guest.md`.
- **Continue** on Panel A -> Panel B; ㅏ is visible (G1: 2 taps).
- **Hear it** -> plays the letter (as today).
- **Close** -> Panel C; **Stop** -> Welcome (Panel D) or the chooser.
- **Back to my quest** -> Panel A (`guest.started { via: 'welcome', resumed: true }`).
- **Add my name** -> `onboarding/guest-save.md` (the gate first on a gated device).
- **Let's start** with a live guest -> the usual three setup steps; on submit the profile takes the guest's id and progress.
- Finishing the quest -> `onboarding/guest-save.md` Panel A (Results, guest variant).

## Entry and exit

Enter from: hangulroute.com Start learning (header, hero, closing band, persona pages, About, 404) · Welcome **Back to my quest** · a reload or reopen within 30 minutes · the chooser's tiles (`profiles/who-is-using-guest.md`)
Exit to: `onboarding/guest-save.md` (quest finished) · Welcome (Stop, no profile) · `profiles/who-is-using` (Stop, device with profiles)

## States

- **success**: Panels A, B, D.
- **empty**: no learner profile and no guest -> Panel A after `try=1`; without `try=1`, Welcome as today.
- **error**: storage blocked (F1); a record that does not parse is treated as no guest; a lesson body that cannot load shows the player's existing state.
- **offline**: F2, F3.
- **switch off**: F4.

## Accessibility

- Reading order on Panel A: Close, step dots, Aa, title, pill, Hoya's line, Continue. Focus starts on the title.
- Panel D's card is read before Let's start; its button names the action. The line under Let's start is plain text.
- 64 dp targets everywhere; text sizes up to Largest; reduced motion keeps Hoya still.

## Data needs

- Reads: `hr:guest` (`GuestRecordSchema`), `hr:profiles` (empty or not), the device language, `navigator.onLine`.
- Writes: `hr:guest` at the run's start and at every quest end; the quest's results under the guest's id in the per-profile stores (as any learner); telemetry without `profileId` (`guest.started`, `guest.first_letter`, `guest.left`).
- Never: `hr:profiles`, `hr:profiles:active`, any `/api/sync` call.

## Open questions

- OQ-G1 (native builds), OQ-G3 (quest 1 only): defaults in spec section 21 (web only; quest 1 only).
