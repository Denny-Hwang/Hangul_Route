import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { SCREEN_HEADER_VARIANTS } from '../screen-header-variants';

/**
 * AMENDMENTS-DISPLAY-NAV section 7.1 (row DN-4, review): the header of a route is drawn by the
 * design-system `Screen` (the route-level slot `App` and `BrowseApp` provide), so the guarantee
 * "every screen has its way back" holds only if every registered screen draws through `Screen`.
 * This scan reads the real component each navigator registers (root, onboarding, the four tabs,
 * All lessons and the level check's nested stack), follows what it renders (a view it delegates
 * to, a game, a fallback, a higher-order wrapper) and asserts that every path of every screen ends
 * in a design-system `Screen` (or a nested navigator, whose routes are scanned on their own). A
 * path that renders nothing (`null`) is allowed only where it is listed below with its reason, so a
 * screen drawn outside `Screen` in some state, which would ship with no way back, fails here.
 */
const SRC = join(__dirname, '..', '..');

/** Paths that render nothing, by `file#Component`, with how many and why there is no way back to draw then. */
const NULL_PATHS: Readonly<Record<string, { count: number; why: string }>> = {
  'screens/quest/QuestPlayerScreen.tsx#QuestPlayerScreen': {
    count: 1,
    why: 'one frame while the run settles (or a closed quest is sent away by its guard): the screen is replaced, nothing waits on it',
  },
  'screens/placement/ResultScreen.tsx#ResultScreen': {
    count: 1,
    why: 'no finished check to show: the level check routes to its result only once a check has finished, and its flow replaces the route otherwise',
  },
  'screens/placement/context.tsx#flowRoute': {
    count: 1,
    why: 'a stale route of the level check\'s nested stack, replaced on focus by the route the run is on (the visible route always draws)',
  },
};

/** Higher-order wrappers a navigator registers: what each one renders around its screen. */
const WRAPPERS_HOC: Readonly<Record<string, { file: string; delegate: number; renders: RegExp }>> = {
  // A modal measures its own safe area: the screen inside a SafeAreaProvider, nothing else.
  withOwnSafeArea: { file: 'navigation/with-own-safe-area.tsx', delegate: 0, renders: /<SafeAreaProvider>\s*<Component \{\.\.\.props\} \/>\s*<\/SafeAreaProvider>/ },
  // The level check's routes: the screen while the run is on that route, null on a stale one (listed above).
  flowRoute: { file: 'screens/placement/context.tsx', delegate: 1, renders: /return target === name \? <Screen \/> : null;/ },
};

/** Host components that only lay out what they hold: they pass when one of their children draws a `Screen`. */
const LAYOUT_TAGS = new Set(['', 'React.Fragment', 'Fragment', 'View', 'ErrorBoundary', 'PreviewFrame', 'SafeAreaProvider']);

interface Source {
  path: string;
  file: ts.SourceFile;
}

const sourceCache = new Map<string, Source>();
function source(path: string): Source {
  let s = sourceCache.get(path);
  if (!s) {
    const text = readFileSync(join(SRC, path), 'utf8');
    s = { path, file: ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) };
    sourceCache.set(path, s);
  }
  return s;
}

/** A relative import from `from`, as a path under `src` (the native file when a `.web` twin exists too). */
function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = join(dirname(from), spec);
  for (const candidate of [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
    if (existsSync(join(SRC, candidate))) return candidate;
  }
  return null;
}

type Decl =
  | { kind: 'function'; src: Source; node: ts.FunctionLikeDeclaration; name: string }
  | { kind: 'hoc'; src: Source; name: string; call: ts.CallExpression }
  | { kind: 'external'; module: string; name: string };

/** Where `name` is declared, seen from `src`: a function or a const in the file, an import, or a re-export. */
function declarationOf(src: Source, name: string, seen = new Set<string>()): Decl | null {
  const key = `${src.path}#${name}`;
  if (seen.has(key)) return null;
  seen.add(key);
  for (const st of src.file.statements) {
    if (ts.isFunctionDeclaration(st) && st.name?.text === name) return { kind: 'function', src, node: st, name };
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || d.name.text !== name || !d.initializer) continue;
        const init = d.initializer;
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) return { kind: 'function', src, node: init, name };
        if (ts.isCallExpression(init)) return { kind: 'hoc', src, name, call: init };
      }
    }
    if (ts.isImportDeclaration(st) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings)) {
      const spec = (st.moduleSpecifier as ts.StringLiteral).text;
      for (const el of st.importClause.namedBindings.elements) {
        if (el.name.text !== name) continue;
        const imported = el.propertyName?.text ?? el.name.text;
        const path = resolveImport(src.path, spec);
        if (path === null) return { kind: 'external', module: spec, name: imported };
        return declarationOf(source(path), imported, seen);
      }
    }
    if (ts.isExportDeclaration(st) && st.moduleSpecifier && st.exportClause && ts.isNamedExports(st.exportClause)) {
      for (const el of st.exportClause.elements) {
        if (el.name.text !== name) continue;
        const path = resolveImport(src.path, (st.moduleSpecifier as ts.StringLiteral).text);
        if (path !== null) return declarationOf(source(path), el.propertyName?.text ?? name, seen);
      }
    }
  }
  return null;
}

/** Whether a file takes `Screen` from the design system. */
function importsDesignScreen(src: Source): boolean {
  return src.file.statements.some(
    (st) =>
      ts.isImportDeclaration(st) &&
      (st.moduleSpecifier as ts.StringLiteral).text === '@hangul-route/design-system' &&
      st.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(st.importClause.namedBindings) &&
      st.importClause.namedBindings.elements.some((el) => el.name.text === 'Screen'),
  );
}

/**
 * What is wrong with a path (empty: every path ends in a `Screen` or a nested navigator), and the
 * paths on the way that render nothing, by the component (`file#Component`) whose own return they are.
 */
interface Verdict {
  problems: string[];
  nulls: Map<string, number>;
}

const ok = (): Verdict => ({ problems: [], nulls: new Map() });
const fail = (why: string): Verdict => ({ problems: [why], nulls: new Map() });
const countNull = (key: string): Verdict => ({ problems: [], nulls: new Map([[key, 1]]) });
/** The returns of one component (`own`) add up; a component met on two paths counts once. */
function merge(own: string, ...all: Verdict[]): Verdict {
  const out = ok();
  for (const v of all) {
    out.problems.push(...v.problems);
    for (const [k, n] of v.nulls) out.nulls.set(k, k === own ? (out.nulls.get(k) ?? 0) + n : Math.max(out.nulls.get(k) ?? 0, n));
  }
  return out;
}

/** The return statements of a function body, not those of the functions nested in it. */
function returnsOf(fn: ts.FunctionLikeDeclaration): ts.Expression[] {
  if (fn.body === undefined) return [];
  if (!ts.isBlock(fn.body)) return [fn.body];
  const out: ts.Expression[] = [];
  const walk = (node: ts.Node): void => {
    if (ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node)) {
      if (node.expression) out.push(node.expression);
      return;
    }
    ts.forEachChild(node, walk);
  };
  ts.forEachChild(fn.body, walk);
  return out;
}

/** A local function or const called or named inside `scope` (the component body first, then the file). */
function localDeclaration(scope: ts.Node | undefined, src: Source, name: string): ts.Node | null {
  let found: ts.Node | null = null;
  const walk = (node: ts.Node): void => {
    if (found) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) found = node.initializer;
    else ts.forEachChild(node, walk);
  };
  if (scope) walk(scope);
  if (!found) walk(src.file);
  return found;
}

const analysed = new Map<string, Verdict>();

/** Every path of a component ends in a `Screen` (or a nested navigator); nulls are counted for the list. */
function componentVerdict(decl: Decl, via: string): Verdict {
  if (decl.kind === 'external') return fail(`${via}: <${decl.name}> from ${decl.module} is not a design-system Screen`);
  const key = `${decl.src.path}#${decl.name}`;
  const cached = analysed.get(key);
  if (cached) return cached;
  analysed.set(key, ok()); // a cycle reads as passing; the outer call decides
  let verdict: Verdict;
  if (decl.kind === 'hoc') {
    const callee = decl.call.expression.getText(decl.src.file);
    const hoc = WRAPPERS_HOC[callee];
    if (!hoc) verdict = fail(`${key}: wraps its screen in ${callee}(), which this scan does not know`);
    else {
      const arg = decl.call.arguments[hoc.delegate];
      const inner = arg === undefined ? null : delegateOf(decl.src, arg, decl.call);
      // The wrapper's own null path (flowRoute's stale route) is counted where the wrapper is written.
      const own = /: null;/.test(hoc.renders.source) ? countNull(`${hoc.file}#${callee}`) : ok();
      verdict = inner === null ? fail(`${key}: ${callee}() wraps something this scan cannot follow`) : merge(key, own, componentVerdict(inner, key));
    }
  } else {
    const returns = returnsOf(decl.node);
    verdict = returns.length === 0 ? fail(`${key}: returns nothing`) : merge(key, ...returns.map((r) => expressionVerdict(r, decl.src, decl.node, key)));
  }
  analysed.set(key, verdict);
  return verdict;
}

/** What a higher-order wrapper's argument is: a component in the file or an inline one. */
function delegateOf(src: Source, arg: ts.Expression, at: ts.Node): Decl | null {
  if (ts.isIdentifier(arg)) return declarationOf(src, arg.text);
  if (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)) {
    const line = src.file.getLineAndCharacterOfPosition(at.getStart(src.file)).line + 1;
    return { kind: 'function', src, node: arg, name: `inline@${line}` };
  }
  return null;
}

function expressionVerdict(expr: ts.Expression, src: Source, scope: ts.Node, via: string): Verdict {
  if (ts.isParenthesizedExpression(expr)) return expressionVerdict(expr.expression, src, scope, via);
  if (expr.kind === ts.SyntaxKind.NullKeyword) return countNull(via);
  if (ts.isConditionalExpression(expr)) return merge(via, expressionVerdict(expr.whenTrue, src, scope, via), expressionVerdict(expr.whenFalse, src, scope, via));
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    return merge(via, countNull(via), expressionVerdict(expr.right, src, scope, via));
  }
  if (ts.isJsxElement(expr) || ts.isJsxSelfClosingElement(expr) || ts.isJsxFragment(expr)) return jsxVerdict(expr, src, scope, via);
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
    const local = localDeclaration(scope, src, expr.expression.text);
    if (local && (ts.isFunctionDeclaration(local) || ts.isArrowFunction(local) || ts.isFunctionExpression(local))) {
      return merge(via, ...returnsOf(local).map((r) => expressionVerdict(r, src, local, via)));
    }
  }
  if (ts.isIdentifier(expr)) {
    const local = localDeclaration(scope, src, expr.text);
    if (local && !ts.isFunctionDeclaration(local) && ts.isExpression(local as ts.Expression)) return expressionVerdict(local as ts.Expression, src, scope, via);
  }
  return fail(`${via}: returns ${expr.getText(src.file).slice(0, 60)}, which this scan cannot follow`);
}

/** A layout element passes when one of the elements or expressions it holds draws a `Screen`. */
function childrenVerdict(node: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment, tag: string, src: Source, scope: ts.Node, via: string): Verdict {
  const children = ts.isJsxSelfClosingElement(node) ? [] : node.children;
  const verdicts: Verdict[] = [];
  for (const child of children) {
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) verdicts.push(jsxVerdict(child, src, scope, via));
    else if (ts.isJsxExpression(child) && child.expression) verdicts.push(expressionVerdict(child.expression, src, scope, via));
  }
  return verdicts.find((v) => v.problems.length === 0) ?? fail(`${via}: <${tag || 'Fragment'}> holds no Screen`);
}

/** Whether every path of a component draws the `children` it is given (a wrapper such as a context override). */
function rendersChildren(decl: Extract<Decl, { kind: 'function' }>): boolean {
  const returns = returnsOf(decl.node);
  return returns.length > 0 && returns.every((r) => /\{children\}/.test(r.getText(decl.src.file)));
}

function tagOf(node: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment, src: Source): string {
  if (ts.isJsxFragment(node)) return '';
  const tag = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
  return tag.getText(src.file);
}

function jsxVerdict(node: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxFragment, src: Source, scope: ts.Node, via: string): Verdict {
  const tag = tagOf(node, src);
  if (tag === 'Screen' && importsDesignScreen(src)) return ok();
  if (/\.Navigator$/.test(tag)) return ok();
  if (LAYOUT_TAGS.has(tag) || /(^|\.)\w*Provider$/.test(tag)) return childrenVerdict(node, tag, src, scope, via);
  if (/^[A-Z]/.test(tag) && !tag.includes('.')) {
    const decl = declarationOf(src, tag);
    if (decl === null) return fail(`${via}: <${tag}> is not declared where this scan can see it`);
    // A component that only wraps what it is given (a context override around a game): what it holds decides.
    if (!ts.isJsxSelfClosingElement(node) && decl.kind === 'function' && rendersChildren(decl)) return childrenVerdict(node, tag, src, scope, via);
    return componentVerdict(decl, via);
  }
  return fail(`${via}: draws <${tag}> outside a Screen`);
}

/** Every route a navigator registers, with the component it gives. */
function registered(path: string): { route: string; decl: Decl | null }[] {
  const src = source(path);
  const out: { route: string; decl: Decl | null }[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(node) && /^(Stack|Tab)\.Screen$/.test(node.tagName.getText(src.file))) {
      let route: string | null = null;
      let component: ts.Expression | null = null;
      for (const attr of node.attributes.properties) {
        if (!ts.isJsxAttribute(attr) || !attr.initializer) continue;
        const name = attr.name.getText(src.file);
        if (name === 'name' && ts.isStringLiteral(attr.initializer)) route = attr.initializer.text;
        if (name === 'component' && ts.isJsxExpression(attr.initializer) && attr.initializer.expression) component = attr.initializer.expression;
      }
      if (route !== null && component !== null && ts.isIdentifier(component)) out.push({ route, decl: declarationOf(src, component.text) });
    }
    // A table of routes (the four tabs' SCREENS, the level check's ROUTES): `Name: Component` or `Name: hoc(...)`.
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && (node.name.text === 'SCREENS' || node.name.text === 'ROUTES')) {
      let init = node.initializer;
      while (init && (ts.isSatisfiesExpression(init) || ts.isAsExpression(init))) init = init.expression;
      if (init && ts.isObjectLiteralExpression(init)) {
        for (const prop of init.properties) {
          if (!ts.isPropertyAssignment(prop)) continue;
          const route = prop.name.getText(src.file);
          const value = prop.initializer;
          if (ts.isIdentifier(value)) out.push({ route, decl: declarationOf(src, value.text) });
          else if (ts.isCallExpression(value)) out.push({ route, decl: { kind: 'hoc', src, name: `${node.name.text}.${route}`, call: value } });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(src.file);
  return out;
}

const NAVIGATORS = ['navigation/root.tsx', 'navigation/onboarding.tsx', 'navigation/tabs.tsx', 'navigation/browse.tsx', 'screens/placement/PlacementScreen.tsx'];
/** Containers: the nested navigators, whose own routes are in the list. */
const CONTAINERS = new Set(['Onboarding', 'Main']);

describe('every registered screen draws through Screen, so its header (its way back) is drawn (AMENDMENTS-DISPLAY-NAV section 7.1)', () => {
  const routes = NAVIGATORS.flatMap((path) => registered(path).map((r) => ({ ...r, navigator: path })));

  it('finds the routes of every navigator, each with its component', () => {
    const names = new Set(routes.map((r) => r.route));
    // Every route the header table knows is registered by a navigator this scan reads.
    for (const route of Object.keys(SCREEN_HEADER_VARIANTS)) expect(names.has(route), route).toBe(true);
    for (const r of routes) expect(r.decl, `${r.navigator} ${r.route}`).not.toBeNull();
  });

  it('every path of every screen ends in a Screen (or a nested navigator)', () => {
    const all = merge('', ...routes.filter((r) => !CONTAINERS.has(r.route) && r.decl !== null).map((r) => componentVerdict(r.decl!, `${r.navigator} ${r.route}`)));
    expect([...new Set(all.problems)]).toEqual([]);
    // Nothing on a screen's path renders null unless it is listed with its reason; nothing listed is stale.
    const listed = Object.fromEntries(Object.entries(NULL_PATHS).map(([k, v]) => [k, v.count]));
    expect(Object.fromEntries([...all.nulls].sort())).toEqual(listed);
    for (const entry of Object.values(NULL_PATHS)) expect(entry.why.length).toBeGreaterThan(20);
  });

  it('the wrappers a navigator registers still render only their screen', () => {
    for (const [name, hoc] of Object.entries(WRAPPERS_HOC)) {
      expect(readFileSync(join(SRC, hoc.file), 'utf8'), name).toMatch(hoc.renders);
    }
  });

  it('a screen drawn outside Screen in some state fails the scan (the scan itself)', () => {
    const fake: Source = {
      path: 'screens/fake/FakeScreen.tsx',
      file: ts.createSourceFile(
        'FakeScreen.tsx',
        "import { Screen } from '@hangul-route/design-system';\nimport { View } from 'react-native';\nexport function FakeScreen({ ready }: { ready: boolean }) {\n  if (!ready) return <View />;\n  return <Screen>{null}</Screen>;\n}\n",
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      ),
    };
    const v = componentVerdict({ kind: 'function', src: fake, node: fake.file.statements[2] as ts.FunctionDeclaration, name: 'FakeScreen' }, 'fake');
    expect(v.problems).toEqual(['screens/fake/FakeScreen.tsx#FakeScreen: <View> holds no Screen']);
  });
});
