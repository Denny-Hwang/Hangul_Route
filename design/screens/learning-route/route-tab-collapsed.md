# Route tab, quieter: one open stage, the others one row each (screen spec, DN-9; review 2026-10-17)

Spec: `docs/specs/AMENDMENTS-DISPLAY-NAV.md` section 9.6 · wireframe `design/wireframes/journey/route-tab-collapsed.md` · mock `mock/route-tab-collapsed.html` (rules `mock/route-tab-collapsed.css`, loaded after `learning-route.css`) · shots `shots/route-tab-collapsed-360.png`, `-768.png`, `-320-text200.png` · row **DN-9**

The route card, the plan line, the pips, the badges, the tags, the lesson-group rows and the tab bar are the shipped design of this folder (`route-tab.html`, `route-card.md`, LR-D), unchanged. What changes is the trail.

## Anatomy (top to bottom)

1. **Root header**: "Learning Route" (h1) and the purpose line on the left, the **Display (Aa)** control at the top right (`.aa-btn`, accessible name "Aa, Display: language and text size"; AMENDMENTS-DISPLAY-NAV section 3.6). No leading control: the tab is a root.
2. Route card and "Week 3 of your weekly plan": unchanged.
3. **The current stage, open** (`.trail-row.current`): one row button (badge, the stage name in `size.bodyLg` bold, "4 quests played" (`learner.myRoute.caption.played`) and an up chevron; `aria-expanded="true"`); under it, indented past the badge: the pips (unchanged rules), the tags "You are here" and "Your goal" (each shows once on the whole tab, on its own stage), and the stage's lesson groups as `.cell-row` boxes: theme caption, title, and a status **only when it is not open**: `Complete` (`learner.myRoute.state.complete`, `pill-success`), `Playing` (`learner.myRoute.cell.playing`, `pill-primary`), `In your plan` (`learner.routeNext.tag.inPlan`, with the shipped ring). An open lesson group carries no word.
4. **Every other stage, one row** (`.trail-row.collapsed`): badge, name, the stage's state word only when it is not open (`learner.myRoute.state.*`: Complete, Explored, You knew this, A taste, Coming later; `pill-neutral`), the played count only when above 0, and a down chevron; the whole row is one button at least `touchTarget.min` tall (`aria-expanded="false"`). **No ratio, no percent, nothing left to do** (F-ROUTE-001).
5. The skills card and gains: unchanged. The tab bar: unchanged.

Removed from the learner tab: the "Open" pill on stage rows and lesson groups, the "Ready when you are" caption. (Both keys stay: the grown-up Learning Route views still use them.)

## Accessibility

- Each stage row is a button named by its visible parts in order ("Stage 1, Hangul, 4 quests played, You are here, Your goal"); `aria-expanded` says whether it is open; the chevron is decorative.
- Focus order: header, Aa, route card, plan line, then the stage rows top to bottom; an opened stage's lesson groups follow its row.
- The stage colour is never the only signal: the number in the badge and the name say which stage it is.

## Measured (Chromium, the pass script)

At 360 x 740 the trail of seven stages is about 1 000 px with Stage 1 open (its five lesson groups shown) and the other six one row each; no sideways scroll at 360, 768 and 320 with 200 % text; every row at least 64 px; no console error; tokens only (the stage border colours are `colors.stage.*` custom properties, as in `route-tab.html`).

## Strings

No new key. `learner.myRoute.title`, `.purpose`, `.state.*`, `.caption.played`, `.tag.here`, `.tag.goal`, `.cell.playing`, `learner.routeNext.tag.inPlan`, `common.display.button` and `.a11y`; stage, theme and lesson-group titles are shipped content.
