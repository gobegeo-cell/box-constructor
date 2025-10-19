// src/components/BoxModel.tsx
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Html } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { useBoxStore } from "../store/useBoxStore";
import LogoSticker from "./LogoSticker";
import useIsMobile from "../hooks/useIsMobile";

// ✅ Лениво импортируем мобильную версию
const MobileLogoSticker = lazy(() => import("./MobileLogoSticker"));

type AnyObj = THREE.Object3D & { isMesh?: boolean; material?: any };

export default function BoxModel() {
  const { gl } = useThree();
  const isMobile = useIsMobile(900);

  // === выбор модели по типу
  const boxType = useBoxStore((s) => s.boxType);
  const modelMap: Record<string, string> = {
    lidBottom: "nike_shoe_box.glb",
    casket: "casket.glb",
    drawer: "drawer.glb",
    hex: "hex.glb",
  };
  const base = import.meta.env.BASE_URL || "/";
  const modelPath = `${base}model/${modelMap[boxType] || modelMap.lidBottom}`;

  const { scene, animations } = useGLTF(modelPath) as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };

  // === store
  const { sideColors, color, width, height, depth } = useBoxStore((s) => ({
    sideColors: s.sideColors,
    color: s.color,
    width: s.width,
    height: s.height,
    depth: s.depth,
  }));

  // === анимация крышки
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const lidAction = useRef<THREE.AnimationAction | null>(null);
  const [lidOpen, setLidOpen] = useState(false);

  useEffect(() => {
    if (!animations?.length) return;
    const mx = new THREE.AnimationMixer(scene);
    mixer.current = mx;
    const clip =
      animations.find((c) => String(c.name || "").toLowerCase().includes("lid")) ||
      animations[0];
    const act = mx.clipAction(clip);
    act.clampWhenFinished = true;
    act.loop = THREE.LoopOnce;
    lidAction.current = act;
    return () => {
      try {
        mx.stopAllAction();
      } catch {}
    };
  }, [scene, animations]);

  useFrame((_, dt) => mixer.current?.update(dt));

  // === клонирование материалов
  const [materialsCloned, setMaterialsCloned] = useState(false);
  useEffect(() => {
    if (materialsCloned) return;
    scene.traverse((o: AnyObj) => {
      if (o.isMesh && o.material) {
        o.material = o.material.clone();
        o.castShadow = o.receiveShadow = true;
      }
    });
    setMaterialsCloned(true);
  }, [scene, materialsCloned]);

  // === базовый размер модели
  const baseSizeRef = useRef<THREE.Vector3 | null>(null);
  useEffect(() => {
    baseSizeRef.current = null;
  }, [modelPath]);

  useEffect(() => {
    if (baseSizeRef.current) return;
    const clone = scene.clone(true);
    clone.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(clone);
    const s = new THREE.Vector3();
    b.getSize(s);
    baseSizeRef.current = new THREE.Vector3(s.x || 0.001, s.y || 0.001, s.z || 0.001);
  }, [scene]);

  // === масштабирование под width/height/depth
  useEffect(() => {
    if (!baseSizeRef.current) return;
    const b = baseSizeRef.current;
    scene.scale.set((width / 1000) / b.x, (height / 1000) / b.y, (depth / 1000) / b.z);
    scene.updateMatrixWorld(true);
  }, [scene, width, height, depth]);

  // === покраска граней
  useEffect(() => {
    const fallback = color || "#E8E8E8";
    const colors =
      Array.isArray(sideColors) && sideColors.length === 6
        ? sideColors
        : [fallback, fallback, fallback, fallback, fallback, fallback];

    const has = (s?: string, keys: string[]) => !!s && keys.some((k) => s.toLowerCase().includes(k));
    const inGroup = (node: THREE.Object3D | null, keys: string[]) => {
      for (let cur: THREE.Object3D | null = node; cur; cur = cur.parent ?? null) {
        if (has(cur.name, keys)) return true;
      }
      return false;
    };

    const sceneBox = new THREE.Box3().setFromObject(scene);
    const min = sceneBox.min.clone();
    const max = sceneBox.max.clone();

    const sideIndexByPosition = (o: AnyObj): number => {
      const b = new THREE.Box3().setFromObject(o);
      const c = new THREE.Vector3();
      b.getCenter(c);
      const distPlusZ = Math.max(0, max.z - c.z);
      const distMinusZ = Math.max(0, c.z - min.z);
      const distMinusX = Math.max(0, c.x - min.x);
      const distPlusX = Math.max(0, max.x - c.x);
      const distPlusY = Math.max(0, max.y - c.y);
      const distMinusY = Math.max(0, c.y - min.y);
      const arr = [distPlusZ, distMinusZ, distMinusX, distPlusX, distPlusY, distMinusY];
      const idx = arr.indexOf(Math.min(...arr));
      return idx;
    };

    const getSideIndex = (o: AnyObj, matName: string): number => {
      const nm = (o.name || "").toLowerCase();
      if (
        has(matName, ["mat_lid"]) ||
        has(nm, ["lid", "cover", "top", "sleeve"]) ||
        inGroup(o, ["lid", "cover", "top", "sleeve"])
      )
        return 4;
      if (
        has(matName, ["material_bottom_"]) ||
        has(nm, ["bottom", "base", "tray", "body"]) ||
        inGroup(o, ["bottom", "base", "tray", "body"])
      )
        return 5;
      if (has(nm, ["front"])) return 0;
      if (has(nm, ["back"])) return 1;
      if (has(nm, ["left"])) return 2;
      if (has(nm, ["right"])) return 3;
      return sideIndexByPosition(o);
    };

    const paint = (m: any, hex: string) => {
      const one = (mat: any) => {
        if (!mat) return;
        if (mat.map) {
          mat.map.dispose?.();
          mat.map = null;
        }
        mat.vertexColors = false;
        mat.color?.set?.(hex);
        mat.needsUpdate = true;
      };
      Array.isArray(m) ? m.forEach(one) : one(m);
    };

    scene.traverse((o: AnyObj) => {
      if (!o.isMesh) return;
      const material: any = o.material;
      const matName = Array.isArray(material)
        ? (material[0]?.name || "").toLowerCase()
        : (material?.name || "").toLowerCase();

      const idx = getSideIndex(o, matName);
      paint(material, colors[idx] ?? fallback);
    });
  }, [scene, sideColors, color]);

  // ===== Кнопка крышки
  const toggleLid = () => {
    if (!lidAction.current) return;
    if (!lidOpen) {
      lidAction.current.reset();
      lidAction.current.setEffectiveTimeScale(1);
      lidAction.current.play();
    } else {
      lidAction.current.time = lidAction.current.getClip().duration;
      lidAction.current.setEffectiveTimeScale(-1);
      lidAction.current.play();
    }
    setLidOpen((v) => !v);
  };

  const btnStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "#CC0000",
    color: "#FFFFFF",
    cursor: "pointer",
    fontWeight: 700,
    boxShadow: "0 8px 24px rgba(0,0,0,.15)",
    userSelect: "none",
  };

  return (
    <>
      <primitive object={scene} dispose={null} />
      {/* ✅ Lazy подгрузка мобильного Sticker */}
      {isMobile ? (
        <Suspense fallback={null}>
          <MobileLogoSticker />
        </Suspense>
      ) : (
        <LogoSticker />
      )}

      {/* Кнопка крышки */}
      <Html fullscreen>
        <div style={{ position: "absolute", right: 16, bottom: 16, zIndex: 20 }}>
          <button onClick={toggleLid} style={btnStyle}>
            {lidOpen ? "Закрыть крышку" : "Открыть крышку"}
          </button>
        </div>
      </Html>
    </>
  );
}

// === Предзагрузка моделей
useGLTF.preload(`${import.meta.env.BASE_URL || "/"}model/nike_shoe_box.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL || "/"}model/casket.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL || "/"}model/drawer.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL || "/"}model/hex.glb`);
