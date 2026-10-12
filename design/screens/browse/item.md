# Item page: a lesson or a story (BR-7)

Wireframe: `design/wireframes/browse/item.md` A to C · Spec: F-BROWSE-001 §4.2, §4.4 (focus), §4.6 · Mock: `mock/item.html`, `mock/item-states.html` · Shots: `shots/item-375.png`, `-375-first.png`, `-1280.png`, `-320-text200.png`, `shots/item-states-375.png`, `-1280.png`

Data: `itemFacts(item, bundle, locale)`, `itemAccess(...)`. The word topic is `topic.md` (BR-9).

## Layout (one reading column)

| Part | Look |
|---|---|
| Header row | back (`arrow-left` 64) and [ Lesson display ] |
| Focus line | only when opened for a letter this lesson teaches: "Taught here: [ㄴ n]" on `surface.sunken`, `radii.md`, Body semibold |
| Title | the quest title, Heading `title`, the one header |
| Kicker | kind pill (Lesson, Story, Words; `brand.secondaryLight`) and "About N minutes" (Body small semibold) |
| What this teaches | Heading `prompt`, then a paper `Card` holding a definition list. On compact, each label sits above its value; from the regular class, an 8rem label column. Labels are Body small bold `text.secondary` |
| Where it sits | Heading `prompt`; "Stage 1 · Letters · lesson 1 of 3" (Body semibold) and [ See on the Journey ] (compact ghost) on one line, wrapping when narrow |
| The card it awards | Heading `prompt`; a 64 CardArt thumbnail with the rarity border, the English title, and the Korean with romanization. One button opens the card page in its preview state |
| Primary | [[ ▶ Preview this lesson ]], `Button` primary `lg` (80). Pinned to the bottom edge on compact (canvas background, `border.subtle` rule above); inline and at most 26rem wide from the regular class |
| Secondary | [ Present this ] (BR-13) under the primary, full pass only; not drawn (the presenter root is not shipped) |

## What this teaches (quest)

| Row | Value | Hidden when |
|---|---|---|
| Letters | `KoreanText` chips (letter + romanization) in Discover order. The focus letter has a `borderWidth.thick` `text.primary` outline and its label ends ", taught here" | a taste lesson |
| Words | chip + gloss in the UI language, each word once | none |
| Syllables | chips (no gloss) | none |
| Skills | the skills chips | `questSkills` is empty |
| Steps | the player's step names, in order, joined by `·` (`questStepLabel`) | never |

## Closed (sampler pass, switch on only)

The facts are unchanged. The primary gives way to a `surface.sunken` box (`radii.lg`, `spacing.lg` padding):
- "Opens with the Family Plan or a Group License" (Body semibold).
- [ Open billing ] (ghost) under it, only for an account pass that is not kept and not a fallback. It goes to `APP_ROUTES.billing` in the same tab and fires `browse.plans_tapped`.

There is no glyph, no price and no learner word. A gate or kept pass shows the line only.

## Story (once reviewed)

- **Header**: the title (English) with the Korean title and its romanization under it, and the kind pill "Story".
- **What this teaches**:
  - Levels: radio pills (64), the lowest selected; the preview opens there.
  - Scenes: the count.
  - Key words: chip + gloss.
  - Sources: [ See the sources ], copy-only links in this stack.
- **Where it sits**: the story's home cell, "Stage n · Theme", with no position.
- **Actions**: the primary [[ Preview this story ]], then the ghost [ Preview the questions ] (the story's quest as a preview).
