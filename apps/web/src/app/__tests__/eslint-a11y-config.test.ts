/**
 * AMENDMENTS-A11Y-CI AC-3 (section 6, item 3): the accessibility lint gate of apps/web.
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

/** One invalid snippet per enabled rule (the 31 recommended rules at error, plus control-has-associated-label), each reporting exactly that rule. */
const INVALID: Record<string, string> = {
  'alt-text': '<img src="a" />',
  'anchor-has-content': '<a href="/x"><span aria-hidden="true">x</span></a>',
  'anchor-is-valid': '<a href="#">Go</a>',
  'aria-activedescendant-has-tabindex': '<div aria-activedescendant="x" />',
  'aria-props': '<div aria-foo="x" />',
  'aria-proptypes': '<div aria-hidden="yes" />',
  'aria-role': '<div role="foo" />',
  'aria-unsupported-elements': '<meta aria-hidden="true" />',
  'autocomplete-valid': '<input autoComplete="foo" />',
  'click-events-have-key-events': '<div role="button" tabIndex={0} onClick={f}>x</div>',
  // The section 3.7 web probe: a <button> with no text and no aria-label.
  'control-has-associated-label': '<button type="button" onClick={onClick} />',
  'heading-has-content': '<h1 />',
  'html-has-lang': '<html />',
  'iframe-has-title': '<iframe src="x" />',
  'img-redundant-alt': '<img src="a" alt="image of a cat" />',
  'interactive-supports-focus': '<div role="button" onClick={f} onKeyDown={f}>x</div>',
  'label-has-associated-control': '<label>Name</label>',
  'media-has-caption': '<video src="x" />',
  'mouse-events-have-key-events': '<div onMouseOver={f} role="button" tabIndex={0}>x</div>',
  'no-access-key': '<div accessKey="a" />',
  'no-autofocus': '<input autoFocus />',
  'no-distracting-elements': '<marquee />',
  'no-interactive-element-to-noninteractive-role': '<button role="article">x</button>',
  'no-noninteractive-element-interactions': '<h2 onClick={f} onKeyDown={f}>x</h2>',
  'no-noninteractive-element-to-interactive-role': '<h2 role="button" tabIndex={0}>x</h2>',
  'no-noninteractive-tabindex': '<div tabIndex={0} />',
  'no-redundant-roles': '<button role="button">x</button>',
  'no-static-element-interactions': '<div onClick={f} onKeyDown={f} />',
  'role-has-required-aria-props': '<div role="checkbox" tabIndex={0}>x</div>',
  'role-supports-aria-props': '<h2 aria-checked="true">x</h2>',
  scope: '<div scope="col" />',
  'tabindex-no-positive': '<button tabIndex={1}>x</button>',
};
const ENABLED = Object.keys(INVALID).map((r) => `jsx-a11y/${r}`);

/**
 * The false-positive entries of section 3.3, pinned by name (every one is listed in the spec's As built):
 * a file-scoped `off` for one rule, because no rule option fits.
 */
const FILE_SCOPED_OFF: Record<string, string> = {
  'src/components/console/AttentionParts.tsx': 'jsx-a11y/no-noninteractive-element-interactions',
  'src/components/console/ConfirmSheet.tsx': 'jsx-a11y/no-noninteractive-element-interactions',
  'src/components/console/DisplaySheet.tsx': 'jsx-a11y/no-noninteractive-element-interactions',
  'src/components/console/StepUpDialog.tsx': 'jsx-a11y/no-noninteractive-element-interactions',
  'src/components/console/TransferParts.tsx': 'jsx-a11y/no-noninteractive-element-interactions',
  'src/app/(console)/teach/space/curriculum/page.tsx': 'jsx-a11y/interactive-supports-focus',
};

/** The suppressions as merged at AC-3 (method B): file -> rule -> count. Raising a number or adding a key is a test change review must justify. */
const CEILING: Record<string, Record<string, number>> = {
  'src/components/console/FamilyNeedsYou.tsx': { 'jsx-a11y/no-redundant-roles': 1 },
  'src/components/console/GrownUpLock.tsx': { 'jsx-a11y/no-redundant-roles': 1 },
  'src/components/console/PinResetPage.tsx': { 'jsx-a11y/no-redundant-roles': 1 },
};

type CalculatedConfig = { rules: Record<string, unknown> };
const levelOf = (setting: unknown): unknown => (Array.isArray(setting) ? setting[0] : setting);
const isOff = (setting: unknown): boolean => levelOf(setting) === 0 || levelOf(setting) === 'off';

let eslint: ESLint;

beforeAll(() => {
  // The same switches as the lint script: the config file of this app, and no inline config.
  eslint = new ESLint({ cwd: APP_ROOT, overrideConfigFile: join(APP_ROOT, 'eslint.config.mjs'), allowInlineConfig: false });
});

async function ruleIds(code: string, filePath = PROBE): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map((m) => (m.fatal ? `FATAL ${m.message}` : (m.ruleId ?? 'no-rule')));
}

async function configFor(file: string): Promise<CalculatedConfig> {
  return (await eslint.calculateConfigForFile(join(APP_ROOT, file))) as CalculatedConfig;
}

describe('apps/web accessibility lint config', () => {
  it('covers 32 rules: the 31 recommended rules at error and control-has-associated-label', () => {
    expect(ENABLED).toHaveLength(32);
  });

  it.each(Object.keys(INVALID))('jsx-a11y/%s reports its invalid snippet, and only that rule', async (rule) => {
    expect(await ruleIds(INVALID[rule] ?? '')).toEqual([`jsx-a11y/${rule}`]);
  });

  it('accepts a <button> with text', async () => {
    expect(await ruleIds('<button type="button">Save</button>')).toEqual([]);
  });

  it('accepts a <button> named by aria-label', async () => {
    expect(await ruleIds('<button type="button" aria-label="Close" />')).toEqual([]);
  });

  it('inline config is off: a disable comment for a rule the repository never installed reports nothing', async () => {
    const code = '// eslint-disable-next-line react-hooks/exhaustive-deps\nconst a = 1;\nexport const B = () => <div />;';
    expect(await ruleIds(code)).toEqual([]);
  });

  it('a disable comment naming an enabled accessibility rule does not silence it', async () => {
    const code = '// eslint-disable-next-line jsx-a11y/control-has-associated-label\nexport const A = () => <button type="button" />;';
    expect(await ruleIds(code)).toEqual(['jsx-a11y/control-has-associated-label']);
    const block = '/* eslint-disable */\nexport const A = () => <button type="button" />;';
    expect(await ruleIds(block)).toEqual(['jsx-a11y/control-has-associated-label']);
  });

  it('turns on only jsx-a11y/* rules, exactly the enabled list; anchor-ambiguous-text and label-has-for are off', async () => {
    const config = await configFor('src/components/Probe.tsx');
    const on = Object.entries(config.rules)
      .filter(([, setting]) => !isOff(setting))
      .map(([id]) => id)
      .sort();
    expect(on).toEqual([...ENABLED].sort());
    for (const id of Object.keys(config.rules)) expect(id).toMatch(/^jsx-a11y\//);
    expect(isOff(config.rules['jsx-a11y/anchor-ambiguous-text'])).toBe(true);
    expect(isOff(config.rules['jsx-a11y/label-has-for'])).toBe(true);
  });

  it('turns control-has-associated-label on with the recommended config’s own options', async () => {
    const config = await configFor('src/components/Probe.tsx');
    expect(config.rules['jsx-a11y/control-has-associated-label']).toEqual([
      2,
      {
        ignoreElements: ['audio', 'canvas', 'embed', 'input', 'textarea', 'tr', 'video'],
        ignoreRoles: ['grid', 'listbox', 'menu', 'menubar', 'radiogroup', 'row', 'tablist', 'toolbar', 'tree', 'treegrid'],
        includeRoles: ['alert', 'dialog'],
      },
    ]);
  });

  it('false positives by rule option (section 3.3): the WebKit list and receipts-table roles, and nothing else', async () => {
    const config = await configFor('src/components/Probe.tsx');
    expect(config.rules['jsx-a11y/no-redundant-roles']).toEqual([
      2,
      { nav: ['navigation'], ul: ['list'], ol: ['list'], thead: ['rowgroup'], tbody: ['rowgroup'] },
    ]);
    expect(config.rules['jsx-a11y/no-interactive-element-to-noninteractive-role']).toEqual([
      2,
      { tr: ['none', 'presentation'], canvas: ['img'], td: ['cell'] },
    ]);
    // the option does not hide a real redundant role
    expect(await ruleIds('<section role="region" aria-labelledby="t" />')).toEqual(['jsx-a11y/no-redundant-roles']);
    expect(await ruleIds('<ul role="list" style={{ listStyle: "none" }}><li>x</li></ul>')).toEqual([]);
    expect(await ruleIds('<table role="table"><thead role="rowgroup"><tr><th scope="col">a</th></tr></thead></table>')).toEqual([]);
    expect(await ruleIds('<table><tbody><tr><td role="cell">x</td></tr></tbody></table>')).toEqual([]);
  });

  it('file-scoped offs (section 3.3) are exactly the listed files, one rule each', async () => {
    const config = await configFor('src/components/Probe.tsx');
    for (const [file, rule] of Object.entries(FILE_SCOPED_OFF)) {
      const forFile = await configFor(file);
      expect(isOff(forFile.rules[rule]), `${file}: ${rule}`).toBe(true);
      // everything else stays as for any other file
      const others = Object.keys(config.rules).filter((id) => id !== rule);
      for (const id of others) expect(forFile.rules[id], `${file}: ${id}`).toEqual(config.rules[id]);
    }
    // a file that is not listed keeps both rules on
    expect(isOff(config.rules['jsx-a11y/no-noninteractive-element-interactions'])).toBe(false);
    expect(isOff(config.rules['jsx-a11y/interactive-supports-focus'])).toBe(false);
  });

  it('ignores tests and generated files', async () => {
    expect(await eslint.isPathIgnored(join(APP_ROOT, 'src/app/__tests__/X.test.tsx'))).toBe(true);
    expect(await eslint.isPathIgnored(join(APP_ROOT, 'src/components/X.test.tsx'))).toBe(true);
    expect(await eslint.isPathIgnored(join(APP_ROOT, 'src/data/__generated__/x.tsx'))).toBe(true);
    expect(await eslint.isPathIgnored(join(APP_ROOT, 'src/components/landing/HomePage.tsx'))).toBe(false);
  });
});

describe('apps/web eslint-suppressions.json (method B, OD-AC5)', () => {
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
      for (const rule of Object.keys(rules)) expect(ENABLED).toContain(rule);
    }
  });
});
