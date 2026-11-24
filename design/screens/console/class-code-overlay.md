# Class code overlay and the folded What to revisit (design pass CO-0, revision 2)

Spec: `docs/specs/AMENDMENTS-CLASS-CODE-OVERLAY.md` (revision 2) sections 3.1 to 3.7, row **CO-0**; built by rows
CO-1 (Show the code and the overlay) and CO-2 (the card's What to revisit); CO-1b (the teacher home entry) waits for
OD-CO7.
Wireframe: `design/wireframes/console/class-code-overlay.md`.
Approval: multi-agent review (CLAUDE.md section 5, owner rule 2026-10-12); the log is at the end of this file.

**The mock is a design reference, not shipped code.** Every value is a token of `packages/design-system/src/tokens.ts`
as a custom property named after it (`../../app-shell/mock/app-shell.css`, `../../approvals/mock/approvals.css`, and
the block at the top of `mock/class-code-overlay.css` for the tokens those two do not carry: `typography.size.hero`,
`z.modal`, the `presenter` scale, and five spacing tokens as plain numbers for stage units). No colour, spacing, radius
or size literal in a rule (the media queries use the `layout.breakpoint` values, named); no `feedback.danger`; no
emoji; no motion.

| File | Shows |
|---|---|
| `mock/class-code-overlay.html` | the overlay open over the class page (the page is in the DOM, inert and covered): class name, Class code, the code, the expiry, the how-to-join line (OD-CO5, owner decision 2026-11-23), the QR and its caption, Close |
| `mock/class-code-overlay-page.html` | the class page itself: Show the code in the bar, every card folded (the default), Invite students closed; with a small script, so Show the code, Close, Escape, Tab and the cards' What to revisit can be tried with the keyboard and the pointer |
| `mock/class-code-overlay-cards.html` | the board: the bar in four cases (B1 to B4), a teacher home class row for OD-CO7 (H1, awaiting owner), and the card in six cases (C1 to C6) |
| `mock/class-code-overlay.css` | the rules of this pass |
| `tools/class-code-overlay-build.mjs` | writes the three pages from one string table and draws the QR exactly as the console does (edit it, not the HTML) |
| `tools/class-code-overlay-capture.mjs` | the checks below, and the shots |
| `shots/class-code-overlay-{1920x1080,1280x720,1024x768,683x512,640x360,768x1024,360x740}.png`, `-320x568-text200.png` (and `-end`) | the overlay on a large TV, 16:9 and 4:3 projectors, both zoomed (150 %, 200 %), an upright tablet, a phone, and a small phone at 200 % text |
| `shots/class-code-overlay-1280x720-courier.png` | the code in Courier New, the fallback of `typography.family.mono` on Windows and ChromeOS |
| `shots/class-code-overlay-print.png` | the print render (print media): the overlay only |
| `shots/class-code-overlay-page-{1280,360}.png`, `shots/class-code-overlay-cards-{1280,360}.png` | the page and the board, full page |

The tools need apps/web's install (`pnpm install`, and a Playwright Chromium for the capture tool); in a worktree with
no install of its own, set `NODE_PATH` to a checkout's `apps/web/node_modules`.
`node design/screens/console/tools/class-code-overlay-capture.mjs` passes with no finding (15 renders).

## The overlay (CO-1)

```
  landscape, >= 600 px wide (two columns)                   otherwise (one column, scrolls up and down)
 +------------------------------------------------------+    +---------------------+
 |  Sunday Class A                     +------------+   |    |         ( Close )   |
 |  Class code                         |            |   |    |   Sunday Class A    |
 |  S U N 2 3 4                        |   [ QR ]   |   |    |     Class code      |
 |  expires in 18 days                 |            |   |    |    S U N 2 3 4      |
 |  Tap "Join a class" in Hangul ...   +------------+   |    | expires in 18 days  |
 |                                   Scan it with the ...|    |  Tap "Join a ..."   |
 |                                          ( Close )   |    |      [ QR ]         |
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
| Close | the console button (`buttonBase`: pill, `touchTarget.min` high, `border.strong`, `text.primary`), text "Close"; last in the DOM; drawn at the top inline-end in one column, at the bottom inline-end in two |
| Body | a grid that grows with its content (so centring never pushes anything above the top); gap `max(spacing.xl, spacing.xxxl u)` |
| Class name | `h2`, `tabIndex={-1}`, first focus; `max(typography.size.title, presenter.size.prompt u)`, `weight.bold`, `leading.tight`, `text.primary`; wraps anywhere |
| Caption "Class code" | `max(typography.size.body, presenter.size.caption u)`, `weight.semibold`, `text.secondary` |
| The code | `aria-hidden`; `typography.family.mono`, `weight.bold`, `leading.tight`, `text.primary`; size `min(max(typography.size.hero, presenter.size.display u), 100cqi / CODE_WIDTH_EM)`; letter spacing `spacing.xl / presenter.size.display` em (8 px at 48 px, 24 px at 140 px); one line; the same space before the first letter when centred |
| Spoken code | a visually hidden span, the characters with spaces ("S U N 2 3 4") |
| Expiry, how to join | the caption's size, `weight.regular`, `text.secondary` |
| Gaps in the text block | `max(spacing.sm, spacing.lg u)` |
| QR | the console's QR drawing (`JoinLinkQrImage`, spec 3.5): `text.primary` modules on a `surface.paper` square with the 4-module quiet zone, `shape-rendering: crispEdges`, unframed; side `max(4 x touchTarget.min, presenter.size.glyph u)`, at most its column; in two columns also at most `100dvh − 2 gutters − touchTarget.min − 3 x spacing.sm − QR_CAPTION_LINES x leading.normal x caption size`; `role="img"` named "QR code of the join link" |
| QR caption | the caption's size, `text.secondary`, centred under the QR, as wide as the QR |
| Two columns | `(orientation: landscape) and (min-width: 600px)` (`layout.breakpoint.regular`): text block at the inline start (`1fr`), QR at the inline end (`auto`), column gap `max(spacing.xxxl, spacing.jumbo u)` |
| Print | while open (`data-hr-code-overlay` on the root; `html.co-open` in the mock): every inert element `display: none`, the overlay `position: static` with `print-color-adjust: exact`, Close not printed |

### Measured (Chromium, the capture tool)

| Window | Code | QR | Layout |
|---|---|---|---|
| 1920 x 1080 | 210 px | 570 px | two columns, all in the first screen |
| 1280 x 720 | 140 px | 380 px | two columns, all in the first screen |
| 1280 x 720, Courier New | 140 px, one line | 380 px | as above |
| 1024 x 768 (4:3) | 112 px | 304 px | two columns, all in the first screen |
| 683 x 512 (1024 x 768 at 150 % zoom) | 69 px | 256 px | two columns, all in the first screen |
| 640 x 360 (1280 x 720 at 200 % zoom) | 70 px | 151 px (height cap) | two columns, all in the first screen |
| 768 x 1024 (tablet, upright) | 84 px | 256 px | one column |
| 360 x 740 | 48 px | 256 px | one column |
| 320 x 568, 200 % text | 60 px (fit) | 256 px | one column, scrolls; the code still on one line |

On every render: nothing scrolls sideways; every button is at least 64 px high; every point of a 12 x 8 grid over the
window hits the overlay (nothing of the page shows); the page behind is inert; the overlay's text and attributes hold
no name, initial, jamo, word or card line of the page behind; the code is on one line inside its column; on the
landscape windows the code and the whole QR are in the first screen; the QR reads back, with jsQR 1.4.0 on the drawn
colours, as `https://app.hangulroute.com/join#c=SUN234`. Printed: no learner name, jamo or card line, the code there.
On the class page mock with the keyboard: Enter on Show the code closes the open card, opens the overlay with focus on
the class name and the page inert and not scrolling; Tab stays on Close; Escape, and Tab then Enter on Close, close it
with focus back on Show the code.

## Show the code in the bar (CO-1)

A plain `<button>` drawn as the console button (`buttonBase`, secondary) in `ClassActionBar`'s bar row, after the
everyday buttons and before a waiting entry (board B1 to B3); `aria-haspopup="dialog"`; the page keeps its ref to
return focus. Absent without a live code (B4), where Invite students says "code —" and holds Create a code, as today.
OD-CO7 (a), awaiting owner: the same button in a teacher home class row's links (board H1).

## What to revisit on a class card (CO-2)

| Part | Element and tokens |
|---|---|
| Place | card line 4 (GX-7 T4), after the quests and "Words: N collected · M strong" |
| Button | a full-width row: `min-height: touchTarget.min`; padding `spacing.xs spacing.sm`; a `borderWidth.thin` `border.subtle` rule above and below; `surface.paper`; `size.bodySm`, `weight.semibold`, `text.primary`, start-aligned; the console chevron (16, `spacing.lg`, `text.secondary`, turned when open) at the end; `aria-expanded`, `aria-controls` while open, `aria-describedby` the learner's name |
| Body | not mounted while closed (the mock uses `hidden` for its script); `size.bodySm`, `leading.relaxed`, `text.secondary`; the jamo `lang="ko"`; each word's Hangul and romanization kept together, the gloss free to wrap (as `VocabWordsParts.tsx`); "Nothing to revisit yet." when there is neither |
| States | C1 folded; C2 letters and words; C3 letters only; C4 nothing to revisit; C5 no summary, no button; C6 initials, folded; Show the code closes every open card |

## Decisions taken in this design pass

- **D1. Opaque paper, no scrim.** A scrim lets the page show through, and on a projector a 40 % scrim is no cover. The
  capture tool proves no point of the window shows the page.
- **D2. The presenter's scale, with console floors.** The class page is already "a classroom screen" (`page.tsx:190`)
  and the presenter already sizes a class code for a room (F-TCH-004 section 3.6). One rule for "big enough for the
  back row", no new token. The floors keep a phone at console sizes.
- **D3. Two columns on any landscape window from `layout.breakpoint.regular` (600 px)** (revision 2; revision 1 used
  `layout.sideBySideMin`, 700). Browser zoom shrinks the window in CSS px, so a 1024 x 768 projector at 150 % is a
  683 x 512 window; at 700 it fell to one column and the QR went below the screen. The switch is in px because the
  content scales with the window, not the text.
- **D4. The letter spacing is a share of the code size** (`spacing.xl` per `presenter.size.display`), so the one-line
  fit (`CODE_WIDTH_EM`) holds at every size; it is 8 px at the 48 px floor, the console panel's own `spacing.sm`.
- **D5. First focus on the class name**, as the review sheet's title. Close is the next stop.
- **D6. Close is a text button, last in the page order** (revision 2): at the top inline-end in one column, where a
  phone user looks, and at the bottom inline-end in two columns, in reach on a wall-mounted touch panel. It is the
  console's normal size on every window (it is for the teacher, not the room). Its visual place differs from its DOM
  place in one column; it is the only control, so the focus order is unchanged.
- **D7. The QR is always shown and unframed; in two columns it is no taller than the window leaves** (revision 2), so
  short windows keep the code and the whole QR on one screen (151 px at 640 x 360). The QR caption moves from
  `text.muted` (the panel) to `text.secondary`, and nothing on the overlay is `text.muted`: projectors lose contrast.
- **D8. The card's disclosure is a row button at line 4**, not a `<details>` (the class page test forbids one on a card)
  and not a pill in the actions row.
- **D9. How to join sits under the expiry**, next to the code it talks about, in both layouts.
- **D10. No motion.**
- **D11. The page behind does not scroll** while the overlay is open.
- **D12. Print shows the overlay only** (revision 2): browsers drop backgrounds when printing, so without a print rule
  the roster would print through the overlay. Every inert element leaves the print.
- **D13. The class page mock behaves** (revision 2): a small script opens and closes the overlay and the cards, so the
  keyboard rules can be tried and are checked by the capture tool before the build exists.

## Accessibility

- Contrast on `surface.paper`: the class name, the code and the QR modules `text.primary` 16.1:1; the caption, expiry,
  how-to-join line and QR caption `text.secondary` 8.44:1; the card's body lines `text.secondary` 8.44:1; the focus ring
  `border.focus` 4.3:1.
- Every control is at least `touchTarget.min` (64) high: Show the code, Close, What to revisit.
- Reading order in the overlay: the class name, the caption, the code (as its spoken copy), the expiry, how to join, the
  QR (named), its caption, Close. Focus order: the name (first focus, programmatic), Close.
- Names: the dialog is named by the class name and described by the caption, the spoken code and the expiry; the QR is
  `role="img"` "QR code of the join link"; What to revisit is described by the learner's name.
- Korean: the card's jamo and words keep `lang="ko"`; the overlay holds no Korean.

## Constants

| Where | Value | Derived from |
|---|---|---|
| The code's fit, `CODE_WIDTH_EM` | 4.8 | six monospace characters at the 0.6 em advance of Menlo and Courier (3.6 em) plus seven letter spaces of `spacing.xl / presenter.size.display` em (1.2 em) |
| The QR caption's reserved lines, `QR_CAPTION_LINES` | 3 | the caption is as wide as the QR, and takes 3 lines at the narrowest landscape QR (640 x 360) |
| Stage unit | `min(100vw / 1280, 100dvh / 600)` | `presenter.stage.width`, `presenter.stage.minHeight` (tokens, F-TCH-004 `stage-scale.ts`) |
| Board windows | 1920 x 1080, 1280 x 720, 1024 x 768, 683 x 512, 640 x 360, 768 x 1024, 360 x 740, 320 x 568 | design board only, not UI |

## Not drawn here

- **Spanish and Korean.** The spec gives the English only; the reviewed es and ko come with rows CO-1 and CO-2 (R8
  draft, F-I18N-001 section 3.10). Their e2e writes the built overlay in en, es and ko
  (`shots/class-code-overlay-built-{lc}-{w}.png`).
- The lock screen over the overlay and the reopen after the unlock (spec 3.6; unchanged screens).

## Owner questions

Decided 2026-11-23 as recommended: OD-CO1 to OD-CO5. Awaiting the owner (review 2026-11-23): OD-CO6 (re-opened: what
stays on a folded card, or a presenting mode), OD-CO7 (new: Show the code on the teacher home, board H1), OD-CO8 (new:
the class's "together" lines with fewer than 3 contributing learners). Spec section 10.

## Review log

- 2026-11-23, author pass: the page behind first overflowed at 320 with 200 % text because the mock kept a whole word
  gloss unbreakable; it now keeps only the Hangul and its romanization together, as `VocabWordsParts.tsx` does. The QR
  caption is centred under the QR in both layouts.
- 2026-11-23, revision 2 after the two-lens multi-agent review of PR #1073 (spec section 11): the switch moved to
  landscape from `layout.breakpoint.regular` and the landscape QR is capped by the height left (D3, D7), with 683 x 512
  and 640 x 360 added; Close moved to the bottom corner in landscape (D6); a print rule and a print check (D12); a
  Courier New render and check; the how-to-join line is in the main mock (OD-CO5 decided) and the separate "howto"
  page and its shots are gone; the class page mock gained a script and the capture tool a keyboard check (D13);
  Show the code closes every open card; board H1 draws OD-CO7 (a). The check of the fold now counts what is shown.
