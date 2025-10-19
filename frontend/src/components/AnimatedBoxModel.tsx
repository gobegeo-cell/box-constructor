import { create } from "zustand";

export type BoxType = "casket" | "lidBottom"; 
// casket = шкатулка (крышка на петле)
// lidBottom = крышка-дно (снимаемая крышка)

type BoxAnimState = {
  boxType: BoxType;
  lidOpen: boolean;
  setBoxType: (t: BoxType) => void;
  openLid: () => void;
  closeLid: () => void;
  toggleLid: () => void;
};

export const useBoxAnim = create<BoxAnimState>((set) => ({
  boxType: "casket",
  lidOpen: false,

  setBoxType: (t) => set({ boxType: t, lidOpen: false }), // при смене типа закрываем крышку
  openLid: () => set({ lidOpen: true }),
  closeLid: () => set({ lidOpen: false }),
  toggleLid: () => set((s) => ({ lidOpen: !s.lidOpen })),
}));
