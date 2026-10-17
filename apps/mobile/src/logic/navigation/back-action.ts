/**
 * Whether a navigator action is a back (the visible Back, the browser or phone back through the
 * history bridge, a swipe): `GO_BACK`, `POP`, `POP_TO_TOP`. Every other action that removes a screen
 * (a `REPLACE` after a submit, a `RESET` to Results, a `NAVIGATE` to a screen under it) is the
 * screen's own way on and passes a back guard untouched (AMENDMENTS-DISPLAY-NAV section 7.1).
 */
const BACK_ACTIONS: ReadonlySet<string> = new Set(['GO_BACK', 'POP', 'POP_TO_TOP']);

export function isBackAction(type: string): boolean {
  return BACK_ACTIONS.has(type);
}
