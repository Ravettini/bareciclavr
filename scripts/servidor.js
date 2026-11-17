// Servidor estático mínimo, sin dependencias, para desarrollo y para eventos sin internet.
// Uso: npm run serve  -> http://localhost:8080
// En el Quest 2 por USB: adb reverse tcp:8080 tcp:8080 y abrir http://localhost:8080
// (WebXR exige "contexto seguro": https o localhost).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const puerto = Number(process.env.PUERTO || 8080);
const tipos = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.glb': 'model/gltf-binary', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
};
// Solo se publican estas carpetas/archivos (nunca node_modules ni tests).
const permitidos = ['index.html', 'reciclaje.html', 'natalidad.html', 'manifest.webmanifest', 'sw.js', 'icono.svg', 'src/', 'datos/', 'vendor/', 'modelos/', 'sonidos/'];

createServer(async (req, res) => {
  try {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
    if (ruta === '') ruta = 'index.html';
    ruta = normalize(ruta);
    if (ruta.startsWith('..') || !permitidos.some((p) => ruta === p || (p.endsWith('/') && ruta.startsWith(p)))) {
      res.writeHead(404).end('No encontrado');
      return;
    }
    const archivo = join(raiz, ruta);
    if (!(await stat(archivo)).isFile()) throw new Error('no es archivo');
    res.writeHead(200, { 'Content-Type': tipos[extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(archivo));
  } catch {
    res.writeHead(404).end('No encontrado');
  }
}).listen(puerto, () => console.log(`Buenos Aires Recicla VR en http://localhost:${puerto}`));
