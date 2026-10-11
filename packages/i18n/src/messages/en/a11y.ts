/**
 * Accessibility labels (F-I18N-001 §3.4). The design system takes these as props
 * with its own English default, so it needs no i18n dependency.
 */
export const a11y = {
  tile: (label: string) => `Korean letter ${label}, tap to select`,
  stars: (earned: number) => `${earned} of 3 stars earned`,
  hoya: (pose: string) => `Hoya the tiger, ${pose}`,
  dismissHoya: 'Close Hoya message',
  goBack: 'Go back',
  /** Bottom tab labels. */
  tabs: { home: 'Today', journey: 'Journey', library: 'Library' },
  cardArt: (title: string) => `Card art for ${title}`,
  /** The cub button on Home: the only way to profiles, backup, classes and the grown-up zone. */
  profileEntry: 'Profile and settings',
  openHomework: 'Open homework',
  /** One of Today's mission cards; a collected card keeps its slot and says so. */
  missionCard: (title: string, subtitle: string, collected: boolean) =>
    `${title}. ${subtitle}.${collected ? ' Collected.' : ''}`,
  /** A Journey grid cell: the theme's episode for a stage; a preview cell is not open yet. */
  gridCell: (themeTitle: string, stage: string, comingSoon: boolean) =>
    `${themeTitle} episode for ${stage}${comingSoon ? ', coming soon' : ''}`,
  lockedCard: 'Locked card',
  flipToBack: 'Tap to flip card to back',
  flipToFront: 'Tap to flip card to front',
  shareCard: 'Share this card',
  /** A taught Korean item: Korean text, its romanization and (optionally) a gloss in the UI language. */
  koreanItem: (item: { ko: string; romanization: string; gloss?: string }) =>
    item.gloss === undefined
      ? `Korean: ${item.ko}, ${item.romanization}`
      : `Korean: ${item.ko}, ${item.romanization}, ${item.gloss}`,
} as const;
