import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { malla } from './materiales.js';
import { texturaTexto } from './textos.js';

/**
 * Contenedor de residuos (verde o negro). Su "boca" es una zona de detección:
 * cuando un residuo suelto entra por arriba, se considera depositado.
 */
export class Contenedor {
  /**
   * @param {string} id clave en reglas.contenedores ("verde" | "negro")
   * @param {object} datos definición del JSON (nombre, descripción, color)
   */
  constructor(id, datos) {
    this.id = id;
    this.datos = datos;
    const { ancho, alto } = CONFIG.contenedores;
    this.ancho = ancho;
    this.alto = alto;
    this.grupo = new THREE.Group();
    this.grupo.name = `Contenedor_${id}`;
    this.grupo.position.set(...CONFIG.contenedores[id].posicion);

    // Material propio (no compartido) para poder hacerlo "brillar" como feedback.
    this.material = new THREE.MeshLambertMaterial({ color: datos.color, flatShading: true });
    const pared = 0.03;
    const paredes = [
      [ancho, alto, pared, 0, alto / 2, ancho / 2 - pared / 2],
      [ancho, alto, pared, 0, alto / 2, -ancho / 2 + pared / 2],
      [pared, alto, ancho, ancho / 2 - pared / 2, alto / 2, 0],
      [pared, alto, ancho, -ancho / 2 + pared / 2, alto / 2, 0],
      [ancho, pared, ancho, 0, pared / 2, 0],
    ];
    for (const [w, h, d, x, y, z] of paredes) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.material);
      m.position.set(x, y, z);
      this.grupo.add(m);
    }
    // Interior oscuro para que se lea como "boca" abierta.
    const fondo = malla(new THREE.PlaneGeometry(ancho - 2 * pared, ancho - 2 * pared), '#111111');
    fondo.rotation.x = -Math.PI / 2;
    fondo.position.y = pared + 0.002;
    this.grupo.add(fondo);
    // Borde superior grueso.
    const borde = malla(bordeHueco(ancho + 0.04, ancho - 0.02, 0.04), '#3a3a3a');
    borde.position.y = alto;
    this.grupo.add(borde);
    // Etiqueta frontal.
    const etiqueta = new THREE.Mesh(
      new THREE.PlaneGeometry(ancho * 0.9, ancho * 0.45),
      new THREE.MeshBasicMaterial({ map: texturaEtiqueta(datos) }),
    );
    etiqueta.position.set(0, alto * 0.62, ancho / 2 + 0.002);
    this.grupo.add(etiqueta);
    // Orientar la etiqueta hacia el jugador.
    this.grupo.lookAt(0, 0, 0.6);
    this.grupo.updateMatrixWorld(true);

    this._brillo = 0;
    this._colorBrillo = new THREE.Color();
  }

  /** Posición mundial del centro de la boca. */
  get boca() {
    return new THREE.Vector3(this.grupo.position.x, this.alto, this.grupo.position.z);
  }

  /** ¿El punto (posición mundial del centro de un residuo) está dentro de la boca? */
  contiene(punto) {
    const l = this.grupo.worldToLocal(_local.copy(punto));
    const m = this.ancho / 2 - 0.03;
    return Math.abs(l.x) < m && Math.abs(l.z) < m && l.y < this.alto && l.y > 0;
  }

  /** ¿Un residuo de radio r está chocando contra las paredes exteriores? */
  tocaParedExterior(punto, r) {
    const l = this.grupo.worldToLocal(_local.copy(punto));
    const m = this.ancho / 2 + r;
    return Math.abs(l.x) < m && Math.abs(l.z) < m && l.y < this.alto && !this.contiene(punto);
  }

  /** Destello de color como feedback visual. */
  destellar(color) {
    this._colorBrillo.set(color);
    this._brillo = 1;
  }

  actualizar(dt) {
    if (this._brillo <= 0) return;
    this._brillo = Math.max(0, this._brillo - dt * 1.6);
    this.material.emissive.copy(this._colorBrillo).multiplyScalar(this._brillo * 0.8);
  }
}

const _local = new THREE.Vector3();

function texturaEtiqueta(datos) {
  return texturaTexto(datos.nombre.toUpperCase(), { fondo: '#ffffff', color: datos.color === '#26282b' ? '#111111' : datos.color, ancho: 512, alto: 256, tamano: 64 });
}

/** Marco cuadrado hueco (borde de la boca) como una sola geometría. */
function bordeHueco(exterior, interior, alto) {
  const forma = new THREE.Shape();
  const e = exterior / 2, i = interior / 2;
  forma.moveTo(-e, -e); forma.lineTo(e, -e); forma.lineTo(e, e); forma.lineTo(-e, e); forma.lineTo(-e, -e);
  const hueco = new THREE.Path();
  hueco.moveTo(-i, -i); hueco.lineTo(-i, i); hueco.lineTo(i, i); hueco.lineTo(i, -i); hueco.lineTo(-i, -i);
  forma.holes.push(hueco);
  const geo = new THREE.ExtrudeGeometry(forma, { depth: alto, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -alto / 2, 0);
  return geo;
}
