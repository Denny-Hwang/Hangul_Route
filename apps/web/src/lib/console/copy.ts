/** Console strings that carry tone — F-CONSOLE-001. Tested against the caregiver ban list. */
export const COPY = {
  whySignIn: ['Keep progress safe across devices', 'Bring cards back after a reinstall', 'Manage plans and billing'],
  kidsNoAccount: "Kids don't need an account — they join with a code.",
  devSignInHint: 'Development sign-in: the account id stands in for a verified session until the Clerk connection lands.',
  clerkPending: 'Sign-in opens with the account connection (coming soon). Until then, the learner app works without an account.',
  cantReach: "Can't reach the console right now.",
  tryAgain: 'Try again',
  noSpaces: "You're not in any space yet.",
  createSpace: 'Create a space',
  writeOnBoard: 'Write it on the board. Students join from Settings → Classes & family → Join a class.',
  oldCodeStops: 'The old code stops working the moment a new one is made.',
  notSyncedYet: 'not synced yet',
  notSyncedWeek: "haven't synced in a week",
  revisitTogether: 'Jamo to revisit together',
  practicedThisWeek: 'practiced this week',
  anchor: 'Stage 1 anchor',
  comingWithPlans: 'Coming with plans',
  capWarning: (used: number, total: number) => `Free plan: ${used} / ${total} students`,
  capReached: 'This class is at the free limit — new students will be asked to check with you.',
} as const;

export function allCopyStrings(): string[] {
  return Object.values(COPY).flatMap((v) => (typeof v === 'function' ? [v(16, 20)] : Array.isArray(v) ? [...v] : [v]));
}
