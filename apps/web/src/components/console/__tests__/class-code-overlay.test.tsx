import { borderWidth, colors, radii, touchTarget } from '@hangul-route/design-system/tokens';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { createRef } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CODE_OVERLAY_ATTR, codeOverlayView, type CodeOverlayView, type FocusNode } from '@/lib/console/class-code-overlay';
import { qrModules, qrPath } from '@/lib/console/join-link';

/**
 * AMENDMENTS-CLASS-CODE-OVERLAY CO-1 (section 3.2 to 3.5; tests section 6 item 3): the overlay's dialog name and
 * description, its first focus, Escape and Tab for the whole document, the page behind made inert and put back, the
 * root's attribute and overflow, where focus goes when it closes, and the QR it shares with the join-link panel.
 */
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const lang = { locale: 'en' as UiLocale };
  const view = () => ({ locale: lang.locale, messages: i18n.getMessages(lang.locale), available: ['en', 'es', 'ko'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => lang.locale, useSetLocale: () => () => undefined };
});

import { ClassCodeOverlay } from '../ClassCodeOverlay';
import { JoinLinkQr, JoinLinkQrImage } from '../JoinLinkParts';

const en = getMessages('en');
const NOW = new Date('2026-11-24T09:00:00.000Z');
const ORIGIN = 'https://app.hangulroute.com';
const VIEW = codeOverlayView({ space: { name: 'Sunday Class A', kind: 'class', archivedAt: null }, joinCode: 'SUN234', joinCodeExpiresAt: '2026-12-12T09:00:00.000Z' }, NOW, 'en', ORIGIN) as CodeOverlayView;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  vi.unstubAllGlobals();
});

const textOf = (n: ReactTestInstance | string): string => (typeof n === 'string' ? n : n.children.map(textOf).join(''));
const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const one = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const [found] = byTestId(root, id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};

type Key = { key: string; shiftKey: boolean; defaultPrevented?: boolean; preventDefault: () => void };

/** A node that logs its focus and holds the attributes `inertOthers` sets. */
function fakeNode(log: string[], name: string, tagName = 'DIV'): Record<string, unknown> & { attrs: Set<string> } {
  const attrs = new Set<string>();
  return {
    tagName,
    attrs,
    classList: { contains: () => false },
    hasAttribute: (n: string) => attrs.has(n),
    setAttribute: (n: string) => attrs.add(n),
    removeAttribute: (n: string) => attrs.delete(n),
    focus: () => log.push(name),
  };
}

interface Setup {
  log: string[];
  closed: number;
  root: ReactTestInstance;
  keydown: () => ((event: Key) => void) | undefined;
  html: { attrs: Map<string, string>; style: { overflow: string } };
  page: { header: ReturnType<typeof fakeNode>; footer: ReturnType<typeof fakeNode>; sibling: ReturnType<typeof fakeNode> };
  opener: ReturnType<typeof fakeNode>;
  head: ReturnType<typeof fakeNode>;
  errorPanel: ReturnType<typeof fakeNode>;
}

/** Mounts the overlay in a fake page: body > [header, main > [sibling, overlay holder > [overlay]], footer]. */
function mount(over: { view?: CodeOverlayView; opener?: Partial<FocusNode> | null; head?: Partial<FocusNode> | null; errorPanel?: Partial<FocusNode> | null; overflowBefore?: string } = {}): Setup {
  const log: string[] = [];
  const listeners = new Map<string, (event: Key) => void>();
  const html = { attrs: new Map<string, string>(), style: { overflow: over.overflowBefore ?? '' } };
  const body = fakeNode(log, 'body', 'BODY');
  const header = fakeNode(log, 'header', 'HEADER');
  const footer = fakeNode(log, 'footer', 'FOOTER');
  const main = fakeNode(log, 'main', 'MAIN');
  const sibling = fakeNode(log, 'sibling', 'SECTION');
  const holder = fakeNode(log, 'holder');
  const overlay = fakeNode(log, 'overlay');
  Object.assign(body, { children: [header, main, footer] });
  Object.assign(main, { parentElement: body, children: [sibling, holder] });
  Object.assign(holder, { parentElement: main, children: [overlay] });
  Object.assign(overlay, { parentElement: holder });
  for (const n of [header, footer]) Object.assign(n, { parentElement: body });
  Object.assign(sibling, { parentElement: main });
  vi.stubGlobal('document', {
    activeElement: null,
    body,
    documentElement: {
      setAttribute: (name: string, value: string) => html.attrs.set(name, value),
      removeAttribute: (name: string) => html.attrs.delete(name),
      hasAttribute: (name: string) => html.attrs.has(name),
      style: html.style,
    },
    addEventListener: (type: string, fn: (event: Key) => void) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
  });
  const opener = { ...fakeNode(log, 'opener', 'BUTTON'), isConnected: true, ...(over.opener ?? {}) };
  const head = { ...fakeNode(log, 'head'), isConnected: true, ...(over.head ?? {}) };
  const errorPanel = { ...fakeNode(log, 'error'), isConnected: true, ...(over.errorPanel ?? {}) };
  const openerRef = createRef<FocusNode>();
  const headRef = createRef<FocusNode>();
  const errorRef = createRef<FocusNode>();
  (openerRef as { current: FocusNode | null }).current = over.opener === null ? null : (opener as FocusNode);
  (headRef as { current: FocusNode | null }).current = over.head === null ? null : (head as FocusNode);
  (errorRef as { current: FocusNode | null }).current = over.errorPanel === null ? null : (errorPanel as FocusNode);
  const state = { closed: 0 };
  act(() => {
    mounted = create(<ClassCodeOverlay view={over.view ?? VIEW} onClose={() => (state.closed += 1)} returnTo={[openerRef, headRef, errorRef]} />, {
      createNodeMock: (el) => {
        const id = String((el.props as Record<string, unknown>)['data-testid'] ?? '');
        if (id === 'class-code-overlay') return Object.assign(overlay, { querySelectorAll: () => [], contains: () => true });
        if (id === 'class-code-close') return fakeNode(log, 'close', 'BUTTON');
        if (el.type === 'h2') return fakeNode(log, 'name', 'H2');
        return fakeNode(log, String(el.type));
      },
    });
  });
  return {
    log,
    get closed() {
      return state.closed;
    },
    root: (mounted as unknown as ReactTestRenderer).root,
    keydown: () => listeners.get('keydown'),
    html,
    page: { header, footer, sibling },
    opener,
    head,
    errorPanel,
  };
}

describe('ClassCodeOverlay: what is drawn (3.2)', () => {
  it('a modal dialog named by the class name, described by the caption, the spoken code and the expiry, in that order', () => {
    const s = mount();
    const dialog = one(s.root, 'class-code-overlay');
    expect(dialog.props.role).toBe('dialog');
    expect(dialog.props['aria-modal']).toBe('true');
    const name = s.root.findByType('h2');
    expect(dialog.props['aria-labelledby']).toBe(name.props.id);
    expect(textOf(name)).toBe('Sunday Class A');
    const ids = String(dialog.props['aria-describedby']).split(' ');
    expect(ids).toHaveLength(3);
    const byId = (id: string): ReactTestInstance => s.root.find((n) => typeof n.type === 'string' && n.props.id === id);
    expect(textOf(byId(ids[0] as string))).toBe('Class code');
    expect(textOf(byId(ids[1] as string))).toBe('S U N 2 3 4');
    expect(textOf(byId(ids[2] as string))).toBe('expires in 18 days');
    // Every id it points at is mounted once.
    for (const id of [name.props.id, ...ids]) expect(s.root.findAll((n) => typeof n.type === 'string' && n.props.id === id)).toHaveLength(1);
  });

  it('the code is aria-hidden with a spoken copy beside it; the how-to line, the QR, its caption and Close follow', () => {
    const s = mount();
    const code = one(s.root, 'class-code');
    expect(code.props['aria-hidden']).toBe('true');
    expect(textOf(code)).toBe('SUN234');
    const text = textOf(s.root);
    expect(text).toContain('Tap “Join a class” in Hangul Route and type this code.');
    expect(text).toContain(en.console.space.joinLink.qr.caption);
    expect(textOf(one(s.root, 'class-code-close'))).toBe(en.common.buttons.close);
    expect(one(s.root, 'class-code-close').props.type).toBe('button');
  });

  it('Close is the console button: buttonBase, touchTarget.min tall', () => {
    const s = mount();
    const style = one(s.root, 'class-code-close').props.style as { minHeight: number };
    expect(style.minHeight).toBe(touchTarget.min);
  });

  it('draws only the view: no learner, no progress, no Copy, no Regenerate', () => {
    const s = mount();
    const buttons = s.root.findAllByType('button');
    expect(buttons).toHaveLength(1);
    expect(textOf(s.root)).not.toContain(en.console.space.regenerate.cta);
    expect(textOf(s.root)).not.toContain(en.console.space.joinLink.copy.cta);
  });

  it('the QR path is the join link\'s, drawn unframed and named', () => {
    const s = mount();
    const svg = one(s.root, 'class-code-qr');
    expect(svg.findByType('path').props.d).toBe(qrPath(qrModules(VIEW.joinLink)));
    expect(svg.props.role).toBe('img');
    expect(svg.props['aria-label']).toBe(en.console.space.joinLink.qr.label);
    const style = svg.props.style as Record<string, unknown>;
    expect(style.border).toBeUndefined();
    expect(style.borderRadius).toBeUndefined();
    expect(style.width).toBe('100%');
  });
});

describe('ClassCodeOverlay: opening (3.3)', () => {
  it('the heading takes focus on open', () => {
    const s = mount();
    expect(s.log).toEqual(['name']);
  });

  it('the page behind is inert while it is open and comes back after', () => {
    const s = mount();
    expect(s.page.header.attrs.has('inert')).toBe(true);
    expect(s.page.footer.attrs.has('inert')).toBe(true);
    expect(s.page.sibling.attrs.has('inert')).toBe(true);
    act(() => mounted?.unmount());
    mounted = null;
    expect(s.page.header.attrs.has('inert')).toBe(false);
    expect(s.page.footer.attrs.has('inert')).toBe(false);
    expect(s.page.sibling.attrs.has('inert')).toBe(false);
  });

  it('the root carries data-hr-code-overlay and does not scroll while it is open; both are put back after', () => {
    const s = mount({ overflowBefore: 'scroll' });
    expect(s.html.attrs.has(CODE_OVERLAY_ATTR)).toBe(true);
    expect(s.html.style.overflow).toBe('hidden');
    act(() => mounted?.unmount());
    mounted = null;
    expect(s.html.attrs.has(CODE_OVERLAY_ATTR)).toBe(false);
    expect(s.html.style.overflow).toBe('scroll');
  });

  it('a document without a root element (a test double) does not break it', () => {
    const log: string[] = [];
    vi.stubGlobal('document', { activeElement: null, body: null, addEventListener: () => undefined, removeEventListener: () => undefined });
    expect(() => {
      act(() => {
        mounted = create(<ClassCodeOverlay view={VIEW} onClose={() => undefined} returnTo={[]} />, { createNodeMock: () => fakeNode(log, 'x') });
      });
    }).not.toThrow();
  });
});

describe('ClassCodeOverlay: keys (3.3)', () => {
  it('Escape on the document and Close each call onClose once; a key the overlay answered is not answered twice', () => {
    const s = mount();
    const preventDefault = vi.fn();
    act(() => s.keydown()!({ key: 'Escape', shiftKey: false, preventDefault }));
    expect(s.closed).toBe(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    act(() => s.keydown()!({ key: 'Escape', shiftKey: false, defaultPrevented: true, preventDefault }));
    expect(s.closed).toBe(1);
    act(() => one(s.root, 'class-code-overlay').props.onKeyDown({ key: 'Escape', shiftKey: false, preventDefault }));
    expect(s.closed).toBe(2);
    act(() => one(s.root, 'class-code-close').props.onClick());
    expect(s.closed).toBe(3);
  });

  it('other keys do nothing; there is no backdrop to click', () => {
    const s = mount();
    const preventDefault = vi.fn();
    act(() => s.keydown()!({ key: 'a', shiftKey: false, preventDefault }));
    act(() => s.keydown()!({ key: 'Enter', shiftKey: false, preventDefault }));
    expect(s.closed).toBe(0);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(byTestId(s.root, 'class-code-backdrop')).toHaveLength(0);
    expect(one(s.root, 'class-code-overlay').props.onClick).toBeUndefined();
  });

  it('Tab and Shift+Tab stay on Close', () => {
    const s = mount();
    s.log.length = 0;
    const preventDefault = vi.fn();
    act(() => s.keydown()!({ key: 'Tab', shiftKey: false, preventDefault }));
    act(() => s.keydown()!({ key: 'Tab', shiftKey: true, preventDefault }));
    expect(s.log).toEqual(['close', 'close']);
    expect(preventDefault).toHaveBeenCalledTimes(2);
  });

  it('the document listener goes when the overlay goes', () => {
    const s = mount();
    expect(s.keydown()).toBeTypeOf('function');
    act(() => mounted?.unmount());
    mounted = null;
    expect(s.keydown()).toBeUndefined();
  });
});

describe('ClassCodeOverlay: where focus goes on close (3.3)', () => {
  const closeAndLog = (s: Setup): string[] => {
    s.log.length = 0;
    act(() => mounted?.unmount());
    mounted = null;
    return s.log;
  };

  it('the opener, from its ref', () => {
    expect(closeAndLog(mount())).toEqual(['opener']);
  });

  it('the page head when the opener is no longer connected (the code ended and the bar drew again), or has no node', () => {
    expect(closeAndLog(mount({ opener: { isConnected: false } }))).toEqual(['head']);
    expect(closeAndLog(mount({ opener: null }))).toEqual(['head']);
  });

  it('the error panel when neither the opener nor the page head is there', () => {
    expect(closeAndLog(mount({ opener: { isConnected: false }, head: null }))).toEqual(['error']);
    expect(closeAndLog(mount({ opener: null, head: { isConnected: false } }))).toEqual(['error']);
  });

  it('nowhere when nothing is there, without throwing', () => {
    expect(closeAndLog(mount({ opener: null, head: null, errorPanel: null }))).toEqual([]);
  });
});

describe('JoinLinkQrImage and the panel\'s JoinLinkQr (3.5)', () => {
  const URL_ = 'https://app.hangulroute.com/join#c=ABC234';

  it('the panel draws what it drew before: a 256 px square, max width 100 %, framed, the same path', () => {
    act(() => {
      mounted = create(<JoinLinkQr url={URL_} label="QR code of the join link" caption="Scan it" />);
    });
    const root = (mounted as unknown as ReactTestRenderer).root;
    const svg = one(root, 'join-link-qr');
    expect(svg.props.width).toBe(touchTarget.min * 4);
    expect(svg.props.height).toBe(touchTarget.min * 4);
    expect(svg.props.viewBox).toBe('0 0 37 37');
    expect(svg.props.shapeRendering).toBe('crispEdges');
    expect(svg.props.style).toEqual({ maxWidth: '100%', height: 'auto', borderRadius: radii.md, border: `${borderWidth.thin}px solid ${colors.border.subtle}` });
    expect(svg.findByType('rect').props.fill).toBe(colors.surface.paper);
    expect(svg.findByType('path').props.fill).toBe(colors.text.primary);
    expect(svg.findByType('path').props.d).toBe(qrPath(qrModules(URL_)));
    expect(textOf(root.findByType('figcaption'))).toBe('Scan it');
  });

  it('side is a number (attributes, as the panel) or a CSS length (style); framed adds the radius and the border; testId names it', () => {
    act(() => {
      mounted = create(
        <div>
          <JoinLinkQrImage url={URL_} label="a" side={128} framed testId="one" />
          <JoinLinkQrImage url={URL_} label="b" side="50%" framed={false} testId="two" />
        </div>,
      );
    });
    const root = (mounted as unknown as ReactTestRenderer).root;
    const one_ = one(root, 'one');
    expect(one_.props.width).toBe(128);
    expect(one_.props.height).toBe(128);
    expect((one_.props.style as Record<string, unknown>).borderRadius).toBe(radii.md);
    const two = one(root, 'two');
    expect(two.props.width).toBeUndefined();
    expect(two.props.height).toBeUndefined();
    expect(two.props.style).toEqual({ maxWidth: '100%', height: 'auto', width: '50%' });
    expect(two.props['aria-label']).toBe('b');
    expect(two.props.role).toBe('img');
  });
});
