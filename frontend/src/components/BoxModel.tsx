// src/components/BoxModel.tsx
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Html } from "@react-three/drei";
import React, {
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
  useMemo,
  useCallback,
} from "react";
import { useBoxStore } from "../store/useBoxStore";
import LogoSticker from "./LogoSticker";
import useIsMobile from "../hooks/useIsMobile";

const MobileLogoSticker = lazy(() => import("./MobileLogoSticker"));

type AnyObj = THREE.Object3D & { isMesh?: boolean; material?: any };
type Anchors = { lid: THREE.Object3D | null; body: THREE.Object3D | null };

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

    // новые типы
    bookBox: "bookBox.glb",
    casketSlider: "casketSlider.glb",
    casketCounterFlap: "casketCounterFlap.glb",
    lidBottomLongFlap: "lidBottomLongFlap.glb",

    // 🆕 добавленные типы
    hexBox: "hexBox.glb",
    vCutHex: "vCutHex.glb",
    tierCasket: "tierCasket.glb",
    angledHex: "angledHex.glb",
  };

  const base = import.meta.env.BASE_URL || "/";
  const modelPath = `${base}model/${modelMap[boxType] || modelMap.lidBottom}`;

  // === грузим GLTF (оригинал из кеша drei)
  const gltf = useGLTF(modelPath) as { scene: THREE.Object3D; animations: THREE.AnimationClip[] };

  // === локальный КЛОН сцены (работаем ТОЛЬКО с ним; оригинал не трогаем)
  const [localScene, setLocalScene] = useState<THREE.Object3D | null>(null);
  const [animations, setAnimations] = useState<THREE.AnimationClip[]>([]);
  const [fade, setFade] = useState(false);

  // Полезный dispose для узла
  const disposeObject = useCallback((root: THREE.Object3D | null | undefined) => {
    if (!root) return;
    try {
      root.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m?.map?.dispose?.());
          else obj.material.map?.dispose?.();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m?.dispose?.());
          else obj.material?.dispose?.();
        }
        if (obj.texture) obj.texture.dispose?.();
      });
    } catch (e) {
      console.warn("[BoxModel] dispose warning:", e);
    }
  }, []);

  // === anchors: держим локально, чтобы портал логотипов ГАРАНТИРОВАННО размонтировался между моделями
  const [anchors, setAnchors] = useState<Anchors>({ lid: null, body: null });

  // вычисляем anchors для текущего localScene
  const computeAnchors = useCallback((scene: THREE.Object3D | null, anims: THREE.AnimationClip[]) => {
    if (!scene) return { lid: null, body: null };

    const lidKeys = ["lid", "cover", "top", "sleeve", "cap"];
    const bodyKeys = ["body", "base", "bottom"];

    // 1) все анимируемые имена (до точки)
    const animatedNames = new Set<string>();
    for (const clip of anims ?? []) {
      for (const track of clip.tracks ?? []) {
        const node = String(track.name).split(".")[0].toLowerCase();
        if (node) animatedNames.add(node);
      }
    }

    // 2) кандидаты
    const lidCandidates: THREE.Object3D[] = [];
    const bodyCandidates: THREE.Object3D[] = [];
    scene.traverse((o) => {
      const n = (o.name || "").toLowerCase();
      if (lidKeys.some((k) => n.includes(k))) lidCandidates.push(o);
      if (bodyKeys.some((k) => n.includes(k))) bodyCandidates.push(o);
    });

    // 3) выбираем lid
    let lid: THREE.Object3D | null =
      lidCandidates.find((o) => animatedNames.has((o.name || "").toLowerCase())) ||
      lidCandidates.find((o) =>
        Array.from(animatedNames).some((an) => {
          const target =
            scene.getObjectByName(an) || scene.getObjectByProperty("name", an);
          let cur: THREE.Object3D | null = target as any;
          while (cur) {
            if (cur === o) return true;
            cur = cur.parent as THREE.Object3D | null;
          }
          return false;
        })
      ) ||
      lidCandidates[0] ||
      null;

    // 4) выбираем body
    let body: THREE.Object3D | null = bodyCandidates[0] || scene;

    if (!lid) {
      console.warn("[anchors] lid not found — animated:", Array.from(animatedNames), "candidates:", lidCandidates.map((o) => o.name));
    }
    return { lid, body };
  }, []);

  // === на смену modelPath: ЧИСТИМ → ГАСИМ → КЛОНИРУЕМ → ВКЛЮЧАЕМ
  useEffect(() => {
    let cancelled = false;

    // 1) мгновенно выключаем наклейки (обнуляем anchors) и «погасим» модель для красивого свопа
    setAnchors({ lid: null, body: null });
    setFade(true);

    // 2) удаляем старый клон (если был) и чистим ресурсы
    setLocalScene((prev) => {
      if (prev) disposeObject(prev);
      return null;
    });

    // 3) маленькая пауза на кадр, чтобы React размонтировал порталы/узлы
    const afterFrame = () => {
      if (cancelled) return;

      // 4) создаём НОВЫЙ клон
      const cloned = gltf.scene.clone(true);
      // клонируем материалы (чтобы не делиться с кешем)
      cloned.traverse((o: AnyObj) => {
        if (o.isMesh && o.material) {
          o.material = o.material.clone();
          o.castShadow = o.receiveShadow = true;
        }
      });

      setAnimations(gltf.animations || []);
      setLocalScene(cloned);

      // 5) ещё кадр — ставим anchors на новый узел (порталы отрендерятся уже в новую сцену)
      requestAnimationFrame(() => {
        if (cancelled) return;
        setAnchors(computeAnchors(cloned, gltf.animations || []));
        // 6) погасить fade
        setFade(false);
      });
    };

    // даём браузеру отрисовать пустую сцену
    requestAnimationFrame(afterFrame);

    // cleanup при уходе / новой смене
    return () => {
      cancelled = true;
      // удаляем текущий клон
      setLocalScene((prev) => {
        if (prev) disposeObject(prev);
        return null;
      });
      // очищаем кеш useGLTF по этому URL — чтобы не залипали материалы/текстуры
      try {
        (useGLTF as any).clear?.(modelPath);
      } catch {}
    };
  }, [modelPath, gltf.scene, gltf.animations, computeAnchors, disposeObject]);

  // === store: цвета/размеры
  const { sideColors, color, insertColor, width, height, depth } = useBoxStore((s) => ({
    sideColors: s.sideColors,
    color: s.color,
    insertColor: s.insertColor,
    width: s.width,
    height: s.height,
    depth: s.depth,
  }));

  // === анимации
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const actions = useRef<Record<string, THREE.AnimationAction>>({});
  const [lidOpen, setLidOpen] = useState(false);

  useEffect(() => {
    if (!localScene || !animations.length) return;
    const mx = new THREE.AnimationMixer(localScene);
    mixer.current = mx;

    actions.current = {};
    animations.forEach((clip) => {
      const name = (clip.name || "").toLowerCase();
      const act = mx.clipAction(clip);
      act.clampWhenFinished = true;
      act.loop = THREE.LoopOnce;
      actions.current[name] = act;
    });

    return () => {
      try {
        mx.stopAllAction();
      } catch {}
      mixer.current = null;
      actions.current = {};
    };
  }, [localScene, animations]);

  useFrame((_, dt) => mixer.current?.update(dt));

  // === базовый размер модели
  const baseSizeRef = useRef<THREE.Vector3 | null>(null);
  useEffect(() => {
    baseSizeRef.current = null;
  }, [modelPath]);

  useEffect(() => {
    if (!localScene || baseSizeRef.current) return;
    const clone = localScene.clone(true);
    clone.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(clone);
    const s = new THREE.Vector3();
    b.getSize(s);
    baseSizeRef.current = new THREE.Vector3(s.x || 0.001, s.y || 0.001, s.z || 0.001);
  }, [localScene]);

  // === масштаб под width/height/depth
  useEffect(() => {
    if (!localScene || !baseSizeRef.current) return;
    const b = baseSizeRef.current;
    localScene.scale.set((width / 1000) / b.x, (height / 1000) / b.y, (depth / 1000) / b.z);
    localScene.updateMatrixWorld(true);
  }, [localScene, width, height, depth]);

  // === покраска (включая insert)
  useEffect(() => {
    if (!localScene) return;
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

    const sceneBox = new THREE.Box3().setFromObject(localScene);
    const min = sceneBox.min.clone();
    const max = sceneBox.max.clone();

    const sideIndexByPosition = (o: AnyObj): number => {
      const b = new THREE.Box3().setFromObject(o);
      const c = new THREE.Vector3();
      b.getCenter(c);
      const distPlusZ = Math.max(0, max.z - c.z); // front
      const distMinusZ = Math.max(0, c.z - min.z); // back
      const distMinusX = Math.max(0, c.x - min.x); // left
      const distPlusX = Math.max(0, max.x - c.x); // right
      const distPlusY = Math.max(0, max.y - c.y); // top
      const distMinusY = Math.max(0, c.y - min.y); // bottom
      const arr = [distPlusZ, distMinusZ, distMinusX, distPlusX, distPlusY, distMinusY];
      return arr.indexOf(Math.min(...arr));
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

      if (has(nm, ["front", "flap"]) || inGroup(o, ["front", "flap"])) return 0;
      if (has(nm, ["back"]) || inGroup(o, ["back"])) return 1;
      if (has(nm, ["left"]) || inGroup(o, ["left"])) return 2;
      if (has(nm, ["right"]) || inGroup(o, ["right"])) return 3;

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

    localScene.traverse((o: AnyObj) => {
      if (!o.isMesh) return;
      const material: any = o.material;
      const name = (o.name || "").toLowerCase();
      const matName = Array.isArray(material)
        ? (material[0]?.name || "").toLowerCase()
        : (material?.name || "").toLowerCase();

      if (name.includes("insert") || matName.includes("insert")) {
        paint(material, insertColor ?? fallback);
        return;
      }

      const idx = getSideIndex(o, matName);
      paint(material, colors[idx] ?? fallback);
    });
  }, [localScene, sideColors, color, insertColor]);

  // ===== Кнопка крышки: проигрываем все релевантные клипы
  const toggleLid = () => {
    if (!mixer.current || !actions.current) return;

    const names = Object.keys(actions.current);
    const match = (n: string) => /lid|cover|frontflap|inner|tray|leftpart|rightpart/i.test(n);
    const forward = !lidOpen;

    names.forEach((n) => {
      if (!match(n)) return;
      const a = actions.current[n];
      a.reset();
      a.paused = false;
      a.enabled = true;
      a.setEffectiveTimeScale(forward ? 1 : -1);
      a.play();
    });

    setLidOpen((v) => !v);
  };

  // === эффект плавного появления модели при смене типа
  useEffect(() => {
    setFade(true);
    const t = setTimeout(() => setFade(false), 400);
    return () => clearTimeout(t);
  }, [boxType]);

  // === логотип по умолчанию (если совсем пусто)
  useEffect(() => {
    const baseLogo = `${import.meta.env.BASE_URL}your-logo-8C4B2E.png`;
    try {
      const hasLogo = Object.values(useBoxStore.getState().logos).some((l) => l?.content);
      if (!hasLogo) {
        useBoxStore.getState().setLogoForSide("top", {  
          type: "image",
          content: baseLogo,
          position: { x: 0, y: 0, z: 0 },
          scale: { x: 1, z: 1 },
          opacity: 1,
        });
      }
    } catch (err) {
      console.warn("Не удалось добавить логотип:", err);
    }
  }, [boxType]);

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
    <group key={`root-${modelPath}`}> {/* 🚩 ключ на всю под-сцену */}
      {localScene && (
        <primitive
          key={`box-${modelPath}`}      // 🚩 ключ, зависящий от пути модели
          object={localScene}
          // никаких dispose={null}; мы чистим вручную + three сможет авто-диспозить остальное
          style={{
            transition: "opacity 0.4s ease-in-out",
            opacity: fade ? 0 : 1,
          }}
        />
      )}

      {isMobile ? (
  <Suspense fallback={null}>
    <MobileLogoSticker anchors={anchors} />
  </Suspense>
) : (
  <LogoSticker anchors={anchors} />
)}

<Html fullscreen>
  <div
    style={{
      position: "absolute",
      right: 16,
      bottom: 16,
      zIndex: 20,
      display: "flex",
      flexDirection: "row", // кнопки в ряд
      gap: 10,
    }}
  >
    {/* 🔴 Кнопка крышки */}
    <button onClick={toggleLid} style={btnStyle}>
      {lidOpen ? "Закрыть крышку" : "Открыть крышку"}
    </button>

    {/* 🔄 Новая кнопка поворота логотипов */}
    <button
      onClick={() => {
        const state = useBoxStore.getState();
        const { logos, setLogoForSide } = state;

        Object.entries(logos).forEach(([side, logo]) => {
          if (!logo) return;

          // вычисляем текущий угол
          const currentRot =
            typeof logo.rotation === "number"
              ? logo.rotation
              : logo.rotation?.y || 0;

          // добавляем 180°
          const newRot = (currentRot + Math.PI) % (Math.PI * 2);

          setLogoForSide(side as any, {
            ...logo,
            rotation: newRot,
            rotation_deg: (newRot * 180) / Math.PI,
          });
        });
      }}
      style={{
        ...btnStyle,
        background: "#007ACC",
        boxShadow: "0 8px 24px rgba(0,0,0,.25)",
      }}
    >
      Повернуть логотип
    </button>
  </div>
</Html>
</group>
);
}

// === Предзагрузка моделей
useGLTF.preload(`${import.meta.env.BASE_URL || "/"}model/nike_shoe_box.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL || "/"}model/casket.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL || "/"}model/drawer.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL || "/"}model/hex.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL || "/"}model/bookBox.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL || "/"}model/casketSlider.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL || "/"}model/casketCounterFlap.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL || "/"}model/lidBottomLongFlap.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL || "/"}model/hexBox.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL || "/"}model/vCutHex.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL || "/"}model/tierCasket.glb`);
useGLTF.preload(`${import.meta.env.BASE_URL || "/"}model/angledHex.glb`);
