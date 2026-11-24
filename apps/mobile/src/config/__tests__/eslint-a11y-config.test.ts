/**
 * AMENDMENTS-A11Y-CI AC-3 (section 6, item 1): the accessibility lint gate of apps/mobile.
 *
 * The tests load `eslint.config.mjs` through ESLint's Node API, as `pnpm lint` does (`--no-inline-config`), and lint
 * snippets in memory. So CI proves the gate on every run, with no probe pull request.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const APP_ROOT = join(__dirname, '../../..');
const PROBE = join(APP_ROOT, 'src/components/Probe.tsx');

/** Every rule the config turns on: the plugin's rules minus has-accessibility-hint (off), plus the local rule. */
const ENABLED_RULES = [
  'react-native-a11y/has-accessibility-props',
  'react-native-a11y/has-valid-accessibility-actions',
  'react-native-a11y/has-valid-accessibility-component-type',
  'react-native-a11y/has-valid-accessibility-descriptors',
  'react-native-a11y/has-valid-accessibility-ignores-invert-colors',
  'react-native-a11y/has-valid-accessibility-live-region',
  'react-native-a11y/has-valid-accessibility-role',
  'react-native-a11y/has-valid-accessibility-state',
  'react-native-a11y/has-valid-accessibility-states',
  'react-native-a11y/has-valid-accessibility-traits',
  'react-native-a11y/has-valid-accessibility-value',
  'react-native-a11y/has-valid-important-for-accessibility',
  'react-native-a11y/no-nested-touchables',
  'hangul-route/touchable-has-name',
] as const;

/** One invalid snippet per enabled rule, each reporting exactly that rule. */
const INVALID: Record<(typeof ENABLED_RULES)[number], string> = {
  'react-native-a11y/has-accessibility-props':
    '<Pressable accessibilityRole="button" accessibilityLabel="Go" accessibilityTraits="button" onPress={f} />',
  'react-native-a11y/has-valid-accessibility-actions': '<View accessibilityActions={[]} onAccessibilityAction={f} />',
  'react-native-a11y/has-valid-accessibility-component-type': '<View accessibilityComponentType="nope" />',
  // The section 3.7 probe has no label: it also reports touchable-has-name. This snippet has text, so only the plugin rule fires.
  'react-native-a11y/has-valid-accessibility-descriptors': '<Pressable onPress={f}>Go</Pressable>',
  'react-native-a11y/has-valid-accessibility-ignores-invert-colors':
    "import { Image } from 'react-native';\nexport const A = () => <Image source={s} />;",
  'react-native-a11y/has-valid-accessibility-live-region': '<View accessibilityLiveRegion="loud" />',
  'react-native-a11y/has-valid-accessibility-role': '<View accessibilityRole="nope" />',
  'react-native-a11y/has-valid-accessibility-state': '<View accessibilityState="selected" />',
  'react-native-a11y/has-valid-accessibility-states': '<View accessibilityStates="nope" />',
  'react-native-a11y/has-valid-accessibility-traits': '<View accessibilityTraits="nope" />',
  'react-native-a11y/has-valid-accessibility-value': '<View accessibilityValue="half" />',
  'react-native-a11y/has-valid-important-for-accessibility': '<View importantForAccessibility="maybe" />',
  'react-native-a11y/no-nested-touchables':
    '<View accessible><Pressable accessibilityRole="button" accessibilityLabel="Go" onPress={f} /></View>',
  'hangul-route/touchable-has-name': '<Pressable accessibilityRole="button" onPress={f}><Icon name="speaker" /></Pressable>',
};

/** The suppressions as merged at AC-3 (method B): file -> rule -> count. Raising a number or adding a key is a test change review must justify. */
const CEILING: Record<string, Record<string, number>> = {
  'src/screens/account/AccountCover.tsx': { 'react-native-a11y/has-valid-accessibility-ignores-invert-colors': 1 },
  'src/screens/minigames/role-play/RolePlayGame.tsx': { 'react-native-a11y/no-nested-touchables': 1 },
  'src/screens/parent/BiometricShortcutCard.tsx': { 'react-native-a11y/has-valid-accessibility-descriptors': 1 },
  'src/screens/reviews/StageReviewScreen.tsx': { 'react-native-a11y/has-valid-accessibility-descriptors': 1 },
};

let eslint: ESLint;

beforeAll(() => {
  // The same switches as the lint script: the config file of this app, and no inline config.
  eslint = new ESLint({ cwd: APP_ROOT, overrideConfigFile: join(APP_ROOT, 'eslint.config.mjs'), allowInlineConfig: false });
});

async function ruleIds(code: string, filePath = PROBE): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => (m.fatal ? `FATAL ${m.message}` : (m.ruleId ?? 'no-rule')));
}

describe('apps/mobile accessibility lint config', () => {
  it.each(ENABLED_RULES)('%s reports its invalid snippet, and only that rule', async (rule) => {
    expect(await ruleIds(INVALID[rule])).toEqual([rule]);
  });

  it('accepts a touchable with a role, a label and a name', async () => {
    expect(await ruleIds('<Pressable accessibilityRole="button" accessibilityLabel="Go" onPress={f} />')).toEqual([]);
  });

  it('the section 3.7 probe (a bare Pressable) fails with has-valid-accessibility-descriptors', async () => {
    const ids = await ruleIds("import { Pressable } from 'react-native';\nexport function A11yLintProbe({ onPress }: { onPress: () => void }) {\n  return <Pressable onPress={onPress} />;\n}\n");
    expect(ids).toContain('react-native-a11y/has-valid-accessibility-descriptors');
  });

  it('the role-only probe fails with hangul-route/touchable-has-name', async () => {
    expect(await ruleIds('<Pressable accessibilityRole="button" onPress={onPress} />')).toEqual(['hangul-route/touchable-has-name']);
  });

  it('a Pressable hidden from assistive tech needs no name (touchable-has-name option ignoreHidden)', async () => {
    expect(await ruleIds('<Pressable onPress={f} accessible={false} />')).toEqual([]);
    expect(await ruleIds('<Pressable onPress={f} aria-hidden />')).toEqual(['react-native-a11y/has-valid-accessibility-descriptors']);
  });

  it('aria-label is not accepted by has-valid-accessibility-descriptors (a documented limit of the plugin)', async () => {
    expect(await ruleIds('<Pressable aria-label="x" onPress={f} />')).toEqual(['react-native-a11y/has-valid-accessibility-descriptors']);
  });

  it('has-accessibility-hint is off (about 515 hits, hints are optional)', async () => {
    expect(await ruleIds('<Pressable accessibilityRole="button" accessibilityLabel="Go" onPress={f} />')).toEqual([]);
    const config = (await eslint.calculateConfigForFile(PROBE)) as { rules: Record<string, unknown> };
    const hint = config.rules['react-native-a11y/has-accessibility-hint'];
    expect([0, 'off']).toContain(Array.isArray(hint) ? hint[0] : hint);
  });

  it('inline config is off: a disable comment for a rule the repository never installed reports nothing', async () => {
    const code = '// eslint-disable-next-line react-hooks/exhaustive-deps\nconst a = 1;\nexport const B = () => <View />;';
    expect(await ruleIds(code)).toEqual([]);
  });

  it('a disable comment naming an enabled accessibility rule does not silence it', async () => {
    const code = '// eslint-disable-next-line react-native-a11y/has-valid-accessibility-descriptors\nexport const A = () => <Pressable onPress={f}>Go</Pressable>;';
    expect(await ruleIds(code)).toEqual(['react-native-a11y/has-valid-accessibility-descriptors']);
    const block = '/* eslint-disable */\nexport const A = () => <Pressable onPress={f}>Go</Pressable>;';
    expect(await ruleIds(block)).toEqual(['react-native-a11y/has-valid-accessibility-descriptors']);
  });

  it('turns on only react-native-a11y/* and hangul-route/* rules, exactly the enabled list, with no file-scoped off', async () => {
    const config = (await eslint.calculateConfigForFile(PROBE)) as { rules: Record<string, unknown> };
    const on = Object.entries(config.rules)
      .filter(([, setting]) => {
        const level = Array.isArray(setting) ? setting[0] : setting;
        return level !== 'off' && level !== 0;
      })
      .map(([id]) => id)
      .sort();
    expect(on).toEqual([...ENABLED_RULES].sort());
    for (const id of Object.keys(config.rules)) expect(id).toMatch(/^(react-native-a11y|hangul-route)\//);
    // no file-scoped `off` (section 3.3): the same rules are on for a file in each corner of the tree
    for (const file of ['App.tsx', 'BrowseApp.tsx', 'PresenterApp.tsx', 'src/screens/parent/BiometricShortcutCard.tsx']) {
      const forFile = (await eslint.calculateConfigForFile(join(APP_ROOT, file))) as { rules: Record<string, unknown> };
      expect(forFile.rules).toEqual(config.rules);
    }
  });

  it('keeps the local rule on with the one option the false-positive path uses', async () => {
    const config = (await eslint.calculateConfigForFile(PROBE)) as { rules: Record<string, unknown> };
    expect(config.rules['hangul-route/touchable-has-name']).toEqual([2, { ignoreHidden: true }]);
  });

  it('ignores tests and generated files, and lints the three entry roots', async () => {
    expect(await eslint.isPathIgnored(join(APP_ROOT, 'src/screens/__tests__/X.test.tsx'))).toBe(true);
    expect(await eslint.isPathIgnored(join(APP_ROOT, 'src/screens/X.test.tsx'))).toBe(true);
    expect(await eslint.isPathIgnored(join(APP_ROOT, 'src/content/__generated__/x.tsx'))).toBe(true);
    for (const root of ['App.tsx', 'BrowseApp.tsx', 'PresenterApp.tsx', 'src/screens/Home.tsx']) {
      expect(await eslint.isPathIgnored(join(APP_ROOT, root))).toBe(false);
    }
  });
});

describe('apps/mobile eslint-suppressions.json (method B, OD-AC5)', () => {
  const suppressions = JSON.parse(readFileSync(join(APP_ROOT, 'eslint-suppressions.json'), 'utf8')) as Record<
    string,
    Record<string, { count: number }>
  >;

  it('never gains a file or a rule the ceiling map lacks, and never a higher count', () => {
    for (const [file, rules] of Object.entries(suppressions)) {
      const ceiling = CEILING[file];
      expect(ceiling, `${file} is not in the ceiling map`).toBeDefined();
      for (const [rule, { count }] of Object.entries(rules)) {
        const max = ceiling?.[rule];
        expect(max, `${file}: ${rule} is not in the ceiling map`).toBeDefined();
        expect(count, `${file}: ${rule}`).toBeLessThanOrEqual(max ?? 0);
      }
    }
  });

  it('only names rules the config turns on', () => {
    for (const rules of Object.values(suppressions)) {
      for (const rule of Object.keys(rules)) expect(ENABLED_RULES as readonly string[]).toContain(rule);
    }
  });

  it('holds the 4 hits measured at AC-3 until AC-3b fixes them', () => {
    const total = Object.values(suppressions).reduce((sum, rules) => sum + Object.values(rules).reduce((s, r) => s + r.count, 0), 0);
    expect(total).toBeLessThanOrEqual(4);
  });
});
