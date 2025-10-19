// src/components/SideColorPicker.tsx
import React, { useMemo, useState, useEffect } from "react";
import { useBoxStore } from "../store/useBoxStore";

/* ==== UI tokens ==== */
const card = { border: "1px solid #eee", borderRadius: 12, padding: 12, marginTop: 10, background: "#fff" } as const;
const header = { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 } as const;
const segments = { display: "inline-flex", border: "1px solid #ddd", borderRadius: 12, overflow: "hidden" } as const;
const segBtn = (active: boolean) => ({
  padding: "10px 16px",                // больше кнопки
  fontSize: 15,                        // крупнее шрифт
  minWidth: 110,                       // шире зона клика
  cursor: "pointer",
  background: active ? "#111" : "#fff",
  color: active ? "#fff" : "#333",
  border: "none",
}) as const;

const layout = { display: "flex", gap: 14, alignItems: "start" } as const;

// компактная палитра: 3 столбца, без скролла по горизонтали
const paletteCol = { display: "grid", gridTemplateColumns: "repeat(3, 24px)", gap: 6 } as const;
const swatch = (c: string, active: boolean) => ({
  width: 24, height: 20,
  borderRadius: 6,
  border: active ? "2px solid #222" : "1px solid #ccc",
  background: c,
  cursor: "pointer",
}) as const;

const controlsCol = { display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" } as const;
const input = { padding: "6px 8px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, width: 80 } as const;
const colorBtn = { width: 36, height: 28, border: "1px solid #ddd", borderRadius: 8, background: "#fff", cursor: "pointer" } as const;
const chip = (c: string) => ({ width: 28, height: 20, borderRadius: 6, border: "1px solid #cfcfcf", background: c }) as const;

/* ==== палитра 21 цвет (3×7) ==== */
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
function normHex(v: string) { let s = (v || "").trim().toUpperCase(); if (!s.startsWith("#")) s = "#" + s; return s.slice(0, 7); }
function isFullHex(v: string) { return /^#[0-9A-F]{6}$/.test(v); }
function hexToRgb(hex: string) { const n = parseInt(hex.replace("#", ""), 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }
function rgbToHex(r: number, g: number, b: number) { return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase(); }
function rgbToCmyk(r: number, g: number, b: number) {
  const R = r / 255, G = g / 255, B = b / 255; const K = 1 - Math.max(R, G, B);
  if (K >= 0.999) return { c: 0, m: 0, y: 0, k: 100 };
  return { c: Math.round((1 - R - K) / (1 - K) * 100), m: Math.round((1 - G - K) / (1 - K) * 100), y: Math.round((1 - B - K) / (1 - K) * 100), k: Math.round(K * 100) };
}
function cmykToRgb(c: number, m: number, y: number, k: number) {
  const C = c / 100, M = m / 100, Y = y / 100, K = k / 100;
  return { r: Math.round(255 * (1 - C) * (1 - K)), g: Math.round(255 * (1 - M) * (1 - K)), b: Math.round(255 * (1 - Y) * (1 - K)) };
}

/* ==== zustand ==== */
function useColorsStore() {
  return useBoxStore((s: any) => ({
    sideColors: s.sideColors, setSideColor: s.setSideColor, setSideColors: s.setSideColors, _set: s.set,
  }));
}

/* ==== component ==== */
export default function SideColorPicker() {
  const [activeIndex, setActiveIndex] = useState<4 | 5>(4); // 4=крышка, 5=дно
  const { sideColors, setSideColor, setSideColors, _set } = useColorsStore();

  const currentHex = useMemo(() => {
    const raw = sideColors?.[activeIndex]; return isFullHex(normHex(raw || "")) ? normHex(raw || "") : (activeIndex === 4 ? "#FFFFFF" : "#E8E8E8");
  }, [sideColors, activeIndex]);

  const [cmyk, setCmyk] = useState(rgbToCmyk(...Object.values(hexToRgb("#FFFFFF"))));
  useEffect(() => { const { r, g, b } = hexToRgb(currentHex); setCmyk(rgbToCmyk(r, g, b)); }, [currentHex]);

  const applyHex = (hex: string) => {
    if (!isFullHex(hex)) return;
    if (setSideColor) setSideColor(activeIndex, hex);
    else if (setSideColors) { const next = [...(sideColors || [])]; next[activeIndex] = hex; setSideColors(next); }
    else if (_set) _set((st: any) => { const next = [...(st.sideColors || [])]; next[activeIndex] = hex; return { sideColors: next }; });
  };

  const applyCMYK = (next: Partial<{ c: number; m: number; y: number; k: number }>) => {
    const n = { ...cmyk, ...next }; setCmyk(n);
    const { r, g, b } = cmykToRgb(n.c, n.m, n.y, n.k); applyHex(rgbToHex(r, g, b));
  };

  return (
    <div style={card}>
      <div style={header}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Цвет</div>
        <div style={segments}>
          <button onClick={() => setActiveIndex(4)} style={segBtn(activeIndex === 4)}>Крышка</button>
          <button onClick={() => setActiveIndex(5)} style={segBtn(activeIndex === 5)}>Дно</button>
        </div>
      </div>

      <div style={layout}>
        {/* Палитра 3×7 = 21 цвет */}
        <div style={paletteCol}>
          {PRESETS.map((p) => (
            <div key={p} style={swatch(p, p === currentHex)} onClick={() => applyHex(p)} title={p} />
          ))}
        </div>

        {/* Управление для активной стороны: HEX + пипетка + CMYK по вертикали */}
        <div style={controlsCol}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              value={currentHex}
              onChange={(e) => { const v = normHex(e.target.value); if (isFullHex(v)) applyHex(v); }}
              style={{ ...input, width: 96 }}
            />
            <span style={chip(currentHex)} />
            <input type="color" value={currentHex} onChange={(e) => applyHex(normHex(e.target.value))} style={colorBtn} title="Пипетка" />
          </div>

          {(["c","m","y","k"] as const).map(k => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ width: 22, color: "#666" }}>{k.toUpperCase()}</label>
              <input
                type="number" min={0} max={100}
                value={(cmyk as any)[k]}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(100, Math.round(Number(e.target.value || 0))));
                  applyCMYK({ [k]: val } as any);
                }}
                style={{ ...input, width: 70 }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
