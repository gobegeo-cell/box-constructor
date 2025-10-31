import { create } from "zustand";

export type BoxType = "casket" | "lidBottom";

type AnimState = {
  boxType: BoxType;
  lidOpen: boolean;
  setBoxType: (t: BoxType) => void;
  openLid: () => void;
  closeLid: () => void;
  toggleLid: () => void;
};

export const useAnim = create<AnimState>((set) => ({
  boxType: "casket",
  lidOpen: false,
  setBoxType: (t) => set({ boxType: t, lidOpen: false }),
  openLid: () => set({ lidOpen: true }),
  closeLid: () => set({ lidOpen: false }),
  toggleLid: () => set((s) => ({ lidOpen: !s.lidOpen })),
}));
