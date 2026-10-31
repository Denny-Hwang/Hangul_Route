import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { colors, touchTarget } from '@hangul-route/design-system/tokens';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { CSSProperties } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * AMENDMENTS-GROWNUP-UX section 8 T2, row GX-6 (GX-D11, "One button size"): the console's one button look
 * (`buttonBase`, `Button`, `components/console/ui.tsx`) is never shorter than `touchTarget.min` and never narrower than
 * `touchTarget.child`, so no short label ("쪽지", "설정") turns into a circle and no row mixes 40 px and 64 px buttons.
 * The source scan keeps it that way: no console file sets its own size or box on a `buttonBase` spread, and `Button`
 * takes no style. **Remove from class** (and from a family or school) uses the danger tone.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: 'en' as UiLocale, messages: i18n.getMessages('en'), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => 'en', useSetLocale: () => () => undefined };
});

import { SettingsSections, type SettingsSectionsProps } from '@/components/console/SettingsParts';
import { Button, buttonBase } from '@/components/console/ui';

const en = getMessages('en').console;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let renderer: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

function render(node: JSX.Element): ReactTestInstance {
  act(() => {
    renderer = create(node);
  });
  return (renderer as ReactTestRenderer).root;
}
const textOf = (node: ReactTestInstance): string => node.findAll((n) => typeof n.type === 'string').map((n) => n.children.filter((c) => typeof c === 'string').join('')).join(' ');

/** The size floor every console button meets: 64 tall, 80 wide, its label centred in a flex box. */
function expectFloor(style: CSSProperties): void {
  expect(style.minHeight).toBe(touchTarget.min);
  expect(style.minWidth).toBe(touchTarget.child);
  expect(style.display).toBe('inline-flex');
  expect(style.alignItems).toBe('center');
  expect(style.justifyContent).toBe('center');
  expect(style.boxSizing).toBe('border-box');
}

describe('buttonBase and Button (GX-6, T2)', () => {
  it('buttonBase carries the touch-target floor: touchTarget.min tall, touchTarget.child wide, centred', () => {
    expectFloor(buttonBase);
    expect(touchTarget.child).toBeGreaterThanOrEqual(touchTarget.min);
  });

  it('a link that looks like a button needs no underline of its own', () => {
    expect(buttonBase.textDecoration).toBe('none');
  });

  for (const tone of ['primary', 'secondary', 'danger', 'dangerText'] as const) {
    it(`Button in the ${tone} tone keeps the floor, with a one-character label too`, () => {
      const root = render(
        <Button tone={tone} onClick={() => undefined}>
          쪽
        </Button>,
      );
      expectFloor(root.findByType('button').props.style as CSSProperties);
    });
  }

  it('the danger tone is the danger token on text and border, never a fill', () => {
    const root = render(<Button tone="danger">{en.settings.learners.remove.class.cta}</Button>);
    const style = root.findByType('button').props.style as CSSProperties;
    expect(style.color).toBe(colors.feedback.danger);
    expect(style.borderColor).toBe(colors.feedback.danger);
    expect(style.backgroundColor).toBe(colors.surface.paper);
  });
});

// GX-10 (T11, P7) made the row's Remove the quieter `dangerText` look beside Move: still the danger colour on its label
// and still the floor, with no fill and no border.
describe('Remove a learner uses the danger colour (GX-6, T2), in the quieter text look (GX-10)', () => {
  const noop = (): void => undefined;
  const props = (kind: 'class' | 'family' | 'school'): SettingsSectionsProps => ({
    roster: {
      space: { id: 'space:a', kind, name: 'Sunday Class A', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' },
      learners: [],
      joinCode: 'K7PM4Q',
      joinCodeExpiresAt: '2026-11-01T00:00:00.000Z',
    } as unknown as SettingsSectionsProps['roster'],
    members: [
      { memberKind: 'account', memberId: 'acc_1', role: 'owner', joinedAt: '2026-09-01T00:00:00.000Z', name: 'Mr Han', isOwner: true },
      { memberKind: 'learner', memberId: 'profile:mina', role: 'student', joinedAt: '2026-09-20T00:00:00.000Z', name: 'Mina', isOwner: false },
    ] as unknown as SettingsSectionsProps['members'],
    accountId: 'acc_1',
    now: new Date('2026-10-31T00:00:00.000Z'),
    busy: false,
    schoolConsent: false,
    deleteTarget: '',
    typedName: '',
    onRegenerate: noop,
    onConsent: noop,
    onAnonymize: noop,
    onRemoveAdult: noop,
    onRemoveLearner: noop,
    onArchive: noop,
    onDeleteTarget: noop,
    onTypedName: noop,
    onDelete: noop,
  });

  for (const kind of ['class', 'family', 'school'] as const) {
    it(`the learner row's ${en.settings.learners.remove[kind].cta} is drawn in the danger colour, as a text button`, () => {
      const root = render(<SettingsSections {...props(kind)} />);
      const learners = root.find((n) => n.type === 'section' && n.props['aria-label'] === en.settings.learners.label);
      const remove = learners.findAll((n) => n.type === 'button').find((b) => textOf(b) === en.settings.learners.remove[kind].cta);
      expect(remove).toBeDefined();
      const style = (remove as ReactTestInstance).props.style as CSSProperties;
      expect(style.color).toBe(colors.feedback.danger);
      expect(style.borderColor).toBe('transparent');
      expect(style.textDecoration).toBe('underline');
      expectFloor(style);
    });
  }
});

// ---------------------------------------------------------------------------
// Source scan: the floor lives in buttonBase only.

const WEB_SRC = join(__dirname, '..', '..', '..');
const ROOTS = [join(WEB_SRC, 'components', 'console'), join(WEB_SRC, 'app', '(console)')];
/** Keys that set a button's size or box; buttonBase owns them, so a spread of it may not set them again. */
const OWNED = ['minHeight', 'minWidth', 'display', 'alignItems', 'justifyContent', 'boxSizing'];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== '__tests__' && name !== 'design-preview') out.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** The object literal around `at` (the index of a `...buttonBase` spread): from its `{` to the matching `}`. */
function enclosingObject(source: string, at: number): string {
  let depth = 0;
  let start = -1;
  for (let i = at; i >= 0; i -= 1) {
    const ch = source[i];
    if (ch === '}') depth += 1;
    else if (ch === '{') {
      if (depth === 0) {
        start = i;
        break;
      }
      depth -= 1;
    }
  }
  if (start === -1) return '';
  depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return source.slice(start);
}

/** The object literal that opens at `start` (a `{`): up to its matching `}`. */
function objectFrom(source: string, start: number): string {
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return source.slice(start);
}

/**
 * `buttonBase` and every local name built on it, one level after another: `const smallButton = buttonBase;`,
 * `const control = { ...buttonBase, flex: 'none' };`, `const primary = { ...control, ... };`. A spread of any of them is
 * a spread of the floor, so the scan follows them all.
 */
function buttonBaseNames(source: string): string[] {
  const names = new Set(['buttonBase']);
  const declarations = Array.from(source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::\s*[\w.<>]+\s*)?=\s*/g));
  let grew = true;
  while (grew) {
    grew = false;
    for (const declaration of declarations) {
      const name = declaration[1] as string;
      if (names.has(name)) continue;
      const at = (declaration.index ?? 0) + declaration[0].length;
      const direct = /^([A-Za-z_$][\w$]*)\s*[;,\n]/.exec(source.slice(at, at + 200));
      const built =
        direct !== null
          ? names.has(direct[1] as string)
          : source[at] === '{' && Array.from(objectFrom(source, at).matchAll(/\.\.\.([A-Za-z_$][\w$]*)\b/g)).some((m) => names.has(m[1] as string));
      if (built) {
        names.add(name);
        grew = true;
      }
    }
  }
  return Array.from(names);
}

/** The top-level keys an object literal sets (nested objects and spreads skipped). */
function topLevelKeys(literal: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  let token = '';
  for (let i = 0; i < literal.length; i += 1) {
    const ch = literal[i] as string;
    if (ch === '{' || ch === '(' || ch === '[') depth += 1;
    else if (ch === '}' || ch === ')' || ch === ']') depth -= 1;
    if (depth === 1 && ch === ',') token = '';
    else if (depth === 1 && ch === ':') {
      const key = token.trim().replace(/^['"]|['"]$/g, '');
      if (/^[A-Za-z]+$/.test(key)) keys.push(key);
      token = '';
    } else if (depth === 1 && ch !== '{') token += ch;
    if (depth === 1 && ch === '{') token = '';
  }
  return keys;
}

describe('source scan: no per-call size on the console button (GX-6)', () => {
  const files = ROOTS.flatMap(sourceFiles);
  const users = files.filter((f) => /import\s*\{[^}]*\bbuttonBase\b[^}]*\}\s*from\s*['"](?:@\/components\/console\/ui|\.\/ui)['"]/.test(readFileSync(f, 'utf8')));

  it('finds the files that use buttonBase (the scan is not empty)', () => {
    expect(users.length).toBeGreaterThanOrEqual(5);
  });

  it('the helpers read object literals and their top-level keys', () => {
    const src = 'const a = { ...buttonBase, minHeight: 64, style: { display: "x" }, "minWidth": 2 };';
    expect(topLevelKeys(enclosingObject(src, src.indexOf('...buttonBase')))).toEqual(['minHeight', 'style', 'minWidth']);
  });

  it('the scan follows names built on buttonBase (an alias, or a literal that spreads it or another alias)', () => {
    const src = 'const small: CSSProperties = buttonBase;\nconst control = { ...buttonBase, flex: "none" };\nconst primary = { color: "x", ...control };\nconst other = { ...panelStyle };';
    expect(buttonBaseNames(src).sort()).toEqual(['buttonBase', 'control', 'primary', 'small']);
  });

  it('the console names built on buttonBase are found (smallButton, button, control, primary)', () => {
    const all = new Set(users.flatMap((f) => buttonBaseNames(readFileSync(f, 'utf8'))));
    for (const name of ['smallButton', 'primaryButton', 'button', 'control', 'primary']) expect(all.has(name), name).toBe(true);
  });

  it('no object that spreads buttonBase, or a name built on it, sets minHeight, minWidth, display, alignItems, justifyContent or boxSizing', () => {
    const offenders: string[] = [];
    for (const file of users) {
      const source = readFileSync(file, 'utf8');
      const spread = new RegExp(`\\.\\.\\.(?:${buttonBaseNames(source).join('|')})\\b`, 'g');
      for (const match of source.matchAll(spread)) {
        const keys = topLevelKeys(enclosingObject(source, match.index ?? 0));
        const bad = keys.filter((k) => OWNED.includes(k));
        if (bad.length > 0) offenders.push(`${relative(WEB_SRC, file)}: ${bad.join(', ')}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no console file passes a style to Button (it takes none: the tone is the only variation)', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/<Button\b[^>]*?\bstyle=/g)) offenders.push(`${relative(WEB_SRC, file)} @${match.index ?? 0}`);
    }
    expect(offenders).toEqual([]);
  });
});
