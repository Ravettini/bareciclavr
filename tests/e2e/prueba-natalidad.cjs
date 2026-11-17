/**
 * Prueba de punta a punta de "La plaza que se vacía" en VR emulado (Meta IWER, Quest 2).
 * Recorre los 5 capítulos usando controles y manos. El guion corre 2 veces más rápido
 * (?rapido=2); la física va a velocidad real.
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
  const capituloActual = () => ev(() => (__juego.guion.fase === 'capitulo' ? __juego.guion.capitulo.def.juego : __juego.guion.fase));
  const esperarCapitulo = (juego, ms = 40000) => esperarQue((j) => __juego.guion.fase === 'capitulo' && __juego.guion.capitulo.def.juego === j, ms, juego);

  try {
    await pagina.goto(`http://localhost:${PUERTO}/natalidad.html?emular=1&rapido=2`);
    await pagina.waitForFunction(() => window.__juego && window.__dispositivoXR);
    await pagina.getByText('ENTRAR EN VR').click();
    verificar(await esperarQue(() => __juego.renderer.xr.isPresenting, 10000), 'entra en VR con el Quest 2 emulado');
    verificar(await capituloActual() === 'pelota', 'empieza el capítulo 2014: la pelota');

    await ev(() => {
      const { THREE } = __juego;
      const d = __dispositivoXR;
      const v = new THREE.Vector3();
      // Coordenadas de la plaza → espacio del visor (el jugador puede estar en otro lugar de la plaza).
      const local = (p) => __juego.rig.worldToLocal(v.set(p[0], p[1], p[2])).toArray();
      const manoDe = (lado) => __juego.manos.manos.find((m) => m.fuente && m.fuente.handedness === lado);
      window.__prueba = {
        local,
        // Controles
        mover(lado, p) { d.controllers[lado].position.set(...local(p)); d.controllers[lado].quaternion.set(0, 0, 0, 1); },
        gatillo(lado, val) { d.controllers[lado].updateButtonValue('trigger', val); },
        // Manos: ubica la mano para que la PALMA quede en p (coordenadas de la plaza).
        palmaEn(lado, p) {
          const m = manoDe(lado);
          const h = d.hands[lado];
          // Una corrección por llamada: el emulador aplica la nueva posición en el próximo cuadro.
          const actual = __juego.rig.worldToLocal(__juego.manos.puntoDeAgarre(m, new THREE.Vector3()));
          const meta = local(p);
          h.position.set(h.position.x + meta[0] - actual.x, h.position.y + meta[1] - actual.y, h.position.z + meta[2] - actual.z);
        },
        pose(lado, id) { d.hands[lado].poseId = id; },
        // Mueve (control o mano) con velocidad constante en coordenadas del visor; al final ejecuta "fin".
        mover_con_velocidad(tipo, lado, vel, ms, fin) {
          const obj = tipo === 'mano' ? d.hands[lado] : d.controllers[lado];
          const desde = obj.position.clone ? [obj.position.x, obj.position.y, obj.position.z] : [0, 0, 0];
          return new Promise((ok) => {
            const t0 = performance.now();
            const id = setInterval(() => {
              const s = (performance.now() - t0) / 1000;
              obj.position.set(desde[0] + vel[0] * s, desde[1] + vel[1] * s, desde[2] + vel[2] * s);
              if (s * 1000 >= ms) { clearInterval(id); if (fin === 'gatillo') d.controllers[lado].updateButtonValue('trigger', 0); if (fin === 'abrir') d.hands[lado].poseId = 'open'; ok(); }
            }, 16);
          });
        },
        pelota() { const p = __juego.pelota; return { estado: p.estado, pos: p.raiz.position.toArray(), por: p.lanzadaPor }; },
        guion() { const g = __juego.guion; return { fase: g.fase, juego: g.capitulo?.def.juego, anio: g.anio, presentes: g.presentes, panel: __juego.panel.ultimo, historial: g.historial }; },
        cabeza() { return __juego.camara.getWorldPosition(new THREE.Vector3()).toArray(); },
      };
      // Monitor: distancia mínima de cualquier chico (que no esté en la hamaca) al jugador.
      window.__distanciaMinima = Infinity;
      setInterval(() => {
        const j = __juego.camara.getWorldPosition(new THREE.Vector3());
        for (const c of __juego.chicos.lista) {
          if (c.comportamiento === 'ido' || c.matrizExterna || __juego.guion.fase !== 'capitulo') continue;
          window.__distanciaMinima = Math.min(window.__distanciaMinima, Math.hypot(c.posicion.x - j.x, c.posicion.z - j.z));
        }
      }, 50);
      // Monitor: ¿llegó a estar agarrada la pelota por cierre de mano / atajada con la palma?
      window.__modos = new Set();
      setInterval(() => { for (const m of __juego.manos.manos) if (m.modo) window.__modos.add(m.modo); }, 30);
    });
    const capturar = async (nombre) => { await esperar(150); await pagina.screenshot({ path: path.join(capturas, nombre) }); };

    // ---- 2014: atajar con el control y devolverla ----
    let cab = await ev(() => __prueba.cabeza());
    let pasador = await ev(() => __juego.guion.capitulo.pasador.chico.posicion.toArray());
    const hacia = [pasador[0] - cab[0], pasador[2] - cab[2]];
    const n = Math.hypot(...hacia);
    const atajada = [cab[0] + (hacia[0] / n) * 0.4, Math.max(0.85, cab[1] - 0.45), cab[2] + (hacia[1] / n) * 0.4];
    await ev((p) => { __prueba.mover('right', p); __prueba.gatillo('right', 1); }, atajada);
    verificar(await esperarQue(() => __juego.pelota.estado === 'agarrado', 16000), '2014: ataja la pelota con el control (después de la presentación)');
    await capturar('n1-2014-atajada.png');
    let devuelta = false;
    for (let i = 0; i < 3 && !devuelta; i++) {
      if (i > 0) {
        const pe = await ev(() => __prueba.pelota());
        if (pe.estado === 'enChico') break;
        await ev((p) => { __prueba.mover('right', p); __prueba.gatillo('right', 1); }, pe.pos);
        await esperarQue(() => __juego.pelota.estado === 'agarrado', 3000);
      }
      await ev(() => __prueba.mover_con_velocidad('control', 'right', [0, 2.2, -4.0], 260, 'gatillo'));
      devuelta = await esperarQue(() => __juego.guion.capitulo.pasador?.pases >= 1, 8000);
    }
    verificar(devuelta, '2014: se la devuelve y el chico la recupera');

    // ---- 2016: básquet con las manos ----
    verificar(await esperarCapitulo('basquet'), '2016: el jugador aparece en la cancha de básquet');
    const g16 = await ev(() => __prueba.guion());
    verificar(g16.presentes < 16, `2016: ya se fue algún chico (quedan ${g16.presentes})`);
    await ev(() => { __dispositivoXR.primaryInputMode = 'hand'; });
    await esperar(400);
    cab = await ev(() => __prueba.cabeza());
    pasador = await ev(() => __juego.guion.capitulo.pasador.chico.posicion.toArray());
    {
      const h = [pasador[0] - cab[0], pasador[2] - cab[2]];
      const k = Math.hypot(...h);
      const palma = [cab[0] + (h[0] / k) * 0.4, Math.max(0.85, cab[1] - 0.45), cab[2] + (h[1] / k) * 0.4];
      await ev(() => __prueba.pose('right', 'open'));
      for (let k = 0; k < 4; k++) { await ev((p) => __prueba.palmaEn('right', p), palma); await esperar(120); }
    }
    verificar(await esperarQue(() => __juego.pelota.estado === 'agarrado', 12000), '2016: ataja la pelota con la palma abierta (sin apretar nada)');
    verificar(await ev(() => window.__modos.has('atajada')), '2016: quedó agarrada por atajada con la mano');
    await capturar('n2-2016-basquet.png');
    let doble = false;
    for (let i = 0; i < 4 && !doble; i++) {
      if (i > 0) {
        // Si no entró, el chico la busca y se la vuelve a pasar: la mano vuelve a la posición de atajar.
        const cb = await ev(() => __prueba.cabeza());
        const ps = await ev(() => __juego.guion.capitulo.pasador.puesto.toArray());
        const h = [ps[0] - cb[0], ps[2] - cb[2]];
        const k = Math.hypot(...h);
        const palma = [cb[0] + (h[0] / k) * 0.4, Math.max(0.85, cb[1] - 0.45), cb[2] + (h[1] / k) * 0.4];
        const idMano = await ev((p) => setInterval(() => { if (__juego.pelota.estado !== 'agarrado') __prueba.palmaEn('right', p); }, 100), palma);
        await esperarQue(() => __juego.pelota.estado === 'agarrado', 20000);
        await ev((id) => clearInterval(id), idMano);
        await esperar(300);
      }
      await ev(() => {
        const original = __juego.guion.alSoltarPelota.bind(__juego.guion);
        __juego.guion.alSoltarPelota = (p) => { const antes = p.velocidad.toArray(); original(p); window.__ultimoTiro = { antes, despues: p.velocidad.toArray(), desde: p.raiz.position.toArray() }; };
      });
      // Tiro hacia el aro: mano rápida hacia adelante y arriba (con la mano abierta se suelta sola).
      const aro = await ev(() => __prueba.local(__juego.aro.centro.toArray()));
      const desde = await ev(() => __prueba.local(__juego.pelota.raiz.getWorldPosition(new __juego.THREE.Vector3()).toArray()));
      const dir = [aro[0] - desde[0], aro[2] - desde[2]];
      const m = Math.hypot(...dir);
      await ev((vel) => __prueba.mover_con_velocidad('mano', 'right', vel, 220), [(dir[0] / m) * 3.5, 3.2, (dir[1] / m) * 3.5]);
      doble = await esperarQue(() => (__juego.guion.capitulo.dobles || 0) >= 1, 4000);
      console.log(`  tiro ${i + 1}:`, JSON.stringify(await ev(() => window.__ultimoTiro, null)), doble ? 'DOBLE' : '');
    }
    if (!doble) console.log('  diagnóstico:', JSON.stringify(await ev(() => ({ pelota: __prueba.pelota(), aro: __juego.aro.centro.toArray() }))));
    verificar(doble, '2016: ¡doble! (la ayuda para apuntar funciona)');
    if (doble) await capturar('n3-2016-doble.png');

    // ---- 2019: empujar la hamaca ----
    verificar(await esperarCapitulo('hamaca'), '2019: aparece frente a las hamacas');
    verificar(await ev(() => __juego.hamacas.asientos[1].ocupado === false), '2019: la hamaca de al lado ya está vacía');
    await ev(() => {
      // La mano sigue al asiento (un poco del lado del jugador) durante 4 s.
      const id = setInterval(() => {
        const a = __juego.hamacas.posicionAsiento(0, new __juego.THREE.Vector3());
        __prueba.palmaEn('right', [a.x, a.y + 0.25, a.z + 0.25]);
      }, 30);
      setTimeout(() => clearInterval(id), 4000);
    });
    verificar(await esperarQue(() => (__juego.guion.capitulo.empujones || 0) >= 1, 6000), '2019: empuja la hamaca con la mano');
    await capturar('n4-2019-hamaca.png');

    // ---- 2022: burbujas ----
    verificar(await esperarCapitulo('burbujas'), '2022: aparece en el arenero con las burbujas');
    await ev(() => {
      // La mano va hacia la burbuja más cercana.
      const id = setInterval(() => {
        const j = __juego.camara.getWorldPosition(new __juego.THREE.Vector3());
        const b = __juego.burbujas.lista.filter((x) => x.activa && !x.revienta).sort((a, c) => a.pos.distanceTo(j) - c.pos.distanceTo(j))[0];
        if (b && b.pos.distanceTo(j) < 1.6) __prueba.palmaEn('right', b.pos.toArray());
      }, 40);
      setTimeout(() => clearInterval(id), 6000);
    });
    verificar(await esperarQue(() => (__juego.guion.capitulo.reventadas || 0) >= 2, 8000), '2022: revienta burbujas con la mano');
    await capturar('n5-2022-burbujas.png');

    // ---- 2024: la pelota vuelve rodando; agarrarla del piso cerrando la mano y tirarla ----
    verificar(await esperarCapitulo('final', 40000), '2024: vuelve al lugar del principio');
    const g24 = await ev(() => __prueba.guion());
    verificar(g24.presentes === 8, `2024: queda la mitad de los chicos (${g24.presentes} de 16)`);
    verificar(await esperarQue(() => __juego.pelota.estado === 'reposo', 12000), '2024: la pelota llega rodando hasta el jugador');
    const pe = await ev(() => __prueba.pelota());
    await ev(() => __prueba.pose('right', 'open'));
    for (let k = 0; k < 4; k++) { await ev((p) => __prueba.palmaEn('right', [p[0], p[1] + 0.05, p[2]]), pe.pos); await esperar(120); }
    await ev(() => __prueba.pose('right', 'fist'));
    verificar(await esperarQue(() => __juego.pelota.estado === 'agarrado', 3000), '2024: agarra la pelota del piso cerrando la mano');
    verificar(await ev(() => !!__juego.manos.manos.find((m) => m.agarrado === __juego.pelota && m.fuente?.hand)), '2024: la tiene la mano (al cerrar el puño; el visor puede contarlo también como pellizco)');
    for (let k = 0; k < 3; k++) { await ev(() => __prueba.palmaEn('right', __juego.rig.localToWorld(new __juego.THREE.Vector3(0.2, 1.1, -0.3)).toArray())); await esperar(120); }
    await ev(() => __prueba.mover_con_velocidad('mano', 'right', [0, 1.2, -3.5], 200, 'abrir'));
    verificar(await esperarQue(() => __juego.pelota.estado === 'cayendo' || __juego.pelota.estado === 'reposo', 3000), '2024: abre la mano y la pelota sale');
    await capturar('n6-2024-final.png');
    verificar(await esperarQue(() => __juego.guion.historial.includes('dato'), 15000), 'aparece el dato');
    verificar(await ev(() => __juego.pelota.estado !== 'enChico'), 'nadie devolvió la pelota');
    verificar(await esperarQue(() => __juego.guion.fase === 'fin' && __juego.botonReiniciar.visible, 15000), 'cierre con botón Reiniciar');

    // ---- Reiniciar (con el control y el rayo) ----
    await ev(() => { __dispositivoXR.primaryInputMode = 'controller'; });
    await esperar(400);
    await ev(() => {
      const { THREE } = __juego;
      const b = __prueba.local(__juego.botonReiniciar.position.toArray());
      const desde = new THREE.Vector3(0.15, 1.3, -0.1);
      const m = new THREE.Matrix4().lookAt(desde, new THREE.Vector3(b[0], b[1] + 0.03, b[2]), new THREE.Vector3(0, 1, 0));
      const q = new THREE.Quaternion().setFromRotationMatrix(m);
      const c = __dispositivoXR.controllers.right;
      c.position.set(desde.x, desde.y, desde.z);
      c.quaternion.set(q.x, q.y, q.z, q.w);
    });
    await esperar(200);
    await ev(() => __prueba.gatillo('right', 1));
    await esperar(150);
    await ev(() => __prueba.gatillo('right', 0));
    await esperar(400);
    const gr = await ev(() => __prueba.guion());
    verificar(gr.juego === 'pelota' && gr.presentes === 16, 'reinicia: plaza llena y capítulo 2014');

    // Locución: las 9 frases sonaron, en orden.
    const voces = await ev(() => __juego.ctx.ambiente.historialVoces);
    const esperadas = ['inicio', 'devolvela', 'pasanLosAnios', 'basquet', 'hamaca', 'burbujas', 'final', 'dato', 'cierre'];
    let k = 0;
    for (const v of voces) if (v === esperadas[k]) k++;
    verificar(k === esperadas.length, `suenan las 9 frases de la voz, en orden (${voces.join(', ')})`);
    const cargadas = await ev(() => Object.keys(__juego.ctx.ambiente.voces).length);
    verificar(cargadas === 9, `se cargaron los 9 audios de la voz (${cargadas})`);

    const dmin = await ev(() => window.__distanciaMinima);
    verificar(dmin >= 0.6, `ningún chico atraviesa al jugador (distancia mínima: ${dmin.toFixed(2)} m)`);
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
