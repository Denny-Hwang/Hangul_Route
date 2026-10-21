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
   * Height of the bottom tab bar while it shows, else 0. Window-level overlays
   * (PwaBanners) sit above it (F-LAYOUT-001 §3.3, audit UX-26). Not persisted.
   */
  tabBarHeight: number;
}

interface Actions {
  toggleHaptics: () => void;
  openParentGate: () => void;
  resetParentGate: () => void;
  /** The PIN screen verified a correct PIN just now. */
  markPinVerified: () => void;
  setTabBarHeight: (height: number) => void;
}

export const useUiStore = create<State & Actions>((set, get) => ({
  hapticsOn: true,
  parentGateOpenedAt: null,
  lastPinVerifiedAt: null,
  tabBarHeight: 0,

  toggleHaptics: () => set({ hapticsOn: !get().hapticsOn }),
  openParentGate: () => set({ parentGateOpenedAt: Date.now() }),
  resetParentGate: () => set({ parentGateOpenedAt: null }),
  markPinVerified: () => set({ lastPinVerifiedAt: Date.now() }),
  setTabBarHeight: (tabBarHeight) => set({ tabBarHeight }),
}));
