import * as THREE from 'three';
import { malla } from '../escena/materiales.js';

/**
 * Pelota con física simple (gravedad, rebote y rodar por el piso).
 * Respeta la misma "interfaz" que los residuos (raiz, radio, estado, velocidad, agarrable),
 * así se agarra y se tira con el mismo sistema de manos.
 *
 * Estados: "enChico" (la tiene un chico), "lanzada" (la tiró un chico), "agarrado" (la tiene
 * el jugador), "cayendo" (suelta, con física), "reposo" (quieta en el piso).
 */
export class Pelota {
  constructor(escena, sonido) {
    this.radio = 0.11;
    this.raiz = new THREE.Group();
    this.raiz.name = 'Pelota';
    this.raiz.userData.residuo = this; // la detecta el sistema de manos
    const mitad = new THREE.SphereGeometry(this.radio, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const arriba = malla(mitad, '#e74c3c');
    const abajo = malla(mitad, '#f1f1f1');
    abajo.rotation.x = Math.PI;
    this.raiz.add(arriba, abajo);
    escena.add(this.raiz);
    this.velocidad = new THREE.Vector3();
    this.estado = 'reposo';
    this.sonido = sonido;
    this.id = 'pelota';
    this.atajable = true; // se puede atajar en el aire con la palma o el control
    this.radioAgarre = 0.22; // fácil de agarrar de cerca (también del piso)
    /** Colisiones extra que agregan los juegos (por ejemplo, el tablero de básquet). */
    this.colisiones = [];
  }

  get agarrable() {
    return this.estado === 'lanzada' || this.estado === 'cayendo' || this.estado === 'reposo';
  }

  /** Tiro parabólico desde "desde" para llegar a "hasta" en "duracion" segundos. */
  lanzar(desde, hasta, duracion = 1.1) {
    this.raiz.position.copy(desde);
    this.velocidad.subVectors(hasta, desde).divideScalar(duracion);
    this.velocidad.y += 0.5 * 9.8 * duracion;
    this.estado = 'lanzada';
  }

  /** La pelota llega rodando por el piso desde "desde" con velocidad "vel". */
  rodar(desde, vel) {
    this.raiz.position.copy(desde).setY(this.radio);
    this.velocidad.copy(vel);
    this.estado = 'cayendo';
  }

  actualizar(dt) {
    if (this.estado !== 'lanzada' && this.estado !== 'cayendo') return;
    const p = this.raiz.position;
    const v = this.velocidad;
    v.y -= 9.8 * dt;
    p.addScaledVector(v, dt);
    // Rueda: gira según el desplazamiento horizontal.
    this.raiz.rotation.x += (v.z * dt) / this.radio;
    this.raiz.rotation.z -= (v.x * dt) / this.radio;
    for (const colision of this.colisiones) colision(p, v, this.radio);
    if (p.y <= this.radio) {
      p.y = this.radio;
      if (v.y < -0.8) this.sonido?.rebote(Math.min(1, -v.y / 6));
      v.y = v.y < -0.8 ? -v.y * 0.55 : 0;
      this.estado = 'cayendo';
      // Rozamiento con el piso.
      const roce = Math.max(0, 1 - dt * 0.9);
      v.x *= roce;
      v.z *= roce;
      if (v.y === 0 && Math.hypot(v.x, v.z) < 0.06) {
        v.set(0, 0, 0);
        this.estado = 'reposo';
      }
    }
    // Límite de la plaza: si se va muy lejos, se frena.
    if (Math.hypot(p.x, p.z) > 14) {
      v.set(0, 0, 0);
      p.y = this.radio;
      this.estado = 'reposo';
    }
  }
}
