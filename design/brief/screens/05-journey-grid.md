# Screen 05 — Main · Journey (7×5 Heritage Grid)

**The map.** The child sees the whole vision in one screen.

## 1. Context

- **When**: tapping "Journey" tab.
- **Goal**: render the 7 stages × 5 themes grid so the child can see their route + tap into any Stage 1 episode.
- **Success**: child taps a Stage 1 cell and arrives at Episode detail.

## 2. Layout

```
┌─────────────────────────────────────┐
│ Heritage Journey   (title)           │
│ 7 stages × 5 themes. Draw your route.│
│                                      │
│  Lett Life Rite Natu Craf            │
│                                      │
│ ① Hangul                  [Open]     │
│ Meet every Korean letter...          │
│ [L][L][L][L][L]   ← clickable cells  │
│                                      │
│ ② Words                   [Soon]     │
│ Stack letters into 60 words...       │
│ [🔒][🔒][🔒][🔒][🔒]                 │
│                                      │
│ ③ Sentences               [Soon]     │
│ ...                                  │
│ [🔒][🔒][🔒][🔒][🔒]                 │
│                                      │
│ (... stages 4-7 ...)                 │
│                                      │
│ ┌────────────────────────────────┐ │
│ │ How the journey works            │ │
│ │ Each cell is one episode. Finish │ │
│ │ quests to earn Heritage cards.   │ │
│ └────────────────────────────────┘ │
│                                      │
│ [tab bar — Journey active]           │
└─────────────────────────────────────┘
```

## 3. Visual style

- Per-stage row:
  - Stage badge: 32×32 circle, stage color fill (`colors.stage[N]`), white number
  - Stage title: `body` weight 700
  - One-liner: `caption` muted
  - Open/Soon pill on the right
- Grid row: 5 square cells per stage, equal flex
  - Stage 1 cells: paper fill, 2px stage1 border, theme glyph (`design/components/Icon/theme-glyphs.md`)
  - Locked cells: `surface.sunken` fill, lock icon, no border emphasis
  - Completed cells: success-light fill + success border + check inside
- Theme column headers (small caption, muted) above the first stage row

## 4. Exact copy

- Title: **"Heritage Journey"**
- Sub: **"Every lesson, by stage and theme."** (superseded by AMENDMENTS-ROUTE-LEARNING-ROUTE §7.2 and LR-OD-3, LR-1: the grid no longer says "route", so Journey and the Route tab never read as synonyms; the original brief said "7 stages × 5 themes. Draw your own route.")
- Stage labels: Hangul / Words / Sentences / Dialogue / Stories / Real-use / Self-expression
- One-liners per stage (see `apps/mobile/src/content/stages.ts`)
- Helper card title: **"How the journey works"**
- Helper card body: **"Each cell is one episode. Finish quests to earn Heritage cards. Stages 2-7 unlock as Stage 1 completes."**

## 5. Claude Design prompt

```prompt
Design the Journey (Heritage Grid) screen for Hangul Route. Output:
1170 × 3600 PNG (long-scroll showing all 7 stages).

Layout (top to bottom, 48px horizontal padding):

1. 60px status bar
2. Title "Heritage Journey" — 84sp bold #2A1F14
3. 12px gap
4. Subtitle "Every lesson, by stage and theme." — 54sp #5C4A36 (LR-1 copy, see section 4)
5. 48px gap

6. Theme column header row (sm caption above the first stage row only):
   - 5 columns labeled with first word of each theme:
     "Letters" / "Life" / "Rites" / "Nature" / "Crafts"
   - 42sp italic #8A7860, center-aligned per column, equal flex
   - 36px gap below

7. STAGE BLOCKS (7 blocks vertically, 48px gap between blocks):

  For each stage, render:
  a. Header row:
     - 96 × 96 sp circular badge filled with the stage color, white
       stage number (84sp weight 700) centered inside
     - 24px gap
     - Stage title + one-liner stack:
       • Title — 60sp weight 700 #2A1F14
       • One-liner — 42sp #8A7860
     - Flex spacer
     - Status pill on the right:
       Stage 1: "Open" tone success (fill #D6EFDF text #2F6A47)
       Stages 2-7: "Soon" tone neutral (fill #F2EBDE text #5C4A36)

  b. Grid row of 5 square cells (equal flex, 12px gutters):
     - All cells: 1:1 aspect, 36px radius (radii.md), 6px border
     - Stage 1 cells (active): fill #FFFFFF, 6px border #E8743B (stage1
       color), centered big initial letter (84sp weight 700 in stage1
       color): L · L · L · L · L (theme first initials)
     - Stages 2-7 cells (locked): fill #F2EBDE, 6px border #E8DFCD,
       centered lock icon at 60sp #8A7860, no letter

   Stage colors (per stage badge + border):
   - Stage 1 #E8743B (Hangul)
   - Stage 2 #D89B2B (Words)
   - Stage 3 #7BB552 (Sentences)
   - Stage 4 #4A9DD6 (Dialogue)
   - Stage 5 #8265C2 (Stories)
   - Stage 6 #C84B7D (Real-use)
   - Stage 7 #3D9B8C (Self-expression)

   Stage titles and one-liners:
   - Stage 1: "Hangul" / "Meet every Korean letter and the sound it makes."
   - Stage 2: "Words" / "Stack letters into your first 60 Korean words."
   - Stage 3: "Sentences" / "Connect words into tiny, useful sentences."
   - Stage 4: "Dialogue" / "Have your first real-life mini conversations."
   - Stage 5: "Stories" / "Read short tales and Korean folk stories with Hoya."
   - Stage 6: "Real-use" / "Take Korean out into the world — menus, signs, calls."
   - Stage 7: "Self-expression" / "Say what you think, feel, and create — in Korean."

8. 96px gap

9. Helper Card (Card sunken md):
   - "How the journey works" — 66sp weight 700 #2A1F14
   - 12px gap
   - "Each cell is one episode. Finish quests to earn Heritage cards.
     Stages 2-7 unlock as Stage 1 completes." — 48sp #5C4A36

10. 96px bottom inset + 252sp tab bar (Journey tab active in #E8743B)

Background: warm hanji cream #FCF8F1.

Anti-patterns:
- All cells in the same color (each stage needs its tint)
- Locked cells looking inviting (must read as "wait — coming soon")
- Stage number circles without white text (contrast issue)
- "Soon" pill in red (use neutral, never red)
- Cells smaller than 64dp at 1x (tap target)

Deliverable: 1170 × 3600 PNG showing the full 7-stage grid.
```

## 6. Acceptance checklist

- [ ] 7 stage rows in correct color order
- [ ] Stage 1 cells open (no lock), Stages 2-7 locked with icon
- [ ] Theme column headers visible above first row
- [ ] Locked cells use `surface.sunken` fill
- [ ] Soon pill in neutral tone (never red)
- [ ] Stage badge numbers are white on stage color

## 7. Output path

- `design/screens/journey/grid__v1__YYYY-MM-DD.png`

## 8. Story cells (F-STORY-005, added by PR 5.0)

Spec: `docs/specs/F-STORY-005-episode-catalogue-grid.md` §3.6 · wireframe: `design/wireframes/journey/grid-with-stories.md` A, H · the cell page is `27-cell-stories.md`.

With heritage stories in the bundle the grid gains two cell looks and one mark; everything above this section is unchanged. Without a reviewed story the grid is exactly as above.

- **Count mark** (`#n`): a small circle (about 20 dp) in a cell's top-right corner: `surface.sunken` fill, `border.subtle` ring, the number in caption size `text.primary`; "5+" from six stories. It is part of the cell (not a separate button) and its number is read inside the cell's label.
- **Lesson cell with stories**: today's lesson cell (theme glyph (`design/components/Icon/theme-glyphs.md`), stage-tinted border, success tint when complete) plus the count mark.
- **Stories-only cell**: no lesson there yet, but stories: `Icon library` plus the count mark, `border.subtle` border, `surface.paper` fill, tappable. It does not change the stage pill (Open / Taste / Soon still reflects lessons and books only) and is never routed through the grown-up PIN.
- **Book cell** (Stage 5, later): drawn like a lesson cell.
- **Placeholder**: unchanged (lock, disabled, "coming soon").
- One muted caption under a stage row that has a stories-only cell: **"Heritage stories are open in the cells with books."**; the explainer card adds **"Cells with books also have heritage stories."** No fractions.

Prompt addition (append to the §5 prompt): "In Stage 1 add a small count mark circle (surface.sunken fill, border.subtle ring, caption-size number) to the top-right of all five cells (5, 1, 2, 1, 1). In Stage 2 draw three stories-only cells: a book icon in a paper cell with a subtle border and a count mark. Under Stage 2 add the muted caption 'Heritage stories are open in the cells with books.'"

Acceptance additions:

- [ ] Count marks sit inside the cell, never as a separate target; "5+" at six or more
- [ ] Stories-only cells read as open (paper fill, library icon), not locked
- [ ] Stage pills unchanged by story cells
