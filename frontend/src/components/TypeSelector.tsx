// src/components/TypeSelector.tsx
import React from "react";
import { useBoxStore } from "../store/useBoxStore";

const OPTIONS = [
  { id: "lidBottom", label: "Крышка-дно" },
  { id: "casket",    label: "Шкатулка" },
  { id: "drawer",    label: "Пенал" },
  { id: "hex",       label: "футляр" },
] as const;

export default function TypeSelector() {
  const boxType    = useBoxStore(s => s.boxType);
  const setBoxType = useBoxStore(s => s.setBoxType);

  return (
    <div style={card}>
      <div style={title}>Тип коробки</div>
      <div style={grid}>
        {OPTIONS.map(o => {
          const active = boxType === (o.id as any);
          return (
            <button
              key={o.id}
              onClick={() => setBoxType(o.id as any)}
              aria-pressed={active}
              style={{ ...btn, ...(active ? btnActive : {}) }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const card:  React.CSSProperties = { borderWidth: 1, borderStyle: "solid", borderColor: "#eee", borderRadius: 8, padding: 12, marginBottom: 12 };
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
