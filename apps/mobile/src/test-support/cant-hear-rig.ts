import { createElement, Fragment, useEffect, useRef } from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { byTestId } from './render';

/**
 * Shared stand-ins for the render tests of "Can't hear it?" on a surface (AMENDMENTS-AUDIO-CANT-HEAR CH-1b): the screen
 * reader's focus and announcements as a log, `Modal` as a view that draws its children while visible and reports
 * `onDismiss` when it goes away (react-native-web's needs a document), and the focus nodes a ref should give. Each test
 * file wires them with `vi.mock` factories, so `vi.hoisted` state stays in the file:
 *
 *   vi.mock('../../../platform/screen-reader', async (orig) => (await import('../../../test-support/cant-hear-rig')).screenReaderStandIn(reader, await orig()));
 *   vi.mock('react-native', async (orig) => (await import('../../../test-support/cant-hear-rig')).reactNativeWithModal(await orig()));
 */
export interface ReaderLog {
  log: string[];
  announced: string[];
}

export const newReaderLog = (): ReaderLog => ({ log: [], announced: [] });

export const clearReaderLog = (reader: ReaderLog): void => {
  reader.log.length = 0;
  reader.announced.length = 0;
};

export function screenReaderStandIn<T extends object>(reader: ReaderLog, actual: T): T {
  return {
    ...actual,
    focusForScreenReader: (node: { testId?: string } | null) => {
      reader.log.push(`focus:${node?.testId ?? 'none'}`);
    },
    announceForScreenReader: (text: string) => {
      reader.announced.push(text);
      reader.log.push('announce');
    },
    announceAndWait: async () => {
      reader.log.push('wait');
    },
  };
}

export function reactNativeWithModal<T extends object>(actual: T): T {
  const Modal = ({ visible, children, onDismiss }: { visible?: boolean; children?: unknown; onDismiss?: () => void }) => {
    const was = useRef(false);
    useEffect(() => {
      if (was.current && !visible) onDismiss?.();
      was.current = visible === true;
    }, [visible, onDismiss]);
    return visible === true ? createElement(Fragment, null, children as never) : null;
  };
  return { ...actual, Modal };
}

/** `createNodeMock` for a test: the listed test ids become nodes `focusForScreenReader` can name (refs are null otherwise). */
export function focusNodes(ids: readonly string[]): (el: { props?: Record<string, unknown> }) => object | null {
  const known = new Set(['cant-hear', 'cant-hear-sheet-title', ...ids]);
  return (el) => {
    const testId = el.props?.['data-testid'];
    return typeof testId === 'string' && known.has(testId)
      ? { testId, focus: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined, setAttribute: () => undefined, removeAttribute: () => undefined }
      : null;
  };
}

export const pressableById = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};

export const hasId = (root: ReactTestInstance, id: string): boolean => byTestId(root, id).length > 0;
