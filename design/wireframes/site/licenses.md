# Site/Licenses — open-source notices (wireframe v1)

Decision: owner decision 2026-10-14 (Hangul Route is proprietary: `LICENSE` at the repository root; third-party components keep their own licenses, listed in `THIRD_PARTY_NOTICES.md`)
Data: `apps/web/src/data/third-party-notices.json`, generated with `THIRD_PARTY_NOTICES.md` by `scripts/third-party-notices.mjs` (its `--check` runs in `pnpm run test:scripts`)
Used by: `/licenses`, `/es/licenses`, `/ko/licenses` (site, legal variant of the chrome, `header-footer.md`); the learner app links to it from Profiles & settings
Audience: **everyone** (shared surface); store reviewers and anyone checking the licenses

## Scenario (Given-When-Then)

Given: a visitor, a grown-up or a store reviewer wants to know which open-source software Hangul Route ships
When: they open "Open-source notices" in the site footer (beside the copyright line, on every page) or at the foot of Profiles & settings in the app
Then: they see every package with its version, license, copyright line and where it ships, and can open the full text of each license

## Screen goal

"Show, plainly and completely, whose open-source work the app is built on and under which license."

## Box diagram

Phone (320 to 719 px), one column, reading width:

```
+--------------------------------------+
| [HR] Hangul Route                    |  <- legal variant: brand only
+--------------------------------------+
| <- Back home                         |
| [This document is shown in English…] |  <- /es and /ko only (legal.englishAuthoritative)
| # Open-source notices                |  <- h1
| Hangul Route uses open-source …      |  <- lead
| +----------------------------------+ |
| | Hangul Route itself is not open  | |  <- sunken box: notOpen + copyright line
| | source. Copyright (c) 2026 …     | |
| +----------------------------------+ |
| ## Software                          |
| ### MIT License (731)                |  <- one block per license, largest first
|   **react** 18.3.1                   |
|   Copyright (c) Meta Platforms, …    |  <- caption, muted
|   Used in: App, Website              |  <- caption, muted, page locale
|   …                                  |
| [ Full license text            v ]  |  <- native fold (site-parts Fold), closed
| ### ISC License (62)                 |
|   …                                  |
| ## Fonts                             |
|   **Noto Sans KR Bold 2.004 …**      |
|   SIL OFL 1.1 · attribution · URL    |
| [ Full license text: SIL OFL 1.1 v ] |
| ## NOTICE files                      |  <- only when a package ships one
| [ xcode 3.0.1                   v ]  |
+--------------------------------------+
| footer (legal variant)               |
+--------------------------------------+
```

Wide (720 px and up): the same column at `layout.maxWidth.reading`, centred; nothing moves into columns.

In the app (Profiles & settings, the last item under the grown-up zone button):

```
| [ Grown-ups ]                        |  <- existing ghost button
|                                      |
|         Open-source notices          |  <- quiet link (Body sm, brand), centred, 44 px hit area
|  Open hangulroute.com/licenses in a  |  <- shown only when no browser opened
|  browser.                            |
```

Footer (every site page, both variants): the link sits on the copyright row, so the footer is no taller (F-SITE-002 §3.11 budgets):

```
| © 2026 Hangul Route   Open-source notices |  <- caption size; the link keeps a 64 px hit area through negative block margins
```

## Rules

- Words around the list come from `landing.licenses` (en, es, ko); the list itself is English legal text and carries `lang="en"` on `/es` and `/ko`, under the English-authoritative line, as the Privacy Policy and Terms do. "Used in" and its values are in the page locale.
- License texts and NOTICE files are shown as written (monospace, `white-space: pre-wrap`, wrapped anywhere), so nothing scrolls sideways at 320 px or at 200 % text.
- Folds are native `<details>` (work without JavaScript); every license text is one tap away and the page stays readable on a phone.
- No price, no billing link, no app or console link beyond the shared chrome (site-no-billing and landing-claims scan this page).
- Tokens only: `colors.surface.sunken` box, `colors.text.muted` captions, `typography.family.mono` for texts.
- The app link opens the site page (`licensesUrl()`, same site root as Privacy); it is not behind the grown-up PIN, like the Privacy link, because it leads only to the site's legal pages.
