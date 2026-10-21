import { create } from 'zustand';

/**
 * [OA] The sign-in reset's refused ticket (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.5 step 5, row OA-6): the
 * `gate=pin-reset` boot intent raises it when the ticket is absent, too old, already read or for another PIN, and the
 * start screen shows "That took a while. Sign in again to set a new PIN." once (`PinResetExpiredNotice`). In memory
 * only: a reload never shows it again.
 *
 * The line belongs to the boot that refused the ticket: it is good for `PIN_RESET_NOTICE_MS` after it was raised, so a
 * boot that starts somewhere else (Welcome, onboarding, a profile picker) never shows it later, out of context, the
 * first time Home renders in that session. Whoever looks first takes it, shown or not.
 */
export const PIN_RESET_NOTICE_MS = 15_000;

interface PinResetNoticeState {
  /** When the boot intent raised the line (wall clock), or null. */
  expiredAt: number | null;
  showExpired: (now?: number) => void;
  /** The start screen took it. */
  takeExpired: () => void;
}

export const usePinResetNotice = create<PinResetNoticeState>((set) => ({
  expiredAt: null,
  showExpired: (now = Date.now()) => set({ expiredAt: now }),
  takeExpired: () => set({ expiredAt: null }),
}));

/** Whether a line raised at `expiredAt` may still be shown at `now` (the boot that raised it, not a later visit). */
export function expiredNoticeLive(expiredAt: number | null, now: number): boolean {
  if (expiredAt === null) return false;
  const age = now - expiredAt;
  return age >= 0 && age < PIN_RESET_NOTICE_MS;
}
