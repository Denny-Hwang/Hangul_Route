/**
 * The two option cards of the `TapBoard` e2e screen's `cards` kind (docs/specs/AMENDMENTS-TOUCH.md row KT-2; fixture
 * builds only, never a learner): taught words, so the screen carries no UI copy. Their romanization is checked by
 * `__tests__/tap-board-e2e-cards.test.ts`.
 */
export const TAP_BOARD_E2E_CARDS = [
  { ko: '나무', romanization: 'namu' },
  { ko: '바다', romanization: 'bada' },
] as const;
