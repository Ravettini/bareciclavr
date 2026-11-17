import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * Agarrar y soltar con los controles del Quest 2 (gatillo o botón lateral),
 * y con el mouse cuando se juega en una PC sin visor.
 *
 * - Agarre cercano: si la mano toca un residuo, lo toma.
 * - Agarre a distancia: si no, toma el primer residuo que apunta el rayo
 *   (pensado para jugar sentado o con poco alcance). El objeto viaja a la mano.
 * - Al soltar, el residuo conserva la velocidad de la mano (se puede tirar).
 *
 * También sirve para "presionar" botones 3D (por ejemplo, Reiniciar).
 */
export class Manos {
  /**
   * @param {object} p
   * @param {THREE.WebGLRenderer} p.renderer
   * @param {THREE.Scene} p.escena
   * @param {THREE.Camera} p.camara
   * @param {() => import('../escena/residuos.js').Residuo[]} p.residuos
   * @param {() => THREE.Object3D[]} p.botones objetos con userData.alPresionar
   * @param {(r) => void} p.alSoltar
   */
  constructor({ renderer, escena, camara, residuos, botones, alSoltar }) {
    Object.assign(this, { renderer, escena, camara, residuos, botones, alSoltar });
    this.raycaster = new THREE.Raycaster();
    this.manos = [];
    for (let i = 0; i < 2; i++) this.manos.push(this.crearManoXR(i));
    this.manoMouse = this.crearManoMouse();
  }

  // ---------- Controles XR ----------

  crearManoXR(indice) {
    const { renderer, escena } = this;
    const control = renderer.xr.getController(indice); // espacio del rayo
    const agarre = renderer.xr.getControllerGrip(indice); // espacio de la empuñadura
    escena.add(control, agarre);
    agarre.add(modeloControl());

    const rayo = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
      new THREE.LineBasicMaterial({ color: '#ffffff' }),
    );
    rayo.visible = false;
    control.add(rayo);

    const mano = { tipo: 'xr', control, rayo, fuente: null, agarrado: null, presionados: 0, historial: [] };
    control.addEventListener('connected', (e) => {
      mano.fuente = e.data;
      rayo.visible = e.data.targetRayMode === 'tracked-pointer';
    });
    control.addEventListener('disconnected', () => {
      this.soltar(mano);
      mano.fuente = null;
      mano.presionados = 0;
      rayo.visible = false;
    });
    const presionar = () => {
      mano.presionados++;
      if (mano.presionados === 1) this.presionar(mano);
    };
    const liberar = () => {
      mano.presionados = Math.max(0, mano.presionados - 1);
      if (mano.presionados === 0) this.soltar(mano);
    };
    control.addEventListener('selectstart', presionar);
    control.addEventListener('squeezestart', presionar);
    control.addEventListener('selectend', liberar);
    control.addEventListener('squeezeend', liberar);
    return mano;
  }

  /** Intenta presionar un botón o agarrar un residuo con la mano. */
  presionar(mano) {
    if (mano.agarrado) return;
    const pos = mano.control.getWorldPosition(new THREE.Vector3());

    // 1) Agarre cercano.
    let elegido = null;
    let mejor = CONFIG.agarre.distanciaCercana;
    for (const r of this.residuos()) {
      if (!r.agarrable) continue;
      const d = r.raiz.position.distanceTo(pos) - r.radio * 0.5;
      if (d < mejor) { mejor = d; elegido = r; }
    }
    if (elegido) return this.agarrar(mano, elegido, false);

    // 2) Rayo: botones y residuos.
    const impacto = this.apuntado(mano);
    if (!impacto) return;
    if (impacto.boton) impacto.boton.userData.alPresionar();
    else this.agarrar(mano, impacto.residuo, true);
  }

  /** Primer residuo agarrable o botón que apunta el rayo de la mano. */
  apuntado(mano) {
    const objetivos = [...this.residuos().filter((r) => r.agarrable).map((r) => r.raiz), ...this.botones().filter((b) => b.visible)];
    if (objetivos.length === 0) return null;
    if (mano.tipo === 'xr') {
      mano.control.updateMatrixWorld();
      this.raycaster.ray.origin.setFromMatrixPosition(mano.control.matrixWorld);
      this.raycaster.ray.direction.set(0, 0, -1).transformDirection(mano.control.matrixWorld);
    }
    this.raycaster.far = CONFIG.agarre.distanciaRayo;
    const hits = this.raycaster.intersectObjects(objetivos, true);
    for (const h of hits) {
      let o = h.object;
      while (o) {
        if (o.userData.residuo) return { residuo: o.userData.residuo, distancia: h.distance };
        if (o.userData.alPresionar) return { boton: o, distancia: h.distance };
        o = o.parent;
      }
    }
    return null;
  }

  agarrar(mano, residuo, aDistancia) {
    // Si lo tenía la otra mano, se lo pasa.
    for (const m of [...this.manos, this.manoMouse]) if (m.agarrado === residuo) this.soltar(m, false);
    if (aDistancia) {
      // El objeto "vuela" a la mano: lo ubicamos un poco delante del control.
      const destino = mano.tipo === 'xr'
        ? new THREE.Vector3(0, 0, -0.06).applyMatrix4(mano.control.matrixWorld)
        : mano.control.position.clone();
      residuo.raiz.position.copy(destino);
    }
    mano.control.attach(residuo.raiz);
    residuo.estado = 'agarrado';
    residuo.ultimaMano = mano;
    mano.agarrado = residuo;
    mano.historial.length = 0;
    this.vibrar(mano, 0.3, 40);
  }

  soltar(mano, notificar = true) {
    const r = mano.agarrado;
    if (!r) return;
    mano.agarrado = null;
    this.escena.attach(r.raiz); // conserva la posición mundial
    // Velocidad estimada con las últimas posiciones (permite "tirar" el objeto).
    const h = mano.historial;
    r.velocidad.set(0, 0, 0);
    if (h.length >= 2) {
      const a = h[0], b = h[h.length - 1];
      const dt = b.t - a.t;
      if (dt > 0.001) r.velocidad.subVectors(b.p, a.p).divideScalar(dt).clampLength(0, CONFIG.fisica.velocidadMaxima);
    }
    r.estado = 'cayendo';
    if (notificar) this.alSoltar(r);
  }

  vibrar(mano, intensidad, ms) {
    const actuador = mano.fuente?.gamepad?.hapticActuators?.[0];
    try { actuador?.pulse?.(intensidad, ms); } catch { /* sin vibración */ }
  }

  // ---------- Mouse (PC sin visor) ----------

  crearManoMouse() {
    const control = new THREE.Object3D();
    control.name = 'ManoMouse';
    this.escena.add(control);
    const mano = { tipo: 'mouse', control, agarrado: null, historial: [], distancia: 0 };
    const canvas = this.renderer.domElement;
    const ndc = new THREE.Vector2();
    const actualizarRayo = (e) => {
      const rect = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camara);
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (this.renderer.xr.isPresenting) return;
      actualizarRayo(e);
      const impacto = this.apuntado(mano);
      if (!impacto) return;
      if (impacto.boton) return impacto.boton.userData.alPresionar();
      mano.distancia = impacto.distancia;
      control.position.copy(this.raycaster.ray.at(mano.distancia, new THREE.Vector3()));
      this.agarrar(mano, impacto.residuo, false);
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!mano.agarrado) return;
      actualizarRayo(e);
      this.raycaster.ray.at(mano.distancia, control.position);
    });
    canvas.addEventListener('pointerup', () => this.soltar(mano));
    return mano;
  }

  // ---------- Por frame ----------

  actualizar(tiempo) {
    for (const mano of [...this.manos, this.manoMouse]) {
      if (mano.agarrado) {
        mano.historial.push({ p: mano.agarrado.raiz.getWorldPosition(new THREE.Vector3()), t: tiempo });
        while (mano.historial.length > 2 && tiempo - mano.historial[0].t > 0.1) mano.historial.shift();
      }
      if (mano.tipo === 'xr' && mano.rayo.visible) {
        // El rayo se acorta y se pinta de amarillo cuando apunta a algo útil.
        const impacto = mano.agarrado ? null : this.apuntado(mano);
        mano.rayo.scale.z = impacto ? impacto.distancia : 0.6;
        mano.rayo.material.color.set(impacto ? '#ffd400' : '#ffffff');
      }
    }
  }
}

/** Modelo provisional del control (los modelos oficiales se bajan de internet; acá no). */
function modeloControl() {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.11, 8), new THREE.MeshLambertMaterial({ color: '#333333' }));
  cuerpo.rotation.x = -Math.PI / 3;
  cuerpo.position.set(0, -0.01, 0.03);
  const aro = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 6, 12), new THREE.MeshLambertMaterial({ color: '#555555' }));
  aro.position.set(0, 0.01, -0.02);
  aro.rotation.x = Math.PI / 2.5;
  g.add(cuerpo, aro);
  return g;
}
