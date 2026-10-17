# Learner shell: Home with the next-lesson hero, the Profile split and the Grown-up area, the Library's collected-first Cards (design mocks, DN-0)

Spec: `docs/specs/AMENDMENTS-DISPLAY-NAV.md` section 9 (the learner UX pass of the owner report 2026-10-16), with sections 3.6 (the Display control) and 7.1 (`ScreenHeader`) · wireframes `design/wireframes/home/next-lesson-hero.md`, `profile/profile-split.md`, `library/cards-collected-first.md` · rows **DN-8** (Home, Profile, Grown-up area, one name, Got a class code?) and **DN-9** (Library)

| File | Mock pages | Shots |
|---|---|---|
| `home-hero.md` | `mock/home-hero.html`, `home-hero-rest.html` | `home-hero-360.png`, `-360-first.png`, `-768.png`, `-320-text200.png`, `home-hero-rest-360.png` |
| `profile-split.md` | `mock/profile-split.html`, `grown-up-area.html` | `profile-split-360.png`, `-320-text200.png`, `grown-up-area-360.png` |
| `library-cards.md` | `mock/library-cards.html`, `library-cards-open.html`, `library-cards-empty.html` | `library-cards-360.png`, `-768.png`, `-320-text200.png`, `library-cards-open-360.png`, `library-cards-empty-360.png` |
| `mock/learner-shell.css` | the rules of these pages, loaded after `../../app-shell/mock/app-shell.css` (tokens) and `display-nav.css` (ScreenHeader, Display, text size) | |

**The mocks are a design reference, not shipped code.** Learner screens are react-native drawn as HTML in rem, so the browser text size and the Display sheet's text size both reach them. Parts that do not change are dashed "unchanged" boxes. Content is shipped content: lesson and story titles from `CATALOG`, card faces are `HeritageCardArt` for `card:book` and `card:hanji` (taken from the merged browse mock), Hoya is `hoyaNodes('waving')`. Every UI string is a dictionary value or a key of AMENDMENTS-DISPLAY-NAV section 10. Shots are 128-colour palette PNGs at 2x (`-text200` at 1x); full-page shots draw the sticky tab bar in place.

Measured (Chromium, the pass script): no sideways scroll at 360, 768 and 320 with 200 % text; every control at least 64 px; no duplicate id; no console error. Profile went from 2 895 px (measured on `426384b45`, 360 x 740) to about 1 565 px; the Grown-up area is under two screens.

## Review log

2026-10-16 (DN-0): lenses design (fit at 320 and 200 % text, one primary per screen), accessibility (targets, focus order, headings), anti-shame and anti-pressure (no count of cards to earn, no streak in the hero, no "locked" wording beyond the earn hints), child safety (every gated action stays behind the gate), copy (no age words, no emoji). Findings applied in this pass: the tab-bar labels wrap at 200 %; the Library chips keep 64 px; the "Cards to earn" disclosure carries no count (F-STORY-006 section 3.7, D3). The PR's multi-agent review follows.

2026-10-17 (DN-0 review of #730): card ② is drawn compact (not a button, "Same as your next lesson above") when it names the hero's lesson, so Home offers that lesson once (`home-hero-*` re-shot); the Profile Display row reads "English · Text: Standard"; the Grown-up area puts Leave a class or a family behind the gate on purpose; the quieter Route tab has its own wireframe and mock in `design/screens/learning-route/route-tab-collapsed.md`.
