import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import * as THREE from 'three';
import { downloadFile } from './downloadFile';

export async function exportGLB(object: THREE.Object3D, fileName: string = 'box.glb') {
  const exporter = new GLTFExporter();

  exporter.parse(
    object,
    async (result) => {
      const blob =
        result instanceof ArrayBuffer
          ? new Blob([result], { type: 'model/gltf-binary' })
          : new Blob([JSON.stringify(result)], { type: 'application/json' });

      await downloadFile(blob, fileName);
      console.log(`Файл "${fileName}" успешно сохранён.`);
    },
    { binary: true }
  );
}
