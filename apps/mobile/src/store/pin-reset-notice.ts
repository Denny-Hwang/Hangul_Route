import { create } from 'zustand';

/**
 * [OA] The sign-in reset's refused ticket (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.5 step 5, row OA-6): the
 * `gate=pin-reset` boot intent raises it when the ticket is absent, too old, already read or for another PIN, and the
 * start screen shows "That took a while. Sign in again to set a new PIN." once (`PinResetExpiredNotice`). In memory
 * only: a reload never shows it again.
 */
interface PinResetNoticeState {
  expired: boolean;
  showExpired: () => void;
  /** The start screen took it. */
  takeExpired: () => void;
}

export const usePinResetNotice = create<PinResetNoticeState>((set) => ({
  expired: false,
  showExpired: () => set({ expired: true }),
  takeExpired: () => set({ expired: false }),
}));
