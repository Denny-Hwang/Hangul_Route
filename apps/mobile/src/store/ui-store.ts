import { create } from 'zustand';

interface State {
  soundOn: boolean;
  hapticsOn: boolean;
  parentGateOpenedAt: number | null;
}

interface Actions {
  toggleSound: () => void;
  toggleHaptics: () => void;
  openParentGate: () => void;
  resetParentGate: () => void;
}

export const useUiStore = create<State & Actions>((set, get) => ({
  soundOn: true,
  hapticsOn: true,
  parentGateOpenedAt: null,

  toggleSound: () => set({ soundOn: !get().soundOn }),
  toggleHaptics: () => set({ hapticsOn: !get().hapticsOn }),
  openParentGate: () => set({ parentGateOpenedAt: Date.now() }),
  resetParentGate: () => set({ parentGateOpenedAt: null }),
}));
