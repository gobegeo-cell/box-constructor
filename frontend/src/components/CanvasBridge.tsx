// src/components/CanvasPreviewTap.tsx
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useBoxStore } from "../store/useBoxStore";

export default function CanvasPreviewTap() {
  const { gl } = useThree();
  const setPreview = useBoxStore((s: any) => s.setPreviewDataUrl);
  const acc = useRef(0);

  useFrame((_, delta) => {
    // Обновляем превью ~2 раза в секунду
    acc.current += delta;
    if (acc.current < 0.5) return;
    acc.current = 0;

    try {
      const url = gl.domElement.toDataURL("image/png");
      setPreview?.(url);
    } catch {
      // ignore
    }
  });

  return null;
}
