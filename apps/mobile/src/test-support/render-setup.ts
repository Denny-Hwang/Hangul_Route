import React from 'react';
import { AppState } from 'react-native';
import { afterEach, vi } from 'vitest';
import { cleanup } from './render';

/**
 * Setup for the screen render tests (vitest.render.config.ts, F-BILL-002 B-13). `react-native`
 * resolves to react-native-web there; the native-only libraries below have no web build that loads
 * in Node, so each gets a still stand-in: insets of zero, animations that land at once, and SVG
 * shapes as plain host elements.
 */

vi.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaInsetsContext: React.createContext(insets),
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    useSafeAreaInsets: () => insets,
  };
});

vi.mock('react-native-reanimated', async () => {
  const { Image, ScrollView, Text, View } = await import('react-native');
  const easing = (): ((t: number) => number) => (t: number) => t;
  const Easing = new Proxy({}, { get: () => easing });
  const Animated = { View, Text, Image, ScrollView };
  return {
    default: Animated,
    ...Animated,
    Easing,
    cancelAnimation: () => undefined,
    interpolate: (_v: number, _input: number[], output: number[]) => output[0],
    runOnJS: <F,>(fn: F) => fn,
    useAnimatedStyle: (fn: () => object) => fn(),
    useReducedMotion: () => true,
    useSharedValue: <T,>(value: T) => ({ value }),
    withDelay: <T,>(_ms: number, value: T) => value,
    withRepeat: <T,>(value: T) => value,
    withSequence: <T,>(...values: T[]) => values[values.length - 1],
    withSpring: <T,>(value: T) => value,
    withTiming: <T,>(value: T) => value,
  };
});

vi.mock('react-native-svg', () => {
  const shape =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(`svg-${name}`, props, children);
  const names = ['Circle', 'ClipPath', 'Defs', 'Ellipse', 'G', 'Line', 'LinearGradient', 'Path', 'Polygon', 'Polyline', 'Rect', 'Stop', 'Text'];
  return { default: shape('Svg'), Svg: shape('Svg'), ...Object.fromEntries(names.map((n) => [n, shape(n)])) };
});

vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en', regionCode: 'US' }],
}));

vi.mock('expo-network', () => ({
  getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }),
}));

vi.mock('@react-native-async-storage/async-storage', () => {
  const data = new Map<string, string>();
  const store = {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => void data.set(key, value),
    removeItem: async (key: string) => void data.delete(key),
    getAllKeys: async () => [...data.keys()],
    multiGet: async (keys: string[]) => keys.map((k) => [k, data.get(k) ?? null]),
    multiRemove: async (keys: string[]) => keys.forEach((k) => data.delete(k)),
    clear: async () => data.clear(),
  };
  return { default: store };
});

vi.mock('expo-speech', () => ({ speak: () => undefined, stop: async () => undefined, getAvailableVoicesAsync: async () => [] }));
vi.mock('expo-clipboard', () => ({ setStringAsync: async () => true }));
vi.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-4000-8000-000000000000',
  getRandomBytes: (n: number) => new Uint8Array(n),
  digestStringAsync: async () => '0'.repeat(64),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
}));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: async () => ({ canceled: true, assets: null }) }));
vi.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///documents/',
  readAsStringAsync: async () => '',
  writeAsStringAsync: async () => undefined,
  deleteAsync: async () => undefined,
  EncodingType: { UTF8: 'utf8' },
}));
vi.mock('expo-sharing', () => ({ isAvailableAsync: async () => false, shareAsync: async () => undefined }));
vi.mock('expo-haptics', () => ({
  impactAsync: async () => undefined,
  notificationAsync: async () => undefined,
  selectionAsync: async () => undefined,
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
vi.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ downloadAsync: async () => undefined, localUri: null, uri: '' }) } }));
vi.mock('expo-av', () => ({
  Audio: { setAudioModeAsync: async () => undefined, Sound: { createAsync: async () => ({ sound: {} }) } },
  InterruptionModeAndroid: { DoNotMix: 1, DuckOthers: 2 },
  InterruptionModeIOS: { DoNotMix: 1, DuckOthers: 2, MixWithOthers: 0 },
}));
vi.mock('react-native-view-shot', () => ({ captureRef: async () => '' }));

// No request leaves a render test: a screen that syncs or refreshes on mount sees an offline device.
globalThis.fetch = (async () => {
  throw new TypeError('fetch is not available in the screen render tests');
}) as typeof fetch;

// react-native-web's AppState listens to `document` and hands back no subscription without one (Node);
// a device always returns one, so the stand-in does too.
if (!AppState.isAvailable) {
  AppState.addEventListener = (() => ({ remove: () => undefined })) as unknown as typeof AppState.addEventListener;
}

// A test that fails before its own unmount leaves its screen mounted; unmount it before the next test.
afterEach(async () => {
  await cleanup();
});
