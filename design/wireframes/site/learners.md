# Site/Learners — `/learners`, the page for anyone learning (wireframe v1)

Spec: `docs/specs/F-SITE-002-marketing-site-layered.md` §3.4, §3.9 (claims), §3.11 (budgets), appendix B.2
Takes over from the old landing: the 24-card grid (`HeritageCardsPreview`), the mini-games gallery (`MiniGamesGallery`), Meet Hoya (`MeetHoya`, trimmed) — each folded
Audience: **learners of any age** (heritage families, K-culture fans, adult beginners). Shared surface: no age words, no "for kids", no price, no account talk beyond "you don't need one".
Shared chrome: `site/header-footer.md`

## Scenario (Given-When-Then)

Given: a visitor tapped "Learners" on the home page or the header, or arrived from a search for "learn Hangul"
When: the page loads
Then: they see what they will learn and how a session feels in under a minute of reading, and start in one tap

## Screen goal

"Show what learning feels like, then start the app."

## Box diagram

Phone:

```
+--------------------------------------+
| header (Learners marked current)     |
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
| H2 How a quest works                 |
|  1 Discover · one line               |
|  2 Play     · one line               |
|  3 Check    · one line (amber, never red)
|  > See the mini-games                |  <- L3 fold: MiniGamesGallery (counts from the catalogue)
+--------------------------------------+
| H2 Collect Korean culture            |
| one line                             |
| [card][card][card]                   |  <- 6 tiles (first six Stage 1 cards), 3 x 2 on phones
| [card][card][card]                   |
|  > See all {n} Stage 1 cards         |  <- L3 fold: full HeritageCardsPreview grid
+--------------------------------------+
| H2 Meet Hoya        [small HOYA ART] |
| two lines                            |
+--------------------------------------+
| H2 Your LEARNING ROUTE               |  <- only when the learningRoute claim is on
| one line                             |
+--------------------------------------+
| H2 Learning with a class or family?  |
| one line (enter the join code in the app)
+--------------------------------------+
|  > Do I need an account?             |  <- 2 folded questions
|  > Does it work offline?             |
+--------------------------------------+
| one closing line                     |
| [[ START LEARNING ]]                 |  -> app
+--------------------------------------+
| footer                               |
+--------------------------------------+
```

Wide: the same order in a centred column of readable width; the six card tiles sit in one row; Meet Hoya puts the art beside the two lines.

## Interaction points

- [[ START LEARNING ]] (top and closing) → learner app (same tab, `?lang=` from a locale page). Telemetry `site.cta_tapped {cta:'start', place:'hero'|'closing', page:'learners'}`.
- "See the mini-games" / "See all {n} Stage 1 cards" → open in place (native `<details>`); a card tile is not a link. Telemetry `site.fold_opened {fold:'games_all'|'cards_all'}`.
- Folded questions → open in place. Telemetry `site.fold_opened {fold:'faq_account'|'faq_offline'}`.
- Header and footer links as in `site/header-footer.md`.

## Navigation graph

Enter from: `site/home` persona card · header "Learners" · footer "Learners" · `site/parents` "What learners do" · search results
Exit to:    learner app · `site/home` (brand) · `site/parents` · `site/teachers` · app sign-in · `/about` · `/privacy` · `/terms`

## States

- **success**: as drawn, claims off (no LEARNING ROUTE block).
- **claims on**: the LEARNING ROUTE block appears between Meet Hoya and the class/family block; nothing else changes.
- **empty**: not reachable — the cards and games come from bundled data; if a future catalogue had 0 beta games the gallery simply shows no beta line (existing component behaviour).
- **error**: JavaScript off → all content and folds work; an image failing to draw (inline SVG art) leaves the card's text (title, romanization, meaning) readable; hidden locale → 404 page.

## Data needs

- reads (build time): `landing.persona.learners` messages, `stage1Cards` (first six + full list in the fold), `minigame-catalog`, `SITE_CLAIMS.learningRoute`, `site-links.learnerStart`.
- writes: anonymous `site.*` telemetry only.

## Open questions

- Should the six teaser cards be the first six by unlock order or one per culture theme? Default: the first six by unlock order (what a new learner earns first); revisit in the design pass (S-D).
- Should "Write" mention tracing explicitly? Default: yes ("Write letters by tracing them"), because only tracing is built.
