import { create } from 'zustand';

interface State {
  hapticsOn: boolean;
  parentGateOpenedAt: number | null;
  /**
   * When the PIN screen last accepted a correct PIN (epoch ms), in memory only. The grown-up
   * hand-off counts a PIN entered in the last 2 minutes (F-APP-001 section 3.9, OD-3); a gate the
   * 15-minute session opens directly never sets it.
   */
  lastPinVerifiedAt: number | null;
  /**
   * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.6 (row OA-9): when a PIN was last typed (not face or fingerprint),
   * in memory only. Setting or changing the PIN and turning face or fingerprint on need a typed PIN, so face or
   * fingerprint never leads to a new PIN or to a new opt-in.
   */
  lastPinTypedAt: number | null;
  /**
   * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS CS-1: the PIN screen is going back, gate open, to the screen whose action
   * asked for it (an Open link, Open billing, the level check's finish). The Grown-up area exit watcher takes it
   * at the next landing, so that one return keeps the session for the waiting action; any other landing on a
   * learner screen closes it. In memory only.
   */
  gateReturnPending: boolean;
  /**
   * Height of the bottom tab bar while it shows, else 0. Window-level overlays
   * (PwaBanners) sit above it (F-LAYOUT-001 §3.3, audit UX-26). Not persisted.
   */
  tabBarHeight: number;
}

interface Actions {
  toggleHaptics: () => void;
  openParentGate: () => void;
  resetParentGate: () => void;
  /** The PIN screen verified a correct PIN just now (`biometric`: face or fingerprint stood in for it). */
  markPinVerified: (via?: 'pin' | 'biometric') => void;
  /** [OA] The PIN screen goes back to the action that waited for it (CS-1). */
  markGateReturn: () => void;
  /** [OA] Reads and clears `gateReturnPending`. */
  takeGateReturn: () => boolean;
  setTabBarHeight: (height: number) => void;
}

export const useUiStore = create<State & Actions>((set, get) => ({
  hapticsOn: true,
  parentGateOpenedAt: null,
  lastPinVerifiedAt: null,
  lastPinTypedAt: null,
  gateReturnPending: false,
  tabBarHeight: 0,

  toggleHaptics: () => set({ hapticsOn: !get().hapticsOn }),
  openParentGate: () => set({ parentGateOpenedAt: Date.now() }),
  resetParentGate: () => set({ parentGateOpenedAt: null }),
  markPinVerified: (via = 'pin') => {
    const at = Date.now();
    set(via === 'pin' ? { lastPinVerifiedAt: at, lastPinTypedAt: at } : { lastPinVerifiedAt: at });
  },
  markGateReturn: () => set({ gateReturnPending: true }),
  takeGateReturn: () => {
    const pending = get().gateReturnPending;
    if (pending) set({ gateReturnPending: false });
    return pending;
  },
  setTabBarHeight: (tabBarHeight) => set({ tabBarHeight }),
}));
