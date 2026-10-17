import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { TextSize } from '@hangul-route/content-schema';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The Display (Aa) sheet of the grown-up pages (owner items 6 and 7): the Aa button named
 * "Display", a modal dialog with Language (endonyms in their own lang, a one-tap way back after a
 * change) and Text size (four radios, each with its Aa at its own step), the sample, the note and
 * Done. Escape, the scrim and Done close it.
 */
const view = vi.hoisted(() => ({
  locale: 'en' as UiLocale,
  available: ['en', 'es', 'ko'] as UiLocale[],
  textSize: 'standard' as TextSize,
  locales: [] as UiLocale[],
  sizes: [] as TextSize[],
}));
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  return {
    useConsoleLocale: () => ({
      locale: view.locale,
      available: view.available,
      messages: i18n.getMessages(view.locale),
      textSize: view.textSize,
      setLocale: (l: UiLocale) => {
        view.locales.push(l);
        view.locale = l;
      },
      setTextSize: (s: TextSize) => {
        view.sizes.push(s);
        view.textSize = s;
      },
    }),
  };
});

import { ConsoleDisplaySheet, DisplayButton } from '../DisplaySheet';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
beforeEach(() => {
  view.locale = 'en';
  view.available = ['en', 'es', 'ko'];
  view.textSize = 'standard';
  view.locales = [];
  view.sizes = [];
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
});

const byTestId = (r: ReactTestRenderer, id: string): ReactTestInstance[] => r.root.findAll((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const textOf = (n: ReactTestInstance): string => n.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');

function renderSheet(onClose = vi.fn()): { r: ReactTestRenderer; onClose: ReturnType<typeof vi.fn> } {
  act(() => {
    mounted = create(<ConsoleDisplaySheet onClose={onClose} />);
  });
  return { r: mounted as unknown as ReactTestRenderer, onClose };
}

describe('the Aa button', () => {
  it('draws the sign, is named Display, and opens the sheet', () => {
    act(() => {
      mounted = create(<DisplayButton testId="frame-display" />);
    });
    const r = mounted as unknown as ReactTestRenderer;
    const button = byTestId(r, 'frame-display')[0]!;
    expect(button.props['aria-label']).toBe('Aa, Display: language and text size');
    expect(button.props['aria-haspopup']).toBe('dialog');
    expect(textOf(button)).toBe('Aa');
    expect(button.props.style.minHeight).toBe(64);
    expect(button.props.style.fontSize).toBe('1.25rem');
    expect(byTestId(r, 'console-display-sheet')).toHaveLength(0);
    act(() => button.props.onClick());
    expect(byTestId(r, 'console-display-sheet')).toHaveLength(1);
    act(() => byTestId(r, 'console-display-done')[0]!.props.onClick());
    expect(byTestId(r, 'console-display-sheet')).toHaveLength(0);
  });
});

describe('the sheet', () => {
  it('is a modal dialog named by its title, with the two radio groups, the sample and the note', () => {
    const { r } = renderSheet();
    const dialog = byTestId(r, 'console-display-sheet')[0]!;
    expect(dialog.props.role).toBe('dialog');
    expect(dialog.props['aria-modal']).toBe('true');
    const heading = r.root.findAll((n) => n.type === 'h2')[0]!;
    expect(heading.props.id).toBe(dialog.props['aria-labelledby']);
    expect(textOf(heading)).toBe('Display');
    const groups = r.root.findAll((n) => n.type === 'div' && n.props.role === 'radiogroup');
    expect(groups.map((g) => g.props['aria-label'])).toEqual(['Language', 'Text size']);
    expect(textOf(byTestId(r, 'console-display-sample')[0]!)).toBe('This is how text looks.');
    expect(r.root.findAll((n) => n.type === 'p' && textOf(n) === 'For everyone on this device. Change it any time.')).toHaveLength(1);
  });

  it('language radios: endonyms in their own lang, the current one checked, one tab stop', () => {
    const { r } = renderSheet();
    const radios = byTestId(r, 'console-display-language')[0]!.findAll((n) => n.type === 'button');
    expect(radios.map((b) => [b.props['aria-label'], b.props.lang, b.props['aria-checked'], b.props.tabIndex])).toEqual([
      ['English', 'en', true, 0],
      ['Español', 'es', false, -1],
      ['한국어', 'ko', false, -1],
    ]);
  });

  it('another language first asks in that language; Use writes it, Back changes nothing', () => {
    const { r } = renderSheet();
    act(() => byTestId(r, 'console-display-language-ko')[0]!.props.onClick());
    // Nothing is written yet: the confirm step replaces the radios, in Korean.
    expect(view.locales).toEqual([]);
    const step = byTestId(r, 'console-display-language-confirm')[0]!;
    expect(step.props.lang).toBe('ko');
    const ko = getMessages('ko').common.display.confirm;
    expect(textOf(step.findAll((n) => n.type === 'p')[0]!)).toBe(ko.question('한국어'));
    expect(byTestId(r, 'console-display-language')).toHaveLength(0);
    expect(textOf(byTestId(r, 'console-display-language-back')[0]!)).toBe(ko.back('English'));
    act(() => byTestId(r, 'console-display-language-back')[0]!.props.onClick());
    expect(view.locales).toEqual([]);
    expect(byTestId(r, 'console-display-language-confirm')).toHaveLength(0);
    act(() => byTestId(r, 'console-display-language-ko')[0]!.props.onClick());
    expect(textOf(byTestId(r, 'console-display-language-use')[0]!)).toBe(ko.use('한국어'));
    act(() => byTestId(r, 'console-display-language-use')[0]!.props.onClick());
    expect(view.locales).toEqual(['ko']);
    // The language already shown asks nothing.
    act(() => mounted?.update(<ConsoleDisplaySheet onClose={vi.fn()} />));
    act(() => byTestId(r, 'console-display-language-ko')[0]!.props.onClick());
    expect(byTestId(r, 'console-display-language-confirm')).toHaveLength(0);
  });

  it('arrow keys move and choose within a radio group', () => {
    const { r } = renderSheet();
    const radios = byTestId(r, 'console-display-text-size')[0]!.findAll((n) => n.type === 'button');
    const prevent = vi.fn();
    act(() => radios[0]!.props.onKeyDown({ key: 'ArrowRight', preventDefault: prevent }));
    expect(view.sizes).toEqual(['large']);
    act(() => radios[0]!.props.onKeyDown({ key: 'ArrowLeft', preventDefault: prevent }));
    expect(view.sizes).toEqual(['large', 'largest']);
    act(() => radios[0]!.props.onKeyDown({ key: 'Enter', preventDefault: prevent }));
    expect(view.sizes).toHaveLength(2);
    expect(prevent).toHaveBeenCalledTimes(2);
  });

  it('text size: four radios, each with its Aa drawn at its own step and hidden from assistive tech', () => {
    view.textSize = 'larger';
    const { r } = renderSheet();
    const radios = byTestId(r, 'console-display-text-size')[0]!.findAll((n) => n.type === 'button');
    expect(radios.map((b) => [b.props['aria-label'], b.props['aria-checked']])).toEqual([
      ['Standard', false],
      ['Large', false],
      ['Larger', true],
      ['Largest', false],
    ]);
    const glyphs = r.root.findAll((n) => n.type === 'span' && n.props['aria-hidden'] === 'true' && textOf(n) === 'Aa');
    expect(glyphs.map((g) => g.props.style.fontSize)).toEqual(['18px', '21px', '23px', '27px']);
    act(() => radios[3]!.props.onClick());
    expect(view.sizes).toEqual(['largest']);
  });

  it('with one language there is no Language row', () => {
    view.available = ['en'];
    const { r } = renderSheet();
    expect(r.root.findAll((n) => n.type === 'div' && n.props.role === 'radiogroup')).toHaveLength(1);
  });

  it('Escape, the scrim and Done close it; Tab stays inside', () => {
    const { r, onClose } = renderSheet();
    const dialog = byTestId(r, 'console-display-sheet')[0]!;
    const stop = vi.fn();
    act(() => dialog.props.onKeyDown({ key: 'Escape', stopPropagation: stop }));
    act(() => byTestId(r, 'console-display-scrim')[0]!.props.onClick());
    act(() => byTestId(r, 'console-display-done')[0]!.props.onClick());
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(stop).toHaveBeenCalledTimes(1);
    // Tab with no DOM (the test renderer) does nothing and never throws.
    expect(() => dialog.props.onKeyDown({ key: 'Tab', shiftKey: false, preventDefault: vi.fn() })).not.toThrow();
    expect(() => dialog.props.onKeyDown({ key: 'a' })).not.toThrow();
  });
});

/** A test DOM: every element gets a node that records focus; the sheet answers the two queries the sheet makes. */
function renderWithNodes() {
  let focused: string | null = null;
  let tabbableIds: string[] = [];
  const selectors: string[] = [];
  const nodes = new Map<string, { focus: () => void }>();
  const checked = new Map<string, boolean>();
  /** A node for an element the renderer made none for (only elements with a ref get one). */
  const nodeOf = (id: string): { focus: () => void } => {
    if (!nodes.has(id))
      nodes.set(id, {
        focus: () => {
          focused = id;
        },
      });
    return nodes.get(id)!;
  };
  act(() => {
    mounted = create(<ConsoleDisplaySheet onClose={vi.fn()} />, {
      createNodeMock: (el) => {
        const props = el.props as Record<string, unknown>;
        const id = String(props['data-testid'] ?? (el.type === 'h2' ? 'heading' : el.type));
        checked.set(id, props['aria-checked'] === true);
        const node = {
          focus: () => {
            focused = id;
          },
          querySelectorAll: (selector: string) => {
            selectors.push(selector);
            if (selector.includes('aria-checked')) {
              return [...checked.entries()].filter(([k, on]) => on && k.startsWith('console-display-language-') && nodes.has(k)).map(([k]) => nodes.get(k)!);
            }
            return tabbableIds.map(nodeOf);
          },
        };
        nodes.set(id, node);
        return node;
      },
    });
  });
  // The heading takes focus on open; the cases below start from there.
  focused = null;
  return {
    r: mounted as unknown as ReactTestRenderer,
    focused: () => focused,
    node: nodeOf,
    selectors,
    tabbable: (list: string[]) => {
      tabbableIds = list;
    },
  };
}

describe('the sheet: focus', () => {
  it('the confirm step takes focus on its Use button; Use and Back give it back to the selected language', () => {
    const t = renderWithNodes();
    act(() => byTestId(t.r, 'console-display-language-ko')[0]!.props.onClick());
    expect(t.focused()).toBe('console-display-language-use');
    act(() => byTestId(t.r, 'console-display-language-back')[0]!.props.onClick());
    expect(t.focused()).toBe('console-display-language-en');
    act(() => byTestId(t.r, 'console-display-language-es')[0]!.props.onClick());
    expect(t.focused()).toBe('console-display-language-use');
    act(() => byTestId(t.r, 'console-display-language-use')[0]!.props.onClick());
    expect(view.locales).toEqual(['es']);
    // The page re-renders the sheet in Spanish with Español selected: focus is on it.
    act(() => mounted?.update(<ConsoleDisplaySheet onClose={vi.fn()} />));
    expect(t.focused()).toBe('console-display-language-es');
  });

  it('arrow keys, Home and End move focus with the selection', () => {
    const t = renderWithNodes();
    const radios = byTestId(t.r, 'console-display-text-size')[0]!.findAll((n) => n.type === 'button');
    act(() => radios[0]!.props.onKeyDown({ key: 'End', preventDefault: vi.fn() }));
    expect(view.sizes).toEqual(['largest']);
    expect(t.focused()).toBe('console-display-text-size-largest');
    act(() => radios[0]!.props.onKeyDown({ key: 'Home', preventDefault: vi.fn() }));
    // Home from the selected first step: focus stays, nothing new is chosen.
    expect(view.sizes).toEqual(['largest']);
    expect(t.focused()).toBe('console-display-text-size-standard');
  });

  it('the Tab trap counts only Tab stops (a radio that is not selected is none): Shift+Tab from the first wraps to the last', () => {
    view.locale = 'ko';
    const t = renderWithNodes();
    const dialog = byTestId(t.r, 'console-display-sheet')[0]!;
    // With 한국어 selected, the first Tab stop is its radio: English and Español are not Tab stops.
    t.tabbable(['console-display-language-ko', 'console-display-text-size-standard', 'console-display-done']);
    let active: unknown = t.node('console-display-language-ko');
    vi.stubGlobal('document', {
      get activeElement() {
        return active;
      },
    });
    try {
      const prevent = vi.fn();
      act(() => dialog.props.onKeyDown({ key: 'Tab', shiftKey: true, preventDefault: prevent }));
      expect(prevent).toHaveBeenCalledTimes(1);
      expect(t.focused()).toBe('console-display-done');
      active = t.node('console-display-done');
      act(() => dialog.props.onKeyDown({ key: 'Tab', shiftKey: false, preventDefault: prevent }));
      expect(t.focused()).toBe('console-display-language-ko');
      // The query asks for Tab stops only.
      const trap = t.selectors.find((sel) => !sel.includes('aria-checked'))!;
      expect(trap).toContain('button:not([disabled]):not([tabindex="-1"])');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
