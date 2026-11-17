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
      this.asientos.push({ pivote, amplitud: 0.55, fase: i * 1.7, ocupado: true, angulo: 0, velocidad: 0 });
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
      // Sin chico, la hamaca se va frenando de a poco; con el chico, la mantiene (salvo que la
      // empuje el jugador: ver el capítulo "hamaca").
      if (!a.ocupado) a.amplitud = Math.max(0, a.amplitud - dt * 0.06);
      const anterior = a.angulo;
      a.angulo = a.amplitud * Math.sin(t * 2.1 + a.fase);
      a.velocidad = dt > 0 ? (a.angulo - anterior) / dt : 0;
      a.pivote.rotation.x = a.angulo;
    }
  }

  /** Posición mundial del asiento i. */
  posicionAsiento(i, destino) {
    const a = this.asientos[i];
    a.pivote.updateMatrixWorld(true);
    return destino.set(0, -1.65, 0).applyMatrix4(a.pivote.matrixWorld);
  }
}
// El chico se sienta con la cadera (a 0,5 m de sus pies) sobre el asiento.
const _desplazamiento = new THREE.Matrix4().makeTranslation(0, -1.65 - 0.47, 0);

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

/**
 * Aro de básquet infantil (aro a 2 m). Devuelve el centro del aro y el tablero
 * para detectar dobles y hacer rebotar la pelota.
 */
export function crearAro(escena, posicion, rotY = 0) {
  const g = new THREE.Group();
  g.name = 'AroBasquet';
  const poste = malla(new THREE.CylinderGeometry(0.06, 0.08, 2.5, 8), '#7f8c8d');
  poste.position.set(0, 1.25, -0.35);
  const brazo = malla(new THREE.BoxGeometry(0.08, 0.08, 0.35), '#7f8c8d');
  brazo.position.set(0, 2.25, -0.18);
  const tablero = malla(new THREE.BoxGeometry(1.1, 0.75, 0.04), '#ffffff');
  tablero.position.set(0, 2.3, 0);
  const marco = malla(new THREE.BoxGeometry(0.42, 0.32, 0.045), '#e74c3c');
  marco.position.set(0, 2.17, 0.002);
  const interior = malla(new THREE.BoxGeometry(0.36, 0.26, 0.05), '#ffffff');
  interior.position.set(0, 2.17, 0.004);
  const aro = malla(new THREE.TorusGeometry(0.24, 0.015, 6, 20), '#e67e22');
  aro.rotation.x = Math.PI / 2;
  aro.position.set(0, 2.0, 0.28);
  // Red: cono abierto de líneas.
  const red = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.16, 0.32, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true }));
  red.position.set(0, 1.84, 0.28);
  g.add(poste, brazo, tablero, marco, interior, aro, red);
  g.position.set(...posicion);
  g.rotation.y = rotY;
  escena.add(g);
  g.updateMatrixWorld(true);
  return {
    grupo: g,
    centro: new THREE.Vector3(0, 2.0, 0.28).applyMatrix4(g.matrixWorld),
    radio: 0.24,
    tablero: { punto: new THREE.Vector3(0, 2.3, 0.02).applyMatrix4(g.matrixWorld), normal: new THREE.Vector3(0, 0, 1).applyQuaternion(g.quaternion), ancho: 1.1, alto: 0.75 },
  };
}

/**
 * Burbujas de jabón (InstancedMesh: 1 draw call). Salen de un punto, flotan hacia el jugador
 * y se revientan al tocarlas.
 */
export class Burbujas {
  constructor(escena, cantidad = 24) {
    const mat = new THREE.MeshLambertMaterial({ color: '#bfe9ff', emissive: '#3a5f7a', transparent: true, opacity: 0.45, depthWrite: false });
    this.malla = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), mat, cantidad);
    this.malla.name = 'Burbujas';
    this.malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.malla.frustumCulled = false;
    this.lista = Array.from({ length: cantidad }, () => ({ activa: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), radio: 0.06, vida: 0, revienta: 0 }));
    this._m = new THREE.Matrix4();
    escena.add(this.malla);
    this.apagar();
  }

  soplar(desde, hacia) {
    const b = this.lista.find((x) => !x.activa);
    if (!b) return;
    b.activa = true;
    b.revienta = 0;
    b.vida = 9;
    b.radio = 0.05 + Math.random() * 0.05;
    b.pos.copy(desde);
    b.vel.subVectors(hacia, desde).setY(0).normalize().multiplyScalar(0.35 + Math.random() * 0.25);
    b.vel.x += (Math.random() - 0.5) * 0.3;
    b.vel.y = 0.12 + Math.random() * 0.12;
  }

  /** Revienta las burbujas cerca de "punto". Devuelve cuántas reventó. */
  tocar(punto, alcance = 0.1) {
    let n = 0;
    for (const b of this.lista) {
      if (b.activa && !b.revienta && b.pos.distanceTo(punto) < b.radio + alcance) { b.revienta = 0.15; n++; }
    }
    return n;
  }

  apagar() {
    for (const b of this.lista) b.activa = false;
    this.actualizar(0, 0);
  }

  actualizar(t, dt) {
    this.lista.forEach((b, i) => {
      if (b.activa) {
        if (b.revienta) {
          b.revienta -= dt;
          if (b.revienta <= 0) b.activa = false;
        } else {
          b.vida -= dt;
          b.pos.addScaledVector(b.vel, dt);
          b.pos.x += Math.sin(t * 2 + i) * 0.002;
          b.vel.y -= dt * 0.03;
          if (b.vida <= 0 || b.pos.y < 0.1) b.activa = false;
        }
      }
      const escala = !b.activa ? 0 : b.revienta ? b.radio * (1 + (0.15 - b.revienta) * 6) : b.radio;
      this._m.makeScale(escala, escala, escala).setPosition(b.pos);
      this.malla.setMatrixAt(i, this._m);
    });
    this.malla.instanceMatrix.needsUpdate = true;
  }
}
