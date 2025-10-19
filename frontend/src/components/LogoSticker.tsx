// src/components/LogoSticker.tsx
import * as THREE from "three";
import { useMemo } from "react";
import { useLoader, createPortal } from "@react-three/fiber";
import { useBoxStore } from "../store/useBoxStore";

type BoxSide = "front" | "back" | "left" | "right" | "top" | "bottom";
type Anchors = { lid?: THREE.Object3D | null; body?: THREE.Object3D | null };

const mm = (v: number) => (Number(v) || 0) / 1000;
const EPS = 0.0004; // ~0.4 мм

const MODEL_FLIP_Z: Record<string, Partial<Record<BoxSide, number>>> = {
  lidBottom: { top: Math.PI, front: Math.PI, left: Math.PI, right: Math.PI, back: 0, bottom: 0 },
  casket:    { top: Math.PI, front: Math.PI, left: Math.PI, right: Math.PI, back: 0, bottom: 0 },
  drawer:    { top: Math.PI, front: Math.PI, left: Math.PI, right: Math.PI, back: 0, bottom: 0 },
  hex:       { top: Math.PI, front: Math.PI, left: Math.PI, right: Math.PI, back: 0, bottom: 0 },
};

/** Вынос по нормали (мм): + наружу, – внутрь. Чиним только lidBottom (nike_shoe_box). */
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

/** Позиция/поворот + универсальный вынос вдоль нормали */
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
  const { w, h } = fitSizeIntoFace(A, B, ratio, aspect);
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
    rotation: number;
    opacity: number;
    flipH?: boolean;
    flipV?: boolean;
  }>;

  const sides = useMemo(() => (["front","back","left","right","top","bottom"] as BoxSide[]), []);
  const flips = MODEL_FLIP_Z[boxType] || {};
  const nudges = MODEL_FACE_NUDGE_MM[boxType] || {};

  return (
    <>
      {sides.map((side) => {
        const data = logos?.[side];
        if (!data || (!data.content && data.type !== "text")) return null;

        const { A, B } = faceDims(side, width, height, depth);
        const nudgeMM = typeof nudges[side] === "number" ? (nudges as any)[side] : 0;
        const { pos, rot } = faceTransform(side, width, height, depth, nudgeMM);

        const ratio = (Number(data.scale && data.scale.x) + Number(data.scale && data.scale.z)) / 2 || 1;
        const op = typeof data.opacity === "number" ? Number(data.opacity) : 1;

        // Смещение в плоскости: top/bottom — (x,z); остальные — (x,y)
        const offset = new THREE.Vector3(
          mm((data.position && data.position.x) || 0),
          side === "top" || side === "bottom" ? 0 : mm((data.position && data.position.y) || 0),
          side === "top" || side === "bottom" ? mm((data.position && data.position.z) || 0) : 0
        );

        // Поворот: базовая поправка + пользовательский
        const baseFlipZ = typeof (flips as any)[side] === "number" ? (flips as any)[side] : 0;
        const addRot = new THREE.Euler(0, 0, baseFlipZ + (data.rotation || 0));

        const mirrorX = data.flipH ? -1 : 1;
        const mirrorY = data.flipV ? -1 : 1;

        const keyId = `logo-${side}`;
        const content =
          <group key={keyId} position={pos} rotation={rot}>
            <group position={offset} rotation={addRot}>
              <group scale={[mirrorX, mirrorY, 1]}>
                {data.type === "image" && data.content ? (
                  <ImagePlane url={String(data.content)} A={A} B={B} ratio={ratio} opacity={op} />
                ) : data.type === "text" && (String(data.content || "").trim()) ? (
                  <TextPlane text={String(data.content)} A={A} B={B} ratio={ratio} opacity={op} />
                ) : null}
              </group>
            </group>
          </group>;

        // Крепим к нужному узлу GLTF:
        //  - top -> anchors.lid (крышка)
        //  - остальное -> anchors.body (корпус/дно)
        const parent = side === "top" ? (anchors && anchors.lid) : (anchors && anchors.body);

        // ВАЖНО: для портала передаём key третьим аргументом
        return parent ? createPortal(content, parent, keyId) : content;
      })}
    </>
  );
}
