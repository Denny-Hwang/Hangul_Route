# Did you know? tip (F-CURR-002 §5.7, row CM-3C)

One sourced note of the lesson cell, at a quest's reward step and on the back of the cell's card, behind `upperCards`
(built-in pct 0). Built shots from the release bundle (`culture-tip.spec.ts`, `HR_SHOTS=1`, the switch turned on
through the stored remote copy): quest 1 of Outdoor Words (Stage 2 Nature & Animals), one of the four cells that had no
note, and its card `card:byeol`.

| Shot | What it shows |
|---|---|
| `shots/culture-tip-reward-320.png` | The reward step at 320 px: Hoya's card as before, then the tip (a paper box, `radii.md`), then See results. |
| `shots/culture-tip-reward-wide.png` | The same step on a wide window. |
| `shots/culture-tip-card-front-320.png` | The card page at 320 px: the tip closes the fact card under the card, where a screen reader reads it. |
| `shots/culture-tip-card-front-wide.png` | The card page on a wide window. |
| `shots/culture-tip-card-back-320.png` | The card's back at 320 px: the tip under the fact, centred like the back face. |
| `shots/culture-tip-card-back-wide.png` | The back on a wide window. |

## Anatomy

- A sparkle (`brand.primary`, 16 dp) and **Did you know?** (`Heading` caption, a heading for screen readers).
- The note in the UI language (body small, `text.secondary`, relaxed leading). Each `{ko:}` token is taught Korean on a
  chip (`surface.sunken` on the paper box, `surface.paper` on the sunken card boxes), marked `lang="ko"`, then its
  romanization, so the line wraps like a sentence (the Sentence Builder note pattern).
- The source line, the card back's citation format (`cardDetail.citation`): "Source: <publisher>, <title>" and "and N
  more sources", the Korean runs marked `lang="ko"`. Never a URL, a link or a quote.
- At the reward step and in the fact card the tip is a region named **Lesson note**; on the back it sits inside the flip
  button, which a screen reader reads as one control, so it is drawn only there.

## Rules

- Tokens only; no red, no percentage, no timer, no emoji, no speaking UI, no age wording (§7.7).
- The tip never moves a button: See results stays the step's own button under it, 48 dp or more at 320 px.
- Off, nothing is drawn and the chunk (`screen-chunk:culture-tip`) never loads.
