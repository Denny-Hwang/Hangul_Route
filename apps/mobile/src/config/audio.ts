/**
 * Audio decisions that are constants, not feature flags (F-AUDIO-004 §3.10).
 *
 * `PLAY_IN_SILENT_MODE`: false means the device's silent switch is respected.
 * Owner decision 2026-10-10: a sudden sound in a quiet room (a classroom, a
 * service) is worse than silence, and the visible text prompt keeps every
 * round playable. One constant so a settings option can flip it later; the
 * native clip player (`playsInSilentModeIOS`, PR A-7) reads it.
 */
export const PLAY_IN_SILENT_MODE = false;
