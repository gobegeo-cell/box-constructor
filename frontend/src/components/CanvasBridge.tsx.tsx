import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useR3F } from "../store/useR3F";

export default function CanvasBridge() {
  const { gl, scene, camera } = useThree();
  const set = useR3F((s) => s.set);
  useEffect(() => {
    set({ gl, scene, camera });
  }, [gl, scene, camera, set]);
  return null;
}
