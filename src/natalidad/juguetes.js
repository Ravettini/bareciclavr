import * as THREE from 'three';
import { malla } from '../escena/materiales.js';

/**
 * Juguetes que quedan en el piso donde un chico se esfumó: un balde, una pelotita,
 * un autito, una soga. Son pocos (uno por chico), así que se crean como mallas comunes.
 */
const TIPOS = ['balde', 'pelotita', 'autito', 'soga'];

export class Juguetes {
  constructor(escena) {
    this.escena = escena;
    this.lista = [];
    this.n = 0;
  }

  dejar(pos) {
    const tipo = TIPOS[this.n++ % TIPOS.length];
    const g = new THREE.Group();
    g.name = `Juguete_${tipo}`;
    if (tipo === 'balde') {
      const balde = malla(new THREE.CylinderGeometry(0.09, 0.07, 0.14, 10, 1, true), '#e74c3c', { side: THREE.DoubleSide });
      balde.position.y = 0.07;
      const fondo = malla(new THREE.CircleGeometry(0.07, 10), '#c0392b');
      fondo.rotation.x = -Math.PI / 2;
      fondo.position.y = 0.005;
      const pala = malla(new THREE.BoxGeometry(0.05, 0.015, 0.2), '#f1c40f');
      pala.position.set(0.15, 0.01, 0.05);
      pala.rotation.y = 0.6;
      g.add(balde, fondo, pala);
      g.rotation.z = 1.3; // volcado
      g.position.y = 0.07;
    } else if (tipo === 'pelotita') {
      const p = malla(new THREE.IcosahedronGeometry(0.07, 1), '#3498db');
      p.position.y = 0.07;
      g.add(p);
    } else if (tipo === 'autito') {
      const cuerpo = malla(new THREE.BoxGeometry(0.22, 0.07, 0.12), '#f39c12');
      cuerpo.position.y = 0.07;
      const techo = malla(new THREE.BoxGeometry(0.11, 0.05, 0.1), '#e67e22');
      techo.position.set(-0.02, 0.13, 0);
      g.add(cuerpo, techo);
      for (const [x, z] of [[-0.07, 0.065], [0.07, 0.065], [-0.07, -0.065], [0.07, -0.065]]) {
        const rueda = malla(new THREE.CylinderGeometry(0.032, 0.032, 0.02, 8), '#2c3e50');
        rueda.rotation.x = Math.PI / 2;
        rueda.position.set(x, 0.032, z);
        g.add(rueda);
      }
    } else {
      const curva = new THREE.CatmullRomCurve3([[-0.4, 0, 0], [-0.2, 0, 0.15], [0, 0, -0.05], [0.25, 0, 0.12], [0.45, 0, -0.1]].map((v) => new THREE.Vector3(...v)));
      const soga = malla(new THREE.TubeGeometry(curva, 20, 0.012, 5), '#ecf0f1');
      soga.position.y = 0.015;
      for (const x of [-0.4, 0.45]) {
        const mango = malla(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 6), '#e74c3c');
        mango.rotation.z = Math.PI / 2;
        mango.position.set(x, 0.02, x < 0 ? 0 : -0.1);
        g.add(mango);
      }
      g.add(soga);
    }
    g.position.x = pos.x;
    g.position.z = pos.z;
    g.rotation.y = Math.random() * Math.PI * 2;
    this.escena.add(g);
    this.lista.push(g);
  }

  limpiar() {
    for (const g of this.lista) this.escena.remove(g);
    this.lista.length = 0;
    this.n = 0;
  }
}
