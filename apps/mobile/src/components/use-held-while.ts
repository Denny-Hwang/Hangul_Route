import { useRef } from 'react';

/**
 * `value` as it was when `hold` turned on, for as long as `hold` stays on; the live value otherwise.
 * The trace games hold their sound status row while a finger is drawing (F-AUDIO-004 §3.8, the
 * compact `PromptPanel`): a late result (a speak the browser dropped, a voice list still loading)
 * would otherwise add or remove the row mid-stroke and move the canvas under the finger. The row
 * catches up when the stroke ends.
 */
export function useHeldWhile<T>(value: T, hold: boolean): T {
  const held = useRef(value);
  if (!hold) held.current = value;
  return hold ? held.current : value;
}
