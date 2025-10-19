// src/components/LogoEditor.tsx
import React, { useMemo, useRef, useCallback, useEffect, useState } from "react";
import { useBoxStore } from "../store/useBoxStore";

type BoxSide = "front" | "back" | "left" | "right" | "top" | "bottom";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function faceDimsMM(side: BoxSide, wMM: number, hMM: number, dMM: number) {
  switch (side) {
    case "front":
    case "back":   return { A: wMM, B: hMM };
    case "left":
    case "right":  return { A: dMM, B: hMM };
    case "top":
    case "bottom": return { A: wMM, B: dMM };
  }
}

function ratioToSizeMM(A: number, B: number, ratio: number, aspect: number) {
  const r = clamp(ratio, 0.05, 0.95);
  const shorter = Math.min(A, B);
  const base = shorter * r;
  let w = base * (aspect >= 1 ? aspect : 1);
  let h = base * (aspect >= 1 ? 1 : 1 / aspect);

  // ограничение в пределах площадки (96% от поля)
  const maxW = A * 0.96, maxH = B * 0.96;
  const k = Math.min(maxW / w, maxH / h, 1);
  return { w: +(w * k).toFixed(1), h: +(h * k).toFixed(1) };
}

function sizeToRatio(A: number, B: number, aspect: number, desiredW?: number, desiredH?: number) {
  const shorter = Math.min(A, B);
  let short = shorter * 0.3;

  if (typeof desiredW === "number" && desiredW > 0) {
    short = aspect >= 1 ? desiredW / aspect : desiredW;
  } else if (typeof desiredH === "number" && desiredH > 0) {
    short = aspect >= 1 ? desiredH : desiredH * aspect;
  }

  const r0 = clamp(short / shorter, 0.05, 0.95);
  const s  = ratioToSizeMM(A, B, r0, aspect);
  const fit = Math.min((A * 0.96) / s.w, (B * 0.96) / s.h, 1);
  return clamp(r0 * fit, 0.05, 0.95);
}

export default function LogoEditor() {
  const fileRef = useRef<HTMLInputElement | null>(null);

  // store
  const selectedSide   = useBoxStore((s) => s.selectedSide as BoxSide);
  const logos          = useBoxStore((s: any) => s.logos);
  const setLogoForSide = useBoxStore((s: any) => s.setLogoForSide);
  const clearLogo      = useBoxStore((s: any) => s.clearLogo);

  const width  = useBoxStore((s) => s.width);
  const height = useBoxStore((s) => s.height);
  const depth  = useBoxStore((s) => s.depth);

  // текущий логотип для выбранной стороны
  const logo = (logos?.[selectedSide]) || ({} as any);
  const hasImage = logo && (logo.type === "image" || logo.image || logo.content);

  // подпись стороны
  const sideLabel = useMemo(() => {
    const map: Record<BoxSide, string> = {
      top: "Крышка", bottom: "Дно", front: "Передняя", back: "Задняя", left: "Левая", right: "Правая",
    };
    return map[selectedSide] || selectedSide;
  }, [selectedSide]);

  // загрузка файла
  const revokePrevIfBlob = useCallback(() => {
    const url = logo && logo.content;
    if (url && typeof url === "string" && url.startsWith("blob:")) {
      try { URL.revokeObjectURL(url); } catch {}
    }
  }, [logo && logo.content]);

  const onFile = useCallback((files: FileList | null) => {
    const f = files && files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { alert("Выберите файл изображения"); return; }
    revokePrevIfBlob();
    const url = URL.createObjectURL(f);
    setLogoForSide(selectedSide, {
      type: "image",
      file: f,
      content: url,
      enabled: true,
      opacity: 1,
    });
    if (fileRef.current) fileRef.current.value = "";
    // если нет размеров — дадим стартовые (90×57.6) и центр
    const sizeMm = logo?.size_mm;
    if (!sizeMm?.w || !sizeMm?.h) {
      setLogoForSide(selectedSide, {
        size_mm: { w: 90, h: 57.6 },
        position_mm: { xMm: 0, yMm: 0 },
        rotation_deg: 0,
        lockAspect: true
      });
    }
  }, [selectedSide, setLogoForSide, revokePrevIfBlob, logo?.size_mm]);

  // вычисление аспекта
  const [aspect, setAspect] = useState(1);
  useEffect(() => {
    if (logo && (logo.content || logo.src)) {
      const img = new Image();
      img.onload = function () {
        const w = (img as any).naturalWidth || (img as any).width || 1;
        const h = (img as any).naturalHeight || (img as any).height || 1;
        setAspect((w || 1) / (h || 1));
      };
      img.src = String(logo.content || logo.src);
    } else if (logo && logo.type === "text") {
      setAspect(1024 / 512);
    } else {
      setAspect(1);
    }
  }, [logo && logo.content, logo && logo.src, logo && logo.type]);

  // размеры площадки (мм)
  const dimsFace = useMemo(() => faceDimsMM(selectedSide, width, height, depth), [selectedSide, width, height, depth]);
  const A = dimsFace.A, B = dimsFace.B;

  // базовый ratio — из scale если есть
  const ratio = useMemo(() => {
    const rx = Number(logo?.scale?.x) || 0;
    const rz = Number(logo?.scale?.z) || 0;
    const r  = (rx && rz) ? Math.min(rx, rz) : (rx || rz || 0.3);
    return clamp(r, 0.05, 0.95);
  }, [logo?.scale?.x, logo?.scale?.z]);

  // производные фактические размеры в мм (из ratio)
  const dims = useMemo(() => {
    // если пользователь уже ввёл size_mm — показываем их
    if (logo?.size_mm?.w && logo?.size_mm?.h) {
      return { w: Number(logo.size_mm.w), h: Number(logo.size_mm.h) };
    }
    return ratioToSizeMM(A, B, ratio, aspect);
  }, [A, B, ratio, aspect, logo?.size_mm?.w, logo?.size_mm?.h]);

  // === РАЗМЕР (мм) ===
  const [wInput, setWInput] = useState("");
  const [hInput, setHInput] = useState("");
  useEffect(() => {
    setWInput(String(Math.round(dims.w)));
    setHInput(String(Math.round(dims.h)));
  }, [dims.w, dims.h]);

  const lockAspect = Boolean(logo?.lockAspect ?? true);

  const applyWidth  = () => {
    const v = Number((wInput || "").replace(",", "."));
    if (!isFinite(v) || v <= 0) return;
    const h = lockAspect ? v / aspect : Number((hInput || "").replace(",", ".")) || v / aspect;
    // ограничим в пределах площадки
    const rNew = sizeToRatio(A, B, aspect, v, lockAspect ? undefined : h);
    const sNew = ratioToSizeMM(A, B, rNew, aspect);
    // сохраним scale (для 3D) и size_mm (для калькулятора/PDF)
    useBoxStore.getState().setLogoForSide(selectedSide, {
      scale: { x: rNew, z: rNew },
      size_mm: { w: +sNew.w.toFixed(1), h: +sNew.h.toFixed(1) },
      lockAspect
    });
    setWInput(String(Math.round(sNew.w)));
    setHInput(String(Math.round(sNew.h)));
  };

  const applyHeight = () => {
    const v = Number((hInput || "").replace(",", "."));
    if (!isFinite(v) || v <= 0) return;
    const w = lockAspect ? v * aspect : Number((wInput || "").replace(",", ".")) || v * aspect;
    const rNew = sizeToRatio(A, B, aspect, lockAspect ? undefined : w, v);
    const sNew = ratioToSizeMM(A, B, rNew, aspect);
    useBoxStore.getState().setLogoForSide(selectedSide, {
      scale: { x: rNew, z: rNew },
      size_mm: { w: +sNew.w.toFixed(1), h: +sNew.h.toFixed(1) },
      lockAspect
    });
    setWInput(String(Math.round(sNew.w)));
    setHInput(String(Math.round(sNew.h)));
  };

  // === ПОЗИЦИЯ (мм) ===
  const pos = (logo?.position_mm && { xMm: Number(logo.position_mm.xMm)||0, yMm: Number(logo.position_mm.yMm)||0 })
           || (logo?.position    && { xMm: Number(logo.position.x)||0,     yMm: Number(logo.position.y)||0 })
           || { xMm: 0, yMm: 0 };

  const [xInput, setXInput] = useState(String(Math.round(pos.xMm)));
  const [yInput, setYInput] = useState(String(Math.round(pos.yMm)));

  useEffect(() => { setXInput(String(Math.round(pos.xMm))); }, [pos.xMm]);
  useEffect(() => { setYInput(String(Math.round(pos.yMm))); }, [pos.yMm]);

  const applyX = () => {
    const v = Number((xInput || "").replace(",", "."));
    if (!isFinite(v)) return;
    setLogoForSide(selectedSide, { position_mm: { xMm: v, yMm: pos.yMm }, position: { x: v, y: pos.yMm, z: logo?.position?.z || 0 } });
  };

  // FIX: для top/bottom вторая ось должна писаться в position.z (а не y)
  const applyY = () => {
    const v = Number((yInput || "").replace(",", "."));
    if (!isFinite(v)) return;
    const isTopOrBottom = selectedSide === "top" || selectedSide === "bottom";
    setLogoForSide(selectedSide, {
      position_mm: { xMm: pos.xMm, yMm: v }, // «вторая ось в мм» оставляем как было
      position: {
        x: pos.xMm,
        y: isTopOrBottom ? (logo?.position?.y || 0) : v,
        z: isTopOrBottom ? v : (logo?.position?.z || 0),
      }
    });
  };

  // FIX: центрирование — обнуляем нужную ось: для top/bottom это z
  const centerPos = () => {
    const isTopOrBottom = selectedSide === "top" || selectedSide === "bottom";
    setLogoForSide(selectedSide, {
      position_mm: { xMm: 0, yMm: 0 },
      position: { x: 0, y: isTopOrBottom ? (logo?.position?.y || 0) : 0, z: isTopOrBottom ? 0 : (logo?.position?.z || 0) }
    });
    setXInput("0"); setYInput("0");
  };

  // ПОВОРОТ / ЗЕРКАЛО
  const rotationDeg = Math.round((Number(logo?.rotation_deg) || (Number(logo?.rotation)||0) * 180 / Math.PI) % 360);
  const rotateBy = (deg: number) => {
    const next = ((rotationDeg + deg) % 360 + 360) % 360;
    setLogoForSide(selectedSide, { rotation_deg: next, rotation: next * Math.PI / 180 });
  };
  const resetRotation = () => setLogoForSide(selectedSide, { rotation_deg: 0, rotation: 0 });

  const flipH = Boolean(logo?.flipH);
  const flipV = Boolean(logo?.flipV);
  const toggleFlipH = () => setLogoForSide(selectedSide, { flipH: !flipH });
  const toggleFlipV = () => setLogoForSide(selectedSide, { flipV: !flipV });

  const isTopOrBottom = selectedSide === "top" || selectedSide === "bottom"; // FIX: используем и в подписи

  // UI
  return (
    <div style={box}>
      <div style={title}>Логотип — <b>{sideLabel}</b></div>

      {/* загрузка / удалить */}
      <div style={row}>
        <button style={btn} onClick={() => fileRef.current?.click()}>Загрузить логотип</button>
        <input ref={fileRef} type="file" accept="image/*,image/svg+xml" style={{ display: "none" }} onChange={(e) => onFile(e.target.files)} />
        <button style={btnGhost} onClick={() => clearLogo(selectedSide)} disabled={!hasImage}>Удалить</button>
      </div>
      {!hasImage && <div style={{ fontSize: 12, color: "#a00", marginTop: 6 }}>Картинка не загружена.</div>}

      {/* размеры */}
      <div style={{ ...row, gap: 12 }}>
  {/* Кластер «Ширина»: label | input | OK */}
  <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 52px", alignItems: "center", columnGap: 6, minWidth: 260 }}>
    <label style={label}>Ширина</label>
    <div style={inputWrap}>
      <input value={wInput} onChange={(e) => setWInput(e.currentTarget.value)} style={input}/>
      <span style={suffix}>мм</span>
    </div>
    <button style={{ ...btn, minWidth: 52 }} onClick={applyWidth}>OK</button>
  </div>

  {/* Кластер «Высота»: label | input | OK */}
  <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 52px", alignItems: "center", columnGap: 6, minWidth: 260 }}>
    <label style={label}>Высота</label>
    <div style={inputWrap}>
      <input value={hInput} onChange={(e) => setHInput(e.currentTarget.value)} style={input}/>
      <span style={suffix}>мм</span>
    </div>
    <button style={{ ...btn, minWidth: 52 }} onClick={applyHeight}>OK</button>
  </div>

  {/* Чекбокс — без изменений */}
  <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
    <input
      type="checkbox"
      checked={lockAspect}
      onChange={(e)=>useBoxStore.getState().setLogoForSide(selectedSide,{ lockAspect: e.currentTarget.checked })}
    />
    Сохранять пропорции
  </label>
</div>

      {/* позиция */}
      {/* Две симметричные колонки для X и второй оси: label | input | OK */}
<div style={{ ...row, gap: 12 }}>
  {/* Кластер «X»: label | input | OK */}
  <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 52px", alignItems: "center", columnGap: 6, minWidth: 260 }}>
    <label style={label}>X</label>
    <div style={inputWrap}>
      <input value={xInput} onChange={(e)=>setXInput(e.currentTarget.value)} style={input}/>
      <span style={suffix}>мм</span>
    </div>
    <button style={{ ...btn, minWidth: 52 }} onClick={applyX}>OK</button>
  </div>

  {/* Кластер «Y/Z» (для top/bottom — Y, иначе — Z) */}
  <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 52px", alignItems: "center", columnGap: 6, minWidth: 260 }}>
    <label style={label}>{(selectedSide === "top" || selectedSide === "bottom") ? "Y" : "Z"}</label>
    <div style={inputWrap}>
      <input value={yInput} onChange={(e)=>setYInput(e.currentTarget.value)} style={input}/>
      <span style={suffix}>мм</span>
    </div>
    <button style={{ ...btn, minWidth: 52 }} onClick={applyY}>OK</button>
  </div>

  {/* Центрировать — как было */}
  <button style={btn} onClick={centerPos}>Центрировать</button>
</div>

      {/* поворот/зеркало */}
      <div style={section}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Поворот и зеркало</div>
        <div style={row}>
          <button style={btn} onClick={() => rotateBy(-90)}>−90°</button>
          <button style={btn} onClick={() => rotateBy(-15)}>−15°</button>
          <div style={{ opacity:.7, minWidth:60, textAlign:"center" }}>{rotationDeg}°</div>
          <button style={btn} onClick={() => rotateBy(+15)}>+15°</button>
          <button style={btn} onClick={() => rotateBy(+90)}>+90°</button>
          <button style={btnGhost} onClick={resetRotation}>Сброс</button>
        </div>
        <div style={row}>
          <label style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
            <input type="checkbox" checked={flipH} onChange={toggleFlipH}/> Зеркало по горизонтали
          </label>
          <label style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
            <input type="checkbox" checked={flipV} onChange={toggleFlipV}/> Зеркало по вертикали
          </label>
        </div>
      </div>
    </div>
  );
}

const box:   React.CSSProperties = { border: "1px solid #eee", borderRadius: 8, padding: 12, marginTop: 12 };
const title: React.CSSProperties = { fontWeight: 700, marginBottom: 8 };
const row:   React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 };
const section: React.CSSProperties = { borderTop: "1px dashed #ddd", paddingTop: 8, marginTop: 8 };
const label: React.CSSProperties = { display: "block", fontSize: 12, color: "#666", minWidth: 64 };
const btn:   React.CSSProperties = { padding: "6px 10px", borderRadius: 6, border: "1px solid #ddd", background: "#f8f8f8", cursor: "pointer", fontWeight: 600 };
const btnGhost: React.CSSProperties = { ...btn, background: "#fff" };
const inputWrap: React.CSSProperties = { position: "relative" };
const input: React.CSSProperties = { width: 90, padding: "6px 28px 6px 8px", borderRadius: 6, border: "1px solid #ddd", fontVariantNumeric: "tabular-nums" };
const suffix: React.CSSProperties = { position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#666" };
