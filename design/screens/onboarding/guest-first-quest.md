# Guest first quest: Hoya's hello, Discover page 1, the storage-blocked line, Welcome's waiting card (mock v1, GU-0b)

Spec: `docs/specs/AMENDMENTS-GUEST-FIRST-LESSON.md` sections 6.2, 6.3, 7.2, 14, 16.1 · Wireframe: `design/wireframes/onboarding/guest-first-quest.md` (Panels A, B, D, F1) · Row that builds it: **GU-3** · Mocks: `mock/guest-quest.html`, `mock/guest-welcome.html` · Shots: `shots/guest-quest-*.png`, `shots/guest-welcome-*.png`

## Hoya's hello (quest 1, step 1) and Discover page 1 (step 2)

The guest's first two screens are the shipped quest player, drawn as `QuestPlayerView` renders them, with nothing added and nothing taken away except what a guest run never has:

| Part | Hoya's hello (board 1) | Discover page 1 (board 2) |
|---|---|---|
| Header (route `ScreenHeader`) | **Close** (top left), the Display control (`common.display.button`, name `common.display.a11y`) | the same |
| Progress | six step dots, the `1 / 6` pill | `2 / 6` |
| Title and pill | the step title (content: "Hi from Hoya"), the `intro` pill ("Hello") | "Four New Letters", the `discover` pill ("Look and learn") |
| Body | the brand card: Hoya waving (120) and Hoya's bubble with the content line | Hoya's line beside a waving cub (64); "Page 1 of 2" with the page dots; one card per letter, stacked: ㅏ (hero size) with "a", the sound hint, **Hear it** (secondary, speaker glyph), **Letter name** (ghost), the example word 나 na "I, me" (its own 64 target); then the card of ㅓ |
| Action | **Continue**, hero, the screen's one filled button | **Continue** (lg) |

- **G1 is two taps**: Start learning on the site, then Continue on board 1; ㅏ is the first thing on board 2's first card. Continue is also the gesture the web needs before the letter can be heard.
- **Not drawn, ever, in a guest run** (CS-G1): tabs, Profile, a name or cub of a learner, a Back to Welcome, any grown-up entry. Close asks the shipped leave sheet ("Leave this quest?") and then lands on Welcome's waiting card or the chooser (spec 6.4); that sheet is unchanged and not redrawn.
- es and ko: titles, Hoya's lines, the sound hints and the example glosses are the shipped quest 1 overlays (`content/i18n/{es,ko}/stage1-quests.json`, `stage1-jamo.json`); Korean is taught content and stays Korean with its romanization in every locale.

### D1. The storage-blocked line (spec 7.2, board 3)

When `hr:guest` cannot be written (some private windows), Hoya's hello shows one line, `learner.guest.memoryOnly`, **between Hoya's card and Continue**: plain `Body` in `text.secondary`, no box, no icon, no warning or danger colour, not a live region. It is read in order after Hoya's line and before Continue, so a learner who uses a screen reader hears it before the first tap, and it is not repeated on any later step (the save works while the tab stays open; nothing else changes). It sits on the first screen at every text size in en, es and ko (`-320-largest` shot).

## Welcome with a live guest (spec 6.3, boards 1 to 6 of `guest-welcome.html`)

Welcome is unchanged except for one card above **Let's start** and one line under it, only while a live guest exists on a device with no profile and the guest switch is on.

### D2. The waiting card

- **Shape.** A `surface.sunken` card (`radii.lg`, `spacing.md` padding, no shadow): the same tone as the class-link card that already sits in this place on Welcome, so the screen keeps one kind of card. Inside, one line in `size.bodyLg` semibold (no heading role: spec 14, "one heading-free card") and a full-width **outlined** button (`Button tone="ghost"`, size md, 64 tall):
  - quest 1 not done: **Your first quest is waiting.** + **Back to my quest** (→ the guest run at step 1, `guest.started { via: 'welcome', resumed: true }`);
  - quest 1 done, not saved: **Add your name to keep your first quest.** + **Add my name** (→ the save, `guest-save.md`; the gate first on a device with a PIN).
- **Let's start stays the only filled button, in its place** (F-I18N-001 section 3.3). Under it, `learner.guest.welcome.keeps` (**What you did in the first quest stays with the profile you make.**) in `size.bodySm`, `text.secondary`, centred, at most the invitation's width (320): plain text read after Let's start, saying before the tap that Let's start keeps the guest's progress (GU-D11).
- Everything below is unchanged and keeps its order: **I already have progress**, **Got a class code?**, the grown-ups' row, the language chips, the trust line.
- Reading order: Hoya, title, invitation, the card's line, its button, Let's start, the keeps line, the rest.
- es and ko: the card's line wraps to two lines in es at 320 ("Añade tu nombre para conservar tu primera misión."), one or two in ko; the buttons stay one line at Standard and wrap inside themselves at Largest.

## Accessibility

- 64 targets everywhere (the example word too); text sizes up to Largest; reduced motion keeps Hoya still (the mocks draw no motion).
- Board 1's first focus is the step title (QuestPlayer's heading), as for every learner.
- The waiting card's button names its action; the card is not a heading and not a live region.
