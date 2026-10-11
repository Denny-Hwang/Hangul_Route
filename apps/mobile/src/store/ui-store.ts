import { create } from 'zustand';

interface State {
  hapticsOn: boolean;
  parentGateOpenedAt: number | null;
}

interface Actions {
  toggleHaptics: () => void;
  openParentGate: () => void;
  resetParentGate: () => void;
}

export const useUiStore = create<State & Actions>((set, get) => ({
  hapticsOn: true,
  parentGateOpenedAt: null,

  toggleHaptics: () => set({ hapticsOn: !get().hapticsOn }),
  openParentGate: () => set({ parentGateOpenedAt: Date.now() }),
  resetParentGate: () => set({ parentGateOpenedAt: null }),
}));
