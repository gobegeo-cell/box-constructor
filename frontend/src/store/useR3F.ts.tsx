import { create } from "zustand";
import * as THREE from "three";

type R3FState = {
  gl: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  camera: THREE.Camera | null;
  set: (v: Partial<R3FState>) => void;
};

export const useR3F = create<R3FState>((set) => ({
  gl: null,
  scene: null,
  camera: null,
  set: (v) => set(v),
}));
