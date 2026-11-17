import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from '../config.js';
import { malla } from './materiales.js';

/**
 * Residuo interactivo. Su aspecto sale de "forma" (primitivas provisionales)
 * o, si la definición trae "modelo", de un archivo .glb definitivo.
 *
 * Estados:
 *  - "mesa":        quieto, esperando que lo agarren
 *  - "agarrado":    sigue a una mano (control o mouse)
 *  - "cayendo":     suelto, con gravedad
 *  - "piso":        cayó al piso; vuelve a la mesa tras una espera
 *  - "clasificado": depositado correctamente; ya no participa
 */
export class Residuo {
  /** @param {object} def entrada de reglas.residuos */
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.raiz = new THREE.Group();
    this.raiz.name = `Residuo_${def.id}`;
    this.raiz.userData.residuo = this;
    const { cuerpo, radio } = crearForma(def.forma);
    this.cuerpo = cuerpo;
    this.radio = radio; // radio aproximado para apoyo y detección
    this.raiz.add(cuerpo);

    const { centro, alto } = CONFIG.mesa;
    const [ox, , oz] = def.posicionMesa || [0, 0, 0];
    this.posicionInicial = new THREE.Vector3(centro[0] + ox, alto + radio, centro[2] + oz);
    this.velocidad = new THREE.Vector3();
    this.estado = 'mesa';
    this.tiempoEnPiso = 0;
    this.animacion = null;
    this.volverAMesa();
  }

  /** Reemplaza el aspecto provisional por un modelo .glb (si la definición lo indica). */
  async cargarModelo(cargador = new GLTFLoader()) {
    if (!this.def.modelo) return;
    try {
      const gltf = await cargador.loadAsync(this.def.modelo);
      this.raiz.remove(this.cuerpo);
      this.cuerpo = gltf.scene;
      this.raiz.add(this.cuerpo);
    } catch (e) {
      console.warn(`No se pudo cargar ${this.def.modelo}; se usa la forma provisional.`, e);
    }
  }

  volverAMesa() {
    this.raiz.position.copy(this.posicionInicial);
    this.raiz.quaternion.identity();
    this.raiz.scale.setScalar(1);
    this.raiz.visible = true;
    this.velocidad.set(0, 0, 0);
    this.estado = 'mesa';
    this.animacion = null;
  }

  get agarrable() {
    return this.estado === 'mesa' || this.estado === 'cayendo' || this.estado === 'piso';
  }

  /** Animación de "entrada" al contenedor: se encoge hacia la boca y desaparece. */
  animarDeposito(destino) {
    this.estado = 'clasificado';
    this.animacion = { t: 0, desde: this.raiz.position.clone(), hasta: destino.clone() };
  }

  actualizarAnimacion(dt) {
    const a = this.animacion;
    if (!a) return;
    a.t = Math.min(1, a.t + dt / 0.35);
    this.raiz.position.lerpVectors(a.desde, a.hasta, a.t);
    this.raiz.scale.setScalar(1 - a.t * 0.9);
    if (a.t >= 1) {
      this.raiz.visible = false;
      this.animacion = null;
    }
  }
}

/**
 * Formas provisionales con primitivas (con el origen en el centro del objeto).
 * Para agregar una forma nueva, sumá un caso acá y usala desde reglas.json.
 */
function crearForma(forma) {
  const g = new THREE.Group();
  switch (forma) {
    case 'botella': {
      const cuerpo = malla(new THREE.CylinderGeometry(0.035, 0.035, 0.17, 10), '#8fd3f4');
      cuerpo.position.y = -0.02;
      const etiqueta = malla(new THREE.CylinderGeometry(0.036, 0.036, 0.06, 10), '#2a7de1');
      etiqueta.position.y = -0.02;
      const cuello = malla(new THREE.CylinderGeometry(0.014, 0.035, 0.05, 10), '#8fd3f4');
      cuello.position.y = 0.09;
      const tapa = malla(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 8), '#1d4fa0');
      tapa.position.y = 0.125;
      g.add(cuerpo, etiqueta, cuello, tapa);
      g.position.y = -0.015; // centra la botella (de -0,12 a +0,12 m)
      return { cuerpo: g, radio: 0.12 };
    }
    case 'lata': {
      const cuerpo = malla(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 12), '#c9ced6');
      const banda = malla(new THREE.CylinderGeometry(0.0335, 0.0335, 0.07, 12), '#d62f2f');
      const tapa = malla(new THREE.CylinderGeometry(0.029, 0.033, 0.008, 12), '#9aa1aa');
      tapa.position.y = 0.064;
      g.add(cuerpo, banda, tapa);
      return { cuerpo: g, radio: 0.065 };
    }
    case 'servilleta': {
      const geo = new THREE.IcosahedronGeometry(0.045, 1);
      const pos = geo.attributes.position;
      // Deformación determinista para que parezca un bollo arrugado.
      for (let i = 0; i < pos.count; i++) {
        const f = 0.8 + 0.35 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1);
        pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f * 0.8, pos.getZ(i) * f);
      }
      geo.computeVertexNormals();
      const bollo = malla(geo, '#f4f1ea');
      const mancha = malla(new THREE.IcosahedronGeometry(0.02, 0), '#a0642d');
      mancha.position.set(0.03, 0.012, 0.02);
      g.add(bollo, mancha);
      return { cuerpo: g, radio: 0.045 };
    }
    default: {
      const caja = malla(new THREE.BoxGeometry(0.08, 0.08, 0.08), '#ff00ff');
      g.add(caja);
      return { cuerpo: g, radio: 0.05 };
    }
  }
}
