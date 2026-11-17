import * as THREE from 'three';
import { malla } from '../escena/materiales.js';

/**
 * Juegos de la plaza (provisionales, con primitivas): hamacas, tobogán y arenero.
 * Las hamacas se mueven solas mientras hay un chico sentado y se frenan cuando se va.
 */
export class Hamacas {
  constructor(escena, posicion, cantidad = 2) {
    this.grupo = new THREE.Group();
    this.grupo.name = 'Hamacas';
    this.grupo.position.set(...posicion);
    const alto = 2.2;
    const ancho = cantidad * 1.0 + 0.6;
    const caño = new THREE.CylinderGeometry(0.05, 0.05, alto * 1.08, 6);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p = malla(caño, '#c0392b');
      p.position.set(sx * ancho / 2, alto / 2, sz * 0.45);
      p.rotation.x = sz * -0.2;
      this.grupo.add(p);
    }
    const barra = malla(new THREE.CylinderGeometry(0.05, 0.05, ancho, 6), '#c0392b');
    barra.rotation.z = Math.PI / 2;
    barra.position.y = alto;
    this.grupo.add(barra);

    /** Cada asiento cuelga de un pivote que oscila. */
    this.asientos = [];
    const largoSoga = 1.65;
    const sogaGeo = new THREE.CylinderGeometry(0.012, 0.012, largoSoga, 4).translate(0, -largoSoga / 2, 0);
    for (let i = 0; i < cantidad; i++) {
      const pivote = new THREE.Object3D();
      pivote.position.set((i - (cantidad - 1) / 2) * 1.0, alto, 0);
      for (const sx of [-0.2, 0.2]) {
        const soga = malla(sogaGeo, '#555555');
        soga.position.x = sx;
        pivote.add(soga);
      }
      const asiento = malla(new THREE.BoxGeometry(0.5, 0.05, 0.22), '#2c3e50');
      asiento.position.y = -largoSoga;
      pivote.add(asiento);
      this.grupo.add(pivote);
      this.asientos.push({ pivote, amplitud: 0.55, fase: i * 1.7, ocupado: true });
    }
    escena.add(this.grupo);
  }

  /** Matriz mundial donde se sienta el chico del asiento i. */
  matrizAsiento(i, destino) {
    const a = this.asientos[i];
    a.pivote.updateMatrixWorld(true);
    return destino.copy(a.pivote.matrixWorld).multiply(_desplazamiento);
  }

  actualizar(t, dt) {
    for (const a of this.asientos) {
      // Sin chico, la hamaca se va frenando de a poco.
      if (!a.ocupado) a.amplitud = Math.max(0, a.amplitud - dt * 0.06);
      a.pivote.rotation.x = a.amplitud * Math.sin(t * 2.1 + a.fase);
    }
  }
}
const _desplazamiento = new THREE.Matrix4().makeTranslation(0, -1.65 - 0.33, 0);

export function crearTobogan(escena, posicion) {
  const g = new THREE.Group();
  g.name = 'Tobogan';
  const plataforma = malla(new THREE.BoxGeometry(0.8, 0.08, 0.8), '#2980b9');
  plataforma.position.y = 1.5;
  g.add(plataforma);
  for (const sx of [-0.35, 0.35]) for (const sz of [-0.35, 0.35]) {
    const pata = malla(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6), '#f39c12');
    pata.position.set(sx, 0.75, sz);
    g.add(pata);
  }
  const rampa = malla(new THREE.BoxGeometry(0.6, 0.05, 2.4), '#f1c40f');
  rampa.position.set(0, 0.8, 1.45);
  rampa.rotation.x = 0.68;
  g.add(rampa);
  for (let i = 0; i < 5; i++) {
    const escalon = malla(new THREE.BoxGeometry(0.6, 0.04, 0.08), '#f39c12');
    escalon.position.set(0, 0.25 + i * 0.28, -0.5);
    g.add(escalon);
  }
  g.position.set(...posicion);
  g.rotation.y = -0.5;
  escena.add(g);
  return g;
}

export function crearArenero(escena, posicion) {
  const arena = malla(new THREE.BoxGeometry(3, 0.12, 3), '#e8cf8a');
  arena.position.set(posicion[0], 0.06, posicion[2]);
  const borde = malla(new THREE.BoxGeometry(3.2, 0.1, 3.2), '#8a5a33');
  borde.position.set(posicion[0], 0.05, posicion[2]);
  escena.add(borde, arena);
  return arena;
}
