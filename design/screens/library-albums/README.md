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
