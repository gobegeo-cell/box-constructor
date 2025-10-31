import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { useBoxStore } from "../store/useBoxStore";

export default function LojementModel() {
  const { scene } = useGLTF("/model/insert_lojem.glb") as { scene: THREE.Group };

  const prevAngle = useRef(0);

  const {
    width,
    height,
    depth,
    boxType,
    lojementVisible,
    lojementDepth,
    kalisOffset,
    kalisAngle,
    kalisThickness,
  } = useBoxStore((s) => ({
    width: s.width,
    height: s.height,
    depth: s.depth,
    boxType: s.boxType,
    lojementVisible: s.lojementVisible,
    lojementDepth: s.lojementDepth,
    kalisOffset: s.kalisOffset,
    kalisAngle: s.kalisAngle,
    kalisThickness: s.kalisThickness,
  }));

  useEffect(() => {
    if (!scene) return;

    const base = scene.getObjectByName("Lojement");
    const kalisL = scene.getObjectByName("Kalis_L");
    const kalisR = scene.getObjectByName("Kalis_R");
    if (!base) return;

    const margin = 0.95;
    const innerWidth = width * margin;
    const innerDepth = depth * margin;
    const innerHeight = lojementDepth;

    base.scale.set(innerWidth / 1000, innerDepth / 1000, innerHeight / 1000);

    const offsetZ =
      boxType === "lidBottom" || boxType === "lidBottomLongFlap"
        ? -height / 2000
        : -height / 2500;

    base.position.set(0, 0, offsetZ);

    if (kalisL && kalisR) {
      const availableW = (innerWidth / 2000) * margin;
      const availableD = (innerDepth / 2000) * margin;
      const safeOffset = Math.min(kalisOffset / 1000, Math.min(availableW, availableD) * 0.8);

      const angle = THREE.MathUtils.degToRad(kalisAngle);
      const wallThickness = Math.max(0.001, kalisThickness / 1000);
      const heightScale = (lojementDepth / 50) * 1.1;

      // определяем, был ли поворот
      const wasAngle = prevAngle.current;
      const isAngle = kalisAngle;
      prevAngle.current = kalisAngle;

      // позиционируем логически — без "скачка"
      if (isAngle === 0) {
        kalisL.position.set(-safeOffset, 0, 0);
        kalisR.position.set(safeOffset, 0, 0);
      } else if (isAngle === 90 && wasAngle === 0) {
        kalisL.position.set(0, -safeOffset, 0);
        kalisR.position.set(0, safeOffset, 0);
      } else if (isAngle === 0 && wasAngle === 90) {
        kalisL.position.set(-safeOffset, 0, 0);
        kalisR.position.set(safeOffset, 0, 0);
      }

      kalisL.rotation.z = angle;
      kalisR.rotation.z = angle;

      kalisL.scale.set(wallThickness * 100, 1, heightScale);
      kalisR.scale.set(wallThickness * 100, 1, heightScale);
    }
  }, [
    scene,
    width,
    height,
    depth,
    boxType,
    lojementDepth,
    kalisOffset,
    kalisAngle,
    kalisThickness,
  ]);

  if (!lojementVisible) return null;

  return <primitive object={scene} dispose={null} />;
}

useGLTF.preload("/model/insert_lojem.glb");
