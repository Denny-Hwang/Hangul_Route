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

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The JSX tag names under which `source` draws React Native's `Text`: `Text` and any alias
 * (`import { Text as Label } from 'react-native'`), plus `<Animated>.Text` when `Animated` comes from
 * `react-native` (named or aliased). A `Text` from another module (`react-native-svg`) is not native text.
 */
export function nativeTextTagNames(source: string): string[] {
  const names = new Set<string>();
  // A type-only import (`import type { Text }`) or specifier (`type Text`) draws nothing, so it is skipped.
  const imports = /import\s+(?:\w+\s*,\s*)?\{([^}]*)\}\s*from\s*['"]react-native['"]/g;
  for (let m = imports.exec(source); m; m = imports.exec(source)) {
    for (const raw of (m[1] ?? '').split(',')) {
      const spec = /^\s*(\w+)(?:\s+as\s+(\w+))?\s*$/.exec(raw);
      const imported = spec?.[1];
      if (spec === null || imported === undefined) continue;
      const local = spec[2] ?? imported;
      if (imported === 'Text') names.add(local);
      if (imported === 'Animated') names.add(`${local}.Text`);
    }
  }
  return [...names].sort();
}

/**
 * The opening tags of `tagNames` (default `Text`) in `source` that do not spread `KOREAN_LINE_BREAK` (the guards
 * `__tests__/line-break.test.ts` and the learner app's `native-text-line-break.test.ts` run it). A tag ends at the
 * first `>` outside braces, so `style={{ a: b > c }}` stays inside it; a type argument (`useRef<Text>`) is not a tag.
 */
export function textTagsWithoutLineBreak(source: string, tagNames: readonly string[] = ['Text']): string[] {
  const missing: string[] = [];
  if (tagNames.length === 0) return missing;
  const opener = new RegExp(`<(?:${tagNames.map(escapeRegExp).join('|')})(?=[\\s>/])`, 'g');
  for (let match = opener.exec(source); match; match = opener.exec(source)) {
    // A type argument (`useRef<Text>(null)`) follows a name; a JSX tag never does.
    if (match.index > 0 && /[\w$.]/.test(source[match.index - 1] ?? '')) continue;
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
