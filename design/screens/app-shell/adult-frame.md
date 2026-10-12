# AdultFrame: header, persona switch, navigation, footer (design mock v1, for A-5a and A-5c)

Wireframe: `design/wireframes/shell/adult-frame.md` (Panels A to C) · spec §3.8, §3.10, §3.16 · mock: `mock/frame-states.html` (and the frame of `parent-home.html`, `teacher-home.html`) · shots: `shots/frame-states-320.png`, `-375.png`, `-1280.png`, `-375-text200.png`, `parent-home-1280.png`, `teacher-home-1280.png`

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

- The header and nav are one paper band (`surface.paper`, bottom `borderWidth.thin` `border.subtle`); content sits on `surface.canvas`, at most `layout.maxWidth.full`.
- DOM order is the visual order at both widths: brand, persona, way back, Language, Sign out (the last two `display: none` below 45em, so out of the Tab order), then the nav, the main content, the footer (whose Language and Sign out exist only below 45em).

## Navigation (`ADULT_NAV`)

Items are drawn exactly as section 3.8 registers them; an item whose predicate is off is not drawn (never disabled). Lessons is a `<button>` (it opens the lesson browser window), the rest are links.

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
| `/teach/space…` or `/parent/space…` while the space kind loads | the switch with no option checked; only the items of both personas (Lessons, Billing), none highlighted |
| `/account/billing` (A-5c) | Billing highlighted in the active persona's row |
| Spaces fetch failed | brand, the way back, Language and Sign out only; no persona, no nav; the page shows its own Try again |
| Lock deciding | as A-4a built it: an empty canvas for the read (README, D12); then the lock or the page with its frame |

## Tokens

| Part | Tokens |
|---|---|
| Bar | `surface.paper`; padding `spacing.sm` block, `layout.gutter.compact` / `.regular` (45em) / `.wide` (70em) inline; items `spacing.sm` apart (`spacing.md` wide) |
| Brand | mark 48 (`spacing.xxxl`) `brand.primary` with `text.inverse` bold; name `size.bodyLg` bold `text.primary`, visually hidden below 45em (the link keeps its name) |
| Persona switch | `role="radiogroup"`; outline `borderWidth.base` `brand.secondaryDark`, `radii.pill`; options at least 64 x 64, `size.bodySm` bold; selected: fill `brand.secondaryDark`, label `text.onSecondary`; unselected: `surface.paper`, label `brand.secondaryDark` |
| Persona text | `text.secondary` semibold |
| Way back | `surface.paper`, `borderWidth.thin` `border.strong`, `radii.pill`, glyph `arrow-left` 20, `size.bodySm` bold `text.primary`, `touchTarget.min` tall; flex basis 7.5rem on phones (README, Constants) |
| Language | the existing `LanguageSelect`, at `touchTarget.min` height; hidden while one locale ships |
| Sign out | quiet button (wide), secondary button (phone footer) |
| Nav item | `touchTarget.min` tall, at least 64 wide; `text.secondary` semibold `size.bodySm`; current: `text.primary` bold, bottom `borderWidth.thick` `brand.primary`, `aria-current="page"` |
| Footer | `surface.sunken`; links `text.secondary` underlined, `touchTarget.min` both ways; to `https://hangulroute.com` About, Privacy, Terms (same tab) |

## Accessibility

- Persona switch: `role="radiogroup"` labelled `a11y.shell.personaSwitch`, two `role="radio"` with `aria-checked`, roving `tabindex`, arrow keys move. Text labels at every width.
- `nav` labelled with the active persona's name; `aria-current="page"` on the current item (the underline and weight are its non-colour cues).
- Contrast and state checks: README, "Greyscale and protanopia".
- No sideways scroll at 320 and 375, also at 200 % text (the header wraps to a second row; `frame-states-375-text200.png`).
