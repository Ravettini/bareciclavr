/**
 * Prueba de "La plaza que se vacía" jugando SENTADO, y del tiro.
 *  - Con la cabeza a 1,1 m (sentado), el juego sube al jugador hasta que sus ojos queden a ~1,45 m.
 *  - La pelota en el piso salta a la mano cuando se baja la mano (con el gatillo apretado).
 *  - Al tirar, la pelota sale hacia adelante y arriba con la fuerza del movimiento (no se cae).
 *
 * Uso: npm run test:e2e
 */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');

const raiz = path.join(__dirname, '..', '..');
const PUERTO = 8097;
let fallas = 0;
const verificar = (ok, texto) => { console.log(`${ok ? '✔' : '✘'} ${texto}`); if (!ok) fallas++; };

(async () => {
  const servidor = spawn(process.execPath, ['scripts/servidor.js'], { cwd: raiz, env: { ...process.env, PUERTO: String(PUERTO) } });
  await new Promise((ok) => servidor.stdout.once('data', ok));
  const navegador = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pagina = await navegador.newPage({ viewport: { width: 800, height: 450 } });
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(e.message));
  const ev = (fn, arg) => pagina.evaluate(fn, arg);
  const esperarQue = (fn, ms = 15000) => pagina.waitForFunction(fn, null, { timeout: ms, polling: 50 }).then(() => true).catch(() => false);
  try {
    await pagina.goto(`http://localhost:${PUERTO}/natalidad.html?emular=1`);
    await pagina.waitForFunction(() => window.__juego && window.__dispositivoXR);
    // Sentado: la cabeza a 1,1 m del piso.
    await ev(() => __dispositivoXR.position.set(0, 1.1, 0));
    await pagina.getByText('ENTRAR EN VR').click();
    await esperarQue(() => __juego.renderer.xr.isPresenting);
    await esperarQue(() => __juego.rig.position.y > 0.1, 8000);
    const alt = await ev(() => ({ rig: __juego.rig.position.y, ojos: __juego.camara.getWorldPosition(new __juego.THREE.Vector3()).y }));
    verificar(Math.abs(alt.ojos - 1.45) < 0.05, `sentado: los ojos quedan a la altura de un adulto (${alt.ojos.toFixed(2)} m; sube ${alt.rig.toFixed(2)} m)`);

    // La pelota en el piso, cerca: la mano baja con el gatillo apretado y la pelota salta a la mano.
    await ev(() => {
      const p = __juego.pelota;
      __juego.guion.capitulo.pasador.activo = false; // que el chico no intervenga en esta prueba
      p.estado = 'reposo'; p.duenio = null; p.velocidad.set(0, 0, 0);
      p.raiz.position.set(0.15, p.radio, -0.45);
      const c = __dispositivoXR.controllers.right;
      c.position.set(0.15, 0.6, -0.45); // 0,6 m sobre el piso real (sentado no llega más abajo)
      c.quaternion.set(0, 0, 0, 1);
      c.updateButtonValue('trigger', 1);
    });
    verificar(await esperarQue(() => __juego.pelota.estado === 'agarrado', 5000), 'sentado: la pelota salta del piso a la mano');

    // Tiro hacia adelante y arriba, soltando el gatillo cuando el brazo ya frena (como una persona).
    await ev(() => new Promise((ok) => {
      const c = __dispositivoXR.controllers.right;
      const t0 = performance.now();
      const id = setInterval(() => {
        const s = (performance.now() - t0) / 1000;
        if (s < 0.2) c.position.set(0.15, 0.6 + 2.0 * s, -0.45 - 3.0 * s); // tiro
        else if (s < 0.3) c.position.set(0.15, 1.0 - 0.8 * (s - 0.2), -1.05); // el brazo frena y baja
        else { clearInterval(id); c.updateButtonValue('trigger', 0); ok(); }
      }, 16);
    }));
    await esperarQue(() => __juego.pelota.estado === 'cayendo', 2000);
    const v = await ev(() => __juego.pelota.velocidad.toArray());
    // La velocidad se lee unos cuadros después de soltar: la gravedad ya le restó un poco a "y".
    verificar(v[2] < -2.5 && Math.hypot(v[0], v[2]) > 2.5, `el tiro sale hacia adelante con fuerza (velocidad ${v.map((x) => x.toFixed(1)).join(', ')})`);
    const alto = await ev(() => new Promise((ok) => {
      let max = 0;
      const id = setInterval(() => { max = Math.max(max, __juego.pelota.raiz.position.y); }, 20);
      setTimeout(() => { clearInterval(id); ok(max); }, 1500);
    }));
    verificar(alto > 1.0, `la pelota sube después de soltarla (no se cae: altura máxima ${alto.toFixed(2)} m)`);
  } catch (e) {
    verificar(false, 'excepción: ' + e.message);
  } finally {
    verificar(errores.length === 0, `sin errores en la consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
    await navegador.close();
    servidor.kill();
    console.log(fallas ? `\n${fallas} verificación(es) fallaron` : '\nTodas las verificaciones pasaron');
    process.exit(fallas ? 1 : 0);
  }
})();
