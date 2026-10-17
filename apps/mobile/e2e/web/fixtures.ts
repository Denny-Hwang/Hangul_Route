import { expect, test as base } from '@playwright/test';

/**
 * Every web e2e spec takes `test` from here (guarded by
 * src/config/__tests__/e2e-speech-isolation.test.ts).
 *
 * Headless Chromium on a developer's Mac has the system's real Korean voices
 * and speaks through the speakers. A spec that reaches a minigame without
 * replacing `speechSynthesis` therefore reads the letters aloud on the
 * developer's machine, one prompt per quest step, for as long as the suite
 * runs. The auto fixture installs a silent engine before any page script
 * runs: it has no voices (like CI's Linux Chromium, so the app shows its text
 * prompt), speaks nothing and keeps what it was asked in `window.__silentSpeech`.
 * Like a real engine it answers every utterance (it starts and ends at once):
 * the first-gesture unlock counts only once the engine answers (F-AUDIO-004
 * section 3.6, 2026-10-17), and an engine that never answers is the iOS silent
 * drop, which `audio-engine.spec.ts` models on purpose.
 *
 * A spec that needs to hear utterances defines its own fake with
 * `Object.defineProperty(window, 'speechSynthesis', ...)` in its own init
 * script; that runs after this one and wins (the property is configurable).
 */
export const test = base.extend<{ silentSpeech: void }>({
  silentSpeech: [
    async ({ context }, use) => {
      await context.addInitScript(() => {
        const asked: string[] = [];
        (window as Window & { __silentSpeech?: string[] }).__silentSpeech = asked;
        class SilentUtterance {
          lang = '';
          rate = 1;
          pitch = 1;
          volume = 1;
          voice: unknown = null;
          onstart: (() => void) | null = null;
          onend: (() => void) | null = null;
          onerror: (() => void) | null = null;
          constructor(public text: string) {}
        }
        Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, writable: true, value: SilentUtterance });
        Object.defineProperty(window, 'speechSynthesis', {
          configurable: true,
          value: {
            speaking: false,
            pending: false,
            speak: (u: SilentUtterance) => {
              asked.push(u.text);
              setTimeout(() => {
                u.onstart?.();
                u.onend?.();
              }, 0);
            },
            cancel: () => undefined,
            getVoices: () => [],
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
          },
        });
      });
      await use();
    },
    { auto: true },
  ],
});

export { expect };
