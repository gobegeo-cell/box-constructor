// src/components/SideSelector.tsx
import React, { useMemo } from "react";
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
  const selectedSide = useBoxStore((s) => s.selectedSide) as BoxSide | undefined;
  const setSelected  = useBoxStore((s) => s.setSelectedSide) as (side: BoxSide) => void;
  const logos        = useBoxStore((s: any) => s.logos) as Record<
    BoxSide,
    | { type: "image" | "text"; content?: string | null }
    | undefined
  >;

  // Какие стороны уже имеют контент (индикатор точкой), но без автопрыжков
  const sidesWithLogo = useMemo(() => {
    const set = new Set<BoxSide>();
    (["front","back","left","right","top","bottom"] as BoxSide[]).forEach((side) => {
      const l = logos?.[side];
      if (!l) return;
      if (l.type === "image" && l.content) set.add(side);
      if (l.type === "text" && String(l.content || "").trim().length > 0) set.add(side);
    });
    return set;
  }, [logos]);

  return (
    <div style={box}>
      <div style={title}>Сторона логотипа</div>
      <div style={grid}>
        {sides.map((s) => {
          const isActive = selectedSide === s.key;
          const hasLogo  = sidesWithLogo.has(s.key);

          return (
            <button
              key={s.key}
              onClick={() => setSelected(s.key)} // ← теперь всегда можно выбрать и пустую сторону
              style={{ ...btn, ...(isActive ? btnActive : {}) }}
              aria-pressed={isActive}
              title={hasLogo ? `На стороне «${s.label}» уже есть логотип` : `Сторона «${s.label}»`}
            >
              {s.label}
              {hasLogo && <span style={dot} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const box:   React.CSSProperties = { borderWidth: 1, borderStyle: "solid", borderColor: "#eee", borderRadius: 8, padding: 12, marginBottom: 12 };
const title: React.CSSProperties = { fontWeight: 700, marginBottom: 8 };
const grid:  React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };

const btn: React.CSSProperties = {
  position: "relative",
  padding: "8px 10px",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ddd",
  borderRadius: 8,
  background: "#fff",
  cursor: "pointer",
  fontWeight: 600,
};

const btnActive: React.CSSProperties = {
  borderColor: "#cc0000",
  boxShadow: "0 0 0 2px #cc000033",
};

const dot: React.CSSProperties = {
  position: "absolute",
  right: 8,
  top: 8,
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#22c55e", // зелёная точка: «здесь есть логотип»
  boxShadow: "0 0 0 2px #fff",
};
