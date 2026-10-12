# Site/Learners — `/learners`, the page for anyone learning (wireframe v2)

Spec: `docs/specs/F-SITE-002-marketing-site-layered.md` §3.4, §3.9 (claims), §3.11 (budgets), appendix B.2
Takes over from the old landing: the 24-card grid (`HeritageCardsPreview`), the mini-games gallery (`MiniGamesGallery`), one line of Meet Hoya, and the "adult beginner" and "do I need Korean" questions — each folded
Audience: **learners of any age** (heritage families, K-culture fans, adult beginners). Shared surface: no age words, no "for kids", no price.
Shared chrome: `site/header-footer.md`

## Scenario (Given-When-Then)

Given: a visitor tapped "Learners" on the home page, the wide header or the footer, or arrived from a search for "learn Hangul"
When: the page loads
Then: they see what they will learn and how a session feels in under a minute of reading, and start in one tap

## Screen goal

"Show what learning feels like, then start the app."

## Box diagram

Phone (4 sections with every claim off, 5 with the Learning Route claim on):

```
+--------------------------------------+
| header (one row: brand, Sign in)     |
+--------------------------------------+
| H1 For learners                      |
| one-line lead                        |
| [[ START LEARNING ]]                 |  -> app (learner start)
+--------------------------------------+  <- first screen at 320 x 568 ends about here
| H2 What you learn first              |
| one line (Stage 1 = the alphabet)    |
|  - Read    one line                  |
|  - Listen  one line                  |
|  - Write   one line (tracing)        |  (no speaking line, ever)
+--------------------------------------+
| H2 How most quests work              |
|  1 Discover · one line               |
|  2 Play     · one line               |
|  3 Check    · one line (amber, never red)
| [small HOYA] one line: Hoya guides every quest, never says "wrong"
|  > See the mini-games                |  <- L3 fold: MiniGamesGallery (counts from the catalogue)
+--------------------------------------+
| H2 Collect Korean culture            |
| one line                             |
| [card][card][card]                   |  <- 6 tiles (first six Stage 1 cards), 3 x 2 on phones
| [card][card][card]                   |
|  > See all {n} Stage 1 cards         |  <- L3 fold: full HeritageCardsPreview grid
+--------------------------------------+
| H2 Your Learning Route               |  <- only when the learningRoute claim is on
| one line                             |
+--------------------------------------+
|  > Is there a sign-in for learners?  |  <- 5 folded questions
|  > I have a join code. Where do I enter it?
|  > Does it work offline?             |
|  > I'm an adult beginner. Will it feel too young?
|  > Do I need to know any Korean?     |
+--------------------------------------+
| one closing line                     |
| [[ START LEARNING ]]                 |  -> app
+--------------------------------------+
| footer                               |
+--------------------------------------+
```

Wide: the same order in a centred column of readable width; the six card tiles sit in one row; the Hoya line puts the small art beside the text.

## Interaction points

- [[ START LEARNING ]] (top and closing) → learner app (same tab, `?lang=` from a locale page).
- "See the mini-games" / "See all {n} Stage 1 cards" → open in place (native `<details>`); a card tile is not a link.
- Folded questions → open in place.
- Header and footer links as in `site/header-footer.md`.

## Navigation graph

Enter from: `site/home` persona card · wide header "Learners" · footer "Learners" · `site/parents` "What learners do" · search results
Exit to:    learner app · `site/home` (brand) · `site/parents` · `site/teachers` · app sign-in · `/about` · `/privacy` · `/terms`

## States

- **success**: as drawn, claims off (no Learning Route block).
- **claims on**: the Learning Route block appears between Collect and the questions; nothing else changes.
- **empty**: not reachable — the cards and games come from bundled data; if a future catalogue had 0 beta games the gallery simply shows no beta line (existing component behaviour).
- **error**: JavaScript off → all content and folds work; an image failing to draw (inline SVG art) leaves the card's text (title, romanization, meaning) readable; hidden locale → 404 page.

## Data needs

- reads (build time): `landing.persona.learners` messages, `stage1Cards` (first six + full list in the fold), `minigame-catalog`, `SITE_CLAIMS.learningRoute`, `site-links.learnerStart`.
- writes: nothing.

## Open questions

- Should the six teaser cards be the first six by unlock order or one per culture theme? Default: the first six by unlock order (what a new learner earns first); revisit in the design pass (S-D).
- Should "Write" mention tracing explicitly? Default: yes ("Write letters by tracing them"), because only tracing is built.
- The join-code answer names the in-app path (Profile, Classes and family, Join); re-check it against the app before S-3, since F-APP-001 uses the same path.
