import React, { useEffect, useState } from "react";
import { useBoxStore } from "../store/useBoxStore";

export default function DimensionInputs() {
  const w = useBoxStore(s => s.width);
  const h = useBoxStore(s => s.height);
  const d = useBoxStore(s => s.depth);
  const setWidth  = useBoxStore(s => s.setWidth);
  const setHeight = useBoxStore(s => s.setHeight);
  const setDepth  = useBoxStore(s => s.setDepth);

  // Локальные строки — чтобы не мешать набору первых цифр
  const [ws, setWs] = useState(String(w));
  const [hs, setHs] = useState(String(h));
  const [ds, setDs] = useState(String(d));

  // Если стор меняется извне — синхронизируем строки
  useEffect(() => setWs(String(w)), [w]);
  useEffect(() => setHs(String(h)), [h]);
  useEffect(() => setDs(String(d)), [d]);

  // Парсер: пропускаем только число (целое/десятичное). Пустое тоже ок — пусть человек печатает.
  const parse = (s: string) => {
    const trimmed = s.replace(",", ".").trim();
    if (trimmed === "") return null; // не коммитим пустое
    const num = Number(trimmed);
    return Number.isFinite(num) && num >= 0 ? num : null; // допускаем 0+, если хочешь — поменяй на > 0
  };

  const commitW = () => { const v = parse(ws); if (v !== null) setWidth(v); else setWs(String(w)); };
  const commitH = () => { const v = parse(hs); if (v !== null) setHeight(v); else setHs(String(h)); };
  const commitD = () => { const v = parse(ds); if (v !== null) setDepth(v); else setDs(String(d)); };

  const onKey = (ev: React.KeyboardEvent<HTMLInputElement>, commit: () => void) => {
    if (ev.key === "Enter") commit();
  };

  const Row = (label: string, val: string, setVal: (s: string) => void, commit: () => void) => (
    <div style={row}>
      <label style={labelStyle}>{label} (мм):</label>
      <input
        style={input}
        type="text"                  // свободный ввод, без min/max
        inputMode="numeric"         // мобильная цифровая клавиатура
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => onKey(e, commit)}
        placeholder="введите любое значение"
      />
    </div>
  );

  return (
    <div style={wrap}>
      {Row("Ширина", ws, setWs, commitW)}
      {Row("Длина",  ds, setDs, commitD)}
      {Row("Высота", hs, setHs, commitH)}
      <small style={{ color: "#6b7280" }}>
        Можно вводить любые значения, например: 20, 12.5 и т.п. Нажмите Enter или уйдите из поля, чтобы применить.
      </small>
    </div>
  );
}

const wrap: React.CSSProperties = { display: "grid", gap: 8 };
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 160px", alignItems: "center", gap: 8 };
const labelStyle: React.CSSProperties = { fontWeight: 600 };
const input: React.CSSProperties = { height: 34, padding: "0 10px", borderRadius: 8, border: "1px solid #ddd" };
