import type { TextProps } from 'react-native';

/**
 * Native Korean line breaking (F-I18N-001 §10 reason (5), row 16b). The web wraps `:lang(ko)` text at spaces in
 * CSS (`word-break: keep-all`, `apps/web/src/app/globals.css`, `apps/mobile/scripts/pwa-postbuild.mjs`); on iOS the
 * same comes from `lineBreakStrategyIOS: 'hangul-word'` (iOS 14+, NSLineBreakStrategyHangulWordPriority), which
 * moves a whole Korean word to the next line instead of breaking it between two syllables of one word. It changes
 * nothing for English or Spanish text, so every design-system `Text` spreads it, whatever the UI locale.
 *
 * Android: the platform's phrase-based breaking (`LineBreakConfig` word style `phrase`, API 33+) has no React
 * Native 0.76 `Text` prop, so Android keeps per-syllable breaks, the fallback §10 (5) accepts (no word overflows).
 * Add `lineBreakWordStyle: 'phrase'` here once React Native exposes it.
 *
 * Type-only import of `react-native`, so this module stays pure (it is erased at build time).
 */
export const KOREAN_LINE_BREAK: Readonly<Pick<TextProps, 'lineBreakStrategyIOS'>> = Object.freeze({
  lineBreakStrategyIOS: 'hangul-word',
});

/**
 * The `<Text ...>` opening tags in `source` that do not spread `KOREAN_LINE_BREAK` (the guard
 * `__tests__/line-break.test.ts` runs over every design-system component). A tag ends at the first `>` outside
 * braces, so `style={{ a: b > c }}` stays inside it.
 */
export function textTagsWithoutLineBreak(source: string): string[] {
  const missing: string[] = [];
  const opener = /<Text(?=[\s>/])/g;
  for (let match = opener.exec(source); match; match = opener.exec(source)) {
    let depth = 0;
    let end = match.index + match[0].length;
    for (; end < source.length; end += 1) {
      const ch = source[end];
      if (ch === '{') depth += 1;
      else if (ch === '}') depth -= 1;
      else if (ch === '>' && depth === 0) break;
    }
    const tag = source.slice(match.index, end + 1);
    if (!tag.includes('{...KOREAN_LINE_BREAK}')) missing.push(tag);
  }
  return missing;
}
