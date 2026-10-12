/**
 * Retired promises about where learning data lives: the one list the data-statement guards read
 * (packages/i18n privacy-statements.test.ts over every English message, apps/web
 * privacy-statements.test.tsx over the rendered site pages, the `/parent` demo and the paste-ready
 * launch text, apps/mobile create-profile-copy.test.ts over the create-profile form).
 *
 * What the app does (checked against the code), on a build with cloud saving on: with no sign-in, the
 * learner app sends each learner's nickname, level and avatar to our servers the first time it saves
 * them (`ensureRegistered`; a later edit is not sent, F-LEARN-001 §3.11) and backs up their progress
 * when it starts and after each change (F-SYNC-002, `flags.syncEnabled` on); it issues a Rescue Code
 * after the first cloud save (F-RESTORE-001); usage events such as `quest.complete` can carry the
 * learner's id; a class or family a learner joins sees the name they join with and their progress; and
 * a family's caregivers can recover the full saved progress. So no surface may say that learning data
 * stays on the device until (or unless) someone signs in, that sync is opt-in or optional, that usage
 * data is anonymous, or that a parent email is the only personal data we hold. The true sentence is
 * `landing.persona.parents.safe.bullets.backup` (F-SITE-002 §3.5).
 *
 * `retiredDataPromises` checks each sentence (and each line) on its own, so a page that says "backed up"
 * once cannot hide a device-only promise elsewhere.
 *
 * Plain character classes and look-ahead only (no look-behind, no Unicode property escapes), like
 * banned.ts and audience.ts.
 */
export interface DataPromisePattern {
  name: string;
  re: RegExp;
}

/** "sign in", "signs in", "signed in", "sign-in", "log in", "logged in". */
const SIGN_IN = String.raw`(sign|log)(s|ed|ged)?[\s-]?in\b`;
/** "if you", "when a parent", "once the account holder", "after your grown-up". */
const ON_SIGN_IN = String.raw`\b(if|once|when|after)\s+(you|a|the|your)\s+(\w+\s+)?${SIGN_IN}`;
const SYNC_WORD = String.raw`\b(sync\w*|backs?\s+up|backed\s+up|saved|cloud)\b`;

export const RETIRED_DATA_PROMISES: readonly DataPromisePattern[] = [
  { name: '"local-first"', re: /\blocal[\s-]first\b/i },
  { name: 'data "stays on the device"', re: /\bstays?\s+(only\s+)?on\s+(the|this|your)\s+device\b/i },
  { name: 'data "never leaves / remains on / lives on" the device', re: /\b(never\s+leaves?|remains?\s+(only\s+)?on|lives?\s+(only\s+)?on)\s+(the|this|your)\s+device\b/i },
  { name: '"until … sign in"', re: /\buntil\b[^.]*\bsign(s|ed)?[\s-]?in\b/i },
  { name: '"unless … sign in"', re: /\bunless\b[^.]*\bsign(s|ed)?[\s-]?in\b/i },
  { name: '"if a parent signs in, progress syncs"', re: /\b(if|once)\s+(a|the)\s+(parent|grown-up|caregiver|account holder)\s+signs?\s+in\b/i },
  { name: 'backup or sync tied to signing in', re: new RegExp(`${ON_SIGN_IN}[^.]*${SYNC_WORD}|${SYNC_WORD}[^.]*${ON_SIGN_IN}`, 'i') },
  {
    name: 'sync called opt-in or optional',
    re: /\bopt(s|ed)?[\s-]in\s+to\s+(cloud\s+)?(sync|saving|backup)\b|\b(sync|syncing|backup)\s+(is|are)\s+optional\b|\band\s+sync\s+are\s+optional\b/i,
  },
  { name: '"all / most learning data"', re: /\b(all|most)\s+(of\s+the\s+)?learning\s+data\b/i },
  { name: '"anonymous"', re: /\banonymous(ly)?\b/i },
  { name: '"on this device only"', re: /\bon\s+(the|this|your)\s+device\s+only\b|\bonly\s+on\s+(the|this|your)\s+device\b/i },
  { name: '"the only PII" / "no PII"', re: /\b(only|no)\s+(PII|personal\s+(data|information))\b/i },
  {
    name: 'progress "saved on the device" with no word of the backup',
    re: /^(?![\s\S]*\b(backed|backs)\s+up\b)[\s\S]*(\b(progress|learning data|data|choices)\b[^.]*\b(saved|kept|stored)\b|\b(keeps?|saves?|stores?)\s+(\w+\s+)?(progress|learning data|data|choices)\b)[^.]*(\bon\s+(the|this|your)\s+device\b|\bon-device\b|\blocally\b)/i,
  },
];

/** One piece of copy split into sentences and lines; the terminal mark is dropped. */
function sentences(text: string): string[] {
  return text
    .split(/[.!?]+(?:\s+|$)|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** The retired promises a piece of copy still makes (none for true copy), each named once. */
export function retiredDataPromises(text: string): string[] {
  const parts = sentences(text);
  return RETIRED_DATA_PROMISES.filter(({ re }) => parts.some((part) => re.test(part))).map(({ name }) => name);
}
