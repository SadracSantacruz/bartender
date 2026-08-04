import { create } from "zustand";

export type Screen =
  | "home"
  | "browse"
  | "review"
  | "mc"
  | "fullbuild"
  | "reverse"
  | "rapidfire"
  | "ticket"
  | "dashboard"
  | "import";

interface AppState {
  screen: Screen;
  navigate: (screen: Screen) => void;

  selectedDeckIds: string[];
  toggleDeck: (deckId: string) => void;
  setSelectedDeckIds: (ids: string[]) => void;

  tierFilter: number | "all";
  setTierFilter: (tier: number | "all") => void;

  categoryFilter: string | "all";
  setCategoryFilter: (category: string | "all") => void;
}

export const useAppStore = create<AppState>((set) => ({
  screen: "home",
  navigate: (screen) => set({ screen }),

  selectedDeckIds: [],
  toggleDeck: (deckId) =>
    set((s) => ({
      selectedDeckIds: s.selectedDeckIds.includes(deckId)
        ? s.selectedDeckIds.filter((id) => id !== deckId)
        : [...s.selectedDeckIds, deckId],
    })),
  setSelectedDeckIds: (ids) => set({ selectedDeckIds: ids }),

  tierFilter: "all",
  setTierFilter: (tier) => set({ tierFilter: tier }),

  categoryFilter: "all",
  setCategoryFilter: (category) => set({ categoryFilter: category }),
}));
