import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import * as THREE from 'three';

export function exportGLB(object: THREE.Object3D, fileName: string = 'box.glb') {
  const exporter = new GLTFExporter();

  exporter.parse(
    object,
    (result) => {
      let blob: Blob;
      if (result instanceof ArrayBuffer) {
        blob = new Blob([result], { type: 'model/gltf-binary' });
      } else {
        // На всякий случай, если result не бинарный, но мы указали binary: true, то сериализуем в JSON
        blob = new Blob([JSON.stringify(result)], { type: 'application/json' });
      }

      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    },
    { binary: true }
  );
}

