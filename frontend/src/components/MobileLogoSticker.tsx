// src/components/MobileLogoSticker.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useBoxStore } from "../store/useBoxStore";
import { useFrame, useThree } from "@react-three/fiber";

type BoxSide = "front" | "back" | "left" | "right" | "top" | "bottom";

export default function MobileLogoSticker({ side }: { side?: BoxSide }) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef  = useRef<THREE.Mesh>(null);
  const { gl }   = useThree(); // THREE.WebGLRenderer

  // Сторона: проп -> стор -> 'front'
  const selectedSideFromStore = useBoxStore((s) => s.selectedSide) as BoxSide | undefined;
  const effSide: BoxSide = (side ?? selectedSideFromStore ?? "front") as BoxSide;

  // Лого и габариты (мм)
  const logo     = useBoxStore((s) => s.logos?.[effSide]);
  const widthMM  = useBoxStore((s) => s.width  ?? 250);
  const heightMM = useBoxStore((s) => s.height ?? 80);
  const depthMM  = useBoxStore((s) => s.depth  ?? 160);

  const hasContent = Boolean(logo?.content || logo?.file);

  // Размер логотипа: мм → м
  const w = Math.max(1e-4, (logo?.sizeMM?.w ?? 100) / 1000);
  const h = Math.max(1e-4, (logo?.sizeMM?.h ?? 100) / 1000);

  // Позиция: X и «вторая ось» (для top/bottom — Z, иначе — Y)
  const posX      = (logo?.position?.x ?? 0) / 1000;
  const posSecond = (logo?.position?.y ?? 0) / 1000;

  // Лёгкий отрыв от поверхности (во избежание z-fighting)
  const OFFSET = 0.0002;

  // Базовый трансформ стороны (позиция/поворот группы)
  const { rotation: baseRot, position: basePos } = useMemo(() => {
    const rot = new THREE.Euler();
    const pos3 = new THREE.Vector3();
    const hw = widthMM / 2000;
    const hh = heightMM / 2000;
    const hd = depthMM / 2000;

    switch (effSide) {
      case "front":  pos3.set(0, 0,  hd + OFFSET); break;
      case "back":   pos3.set(0, 0, -hd - OFFSET); rot.set(0, Math.PI, 0); break;
      case "left":   pos3.set(-hw - OFFSET, 0, 0); rot.set(0,  Math.PI/2, 0); break;
      case "right":  pos3.set( hw + OFFSET, 0, 0); rot.set(0, -Math.PI/2, 0); break;
      case "top":    pos3.set(0,  hh + OFFSET, 0); rot.set(-Math.PI/2, 0, 0); break;
      case "bottom": pos3.set(0, -hh - OFFSET, 0); rot.set( Math.PI/2, 0, 0); break;
    }
    return { rotation: rot, position: pos3 };
  }, [effSide, widthMM, heightMM, depthMM]);

  // Локальная позиция наклейки на стороне
  const localPos: [number, number, number] = useMemo(() => {
    if (effSide === "top" || effSide === "bottom") return [posX, 0, posSecond]; // X/Z
    return [posX, posSecond, 0]; // X/Y
  }, [effSide, posX, posSecond]);

  // Поворот (рад) и зеркала (знаки масштаба по X/Y на САМОМ mesh)
  const rotationRad = logo?.rotation ?? 0; // в сторе — радианы
  const flipX = logo?.flipH ? -1 : 1;
  const flipY = logo?.flipV ? -1 : 1;

  // Текстура: <img> → canvas → CanvasTexture (надёжно на Android/мобильных)
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    let disposed = false;
    let texture: THREE.CanvasTexture | null = null;

    async function makeTexture() {
      if (!hasContent) {
        setTex(null);
        return;
      }

      let src = "";
      if (logo?.content?.startsWith("data:") || logo?.content?.startsWith("blob:")) {
        src = logo.content!;
      } else if (logo?.file instanceof File) {
        src = URL.createObjectURL(logo.file);
      } else {
        setTex(null);
        return;
      }

      try {
        const img = new Image();
        (img as any).decoding = "async";
        img.crossOrigin = "anonymous";
        img.onload = () => {
          // взять реальный GL-контекст у рендера
          const glctx = (gl as any).getContext
            ? (gl as any).getContext()
            : (gl as unknown as WebGLRenderingContext | WebGL2RenderingContext);
          const MAX = glctx?.getParameter(glctx.MAX_TEXTURE_SIZE) || 4096;

          const sw = img.naturalWidth || 1;
          const sh = img.naturalHeight || 1;
          const k = Math.min(1, MAX / Math.max(sw, sh));
          const dw = Math.max(1, Math.floor(sw * k));
          const dh = Math.max(1, Math.floor(sh * k));

          const cv = document.createElement("canvas");
          cv.width = dw; cv.height = dh;
          const ctx = cv.getContext("2d")!;
          ctx.clearRect(0, 0, dw, dh);
          ctx.drawImage(img, 0, 0, dw, dh);

          const t = new THREE.CanvasTexture(cv);
          t.flipY = false;
          t.generateMipmaps = false;
          t.minFilter = THREE.LinearFilter;
          t.magFilter = THREE.LinearFilter;
          t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
          // @ts-ignore
          t.colorSpace = (THREE as any).SRGBColorSpace ?? (t as any).encoding;

          if (!disposed) setTex(t);
          texture = t;

          if (src.startsWith("blob:")) {
            try { URL.revokeObjectURL(src); } catch {}
          }
        };
        img.onerror = () => setTex(null);
        img.src = src;
      } catch (e) {
        console.error("[MobileLogoSticker] texture error:", e);
        setTex(null);
      }
    }

    makeTexture();
    return () => {
      disposed = true;
      if (texture) texture.dispose();
      setTex(null);
    };
  }, [logo?.content, logo?.file, gl, hasContent]);

  // Мягкий отклик при выборе стороны: теперь пульсируем ГРУППУ, а не mesh,
  // чтобы не перезаписывать знаки масштаба (flip)
  const isSelected = selectedSideFromStore === effSide;
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const pulse = isSelected ? 1 + Math.sin(clock.getElapsedTime() * 5) * 0.01 : 1;
    groupRef.current.scale.set(pulse, pulse, pulse);
  });

  // null только ПОСЛЕ всех хуков — стабильно
  if (!hasContent || !tex) return null;

  return (
    <group
      ref={groupRef}
      position={basePos}
      rotation={baseRot}
      frustumCulled={false}
      renderOrder={10}
    >
      <mesh
        ref={meshRef}
        position={localPos}
        rotation={[0, 0, rotationRad]}
        // ВАЖНО: зеркала живут ЗДЕСЬ и не перезатираются пульсацией
        scale={[flipX, flipY, 1]}
      >
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial
          map={tex}
          transparent
          opacity={logo?.opacity ?? 1}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
