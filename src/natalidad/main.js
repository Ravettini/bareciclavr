import * as THREE from 'three';
import { crearPlaza } from '../escena/plaza.js';
import { Panel } from '../escena/panel.js';
import { crearBoton } from '../escena/boton.js';
import { malla } from '../escena/materiales.js';
import { Manos } from '../interaccion/manos.js';
import { crearBotonVR } from '../interaccion/botonVR.js';
import { mostrarAviso, VERSION } from '../avisos.js';
import { Hamacas, crearTobogan, crearArenero } from './juegos.js';
import { Chicos } from './chicos.js';
import { Pelota } from './pelota.js';
import { Ambiente } from './ambiente.js';
import { Guion } from './guion.js';

/**
 * "La plaza que se vacía" — experiencia sobre la baja de la natalidad (parte 1).
 * El jugador está en el origen mirando hacia -Z, de pie o sentado, sin desplazarse.
 */

/** Ubicación y comportamiento de cada chico. "orden" = en qué orden se van (menor = antes). */
const CHICOS = [
  { comportamiento: 'pelota', posicion: [0, 0, -3.2], escala: 1.05, orden: 4 },
  { comportamiento: 'hamaca', asiento: 0, escala: 0.95, orden: 2 },
  { comportamiento: 'hamaca', asiento: 1, escala: 1.0 },
  { comportamiento: 'salta', posicion: [2.5, 0, -1.6], escala: 0.85, orden: 5 },
  { comportamiento: 'salta', posicion: [3.4, 0, -2.3], escala: 0.9 },
  { comportamiento: 'corre', centro: [0, 0, -6.8], radio: 2.0, velocidad: 0.9, escala: 1.1, orden: 3 },
  { comportamiento: 'corre', centro: [0, 0, -6.8], radio: 2.0, velocidad: 0.9, fase: 2.1, escala: 1.0 },
  { comportamiento: 'corre', centro: [0, 0, -6.8], radio: 2.0, velocidad: 0.9, fase: 4.2, escala: 1.15, orden: 8 },
  { comportamiento: 'corre', centro: [-2.6, 0, -2.2], radio: 1.1, velocidad: -1.3, escala: 0.9, orden: 6 },
  { comportamiento: 'corre', centro: [-2.6, 0, -2.2], radio: 1.1, velocidad: -1.3, fase: 3.1, escala: 0.95 },
  { comportamiento: 'corre', centro: [2.6, 0, -7.2], radio: 0.9, velocidad: 0.5, fase: 0, escala: 1.0, orden: 1 },
  { comportamiento: 'corre', centro: [2.6, 0, -7.2], radio: 0.9, velocidad: 0.5, fase: Math.PI / 2, escala: 0.9, orden: 7 },
  { comportamiento: 'corre', centro: [2.6, 0, -7.2], radio: 0.9, velocidad: 0.5, fase: Math.PI, escala: 1.05 },
  { comportamiento: 'corre', centro: [2.6, 0, -7.2], radio: 0.9, velocidad: 0.5, fase: (3 * Math.PI) / 2, escala: 0.95 },
  { comportamiento: 'salta', posicion: [-1.7, 0, -4.4], escala: 1.0 },
  { comportamiento: 'corre', centro: [4.6, 0, -3.6], radio: 0.8, velocidad: 1.4, escala: 0.85 },
];

async function iniciar() {
  const resp = await fetch('datos/natalidad.json');
  if (!resp.ok) throw new Error(`No se pudieron cargar los datos (${resp.status}).`);
  const datos = await resp.json();

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFoveation(1);
  document.body.appendChild(renderer.domElement);

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 80);
  const camaraEscritorio = () => { camara.position.set(0, 1.55, 0.9); camara.lookAt(0, 1.1, -3); };
  camaraEscritorio();
  escena.add(camara);

  crearPlaza(escena, { mesa: false, estacion: false });
  const hamacas = new Hamacas(escena, [-3.3, 0, -5.0], 2);
  crearTobogan(escena, [3.6, 0, -4.8]);
  crearArenero(escena, [3.0, 0, -1.9]);

  const chicos = new Chicos(escena, CHICOS.slice(0, datos.chicos));
  const ordenSalida = CHICOS.map((c, i) => [c.orden ?? 100 + i, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);

  const ambiente = new Ambiente();
  const pelota = new Pelota(escena, ambiente);
  const panel = new Panel(escena, { posicion: [0, 2.35, -4.0], ancho: 2.3, alto: 0.95 });

  // Botón Reiniciar sobre un pedestal, al alcance de la mano.
  const pedestal = malla(new THREE.CylinderGeometry(0.12, 0.16, 0.85, 8), '#d9cfbf');
  pedestal.position.set(0, 0.425, -0.75);
  pedestal.visible = false;
  escena.add(pedestal);
  const botonReiniciar = crearBoton(datos.textos.reiniciar, [0, 0.87, -0.75], () => {
    botonReiniciar.visible = false;
    pedestal.visible = false;
    guion.reiniciar();
    guion.comenzar();
  });
  botonReiniciar.visible = false;
  escena.add(botonReiniciar);

  const manos = new Manos({
    renderer, escena, camara,
    residuos: () => [pelota],
    botones: () => [botonReiniciar],
    alSoltar: () => guion.alSoltarPelota(),
  });

  const guion = new Guion({
    datos, chicos, pelota, panel, ambiente, hamacas, camara, ordenSalida,
    alFin: () => { botonReiniciar.visible = true; pedestal.visible = true; },
  });

  // Empieza al entrar en VR, o con el primer clic en la PC.
  const botonVR = crearBotonVR(renderer, { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] }, mostrarAviso);
  botonVR.addEventListener('click', () => ambiente.activar());
  renderer.xr.addEventListener('sessionstart', () => guion.comenzar());
  renderer.xr.addEventListener('sessionend', camaraEscritorio);
  renderer.domElement.addEventListener('pointerdown', () => guion.comenzar());

  window.addEventListener('resize', () => {
    camara.aspect = window.innerWidth / window.innerHeight;
    camara.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Atajar la pelota en el aire: si la mano está cerrada (gatillo, grip o pellizco)
  // y la pelota pasa cerca, queda agarrada. Hace mucho más fácil atajar en VR.
  const atajar = () => {
    if (pelota.estado !== 'lanzada' && pelota.estado !== 'cayendo') return;
    for (const mano of manos.manos) {
      if (!mano.presionados || mano.agarrado) continue;
      if (manos.puntoDeAgarre(mano).distanceTo(pelota.raiz.position) < 0.3) {
        manos.agarrar(mano, pelota, false);
        ambiente.atajada();
        return;
      }
    }
  };

  let anterior = 0;
  renderer.setAnimationLoop((ms) => {
    const t = ms / 1000;
    const dt = Math.min(0.05, anterior ? t - anterior : 0);
    anterior = t;
    manos.actualizar(t);
    atajar();
    pelota.actualizar(dt);
    guion.actualizar(dt);
    hamacas.actualizar(t, dt);
    chicos.actualizar(t, dt, hamacas);
    ambiente.actualizar(dt, guion.presentes);
    renderer.render(escena, camara);
  });

  document.getElementById('cargando')?.remove();
  window.__juego = { THREE, renderer, escena, camara, chicos, pelota, panel, guion, manos, botonReiniciar };
}

console.info(`La plaza que se vacía ${VERSION}`);
iniciar().catch((e) => {
  console.error(e);
  document.getElementById('cargando')?.remove();
  mostrarAviso(`Error al iniciar: ${e.message}`);
});
