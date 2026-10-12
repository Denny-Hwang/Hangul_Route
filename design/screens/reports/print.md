# Print or save as PDF: the paper copy of a report (screen spec v1)

Spec: `docs/specs/F-REPORT-001-progress-reports.md` sections 3.1, 3.10, 3.12 (print), OD-7 · wireframe `design/wireframes/reports/print.md`
Mock: the `@media print` rules at the end of `mock/reports.css`, applied to `mock/learner-report.html`, `mock/class-report.html` and `mock/learner-report-all.html`
Shots: `shots/print-learner-a4.png`, `print-class-a4.png`, `print-learner-all-a4.png` (Chromium print emulation at A4 width, 794 CSS px, one long strip)
Code (planned): RP-7b, the shared print rules in `apps/web/src/app/globals.css` (layout only; colours stay inline from tokens) and the **Print or save as PDF** button; RP-8 reuses them for the class report

## What prints

The page as the screen shows it, in the same order, with More detail expanded, and nothing more:

| Screen part | On paper |
|---|---|
| Adult frame, back link, Send a note, Print and its hint | hidden |
| `h1` with the avatar chip, "Now on", the goal line, "Last practice" | printed; **Open Learning Route** hidden |
| Period tabs | only the selected tab, as plain bold text, followed by the window's dates from the stepper row ("This week  Oct 6 to Oct 12"); the step buttons are hidden |
| Headline, horizon line, insight lines | printed; line actions hidden; links print as plain text without URLs |
| Figures | printed as tiles (outline `border.strong` so they hold on paper) |
| Calendar | the grid is hidden; its sentence prints ("Practiced on Wednesday, Thursday and Monday.", plus "Not saved yet: ..." when partial) |
| Growth line (All time) | the chart, legend and axis are hidden; the table prints, even when it was closed on screen |
| More detail | the disclosure button is hidden; the panel prints expanded |
| Class report | every block in screen order; bands and strands as their text rows; homework rows; no names anywhere |
| Footer | `report.print.footer(date)` at `size.caption` `text.secondary` above a `border.strong` rule, at the bottom of every page |

## Page

- `@page { margin: 0 }`, and the page padding sits inside the body (`spacing.xxl` around, `spacing.jumbo` at the bottom, the footer's room), so Chromium and WebKit print no default title and URL lines. `document.title` is `report.documentTitle` in any case, and the hint beside the button says to turn headers and footers off where a browser still prints them (spec assumption h; RP-7b checks it by hand).
- Text uses `text.primary` on `surface.paper`; colour carries no meaning on paper (the figure "more than" line is words; calendar days are a sentence).
- Every block avoids a break inside it (`break-inside: avoid` on sections, tiles, detail blocks, strands, the calendar block and the growth block).
- The footer is `position: fixed` at the bottom, which Chromium repeats on every printed page. A fixed footer reserves no room by itself, so the report body uses `box-decoration-break: clone`: every printed page gets the body's top padding and its `spacing.jumbo` bottom padding, and no block runs under the footer. Without `clone` the first try of this mock printed the All-time page's "New letters this period" tiles under the footer; with it the block moves to page 2 (checked in the PDFs below). **For RP-7b**: check WebKit, whose `box-decoration-break` may not apply to page fragments; if it does not, the WebKit fallback is the footer in normal flow at the end of the report (printed once, never over a block), and the PR records the result next to assumption h.

## Measured (Chromium, A4 PDF with `preferCSSPageSize`)

| Page | Pages | Notes |
|---|---|---|
| Learner report, week (parent) | 2 | page 1: the glance to the starting spot; page 2: level check and plan; footer on both |
| Class report, week | 2 | page 1: the class lines to Time; page 2: level-check counts and homework; footer on both |
| Learner report, all time | 2 | the growth table prints in place of the chart; page 1 ends with the letters known well and being practiced, page 2 starts with the new letters |

## States

- The state text prints as it shows (no_data, empty, legacy, no practice): one short page.
- While the report is loading or failed, the print button is disabled (sunken fill, muted label), so nothing prints an error page.
- Nothing is generated or stored on a server; no share link, no email, no CSV (OD-7).
