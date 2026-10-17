import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, useConfirmDialog, type ConfirmControl } from '../ConfirmDialog';

/**
 * The console's confirm (owner request 2026-10-16, item 8): a `<dialog>` in the page with the page's question and
 * the console language's Cancel and OK, replacing `window.confirm` (whose buttons followed the browser's language).
 * Cancel comes first and has the focus; Escape cancels; one answer per question.
 */

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let renderer: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

const textOf = (n: ReactTestInstance): string => n.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const labelsOf = (locale: UiLocale) => ({ ok: getMessages(locale).common.buttons.ok, cancel: getMessages(locale).common.buttons.cancel });

describe('ConfirmDialog', () => {
  it.each(['en', 'es', 'ko'] as const)('%s: the question as written (line breaks kept) and the console language buttons, Cancel first', (locale) => {
    const labels = labelsOf(locale);
    act(() => {
      renderer = create(<ConfirmDialog question={'Make a new code?\n\nThe old one stops.'} labels={labels} onAnswer={() => undefined} />);
    });
    const root = (renderer as unknown as ReactTestRenderer).root;
    const dialog = root.find((n) => n.type === 'dialog');
    expect(dialog.props.role).toBe('alertdialog');
    const question = dialog.find((n) => n.type === 'p');
    expect(textOf(question)).toBe('Make a new code?\n\nThe old one stops.');
    expect(question.props.style.whiteSpace).toBe('pre-line');
    expect(dialog.props['aria-labelledby']).toBe(question.props.id);
    expect(dialog.findAll((n) => n.type === 'button').map(textOf)).toEqual([labels.cancel, labels.ok]);
  });

  it('opens as a modal and puts the focus on Cancel; Escape (the cancel event) answers no, once', () => {
    const onAnswer = vi.fn();
    const cancelButton = { focus: vi.fn() };
    const node = { open: false, showModal: vi.fn(() => void (node.open = true)), close: vi.fn(), querySelector: () => cancelButton, setAttribute: vi.fn() };
    act(() => {
      renderer = create(<ConfirmDialog question="Remove Mina?" labels={labelsOf('en')} onAnswer={onAnswer} />, {
        createNodeMock: (element) => (element.type === 'dialog' ? node : {}),
      });
    });
    expect(node.showModal).toHaveBeenCalledTimes(1);
    expect(cancelButton.focus).toHaveBeenCalled();
    const dialog = (renderer as unknown as ReactTestRenderer).root.find((n) => n.type === 'dialog');
    const preventDefault = vi.fn();
    act(() => dialog.props.onCancel({ preventDefault }));
    act(() => dialog.props.onCancel({ preventDefault }));
    expect(preventDefault).toHaveBeenCalled();
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(false);
  });
});

describe('useConfirmDialog', () => {
  function Probe({ grab }: { grab: (control: ConfirmControl) => void }): JSX.Element {
    const control = useConfirmDialog(labelsOf('ko'));
    grab(control);
    return <main>{control.dialog}</main>;
  }

  it('ask resolves true on OK and false on Cancel; the dialog closes after each answer', async () => {
    let control!: ConfirmControl;
    act(() => {
      renderer = create(<Probe grab={(c) => (control = c)} />);
    });
    const root = (renderer as unknown as ReactTestRenderer).root;
    expect(root.findAll((n) => n.type === 'dialog')).toHaveLength(0);

    let first!: Promise<boolean>;
    act(() => {
      first = control.ask('Archive this plan?');
    });
    const ok = root.find((n) => n.props['data-testid'] === 'console-confirm-ok' && n.type === 'button');
    expect(textOf(ok)).toBe(getMessages('ko').common.buttons.ok);
    act(() => ok.props.onClick());
    await expect(first).resolves.toBe(true);
    expect(root.findAll((n) => n.type === 'dialog')).toHaveLength(0);

    let second!: Promise<boolean>;
    act(() => {
      second = control.ask('Drop your edits?');
    });
    act(() => root.find((n) => n.props['data-testid'] === 'console-confirm-cancel' && n.type === 'button').props.onClick());
    await expect(second).resolves.toBe(false);
  });

  it('a second ask while one is open answers the first as no; unmounting answers no', async () => {
    let control!: ConfirmControl;
    act(() => {
      renderer = create(<Probe grab={(c) => (control = c)} />);
    });
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = control.ask('One?');
    });
    act(() => {
      second = control.ask('Two?');
    });
    await expect(first).resolves.toBe(false);
    act(() => renderer?.unmount());
    renderer = null;
    await expect(second).resolves.toBe(false);
  });
});
