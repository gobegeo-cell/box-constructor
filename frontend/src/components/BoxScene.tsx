import * as React from "react";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Vector3 } from "three";
import { useThree, useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useBoxStore } from "../store/useBoxStore";

import CASKET_URL from "/models/casket.glb?url";
import DRAWER_URL from "/models/drawer.glb?url";
import LIDBOTTOM_URL from "/models/lidBottom.glb?url";

type BoxType = "lidBottom" | "casket" | "drawer" | "hex";
const MODEL_MAP: Record<BoxType, string> = {
  casket: CASKET_URL,
  drawer: DRAWER_URL,
  lidBottom: LIDBOTTOM_URL,
  hex: LIDBOTTOM_URL,
};

export default function BoxScene() {
  const { width, height, depth, sideColors, boxType, logos } = useBoxStore((s: any) => ({
    width: s.width, height: s.height, depth: s.depth,
    sideColors: s.sideColors, boxType: s.boxType, logos: s.logos,
  }));

  const w = Math.max(10, Number(width || 250)) / 1000;
  const h = Math.max(10, Number(height || 80)) / 1000;
  const d = Math.max(10, Number(depth || 160)) / 1000;
  const targetSize = useMemo(() => new Vector3(w, h, d), [w, h, d]);

  const { camera, size } = useThree();
  useEffect(() => {
    const isMobile = size.width <= 900;
    camera.position.set(0.4, isMobile ? 0.5 : 0.35, isMobile ? 1.0 : 0.6);
    camera.updateProjectionMatrix();
  }, [size.width, camera]);

  const primaryUrl = (MODEL_MAP as any)[boxType as BoxType] || LIDBOTTOM_URL;
  const { scene } = useGLTF(primaryUrl, true) as any;

  const selectedSide: string | undefined = useBoxStore.getState().selectedSide;
  const pickLogoUrl = (): string | null => {
    const order = [selectedSide, "front", "top", "right", "left", "back", "bottom"].filter(Boolean) as string[];
    for (const key of order) {
      const u = logos?.[key]?.content;
      if (u) return String(u);
    }
    const any = Object.values(logos || {}).find((x: any) => x?.content);
    return any ? String((any as any).content) : null;
  };
  const logoUrl = pickLogoUrl();

  const needCORS = !!logoUrl && /^(https?:)?\/\//i.test(String(logoUrl));
  const logoTexture = logoUrl
    ? useLoader(THREE.TextureLoader, String(logoUrl), (ldr) => { if (needCORS) ldr.setCrossOrigin("anonymous"); })
    : null;

  // ✅ фикс для пересоздания сцены — повторное применение логотипа
  useEffect(() => {
    if (!scene) return;
    const mesh = scene.getObjectByName("LogoPlane") as THREE.Mesh | null;
    if (!mesh) return;

    const mat: any = Array.isArray((mesh as any).material)
      ? (mesh as any).material[0]
      : (mesh as any).material;
    if (!mat) return;

    if (!logoTexture) {
      if (mat.map) { mat.map = null; mat.needsUpdate = true; }
      return;
    }

    logoTexture.flipY = false;
    // @ts-ignore
    logoTexture.colorSpace = THREE.SRGBColorSpace || THREE.sRGBEncoding;
    logoTexture.anisotropy = 4;
    logoTexture.needsUpdate = true;

    mat.map = logoTexture;
    mat.transparent = true;
    mat.depthWrite = true;
    mat.side = THREE.DoubleSide;
    mat.needsUpdate = true;
  }, [logoTexture, scene]);

  // повторная подстраховка через traverse (на мобайле срабатывает позже)
  useEffect(() => {
    if (!scene || !logoTexture) return;
    setTimeout(() => {
      scene.traverse((obj: any) => {
        if (obj.name === "LogoPlane" && obj.material) {
          const mat: any = Array.isArray(obj.material) ? obj.material[0] : obj.material;
          mat.map = logoTexture;
          mat.needsUpdate = true;
        }
      });
    }, 200);
  }, [scene, logoTexture]);

  const mainColor = Array.isArray(sideColors) ? sideColors[0] || "#cccccc" : "#cccccc";

  return (
    <group>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 6, 4]} intensity={1.0} castShadow />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -h / 2 - 0.001, 0]} receiveShadow>
        <planeGeometry args={[5, 5]} />
        <meshStandardMaterial color="#f3f3f3" />
      </mesh>

      {scene ? (
        <group scale={[w, h, d]}>
          <primitive object={scene} />
        </group>
      ) : (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={mainColor} roughness={0.6} metalness={0.05} />
        </mesh>
      )}
    </group>
  );
}

useGLTF.preload(CASKET_URL);
useGLTF.preload(DRAWER_URL);
useGLTF.preload(LIDBOTTOM_URL);
