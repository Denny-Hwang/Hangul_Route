# Site: the guest start with the `guestLesson` claim on (design mocks v1, GU-0b)

Spec: `docs/specs/AMENDMENTS-GUEST-FIRST-LESSON.md` sections 13.1, 13.2, 16.4 (amends F-SITE-002 sections 3.8 and 3.9, and `AMENDMENTS-SITE-NEWUSER.md` sections 3.3 and 3.11) · Row that builds it: **GU-6** (the claim stays `false` until GU-7) · Pass notes, strings and lengths: `../../onboarding/README.md`

## How the mocks were made

As the new-visitor pass (`../newuser/README.md`): `tools/build-guest-mocks.mjs` opens the **real static export** of `/` and `/learners` in en, es and ko (`origin/main` `d4cbd70ac`, with SN-1 and SN-2 merged and `levelCheck` on as shipped), applies the claim's copy on top, and saves the page with its CSS inlined and its scripts removed as `mock/<locale>/<page>.html`; the captures link to the identical files of `../newuser/captures` (the tool checks their hashes). Every part the claim does not change is exactly what ships. The same pages without the claim are measured beside them (`measurements.json`, `off` and `on`). Not run by CI.

## What the claim changes (with `levelCheck` on, as shipped)

| Where | Off (today) | On |
|---|---|---|
| Every Start learning (header pill, hero, closing band, persona pages) | `https://app.hangulroute.com` (`?lang=` off English) | the same with `try=1` (`…/?try=1`, `…/?lang=es&try=1`); Sign in and Create never carry it |
| Home hero, right under the facts line, above the two grown-up links | — | **Start your first quest right away. Add a name at the end.** (`landing.home.hero.guest`) |
| How it works, step 1 | "Make a profile" / "Pick a name and a Hoya. A level check is optional." | **Start right away** (`how.steps.start.guestTitle`, new, D16) / **Play your first quest. Check your level after.** (`how.guestLevelBody`) |
| How it works, step 3 | "… Your progress is saved and backed up." | **Earn Korean culture cards. Add a name, and your progress is saved and backed up.** (`how.steps.collect.guestBody`) |
| /learners, "I already know some Hangul…" | "No. When you start, tap “I already know some Korean” …" | **No. Play the first quest, add a name, then tap “Take the level check” on Home. Hoya suggests where to begin.** (`persona.learners.faq.level.guestA`) |

With `levelCheck` off, step 1's body is `how.guestStartBody` (**Play your first quest, then add a name.**) under the same title, and the /learners answer is not shown (spec 13.2 table); not drawn, the layout is the same.

### D16

- **The hero line** is `size.body` in `text.secondary` (the lead's colour, a step stronger than the facts line's `caption` in `text.muted`), `spacing.sm` above it, at most the lead's 34em wide. It is plain text: it names what the link already does and adds no second action, so Start learning stays the hero's one button.
- **Step 1's title changes too.** Spec 13.2 changed only the bodies; with the claim on, "Make a profile" over "Play your first quest. Check your level after." would describe the old order (profile first). The title follows the hero's own words: **Start right away** / **Empieza ya** / **바로 시작하기** (new row `landing.home.how.steps.start.guestTitle`, spec 13.2 and 16.4 amended in this PR).
- **The FAQ answer quotes the button**, as the shipped answer does (“…”, «…», ‘…’), so a reader looks for those exact words on Home: en and es drafts gain the quote marks; ko already had them.

## First-screen rules and budgets (AMENDMENTS-SITE-NEWUSER section 3.11), measured on the mocks (macOS Chromium)

Bottoms in px from the top of the page.

| Locale | 320x568: Start learning | 320x568: hero line | 375x812: brand | 375x812: hero line | 375x812: grown-up links | `/` height at 375 (budget 3,250, es and ko +10 %) | at 1280 (2,300, +10 %) | words at 375 (300, +10 %) | sideways scroll (320, 375, 768, 1280, 1920, 320 at 200 %) |
|---|---|---|---|---|---|---|---|---|---|
| en | 429 | 531 | 72 | 462 | 530 | 3,013 → 3,094 | 2,240 → 2,296 | 281 → 294 | none |
| es | 429 | 569 | 72 | 522 | 590 | 3,251 → 3,332 | 2,330 → 2,363 | 296 → 305 | none |
| ko | 429 | 550 | 72 | 462 | 530 | 2,984 → 3,041 | 2,187 → 2,220 | 229 → 238 | none |

- **320 x 568**: header, h1, lead and Start learning are on the first screen in every locale (Start learning ends at 429); the hero line itself is on it too in en and ko and ends 1 px under the fold in es.
- **375 x 812**: the brand and both grown-up links are on the first screen in every locale (the links end at 590 at most); the line stays in the hero, under the facts line, as spec 13.2 places it. No locale needs the fallback (the line under the grown-up links).
- **1920 x 1080** and 1280: the line is one line under the facts line, in the text column beside the capture.
- **Budgets**: every page stays inside its height and word budgets; `/` in English at 1280 is 2,296 against 2,300 (finding F2 in `../../onboarding/README.md`: GU-6's forced-on CI run decides). `/learners` does not change height (the answer is in a closed fold).

## Shots

| Shot | Viewport | Shows |
|---|---|---|
| `shots/home-<locale>-320-first.png` | 320 x 568, first screen | header, h1, lead, Start learning, the facts line, the hero line |
| `shots/home-<locale>-375-first.png` | 375 x 812, first screen | the same with the two grown-up links and the brand |
| `shots/home-<locale>-375.png`, `-1920.png` | full page | the whole home with How it works steps 1 and 3 |
| `shots/learners-<locale>-375.png`, `-1920.png` | full page | /learners, folds closed as shipped |
| `shots/learners-<locale>-375-faq-level.png`, `-1920-faq-level.png` | the FAQ section | the level answer opened |
