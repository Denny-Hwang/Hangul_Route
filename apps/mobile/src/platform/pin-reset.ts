/**
 * [OA] Native stub of the sign-in PIN reset (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.5, row OA-6): the reset needs
 * the console in the same tab, so a native build never has a ticket and never shows Sign in to the account. The web
 * variant is `pin-reset.web.ts`.
 */
export function takePinResetTicket(): string | null {
  return null;
}

export async function openPinResetSignIn(): Promise<void> {
  throw new Error('The sign-in PIN reset is web only (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.5)');
}
