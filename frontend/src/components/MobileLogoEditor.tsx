// src/components/MobileLogoEditor.tsx
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

export default function MobileLogoEditor() {
  const fileRef = useRef<HTMLInputElement | null>(null);

  // store
  const selectedSide   = (useBoxStore((s) => s.selectedSide) as BoxSide) ?? "front";
  const logos          = useBoxStore((s: any) => s.logos);
  const setLogoForSide = useBoxStore((s: any) => s.setLogoForSide);
  const clearLogo      = useBoxStore((s: any) => s.clearLogo);

  const width  = useBoxStore((s) => s.width);
  const height = useBoxStore((s) => s.height);
  const depth  = useBoxStore((s) => s.depth);

  // текущий логотип для выбранной стороны
  const logo = (logos?.[selectedSide]) || ({} as any);
  const hasImage = Boolean(logo?.content);

  // подпись стороны
  const sideLabel = useMemo(() => {
    const map: Record<BoxSide, string> = {
      top: "Крышка", bottom: "Дно", front: "Передняя", back: "Задняя", left: "Левая", right: "Правая",
    };
    return map[selectedSide] || selectedSide;
  }, [selectedSide]);

  // ===== загрузка файла (PNG → data:image/png; с моб. надёжностью) =====
  const onFile = useCallback(async (files: FileList | null) => {
    const f = files && files[0];
    if (!f) return;

    // Требуем именно PNG (без белой подложки)
    const head = new Uint8Array(await f.slice(0, 8).arrayBuffer());
    const isPNG = head.length >= 8
      && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47
      && head[4] === 0x0D && head[5] === 0x0A && head[6] === 0x1A && head[7] === 0x0A;
    if (!isPNG) { alert("Нужен именно PNG с прозрачностью."); if (fileRef.current) fileRef.current.value = ""; return; }

    const blobURL = URL.createObjectURL(f);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        (im as any).decoding = "async";
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = blobURL;
      });

      const sw = img.naturalWidth || img.width || 1;
      const sh = img.naturalHeight || img.height || 1;
      const MAX = 4096;
      const k = Math.min(1, MAX / Math.max(sw, sh));
      const dw = Math.max(1, Math.floor(sw * k));
      const dh = Math.max(1, Math.floor(sh * k));

      const cv = document.createElement("canvas");
      cv.width = dw; cv.height = dh;
      const ctx = cv.getContext("2d")!;
      ctx.clearRect(0, 0, dw, dh);
      ctx.drawImage(img, 0, 0, dw, dh);

      const dataURL = cv.toDataURL("image/png");

      const side: BoxSide = (useBoxStore.getState().selectedSide ?? selectedSide ?? "front") as BoxSide;

      setLogoForSide(side, {
        type: "image",
        file: f,
        content: dataURL,      // PNG dataURL с альфой
        opacity: 1,
        ...(logo?.sizeMM?.w && logo?.sizeMM?.h ? {} : {
          sizeMM: { w: 90, h: 57.6 },
          position: { x: 0, y: 0, z: 0 },
          rotation: 0,          // рад
          scale: { x: 0.3, z: 0.3 },
          flipH: false,
          flipV: false,
        }),
      });
    } catch (e) {
      console.error("[MobileLogoEditor] PNG normalize fail:", e);
      alert("Не удалось прочитать PNG. Попробуйте другой файл.");
    } finally {
      try { URL.revokeObjectURL(blobURL); } catch {}
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [selectedSide, setLogoForSide, logo?.sizeMM]);

  // вычисление аспекта
  const [aspect, setAspect] = useState(1);
  useEffect(() => {
    if (logo?.content) {
      const img = new Image();
      img.onload = function () {
        const w = (img as any).naturalWidth || (img as any).width || 1;
        const h = (img as any).naturalHeight || (img as any).height || 1;
        setAspect((w || 1) / (h || 1));
      };
      img.src = String(logo.content);
    } else {
      setAspect(1);
    }
  }, [logo?.content]);

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

  // производные фактические размеры в мм (из ratio) — либо берём sizeMM
  const dims = useMemo(() => {
    if (logo?.sizeMM?.w && logo?.sizeMM?.h) {
      return { w: Number(logo.sizeMM.w), h: Number(logo.sizeMM.h) };
    }
    return ratioToSizeMM(A, B, ratio, aspect);
  }, [A, B, ratio, aspect, logo?.sizeMM?.w, logo?.sizeMM?.h]);

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
    const rNew = sizeToRatio(A, B, aspect, v, lockAspect ? undefined : h);
    const sNew = ratioToSizeMM(A, B, rNew, aspect);
    useBoxStore.getState().setLogoForSide(selectedSide, {
      scale: { x: rNew, z: rNew },
      sizeMM: { w: +sNew.w.toFixed(1), h: +sNew.h.toFixed(1) },
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
      sizeMM: { w: +sNew.w.toFixed(1), h: +sNew.h.toFixed(1) },
      lockAspect
    });
    setWInput(String(Math.round(sNew.w)));
    setHInput(String(Math.round(sNew.h)));
  };

  // === ПОЗИЦИЯ (мм) ===
  const pos = logo?.position ?? { x: 0, y: 0, z: 0 };
  const [xInput, setXInput] = useState(String(Math.round(pos.x)));
  const [yInput, setYInput] = useState(String(Math.round(pos.y))); // вторая ось (Sticker сам положит её в Z для top/bottom)

  useEffect(() => { setXInput(String(Math.round(pos.x || 0))); }, [pos.x]);
  useEffect(() => { setYInput(String(Math.round(pos.y || 0))); }, [pos.y]);

  const applyX = () => {
    const v = Number((xInput || "").replace(",", "."));
    if (!isFinite(v)) return;
    setLogoForSide(selectedSide, { position: { ...logo?.position, x: v } });
  };

  const applyY = () => {
    const v = Number((yInput || "").replace(",", "."));
    if (!isFinite(v)) return;
    setLogoForSide(selectedSide, { position: { ...logo?.position, y: v } });
  };

  const centerPos = () => {
    setLogoForSide(selectedSide, { position: { x: 0, y: 0, z: 0 } });
    setXInput("0"); setYInput("0");
  };

  // ПОВОРОТ / ЗЕРКАЛО
  const rotationDeg = Math.round(((Number(logo?.rotation) || 0) * 180 / Math.PI) % 360);
  const rotateBy = (deg: number) => {
    const nextDeg = ((rotationDeg + deg) % 360 + 360) % 360;
    setLogoForSide(selectedSide, { rotation: nextDeg * Math.PI / 180 });
  };
  const resetRotation = () => setLogoForSide(selectedSide, { rotation: 0 });

  const flipH = Boolean(logo?.flipH);
  const flipV = Boolean(logo?.flipV);
  const toggleFlipH = () => setLogoForSide(selectedSide, { flipH: !flipH });
  const toggleFlipV = () => setLogoForSide(selectedSide, { flipV: !flipV });

  const isTopOrBottom = selectedSide === "top" || selectedSide === "bottom";

  // UI
  return (
    <div style={box}>
      <div style={title}>Логотип — <b>{sideLabel}</b></div>

      {/* загрузка / удалить */}
      <div style={row}>
        <button style={btn} onClick={() => fileRef.current?.click()}>Загрузить логотип</button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png"
          style={{ display: "none" }}
          onChange={(e) => onFile(e.target.files)}
        />
        <button style={btnGhost} onClick={() => clearLogo(selectedSide)} disabled={!hasImage}>Удалить</button>
      </div>
      {!hasImage && <div style={{ fontSize: 12, color: "#a00", marginTop: 6 }}>Картинка не загружена.</div>}

      {/* размеры */}
      <div style={{ ...row, gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 52px", alignItems: "center", columnGap: 6, minWidth: 260 }}>
          <label style={label}>Ширина</label>
          <div style={inputWrap}>
            <input value={wInput} onChange={(e) => setWInput(e.currentTarget.value)} style={input}/>
            <span style={suffix}>мм</span>
          </div>
          <button style={{ ...btn, minWidth: 52 }} onClick={applyWidth}>OK</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 52px", alignItems: "center", columnGap: 6, minWidth: 260 }}>
          <label style={label}>Высота</label>
          <div style={inputWrap}>
            <input value={hInput} onChange={(e) => setHInput(e.currentTarget.value)} style={input}/>
            <span style={suffix}>мм</span>
          </div>
          <button style={{ ...btn, minWidth: 52 }} onClick={applyHeight}>OK</button>
        </div>

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
      <div style={{ ...row, gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 52px", alignItems: "center", columnGap: 6, minWidth: 260 }}>
          <label style={label}>X</label>
          <div style={inputWrap}>
            <input value={xInput} onChange={(e)=>setXInput(e.currentTarget.value)} style={input}/>
            <span style={suffix}>мм</span>
          </div>
          <button style={{ ...btn, minWidth: 52 }} onClick={applyX}>OK</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "64px 1fr 52px", alignItems: "center", columnGap: 6, minWidth: 260 }}>
          <label style={label}>{isTopOrBottom ? "Z" : "Y"}</label>
          <div style={inputWrap}>
            <input value={yInput} onChange={(e)=>setYInput(e.currentTarget.value)} style={input}/>
            <span style={suffix}>мм</span>
          </div>
          <button style={{ ...btn, minWidth: 52 }} onClick={applyY}>OK</button>
        </div>

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
