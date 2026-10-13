/**
 * The learner app's ways into All lessons behind the grown-up gate (F-BROWSE-001 section 4.3, BR-12a). Pure: the
 * screens read the gate (`gateOpensDirectlyNow`) and the hand-off's result and act on what these return.
 *
 * Not browse code: these run in the learner app, before `/browse` loads, and import nothing.
 */

/**
 * What a press on [ Open all lessons ] or [ Preview lessons ] does. The dashboard, the in-app report and the
 * read-only Learning Route page stay open after the 15-minute grown-up session ends, so every press asks the gate
 * again, like See report and the grown-up home do: `'open'` writes a gate pass and leaves (`openBrowseFromGate`);
 * `'pin'` opens the PIN screen for All lessons first (`PinEntry { next: 'BrowseLessons' }`) and writes nothing.
 */
export function gateLessonsStep(gateOpensDirectly: boolean): 'pin' | 'open' {
  return gateOpensDirectly ? 'open' : 'pin';
}

/**
 * Where the tab goes after the gate hand-off ran (the PIN screen's `BrowseLessons`, the `gate=browse` boot intent).
 * `'leave'`: the pass is written and the tab is on its way to `/browse`. `'dashboard'`: the browser refused this
 * tab's storage, so the parent dashboard opens with the storage line under [ Open all lessons ].
 */
export function afterGateHandoff(handoffOk: boolean): 'leave' | 'dashboard' {
  return handoffOk ? 'leave' : 'dashboard';
}
