import type React from 'react';
import { Platform } from 'react-native';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { vi } from 'vitest';

/**
 * Helpers for the screen render tests (vitest.render.config.ts, F-BILL-002 B-13). Screens render
 * through react-native-web into react-test-renderer's host tree, so every node is a DOM-like host
 * element: text is in string children, `accessibilityLabel` is `aria-label`, `testID` is
 * `data-testid`, a link is an element with `href`.
 */

export type RenderPlatform = 'web' | 'ios' | 'android';

/**
 * Renders as the given platform: `Platform.OS` (what screens and the design system read) and
 * `EXPO_OS` (what `bundleOs()` reads, Expo's inlined bundle platform). Call `resetPlatform` after.
 */
export function setPlatform(os: RenderPlatform): void {
  (Platform as { OS: string }).OS = os;
  vi.stubEnv('EXPO_OS', os);
}

export function resetPlatform(): void {
  (Platform as { OS: string }).OS = 'web';
  vi.unstubAllEnvs();
}

/** Mounts an element and lets its mount effects (and the promises they start) settle. */
export async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(element);
  });
  return renderer;
}

export async function unmount(renderer: ReactTestRenderer): Promise<void> {
  await act(async () => {
    renderer.unmount();
  });
}

/** Every string the tree shows or reads out: text children, then the accessible names and hints. */
export function screenTexts(root: ReactTestInstance): string[] {
  const out: string[] = [];
  const walk = (node: ReactTestInstance | string): void => {
    if (typeof node === 'string') {
      if (node.trim() !== '') out.push(node);
      return;
    }
    if (typeof node.type === 'string') {
      for (const attr of ['aria-label', 'aria-description', 'title', 'placeholder'] as const) {
        const value: unknown = node.props[attr];
        if (typeof value === 'string' && value.trim() !== '') out.push(value);
      }
    }
    for (const child of node.children) walk(child);
  };
  walk(root);
  return out;
}

/** Host elements only (react-native-web's DOM-like nodes), never the composite components above them. */
export function hostNodes(root: ReactTestInstance, match: (node: ReactTestInstance) => boolean): ReactTestInstance[] {
  return root.findAll((node) => typeof node.type === 'string' && match(node));
}

export function byTestId(root: ReactTestInstance, id: string): ReactTestInstance[] {
  return hostNodes(root, (node) => node.props['data-testid'] === id);
}

/** The text a host node shows, joined. */
export function textOf(node: ReactTestInstance): string {
  return screenTexts(node).filter((t) => t !== node.props['aria-label']).join(' ');
}

/** Host buttons whose visible text or accessible name is `label`. */
export function buttonsNamed(root: ReactTestInstance, label: string): ReactTestInstance[] {
  return hostNodes(root, (node) => node.props.role === 'button' && (node.props['aria-label'] === label || screenTexts(node).includes(label)));
}

/** A tap, as react-native-web's press responder receives a click. */
export async function press(node: ReactTestInstance): Promise<void> {
  const onClick = node.props.onClick as ((event: unknown) => void) | undefined;
  if (onClick === undefined) throw new Error('not pressable');
  const event = { altKey: false, currentTarget: {}, nativeEvent: {}, preventDefault: () => undefined, stopPropagation: () => undefined };
  await act(async () => {
    onClick(event);
  });
}
