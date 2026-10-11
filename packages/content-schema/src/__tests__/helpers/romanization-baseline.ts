/**
 * Known findings in content that landed after F-CNT-002 PR 2b and before the suites
 * turned on (F-STORY-001 PR 1.7 story drafts). Each entry is one Korean string in one
 * file, still reported by the scanner under `known` and dropped from the failures, so
 * `main` stays green while a content pass fixes the spelling. An entry that no longer
 * matches a finding fails the suite (the list empties itself); a NEW finding is never
 * covered by it. Fixing an entry means removing it here in the same PR.
 */
import type { RomanizationRule } from '../../index';

export interface KnownFinding {
  file: string;
  rule: RomanizationRule;
  ko: string;
  reason: string;
}

const SPACING =
  'draft story (not bundled): proper noun or compound romanized word by word; C4 wants one romanized word per Korean word. The research drafts carry the same spelling, so fix it in the importer or the draft, then drop this entry';

const spacing = (file: string, ko: string): KnownFinding => ({
  file: `content/stories/${file}.json`,
  rule: 'romanization-spacing',
  ko,
  reason: SPACING,
});

export const KNOWN_STORY_FINDINGS: readonly KnownFinding[] = [
];
