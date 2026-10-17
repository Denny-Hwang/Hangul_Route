# AdultFrame: header, persona switch, navigation, footer (design mock v1, for A-5a and A-5c; revised 2026-10-16 for DN-5 and DN-6)

> **Revision 2026-10-16 (owner report; `docs/specs/AMENDMENTS-DISPLAY-NAV.md` section 7.3, rows DN-5 and DN-6).** See "PageBack, the Learner app exit and Display" at the end. The way to the learner app becomes **Learner app** at the right end of the header, every non-home page gets a **PageBack** at the top left of its content, and the Display (Aa) control replaces the Language select in the header and the phone footer. The panels below are the v1 record.

Wireframe: `design/wireframes/shell/adult-frame.md` (Panels A to C) · spec §3.8, §3.10, §3.16 · mock: `mock/frame-states.html` (and the frame of `parent-home.html`, `teacher-home.html`) · shots: `shots/frame-states-320.png`, `-375.png`, `-768.png`, `-1280.png`, `-375-text200.png`, `parent-home-1280.png`, `teacher-home-1280.png`

Replaces `ConsoleShell` (`components/console/ui.tsx`): no "Back to site", no disabled Account button, no "Console" title.

## Phone, below 45em (one header row + the tab row)

```
 16 |( Family | Teacher )        (< Back to   )| 16     both personas: the brand steps out (D2)
    |                            (  learning  )|        the way back's label wraps before the row does
    |------------------------------------------|
    | Home | Reports | Notes | Lessons | Billing|        equal tabs >= 64 x 64; 5 fit 375
    |------------------------------------------|
    |            [ page content ]               |
    |------------------------------------------|
    | About Hangul Route   Privacy   Terms      |        surface.sunken footer
    | [ English v ]  ( Sign out )               |        Language and Sign out move here below 45em
```

One persona: `(HR) Teacher            (< Back to learning)` — brand mark, then the persona as text.

## Wide, 45em and up

```
 (HR) Hangul Route  ( Family | Teacher )            (< Back to learning) [English v]  Sign out
   Home   Reports   Notes   Lessons   Billing
   ^^^^ current: bold text.primary, underline borderWidth.thick brand.primary
```

- From 45em to 70em the brand is the mark alone (the name stays its accessible name); the name joins it from 70em (`layout.maxWidth.full`). So the header is one row at every width from 720 px up with both personas, Language and Sign out (measured at 720, 768, 800, 840, 1024, 1120 and 1280; `frame-states-768.png`, `parent-home-768.png`).

- The header and nav are one paper band (`surface.paper`, bottom `borderWidth.thin` `border.subtle`); content sits on `surface.canvas`, at most `layout.maxWidth.full`.
- DOM order is the visual order at both widths: brand, persona, way back, Language, Sign out (the last two `display: none` below 45em, so out of the Tab order), then the nav, the main content, the footer (whose Language and Sign out exist only below 45em).

## Navigation (`ADULT_NAV`)

Items are drawn exactly as section 3.8 registers them; an item whose predicate is off is not drawn (never disabled). Every item is a link, Lessons included: `<a href="/browse">`, whose click handler calls F-BROWSE-001 `openBrowse(undefined, 'nav')` to write the tab's pass and then opens All lessons at `/browse` in the same tab. It is shown only while `browseEnabled()` holds on the app origin (amended 2026-10-12 by F-BROWSE-001 BR-0b).

| Persona | All flags on | Today (flags off) |
|---|---|---|
| Family | Home · Reports · Notes · Lessons · Billing | Home · Billing |
| Teacher | Classes · Lessons · Billing | Classes · Billing |

## States

| State | Drawn |
|---|---|
| Both personas | the switch; choosing the other option writes the last persona and opens that home |
| One persona | the persona's name as text after the brand mark |
| Teacher's laptop (marker absent or `none`, no `hr:profiles`) | the way back reads **Open the learner app**; same place, same action |
| `/teach/space…` or `/parent/space…` while the space kind loads | the switch with no option checked (or the persona text); the nav items of the **last persona** (the shell store's; Family when none), none highlighted. The tab row keeps its height, and with the usual answer (the last persona) its items do not change, so nothing shifts when the lookup returns |
| `/account/billing` (A-5c) | Billing highlighted in the active persona's row |
| Spaces fetch failed | brand, the way back, Language and Sign out only; no persona, no nav; the page shows its own Try again |
| Lock deciding | as A-4a built it: an empty canvas for the read (README, D12); then the lock or the page with its frame |

## Tokens

| Part | Tokens |
|---|---|
| Bar | `surface.paper`; padding `spacing.sm` block, `layout.gutter.compact` / `.regular` (45em) / `.wide` (70em) inline; items `spacing.sm` apart (`spacing.md` wide) |
| Brand | mark 48 (`spacing.xxxl`) `brand.primary` with `text.inverse` bold; name `size.bodyLg` bold `text.primary`, visually hidden below 70em (the link keeps its name) |
| Persona switch | `role="radiogroup"`; outline `borderWidth.base` `brand.secondaryDark`, `radii.pill`; options at least 64 x 64, `size.bodySm` bold; selected: fill `brand.secondaryDark`, label `text.onSecondary`; unselected: `surface.paper`, label `brand.secondaryDark` |
| Persona text | `text.secondary` semibold |
| Way back | `surface.paper`, `borderWidth.thin` `border.strong`, `radii.pill`, glyph `arrow-left` 20, `size.bodySm` bold `text.primary`, `touchTarget.min` tall; flex basis 7.5rem on phones (README, Constants) |
| Language | the existing `LanguageSelect`, at `touchTarget.min` height; hidden while one locale ships |
| Sign out | quiet button (wide), secondary button (phone footer) |
| Nav item | `touchTarget.min` tall, at least 64 wide; `text.secondary` semibold `size.bodySm`; current: `text.primary` bold, bottom `borderWidth.thick` `brand.primary`, `aria-current="page"` |
| Footer | `surface.sunken`; links `text.secondary` underlined, `touchTarget.min` both ways; to `https://hangulroute.com` About, Privacy, Terms (same tab) |

## Accessibility

- Persona switch: `role="radiogroup"` labelled `a11y.shell.personaSwitch` ("Switch between Family and Teacher"), two `role="radio"` with `aria-checked`, roving `tabindex`. **Manual activation**: arrow keys move focus only and never change `aria-checked`; Space, Enter or a click commits, writes the last persona and opens that home. Choosing navigates, so an arrow key alone must not (WCAG 3.2.2). A-5a tests that ArrowRight alone does not navigate. Text labels at every width.
- `nav` labelled with the active persona's name; `aria-current="page"` on the current item (the underline and weight are its non-colour cues).
- Contrast and state checks: README, "Greyscale and protanopia".
- No sideways scroll at 320 and 375, also at 200 % text (the header wraps to a second row; `frame-states-375-text200.png`).

## PageBack, the Learner app exit and Display (revision 2026-10-16, DN-5 and DN-6)

Wireframe `design/wireframes/shell/screen-header.md` Panel C · mock `mock/frame-pageback.html` (teacher, the plan page), `mock/frame-pageback-space.html` (a space page: back to the persona home), `mock/frame-pageback-family.html` (both personas) · rules `mock/display-nav.css` · shots `frame-pageback-320.png`, `-375.png`, `-768.png`, `-1280.png`, `-375-text200.png`, `frame-pageback-space-375.png`, `frame-pageback-family-375.png`, `-1280.png`

```
375, one persona (one header row; the brand mark steps out below 45em):
 16 | Teacher            ( Aa ) (Learner app >) | 16
    | Classes | Lessons | Lecture mode | Billing |
    |---------------------------------------------|
    | (< Back to Saturday class)                  |   <- PageBack: top left of the content, above the h1
    | Plan the week                          (h1) |

375, both personas: the switch takes the first row, Display and the exit the second (right aligned)

1280:
 (HR) Hangul Route  Teacher                    ( Aa )  Sign out  (Learner app >)
   Classes   Lessons   Lecture mode   Billing
   (< Back to Saturday class)
   Plan the week
```

- **PageBack** (`.page-back`): the `arrow-left` glyph and the page's existing back message without its leading "← " (`console.plan.back`, `.settings.back`, `.lecture.back`, `.relink.back`, `.curriculum.back`, `.learningRoute.back.*`, `.notes.sent.back.*`, `.billing.receipts.back`); on a space's own page "Back to {page}" (`console.pageBack.to`) with the persona home's nav label ("Back to Classes", "Back to Home"). `touchTarget.min` tall, `size.body` bold `text.primary`, no border (it is a link), the same place on every page and width. Persona homes and nav targets have none.
- **Learner app** (`.learner-exit`, `console.shell.backToLearning`, changed; "Open the learner app" is retired): label first, then the `arrow-right` glyph (it leaves, it is not a Back), pill on paper with `borderWidth.thin` `border.strong`, `size.bodySm` bold, `touchTarget.min` tall; always the **last** control of the header row, at the right. Its action is unchanged (clears the unlock and the console session, `learnerHome()` with `?lang=`).
- **Display (Aa)** (`.aa-btn`) sits before Sign out (wide) or before the exit (phone); the Language select is removed from the header and the phone footer (the footer keeps Sign out).
- **Phone header**: below 45em the brand mark steps out (the nav's first item is the persona home), so persona, Display and the exit share one row with one persona (`frame-pageback-375.png`); with the persona switch they need a second row, right aligned (`frame-pageback-family-375.png`). This amends the one-row phone header of D2 for accounts with both personas only.
- **Measured**: no sideways scroll at 320, 375, 768, 1280 and 375 with 200 % text; every control at least 64 px.
- **Strings**: `console.pageBack.to` (new), `console.shell.backToLearning` (changed), the five `back(space)` values without "← " (AMENDMENTS-DISPLAY-NAV section 10); `common.display.button` / `.a11y`.
