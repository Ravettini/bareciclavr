import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { CONFIG } from '../config.js';

/**
 * Agarrar y soltar objetos con:
 *  - Controles del Quest 2: gatillo o botón lateral (grip).
 *  - Manos (seguimiento de manos): CERRAR la mano cerca del objeto para agarrarlo y ABRIRLA para
 *    soltarlo; también funciona el pellizco (índice + pulgar).
 *  - Mouse, en una PC sin visor.
 *
 * Además:
 *  - Agarre a distancia con el rayo (útil sentado): apuntar y apretar / pellizcar.
 *  - Atajar: si un objeto "atajable" en movimiento llega a la palma (o al control con el botón
 *    apretado), queda agarrado. Con la mano, se tira moviendo la mano rápido o abriéndola.
 *  - Al soltar, el objeto conserva la velocidad de la mano (se puede tirar).
 *
 * Los objetos agarrables exponen: raiz (Object3D), radio, estado, velocidad, agarrable y,
 * opcionalmente, radioAgarre (distancia extra para agarrarlos de cerca) y atajable.
 */
export class Manos {
  /**
   * @param {object} p
   * @param {THREE.WebGLRenderer} p.renderer
   * @param {THREE.Scene} p.escena
   * @param {THREE.Camera} p.camara
   * @param {() => object[]} p.residuos objetos agarrables
   * @param {() => THREE.Object3D[]} p.botones objetos con userData.alPresionar
   * @param {(obj) => void} p.alSoltar
   * @param {THREE.Object3D} [p.padre] grupo del jugador (para moverlo por la escena); por defecto, la escena
   */
  constructor({ renderer, escena, camara, residuos, botones, alSoltar, padre }) {
    Object.assign(this, { renderer, escena, camara, residuos, botones, alSoltar });
    this.padre = padre || escena;
    this.raycaster = new THREE.Raycaster();
    this.fabricaManos = new XRHandModelFactory();
    this.manos = [];
    for (let i = 0; i < 2; i++) this.manos.push(this.crearManoXR(i));
    this.manoMouse = this.crearManoMouse();
  }

  // ---------- Controles y manos XR ----------

  crearManoXR(indice) {
    const { renderer } = this;
    const control = renderer.xr.getController(indice); // espacio del rayo
    const agarre = renderer.xr.getControllerGrip(indice); // empuñadura (donde está la mano)
    const manoReal = renderer.xr.getHand(indice); // articulaciones (hand tracking)
    this.padre.add(control, agarre, manoReal);
    const modelo = modeloControl();
    agarre.add(modelo);
    manoReal.add(this.fabricaManos.createHandModel(manoReal, 'spheres'));
    // Ancla en la palma: ahí se "pega" lo que se agarra con la mano.
    const palma = new THREE.Object3D();
    palma.name = 'Palma';
    manoReal.add(palma);

    const rayo = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
      new THREE.LineBasicMaterial({ color: '#ffffff' }),
    );
    rayo.visible = false;
    control.add(rayo);

    const mano = {
      tipo: 'xr', control, agarre, manoReal, palma, rayo, fuente: null,
      agarrado: null, modo: null, presionados: 0, historial: [],
      cierre: 0, cerrada: false, velocidadMano: 0, posAnterior: new THREE.Vector3(), tuvoCierre: false,
    };
    control.addEventListener('connected', (e) => {
      mano.fuente = e.data;
      rayo.visible = e.data.targetRayMode === 'tracked-pointer';
      modelo.visible = !e.data.hand;
    });
    control.addEventListener('disconnected', () => {
      this.soltar(mano);
      mano.fuente = null;
      mano.presionados = 0;
      rayo.visible = false;
    });
    const presionar = () => {
      mano.presionados++;
      if (mano.presionados !== 1) return;
      // Si atajó con el control sin apretar, apretar y soltar el botón lo tira.
      if (mano.agarrado) { mano.modo = 'boton'; return; }
      this.presionar(mano);
    };
    const liberar = () => {
      mano.presionados = Math.max(0, mano.presionados - 1);
      if (mano.presionados === 0 && mano.modo === 'boton') this.soltar(mano);
    };
    control.addEventListener('selectstart', presionar);
    control.addEventListener('squeezestart', presionar);
    control.addEventListener('selectend', liberar);
    control.addEventListener('squeezeend', liberar);
    return mano;
  }

  esMano(mano) {
    return !!mano.fuente?.hand;
  }

  /** Intenta presionar un botón o agarrar algo (gatillo, grip o pellizco). */
  presionar(mano) {
    if (mano.agarrado) return;
    const cercano = this.masCercano(this.puntoDeAgarre(mano), CONFIG.agarre.distanciaCercana);
    if (cercano) return this.agarrar(mano, cercano, false, 'boton');
    const impacto = this.apuntado(mano);
    if (!impacto) return;
    if (impacto.boton) impacto.boton.userData.alPresionar();
    else this.agarrar(mano, impacto.residuo, true, 'boton');
  }

  /** Objeto agarrable más cercano a un punto (dentro del alcance de cada objeto). */
  masCercano(punto, alcanceBase) {
    let elegido = null;
    let mejor = Infinity;
    for (const r of this.residuos()) {
      if (!r.agarrable) continue;
      const d = r.raiz.getWorldPosition(_tmp).distanceTo(punto) - r.radio * 0.5;
      const alcance = r.radioAgarre ?? alcanceBase;
      if (d < alcance && d < mejor) { mejor = d; elegido = r; }
    }
    return elegido;
  }

  /**
   * Dónde agarra la mano: con manos, el centro de la palma; con controles, la empuñadura
   * (donde está la mano real), o el origen del rayo si no hay empuñadura.
   */
  puntoDeAgarre(mano, destino = new THREE.Vector3()) {
    if (this.esMano(mano) && mano.manoReal.joints?.wrist) return mano.palma.getWorldPosition(destino);
    if (mano.agarre && mano.fuente?.gripSpace) return mano.agarre.getWorldPosition(destino);
    return mano.control.getWorldPosition(destino);
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

  /**
   * @param {'boton'|'cierre'|'atajada'} modo cómo se agarró (define cómo se suelta)
   */
  agarrar(mano, residuo, aDistancia, modo = 'boton') {
    for (const m of [...this.manos, this.manoMouse]) if (m.agarrado === residuo) this.soltar(m, false);
    const conMano = this.esMano(mano);
    const ancla = conMano ? mano.palma : (mano.tipo === 'xr' && mano.fuente?.gripSpace ? mano.agarre : mano.control);
    if (aDistancia || conMano) {
      // El objeto viaja a la mano (con la mano, queda apoyado en la palma).
      let destino;
      if (mano.tipo !== 'xr') destino = mano.control.position.clone();
      else if (conMano) destino = mano.palma.localToWorld(new THREE.Vector3(0, -residuo.radio * 0.6, 0));
      else destino = new THREE.Vector3(0, 0, -0.06).applyMatrix4(ancla.matrixWorld);
      ancla.worldToLocal(destino);
      ancla.add(residuo.raiz);
      residuo.raiz.position.copy(destino);
    } else {
      ancla.attach(residuo.raiz);
    }
    residuo.estado = 'agarrado';
    residuo.ultimaMano = mano;
    mano.agarrado = residuo;
    mano.modo = modo;
    mano.tuvoCierre = mano.cierre > 0.6;
    mano.picoVelocidad = 0;
    mano.agarradoEn = performance.now();
    mano.historial.length = 0;
    this.vibrar(mano, 0.3, 40);
  }

  /** @param {{tiro?: boolean}} [opciones] tiro: true si ya se sabe que es un tiro (gesto de tirar con la palma) */
  soltar(mano, notificar = true, { tiro: esTiro = false } = {}) {
    const r = mano.agarrado;
    if (!r) return;
    mano.agarrado = null;
    mano.modo = null;
    this.escena.attach(r.raiz);
    // ¿Tirar o apoyar? Se mira la velocidad de los últimos ~80 ms antes de soltar:
    //  - Si la mano ya estaba casi quieta (< 0,5 m/s), es "apoyar / dejar caer": velocidad suave,
    //    sin refuerzo (por ejemplo, llevar un residuo al contenedor y soltarlo).
    //  - Si no, es un TIRO: se usa la velocidad MÁXIMA de los últimos ~250 ms (no el promedio: al
    //    soltar, el brazo ya está frenando y bajando, y la pelota salía floja y hacia abajo).
    // Cada velocidad se mide sobre un tramo de ~50 ms (no de un cuadro): así un salto del
    // seguimiento no produce un tiro exagerado.
    const h = mano.historial;
    r.velocidad.set(0, 0, 0);
    let tiro = false;
    if (h.length >= 2) {
      const ultimo = h[h.length - 1];
      let j = h.length - 2;
      while (j > 0 && ultimo.t - h[j].t < 0.08) j--;
      const dtReciente = ultimo.t - h[j].t;
      const reciente = dtReciente > 0.004 ? _tmp2.subVectors(ultimo.p, h[j].p).divideScalar(dtReciente) : _tmp2.set(0, 0, 0);
      if (reciente.length() < 0.5 && !esTiro) {
        r.velocidad.copy(reciente);
      } else {
        tiro = true;
        for (let k = 1; k < h.length; k++) {
          if (ultimo.t - h[k].t > 0.25) continue; // ventana de 250 ms antes de soltar
          let i = k - 1;
          while (i > 0 && h[k].t - h[i].t < 0.05) i--;
          const dt = h[k].t - h[i].t;
          if (dt < 0.004) continue;
          const v = _tmp.subVectors(h[k].p, h[i].p).divideScalar(dt);
          if (v.lengthSq() > r.velocidad.lengthSq()) r.velocidad.copy(v);
        }
      }
    }
    // (Con la mano se usa lo mismo: la velocidad suavizada de la pelota. Las velocidades cuadro a
    // cuadro del seguimiento de manos tienen saltos que desviaban la dirección del tiro.)
    // Refuerzo solo para tiros: apoyar o dejar caer no cambia.
    if (tiro) r.velocidad.multiplyScalar(CONFIG.fisica.refuerzoTiro);
    r.velocidad.clampLength(0, CONFIG.fisica.velocidadMaxima);
    r.estado = 'cayendo';
    r.soltadoEn = performance.now(); // para no volver a atajarlo apenas sale de la mano
    if (notificar) this.alSoltar(r);
  }

  vibrar(mano, intensidad, ms) {
    const actuador = mano.fuente?.gamepad?.hapticActuators?.[0];
    try { actuador?.pulse?.(intensidad, ms); } catch { /* sin vibración */ }
  }

  // ---------- Mano: cierre y palma ----------

  /** Actualiza la palma, cuánto está cerrada la mano (0 abierta … 1 puño) y su velocidad. */
  actualizarPalma(mano, dt) {
    mano.conPalma = false;
    const j = mano.manoReal.joints;
    if (!this.esMano(mano) || !j?.wrist || !j['middle-finger-phalanx-proximal']) { mano.cierre = 0; return; }
    const muñeca = j.wrist.position;
    // Centro de la palma calculado desde la MUÑECA (no desde los nudillos): no se mueve al abrir
    // o cerrar los dedos, así la pelota no "salta" al soltarla. En el espacio de la muñeca de
    // WebXR, -Z apunta a los dedos y -Y hacia el lado de la palma.
    mano.palma.quaternion.copy(j.wrist.quaternion);
    mano.palma.position.copy(_offsetPalma).applyQuaternion(j.wrist.quaternion).add(muñeca);
    // Distancia promedio de las puntas de los dedos a la muñeca: abierta ≈ 17 cm, puño ≈ 9 cm.
    let suma = 0, n = 0;
    for (const dedo of ['index', 'middle', 'ring', 'pinky']) {
      const punta = j[`${dedo}-finger-tip`];
      if (punta) { suma += punta.position.distanceTo(muñeca); n++; }
    }
    if (!n) return;
    mano.conPalma = true;
    mano.cierre = THREE.MathUtils.clamp((0.165 - suma / n) / 0.07, 0, 1);
    const pos = mano.palma.getWorldPosition(_tmp3);
    if (dt > 0) {
      const vel = new THREE.Vector3().subVectors(pos, mano.posAnterior).divideScalar(dt);
      mano.velocidadMano = vel.length();
      // Velocidades recientes de la palma: al soltar se usa la máxima (el impulso del tiro).
      const ahora = performance.now();
      (mano.velocidades ||= []).push({ v: vel, t: ahora });
      while (mano.velocidades.length && ahora - mano.velocidades[0].t > 150) mano.velocidades.shift();
    }
    mano.posAnterior.copy(pos);
  }

  /** Gestos de la mano: cerrar para agarrar, abrir para soltar, tirar con la palma abierta. */
  gestosMano(mano) {
    if (!mano.conPalma) return;
    const estabaCerrada = mano.cerrada;
    if (mano.cierre > 0.6) mano.cerrada = true;
    else if (mano.cierre < 0.35) mano.cerrada = false;

    if (!mano.agarrado && mano.cerrada && !estabaCerrada) {
      // Cerró la mano: agarra lo que tenga cerca de la palma.
      const r = this.masCercano(mano.palma.getWorldPosition(new THREE.Vector3()), 0.1);
      if (r) this.agarrar(mano, r, false, 'cierre');
    } else if (mano.agarrado && mano.modo === 'cierre' && !mano.cerrada) {
      this.soltar(mano); // abrió la mano
    } else if (mano.agarrado && mano.modo === 'atajada') {
      // Atajó con la palma abierta: se suelta al cerrar y abrir la mano, o tirando:
      // cuando la mano pasa los 1,6 m/s y empieza a frenar (el "pico" del tiro).
      // Los primeros 0,4 s no cuentan: el movimiento de atajar no es un tiro.
      if (performance.now() - mano.agarradoEn < 400) { mano.picoVelocidad = 0; return; }
      if (mano.cerrada) mano.tuvoCierre = true;
      if (mano.tuvoCierre && !mano.cerrada) return this.soltar(mano);
      if (!mano.cerrada && mano.velocidadMano > 1.6) mano.picoVelocidad = Math.max(mano.picoVelocidad || 0, mano.velocidadMano);
      else if (mano.picoVelocidad && mano.velocidadMano < mano.picoVelocidad * 0.6) { mano.picoVelocidad = 0; this.soltar(mano, true, { tiro: true }); }
    }
  }

  /**
   * Atajar en el aire: con la palma (manos) o con el botón apretado (controles).
   * Solo objetos que vienen volando ("lanzada", por ejemplo tirados por un chico), y no justo
   * después de soltarlos (si no, la mano los volvería a atrapar al tirarlos).
   */
  atajar() {
    for (const r of this.residuos()) {
      if (!r.atajable || r.estado !== 'lanzada') continue;
      if (r.soltadoEn && performance.now() - r.soltadoEn < 500) continue;
      const pos = r.raiz.getWorldPosition(_tmp2);
      for (const mano of this.manos) {
        if (mano.agarrado || !mano.fuente) continue;
        const d = this.puntoDeAgarre(mano, _tmp).distanceTo(pos);
        if (this.esMano(mano) && d < 0.22) { this.agarrar(mano, r, false, mano.cerrada ? 'cierre' : 'atajada'); return r; }
        if (!this.esMano(mano) && mano.presionados > 0 && d < 0.3) { this.agarrar(mano, r, false, 'boton'); return r; }
      }
    }
    return null;
  }

  // ---------- Mouse (PC sin visor) ----------

  crearManoMouse() {
    const control = new THREE.Object3D();
    control.name = 'ManoMouse';
    this.escena.add(control);
    const mano = { tipo: 'mouse', control, agarrado: null, modo: null, historial: [], distancia: 0 };
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
      this.agarrar(mano, impacto.residuo, false, 'boton');
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

  actualizar(tiempo, dt = 0) {
    for (const mano of [...this.manos, this.manoMouse]) {
      if (mano.tipo === 'xr') this.actualizarPalma(mano, dt);
      // Primero se registra dónde está lo agarrado (para calcular la velocidad del tiro)…
      if (mano.agarrado) {
        mano.historial.push({ p: mano.agarrado.raiz.getWorldPosition(new THREE.Vector3()), t: tiempo });
        while (mano.historial.length > 2 && tiempo - mano.historial[0].t > 0.3) mano.historial.shift();
      }
      // …y después se decide si se agarra o se suelta.
      if (mano.tipo === 'xr') this.gestosMano(mano);
      if (mano.tipo === 'xr' && mano.rayo.visible) {
        const impacto = mano.agarrado ? null : this.apuntado(mano);
        mano.rayo.scale.z = impacto ? impacto.distancia : 0.6;
        mano.rayo.material.color.set(impacto ? '#ffd400' : '#ffffff');
      }
    }
  }
}
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _tmp3 = new THREE.Vector3();
const _offsetPalma = new THREE.Vector3(0, -0.025, -0.07);

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
