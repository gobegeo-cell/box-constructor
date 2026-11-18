import type { BoxType } from "../store/useBoxStore";

export type Opt = { id: BoxType; label: string };

export const STANDARD: Opt[] = [
  { id: "lidBottom", label: "Крышка-дно" },
  { id: "casket",    label: "Шкатулка" },
  { id: "drawer",    label: "Пенал" },
  { id: "hex",       label: "Футляр" },
];

export const NON_STANDARD: Opt[] = [
  { id: "bookBox",            label: "Коробка-книга" },
  { id: "casketSlider",       label: "Шкатулка слайдер" },
  { id: "casketCounterFlap",  label: "Шкат. вст. клапан" },
  { id: "lidBottomLongFlap",  label: "Крышка удл. клапан" },

  { id: "hexBox",     label: "V крышка" },
  { id: "vCutHex",    label: "V-образная крышка" },
  { id: "tierCasket", label: "ярусная коробка" },
  { id: "angledHex",  label: "Угловая коробка" },
];

const labels = new Map<string, string>([...STANDARD, ...NON_STANDARD].map(({ id, label }) => [id, label]));

export function boxTypeLabel(id: string) {
  if (id === "case" || id === "futlyar") return "Футляр";
  return labels.get(id) ?? (id || "Коробка");
}
