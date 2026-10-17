import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { JoinLinkPanel } from '../JoinLinkParts';
import { qrModules, qrPath } from '@/lib/console/join-link';

/**
 * The class join link and its QR code under the class code (owner decision 2026-10-17): the link as text without
 * https://, Copy link, and Show QR code drawing the link as a named QR image in place. The link holds the code only.
 */

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let renderer: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  vi.unstubAllGlobals();
});

const URL_ = 'https://app.hangulroute.com/join#c=ABC234';
const textOf = (n: ReactTestInstance): string => n.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const copyOf = (locale: UiLocale) => getMessages(locale).console.space.joinLink;

function mount(locale: UiLocale = 'en', centered = false): ReactTestInstance {
  act(() => {
    renderer = create(<JoinLinkPanel url={URL_} copy={copyOf(locale)} centered={centered} />);
  });
  return (renderer as unknown as ReactTestRenderer).root;
}

describe('JoinLinkPanel', () => {
  it.each(['en', 'es', 'ko'] as const)('%s: the link, its note and two buttons in the console language; the QR starts hidden', (locale) => {
    const copy = copyOf(locale);
    const root = mount(locale);
    expect(textOf(byTestId(root, 'join-link-url')[0] as ReactTestInstance)).toBe('app.hangulroute.com/join#c=ABC234');
    expect(textOf(byTestId(root, 'join-link')[0] as ReactTestInstance)).toContain(copy.note);
    expect(textOf(byTestId(root, 'join-link')[0] as ReactTestInstance)).toContain(copy.title);
    expect(textOf(byTestId(root, 'join-link-copy')[0] as ReactTestInstance)).toBe(copy.copy.cta);
    const toggle = byTestId(root, 'join-link-qr-toggle')[0] as ReactTestInstance;
    expect(textOf(toggle)).toBe(copy.qr.show.cta);
    expect(toggle.props['aria-expanded']).toBe(false);
    expect(byTestId(root, 'join-link-qr')).toHaveLength(0);
  });

  it('Show QR code draws the link as one named image in place, and Hide takes it away', () => {
    const copy = copyOf('en');
    const root = mount();
    const toggle = byTestId(root, 'join-link-qr-toggle')[0] as ReactTestInstance;
    act(() => toggle.props.onClick());
    const svg = byTestId(root, 'join-link-qr')[0] as ReactTestInstance;
    expect(svg.props.role).toBe('img');
    expect(svg.props['aria-label']).toBe(copy.qr.label);
    expect(svg.props.viewBox).toBe('0 0 37 37');
    expect(svg.findByType('path').props.d).toBe(qrPath(qrModules(URL_)));
    expect(textOf(root.findByType('figcaption'))).toBe(copy.qr.caption);
    const after = byTestId(root, 'join-link-qr-toggle')[0] as ReactTestInstance;
    expect(after.props['aria-expanded']).toBe(true);
    expect(textOf(after)).toBe(copy.qr.hide.cta);
    // The toggle controls the region the image is drawn in.
    const region = root.find((n) => n.type === 'div' && n.props.id === after.props['aria-controls']);
    expect(region.props.hidden).toBe(false);
    act(() => after.props.onClick());
    expect(byTestId(root, 'join-link-qr')).toHaveLength(0);
  });

  it('Copy link copies the whole link and says so; a clipboard that refuses keeps Copy link', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const root = mount();
    await act(async () => {
      await (byTestId(root, 'join-link-copy')[0] as ReactTestInstance).props.onClick();
    });
    expect(writeText).toHaveBeenCalledWith(URL_);
    expect(textOf(byTestId(root, 'join-link-copy')[0] as ReactTestInstance)).toBe(copyOf('en').copied.cta);

    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => Promise.reject(new Error('denied'))) } });
    act(() => renderer?.unmount());
    const again = mount();
    await act(async () => {
      await (byTestId(again, 'join-link-copy')[0] as ReactTestInstance).props.onClick();
    });
    expect(textOf(byTestId(again, 'join-link-copy')[0] as ReactTestInstance)).toBe(copyOf('en').copy.cta);
  });

  it('centered on an empty class, where the code is written on the board', () => {
    const root = mount('en', true);
    act(() => (byTestId(root, 'join-link-qr-toggle')[0] as ReactTestInstance).props.onClick());
    expect(root.findByType('figure').props.style.alignItems).toBe('center');
  });
});
