import { create } from 'zustand';

/**
 * Quests whose "Start there?" sheet has already opened this session
 * (F-QUEST-002 §3.5: once per quest per session). In memory only; a new
 * session asks again, and nothing is ever locked either way.
 */
interface State {
  asked: string[];
}

interface Actions {
  markAsked: (questId: string) => void;
}

export const usePrereqSheetStore = create<State & Actions>((set) => ({
  asked: [],
  markAsked: (questId) =>
    set((s) => (s.asked.includes(questId) ? s : { asked: [...s.asked, questId] })),
}));
