// src/components/LogoTransformControls.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useBoxStore } from "../store/useBoxStore";

type BoxSide = "front" | "back" | "left" | "right" | "top" | "bottom";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// размеры «площадки» под логотип (в мм) по стороне коробки
function faceDimsMM(side: BoxSide, wMM: number, hMM: number, dMM: number) {
  switch (side) {
    case "front":
    case "back":   return { A: wMM, B: hMM }; // ширина × высота
    case "left":
    case "right":  return { A: dMM, B: hMM }; // глубина × высота
    case "top":
    case "bottom": return { A: wMM, B: dMM }; // ширина × глубина
  }
}

// та же логика, что в LogoSticker: размер из ratio и aspect (в мм)
function sizeFromRatioMM(A: number, B: number, ratio: number, aspect: number) {
  const r = clamp(ratio, 0.05, 0.95);
  const shorter = Math.min(A, B);
  const targetShort = shorter * r;
  let w = targetShort, h = targetShort;
  if (aspect >= 1) {
    h = targetShort; w = h * aspect;
    if (w > A * 0.96) { w = A * 0.96; h = w / aspect; }
  } else {
    w = targetShort; h = w / aspect;
    if (h > B * 0.96) { h = B * 0.96; w = h * aspect; }
  }
  return { w, h };
}

// приблизительная обратная функция: ratio из требуемой ширины/высоты
function ratioFromDesired(A: number, B: number, aspect: number, desiredW?: number, desiredH?: number) {
  const shorter = Math.min(A, B);
  let r = 0.3;

  if (typeof desiredW === "number") {
    // при aspect>=1 целевая «короткая» это H, иначе — W
    const targetShort = aspect >= 1 ? (desiredW / aspect) : desiredW;
    r = targetShort / shorter;
  } else if (typeof desiredH === "number") {
    const targetShort = aspect >= 1 ? desiredH : (desiredH * aspect);
    r = targetShort / shorter;
  }

  // проверка на физические ограничения площадки
  r = clamp(r, 0.05, 0.95);
  const s = sizeFromRatioMM(A, B, r, aspect);
  const f = Math.min((A * 0.96) / s.w, (B * 0.96) / s.h, 1);
  return clamp(r * f, 0.05, 0.95);
}

export default function LogoTransformControls({ side }: { side: BoxSide }) {
  // размеры коробки и текущий логотип
  const width = useBoxStore((s) => s.width);
  const height = useBoxStore((s) => s.height);
  const depth = useBoxStore((s) => s.depth);
  const logos = useBoxStore((s: any) => s.logos) as Record<
    BoxSide,
    {
      type: "image" | "text";
      content: string | null;
      position: { x: number; y: number; z: number };
      scale: { x: number; z: number };
      rotation: number; // в радианах
      opacity: number;
      flipH?: boolean;
      flipV?: boolean;
    }
  >;

  const logo = logos?.[side] || ({} as any);

  // обновление логотипа через Zustand без знания внутренних экшенов
  const updateLogo = (patch: Partial<typeof logo>) => {
    useBoxStore.setState((s: any) => ({
      logos: {
        ...(s.logos || {}),
        [side]: { ...(s.logos?.[side] || {}), ...patch },
      },
    }));
  };

  // аспект изображения для вычисления реальных мм
  const [aspect, setAspect] = useState<number>(1);
  useEffect(() => {
    if (logo?.type === "image" && logo?.content) {
      const img = new Image();
      img.onload = () => {
        const w = (img as any).naturalWidth || img.width || 1;
        const h = (img as any).naturalHeight || img.height || 1;
        setAspect(w / h);
      };
      img.src = String(logo.content);
    } else if (logo?.type === "text") {
      setAspect(1024 / 512); // как в TextPlane
    } else {
      setAspect(1);
    }
  }, [logo?.type, logo?.content]);

  const { A, B } = useMemo(() => faceDimsMM(side, width, height, depth), [side, width, height, depth]);

  // единый ratio из scale.x/scale.z (пропорционально)
  const ratio = useMemo(() => {
    const rx = Number(logo?.scale?.x) || 0.3;
    const rz = Number(logo?.scale?.z) || rx;
    return (rx + rz) / 2;
  }, [logo?.scale?.x, logo?.scale?.z]);

  const dims = useMemo(() => sizeFromRatioMM(A, B, ratio, aspect), [A, B, ratio, aspect]);

  // контролы ручного ввода в мм
  const [wInput, setWInput] = useState<string>("");
  const [hInput, setHInput] = useState<string>("");

  // синхронизируем поля с текущим расчётом
  useEffect(() => {
    setWInput(String(Math.round(dims.w)));
    setHInput(String(Math.round(dims.h)));
  }, [dims.w, dims.h]);

  const setRatio = (r: number) => {
    const rr = clamp(r, 0.05, 0.95);
    updateLogo({ scale: { x: rr, z: rr } });
  };

  const rotateBy = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    const cur = Number(logo?.rotation) || 0;
    updateLogo({ rotation: cur + rad });
  };

  const setWidthMM = () => {
    const v = Number(wInput.replace(",", "."));
    if (!isFinite(v) || v <= 0) return;
    const r = ratioFromDesired(A, B, aspect, v, undefined);
    setRatio(r);
  };

  const setHeightMM = () => {
    const v = Number(hInput.replace(",", "."));
    if (!isFinite(v) || v <= 0) return;
    const r = ratioFromDesired(A, B, aspect, undefined, v);
    setRatio(r);
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* Поворот */}
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontWeight: 700 }}>Поворот</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => rotateBy(90)}  style={btn}>+90°</button>
          <button onClick={() => rotateBy(180)} style={btn}>+180°</button>
          <button
            onClick={() => updateLogo({ rotation: 0 })}
            style={{ ...btn, background: "#eee", color: "#333" }}
          >
            Сброс
          </button>
          <span style={{ alignSelf: "center", opacity: 0.7 }}>
            текущее: {Math.round((((Number(logo?.rotation) || 0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) * 180 / Math.PI)}°
          </span>
        </div>
      </div>

      {/* Размер (мм) */}
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontWeight: 700 }}>
          Размер (мм) — площадка {Math.round(A)}×{Math.round(B)}
        </div>

        {/* Слайдер управляет физическим размером, не процентами */}
        <input
          type="range"
          min={5}
          max={95}
          value={Math.round(clamp(ratio, 0.05, 0.95) * 100)}
          onChange={(e) => setRatio(Number(e.target.value) / 100)}
        />
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Сейчас: <b>{Math.round(dims.w)}</b> × <b>{Math.round(dims.h)}</b> мм (пропорционально)
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 64px", gap: 6 }}>
            <label style={{ alignSelf: "center" }}>Ширина (мм)</label>
            <input
              value={wInput}
              onChange={(e) => setWInput(e.target.value)}
              onBlur={setWidthMM}
              onKeyDown={(e) => e.key === "Enter" && setWidthMM()}
              style={input}
              inputMode="decimal"
            />
            <button onClick={setWidthMM} style={btn}>OK</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 64px", gap: 6 }}>
            <label style={{ alignSelf: "center" }}>Высота (мм)</label>
            <input
              value={hInput}
              onChange={(e) => setHInput(e.target.value)}
              onBlur={setHeightMM}
              onKeyDown={(e) => e.key === "Enter" && setHeightMM()}
              style={input}
              inputMode="decimal"
            />
            <button onClick={setHeightMM} style={btn}>OK</button>
          </div>
        </div>
      </div>

      {/* Зеркало (если у тебя есть эти флаги в сторе) */}
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontWeight: 700 }}>Зеркало</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => updateLogo({ flipH: !logo?.flipH })}
            style={{ ...btn, background: logo?.flipH ? "#2f82ff" : "#f2f2f2", color: logo?.flipH ? "#fff" : "#333" }}
          >
            По горизонтали
          </button>
          <button
            onClick={() => updateLogo({ flipV: !logo?.flipV })}
            style={{ ...btn, background: logo?.flipV ? "#2f82ff" : "#f2f2f2", color: logo?.flipV ? "#fff" : "#333" }}
          >
            По вертикали
          </button>
        </div>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 6,
  border: "1px solid #ddd",
  background: "#f7f7f7",
  cursor: "pointer",
  fontWeight: 600,
};

const input: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid #ddd",
  fontVariantNumeric: "tabular-nums",
};
