import type { PwaEvent, PwaListener } from './pwa';

export type { PwaEvent, PwaListener };

/**
 * Web PWA lifecycle. The shell (scripts/pwa-postbuild.mjs) registers
 * `/sw.js` and dispatches DOM events `hr:offline-ready` / `hr:update-ready`;
 * this wrapper turns those plus online/offline into one listener.
 */
export function subscribePwa(listener: PwaListener): () => void {
  const w = globalThis as unknown as Window | undefined;
  if (!w || typeof w.addEventListener !== 'function') return () => {};
  const onReady = (): void => listener('offline-ready');
  const onUpdate = (): void => listener('update-ready');
  const onOffline = (): void => listener('went-offline');
  const onOnline = (): void => listener('back-online');
  w.addEventListener('hr:offline-ready', onReady);
  w.addEventListener('hr:update-ready', onUpdate);
  w.addEventListener('offline', onOffline);
  w.addEventListener('online', onOnline);
  return () => {
    w.removeEventListener('hr:offline-ready', onReady);
    w.removeEventListener('hr:update-ready', onUpdate);
    w.removeEventListener('offline', onOffline);
    w.removeEventListener('online', onOnline);
  };
}

export function isStandalone(): boolean {
  const w = globalThis as unknown as (Window & { navigator: Navigator & { standalone?: boolean } }) | undefined;
  if (!w || typeof w.matchMedia !== 'function') return false;
  return w.matchMedia('(display-mode: standalone)').matches || w.navigator.standalone === true;
}

export function applyUpdate(): void {
  const w = globalThis as unknown as (Window & { __hrApplyUpdate?: () => void }) | undefined;
  w?.__hrApplyUpdate?.();
}

interface InstallPromptEvent {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type ShellWindow = Window & {
  __hrInstallPrompt?: InstallPromptEvent | null;
  navigator: Navigator & { standalone?: boolean };
};

function shell(): ShellWindow | null {
  const w = globalThis as unknown as ShellWindow | undefined;
  return w && typeof w.addEventListener === 'function' ? w : null;
}

export function installEnv(): { userAgent: string; standalone: boolean; hasPromptEvent: boolean; isWeb: boolean } {
  const w = shell();
  return {
    userAgent: w?.navigator?.userAgent ?? '',
    standalone: isStandalone(),
    hasPromptEvent: !!w?.__hrInstallPrompt,
    isWeb: true,
  };
}

export async function promptInstall(): Promise<boolean> {
  const w = shell();
  const ev = w?.__hrInstallPrompt;
  if (!w || !ev) return false;
  try {
    await ev.prompt();
    const choice = await ev.userChoice;
    w.__hrInstallPrompt = null;
    return choice.outcome === 'accepted';
  } catch {
    return false;
  }
}

export function isOfflineReady(): boolean {
  const w = shell();
  return !!w?.navigator?.serviceWorker?.controller;
}

export function appUrl(): string {
  const w = shell();
  return w?.location?.origin ?? '';
}

export async function copyText(text: string): Promise<boolean> {
  const w = shell();
  try {
    if (!w?.navigator?.clipboard?.writeText) return false;
    await w.navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
