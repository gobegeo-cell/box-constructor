import { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useAnimations, useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';

function GLBScene({ url }: { url: string }) {
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, scene);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    if (names.length > 0) {
      const name = names[0];
      actions[name]?.reset().fadeIn(0.5).play();
      actions[name]?.setLoop(THREE.LoopRepeat, Infinity);
      setCurrent(name);
    }
  }, [actions, names]);

  return (
    <>
      <primitive object={scene} />
      <Html position={[0, 1, 0]}>
        {names.map((name) => (
          <button key={name} onClick={() => {
            actions[current!]?.fadeOut(0.3);
            actions[name]?.reset().fadeIn(0.5).play();
            setCurrent(name);
          }}>{name}</button>
        ))}
      </Html>
    </>
  );
}

export function GLBPreviewWithDrop() {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => fileUrl && URL.revokeObjectURL(fileUrl);
  }, [fileUrl]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.glb')) {
      setFileUrl(URL.createObjectURL(file));
    }
  };

  return (
    <div onDrop={onDrop} onDragOver={(e) => e.preventDefault()} style={{ width: '100%', height: '100%' }}>
      <input ref={inputRef} type="file" accept=".glb" hidden onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          setFileUrl(URL.createObjectURL(file));
        }
      }} />
      <button onClick={() => inputRef.current?.click()} style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }}>Загрузить GLB</button>
      {fileUrl && (
        <Canvas camera={{ position: [0, 1.5, 3] }}>
          <ambientLight />
          <pointLight position={[10, 10, 10]} />
          <OrbitControls />
          <GLBScene url={fileUrl} />
        </Canvas>
      )}
    </div>
  );
}

useGLTF.preload('/model.glb');
