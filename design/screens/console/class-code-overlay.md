# Class code overlay and the folded What to revisit (design pass CO-0)

Spec: `docs/specs/AMENDMENTS-CLASS-CODE-OVERLAY.md` (draft, revision 1) sections 3.1 to 3.7, row **CO-0**; built by rows
CO-1 (Show the code and the overlay) and CO-2 (the card's What to revisit).
Wireframe: `design/wireframes/console/class-code-overlay.md`.
Approval: multi-agent review (CLAUDE.md section 5, owner rule 2026-10-12); the log is at the end of this file.

**The mock is a design reference, not shipped code.** Every value is a token of `packages/design-system/src/tokens.ts`
as a custom property named after it (`../../app-shell/mock/app-shell.css`, `../../approvals/mock/approvals.css`, and
the block at the top of `mock/class-code-overlay.css` for the tokens those two do not carry: `typography.size.hero`,
`z.modal`, the `presenter` scale, and five spacing tokens as plain numbers for stage units). No colour, spacing, radius
or size literal in a rule; no `feedback.danger`; no emoji; no motion.

| File | Shows |
|---|---|
| `mock/class-code-overlay.html` | the overlay open over the class page (the page is in the DOM, inert and covered), as the work order lists it: class name, Class code, the code, the expiry, the QR and its caption, Close |
| `mock/class-code-overlay-howto.html` | the same with OD-CO5's how-to-join line (recommended) |
| `mock/class-code-overlay-page.html` | the class page itself: Show the code in the bar, every card folded (the default), Invite students closed |
| `mock/class-code-overlay-cards.html` | the board: the bar in four cases (B1 to B4) and the card in six (C1 to C6) |
| `mock/class-code-overlay.css` | the rules of this pass |
| `tools/class-code-overlay-build.mjs` | writes the four pages from one string table and draws the QR exactly as the console does (edit it, not the HTML) |
| `tools/class-code-overlay-capture.mjs` | the checks below, and the shots |
| `shots/class-code-overlay-{1280x720,1920x1080,1024x768,768x1024,360x740}.png`, `-320x568-text200.png` (and `-end`) | the overlay on a 16:9 and a 4:3 projector, a large TV, a tablet, a phone, and a small phone at 200 % text |
| `shots/class-code-overlay-howto-{1280x720,360x740}.png` | OD-CO5 |
| `shots/class-code-overlay-page-{1280,360}.png`, `shots/class-code-overlay-cards-{1280,360}.png` | the page and the board, full page |

`NODE_PATH=<checkout>/apps/web/node_modules node design/screens/console/tools/class-code-overlay-capture.mjs` passes with
no finding on every page and window (12 renders).

## The overlay (CO-1)

```
  wide, landscape, >= 700 px (two columns)                  narrow (one column, scrolls up and down)
 +------------------------------------------------------+    +---------------------+
 |                                          ( Close )   |    |         ( Close )   |
 |  Sunday Class A                     +------------+   |    |   Sunday Class A    |
 |  Class code                         |            |   |    |     Class code      |
 |  S U N 2 3 4                        |   [ QR ]   |   |    |    S U N 2 3 4      |
 |  expires in 18 days                 |            |   |    | expires in 18 days  |
 |  (Tap "Join a class" ..., OD-CO5)   +------------+   |    |  (how to join)      |
 |                                  Scan it with the ...|    |      [ QR ]         |
 +------------------------------------------------------+    |  Scan it with ...   |
                                                             +---------------------+
```

### Values

One stage unit `u` = `min(100vw / presenter.stage.width, 100dvh / presenter.stage.minHeight)` (1280, 600; `100vh`
where `dvh` is missing), the presenter's own scale (F-TCH-004 section 3.6). Every size is "the console token as a
floor, the presenter token in stage units above it".

| Part | Element and tokens |
|---|---|
| Overlay | `role="dialog"`, `aria-modal="true"`; `position: fixed; inset: 0`; `z.modal`; `colors.surface.paper`, no scrim, no shadow; padding `layout.gutter.compact` / `.regular` (600) / `.wide` (900), by the window (px, F-LAYOUT-001) |
| Close | the console button (`buttonBase`: pill, `touchTarget.min` high, `border.strong`, `text.primary`), text "Close"; top inline-end, first in the DOM |
| Body | a grid, centred in the height; gap `max(spacing.xl, spacing.xxxl u)` |
| Class name | `h2`, `tabIndex={-1}`, first focus; `max(typography.size.title, presenter.size.prompt u)`, `weight.bold`, `leading.tight`, `text.primary`; wraps anywhere |
| Caption "Class code" | `max(typography.size.body, presenter.size.caption u)`, `weight.semibold`, `text.secondary` |
| The code | `aria-hidden`; `typography.family.mono`, `weight.bold`, `leading.tight`, `text.primary`; size `min(max(typography.size.hero, presenter.size.display u), 100cqi / CODE_WIDTH_EM)`; letter spacing `spacing.xl / presenter.size.display` em (8 px at 48 px, 24 px at 140 px); one line; the same space before the first letter when centred, so it stays centred |
| Spoken code | a visually hidden span, the characters with spaces ("S U N 2 3 4") |
| Expiry, how to join | the caption's size, `weight.regular`, `text.secondary` |
| Gaps in the text block | `max(spacing.sm, spacing.lg u)` |
| QR | the console's QR drawing (`JoinLinkQrImage`, spec 3.5): `text.primary` modules on a `surface.paper` square with the 4-module quiet zone, `shape-rendering: crispEdges`, no border; side `max(4 x touchTarget.min, presenter.size.glyph u)`, at most its column; `role="img"` named "QR code of the join link" |
| QR caption | the caption's size, `text.secondary`, centred under the QR, at most the QR's width |
| Two columns | `(orientation: landscape) and (min-width: 700px)` (`layout.sideBySideMin`): text block at the inline start (`1fr`), QR at the inline end (`auto`), column gap `max(spacing.xxxl, spacing.jumbo u)` |

### Measured (Chromium, the capture tool)

| Window | Code | QR | Layout |
|---|---|---|---|
| 1920 x 1080 | 210 px | 570 px | two columns, all in the first screen |
| 1280 x 720 | 140 px | 380 px | two columns, all in the first screen |
| 1024 x 768 (4:3) | 112 px | 304 px | two columns, all in the first screen |
| 768 x 1024 (tablet, upright) | 84 px | 256 px | one column |
| 360 x 740 | 48 px | 256 px | one column |
| 320 x 568, 200 % text | 60 px (fit) | 256 px | one column, scrolls; the code still on one line |

On every render: nothing scrolls sideways; every button is at least 64 px high; every point of a 12 x 8 grid over the
window hits the overlay (nothing of the page shows); the page behind is inert; the overlay's text and attributes hold
no name, initial, jamo, word or card line of the page behind; the code is on one line inside its column; on the three
landscape windows the code and the whole QR are in the first screen; the QR is at least 256 px wide and reads back,
with jsQR 1.4.0 on the drawn colours, as `https://app.hangulroute.com/join#c=SUN234`.

## Show the code in the bar (CO-1)

The console button (`Button`, secondary) in `ClassActionBar`'s bar row, after the everyday buttons and before a
waiting entry (board B1 to B3); `aria-haspopup="dialog"`. Absent without a live code (B4), where Invite students says
"code —" and holds Create a code, as today.

## What to revisit on a class card (CO-2)

| Part | Element and tokens |
|---|---|
| Place | card line 4 (GX-7 T4), after the quests and, with OD-CO1, after "Words: N collected · M strong" |
| Button | a full-width row: `min-height: touchTarget.min`; padding `spacing.xs spacing.sm`; a `borderWidth.thin` `border.subtle` rule above and below; `surface.paper`; `size.bodySm`, `weight.semibold`, `text.primary`, start-aligned; the console chevron (16, `spacing.lg`, `text.secondary`, turned when open) at the end; `aria-expanded`, `aria-controls` while open, `aria-describedby` the learner's name |
| Body | mounted only while open; `size.bodySm`, `leading.relaxed`, `text.secondary`; the jamo `lang="ko"`; each word's Hangul and romanization kept together, the gloss free to wrap (as `VocabWordsParts.tsx`); "Nothing to revisit yet." when there is neither |
| States | C1 folded; C2 letters and words; C3 letters only; C4 nothing to revisit (OD-CO2); C5 no summary, no button; C6 initials, folded |

## Decisions taken in this design pass

- **D1. Opaque paper, no scrim.** A scrim lets the page show through, and on a projector a 40 % scrim is no cover. The
  overlay is `surface.paper` edge to edge; the capture tool proves no point of the window shows the page.
- **D2. The presenter's scale, with console floors.** The class page is already "a classroom screen" (`page.tsx:190`)
  and the presenter already sizes a class code for a room (F-TCH-004 section 3.6). Sharing its stage unit keeps one
  rule for "big enough for the back row" and needs no new token. The floors keep a phone at console sizes.
- **D3. The two-column switch is in px.** Console switches are in em so that larger text moves them; here the content
  scales with the window, not the text, and 200 % text on a 1280 projector should keep the code and the QR side by side.
  The px value is a token (`layout.sideBySideMin`, the story reader's two-column rule).
- **D4. The letter spacing is a share of the code size** (`spacing.xl` per `presenter.size.display`), not a fixed step,
  so the one-line fit (`CODE_WIDTH_EM`) holds at every size; it is 8 px at the 48 px floor, the console panel's own
  `spacing.sm`.
- **D5. First focus on the class name.** As the review sheet's title: the dialog is to be read, and a screen reader hears
  the name, then the caption, the code letter by letter and the expiry (its description). Close is the next stop.
- **D6. Close is a text button at the top inline-end**, as in the review sheet's header row, never an icon alone; it is
  the console's normal size on every window (it is for the teacher, not the room).
- **D7. The QR is always shown and has no frame.** The QR caption moves from `text.muted` (the panel) to
  `text.secondary`, and the caption and expiry are never `text.muted`, because projectors lose contrast.
- **D8. The card's disclosure is a row button at line 4**, not a `<details>` (the class page test forbids one on a card)
  and not a pill in the actions row (it would read as an action and leave its lines far from their place).
- **D9. How to join (OD-CO5) sits under the expiry**, in the text block, so in both layouts the line that says "type
  this code" is next to the code.
- **D10. No motion.** The overlay appears and goes at once; nothing to reduce for `prefers-reduced-motion`.
- **D11. The page behind does not scroll** while the overlay is open (the root element's overflow is hidden, restored on
  close; `html.co-open` in the mock): no page scroll bar beside the overlay, and the wheel over a short overlay does not
  move the page under it.

## Accessibility

- Contrast on `surface.paper`: the class name, the code and the QR modules `text.primary` 16.1:1; the caption, expiry,
  how-to-join line and QR caption `text.secondary` 8.44:1; the card's body lines `text.secondary` 8.44:1; the focus ring
  `border.focus` 4.3:1.
- Every control is at least `touchTarget.min` (64) high: Show the code, Close, What to revisit.
- Reading order in the overlay: Close, the class name, the caption, the code (as its spoken copy), the expiry, how to
  join, the QR (named), its caption. Focus order: the name (first focus, programmatic), Close.
- Names: the dialog is named by the class name and described by the caption, the spoken code and the expiry; the QR is
  `role="img"` "QR code of the join link"; What to revisit is described by the learner's name, so a list of buttons says
  whose card it is.
- Korean: the card's jamo and words keep `lang="ko"`; the overlay holds no Korean.

## Constants

| Where | Value | Derived from |
|---|---|---|
| The code's fit, `CODE_WIDTH_EM` | 4.8 | six monospace characters at the 0.6 em advance of Menlo and Courier (3.6 em) plus seven letter spaces of `spacing.xl / presenter.size.display` em (1.2 em): six after the letters and one before them to keep a centred code centred |
| Stage unit | `min(100vw / 1280, 100dvh / 600)` | `presenter.stage.width`, `presenter.stage.minHeight` (tokens, F-TCH-004 `stage-scale.ts`) |
| Board windows | 1920 x 1080, 1280 x 720, 1024 x 768, 768 x 1024, 360 x 740, 320 x 568 | design board only, not UI: a large TV, 16:9 and 4:3 projectors, an upright tablet, phones |

## Not drawn here

- **Spanish and Korean.** The spec gives the English only; the reviewed es and ko come with rows CO-1 and CO-2 (R8
  draft, F-I18N-001 section 3.10). Their e2e writes the built overlay in en, es and ko
  (`shots/class-code-overlay-built-{lc}-{w}.png`), and the length budget holds the new `cta`.
- The focus ring states (the shipped `:focus-visible` ring, unchanged); the grown-up lock over the overlay (unchanged).

## Owner questions

The six of the spec, section 10: OD-CO1 (fold "Words to revisit" too), OD-CO2 (the button on every card with a
summary), OD-CO3 (no Open all), OD-CO4 (no browser full screen), OD-CO5 (the how-to-join line, drawn in
`mock/class-code-overlay-howto.html`), OD-CO6 (fold no more lines for now). The mock draws each recommendation.

## Review log

- 2026-11-23, author pass (design, accessibility, privacy, against spec sections 3.1 to 3.7 and the wireframe): the
  page behind first overflowed at 320 with 200 % text because the mock kept a whole word gloss unbreakable; it now keeps
  only the Hangul and its romanization together, as the shipped `VocabWordsParts.tsx` does. The QR caption is centred
  under the QR in both layouts. Multi-agent review pending.
