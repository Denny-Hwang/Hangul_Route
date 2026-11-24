/**
 * Visually hidden, still read: a live line or a label only assistive tech needs. A neutral module of its own, so the
 * answer announcer (F-A11Y-001 §3.3) does not import the typing games' speech helpers (`korean-speech.ts` re-exports it).
 */
export const srOnly = { position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden' } as const;
