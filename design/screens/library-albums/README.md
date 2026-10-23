# Library albums and the upper-cell cards (F-CURR-002 §7.2, row CM-23)

Built shots from the release bundle (`card-awards.spec.ts`, `HR_SHOTS=1`, `upperCards` turned on through the stored
remote copy): a learner who finished Stages 2 and 3 before the row shipped.

| Shot | What it shows |
|---|---|
| `shots/upper-cards-albums-320.png` | The five albums at 320 px: each row with its cards held and "2 cards"; an album with none says "New". No empty slot, no count of what is left (D3, §7.7). |
| `shots/upper-cards-card-320.png` | An album card's page at 320 px: the drawing, the Korean word with its romanization, the blurb, the fact and its source line. |
| `shots/upper-cards-albums-wide.png` | The albums in the master pane beside the card pane on a wide window. |

The rows reuse the Library's card faces (`CardArt`) and tokens; the album row is a Library list row (paper surface,
subtle border, `radii.md`) with the theme name, a muted count line and the held cards as 56 px faces in their rarity
border. The drawings are `UpperCellCardArt` (packages/design-system, `HeritageCardArt/UpperCellArt.tsx`).

## Stage 4 (row CM-23 part 2)

The same spec on a learner who finished Stages 2-4 before the row shipped: every album holds three cards.

| Shot | What it shows |
|---|---|
| `shots/upper-cards-s4-albums-320.png` | The albums at 320 px with "3 cards" each; Stage 4's card is the third face. Holidays shows Greeting Dialogues' shipped `card:insa`. |
| `shots/upper-cards-s4-card-320.png` | `card:mwoyeyo` at 320 px: the Stage 4 drawing, 이게 뭐예요? with its romanization, the blurb, the fact and its source line. |
| `shots/upper-cards-s4-albums-wide.png` | The albums with Stage 4 on a wide window. |

The Stage 4 drawings follow F-CARD-S4-001 3.2 as amended: two round friends facing each other (Hoya's gold and a blue
friend), each with a speech bubble in the HoyaBubble language (`surface.canvas` fill, `brand.secondary` border, never
red), the bubble holding a drawn word: a question mark, an eraser, a heart, raindrops, a little house, a star. Theme
tint, at most five fill colours, tokens only.
