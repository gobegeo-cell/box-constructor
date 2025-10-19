// src/components/BoxWithControls.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { useBoxStore } from "../store/useBoxStore";
import BoxModel from "./BoxModel";
import TypeSelector from "./TypeSelector";
import SideColorPicker from "./SideColorPicker";
import SideSelector from "./SideSelector";
import LogoEditor from "./LogoEditor";
import MobileLogoEditor from "./MobileLogoEditor";
import LogoSticker from "./LogoSticker";
import MobileLogoSticker from "./MobileLogoSticker";
import PriceEstimator from "./PriceEstimator";
import useIsMobile from "../hooks/useIsMobile";

declare global {
  interface Window {
    __boxCanvas?: HTMLCanvasElement;
  }
}

const DEFAULT_W = 250;
const DEFAULT_H = 160;
const DEFAULT_D = 80;

export default function BoxWithControls() {
  const width = useBoxStore((s) => s.width);
  const height = useBoxStore((s) => s.height);
  const depth = useBoxStore((s) => s.depth);

  const setWidth = useBoxStore((s) => s.setWidth);
  const setHeight = useBoxStore((s) => s.setHeight);
  const setDepth = useBoxStore((s) => s.setDepth);

  // Стартовые значения
  useEffect(() => {
    if (!Number(width)) setWidth(DEFAULT_W);
    if (!Number(height)) setHeight(DEFAULT_H);
    if (!Number(depth)) setDepth(DEFAULT_D);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Мобильный детектор через хук
  const isMobile = useIsMobile(900);

  const layout: React.CSSProperties = useMemo(() => {
    return isMobile
      ? {
          display: "grid",
          gridTemplateColumns: "1fr",
          gridTemplateRows: "auto auto",
          gap: 12,
          padding: 12,
          boxSizing: "border-box",
        }
      : {
          display: "grid",
          gridTemplateColumns: "340px 1fr",
          height: "100vh",
          gap: 12,
          padding: 12,
          boxSizing: "border-box",
        };
  }, [isMobile]);

  const viewer: React.CSSProperties = useMemo(() => {
    return isMobile
      ? {
          background: "#f7f7f9",
          borderRadius: 12,
          overflow: "hidden",
          position: "relative",
          width: "100%",
          height: "100vw",
          minHeight: 300,
          maxHeight: 820,
        }
      : {
          background: "#f7f7f9",
          borderRadius: 12,
          overflow: "hidden",
          position: "relative",
        };
  }, [isMobile]);

  const sidebar: React.CSSProperties = { overflow: "auto", paddingRight: 4 };
  const card: React.CSSProperties = {
    border: "1px solid #eee",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  };
  const cardTitle: React.CSSProperties = {
    fontWeight: 700,
    marginBottom: 8,
  };

  return (
    <main style={layout}>
      {/* Сцена — мобильная сверху */}
      {isMobile && (
        <div style={viewer}>
          <Canvas
            id="box-canvas"
            gl={{ preserveDrawingBuffer: true, powerPreference: "high-performance" }}
            dpr={[
              1,
              Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1),
            ]}
            onCreated={(state) => {
              window.__boxCanvas = state.gl.domElement as HTMLCanvasElement;
              try {
                const dpr = Math.min(
                  2,
                  typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
                );
                state.gl.setPixelRatio(dpr);
                state.gl.getContext().canvas.style.imageRendering = "auto";
              } catch {}
            }}
            style={{ width: "100%", height: "100%", display: "block" }}
            shadows
            camera={{ position: [0.4, 0.45, 0.9], fov: 40 }}
          >
            <ambientLight intensity={0.6} />
            <directionalLight position={[2, 3, 2]} intensity={0.8} castShadow />
            <Environment preset="city" />
            <OrbitControls
              makeDefault
              enablePan={false}
              minPolarAngle={0.15}
              maxPolarAngle={Math.PI / 2 - 0.06}
              minDistance={0.4}
              maxDistance={2.0}
            />
            <BoxModel />
            <MobileLogoSticker />
          </Canvas>
        </div>
      )}

      {/* Панель */}
      <div style={sidebar}>
        <h2 style={{ marginTop: 0 }}>Конструктор</h2>

        {/* Размеры */}
        <div style={card}>
          <div style={cardTitle}>Размеры (мм)</div>
          <SizesRow
            wStore={Number(width) || DEFAULT_W}
            hStore={Number(height) || DEFAULT_H}
            dStore={Number(depth) || DEFAULT_D}
            onW={setWidth}
            onH={setHeight}
            onD={setDepth}
          />
        </div>

        <TypeSelector />
        <SideColorPicker />
        <SideSelector />

        {/* редактор — мобильный или десктопный */}
        {isMobile ? <MobileLogoEditor /> : <LogoEditor />}

        <PriceEstimator />
      </div>

      {/* Сцена — десктоп справа */}
      {!isMobile && (
        <div style={viewer}>
          <Canvas
            id="box-canvas"
            gl={{ preserveDrawingBuffer: true, powerPreference: "high-performance" }}
            dpr={[
              1,
              Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1),
            ]}
            onCreated={(state) => {
              window.__boxCanvas = state.gl.domElement as HTMLCanvasElement;
              try {
                const dpr = Math.min(
                  2,
                  typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
                );
                state.gl.setPixelRatio(dpr);
                state.gl.getContext().canvas.style.imageRendering = "auto";
              } catch {}
            }}
            style={{ width: "100%", height: "100%", display: "block" }}
            shadows
            camera={{ position: [0.4, 0.35, 0.6], fov: 40 }}
          >
            <ambientLight intensity={0.6} />
            <directionalLight position={[2, 3, 2]} intensity={0.8} castShadow />
            <Environment preset="city" />
            <OrbitControls
              makeDefault
              enablePan={false}
              minPolarAngle={0.15}
              maxPolarAngle={Math.PI / 2 - 0.06}
              minDistance={0.4}
              maxDistance={2.0}
            />
            <BoxModel />
            <LogoSticker />
          </Canvas>
        </div>
      )}
    </main>
  );
}

/** Размеры в одну строку + мгновенная замена значения при вводе */
function SizesRow({
  wStore,
  hStore,
  dStore,
  onW,
  onH,
  onD,
}: {
  wStore: number;
  hStore: number;
  dStore: number;
  onW: (n: number) => void;
  onH: (n: number) => void;
  onD: (n: number) => void;
}) {
  const [wStr, setWStr] = useState(String(wStore));
  const [hStr, setHStr] = useState(String(hStore));
  const [dStr, setDStr] = useState(String(dStore));

  useEffect(() => setWStr(String(wStore)), [wStore]);
  useEffect(() => setHStr(String(hStore)), [hStore]);
  useEffect(() => setDStr(String(dStore)), [dStore]);

  const cell: React.CSSProperties = {
    display: "grid",
    gridTemplateRows: "auto auto",
    gap: 4,
    minWidth: 0,
  };
  const label: React.CSSProperties = {
    fontSize: 11,
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    lineHeight: 1.1,
    whiteSpace: "nowrap",
  };
  const inputStyle: React.CSSProperties = {
    padding: "5px 6px",
    border: "1px solid #ddd",
    borderRadius: 6,
    width: "100%",
    boxSizing: "border-box",
    fontVariantNumeric: "tabular-nums",
    fontSize: 12,
    minWidth: 0,
  };

  const selectAll = (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select();

  const onChangeNum =
    (setter: (s: string) => void, apply: (n: number) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.currentTarget.value;
      setter(val);
      const n = parseFloat(val.replace(",", "."));
      if (!isNaN(n)) apply(n);
    };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(72px, 1fr))",
        gap: 6,
        alignItems: "end",
      }}
    >
      <div style={cell}>
        <div style={label}>W</div>
        <input
          type="number"
          inputMode="numeric"
          value={wStr}
          onFocus={selectAll}
          onChange={onChangeNum(setWStr, onW)}
          style={inputStyle}
        />
      </div>
      <div style={cell}>
        <div style={label}>H</div>
        <input
          type="number"
          inputMode="numeric"
          value={hStr}
          onFocus={selectAll}
          onChange={onChangeNum(setHStr, onH)}
          style={inputStyle}
        />
      </div>
      <div style={cell}>
        <div style={label}>D</div>
        <input
          type="number"
          inputMode="numeric"
          value={dStr}
          onFocus={selectAll}
          onChange={onChangeNum(setDStr, onD)}
          style={inputStyle}
        />
      </div>
    </div>
  );
}
