/**
 * Kids-only framing and age ranges, per locale: the one list both audience guards read
 * (packages/i18n landing-messages.test.ts over the dictionary, apps/web audience-copy.test.ts over
 * the site sources, the PWA manifest and the store listing). Owner decision 2026-10-09 (CLAUDE.md
 * §1): public surfaces speak to anyone learning Hangul, at any age; they never frame the product as
 * kids-only and never name an age range. Per-locale equivalents: F-I18N-001 §3.8.
 *
 * Plain character classes only (no look-behind, no Unicode property escapes), like banned.ts.
 */
export interface AudiencePattern {
  name: string;
  re: RegExp;
}

export const KIDS_ONLY_FRAMING: readonly AudiencePattern[] = [
  { name: 'age range 5–11', re: /\b5\s*[–-]\s*11\b/ },
  { name: '"for kids"', re: /\bfor kids\b/i },
  { name: '"kids who …"', re: /\bkids who\b/i },
  { name: '"Korean for kids"', re: /\bKorean for kids\b/i },
  { name: '5–7 year-old reading level', re: /\b5\s*[–-]\s*7\s*(year[\s-]*old|yo)\b/i },
  { name: '"your kid"', re: /\byour kid\b/i },
  { name: 'es "para niños"', re: /\bpara niños\b/i },
  { name: 'es age range "de 5 a 11 años"', re: /\bde\s*5\s*a\s*11\s*años\b/i },
  { name: 'ko "어린이용"', re: /어린이용/ },
  { name: 'ko age range "5~11세"', re: /5\s*[~～–-]\s*11\s*세/ },
];
