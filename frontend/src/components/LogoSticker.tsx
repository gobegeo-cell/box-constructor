// src/components/LogoSticker.tsx
import * as THREE from "three";
import { useMemo } from "react";
import { useLoader, createPortal } from "@react-three/fiber";
import { useBoxStore } from "../store/useBoxStore";

type BoxSide = "front" | "back" | "left" | "right" | "top" | "bottom";
type Anchors = { lid?: THREE.Object3D | null; body?: THREE.Object3D | null };

const mm = (v: number) => (Number(v) || 0) / 1000;
const EPS = 0.0004; // ~0.4 мм

/** БАЗОВАЯ ОРИЕНТАЦИЯ (применяется всегда «под капотом»)
 *  – front  : flipH
 *  – back   : flipV  (исправление твоей ошибки «бек по вертикали»)
 *  – top    : flipH
 *  – прочие : без флипа
 *
 *  ВАЖНО: это не меняет user flip в сторе — мы делаем XOR при рендере.
 */
const BASE_ORIENT: Partial<Record<BoxSide, { baseFlipH?: boolean; baseFlipV?: boolean }>> = {
  front:  { baseFlipH: true,  baseFlipV: true },
  back:   { baseFlipH: false, baseFlipV: true  },
  top:    { baseFlipH: true,  baseFlipV: false },
  left:   { baseFlipH: false, baseFlipV: true },
  right:  { baseFlipH: false, baseFlipV: true },
  bottom: { baseFlipH: false, baseFlipV: true },
};

/** Базовое «подворот по Z» для некоторых типов моделей */
const MODEL_FLIP_Z: Record<string, Partial<Record<BoxSide, number>>> = {
  lidBottom: { top: Math.PI, front: Math.PI, left: Math.PI, right: Math.PI, back: 0, bottom: 0 },
  casket:    { top: Math.PI, front: Math.PI, left: Math.PI, right: Math.PI, back: 0, bottom: 0 },
  drawer:    { top: Math.PI, front: Math.PI, left: Math.PI, right: Math.PI, back: 0, bottom: 0 },
  hex:       { top: Math.PI, front: Math.PI, left: Math.PI, right: Math.PI, back: 0, bottom: 0 },
};

/** Вынос по нормали (мм) для некоторых моделей */
const MODEL_FACE_NUDGE_MM: Record<string, Partial<Record<BoxSide, number>>> = {
  lidBottom: { top: 10, bottom: -10 },
  casket: {},
  drawer: {},
  hex: {},
};

function faceDims(side: BoxSide, wMM: number, hMM: number, dMM: number) {
  const W = mm(wMM), H = mm(hMM), D = mm(dMM);
  switch (side) {
    case "front":
    case "back":   return { A: W, B: H };
    case "left":
    case "right":  return { A: D, B: H };
    case "top":
    case "bottom": return { A: W, B: D };
  }
}

function faceTransform(side: BoxSide, wMM: number, hMM: number, dMM: number, nudgeMM: number) {
  const W = mm(wMM), H = mm(hMM), D = mm(dMM);
  const pos = new THREE.Vector3();
  const rot = new THREE.Euler();
  const dir = new THREE.Vector3();

  switch (side) {
    case "front":  pos.set(0, 0,  D / 2 + EPS); rot.set(0, 0, 0);             dir.set(0, 0,  1); break;
    case "back":   pos.set(0, 0, -D / 2 - EPS); rot.set(0, Math.PI, 0);       dir.set(0, 0, -1); break;
    case "left":   pos.set(-W / 2 - EPS, 0, 0); rot.set(0, Math.PI / 2, 0);   dir.set(-1, 0, 0); break;
    case "right":  pos.set( W / 2 + EPS, 0, 0); rot.set(0, -Math.PI / 2, 0);  dir.set( 1, 0, 0); break;
    case "top":    pos.set(0,  H / 2 + EPS, 0); rot.set(-Math.PI / 2, 0, 0);  dir.set(0,  1, 0); break;
    case "bottom": pos.set(0, -H / 2 - EPS, 0); rot.set(Math.PI / 2, 0, 0);   dir.set(0, -1, 0); break;
  }
  const nudgeVal = typeof nudgeMM === "number" ? nudgeMM : 0;
  pos.addScaledVector(dir, mm(nudgeVal));
  return { pos, rot };
}

function fitSizeIntoFace(A: number, B: number, ratio: number, aspect: number) {
  const shorter = Math.min(A, B);
  const targetShort = shorter * THREE.MathUtils.clamp(ratio, 0.05, 0.95);
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

function ImagePlane({ url, A, B, ratio, opacity }:{
  url: string; A: number; B: number; ratio: number; opacity: number;
}) {
  const tex = useLoader(THREE.TextureLoader, url);
  const iw = tex.image && (tex.image as any).width ? (tex.image as any).width : 1;
  const ih = tex.image && (tex.image as any).height ? (tex.image as any).height : 1;
  const aspect = iw / ih;

  const { w, h } = fitSizeIntoFace(A, B, ratio, aspect);

  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.center.set(0.5, 0.5);
  tex.flipY = false;
  (tex as any).colorSpace = (THREE as any).SRGBColorSpace || (tex as any).encoding;

  const op = typeof opacity === "number" ? opacity : 1;

  return (
    <mesh renderOrder={2}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial
        map={tex}
        transparent
        opacity={THREE.MathUtils.clamp(op, 0, 1)}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function TextPlane({ text, A, B, ratio, opacity }:{
  text: string; A: number; B: number; ratio: number; opacity: number;
}) {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 512;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 180px sans-serif";
    ctx.fillText(text, c.width / 2, c.height / 2);
    return c;
  }, [text]);

  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    (t as any).colorSpace = (THREE as any).SRGBColorSpace || (t as any).encoding;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.center.set(0.5, 0.5);
    t.flipY = false;
    return t;
  }, [canvas]);

  const aspect = canvas.width / canvas.height;
  const { w, h } = fitSizeIntoFace(A, B, 0.5, aspect); // ratio не критичен для текста, но оставим 0.5 как базу
  const op = typeof opacity === "number" ? opacity : 1;

  return (
    <mesh renderOrder={2}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial
        map={tex}
        transparent
        opacity={THREE.MathUtils.clamp(op, 0, 1)}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export default function LogoSticker({ anchors }: { anchors?: Anchors }) {
  const width = useBoxStore((s) => s.width);
  const height = useBoxStore((s) => s.height);
  const depth = useBoxStore((s) => s.depth);
  const boxType = useBoxStore((s) => s.boxType);
  const logos = useBoxStore((s: any) => s.logos) as Record<BoxSide, {
    type: "image" | "text";
    content: string | null;
    position: { x: number; y: number; z: number };
    scale: { x: number; z: number };
    rotation: number; // РАДИАНЫ (оставляем как есть!)
    opacity: number;
    flipH?: boolean;  // пользовательские флаги — не трогаем
    flipV?: boolean;
  }>;

  const sides = useMemo(() => (["front","back","left","right","top","bottom"] as BoxSide[]), []);
  const flipsZ = MODEL_FLIP_Z[boxType] || {};
  const nudges = MODEL_FACE_NUDGE_MM[boxType] || {};

  // генерим «общий» id anchors для ключа портала (чтобы гарантированно размонтировать старые)
  const anchorsId = useMemo(() => {
    const lidId  = anchors?.lid  ? (anchors!.lid as any).uuid  : "nil";
    const bodyId = anchors?.body ? (anchors!.body as any).uuid : "nil";
    return `${lidId}-${bodyId}`;
  }, [anchors?.lid, anchors?.body]);

  return (
    <>
      {sides.map((side) => {
        const data = logos?.[side];
        if (!data || (!data.content && data.type !== "text")) return null;

        const { A, B } = faceDims(side, width, height, depth);
        const nudgeMM = typeof nudges[side] === "number" ? (nudges as any)[side] : 0;
        const { pos, rot } = faceTransform(side, width, height, depth, nudgeMM);

        // scale.x/scale.z → единый ratio (оставляем текущую модель стора)
        const ratio = (Number(data.scale?.x) + Number(data.scale?.z)) / 2 || 1;
        const op = typeof data.opacity === "number" ? Number(data.opacity) : 1;

        // смещение в плоскости (мм): top/bottom — (x,z); остальные — (x,y)
        const offset = new THREE.Vector3(
          mm(data.position?.x || 0),
          side === "top" || side === "bottom" ? 0 : mm(data.position?.y || 0),
          side === "top" || side === "bottom" ? mm(data.position?.z || 0) : 0
        );

        // итоговый поворот: базовая поправка Z + пользовательский (в радианах)
        const baseFlipZ = typeof (flipsZ as any)[side] === "number" ? (flipsZ as any)[side] : 0;
        const addRot = new THREE.Euler(0, 0, baseFlipZ + (data.rotation || 0));

        // БАЗОВОЕ ЗЕРКАЛО (XOR с пользовательским)
        const base = BASE_ORIENT[side] || {};
        const effectiveFlipH = Boolean(base.baseFlipH) !== Boolean(data.flipH);
        const effectiveFlipV = Boolean(base.baseFlipV) !== Boolean(data.flipV);

        const sx = effectiveFlipH ? -1 : 1;
        const sy = effectiveFlipV ? -1 : 1;

        const keyId = `logo-${side}-${anchorsId}`; // ключ зависит от anchors → старые порталы гарантированно удаляются

        const content =
          <group key={keyId} position={pos} rotation={rot}>
            <group position={offset} rotation={addRot} scale={[sx, sy, 1]}>
              {data.type === "image" && data.content ? (
                <ImagePlane url={String(data.content)} A={A} B={B} ratio={ratio} opacity={op} />
              ) : data.type === "text" && (String(data.content || "").trim()) ? (
                <TextPlane text={String(data.content)} A={A} B={B} ratio={ratio} opacity={op} />
              ) : null}
            </group>
          </group>;

        // Крепление к нужному узлу (top → крышка, остальное → корпус)
        const parent = side === "top" ? anchors?.lid : anchors?.body;

        // ВАЖНО: третьим аргументом передаём стабильный key
        return parent ? createPortal(content, parent, keyId) : content;
      })}
    </>
  );
}
