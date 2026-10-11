/**
 * The 30 Stage 1 card ids HeritageCardArt draws (its dispatcher has one case
 * per id). Pure, with no React or react-native-svg import, so node tests and
 * the pure WordArt entry can ask "is this card drawn?" (F-VOC-002 §3.9).
 * `HeritageCardArt.tsx` re-exports it, so every consumer is unchanged.
 */
export const supportedCardIds: readonly string[] = [
  // Letters & Books
  'card:book',
  'card:hanji',
  'card:brush',
  'card:ink',
  'card:origami',
  'card:hangul-day',
  // Food & Daily Life
  'card:kimchi',
  'card:rice',
  'card:chopsticks',
  'card:hanbok',
  'card:kimbap',
  'card:family-table',
  // Holidays & Traditions
  'card:seollal',
  'card:chuseok',
  'card:tteokguk',
  'card:songpyeon',
  'card:sebae',
  'card:lantern',
  // Nature & Animals
  'card:tiger',
  'card:magpie',
  'card:mugunghwa',
  'card:mountain',
  'card:sea',
  'card:moon',
  // Play & Crafts
  'card:yutnori',
  'card:jegi',
  'card:kite',
  'card:top',
  'card:pottery',
  'card:gayageum',
];
