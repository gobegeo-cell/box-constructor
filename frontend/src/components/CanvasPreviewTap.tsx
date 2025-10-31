// src/components/CanvasPreviewTap.tsx
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useBoxStore } from "../store/useBoxStore";

export default function CanvasPreviewTap() {
  const { gl } = useThree();
  const setPreview = useBoxStore((s: any) => s.setPreviewDataUrl);
  const acc = useRef(0);

  useFrame((_, delta) => {
    // Делаем превью не чаще 1 раза в 5 секунд (раньше было ~2/сек)
    acc.current += delta;
    if (acc.current < 5) return;
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
