import { LECTURE_CONSOLE_ORIGINS, type LectureDeck } from '@hangul-route/content-schema';
import type { KeyCommand } from '../logic/lecture/keymap';

/**
 * Native stub of the presenter platform layer (F-TCH-004 section 3.1): the presenter is a root of
 * the learner web build only, so a native build never presents, has no address to read a deck
 * from and no opener to hand names over. Every call is a no-op with the web variant's surface
 * (`presenter.web.ts`).
 */

export const PRESENTER_PATH = '/present';

export function isPresenterRoute(_location: { pathname: string }): boolean {
  return false;
}

export interface DeckAddress {
  raw: string;
  reloaded: boolean;
  fresh?: true;
}

export function takeDeckFragment(): DeckAddress | null {
  return null;
}

export function setPresenterDocTitle(_title: string): void {
  // No document on native.
}

export function forgetOpenDeck(): void {
  // No history on native.
}

export function holdOpenDeck(_raw: string, _options: { fresh?: boolean } = {}): void {
  // No history on native.
}

export function reloadOnDeckLink(): () => void {
  return () => undefined;
}

export function presenterConsoleOrigins(_extraCsv?: string): readonly string[] {
  return [...LECTURE_CONSOLE_ORIGINS];
}

export function hasOpener(): boolean {
  return false;
}

export function announceReady(_deck: Pick<LectureDeck, 'id' | 'picker'>): number {
  return 0;
}

export function listenForRoster(_deck: Pick<LectureDeck, 'id' | 'picker'>, _onRoster?: () => void): () => void {
  return () => undefined;
}

export function subscribeKeys(_handler: (command: KeyCommand) => void): () => void {
  return () => undefined;
}

export function trapFocus(_items: () => readonly unknown[]): () => void {
  return () => undefined;
}

export function subscribeActivity(_handler: () => void): () => void {
  return () => undefined;
}

export function fullscreenSupported(): boolean {
  return false;
}

export function isFullscreen(): boolean {
  return false;
}

export async function enterFullscreen(): Promise<boolean> {
  return false;
}

export async function exitFullscreen(): Promise<void> {
  // Native apps are full screen already.
}

export function subscribeFullscreen(_handler: () => void): () => void {
  return () => undefined;
}

export function wakeLockSupported(): boolean {
  return false;
}

export async function keepScreenAwake(): Promise<void> {
  // Not on native in the MVP.
}

export async function releaseScreenAwake(): Promise<void> {
  // Nothing held.
}

export async function lockLandscape(): Promise<void> {
  // Native orientation follows the app config.
}

export function unlockOrientation(): void {
  // Nothing locked.
}

export async function waitForPresenterFont(_timeoutMs: number, _family: string): Promise<boolean> {
  return false;
}
