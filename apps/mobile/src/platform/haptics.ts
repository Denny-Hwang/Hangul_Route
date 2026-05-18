import * as Haptics from 'expo-haptics';

/**
 * Haptics wrapper — anti-startle calibrated for kids 5–11.
 * Heavy haptics never used on child failures.
 */

let enabled = true;

export function setHapticsEnabled(v: boolean): void {
  enabled = v;
}

export function tapLight(): void {
  if (!enabled) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function tapMedium(): void {
  if (!enabled) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function success(): void {
  if (!enabled) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function nudge(): void {
  if (!enabled) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
}
