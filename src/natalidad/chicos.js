import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { material } from '../escena/materiales.js';

/**
 * Chicos low-poly, sin caras ni rasgos realistas (no representan a nadie en particular).
 * Se dibujan con dos InstancedMesh (cuerpo y cabeza): 2 draw calls para todos los chicos,
 * algo importante para mantener 72 FPS en Quest 2.
 *
 * Cada chico tiene un "comportamiento":
 *  - corre:   da vueltas alrededor de un centro
 *  - salta:   salta en el lugar (soga, rayuela)
 *  - hamaca:  sentado en una hamaca
 *  - pelota:  el chico que juega a la pelota con el jugador (lo maneja guion.js)
 *  - seVa:    camina hacia afuera de la plaza hasta perderse en la niebla
 *  - ido:     ya no está
 */
const COLORES_REMERA = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#2ecc71', '#ff6f91'];
const COLORES_PIEL = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export class Chicos {
  constructor(escena, definiciones) {
    const cuerpoGeo = mergeGeometries([
      new THREE.CapsuleGeometry(0.15, 0.3, 3, 8).translate(0, 0.62, 0), // torso
      new THREE.CylinderGeometry(0.055, 0.05, 0.42, 6).translate(-0.07, 0.21, 0), // piernas
      new THREE.CylinderGeometry(0.055, 0.05, 0.42, 6).translate(0.07, 0.21, 0),
    ]);
    const cabezaGeo = new THREE.IcosahedronGeometry(0.13, 1).translate(0, 1.0, 0);
    const n = definiciones.length;
    this.cuerpos = new THREE.InstancedMesh(cuerpoGeo, material('#ffffff'), n);
    this.cabezas = new THREE.InstancedMesh(cabezaGeo, material('#ffffff'), n);
    this.cuerpos.name = 'Chicos';
    for (const im of [this.cuerpos, this.cabezas]) {
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false; // se mueven por toda la plaza
    }
    this.lista = definiciones.map((d, i) => {
      this.cuerpos.setColorAt(i, new THREE.Color(COLORES_REMERA[i % COLORES_REMERA.length]));
      this.cabezas.setColorAt(i, new THREE.Color(COLORES_PIEL[(i * 3) % COLORES_PIEL.length]));
      return {
        indice: i,
        ...d,
        comportamientoInicial: d.comportamiento,
        posicion: new THREE.Vector3(...(d.posicion || [0, 0, 0])),
        posicionInicial: d.posicion || [0, 0, 0],
        rumbo: 0, // rotación en Y
        salto: 0,
        escala: d.escala || 1,
        fase: i * 0.9,
        matrizExterna: null, // para el chico de la hamaca
      };
    });
    escena.add(this.cuerpos, this.cabezas);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._eje = new THREE.Vector3(0, 1, 0);
  }

  get presentes() {
    return this.lista.filter((c) => c.comportamiento !== 'ido' && c.comportamiento !== 'seVa');
  }

  /** El chico deja de jugar y camina hacia afuera de la plaza. */
  irse(chico) {
    if (chico.comportamiento === 'seVa' || chico.comportamiento === 'ido') return;
    if (chico.matrizExterna) {
      // Se baja de la hamaca.
      chico.posicion.setFromMatrixPosition(chico.matrizExterna).setY(0);
      chico.matrizExterna = null;
    }
    const direccion = new THREE.Vector3(chico.posicion.x, 0, chico.posicion.z);
    if (direccion.lengthSq() < 0.01) direccion.set(0, 0, -1);
    chico.destino = direccion.normalize().multiplyScalar(26);
    chico.comportamiento = 'seVa';
  }

  reiniciar() {
    for (const c of this.lista) {
      c.comportamiento = c.comportamientoInicial;
      c.posicion.set(...c.posicionInicial);
      c.matrizExterna = null;
    }
  }

  actualizar(t, dt, hamacas) {
    for (const c of this.lista) {
      let visible = true;
      c.salto = 0;
      switch (c.comportamiento) {
        case 'corre': {
          const ang = t * c.velocidad + c.fase;
          c.posicion.set(c.centro[0] + Math.cos(ang) * c.radio, 0, c.centro[2] + Math.sin(ang) * c.radio);
          // Mira hacia donde corre (tangente al círculo).
          c.rumbo = Math.atan2(-Math.sin(ang) * c.velocidad, Math.cos(ang) * c.velocidad);
          c.salto = Math.abs(Math.sin(t * 9 + c.fase)) * 0.06;
          break;
        }
        case 'salta':
          c.salto = Math.abs(Math.sin(t * 4.2 + c.fase)) * 0.28;
          c.rumbo = Math.atan2(-c.posicion.x, -c.posicion.z);
          break;
        case 'hamaca':
          c.matrizExterna = hamacas.matrizAsiento(c.asiento, c.matrizExterna || new THREE.Matrix4());
          break;
        case 'pelota':
          // Posición y rumbo los maneja el guion; acá solo un leve balanceo.
          c.salto = c.corriendo ? Math.abs(Math.sin(t * 10)) * 0.06 : Math.abs(Math.sin(t * 2.5)) * 0.015;
          break;
        case 'seVa': {
          const paso = _tmp.subVectors(c.destino, c.posicion).setY(0);
          const d = paso.length();
          if (d < 0.2) { c.comportamiento = 'ido'; visible = false; break; }
          c.posicion.addScaledVector(paso.normalize(), Math.min(d, dt * 1.3));
          c.rumbo = Math.atan2(paso.x, paso.z);
          c.salto = Math.abs(Math.sin(t * 7 + c.fase)) * 0.04;
          break;
        }
        case 'ido':
          visible = false;
          break;
      }
      this.escribirMatriz(c, visible);
    }
    this.cuerpos.instanceMatrix.needsUpdate = true;
    this.cabezas.instanceMatrix.needsUpdate = true;
  }

  escribirMatriz(c, visible) {
    const m = this._m;
    if (!visible) {
      m.makeScale(0, 0, 0);
    } else if (c.matrizExterna) {
      m.copy(c.matrizExterna).scale(this._s.setScalar(c.escala));
    } else {
      this._q.setFromAxisAngle(this._eje, c.rumbo);
      m.compose(_tmp2.set(c.posicion.x, c.salto, c.posicion.z), this._q, this._s.setScalar(c.escala));
    }
    this.cuerpos.setMatrixAt(c.indice, m);
    this.cabezas.setMatrixAt(c.indice, m);
  }

  /** Posición de las manos de un chico (para sostener la pelota). */
  manos(c, destino) {
    const frente = _tmp.set(Math.sin(c.rumbo), 0, Math.cos(c.rumbo));
    return destino.copy(c.posicion).addScaledVector(frente, 0.25 * c.escala).setY((0.75 + c.salto) * c.escala);
  }
}
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
