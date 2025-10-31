// src/components/LogoEditor.tsx
import React, { useMemo } from "react";
import { useBoxStore } from "../store/useBoxStore";

type BoxSide = "front" | "back" | "left" | "right" | "top" | "bottom";

export default function LogoEditor() {
  const selectedSide   = useBoxStore((s) => s.selectedSide);
  const logos          = useBoxStore((s: any) => s.logos);
  const setLogoForSide = useBoxStore((s: any) => s.setLogoForSide);
  const clearLogo      = useBoxStore((s: any) => s.clearLogo);

  const logo = logos[selectedSide];
  const isTopOrBottom = selectedSide === "top" || selectedSide === "bottom";

  // Универсальный размер (в %) берём как среднее от scale.x/scale.z
  const sizePct = useMemo(() => {
    const x = Number(logo.scale.x) || 1;
    const z = Number(logo.scale.z) || 1;
    return Math.round(((x + z) / 2) * 100);
  }, [logo.scale.x, logo.scale.z]);

  const sideLabel = useMemo(() => {
    const map: Record<BoxSide, string> = {
      front: "Передняя", back: "Задняя", left: "Левая",
      right: "Правая", top: "Крышка", bottom: "Дно",
    };
    return map[selectedSide] || selectedSide;
  }, [selectedSide]);

  const hasImage = logo.type === "image" && !!logo.content;
  const vertLabel = isTopOrBottom ? "Смещение по Z (мм)" : "Смещение по Y (мм)";

  return (
    <div style={box}>
      <div style={title}>Логотип — <b>{sideLabel}</b></div>

      {/* Тип оставляем — но только две опции и без лишних полей */}
      <div style={row}>
        <label style={radio}>
          <input
            type="radio"
            name="logo-type"
            checked={logo.type === "image"}
            onChange={() => setLogoForSide(selectedSide, { type: "image" })}
          />
          Картинка
        </label>
        <label style={radio}>
          <input
            type="radio"
            name="logo-type"
            checked={logo.type === "text"}
            onChange={() => setLogoForSide(selectedSide, { type: "text", content: logo.content ?? "Ваш текст" })}
          />
          Текст
        </label>
      </div>

      {logo.type === "text" && (
        <input
          type="text"
          value={logo.content ?? ""}
          onChange={(e) => setLogoForSide(selectedSide, { content: e.target.value })}
          placeholder="Введите надпись"
          style={{ ...input, width: "100%", marginTop: 6 }}
        />
      )}

      {!hasImage && logo.type === "image" && (
        <div style={{ fontSize: 12, color: "#a00", marginTop: 6 }}>
          Картинка не загружена. Воспользуйся «Загрузчиком логотипа» выше.
        </div>
      )}

      {/* 1) ВЕРТИКАЛЬ: одно поле в мм */}
      <label style={{ ...label, marginTop: 12 }}>{vertLabel}</label>
      <div style={row}>
        <input
          type="number"
          step={1}
          value={isTopOrBottom ? logo.position.z : logo.position.y}
          onChange={(e) => {
            const v = Number(e.target.value) || 0;
            setLogoForSide(selectedSide, {
              position: isTopOrBottom
                ? { ...logo.position, z: v }
                : { ...logo.position, y: v },
            });
          }}
          style={{ ...input, width: 140 }}
        />
        <button
          style={btn}
          onClick={() =>
            setLogoForSide(selectedSide, {
              position: isTopOrBottom
                ? { ...logo.position, z: 0 }
                : { ...logo.position, y: 0 },
            })
          }
        >
          по центру
        </button>
      </div>

      {/* 2) РАЗМЕР: один ползунок, пропорционально по двум осям */}
      <label style={{ ...label, marginTop: 12 }}>
        Размер (в %) — пропорционально
      </label>
      <div style={row}>
        <input
          type="range"
          min={10}
          max={300}
          step={1}
          value={sizePct}
          onChange={(e) => {
            const pct = Math.max(10, Math.min(300, Number(e.target.value) || 100));
            const k = pct / 100;
            setLogoForSide(selectedSide, { scale: { x: k, z: k } });
          }}
          style={{ flex: 1 }}
        />
        <div style={{ width: 54, textAlign: "right" }}>{sizePct}%</div>
      </div>

      {/* Базовые действия */}
      <div style={{ ...row, justifyContent: "space-between", marginTop: 8 }}>
        <button
          style={btnGhost}
          onClick={() =>
            setLogoForSide(selectedSide, {
              position: { x: 0, y: 0, z: 0 },
              scale: { x: 1, z: 1 },
              rotation: 0,
            })
          }
        >
          Сбросить настройки
        </button>
        <button style={btnDanger} onClick={() => clearLogo(selectedSide)}>
          Удалить логотип
        </button>
      </div>

      {/* (не мешает) Прозрачность оставим — часто нужна */}
      <label style={{ ...label, marginTop: 10 }}>Прозрачность</label>
      <div style={row}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={logo.opacity}
          onChange={(e) =>
            setLogoForSide(selectedSide, {
              opacity: Math.max(0, Math.min(1, Number(e.target.value) || 0)),
            })
          }
          style={{ flex: 1 }}
        />
        <div style={{ width: 54, textAlign: "right" }}>
          {Math.round(logo.opacity * 100)}%
        </div>
      </div>
    </div>
  );
}

const box: React.CSSProperties = { border: "1px solid #eee", borderRadius: 8, padding: 12, marginTop: 12 };
const title: React.CSSProperties = { fontWeight: 700, marginBottom: 8 };
const label: React.CSSProperties = { display: "block", fontSize: 12, color: "#666", marginBottom: 6 };
const row: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" };
const input: React.CSSProperties = { padding: 6, border: "1px solid #ddd", borderRadius: 6 };
const radio: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6 };
const btn: React.CSSProperties = { padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#f8f8f8", cursor: "pointer" };
const btnGhost: React.CSSProperties = { ...btn, background: "#fff" };
const btnDanger: React.CSSProperties = { ...btn, borderColor: "#e99", background: "#fee", color: "#900" };
