import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { CONFIG } from './config.js';
import { cargarReglas } from './logica/reglas.js';
import { Partida } from './logica/partida.js';
import { crearPlaza } from './escena/plaza.js';
import { Contenedor } from './escena/contenedores.js';
import { Residuo } from './escena/residuos.js';
import { Panel } from './escena/panel.js';
import { crearBoton } from './escena/boton.js';
import { Manos } from './interaccion/manos.js';
import { actualizarFisica } from './interaccion/fisica.js';
import { Sonido } from './feedback/sonido.js';

/**
 * Punto de entrada: arma la escena, conecta la interacción con la lógica de la partida
 * y corre el bucle de render (72 Hz en Quest 2).
 */
async function iniciar() {
  const reglas = await cargarReglas();
  const partida = new Partida(reglas);
  const sonido = new Sonido();

  // ---------- Render ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFoveation(1); // foveated rendering fijo: ahorra GPU en los bordes
  document.body.appendChild(renderer.domElement);

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 80);
  const posicionarCamaraEscritorio = () => {
    camara.position.set(0, CONFIG.camaraEscritorio.altura, 0.75);
    camara.lookAt(0, 1.0, -0.9);
  };
  posicionarCamaraEscritorio();
  escena.add(camara);

  // ---------- Contenido ----------
  crearPlaza(escena);
  const contenedores = Object.entries(reglas.contenedores).map(([id, datos]) => new Contenedor(id, datos));
  contenedores.forEach((c) => escena.add(c.grupo));
  const residuos = reglas.residuos.map((def) => new Residuo(def));
  residuos.forEach((r) => { escena.add(r.raiz); r.cargarModelo(); });
  const panel = new Panel(escena);

  const pie = () => `Puntaje: ${partida.puntaje}   ·   Quedan: ${partida.restantes}`;
  const bienvenida = () => panel.mostrar({ ...reglas.textos.bienvenida, pie: pie() });

  const reiniciar = () => {
    partida.reiniciar();
    residuos.forEach((r) => r.volverAMesa());
    botonReiniciar.visible = false;
    bienvenida();
  };
  const botonReiniciar = crearBoton(reglas.textos.reiniciar, CONFIG.boton.posicion, reiniciar);
  botonReiniciar.visible = false;
  escena.add(botonReiniciar);

  // ---------- Reglas del juego ----------
  let temporizadorFinal = null;
  const alDepositar = (residuo, contenedor) => {
    const res = partida.depositar(residuo.id, contenedor.id);
    const mano = residuo.ultimaMano;
    if (res.correcto) {
      residuo.animarDeposito(contenedor.boca.add(new THREE.Vector3(0, -0.25, 0)));
      contenedor.destellar('#4cff6a');
      sonido.acierto();
      if (mano) manos.vibrar(mano, 0.6, 120);
    } else {
      contenedor.destellar('#ff9a2e');
      sonido.error();
      if (mano) manos.vibrar(mano, 0.25, 60);
      residuo.volverAMesa();
    }
    panel.mostrar({ titulo: res.titulo, cuerpo: res.mensaje, pie: pie(), tono: res.correcto ? 'acierto' : 'error' });
    if (res.terminada) {
      clearTimeout(temporizadorFinal);
      temporizadorFinal = setTimeout(() => {
        sonido.final();
        panel.mostrar({
          titulo: reglas.textos.resultados.titulo,
          cuerpo: `Sumaste ${partida.puntaje} de ${partida.puntajeMaximo} puntos (${partida.errores} ${partida.errores === 1 ? 'error' : 'errores'}). ${reglas.textos.resultados.cuerpo}`,
          pie: 'Apuntá al botón Reiniciar y apretá el gatillo',
          tono: 'acierto',
        });
        botonReiniciar.visible = true;
      }, 3000);
    }
  };
  const alPiso = () => panel.mostrar({ ...reglas.textos.alPiso, pie: pie(), tono: 'neutro' });

  const manos = new Manos({
    renderer, escena, camara,
    residuos: () => residuos,
    botones: () => [botonReiniciar],
    alSoltar: () => {},
  });
  renderer.domElement.addEventListener('pointerdown', () => sonido.activar());

  // ---------- Botón "Entrar en VR" ----------
  const botonVR = VRButton.createButton(renderer, { optionalFeatures: ['local-floor', 'bounded-floor'] });
  traducirBotonVR(botonVR);
  botonVR.addEventListener('click', () => sonido.activar());
  document.body.appendChild(botonVR);
  renderer.xr.addEventListener('sessionstart', () => sonido.activar());
  renderer.xr.addEventListener('sessionend', posicionarCamaraEscritorio);

  window.addEventListener('resize', () => {
    camara.aspect = window.innerWidth / window.innerHeight;
    camara.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- Bucle ----------
  let anterior = 0;
  const eventos = { alDepositar, alPiso };
  renderer.setAnimationLoop((ms) => {
    const t = ms / 1000;
    const dt = Math.min(0.05, anterior ? t - anterior : 0);
    anterior = t;
    manos.actualizar(t);
    for (const r of residuos) {
      actualizarFisica(r, dt, contenedores, eventos);
      r.actualizarAnimacion(dt);
    }
    contenedores.forEach((c) => c.actualizar(dt));
    renderer.render(escena, camara);
  });

  bienvenida();
  document.getElementById('cargando')?.remove();

  // Acceso para pruebas automáticas y depuración (no afecta al juego).
  window.__juego = { THREE, renderer, escena, camara, partida, residuos, contenedores, panel, botonReiniciar, manos, reiniciar };
}

/** El botón de three.js viene en inglés: lo pasamos a español. */
function traducirBotonVR(boton) {
  const textos = { 'ENTER VR': 'ENTRAR EN VR', 'EXIT VR': 'SALIR DE VR', 'VR NOT SUPPORTED': 'VR NO DISPONIBLE · USÁ EL MOUSE', 'VR NOT ALLOWED': 'VR NO PERMITIDA' };
  const traducir = () => { const t = textos[boton.textContent.trim()]; if (t) boton.textContent = t; };
  new MutationObserver(traducir).observe(boton, { childList: true, characterData: true, subtree: true });
  traducir();
}

iniciar().catch((e) => {
  console.error(e);
  const div = document.getElementById('cargando');
  if (div) div.textContent = 'Error al iniciar: ' + e.message;
});
