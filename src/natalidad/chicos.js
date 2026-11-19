import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Chicos low-poly con cara (ojos y sonrisa), pelo, remera, short, brazos y piernas articulados.
 * Estilo caricatura: no representan a ningún chico real.
 *
 * Rendimiento (Quest 2): cada PARTE del cuerpo es un InstancedMesh compartido por todos los
 * chicos, así que 16 chicos animados cuestan ~11 draw calls. Cada frame se calcula la matriz
 * de cada parte a partir de la "pose" del chico (piernas, brazos, salto, sentado).
 *
 * Comportamientos:
 *  - corre:    da vueltas alrededor de un centro
 *  - salta:    salta en el lugar (soga, rayuela)
 *  - hamaca:   sentado en una hamaca
 *  - quieto:   parado mirando a un punto (lo controla un juego: pasador, burbujas…)
 *  - camina:   va hacia un destino (lo controla un juego); esquiva al jugador
 *  - seVa:     camina hacia afuera de la plaza hasta perderse en la niebla
 *  - ido:      ya no está
 * Gestos (se combinan con el comportamiento): festeja (brazos arriba), tira (lanza), brazos al frente.
 */
const REMERAS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#2ecc71', '#ff6f91', '#34495e', '#16a085'];
const PANTALONES = ['#2c3e50', '#1f4e79', '#6d4c41', '#37474f', '#5d6d7e', '#283593'];
const PIELES = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#d4a373'];
const PELOS = ['#2b1b0e', '#4a2c17', '#8b5a2b', '#1a1a1a', '#c68e3a', '#6b3e26', '#e0b862'];
const ESTILOS_PELO = ['corto', 'largo', 'colitas', 'rulos'];

// Alturas (en metros, para escala 1): cadera, hombros y cuello.
const CADERA = 0.5;
const HOMBRO = 0.86;
const CUELLO = 0.92;

/** Geometría con un color por vértice (se multiplica por el color de cada instancia). */
function pintar(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const colores = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colores.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colores, 3));
  return geo;
}
const blanco = (g) => pintar(g.index ? g.toNonIndexed() : g, '#ffffff');

function geometrias() {
  // Torso con mangas cortas (color de la remera).
  const torso = mergeGeometries([
    blanco(new THREE.CylinderGeometry(0.15, 0.17, 0.38, 8).translate(0, 0.69, 0)),
    blanco(new THREE.SphereGeometry(0.15, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 1).translate(0, 0.88, 0)),
    blanco(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 6).rotateZ(Math.PI / 2.4).translate(-0.19, 0.83, 0)),
    blanco(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 6).rotateZ(-Math.PI / 2.4).translate(0.19, 0.83, 0)),
  ]);
  const short = new THREE.CylinderGeometry(0.17, 0.18, 0.16, 8).translate(0, CADERA + 0.03, 0);
  // Pierna (desde la cadera hacia abajo) con zapatilla oscura.
  const pierna = mergeGeometries([
    blanco(new THREE.CylinderGeometry(0.058, 0.05, 0.44, 6).translate(0, -0.22, 0)),
    pintar(new THREE.BoxGeometry(0.1, 0.07, 0.17).toNonIndexed().translate(0, -0.46, 0.035), '#3a3a3a'),
  ]);
  // Brazo (desde el hombro hacia abajo) con mano.
  const brazo = mergeGeometries([
    new THREE.CylinderGeometry(0.042, 0.036, 0.34, 6).translate(0, -0.17, 0).toNonIndexed(),
    new THREE.IcosahedronGeometry(0.048, 0).translate(0, -0.36, 0),
  ].map((g) => { g.deleteAttribute('uv'); return g; }));
  const cabeza = mergeGeometries([
    new THREE.IcosahedronGeometry(0.135, 1).scale(1, 1.05, 0.98).translate(0, 0.13, 0),
    new THREE.SphereGeometry(0.03, 5, 4).scale(0.7, 1, 0.6).translate(-0.135, 0.12, 0).toNonIndexed(), // orejas
    new THREE.SphereGeometry(0.03, 5, 4).scale(0.7, 1, 0.6).translate(0.135, 0.12, 0).toNonIndexed(),
    new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6).translate(0, 0.0, 0).toNonIndexed(), // cuello
  ].map((g) => { g.deleteAttribute('uv'); if (!g.index) return g; return g.toNonIndexed(); }));
  const ojo = new THREE.SphereGeometry(0.019, 6, 4).scale(1, 1.25, 0.6);
  const boca = new THREE.TorusGeometry(0.034, 0.008, 4, 10, Math.PI).rotateZ(Math.PI).translate(0, 0.078, 0.124);
  const mejilla = new THREE.CircleGeometry(0.022, 8);

  const casco = (r = 0.145) => new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 0.14, -0.008);
  const pelos = {
    corto: mergeGeometries([casco(), new THREE.BoxGeometry(0.2, 0.045, 0.05).translate(0, 0.235, 0.105).toNonIndexed()].map(limpiar)),
    largo: mergeGeometries([casco(), new THREE.BoxGeometry(0.26, 0.3, 0.09).translate(0, 0.06, -0.08).toNonIndexed()].map(limpiar)),
    colitas: mergeGeometries([casco(),
      new THREE.SphereGeometry(0.055, 6, 4).translate(-0.16, 0.16, -0.04).toNonIndexed(),
      new THREE.SphereGeometry(0.055, 6, 4).translate(0.16, 0.16, -0.04).toNonIndexed()].map(limpiar)),
    rulos: mergeGeometries([casco(0.14),
      ...[[0, 0.28, 0], [0.08, 0.25, 0.06], [-0.08, 0.25, 0.06], [0.1, 0.24, -0.06], [-0.1, 0.24, -0.06], [0, 0.24, -0.1], [0.13, 0.17, 0], [-0.13, 0.17, 0]]
        .map(([x, y, z]) => new THREE.IcosahedronGeometry(0.055, 0).translate(x, y, z))].map(limpiar)),
  };
  return { torso, short, pierna, brazo, cabeza, ojo, boca, mejilla, pelos };
}
function limpiar(g) {
  g = g.index ? g.toNonIndexed() : g;
  g.deleteAttribute('uv');
  return g;
}

export class Chicos {
  constructor(escena, definiciones) {
    const g = geometrias();
    const n = definiciones.length;
    const mat = (opciones = {}) => new THREE.MeshLambertMaterial({ flatShading: true, ...opciones });
    const crear = (geo, cantidad, material, nombre) => {
      const im = new THREE.InstancedMesh(geo, material, cantidad);
      im.name = nombre;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false; // los chicos se mueven por toda la plaza
      escena.add(im);
      return im;
    };
    this.partes = {
      torso: crear(g.torso, n, mat({ vertexColors: true }), 'ChicosTorso'),
      short: crear(g.short, n, mat(), 'ChicosShort'),
      piernas: crear(g.pierna, n * 2, mat({ vertexColors: true }), 'ChicosPiernas'),
      brazos: crear(g.brazo, n * 2, mat(), 'ChicosBrazos'),
      cabeza: crear(g.cabeza, n, mat(), 'ChicosCabeza'),
      ojos: crear(g.ojo, n * 2, new THREE.MeshBasicMaterial({ color: '#1b1b1b' }), 'ChicosOjos'),
      boca: crear(g.boca, n, new THREE.MeshBasicMaterial({ color: '#8e2b2b' }), 'ChicosBoca'),
      mejillas: crear(g.mejilla, n * 2, new THREE.MeshBasicMaterial({ color: '#f29c9c' }), 'ChicosMejillas'),
    };
    this.pelos = {};
    for (const estilo of ESTILOS_PELO) this.pelos[estilo] = crear(g.pelos[estilo], n, mat(), `ChicosPelo_${estilo}`);

    this.lista = definiciones.map((d, i) => {
      const c = {
        indice: i,
        ...d,
        comportamientoInicial: d.comportamiento,
        miraInicial: d.mira,
        posicionInicial: d.posicion || [0, 0, 0],
        posicion: new THREE.Vector3(...(d.posicion || [0, 0, 0])),
        rumbo: 0,
        salto: 0,
        escala: d.escala || 1,
        fase: d.fase ?? i * 0.9,
        pelo: d.pelo || ESTILOS_PELO[(i * 3 + 1) % ESTILOS_PELO.length],
        matrizExterna: null,
        gesto: null, // 'festeja' | 'tira' | 'brazosAlFrente'
        tiempoGesto: 0,
        caminando: false,
      };
      const piel = new THREE.Color(PIELES[(i * 5 + 2) % PIELES.length]);
      c.colores = {
        torso: new THREE.Color(REMERAS[i % REMERAS.length]),
        short: new THREE.Color(PANTALONES[(i * 7) % PANTALONES.length]),
        piernas: new THREE.Color(PANTALONES[(i * 7) % PANTALONES.length]).lerp(piel, 0.55),
        piel,
        pelo: new THREE.Color(PELOS[(i * 3) % PELOS.length]),
      };
      this.pintar(c, 0);
      return c;
    });
    this._m = new THREE.Matrix4();
    this._raiz = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    /** Posición del jugador (la actualiza el juego) para que los chicos lo esquiven. */
    this.jugador = new THREE.Vector3(0, 0, 0);
  }

  get presentes() {
    return this.lista.filter((c) => !['ido', 'seVa', 'esfuma'].includes(c.comportamiento));
  }

  /** Pinta al chico con sus colores, mezclados con blanco luminoso según "blanco" (0…1). */
  pintar(c, blanco) {
    const i = c.indice;
    const col = (base) => _color.copy(base).lerp(_brillo, blanco);
    this.partes.torso.setColorAt(i, col(c.colores.torso));
    this.partes.short.setColorAt(i, col(c.colores.short));
    for (const lado of [0, 1]) {
      this.partes.piernas.setColorAt(i * 2 + lado, col(c.colores.piernas));
      this.partes.brazos.setColorAt(i * 2 + lado, col(c.colores.piel));
    }
    this.partes.cabeza.setColorAt(i, col(c.colores.piel));
    for (const im of Object.values(this.pelos)) im.setColorAt(i, col(c.colores.pelo));
    for (const im of [this.partes.torso, this.partes.short, this.partes.piernas, this.partes.brazos, this.partes.cabeza, ...Object.values(this.pelos)]) {
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  /**
   * El chico se esfuma en el lugar, a la vista: se queda quieto, se vuelve blanco y luminoso,
   * sube un poco y desaparece en una nube de destellos. Al terminar llama a alEsfumarse(c, pos).
   */
  esfumar(c) {
    if (['ido', 'esfuma'].includes(c.comportamiento)) return;
    c.comportamiento = 'esfuma';
    c.tEsfuma = 0;
    c.gesto = null;
    c.sostiene = false;
    this.alEmpezarAEsfumarse?.(c);
  }

  /** El chico deja de jugar y camina hacia afuera de la plaza (alejándose del jugador). */
  irse(chico) {
    if (chico.comportamiento === 'seVa' || chico.comportamiento === 'ido') return;
    if (chico.matrizExterna) {
      chico.posicion.setFromMatrixPosition(chico.matrizExterna).setY(0);
      chico.matrizExterna = null;
    }
    const direccion = new THREE.Vector3().subVectors(chico.posicion, this.jugador).setY(0);
    if (direccion.lengthSq() < 0.01) direccion.set(0, 0, -1);
    chico.destino = direccion.normalize().multiplyScalar(26).add(this.jugador);
    chico.gesto = null;
    chico.comportamiento = 'seVa';
  }

  reiniciar() {
    for (const c of this.lista) {
      c.comportamiento = c.comportamientoInicial;
      c.posicion.set(...c.posicionInicial);
      c.matrizExterna = null;
      c.gesto = null;
      c.sostiene = false;
      c.mira = c.miraInicial;
      this.pintar(c, 0);
    }
    this.destellos?.apagar();
  }

  /** Gesto temporal (festejar, tirar…). */
  gesticular(c, gesto, segundos = 1.2) {
    c.gesto = gesto;
    c.tiempoGesto = segundos;
  }

  /**
   * Mueve al chico hacia "destino" esquivando al jugador. Devuelve la distancia que falta.
   * La usan los juegos (el pasador que va a buscar la pelota, etc.).
   */
  caminarHacia(c, destino, dt, velocidad = 2) {
    const paso = this._v.subVectors(destino, c.posicion).setY(0);
    const d = paso.length();
    if (d < 0.05) { c.caminando = false; return d; }
    paso.normalize();
    // Esquivar al jugador: si el próximo paso lo acerca a menos de 0,75 m, rodea por el costado.
    const aJugador = _tmp.subVectors(this.jugador, c.posicion).setY(0);
    const dj = aJugador.length();
    if (dj < 1.3 && paso.dot(aJugador) > 0) {
      // El lado para rodear se elige una vez y se mantiene (si se recalcula en cada cuadro y el
      // destino está justo detrás del jugador, cambia de lado todo el tiempo y queda trabado).
      c.ladoEsquive ??= Math.sign(aJugador.x * paso.z - aJugador.z * paso.x) || 1;
      const lado = c.ladoEsquive;
      const tangente = _tmp2.set(-aJugador.z, 0, aJugador.x).normalize().multiplyScalar(-lado);
      const peso = THREE.MathUtils.clamp((1.3 - dj) / 0.55, 0, 1);
      paso.lerp(tangente, peso).normalize();
    }
    if (dj > 1.6) c.ladoEsquive = undefined; // ya lo rodeó
    c.posicion.addScaledVector(paso, Math.min(d, velocidad * dt));
    // Nunca dentro del "espacio personal" del jugador.
    const sep = _tmp.subVectors(c.posicion, this.jugador).setY(0);
    if (sep.length() < 0.7) c.posicion.copy(this.jugador).addScaledVector(sep.normalize(), 0.7).setY(0);
    c.rumbo = Math.atan2(paso.x, paso.z);
    c.caminando = true;
    return d;
  }

  mirarA(c, punto) {
    c.rumbo = Math.atan2(punto.x - c.posicion.x, punto.z - c.posicion.z);
  }

  actualizar(t, dt, hamacas) {
    for (const c of this.lista) {
      let visible = true;
      c.salto = 0;
      c.sentado = false;
      if (c.tiempoGesto > 0) { c.tiempoGesto -= dt; if (c.tiempoGesto <= 0) c.gesto = null; }
      switch (c.comportamiento) {
        case 'corre': {
          const ang = t * c.velocidad + c.fase;
          c.posicion.set(c.centro[0] + Math.cos(ang) * c.radio, 0, c.centro[2] + Math.sin(ang) * c.radio);
          c.rumbo = Math.atan2(-Math.sin(ang) * c.velocidad, Math.cos(ang) * c.velocidad);
          c.salto = Math.abs(Math.sin(t * 9 + c.fase)) * 0.05;
          c.caminando = true;
          c.ritmo = 9;
          break;
        }
        case 'salta':
          c.salto = Math.abs(Math.sin(t * 4.2 + c.fase)) * 0.26;
          if (c.mira) this.mirarA(c, _tmp.set(...c.mira));
          c.caminando = false;
          break;
        case 'hamaca':
          c.matrizExterna = hamacas.matrizAsiento(c.asiento, c.matrizExterna || new THREE.Matrix4());
          c.sentado = true;
          c.caminando = false;
          break;
        case 'quieto':
          if (c.gesto === 'festeja') c.salto = Math.abs(Math.sin(t * 8)) * 0.2;
          c.caminando = false;
          break;
        case 'camina':
          c.ritmo = 10;
          break; // la posición la maneja el juego con caminarHacia()
        case 'seVa': {
          const paso = _tmp.subVectors(c.destino, c.posicion).setY(0);
          const d = paso.length();
          if (d < 0.2) { c.comportamiento = 'ido'; visible = false; break; }
          c.posicion.addScaledVector(paso.normalize(), Math.min(d, dt * 1.2));
          c.rumbo = Math.atan2(paso.x, paso.z);
          c.caminando = true;
          c.ritmo = 6;
          break;
        }
        case 'esfuma': {
          c.tEsfuma += dt;
          c.caminando = false;
          if (c.matrizExterna) { c.matrizExterna = hamacas.matrizAsiento(c.asiento, c.matrizExterna); c.sentado = true; }
          const k = Math.min(1, c.tEsfuma / DURACION_ESFUMARSE);
          this.pintar(c, Math.min(1, k * 1.6));
          if (c.tEsfuma >= DURACION_ESFUMARSE) {
            const pos = c.matrizExterna ? new THREE.Vector3().setFromMatrixPosition(c.matrizExterna) : c.posicion.clone();
            this.destellos?.estallar(pos.clone().setY(pos.y + 0.7 * c.escala));
            c.comportamiento = 'ido';
            visible = false;
            this.alEsfumarse?.(c, pos.setY(0));
          }
          break;
        }
        case 'ido':
          visible = false;
          break;
      }
      this.escribirPose(c, t, visible);
    }
    for (const im of [...Object.values(this.partes), ...Object.values(this.pelos)]) im.instanceMatrix.needsUpdate = true;
    this.destellos?.actualizar(dt);
  }

  /** Calcula y escribe la matriz de cada parte del chico según su pose. */
  escribirPose(c, t, visible) {
    const i = c.indice;
    const P = this.partes;
    const cero = _cero;
    if (!visible) {
      for (const [nombre, im] of Object.entries(P)) {
        const porChico = nombre === 'piernas' || nombre === 'brazos' || nombre === 'ojos' || nombre === 'mejillas' ? 2 : 1;
        for (let k = 0; k < porChico; k++) im.setMatrixAt(i * porChico + k, cero);
      }
      for (const im of Object.values(this.pelos)) im.setMatrixAt(i, cero);
      return;
    }
    const raiz = this._raiz;
    let escala = c.escala, subida = 0;
    if (c.comportamiento === 'esfuma') {
      const k = Math.min(1, c.tEsfuma / DURACION_ESFUMARSE);
      subida = k * k * 0.35;
      escala *= k < 0.7 ? 1 + Math.sin(k * 9) * 0.03 : 1 - (k - 0.7) / 0.3; // al final se achica
    }
    if (c.matrizExterna) {
      raiz.copy(c.matrizExterna).scale(this._s.setScalar(escala));
      raiz.elements[13] += subida;
    } else {
      this._q.setFromAxisAngle(_arriba, c.rumbo);
      raiz.compose(this._v.set(c.posicion.x, c.salto + subida, c.posicion.z), this._q, this._s.setScalar(escala));
    }
    // Ángulos de la pose.
    const ritmo = c.ritmo || 8;
    const balanceo = c.caminando ? Math.sin(t * ritmo + c.fase) * 0.7 : 0;
    let piernaI = balanceo, piernaD = -balanceo;
    let brazoI = -balanceo * 0.8, brazoD = balanceo * 0.8;
    let aperturaI = 0.08, aperturaD = -0.08;
    if (c.sentado) { piernaI = piernaD = -1.45; brazoI = brazoD = -2.7; aperturaI = 0.2; aperturaD = -0.2; }
    if (c.comportamiento === 'salta' || c.salto > 0.12) { brazoI = brazoD = -2.4; aperturaI = 0.5; aperturaD = -0.5; }
    if (c.gesto === 'festeja') { brazoI = brazoD = -2.8 + Math.sin(t * 12) * 0.25; aperturaI = 0.4; aperturaD = -0.4; }
    if (c.gesto === 'brazosAlFrente' || c.sostiene) { brazoI = brazoD = -0.95; aperturaI = 0.12; aperturaD = -0.12; }
    if (c.gesto === 'tira') { const k = 1 - Math.max(0, c.tiempoGesto) / 0.5; brazoI = brazoD = -2.6 + k * 1.6; aperturaI = 0.2; aperturaD = -0.2; }
    if (c.gesto === 'saluda') { brazoD = -2.9; aperturaD = -0.3 + Math.sin(t * 10) * 0.35; }

    const m = this._m;
    const parte = (im, indice, x, y, z, rx = 0, rz = 0) => {
      this._e.set(rx, 0, rz);
      m.compose(this._v.set(x, y, z), this._q.setFromEuler(this._e), _uno);
      im.setMatrixAt(indice, m.premultiply(raiz));
    };
    parte(P.torso, i, 0, 0, 0);
    parte(P.short, i, 0, 0, 0);
    parte(P.piernas, i * 2, -0.08, CADERA, 0, piernaI);
    parte(P.piernas, i * 2 + 1, 0.08, CADERA, 0, piernaD);
    parte(P.brazos, i * 2, -0.2, HOMBRO, 0, brazoI, -aperturaI);
    parte(P.brazos, i * 2 + 1, 0.2, HOMBRO, 0, brazoD, -aperturaD);
    // Cabeza (con un leve cabeceo) y sus partes.
    const cabeceo = Math.sin(t * 2 + c.fase) * 0.06;
    this._e.set(cabeceo, 0, 0);
    const cabeza = _cab.compose(this._v.set(0, CUELLO, 0), this._q.setFromEuler(this._e), _uno).premultiply(raiz);
    P.cabeza.setMatrixAt(i, cabeza);
    const enCabeza = (im, indice, x, y, z, rotY = 0) => {
      this._e.set(0, rotY, 0);
      m.compose(this._v.set(x, y, z), this._q.setFromEuler(this._e), _uno);
      im.setMatrixAt(indice, m.premultiply(cabeza));
    };
    // Parpadeo cada tanto.
    const parpadeo = Math.sin(t * 0.9 + c.fase * 3) > 0.985;
    for (const lado of [0, 1]) {
      const x = lado ? 0.047 : -0.047;
      if (parpadeo) P.ojos.setMatrixAt(i * 2 + lado, _m2.makeScale(1, 0.15, 1).setPosition(x, 0.14, 0.128).premultiply(cabeza));
      else enCabeza(P.ojos, i * 2 + lado, x, 0.14, 0.128);
      enCabeza(P.mejillas, i * 2 + lado, lado ? 0.085 : -0.085, 0.095, 0.117);
    }
    enCabeza(P.boca, i, 0, 0, 0);
    for (const [estilo, im] of Object.entries(this.pelos)) {
      if (estilo === c.pelo) im.setMatrixAt(i, cabeza); else im.setMatrixAt(i, cero);
    }
  }

  /** Posición de las manos de un chico (para sostener la pelota). */
  manos(c, destino) {
    const frente = _tmp.set(Math.sin(c.rumbo), 0, Math.cos(c.rumbo));
    return destino.copy(c.posicion).addScaledVector(frente, 0.3 * c.escala).setY((0.62 + c.salto) * c.escala);
  }
}
const DURACION_ESFUMARSE = 1.6;
const _color = new THREE.Color();
const _brillo = new THREE.Color('#fffbe8');
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _arriba = new THREE.Vector3(0, 1, 0);
const _uno = new THREE.Vector3(1, 1, 1);
const _cero = new THREE.Matrix4().makeScale(0, 0, 0);
const _cab = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();

/** Destellos que quedan cuando un chico se esfuma (InstancedMesh: 1 draw call). */
export class Destellos {
  constructor(escena, cantidad = 80) {
    this.malla = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.035, 0), new THREE.MeshBasicMaterial({ color: '#fff6c8' }), cantidad);
    this.malla.name = 'Destellos';
    this.malla.frustumCulled = false;
    this.malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.lista = Array.from({ length: cantidad }, () => ({ vida: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3() }));
    this._m = new THREE.Matrix4();
    escena.add(this.malla);
    this.apagar();
  }
  estallar(centro, n = 18) {
    let k = 0;
    for (const d of this.lista) {
      if (d.vida > 0) continue;
      d.vida = 1.2 + Math.random() * 0.6;
      d.pos.copy(centro).add(_tmp.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.4));
      d.vel.set((Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 0.5);
      if (++k >= n) break;
    }
  }
  apagar() { for (const d of this.lista) d.vida = 0; this.actualizar(0); }
  actualizar(dt) {
    this.lista.forEach((d, i) => {
      if (d.vida > 0) { d.vida -= dt; d.pos.addScaledVector(d.vel, dt); }
      const e = Math.max(0, Math.min(1, d.vida));
      this._m.makeScale(e, e, e).setPosition(d.pos);
      this.malla.setMatrixAt(i, this._m);
    });
    this.malla.instanceMatrix.needsUpdate = true;
  }
}
