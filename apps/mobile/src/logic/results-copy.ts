/**
 * Results screen copy by star tier (wireframe results/celebrate): one word
 * of headline, one line from Hoya. Plain strings — these are rendered as
 * text, so HTML entities would show up literally — and never a number,
 * ratio or percent (F-RVW-001 §3.1).
 */
type Stars = 0 | 1 | 2 | 3;

export function resultsHeadline(stars: Stars, played: boolean): string {
  if (!played) return 'All done!';
  if (stars === 3) return 'Wonderful!';
  if (stars === 2) return 'Great!';
  return 'You tried!';
}

export function resultsCheerMessage(stars: Stars, played: boolean): string {
  if (!played) return 'Play the games next time to earn stars and a card!';
  if (stars === 3) return 'Perfect! You got every one!';
  if (stars === 2) return 'Nice work! Try one more for three stars.';
  if (stars === 1) return 'Good start. Want to play it again?';
  return "Brave try! Let's do it together.";
}
