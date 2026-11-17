/**
 * Prueba de punta a punta de "La plaza que se vacía" en VR emulado (Meta IWER, Quest 2).
 * Corre el guion 4 veces más rápido (?rapido=4); la física de la pelota va a velocidad real.
 *
 * Uso: npm run test:e2e
 */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..', '..');
const capturas = path.join(__dirname, 'capturas');
const PUERTO = 8092;
let fallas = 0;
const verificar = (ok, texto) => { console.log(`${ok ? '✔' : '✘'} ${texto}`); if (!ok) fallas++; };

(async () => {
  mkdirSync(capturas, { recursive: true });
  const servidor = spawn(process.execPath, ['scripts/servidor.js'], { cwd: raiz, env: { ...process.env, PUERTO: String(PUERTO) } });
  await new Promise((ok) => servidor.stdout.once('data', ok));
  const navegador = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pagina = await navegador.newPage({ viewport: { width: 1280, height: 720 } });
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(e.message));
  pagina.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  const esperar = (ms) => pagina.waitForTimeout(ms);
  const ev = (fn, arg) => pagina.evaluate(fn, arg);
  const esperarQue = (fn, ms = 20000, arg) => pagina.waitForFunction(fn, arg, { timeout: ms, polling: 50 }).then(() => true).catch(() => false);

  try {
    await pagina.goto(`http://localhost:${PUERTO}/natalidad.html?emular=1&rapido=4`);
    await pagina.waitForFunction(() => window.__juego && window.__dispositivoXR);
    await pagina.getByText('ENTRAR EN VR').click();
    verificar(await esperarQue(() => __juego.renderer.xr.isPresenting, 10000), 'entra en VR con el Quest 2 emulado');
    verificar(await ev(() => __juego.guion.fase) === 'juego', 'al entrar en VR empieza la escena de 2014');

    await ev(() => {
      const { THREE } = __juego;
      const d = __dispositivoXR;
      window.__prueba = {
        mover(mano, p) { d.controllers[mano].position.set(...p); d.controllers[mano].quaternion.set(0, 0, 0, 1); },
        gatillo(mano, v) { d.controllers[mano].updateButtonValue('trigger', v); },
        // Mueve el control con velocidad constante durante "ms" y suelta el gatillo al final (un tiro).
        tirar(mano, desde, vel, ms = 160) {
          return new Promise((ok) => {
            const t0 = performance.now();
            const id = setInterval(() => {
              const s = (performance.now() - t0) / 1000;
              d.controllers[mano].position.set(desde[0] + vel[0] * s, desde[1] + vel[1] * s, desde[2] + vel[2] * s);
              if (s * 1000 >= ms) { clearInterval(id); d.controllers[mano].updateButtonValue('trigger', 0); ok(); }
            }, 16);
          });
        },
        pelota() { const p = __juego.pelota; return { estado: p.estado, pos: p.raiz.position.toArray() }; },
        guion() { const g = __juego.guion; return { fase: g.fase, anio: g.anio, presentes: g.presentes, pases: g.pases, pelotero: g.estadoPelotero, panel: __juego.panel.ultimo }; },
        poseCaptura() {
          d.controllers.left.position.set(-0.35, 1.0, -0.3);
          d.controllers.right.position.set(0.35, 1.0, -0.3);
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.12);
          d.quaternion.set(q.x, q.y, q.z, q.w);
        },
      };
    });
    const capturar = async (nombre) => { await ev(() => __prueba.poseCaptura()); await esperar(200); await pagina.screenshot({ path: path.join(capturas, nombre) }); };
    await capturar('n0-plaza-2014.png');

    // 1) El chico tira la pelota; el jugador la ataja con el gatillo apretado.
    const cabeza = await ev(() => __juego.camara.getWorldPosition(new __juego.THREE.Vector3()).toArray());
    const atajada = [cabeza[0], Math.max(0.8, cabeza[1] - 0.5), cabeza[2] - 0.45];
    await ev((p) => { __prueba.mover('right', p); __prueba.gatillo('right', 1); }, atajada);
    verificar(await esperarQue(() => __juego.pelota.estado === 'lanzada', 8000), 'el chico le tira la pelota al jugador');
    verificar(await esperarQue(() => __juego.pelota.estado === 'agarrado', 4000), 'el jugador ataja la pelota en el aire (con el gatillo apretado)');
    await capturar('n1-atajada.png');

    // 2) El jugador se la devuelve: el chico la ataja.
    // Si el tiro sale flojo y la pelota queda cerca, el jugador la vuelve a agarrar y tirar
    // (en el emulador la fuerza del tiro depende de la velocidad de cuadros).
    let recuperada = false;
    for (let intento = 0; intento < 3 && !recuperada; intento++) {
      if (intento > 0) {
        const pe = await ev(() => __prueba.pelota());
        if (pe.estado === 'enChico') break;
        await ev((p) => { __prueba.mover('right', p); __prueba.gatillo('right', 1); }, [pe.pos[0], pe.pos[1] + 0.02, pe.pos[2]]);
        await esperarQue(() => __juego.pelota.estado === 'agarrado', 2000);
      }
      await ev((p) => __prueba.tirar('right', p, [0, 2.2, -4.0], 260), atajada);
      recuperada = await esperarQue(() => __juego.guion.pases >= 1, 8000);
      if (!recuperada) {
        const pe = await ev(() => __prueba.pelota());
        console.log(`  (tiro ${intento + 1}: la pelota quedó en ${pe.pos.map((v) => v.toFixed(1))}, se reintenta)`);
      }
    }
    verificar(recuperada, 'el jugador tira la pelota y el chico la recupera (la ataja o la va a buscar)');

    // 3) Pasa el tiempo: los chicos se van.
    verificar(await esperarQue(() => __juego.guion.fase === 'tiempo', 20000), 'empieza a pasar el tiempo (2015…)');
    await esperarQue(() => __juego.guion.anio >= 2019, 15000);
    let g = await ev(() => __prueba.guion());
    verificar(g.presentes < 16, `en ${g.anio} ya se fueron chicos (quedan ${g.presentes})`);
    await capturar('n2-tiempo.png');
    verificar(await esperarQue(() => __juego.guion.fase === 'tiroFinal', 20000), 'llega 2024');
    g = await ev(() => __prueba.guion());
    verificar(g.presentes === 8, `en 2024 queda la mitad de los chicos (${g.presentes} de 16)`);
    verificar(g.pelotero === 'ido', 'el chico de la pelota ya no está');

    // 4) Tiro final: la pelota vuelve rodando, el jugador la tira y nadie la devuelve.
    verificar(await esperarQue(() => __juego.pelota.estado === 'reposo' || __juego.pelota.estado === 'agarrado', 10000), 'la pelota vuelve rodando sola hasta el jugador');
    const pel = await ev(() => __prueba.pelota());
    const distancia = Math.hypot(pel.pos[0] - cabeza[0], pel.pos[2] - cabeza[2]);
    verificar(pel.estado === 'agarrado' || distancia < 1.8, `queda al alcance (a ${distancia.toFixed(2)} m)`);
    await capturar('n3-2024.png');
    if (pel.estado !== 'agarrado') {
      await ev((p) => __prueba.mover('right', p), [pel.pos[0], pel.pos[1] + 0.02, pel.pos[2]]);
      await esperar(150);
      await ev(() => __prueba.gatillo('right', 1));
      await esperar(200);
    }
    verificar(await ev(() => __juego.pelota.estado) === 'agarrado', 'el jugador agarra la pelota');
    const pasesAntes = (await ev(() => __prueba.guion())).pases;
    await ev(() => __prueba.tirar('right', [0.1, 1.1, -0.4], [0, 1.5, -4.5], 260));

    // 5) Nadie la devuelve; el dato y el cierre.
    verificar(await esperarQue(() => __juego.guion.historial.includes('dato'), 15000), 'después del tiro final aparece el dato');
    g = await ev(() => __prueba.guion());
    verificar(g.pases === pasesAntes && (await ev(() => __juego.pelota.estado)) !== 'enChico', 'nadie devuelve la pelota');
    const textoDato = await ev(() => fetch('datos/natalidad.json').then((r) => r.json()).then((d) => d.textos.dato.cuerpo));
    verificar(/mitad/.test(textoDato), `dato: "${textoDato}"`);
    if ((await ev(() => __juego.guion.fase)) === 'dato') await capturar('n4-dato.png');
    verificar(await esperarQue(() => __juego.guion.fase === 'fin' && __juego.botonReiniciar.visible, 10000), 'cierre de la parte 1 con botón Reiniciar');

    // 6) Reiniciar apuntando con el rayo.
    const b = await ev(() => __juego.botonReiniciar.position.toArray());
    await ev(([o]) => {
      const { THREE } = __juego;
      const desde = new THREE.Vector3(0.15, 1.3, -0.1);
      const m = new THREE.Matrix4().lookAt(desde, new THREE.Vector3(o[0], o[1] + 0.03, o[2]), new THREE.Vector3(0, 1, 0));
      const q = new THREE.Quaternion().setFromRotationMatrix(m);
      const c = __dispositivoXR.controllers.right;
      c.position.set(desde.x, desde.y, desde.z);
      c.quaternion.set(q.x, q.y, q.z, q.w);
    }, [b]);
    await esperar(150);
    await ev(() => __prueba.gatillo('right', 1));
    await esperar(150);
    await ev(() => __prueba.gatillo('right', 0));
    await esperar(400);
    g = await ev(() => __prueba.guion());
    verificar(g.fase === 'juego' && g.presentes === 16, 'reinicia: la plaza vuelve a estar llena');
    const info = await ev(() => __juego.renderer.info.render);
    console.log(`Render: ${info.calls} draw calls, ${info.triangles} triángulos por frame`);
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
