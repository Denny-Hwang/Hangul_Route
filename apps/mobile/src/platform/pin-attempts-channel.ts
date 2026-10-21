/**
 * Native stub of `pin-attempts-channel.web.ts`: a native build has one app and no other tabs to tell, so a change of
 * the PIN attempt state is announced to nobody ([OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D19).
 */
export function announcePinAttempts(): void {
  // No other tab on native.
}

/** Native: no other tab ever changes the attempt state. Returns the unsubscribe. */
export function onPinAttemptsChanged(_listener: () => void): () => void {
  return () => undefined;
}
