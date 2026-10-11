import { create } from 'zustand';

interface State {
  hapticsOn: boolean;
  parentGateOpenedAt: number | null;
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
  setTabBarHeight: (height: number) => void;
}

export const useUiStore = create<State & Actions>((set, get) => ({
  hapticsOn: true,
  parentGateOpenedAt: null,
  tabBarHeight: 0,

  toggleHaptics: () => set({ hapticsOn: !get().hapticsOn }),
  openParentGate: () => set({ parentGateOpenedAt: Date.now() }),
  resetParentGate: () => set({ parentGateOpenedAt: null }),
  setTabBarHeight: (tabBarHeight) => set({ tabBarHeight }),
}));
