# Library, Cards: collected first (screen spec, DN-9)

Spec: AMENDMENTS-DISPLAY-NAV section 9.3 · wireframe `design/wireframes/library/cards-collected-first.md` · mock `mock/library-cards.html`, `library-cards-open.html`, `library-cards-empty.html`

## Anatomy

1. Root header: "Heritage Library" and **Display (Aa)**; the count line (`learner.library.collected.line`, unchanged); the section tabs and the theme chips (unchanged; chips at least 64 x 64).
2. **Collected cards** first, most recently earned first (`cards[].unlockedAt`): the existing card tiles (face, Korean with romanization, title, the New pill), two across below 600 px, three from 600.
3. **Cards to earn** (`learner.library.cards.toEarn`): a disclosure button (`plus` / `dash`, `aria-expanded`), closed by default, **no count** (the Library shows the cards held, never a total: F-STORY-006 section 3.7, D3). Open, it shows the locked tiles with their earn hints, unchanged (`library-cards-open.html`).
4. The tab bar.

## States

Two collected (`library-cards.html`), the disclosure open (`library-cards-open.html`), nothing collected yet (`library-cards-empty.html`: the count line and the disclosure open by default). All collected: no disclosure. The theme chips filter both groups.

## As built (row OR-UX, 2026-10-17)

Spec section 9.8 deviation table, row "Library Cards" · code `apps/mobile/src/logic/library/shelves.ts` (`libraryShelves`), `apps/mobile/src/screens/library/LibraryScreen.tsx` · tests `logic/library/__tests__/shelves.test.ts`, e2e `learner-ux.spec.ts` (Library), `library-earn-hints.spec.ts` · shots of the build `shots/library-cards-as-built-360.png` (a new learner with the welcome card, 360 x 640) and `shots/library-cards-to-find-as-built-360.png` (Cards to find with the Next card row and the first group open).

1. **Your cards** (`learner.library.yours.title`) first: the held tiles, the most recently earned first (`cards[].unlockedAt`; cards earned together keep gallery order), unchanged faces and New pills. With none yet: "Your first card is waiting. Finish a quest to earn it." (`.yours.empty`).
2. **Cards to find** (`learner.library.toFind.title`), always visible while any card is still to find, in place of the Cards to earn disclosure:
   - **Next card** (`.toFind.next`): one row with a silhouette and the earn hint of the first card to find (named `.toFind.nextA11y(hint)`); it opens that card's page.
   - One closed row per episode, story, stage or set that earns cards (`.toFind.a11y(title)`, `aria-expanded`), titled with the episode or story title in the UI language, "Stage n" or the set's name; open, it shows those cards as silhouettes.
   - **No count** of what is left, and no hint repeated on every tile: each locked tile keeps its earn hint in its accessible name (`a11y.lockedCardHint`) and on its card page (F-STORY-006 section 3.7, pointer line).
3. The theme chips filter both shelves. Every row and tile is at least `touchTarget.min`; tokens only (`surface.sunken`, `border.shape` dashed silhouettes, `brand.secondaryLight` Next card row).
