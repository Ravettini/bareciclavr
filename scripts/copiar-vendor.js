// Copia a /vendor solo los archivos de three.js (y del emulador IWER) que usa el juego.
// El juego no carga nada desde internet: todo se sirve localmente para funcionar offline.
// Uso: npm run vendor  (después de npm install, o al actualizar three.js)
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(raiz, 'node_modules');
const destino = join(raiz, 'vendor');

const archivos = [
  ['three/build/three.module.js', 'three/three.module.js'],
  ['three/build/three.core.js', 'three/three.core.js'],
  ['three/LICENSE', 'three/LICENSE'],
  ['three/examples/jsm/webxr/XRHandModelFactory.js', 'three/addons/webxr/XRHandModelFactory.js'],
  ['three/examples/jsm/webxr/XRHandPrimitiveModel.js', 'three/addons/webxr/XRHandPrimitiveModel.js'],
  ['three/examples/jsm/webxr/XRHandMeshModel.js', 'three/addons/webxr/XRHandMeshModel.js'],
  ['three/examples/jsm/loaders/GLTFLoader.js', 'three/addons/loaders/GLTFLoader.js'],
  ['three/examples/jsm/utils/BufferGeometryUtils.js', 'three/addons/utils/BufferGeometryUtils.js'],
  ['three/examples/jsm/utils/SkeletonUtils.js', 'three/addons/utils/SkeletonUtils.js'],
  // Emulador de WebXR de Meta: solo se carga con ?emular=1 (pruebas sin visor).
  ['iwer/build/iwer.module.js', 'iwer/iwer.module.js'],
  ['iwer/LICENSE', 'iwer/LICENSE'],
];

rmSync(destino, { recursive: true, force: true });
for (const [origen, dest] of archivos) {
  const d = join(destino, dest);
  mkdirSync(dirname(d), { recursive: true });
  cpSync(join(nm, origen), d);
  console.log('copiado', dest);
}
