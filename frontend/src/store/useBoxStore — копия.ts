// src/store/useBoxStore.ts
import { create } from "zustand";

export type BoxSide = "front" | "back" | "left" | "right" | "top" | "bottom";
export type BoxType = "lidBottom" | "casket" | "drawer" | "hex";

const num = (v: any, fallback: number) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeHex = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  return m ? ("#" + m[1].toUpperCase()) : "#E8E8E8";
};

export type LogoData = {
  type: "image" | "text";
  content: string | null;
  file?: File | null;

  position: { x: number; y: number; z: number };
  scale: { x: number; z: number };
  rotation: number;    // рад, вокруг локальной Z
  opacity: number;     // 0..1
  flipH?: boolean;     // зеркало ⟷
  flipV?: boolean;     // зеркало ↕
  // размеры клише (мм) — используются для расчёта площади клише
  sizeMM?: { w: number; h: number };
};

type BoxStore = {
  // Габариты (мм)
  width: number;   // X (ширина)
  height: number;  // Y (высота)
  depth: number;   // Z (длина/глубина)

  // Цвета
  color: string;                 // общий цвет (совместимость)
  sideColors: [string, string, string, string, string, string]; // [front, back, left, right, lid, bottom]

  // Тип модели и выбранная грань
  boxType: BoxType;
  selectedSide: BoxSide;

  // Логотипы
  logos: Record<BoxSide, LogoData>;

  // Превью текущей сцены (скриншот Canvas)
  previewDataUrl?: string | null;

  // ===== actions =====
  // размеры
  setDimensions: (dims: Partial<Pick<BoxStore, "width" | "height" | "depth">>) => void;
  setWidth: (w: number | string) => void;
  setHeight: (h: number | string) => void;
  setDepth: (d: number | string) => void;
  updateDimension?: (key: "width" | "height" | "depth", value: number | string) => void;

  // цвета
  setColor: (hex: string) => void;                        // общий (если где-то в UI использовался)
  setBoxColor?: (hex: string) => void;                    // алиас
  setSideColor: (index: 0|1|2|3|4|5, hex: string) => void; // НУЖНО ДЛЯ SideColorPicker
   
  // прочее
  setBoxType: (t: BoxType) => void;
  setSelectedSide: (side: BoxSide) => void;

  setLogoForSide: (side: BoxSide, partial: Partial<LogoData>) => void;
  clearLogo: (side: BoxSide) => void;

  // клише/лого размеры
  setLogoSize?: (side: BoxSide, size: { w: number; h: number }) => void;

  // превью Canvas
  setPreviewDataUrl?: (dataUrl: string | null) => void;
};

// ---------- defaults ----------
const defaultLogo: LogoData = {
  type: "image",
  content: null,
  file: null,
  position: { x: 0, y: 0, z: 0 },
  scale: { x: 1, z: 1 },
  rotation: 0,
  opacity: 1,
  flipH: false,
  flipV: false,
  sizeMM: { w: 50, h: 50 }, // дефолт для клише
};

const makeDefaultLogos = (): Record<BoxSide, LogoData> => ({
  front:  { ...defaultLogo },
  back:   { ...defaultLogo },
  left:   { ...defaultLogo },
  right:  { ...defaultLogo },
  top:    { ...defaultLogo },
  bottom: { ...defaultLogo },
});

// ---------- store ----------
export const useBoxStore = create<BoxStore>((set, get) => ({
  // дефолты размеров
  width: 250,
  height: 80,
  depth: 160,

  // Цвета: общий и по сторонам (по умолчанию одинаковые светло-серые)
  color: "#E8E8E8",
  sideColors: ["#E8E8E8", "#E8E8E8", "#E8E8E8", "#E8E8E8", "#E8E8E8", "#E8E8E8"],
  insertColor: "#FFD966",
  boxType: "lidBottom",
  selectedSide: "front",

  logos: makeDefaultLogos(),

  previewDataUrl: null,

  // размеры
  setDimensions: (dims) =>
    set((s) => ({
      width:  dims.width  !== undefined ? num(dims.width,  s.width)  : s.width,
      height: dims.height !== undefined ? num(dims.height, s.height) : s.height,
      depth:  dims.depth  !== undefined ? num(dims.depth,  s.depth)  : s.depth,
    })),
  setWidth:  (w) => set((s) => ({ width:  num(w, s.width) })),
  setHeight: (h) => set((s) => ({ height: num(h, s.height) })),
  setDepth:  (d) => set((s) => ({ depth:  num(d, s.depth) })),
  updateDimension: (key, value) => set({ [key]: num(value, (get() as any)[key]) } as any),

  // цвета
  setColor: (hex) => set({ color: normalizeHex(hex) }),
  setBoxColor: (hex) => set({ color: normalizeHex(hex) }), // алиас (для совместимости)
  setSideColor: (index, hex) =>
    set((s) => {
      const next = s.sideColors.slice() as BoxStore["sideColors"]; // ИММУТАБЕЛЬНО
      next[index] = normalizeHex(hex);
      return { sideColors: next };
    }),
    setInsertColor: (hex) => set({ insertColor: normalizeHex(hex) }), // 🟨 вот эта строка — сюда!

  // модель/сторона
  setBoxType: (t) => set({ boxType: t }), // ВАЖНО: sideColors НЕ трогаем
  setSelectedSide: (side) => set({ selectedSide: side }),

  // логотипы
  setLogoForSide: (side, partial) =>
    set((s) => {
      const prev = s.logos[side] ?? { ...defaultLogo };
      const next: LogoData = {
        ...prev,
        ...partial,
        position: { ...prev.position, ...(partial.position ?? {}) },
        scale: { ...prev.scale, ...(partial.scale ?? {}) },
        sizeMM: { ...(prev.sizeMM ?? { w: 50, h: 50 }), ...(partial.sizeMM ?? {}) },
      };
      return { logos: { ...s.logos, [side]: next } };
    }),

  clearLogo: (side) =>
    set((s) => {
      const prev = s.logos[side] ?? { ...defaultLogo };
      const next: LogoData = {
        ...prev,
        type: "image",
        content: null,
        file: null,
        opacity: 1,
      };
      return { logos: { ...s.logos, [side]: next } };
    }),

  setLogoSize: (side, size) =>
    set((s) => {
      const prev = s.logos[side] ?? { ...defaultLogo };
      const next: LogoData = { ...prev, sizeMM: { w: Math.max(1, size.w), h: Math.max(1, size.h) } };
      return { logos: { ...s.logos, [side]: next } };
    }),

  setPreviewDataUrl: (dataUrl) => set({ previewDataUrl: dataUrl }),
}));
