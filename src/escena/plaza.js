import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { malla, material } from './materiales.js';
import { texturaTexto } from './textos.js';

/**
 * Escenario low-poly provisional inspirado en una plaza porteña:
 * césped, solado, árboles, bancos, farolas, la Estación Saludable y edificios de fondo.
 * Todo se arma con primitivas; para reemplazarlo por un modelo definitivo
 * alcanza con cargar un .glb en lugar de llamar a crearPlaza().
 *
 * Presupuesto: pocos draw calls (árboles y edificios con InstancedMesh),
 * sin sombras en tiempo real ni transparencias.
 */
/**
 * @param {object} [opciones]
 * @param {boolean} [opciones.mesa] mesa del juego de reciclaje
 * @param {boolean} [opciones.estacion] Estación Saludable
 * @param {number[][]} [opciones.sinArboles] zonas [x, z, radio] donde no van árboles (canchas, paneles…)
 */
export function crearPlaza(escena, { mesa = true, estacion = true, sinArboles = [] } = {}) {
  const plaza = new THREE.Group();
  plaza.name = 'Plaza';

  escena.background = new THREE.Color('#a9d6f5');
  escena.fog = new THREE.Fog('#a9d6f5', 25, 60);

  // Luces: hemisférica + una direccional, sin sombras.
  plaza.add(new THREE.HemisphereLight('#ffffff', '#6d8a4f', 2.2));
  const sol = new THREE.DirectionalLight('#fff3dd', 1.6);
  sol.position.set(4, 10, 3);
  plaza.add(sol);

  // Césped y solado.
  const cesped = malla(new THREE.CircleGeometry(40, 24), '#7fb069');
  cesped.rotation.x = -Math.PI / 2;
  plaza.add(cesped);
  const solado = malla(new THREE.CircleGeometry(4.5, 20), '#d9cfbf');
  solado.rotation.x = -Math.PI / 2;
  solado.position.y = 0.005;
  plaza.add(solado);
  const sendero = malla(new THREE.PlaneGeometry(1.8, 30), '#d9cfbf');
  sendero.rotation.x = -Math.PI / 2;
  sendero.position.set(0, 0.004, 12);
  plaza.add(sendero);

  if (mesa) plaza.add(crearMesa());
  if (estacion) plaza.add(crearEstacionSaludable());
  plaza.add(crearArboles(sinArboles));
  plaza.add(crearEdificios());
  for (const [x, z, rot] of [[-3.2, 1.5, Math.PI / 2], [3.2, 1.5, -Math.PI / 2], [0, 3.6, Math.PI]]) {
    const banco = crearBanco();
    banco.position.set(x, 0, z);
    banco.rotation.y = rot;
    plaza.add(banco);
  }
  for (const [x, z] of [[-4.6, -2], [4.6, -2], [-4.6, 3], [4.6, 3]]) {
    const farola = crearFarola();
    farola.position.set(x, 0, z);
    plaza.add(farola);
  }

  escena.add(plaza);
  return plaza;
}

function crearMesa() {
  const { centro, ancho, profundidad, alto } = CONFIG.mesa;
  const mesa = new THREE.Group();
  mesa.name = 'Mesa';
  const tapa = malla(new THREE.BoxGeometry(ancho, 0.04, profundidad), '#c8935a');
  tapa.position.y = alto - 0.02;
  mesa.add(tapa);
  const pata = new THREE.BoxGeometry(0.05, alto - 0.04, 0.05);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p = malla(pata, '#8a5a33');
    p.position.set(sx * (ancho / 2 - 0.06), (alto - 0.04) / 2, sz * (profundidad / 2 - 0.06));
    mesa.add(p);
  }
  // Mantel con el amarillo de la identidad porteña (sin logos oficiales).
  const mantel = malla(new THREE.BoxGeometry(ancho + 0.02, 0.15, 0.005), '#f6c700');
  mantel.position.set(0, alto - 0.09, profundidad / 2 + 0.005);
  mesa.add(mantel);
  mesa.position.set(...centro);
  return mesa;
}

function crearEstacionSaludable() {
  const est = new THREE.Group();
  est.name = 'EstacionSaludable';
  const poste = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6);
  for (const [x, z] of [[-1.6, -0.9], [1.6, -0.9], [-1.6, 0.9], [1.6, 0.9]]) {
    const p = malla(poste, '#ffffff');
    p.position.set(x, 1.3, z);
    est.add(p);
  }
  const techo = malla(new THREE.ConeGeometry(2.6, 0.9, 4, 1), '#f6c700', { emissive: '#6b5600' });
  techo.rotation.y = Math.PI / 4;
  techo.scale.set(1, 1, 0.6);
  techo.position.y = 3.05;
  est.add(techo);
  const cartel = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 0.45),
    new THREE.MeshBasicMaterial({ map: texturaTexto('Estación Saludable', { fondo: '#1f6f3a', color: '#ffffff', ancho: 1024, alto: 210, tamano: 96 }) }),
  );
  cartel.position.set(0, 2.45, 0.92);
  est.add(cartel);
  // La estación queda detrás de la mesa, enmarcando el panel de mensajes.
  est.position.set(0, 0, -2.2);
  return est;
}

function crearArboles(sinArboles = []) {
  const grupo = new THREE.Group();
  grupo.name = 'Arboles';
  const posiciones = [];
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2 + 0.3 * Math.sin(i * 7);
    const radio = 7 + (i % 3) * 2.5;
    const x = Math.cos(ang) * radio, z = Math.sin(ang) * radio;
    if (sinArboles.some(([zx, zz, zr]) => Math.hypot(x - zx, z - zz) < zr)) continue;
    posiciones.push([x, z, 0.8 + (i % 4) * 0.15]);
  }
  const tronco = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 1.6, 5), material('#7a5232'), posiciones.length);
  const copaGeo = mergeGeometries([
    new THREE.IcosahedronGeometry(1.1, 0).translate(0, 0, 0),
    new THREE.IcosahedronGeometry(0.8, 0).translate(0.5, 0.5, 0.2),
  ]);
  const copa = new THREE.InstancedMesh(copaGeo, material('#3f7d3a'), posiciones.length);
  const m = new THREE.Matrix4();
  posiciones.forEach(([x, z, s], i) => {
    m.compose(new THREE.Vector3(x, 0.8 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    tronco.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, 2.2 * s, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i), new THREE.Vector3(s, s, s));
    copa.setMatrixAt(i, m);
  });
  grupo.add(tronco, copa);
  return grupo;
}

function crearEdificios() {
  const colores = ['#e8d8c3', '#d7b9a0', '#c9cfd6', '#efe3b8', '#d9a98f'];
  const grupo = new THREE.Group();
  grupo.name = 'Edificios';
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  colores.forEach((color, c) => {
    const n = 8;
    const inst = new THREE.InstancedMesh(geo, material(color), n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const ang = ((i * colores.length + c) / (n * colores.length)) * Math.PI * 2;
      const h = 6 + ((i * 7 + c * 3) % 5) * 3;
      m.compose(
        new THREE.Vector3(Math.cos(ang) * 30, 0, Math.sin(ang) * 30),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -ang),
        new THREE.Vector3(4, h, 5.5),
      );
      inst.setMatrixAt(i, m);
    }
    grupo.add(inst);
  });
  return grupo;
}

function crearBanco() {
  const banco = new THREE.Group();
  const asiento = malla(new THREE.BoxGeometry(1.6, 0.06, 0.45), '#2f6f4f');
  asiento.position.y = 0.45;
  const respaldo = malla(new THREE.BoxGeometry(1.6, 0.4, 0.05), '#2f6f4f');
  respaldo.position.set(0, 0.7, -0.2);
  banco.add(asiento, respaldo);
  for (const x of [-0.7, 0.7]) {
    const pata = malla(new THREE.BoxGeometry(0.06, 0.45, 0.4), '#333333');
    pata.position.set(x, 0.225, 0);
    banco.add(pata);
  }
  return banco;
}

function crearFarola() {
  const farola = new THREE.Group();
  const poste = malla(new THREE.CylinderGeometry(0.05, 0.08, 3.2, 6), '#2b2b2b');
  poste.position.y = 1.6;
  const farol = malla(new THREE.CylinderGeometry(0.18, 0.12, 0.35, 6), '#fff7d6', { emissive: '#665c33' });
  farol.position.y = 3.35;
  farola.add(poste, farol);
  return farola;
}
