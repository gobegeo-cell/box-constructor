// src/components/SideSelector.tsx
import React from "react";
import { useBoxStore } from "../store/useBoxStore";

type BoxSide = "front" | "back" | "left" | "right" | "top" | "bottom";

const sides: { key: BoxSide; label: string }[] = [
  { key: "top",    label: "Крышка" },
  { key: "bottom", label: "Дно" },
  { key: "front",  label: "Передняя" },
  { key: "back",   label: "Задняя" },
  { key: "left",   label: "Левая" },
  { key: "right",  label: "Правая" },
];

export default function SideSelector() {
  const selectedSide = useBoxStore(s => s.selectedSide);
  const setSelected  = useBoxStore(s => s.setSelectedSide);

  return (
    <div style={box}>
      <div style={title}>Сторона логотипа</div>
      <div style={grid}>
        {sides.map(s => (
          <button
            key={s.key}
            onClick={() => setSelected(s.key)}
            style={{ ...btn, ...(selectedSide === s.key ? btnActive : {}) }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const box:   React.CSSProperties = { borderWidth: 1, borderStyle: "solid", borderColor: "#eee", borderRadius: 8, padding: 12, marginBottom: 12 };
const title: React.CSSProperties = { fontWeight: 700, marginBottom: 8 };
const grid:  React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };

const btn: React.CSSProperties = {
  padding: "8px 10px",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ddd",
  borderRadius: 8,
  background: "#fff",
  cursor: "pointer"
};

const btnActive: React.CSSProperties = {
  borderColor: "#cc0000",
  boxShadow: "0 0 0 2px #cc000033"
};
