# Library, Cards: collected first (screen spec, DN-9)

Spec: AMENDMENTS-DISPLAY-NAV section 9.3 · wireframe `design/wireframes/library/cards-collected-first.md` · mock `mock/library-cards.html`, `library-cards-open.html`, `library-cards-empty.html`

## Anatomy

1. Root header: "Heritage Library" and **Display (Aa)**; the count line (`learner.library.collected.line`, unchanged); the section tabs and the theme chips (unchanged; chips at least 64 x 64).
2. **Collected cards** first, most recently earned first (`cards[].unlockedAt`): the existing card tiles (face, Korean with romanization, title, the New pill), two across below 600 px, three from 600.
3. **Cards to earn** (`learner.library.cards.toEarn`): a disclosure button (`plus` / `dash`, `aria-expanded`), closed by default, **no count** (the Library shows the cards held, never a total: F-STORY-006 section 3.7, D3). Open, it shows the locked tiles with their earn hints, unchanged (`library-cards-open.html`).
4. The tab bar.

## States

Two collected (`library-cards.html`), the disclosure open (`library-cards-open.html`), nothing collected yet (`library-cards-empty.html`: the count line and the disclosure open by default). All collected: no disclosure. The theme chips filter both groups.
