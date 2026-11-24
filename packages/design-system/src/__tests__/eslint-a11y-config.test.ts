/**
 * AMENDMENTS-A11Y-CI AC-3 (section 6, item 2): the accessibility lint gate of packages/design-system.
 *
 * The tests load `eslint.config.mjs` through ESLint's Node API, as `pnpm lint` does (`--no-inline-config`), and lint
 * snippets in memory. The ceiling is empty: design-system has no hits, so it has no eslint-suppressions.json.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const PROBE = join(PACKAGE_ROOT, 'src/components/Probe.tsx');

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

let eslint: ESLint;

beforeAll(() => {
  // The same switches as the lint script: the config file of this package, and no inline config.
  eslint = new ESLint({ cwd: PACKAGE_ROOT, overrideConfigFile: join(PACKAGE_ROOT, 'eslint.config.mjs'), allowInlineConfig: false });
});

async function ruleIds(code: string, filePath = PROBE): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => (m.fatal ? `FATAL ${m.message}` : (m.ruleId ?? 'no-rule')));
}

describe('packages/design-system accessibility lint config', () => {
  it.each(ENABLED_RULES)('%s reports its invalid snippet, and only that rule', async (rule) => {
    expect(await ruleIds(INVALID[rule])).toEqual([rule]);
  });

  it('accepts a touchable with a role, a label and a name', async () => {
    expect(await ruleIds('<Pressable accessibilityRole="button" accessibilityLabel="Go" onPress={f} />')).toEqual([]);
  });

  it('a bare Pressable fails with has-valid-accessibility-descriptors', async () => {
    expect(await ruleIds('<Pressable onPress={f} />')).toContain('react-native-a11y/has-valid-accessibility-descriptors');
  });

  it('the role-only probe fails with hangul-route/touchable-has-name', async () => {
    expect(await ruleIds('<Pressable accessibilityRole="button" onPress={onPress} />')).toEqual(['hangul-route/touchable-has-name']);
  });

  it('a Pressable hidden from assistive tech needs no name (touchable-has-name option ignoreHidden)', async () => {
    expect(await ruleIds('<Pressable onPress={f} accessible={false} />')).toEqual([]);
  });

  it('aria-label is not accepted by has-valid-accessibility-descriptors (a documented limit of the plugin)', async () => {
    expect(await ruleIds('<Pressable aria-label="x" onPress={f} />')).toEqual(['react-native-a11y/has-valid-accessibility-descriptors']);
  });

  it('has-accessibility-hint is off (about 515 hits, hints are optional)', async () => {
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

  it('turns on only react-native-a11y/* and hangul-route/* rules, exactly the enabled list, with the one option', async () => {
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
    expect(config.rules['hangul-route/touchable-has-name']).toEqual([2, { ignoreHidden: true }]);
    // no file-scoped `off` (section 3.3): the same rules are on for another file
    const other = (await eslint.calculateConfigForFile(join(PACKAGE_ROOT, 'src/components/Button/Button.tsx'))) as { rules: Record<string, unknown> };
    expect(other.rules).toEqual(config.rules);
  });

  it('ignores tests and generated files', async () => {
    expect(await eslint.isPathIgnored(join(PACKAGE_ROOT, 'src/components/__tests__/X.test.tsx'))).toBe(true);
    expect(await eslint.isPathIgnored(join(PACKAGE_ROOT, 'src/components/X.test.tsx'))).toBe(true);
    expect(await eslint.isPathIgnored(join(PACKAGE_ROOT, 'src/__generated__/x.tsx'))).toBe(true);
    expect(await eslint.isPathIgnored(join(PACKAGE_ROOT, 'src/components/Button/Button.tsx'))).toBe(false);
  });

  it('the ceiling is empty: design-system has no hits, so no eslint-suppressions.json may appear', () => {
    expect(existsSync(join(PACKAGE_ROOT, 'eslint-suppressions.json'))).toBe(false);
  });
});
