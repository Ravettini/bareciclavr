import * as THREE from 'three';
import { crearPlaza, apagarPlaza } from '../escena/plaza.js';
import { Panel } from '../escena/panel.js';
import { crearBoton } from '../escena/boton.js';
import { malla, desaturar } from '../escena/materiales.js';
import { Manos } from '../interaccion/manos.js';
import { crearBotonVR } from '../interaccion/botonVR.js';
import { mostrarAviso, VERSION } from '../avisos.js';
import { Hamacas, crearTobogan, crearArenero, crearAro, Burbujas, crearLona, crearVallas } from './juegos.js';
import { Chicos, Destellos } from './chicos.js';
import { Juguetes } from './juguetes.js';
import { Pelota } from './pelota.js';
import { Ambiente } from './ambiente.js';
import { Guion } from './guion.js';

/**
 * "La plaza que se vacía" — experiencia sobre la baja de la natalidad.
 * El jugador no se desplaza con el joystick: entre capítulos aparece en otro lugar de la plaza
 * con un fundido a negro (cómodo, no marea). Se juega de pie o sentado.
 */

/**
 * Chicos de la plaza. "orden" = en qué orden se van (menor = antes). Los que tienen un papel en
 * un capítulo se van después de ese capítulo: el pasador después del básquet (2016), el de la
 * hamaca después de 2019; la chica de las burbujas se queda.
 */
const CHICOS = [
  /* 0 pasador  */ { comportamiento: 'corre', centro: [0.8, 0, -4.2], radio: 0.6, velocidad: 1.1, escala: 1.05, orden: 4, pelo: 'corto' },
  /* 1 hamaca 0 */ { comportamiento: 'hamaca', asiento: 0, escala: 0.95, orden: 5, pelo: 'colitas' },
  /* 2 hamaca 1 */ { comportamiento: 'hamaca', asiento: 1, escala: 1.0, orden: 2, pelo: 'rulos' },
  /* 3 arenero  */ { comportamiento: 'salta', posicion: [2.5, 0, -1.6], escala: 0.85, orden: 6, mira: [0, 0, 0] },
  /* 4 burbujas */ { comportamiento: 'salta', posicion: [3.4, 0, -2.3], escala: 0.9, pelo: 'largo', mira: [0, 0, 0] },
  /* 5 */ { comportamiento: 'corre', centro: [0, 0, -6.8], radio: 2.0, velocidad: 0.9, escala: 1.1, orden: 3 },
  /* 6 */ { comportamiento: 'corre', centro: [0, 0, -6.8], radio: 2.0, velocidad: 0.9, fase: 2.1, escala: 1.0 },
  /* 7 */ { comportamiento: 'corre', centro: [0, 0, -6.8], radio: 2.0, velocidad: 0.9, fase: 4.2, escala: 1.15, orden: 8 },
  /* 8 */ { comportamiento: 'corre', centro: [-1.7, 0, -1.7], radio: 1.0, velocidad: -1.3, escala: 0.9, orden: 7 },
  /* 9 */ { comportamiento: 'corre', centro: [-1.7, 0, -1.7], radio: 1.0, velocidad: -1.3, fase: 3.1, escala: 0.95 },
  /* 10 */ { comportamiento: 'corre', centro: [2.6, 0, -7.2], radio: 0.9, velocidad: 0.5, fase: 0, escala: 1.0, orden: 1 },
  /* 11 */ { comportamiento: 'corre', centro: [2.6, 0, -7.2], radio: 0.9, velocidad: 0.5, fase: Math.PI / 2, escala: 0.9 },
  /* 12 */ { comportamiento: 'corre', centro: [2.6, 0, -7.2], radio: 0.9, velocidad: 0.5, fase: Math.PI, escala: 1.05 },
  /* 13 */ { comportamiento: 'corre', centro: [2.6, 0, -7.2], radio: 0.9, velocidad: 0.5, fase: (3 * Math.PI) / 2, escala: 0.95 },
  /* 14 */ { comportamiento: 'salta', posicion: [-1.4, 0, -4.6], escala: 1.0, mira: [0, 0, 0] },
  /* 15 */ { comportamiento: 'corre', centro: [4.6, 0, -3.6], radio: 0.8, velocidad: 1.4, escala: 0.85 },
];
const INDICES = { pasador: 0, hamaca: 1, burbujas: 4, publicoBasquet: [14, 9] };

const _cabeza = new THREE.Vector3();
const _frente = new THREE.Vector3();

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
  // El "rig" es el lugar del jugador en la plaza: la cámara y las manos van adentro.
  const rig = new THREE.Group();
  rig.name = 'Jugador';
  escena.add(rig);
  const camara = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 80);
  const camaraEscritorio = () => { camara.position.set(0, 1.55, 0.9); camara.rotation.set(-0.1, 0, 0); };
  camaraEscritorio();
  rig.add(camara);

  // Fundido a negro (esfera alrededor de la cabeza), para cambiar de lugar sin marear.
  const fundidoMat = new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false, depthWrite: false });
  const esferaFundido = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), fundidoMat);
  esferaFundido.renderOrder = 999;
  esferaFundido.visible = false;
  camara.add(esferaFundido);
  const fundido = (valor) => { fundidoMat.opacity = valor; esferaFundido.visible = valor > 0.001; };

  // Sin árboles en la cancha de básquet ni detrás del panel de las hamacas.
  const plaza = crearPlaza(escena, { mesa: false, estacion: false, sinArboles: [[-6.5, 0.3, 2.3], [-1.9, -5.85, 2.0]] });
  const hamacas = new Hamacas(escena, [-3.3, 0, -5.0], 2);
  const tobogan = crearTobogan(escena, [3.6, 0, -4.8]);
  crearArenero(escena, [3.0, 0, -1.9]);
  const aro = crearAro(escena, [-6.5, 0, -1.4], 0);
  // Espacios de infancia que se van perdiendo (metáfora): aparecen en los años de ESPACIOS (guion.js).
  const lona = crearLona(escena, [3.0, 0, -1.9]);
  const vallas = crearVallas(escena, [
    [-5.0, -6.0, -1.6, -6.0], [-1.6, -6.0, -1.6, -4.0], [-1.6, -4.0, -5.0, -4.0], [-5.0, -4.0, -5.0, -6.0], // hamacas
    [2.2, -6.6, 5.2, -6.6], [5.2, -6.6, 5.2, -3.0], [5.2, -3.0, 2.2, -3.0], [2.2, -3.0, 2.2, -6.6], // tobogán
  ]);
  const burbujas = new Burbujas(escena);

  const chicos = new Chicos(escena, CHICOS.slice(0, datos.chicos));
  chicos.destellos = new Destellos(escena);
  const juguetes = new Juguetes(escena);
  const ordenSalida = CHICOS.map((c, i) => [c.orden ?? 100 + i, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);

  const ambiente = new Ambiente();
  ambiente.configurarVoces(datos.voces);
  const pelota = new Pelota(escena, ambiente);
  // Panel de mensajes: sigue la mirada (ver Panel.seguir), a 2,4 m y un poco por encima de los ojos.
  const panel = new Panel(escena, { posicion: [0, 2.0, -2.4], ancho: 1.7, alto: 0.7 });

  // Botón Reiniciar sobre un pedestal (se ubica frente al jugador al final).
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

  const posicionJugador = (destino = new THREE.Vector3()) => camara.getWorldPosition(destino);

  /**
   * Jugar sentado: con "local-floor" el piso es el piso real, así que sentado los ojos quedan a
   * ~1,1 m y todo se ve gigante. Si la cabeza está por debajo de 1,3 m, se sube al jugador hasta
   * que sus ojos queden a 1,45 m. Se mide al entrar en VR y en cada cambio de capítulo (a oscuras),
   * así se adapta si la persona se para o se sienta. Devuelve la altura extra.
   */
  let alturaExtra = 0;
  const calibrarAltura = () => {
    if (!renderer.xr.isPresenting) return 0;
    const ojos = camara.position.y; // altura real de la cabeza sobre el piso
    if (ojos > 0.3) alturaExtra = ojos < 1.3 ? Math.min(0.7, 1.45 - ojos) : 0;
    return alturaExtra;
  };

  const manos = new Manos({
    renderer, escena, camara, padre: rig,
    residuos: () => [pelota],
    botones: () => [botonReiniciar],
    alSoltar: (p) => guion.alSoltarPelota(p),
  });

  // Cuando un chico se esfuma: sonido, y queda su juguete en el piso (el de la hamaca deja la hamaca sola).
  chicos.alEmpezarAEsfumarse = () => ambiente.esfumarse();
  chicos.alEsfumarse = (c, pos) => { if (c.comportamientoInicial !== 'hamaca' || !c.matrizExterna) juguetes.dejar(pos); };

  const espacios = {
    apagar(f) { desaturar(f); apagarPlaza(escena, plaza, f); },
    cambiar(nombre) {
      const destello = (v) => chicos.destellos.estallar(v, 24);
      if (nombre === 'cinta') { tobogan.userData.cinta.visible = true; destello(new THREE.Vector3(3.6, 1, -4.8)); }
      if (nombre === 'asiento') { hamacas.quitarAsiento(1); destello(hamacas.posicionAsiento(1, new THREE.Vector3())); }
      if (nombre === 'lona') { lona.visible = true; destello(new THREE.Vector3(3.0, 0.4, -1.9)); }
      if (nombre === 'vallas') { vallas.visible = true; aro.grupo.userData.red.visible = false; destello(new THREE.Vector3(-3.3, 1, -4.0)); destello(new THREE.Vector3(3.7, 1, -3.0)); }
      ambiente.esfumarse();
    },
    reiniciar() {
      tobogan.userData.cinta.visible = false;
      lona.visible = false;
      vallas.visible = false;
      aro.grupo.userData.red.visible = true;
    },
  };

  const ctx = {
    datos, escena, rig, chicos, pelota, manos, panel, ambiente, hamacas, aro, burbujas, ordenSalida,
    indices: INDICES, fundido, posicionJugador, juguetes, espacios, calibrarAltura,
    alFin: () => { botonReiniciar.visible = true; pedestal.visible = true; },
  };
  const guion = new Guion(ctx);

  const botonVR = crearBotonVR(renderer, { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] }, mostrarAviso);
  botonVR.addEventListener('click', () => ambiente.activar());
  renderer.xr.addEventListener('sessionstart', () => {
    guion.comenzar();
    // Medir la altura cuando la posición de la cabeza ya es estable.
    setTimeout(() => { rig.position.y = calibrarAltura(); }, 1200);
  });
  renderer.xr.addEventListener('sessionend', () => { rig.position.y = alturaExtra = 0; camaraEscritorio(); });
  renderer.domElement.addEventListener('pointerdown', () => {
    guion.comenzar();
    // En la PC, en el capítulo de la hamaca, un clic empuja.
    if (guion.fase === 'capitulo' && guion.capitulo.empujarConMouse) guion.capitulo.empujarConMouse();
  });

  window.addEventListener('resize', () => {
    camara.aspect = window.innerWidth / window.innerHeight;
    camara.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let anterior = 0;
  renderer.setAnimationLoop((ms) => {
    const t = ms / 1000;
    const dt = Math.min(0.05, anterior ? t - anterior : 0);
    anterior = t;
    manos.actualizar(t, dt);
    // Imán: si la pelota está quieta en el piso cerca del jugador y una mano baja hacia ella,
    // la pelota salta a la mano (no hace falta agacharse hasta el piso, sobre todo sentado).
    if (pelota.estado === 'reposo' && t - (pelota.imanEn || 0) > 1.2) {
      const p = pelota.raiz.position;
      for (const mano of manos.manos) {
        if (!mano.fuente || mano.agarrado) continue;
        // Con controles, solo si aprieta (si no, la pelota rebotaría en la mano); con la mano, siempre.
        if (!manos.esMano(mano) && !mano.presionados) continue;
        const m = manos.puntoDeAgarre(mano);
        // Mano "baja": a menos de 0,8 m del piso real (sentado, más abajo no se llega).
        if (Math.hypot(m.x - p.x, m.z - p.z) < 0.45 && m.y - rig.position.y < 0.8) {
          pelota.imanEn = t;
          pelota.lanzar(p.clone(), m, 0.3);
          pelota.lanzadaPor = 'iman';
          break;
        }
      }
    }
    if (manos.atajar() === pelota) ambiente.atajada();
    pelota.actualizar(dt);
    guion.actualizar(dt);
    hamacas.actualizar(t, dt);
    chicos.actualizar(t, dt, hamacas);
    burbujas.actualizar(t, dt);
    ambiente.actualizar(dt, guion.presentes);
    panel.seguir(camara.getWorldPosition(_cabeza), camara.getWorldDirection(_frente), dt);
    // El botón Reiniciar aparece frente al jugador, donde esté.
    if (botonReiniciar.visible) {
      const frente = rig.localToWorld(new THREE.Vector3(0, 0, -0.75));
      pedestal.position.set(frente.x, 0.425, frente.z);
      botonReiniciar.position.set(frente.x, 0.87, frente.z);
    }
    renderer.render(escena, camara);
  });

  document.getElementById('cargando')?.remove();
  window.__juego = { THREE, renderer, escena, rig, camara, chicos, pelota, panel, guion, manos, botonReiniciar, hamacas, aro, burbujas, ctx };
}

console.info(`La plaza que se vacía ${VERSION}`);
iniciar().catch((e) => {
  console.error(e);
  document.getElementById('cargando')?.remove();
  mostrarAviso(`Error al iniciar: ${e.message}`);
});
