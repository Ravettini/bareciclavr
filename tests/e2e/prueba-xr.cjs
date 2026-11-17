/**
 * Prueba de punta a punta en VR emulado (Meta IWER simulando un Quest 2 con sus controles).
 * Levanta el servidor, entra en VR, agarra y suelta residuos moviendo los controles
 * emulados, y verifica clasificación, puntaje, caída al piso y reinicio.
 *
 * Uso: npm run test:e2e   (requiere Playwright con Chromium instalado)
 * Capturas: tests/e2e/capturas/
 */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..', '..');
const capturas = path.join(__dirname, 'capturas');
const PUERTO = 8091;
let fallas = 0;

function verificar(condicion, descripcion) {
  console.log(`${condicion ? '✔' : '✘'} ${descripcion}`);
  if (!condicion) fallas++;
}

(async () => {
  mkdirSync(capturas, { recursive: true });
  const servidor = spawn(process.execPath, ['scripts/servidor.js'], { cwd: raiz, env: { ...process.env, PUERTO: String(PUERTO) } });
  await new Promise((ok) => servidor.stdout.once('data', ok));

  const navegador = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pagina = await navegador.newPage({ viewport: { width: 1280, height: 720 } });
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(e.message));
  pagina.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

  try {
    await pagina.goto(`http://localhost:${PUERTO}/?emular=1`);
    await pagina.waitForFunction(() => window.__juego && window.__dispositivoXR);
    await pagina.getByText('ENTRAR EN VR').click();
    await pagina.waitForFunction(() => __juego.renderer.xr.isPresenting, null, { timeout: 10000 });
    verificar(true, 'entra en modo VR con el Quest 2 emulado');

    // Ayudantes que corren dentro de la página.
    await pagina.evaluate(() => {
      const { THREE } = __juego;
      const disp = __dispositivoXR;
      window.__prueba = {
        // Ubica el control derecho en (x,y,z) del mundo, mirando hacia "objetivo" (o hacia -Z).
        mover(mano, [x, y, z], objetivo) {
          const c = disp.controllers[mano];
          c.position.set(x, y, z);
          const q = new THREE.Quaternion();
          if (objetivo) {
            const m = new THREE.Matrix4().lookAt(new THREE.Vector3(x, y, z), new THREE.Vector3(...objetivo), new THREE.Vector3(0, 1, 0));
            q.setFromRotationMatrix(m);
          }
          c.quaternion.set(q.x, q.y, q.z, q.w);
        },
        gatillo(mano, valor) { disp.controllers[mano].updateButtonValue('trigger', valor); },
        estado(id) { return __juego.residuos.find((r) => r.id === id).estado; },
        posicion(id) { return __juego.residuos.find((r) => r.id === id).raiz.position.toArray(); },
        boca(id) { return __juego.contenedores.find((c) => c.id === id).boca.toArray(); },
        // Pose de cámara para capturas: controles fuera de la cara y mirada inclinada hacia la mesa.
        poseCaptura() {
          disp.controllers.left.position.set(-0.35, 1.0, -0.3);
          disp.controllers.left.quaternion.set(0, 0, 0, 1);
          disp.controllers.right.position.set(0.35, 1.0, -0.3);
          disp.controllers.right.quaternion.set(0, 0, 0, 1);
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.45);
          disp.quaternion.set(q.x, q.y, q.z, q.w);
        },
        mirarAlFrente() { disp.quaternion.set(0, 0, 0, 1); },
        resumen() { const p = __juego.partida; return { puntaje: p.puntaje, aciertos: p.aciertos, errores: p.errores, panel: __juego.panel.ultimo }; },
      };
    });

    const esperar = (ms) => pagina.waitForTimeout(ms);
    const ev = (fn, ...args) => pagina.evaluate(fn, ...args);
    const capturar = async (nombre) => {
      await ev(() => __prueba.poseCaptura());
      await esperar(250);
      await pagina.screenshot({ path: path.join(capturas, nombre) });
      await ev(() => __prueba.mirarAlFrente());
    };
    await capturar('0-inicio.png');
    const llevar = async (mano, id, destino, { aDistancia = false } = {}) => {
      const pos = await ev((i) => __prueba.posicion(i), id);
      if (aDistancia) await ev(([m, o]) => __prueba.mover(m, [0.15, 1.2, 0.1], o), [mano, pos]);
      else await ev(([m, p]) => __prueba.mover(m, p), [mano, pos]);
      await esperar(150);
      await ev((m) => __prueba.gatillo(m, 1), mano);
      await esperar(150);
      const agarrado = await ev((i) => __prueba.estado(i), id);
      // Movimiento en varios pasos, como una mano real.
      for (let k = 1; k <= 5; k++) {
        const p = pos.map((v, j) => v + (destino[j] - v) * (k / 5));
        await ev(([m, p]) => __prueba.mover(m, p), [mano, p]);
        await esperar(60);
      }
      await esperar(150);
      await ev((m) => __prueba.gatillo(m, 0), mano);
      await esperar(900);
      return agarrado;
    };

    // 1) Agarre cercano: botella al verde (correcto).
    const bocaVerde = await ev(() => __prueba.boca('verde'));
    const bocaNegro = await ev(() => __prueba.boca('negro'));
    const sobre = (b) => [b[0], b[1] + 0.2, b[2]];
    let agarrado = await llevar('right', 'botella', sobre(bocaVerde));
    verificar(agarrado === 'agarrado', 'agarra la botella con la mano (agarre cercano)');
    let r = await ev(() => __prueba.resumen());
    verificar(r.aciertos === 1 && r.puntaje === 10, `botella en el verde = correcto (+10). Puntaje: ${r.puntaje}`);
    verificar((await ev(() => __prueba.estado('botella'))) === 'clasificado', 'la botella queda adentro del contenedor');
    verificar(r.panel.tono === 'acierto', `mensaje educativo: "${r.panel.cuerpo}"`);
    await capturar('1-acierto.png');

    // 2) Error: servilleta al verde.
    await llevar('right', 'servilleta', sobre(bocaVerde));
    r = await ev(() => __prueba.resumen());
    verificar(r.errores === 1 && r.puntaje === 10, 'servilleta en el verde = error, sin restar puntos');
    verificar((await ev(() => __prueba.estado('servilleta'))) === 'mesa', 'la servilleta vuelve a la mesa para reintentar');
    verificar(r.panel.tono === 'error', `explica el error: "${r.panel.cuerpo}"`);
    await capturar('2-error.png');

    // 3) Agarre a distancia con el rayo (mano izquierda): lata al verde.
    agarrado = await llevar('left', 'lata', sobre(bocaVerde), { aDistancia: true });
    verificar(agarrado === 'agarrado', 'agarra la lata a distancia con el rayo (mano izquierda)');
    r = await ev(() => __prueba.resumen());
    verificar(r.aciertos === 2 && r.puntaje === 20, `lata en el verde = correcto. Puntaje: ${r.puntaje}`);

    // 4) Se cae al piso: vuelve sola a la mesa.
    await llevar('right', 'servilleta', [0, 0.9, 0.3]);
    const enPiso = await ev(() => __prueba.estado('servilleta'));
    verificar(enPiso === 'piso' || enPiso === 'mesa', `al soltarla lejos de la mesa cae al piso (estado: ${enPiso})`);
    await esperar(1500);
    verificar((await ev(() => __prueba.estado('servilleta'))) === 'mesa', 'después de caer al piso vuelve a la mesa');

    // 5) Servilleta al negro: correcto después de un error (+5) y fin de partida.
    await llevar('right', 'servilleta', sobre(bocaNegro));
    r = await ev(() => __prueba.resumen());
    verificar(r.aciertos === 3 && r.puntaje === 25, `servilleta en el negro = correcto tras un error (+5). Puntaje: ${r.puntaje}`);
    await esperar(3300);
    r = await ev(() => __prueba.resumen());
    verificar(r.panel.titulo === '¡Terminaste!', `pantalla de resultados: "${r.panel.cuerpo}"`);
    verificar(await ev(() => __juego.botonReiniciar.visible), 'aparece el botón Reiniciar');
    await capturar('3-resultados.png');

    // 6) Reiniciar apuntando con el rayo y apretando el gatillo.
    const posBoton = await ev(() => __juego.botonReiniciar.position.toArray());
    await ev((o) => __prueba.mover('right', [0.1, 1.25, 0.05], [o[0], o[1] + 0.03, o[2]]), posBoton);
    await esperar(150);
    await ev(() => __prueba.gatillo('right', 1));
    await esperar(150);
    await ev(() => __prueba.gatillo('right', 0));
    await esperar(300);
    r = await ev(() => __prueba.resumen());
    const estados = await ev(() => __juego.residuos.map((x) => x.estado));
    verificar(r.puntaje === 0 && estados.every((e) => e === 'mesa'), 'reinicia: puntaje en 0 y residuos en la mesa');

    const info = await ev(() => __juego.renderer.info.render);
    console.log(`Render: ${info.calls} draw calls, ${info.triangles} triángulos por frame (estéreo)`);
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
