/**
 * The album card ids `UpperCellCardArt` draws (F-CURR-002 §7.2, row CM-23): the upper-cell cards of Stages 2 to 4,
 * Lunch Box Words', Outdoor Words' and Greeting Dialogues' album cards included. Pure, and a file of its own (row CM-23
 * part 2): only the drawings (`UpperCellArt.tsx`, in the app's upper-cards chunk) and the tests read it, so the start
 * bundle, which carries `card-ids.ts` for the Stage 1 drawings, carries this list only once, as the app's
 * `UPPER_CELL_CARDS` (apps/mobile/src/content/upper-cell-cards.ts; a test pins the two equal).
 */
export const upperCellCardArtIds: readonly string[] = [
  // Stage 2
  'card:norae',
  'card:dosirak',
  'card:bokjumeoni',
  'card:byeol',
  'card:swing',
  // Stage 3
  'card:hangeul',
  'card:tteok',
  'card:full-moon',
  'card:gom',
  'card:yut',
  // Stage 4 (row CM-23 part 2): the talks, Greeting Dialogues' album card included
  'card:mwoyeyo',
  'card:masisseoyo',
  'card:insa',
  'card:biga-wayo',
  'card:gachi',
];
