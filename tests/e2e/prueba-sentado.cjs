/**
 * Prueba de "La plaza que se vacía" jugando SENTADO, del tiro (control y mano) y del chico que
 * va a buscar la pelota detrás del jugador.
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

    // El chico va a buscar la pelota que quedó justo DETRÁS del jugador: lo rodea sin trabarse.
    await ev(() => {
      const g = __juego.guion.capitulo;
      const p = __juego.pelota;
      __dispositivoXR.controllers.right.updateButtonValue('trigger', 0);
      for (const m of __juego.manos.manos) if (m.agarrado) __juego.manos.soltar(m, false);
      p.estado = 'reposo'; p.duenio = null; p.velocidad.set(0, 0, 0);
      p.raiz.position.set(0, p.radio, 2.0); // detrás del jugador (que mira hacia -Z)
      g.pasador.activo = true;
      g.pasador.estado = 'esperaRetorno';
      g.pasador.pases = 0;
      window.__minDist = 9;
      window.__idDist = setInterval(() => {
        const c = g.pasador.chico, j = __juego.camara.getWorldPosition(new __juego.THREE.Vector3());
        window.__minDist = Math.min(window.__minDist, Math.hypot(c.posicion.x - j.x, c.posicion.z - j.z));
      }, 30);
    });
    const recuperada = await esperarQue(() => __juego.guion.capitulo.pasador.pases >= 1, 25000);
    const dmin = await ev(() => { clearInterval(window.__idDist); return window.__minDist; });
    verificar(recuperada, 'el chico rodea al jugador y recupera la pelota que quedó detrás (no se traba)');
    verificar(dmin >= 0.65, `sin atravesar al jugador (distancia mínima ${dmin.toFixed(2)} m)`);

    // Tiro con la MANO: la pelota sale hacia donde se movió la mano.
    await ev(() => { __juego.guion.capitulo.pasador.activo = false; __dispositivoXR.primaryInputMode = 'hand'; });
    await pagina.waitForTimeout(500);
    await ev(() => {
      const d = __dispositivoXR, h = d.hands.right;
      h.poseId = 'open';
      h.position.set(0.2, 1.0, -0.35);
    });
    await pagina.waitForTimeout(400);
    // La pelota llega volando a la palma abierta (atajada).
    await ev(() => {
      const m = __juego.manos.manos.find((x) => x.fuente?.handedness === 'right');
      const palma = __juego.manos.puntoDeAgarre(m);
      const p = __juego.pelota;
      p.lanzar(palma.clone().add(new __juego.THREE.Vector3(0, 0.3, -1.5)), palma, 0.5);
      p.lanzadaPor = 'chico';
    });
    verificar(await esperarQue(() => __juego.pelota.estado === 'agarrado', 4000), 'con la mano: ataja la pelota con la palma');
    await pagina.waitForTimeout(600);
    // Tiro en diagonal (adelante a la izquierda y arriba).
    const dir = [-0.5, 0.45, -1];
    await ev((dir) => new Promise((ok) => {
      const h = __dispositivoXR.hands.right;
      const x0 = h.position.x, y0 = h.position.y, z0 = h.position.z, v = 3.2;
      const n = Math.hypot(...dir);
      const t0 = performance.now();
      const id = setInterval(() => {
        const s = (performance.now() - t0) / 1000;
        if (s < 0.22) h.position.set(x0 + dir[0] / n * v * s, y0 + dir[1] / n * v * s, z0 + dir[2] / n * v * s);
        if (s > 0.45) { clearInterval(id); ok(); }
      }, 16);
    }), dir);
    const salio = await esperarQue(() => __juego.pelota.estado === 'cayendo', 3000);
    const vm = await ev(() => __juego.pelota.velocidad.toArray());
    const ang = Math.acos((vm[0] * dir[0] + vm[2] * dir[2]) / (Math.hypot(vm[0], vm[2]) * Math.hypot(dir[0], dir[2]))) * 180 / Math.PI;
    verificar(salio && ang < 20, `con la mano: la pelota sale hacia donde se tiró (desvío ${ang.toFixed(0)}°, velocidad ${vm.map((x) => x.toFixed(1)).join(', ')})`);
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
