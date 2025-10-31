// src/components/TypeSelector.tsx
import React from "react";
import { useBoxStore } from "../store/useBoxStore";

type Opt = { id: string; label: string };

const STANDARD: Opt[] = [
  { id: "lidBottom", label: "Крышка-дно" },
  { id: "casket",    label: "Шкатулка" },
  { id: "drawer",    label: "Пенал" },
  { id: "hex",       label: "Футляр" },
];

const NON_STANDARD: Opt[] = [
  { id: "bookBox",            label: "Коробка-книга" },
  { id: "casketSlider",       label: "Шкатулка слайдер" },
  { id: "casketCounterFlap",  label: "Шкат. вст. клапан" },
  { id: "lidBottomLongFlap",  label: "Крышка удл. клапан" },

  // 🆕 Новые типы
  { id: "hexBox",     label: "V крышка " },
  { id: "vCutHex",    label: "V-образная крышка" },
  { id: "tierCasket", label: "ярусная коробка" },
  { id: "angledHex",  label: "Угловая коробка" },
];

export default function TypeSelector() {
  const boxType = useBoxStore((s) => s.boxType);
  const setBoxType = useBoxStore((s) => s.setBoxType);

  const renderGroup = (title: string, items: Opt[]) => (
    <div style={card}>
      <div style={titleStyle}>{title}</div>
      <div style={grid}>
        {items.map((o) => {
          const active = boxType === (o.id as any);
          return (
            <button
              key={o.id}
              onClick={() => setBoxType(o.id as any)}
              aria-pressed={active}
              style={{ ...btn, ...(active ? btnActive : {}) }}
              title={o.label}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {renderGroup("Тип коробки", STANDARD)}
      {renderGroup("Нестандартные коробки", NON_STANDARD)}
    </>
  );
}

const card: React.CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#eee",
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
};

const titleStyle: React.CSSProperties = {
  fontWeight: 700,
  marginBottom: 8,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const btn: React.CSSProperties = {
  padding: "8px 10px",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ddd",
  borderRadius: 8,
  background: "#fff",
  cursor: "pointer",
  fontSize: 12,
  lineHeight: 1.2,
  fontWeight: 600,
  transition: "all .2s ease",
};

const btnActive: React.CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#cc0000",
  boxShadow: "0 0 0 2px #cc000033",
  background: "#fff5f5",
};
