/**
 * Retired promises about where learning data lives: the one list the data-statement guards read
 * (packages/i18n privacy-statements.test.ts over every English message, apps/web
 * privacy-statements.test.tsx over the rendered site pages and the `/parent` demo, apps/mobile
 * create-profile-copy.test.ts over the create-profile form).
 *
 * What the app does (checked against the code): the learner app backs up every learner's nickname,
 * level, avatar and progress to our servers when it starts and after each change, with no sign-in
 * (F-SYNC-002, `flags.syncEnabled` on); it issues a Rescue Code after the first cloud save
 * (F-RESTORE-001); usage events such as `quest.complete` can carry the learner's id; a class or family
 * a learner joins sees the name they join with and their progress; and a family's caregivers can
 * recover the full saved progress. So no surface may say that learning data stays on the device until
 * (or unless) someone signs in, that sync is opt-in or optional, or that usage data is anonymous. The
 * true sentence is `landing.persona.parents.safe.bullets.backup` (F-SITE-002 §3.5).
 *
 * Plain character classes and look-ahead only (no look-behind, no Unicode property escapes), like
 * banned.ts and audience.ts.
 */
export interface DataPromisePattern {
  name: string;
  re: RegExp;
}

export const RETIRED_DATA_PROMISES: readonly DataPromisePattern[] = [
  { name: '"local-first"', re: /\blocal[\s-]first\b/i },
  { name: 'data "stays on the device"', re: /\bstays?\s+(only\s+)?on\s+(the|this|your)\s+device\b/i },
  { name: '"until … sign in"', re: /\buntil\b[^.]*\bsign(s|ed)?[\s-]?in\b/i },
  { name: '"unless … sign in"', re: /\bunless\b[^.]*\bsign(s|ed)?[\s-]?in\b/i },
  { name: '"if a parent signs in, progress syncs"', re: /\b(if|once)\s+(a|the)\s+(parent|grown-up|caregiver|account holder)\s+signs?\s+in\b/i },
  {
    name: 'sync called opt-in or optional',
    re: /\bopt(s|ed)?[\s-]in\s+to\s+(cloud\s+)?(sync|saving|backup)\b|\b(sync|syncing|backup)\s+(is|are)\s+optional\b|\band\s+sync\s+are\s+optional\b/i,
  },
  { name: '"all / most learning data"', re: /\b(all|most)\s+(of\s+the\s+)?learning\s+data\b/i },
  { name: '"anonymous"', re: /\banonymous(ly)?\b/i },
  { name: '"on this device only"', re: /\bon\s+(the|this|your)\s+device\s+only\b|\bonly\s+on\s+(the|this|your)\s+device\b/i },
  {
    name: 'progress "saved on the device" with no word of the backup',
    re: /^(?![\s\S]*\bbacked up\b)[\s\S]*\b(progress|learning data|data|choices)\b[^.]*\b(saved|kept|stored)\b[^.]*\b(on\s+(the|this|your)\s+device|locally)\b/i,
  },
];

/** The retired promises a piece of copy still makes (none for true copy). */
export function retiredDataPromises(text: string): string[] {
  return RETIRED_DATA_PROMISES.filter(({ re }) => re.test(text)).map(({ name }) => name);
}
