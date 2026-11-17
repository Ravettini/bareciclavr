/**
 * Service worker para jugar sin internet.
 * Estrategia "red primero, caché de respaldo": con conexión siempre se ve la última versión;
 * sin conexión se usa lo guardado en la última visita.
 * Al agregar archivos nuevos (modelos, sonidos), sumalos a ARCHIVOS y subí VERSION.
 */
const VERSION = 'ba-recicla-v2';
const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'icono.svg', 'datos/reglas.json',
  'src/arranque.js', 'src/main.js', 'src/config.js',
  'src/logica/reglas.js', 'src/logica/partida.js',
  'src/escena/plaza.js', 'src/escena/materiales.js', 'src/escena/textos.js', 'src/escena/panel.js',
  'src/escena/contenedores.js', 'src/escena/residuos.js', 'src/escena/boton.js',
  'src/interaccion/manos.js', 'src/interaccion/fisica.js', 'src/interaccion/botonVR.js',
  'src/feedback/sonido.js', 'src/avisos.js',
  'vendor/three/three.module.js', 'vendor/three/three.core.js',
  'vendor/three/addons/webxr/XRHandModelFactory.js', 'vendor/three/addons/webxr/XRHandPrimitiveModel.js',
  'vendor/three/addons/webxr/XRHandMeshModel.js', 'vendor/three/addons/loaders/GLTFLoader.js',
  'vendor/three/addons/utils/BufferGeometryUtils.js', 'vendor/three/addons/utils/SkeletonUtils.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        if (resp.ok) {
          const copia = resp.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copia));
        }
        return resp;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || Response.error())),
  );
});
