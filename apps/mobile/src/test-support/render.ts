import type React from 'react';
import { Platform } from 'react-native';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer, type TestRendererOptions } from 'react-test-renderer';
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

/** Every renderer still mounted, so `cleanup` can unmount the ones a failed test left behind. */
const mounted = new Set<ReactTestRenderer>();

/**
 * Mounts an element and lets its mount effects (and the promises they start) settle. `options` go to
 * the renderer as they are (a `createNodeMock` for a tree that measures its own nodes).
 */
export async function render(element: React.ReactElement, options?: TestRendererOptions): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(element, options);
  });
  mounted.add(renderer);
  return renderer;
}

export async function unmount(renderer: ReactTestRenderer): Promise<void> {
  if (!mounted.delete(renderer)) return;
  await act(async () => {
    renderer.unmount();
  });
}

/**
 * Unmounts every renderer still mounted. render-setup.ts runs it after each test, so a test that
 * fails before its own `unmount` leaves no screen whose effects and store subscriptions run on.
 */
export async function cleanup(): Promise<void> {
  for (const renderer of [...mounted]) await unmount(renderer);
}

/** Host attributes that carry words: the accessible name and description, a tooltip, a placeholder. */
const HOST_TEXT_PROPS = ['aria-label', 'aria-description', 'title', 'placeholder'] as const;

/**
 * React Native props that carry words a screen reader says. react-native-web drops
 * `accessibilityHint` (it reaches no host element), yet VoiceOver and TalkBack read it on iOS and
 * Android, so these are read from the components that receive them.
 */
const NATIVE_TEXT_PROPS = ['accessibilityLabel', 'accessibilityHint'] as const;

/**
 * Every string the tree shows or reads out: text children, the accessible names and hints on host
 * elements, and the React Native accessibility label, hint and value text on the components above
 * them (each string once per node that carries it).
 */
export function screenTexts(root: ReactTestInstance): string[] {
  const out: string[] = [];
  const push = (value: unknown): void => {
    if (typeof value === 'string' && value.trim() !== '') out.push(value);
  };
  const walk = (node: ReactTestInstance | string): void => {
    if (typeof node === 'string') {
      push(node);
      return;
    }
    if (typeof node.type === 'string') {
      for (const attr of HOST_TEXT_PROPS) push(node.props[attr]);
    } else {
      for (const prop of NATIVE_TEXT_PROPS) push(node.props[prop]);
      const value: unknown = node.props.accessibilityValue;
      if (typeof value === 'object' && value !== null) push((value as { text?: unknown }).text);
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
  // The press responder reads the element's role and tag (a disabled control ignores the click).
  const currentTarget = { getAttribute: (name: string): unknown => node.props[name] ?? null, tagName: String(node.type) };
  const event = { altKey: false, currentTarget, nativeEvent: {}, preventDefault: () => undefined, stopPropagation: () => undefined };
  await act(async () => {
    onClick(event);
  });
}
