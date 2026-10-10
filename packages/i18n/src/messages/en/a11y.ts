/**
 * Accessibility labels (F-I18N-001 §3.4). The design system takes these as props
 * with its own English default, so it needs no i18n dependency.
 */
export const a11y = {
  tile: (label: string) => `Korean letter ${label}, tap to select`,
  stars: (earned: number) => `${earned} of 3 stars earned`,
  hoya: (pose: string) => `Hoya the tiger, ${pose}`,
  dismissHoya: 'Close Hoya message',
  cardArt: (title: string) => `Card art for ${title}`,
  /** A taught Korean item: Korean text, its romanization and (optionally) a gloss in the UI language. */
  koreanItem: (item: { ko: string; romanization: string; gloss?: string }) =>
    item.gloss === undefined
      ? `Korean: ${item.ko}, ${item.romanization}`
      : `Korean: ${item.ko}, ${item.romanization}, ${item.gloss}`,
} as const;
