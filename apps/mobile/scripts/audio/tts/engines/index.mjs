// The engine registry: Polly and Google co-primary, Azure the fallback (AMENDMENTS-AUDIO-CLIPS AC-B1; row AC-3).
import { azure } from './azure.mjs';
import { google } from './google.mjs';
import { polly } from './polly.mjs';

export { GENERATIVE_REASON, VoiceRefused, billedChars } from './shared.mjs';

export const ENGINES = Object.freeze({ polly, google, azure });
export const ENGINE_IDS = Object.keys(ENGINES);

/** The engine for an id, or undefined. */
export function engineOf(id) {
  return Object.prototype.hasOwnProperty.call(ENGINES, id) ? ENGINES[id] : undefined;
}
