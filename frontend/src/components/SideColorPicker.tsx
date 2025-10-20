// src/components/SideColorPicker.tsx
import React, { useMemo, useState, useEffect } from "react";
import { useBoxStore } from "../store/useBoxStore";

/* ==== UI tokens ==== */
const card = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 12,
  marginTop: 10,
  background: "#fff",
} as const;

/** Шапка: «Цвет» + Крышка/Дно слева (прижаты вместе), без пипетки */
const header = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start", // ← ближе к левому краю
  gap: 10,                       // ← расстояние между «Цвет» и «Крышка/Дно»
  marginBottom: 10,
  flexWrap: "wrap",
} as const;

const segments = {
  display: "inline-flex",
  border: "1px solid #ddd",
  borderRadius: 12,
  overflow: "hidden",
  flexShrink: 0,
} as const;
const segBtn = (active: boolean) =>
  ({
    padding: "8px 14px",
    fontSize: 12,
    minWidth: 70,
    cursor: "pointer",
    background: active ? "#111" : "#fff",
    color: active ? "#fff" : "#333",
    border: "none",
    flexShrink: 0,
  }) as const;

const layout = {
  display: "flex",
  gap: 14,
  alignItems: "flex-start",
  flexWrap: "wrap",
} as const;

/* Палитра 3×7 = 21 цвет */
const paletteCol = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 24px)",
  gap: 6,
  flexShrink: 0,
} as const;
const swatch = (c: string, active: boolean) =>
  ({
    width: 24,
    height: 20,
    borderRadius: 6,
    border: active ? "2px solid #222" : "1px solid #ccc",
    background: c,
    cursor: "pointer",
  }) as const;

/* Колонка управления: HEX + CMYK */
const controlsCol = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  alignItems: "flex-start",
  flexGrow: 1,
  minWidth: 160,
} as const;

/* Ряд HEX + пипетка — одна линия, переносится при нехватке места */
const hexRow = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",   // при узком экране перенос вниз, ничего не вылезает
  width: "100%",
  minWidth: 0,
} as const;

/* HEX поле — немного уже и может ужиматься */
const hexInput = {
  padding: "6px 8px",
  border: "1px solid #ddd",
  borderRadius: 8,
  fontSize: 13,
  flex: "0 1 96px",   // базово 96px, можно ужаться
  minWidth: 72,       // но не меньше 72px
  maxWidth: 140,      // и не распирается слишком
  boxSizing: "border-box" as const,
} as const;

/* Единственная пипетка — фиксированный размер, не вылезает справа */
const colorBtn = {
  width: 34,
  height: 28,
  border: "1px solid #ddd",
  borderRadius: 8,
  background: "#fff",
  cursor: "pointer",
  flexShrink: 0,      // не сжимать — чтобы всегда помещалась
  boxSizing: "border-box" as const,
} as const;

/* CMYK */
const cmykRow = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  flexWrap: "wrap",
} as const;
const cmykLabel = { width: 22, color: "#666", flexShrink: 0 } as const;
const cmykInput = {
  padding: "6px 8px",
  border: "1px solid #ddd",
  borderRadius: 8,
  fontSize: 13,
  width: 70,
  boxSizing: "border-box" as const,
} as const;

/* ==== палитра 21 цвет ==== */
const PRESETS = [
  "#FFFFFF", "#F7F7F7", "#EDEDED",
  "#CFCFCF", "#A0A0A0", "#000000",
  "#F6E58D", "#FFBE76", "#FF7979",
  "#BADC58", "#7ED6DF", "#686DE0",
  "#E056FD", "#22A6B3", "#DFF9FB",
  "#F9CA24", "#E67E22", "#EB4D4B",
  "#6AB04A", "#130F40", "#3498DB",
];

/* ==== utils ==== */
function normHex(v: string) {
  let s = (v || "").trim().toUpperCase();
  if (!s.startsWith("#")) s = "#" + s;
  return s.slice(0, 7);
}
function isFullHex(v: string) {
  return /^#[0-9A-F]{6}$/.test(v);
}
function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase()
  );
}
function rgbToCmyk(r: number, g: number, b: number) {
  const R = r / 255, G = g / 255, B = b / 255;
  const K = 1 - Math.max(R, G, B);
  if (K >= 0.999) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - R - K) / (1 - K)) * 100),
    m: Math.round(((1 - G - K) / (1 - K)) * 100),
    y: Math.round(((1 - B - K) / (1 - K)) * 100),
    k: Math.round(K * 100),
  };
}
function cmykToRgb(c: number, m: number, y: number, k: number) {
  const C = c / 100, M = m / 100, Y = y / 100, K = k / 100;
  return {
    r: Math.round(255 * (1 - C) * (1 - K)),
    g: Math.round(255 * (1 - M) * (1 - K)),
    b: Math.round(255 * (1 - Y) * (1 - K)),
  };
}

/* ==== zustand ==== */
function useColorsStore() {
  return useBoxStore((s: any) => ({
    sideColors: s.sideColors,
    setSideColor: s.setSideColor,
    setSideColors: s.setSideColors,
    _set: s.set,
  }));
}

/* ==== component ==== */
export default function SideColorPicker() {
  const [activeIndex, setActiveIndex] = useState<4 | 5>(4); // 4=крышка, 5=дно
  const { sideColors, setSideColor, setSideColors, _set } = useColorsStore();

  const currentHex = useMemo(() => {
    const raw = sideColors?.[activeIndex];
    return isFullHex(normHex(raw || ""))
      ? normHex(raw || "")
      : activeIndex === 4
      ? "#FFFFFF"
      : "#E8E8E8";
  }, [sideColors, activeIndex]);

  const [cmyk, setCmyk] = useState(
    rgbToCmyk(...Object.values(hexToRgb("#FFFFFF")))
  );
  useEffect(() => {
    const { r, g, b } = hexToRgb(currentHex);
    setCmyk(rgbToCmyk(r, g, b));
  }, [currentHex]);

  const applyHex = (hex: string) => {
    if (!isFullHex(hex)) return;
    if (setSideColor) setSideColor(activeIndex, hex);
    else if (setSideColors) {
      const next = [...(sideColors || [])];
      next[activeIndex] = hex;
      setSideColors(next);
    } else if (_set) {
      _set((st: any) => {
        const next = [...(st.sideColors || [])];
        next[activeIndex] = hex;
        return { sideColors: next };
      });
    }
  };

  const applyCMYK = (next: Partial<{ c: number; m: number; y: number; k: number }>) => {
    const n = { ...cmyk, ...next };
    setCmyk(n);
    const { r, g, b } = cmykToRgb(n.c, n.m, n.y, n.k);
    applyHex(rgbToHex(r, g, b));
  };

  return (
    <div style={card}>
      {/* Шапка: «Цвет» + Крышка/Дно слева */}
      <div style={header}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Цвет</div>
        <div style={segments}>
          <button onClick={() => setActiveIndex(4)} style={segBtn(activeIndex === 4)}>
            Крышка
          </button>
          <button onClick={() => setActiveIndex(5)} style={segBtn(activeIndex === 5)}>
            Дно
          </button>
        </div>
      </div>

      <div style={layout}>
        {/* Палитра 3×7 = 21 цвет */}
        <div style={paletteCol}>
          {PRESETS.map((p) => (
            <div
              key={p}
              style={swatch(p, p === currentHex)}
              onClick={() => applyHex(p)}
              title={p}
            />
          ))}
        </div>

        {/* Управление: HEX + ОДНА пипетка справа от него */}
        <div style={controlsCol}>
          <div style={hexRow}>
            <input
              value={currentHex}
              onChange={(e) => {
                const v = normHex(e.target.value);
                if (isFullHex(v)) applyHex(v);
              }}
              style={hexInput}
            />
            <input
              type="color"
              value={currentHex}
              onChange={(e) => applyHex(normHex(e.target.value))}
              style={colorBtn}
              title="Пипетка"
            />
          </div>

          {(["c", "m", "y", "k"] as const).map((k) => (
            <div key={k} style={cmykRow}>
              <label style={cmykLabel}>{k.toUpperCase()}</label>
              <input
                type="number"
                min={0}
                max={100}
                value={(cmyk as any)[k]}
                onChange={(e) => {
                  const val = Math.max(
                    0,
                    Math.min(100, Math.round(Number(e.target.value || 0)))
                  );
                  applyCMYK({ [k]: val } as any);
                }}
                style={cmykInput}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
