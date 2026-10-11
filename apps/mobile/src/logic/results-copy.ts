import type { Messages } from '@hangul-route/i18n';

/**
 * Results screen copy by star tier (wireframe results/celebrate): one word
 * of headline, one line from Hoya. The words live in the dictionary
 * (`learner.results.headline` / `.cheer`); these functions only choose the tier
 * and take the message subtree as a parameter, so they stay pure and testable
 * per locale (F-I18N-001 §3.4 rule 3). Plain strings — these are rendered as
 * text, so HTML entities would show up literally — and never a number,
 * ratio or percent (F-RVW-001 §3.1).
 */
type Stars = 0 | 1 | 2 | 3;
type Results = Messages['learner']['results'];

export function resultsHeadline(stars: Stars, played: boolean, m: Results['headline']): string {
  if (!played) return m.allDone;
  if (stars === 3) return m.wonderful;
  if (stars === 2) return m.great;
  return m.tried;
}

export function resultsCheerMessage(stars: Stars, played: boolean, m: Results['cheer']): string {
  if (!played) return m.noGames;
  if (stars === 3) return m.perfect;
  if (stars === 2) return m.nice;
  if (stars === 1) return m.goodStart;
  return m.brave;
}
