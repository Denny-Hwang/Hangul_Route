import type { KeyCommand } from '../logic/lecture/keymap';

/**
 * Native stub of the presenter platform layer (F-TCH-004 section 3.1): the presenter is a root of
 * the learner web build only, so a native build never presents and has no address to read a deck
 * from. Every call is a no-op with the web variant's surface
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

/** The presenter's history steps (owner report 2026-10-16 item 3); web only. */
export type PresenterStep = 'home' | 'start' | 'lesson';

export interface StepEntry {
  step: PresenterStep;
  depth: number;
}

export function currentPresenterStep(): StepEntry {
  return { step: 'home', depth: 0 };
}

export function enterPresenterStep(_step: 'start' | 'lesson', _raw: string | null, _options: { fresh?: boolean } = {}): void {
  // No history on native.
}

export function returnToPresenterHome(): void {
  // No history on native.
}

export function subscribePresenterPop(_handler: (landed: StepEntry) => void): () => void {
  return () => undefined;
}

export function leavePresenter(): void {
  // A native build never presents.
}

/** The stale-presenter update check (AMENDMENTS-LECTURE-V2 section 4.5); web only. */
export async function checkForUpdate(): Promise<void> {}

/** The invalid-link Reload; web only. */
export async function reloadForUpdate(_raw: string): Promise<void> {}

export function reloadOnDeckLink(): () => void {
  return () => undefined;
}

export function subscribeKeys(_handler: (command: KeyCommand) => boolean | void): () => void {
  return () => undefined;
}

export function trapFocus(_items: () => readonly unknown[]): () => void {
  return () => undefined;
}

export function focusablesIn(_root: unknown): readonly unknown[] {
  return [];
}

export function rememberFocus(): () => void {
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

export async function enterFullscreenLandscape(): Promise<boolean> {
  return false;
}

export function unlockOrientation(): void {
  // Nothing locked.
}

export async function waitForPresenterFont(_timeoutMs: number, _family: string): Promise<boolean> {
  return false;
}

export function unlockChime(): void {
  // The timer chime is web only in the MVP.
}

export function playChime(_muted: boolean): boolean {
  return false;
}
