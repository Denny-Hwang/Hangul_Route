/**
 * Caregiver-facing copy (F-I18N-001 §3.4 rule 2). PR 7a seeds it with the Quest-assignment
 * gating reasons: `canAssignQuest` returns a code and the learner's name, and the
 * screen renders `m.caregiver.gating[reason](name)`. Every reason takes the name so the
 * call is uniform; a locale may use it or not.
 */
export const caregiver = {
  gating: {
    'unknown-quest': (_learnerName: string) => 'That quest is not available yet.',
    'episode-not-shipped': (_learnerName: string) => 'That episode is still being built.',
    'stage-locked': (learnerName: string) => `${learnerName} hasn't reached this quest yet.`,
  },
} as const;
