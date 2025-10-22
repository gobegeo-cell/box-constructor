import * as THREE from "three";
import React, { useEffect, useState, useMemo } from "react";
import { useBoxStore } from "../store/useBoxStore";

export default function LogoTest() {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const side = useBoxStore((s: any) => s.selectedSide) || "top";
  const width = useBoxStore((s) => s.width);
  const height = useBoxStore((s) => s.height);
  const depth = useBoxStore((s) => s.depth);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      "/pchelkin.png",
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.flipY = false;
        t.center.set(0.5, 0.5);
        setTex(t);
      },
      undefined,
      (err) => console.error("❌ Error loading test texture:", err)
    );
  }, []);

  const { position, rotation, size } = useMemo(() => {
    const W = width / 1000;
    const H = height / 1000;
    const D = depth / 1000;
    const pos = new THREE.Vector3();
    const rot = new THREE.Euler();

    switch (side) {
      case "front":  pos.set(0, 0, D / 2 + 0.001); rot.set(0, 0, 0); break;
      case "back":   pos.set(0, 0, -D / 2 - 0.001); rot.set(0, Math.PI, 0); break;
      case "left":   pos.set(-W / 2 - 0.001, 0, 0); rot.set(0, Math.PI / 2, 0); break;
      case "right":  pos.set(W / 2 + 0.001, 0, 0); rot.set(0, -Math.PI / 2, 0); break;
      case "top":    pos.set(0, H / 2 + 0.001, 0); rot.set(-Math.PI / 2, 0, 0); break;
      case "bottom": pos.set(0, -H / 2 - 0.001, 0); rot.set(Math.PI / 2, 0, 0); break;
    }

    return {
      position: pos,
      rotation: rot,
      size: [0.25, 0.15] as [number, number],
    };
  }, [side, width, height, depth]);

  if (!tex) return null;

  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <planeGeometry args={size} />
        <meshBasicMaterial
          map={tex}
          transparent
          opacity={0.9}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
