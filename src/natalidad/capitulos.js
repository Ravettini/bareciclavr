import * as THREE from 'three';

/**
 * Capítulos de "La plaza que se vacía": un juego distinto por año, en la misma plaza.
 *
 *  2014 pelota    · un chico te pasa la pelota y se la devolvés
 *  2016 basquet   · tirás al aro; los chicos festejan cada doble
 *  2019 hamaca    · empujás a un chico en la hamaca (la de al lado ya está vacía)
 *  2022 burbujas  · una chica hace burbujas y las reventás con las manos
 *  2024 final     · la pelota vuelve rodando; la tirás y nadie la devuelve
 *
 * Cada capítulo recibe un "contexto" con la escena, los chicos, la pelota, las manos, etc.
 * Ciclo de vida: preparar() (a oscuras, durante el fundido) → iniciar() → actualizar() → terminar().
 */

/** Lugares de la plaza: posición del jugador [x, z], hacia dónde mira (rotY) y dónde va el panel (local). */
/** "despedida": dónde se ubican (local) los chicos que se esfuman al llegar a ese lugar. */
export const LUGARES = {
  pelota: { x: 0, z: 0, rotY: 0, panel: [0, 2.35, -4.0], despedida: [[-1, -2.6], [1, -2.6]] },
  basquet: { x: -6.5, z: 2.0, rotY: 0, panel: [2.0, 2.45, -3.4], despedida: [[-0.6, -2.7], [-1.4, -2.3], [0.2, -2.9]] },
  hamaca: { x: -3.8, z: -3.25, rotY: 0, panel: [1.9, 2.4, -2.6], despedida: [[-1.4, -2.0], [-2.0, -1.1], [-0.9, -2.9]] },
  burbujas: { x: 1.6, z: 0.7, rotY: Math.atan2(-(2.9 - 1.6), -(-1.6 - 0.7)), panel: [-1.7, 2.3, -3.0], despedida: [[-1.1, -2.4], [1.3, -2.3], [-0.3, -3.3], [0.8, -3.4]] },
  final: { x: 0, z: 0, rotY: 0, panel: [0, 2.35, -4.0], despedida: [[-0.9, -2.5], [0.9, -2.7], [0, -3.3]] },
};

// ---------------------------------------------------------------------------------------------
/**
 * El chico que juega a la pelota con el jugador: se la tira, la ataja (si corresponde),
 * va a buscarla si queda lejos y vuelve a su puesto. Esquiva al jugador.
 */
export class Pasador {
  constructor(ctx, chico, puesto, { atajaTiros = true } = {}) {
    Object.assign(this, { ctx, chico, puesto: puesto.clone(), atajaTiros });
    this.estado = 'espera';
    this.espera = 1.5;
    this.pases = 0;
    this.activo = true;
  }

  get pelota() { return this.ctx.pelota; }

  tomarPelota() {
    const p = this.pelota;
    p.estado = 'enChico';
    p.duenio = this.chico;
    p.velocidad.set(0, 0, 0);
    p.raiz.visible = true;
    this.chico.sostiene = true;
  }

  actualizar(dt) {
    if (!this.activo) return;
    const c = this.chico;
    const p = this.pelota;
    const ch = this.ctx.chicos;
    const jugador = this.ctx.posicionJugador();
    if (p.estado === 'enChico' && p.duenio === c) ch.manos(c, p.raiz.position);
    c.sostiene = p.estado === 'enChico' && p.duenio === c;

    // ¿Le llega la pelota que tiró el jugador?
    if (this.atajaTiros && p.estado === 'cayendo' && p.lanzadaPor === 'jugador') {
      const dx = p.raiz.position.x - c.posicion.x;
      const dz = p.raiz.position.z - c.posicion.z;
      if (Math.hypot(dx, dz) < 1.0 && p.raiz.position.y < 2.3) {
        this.tomarPelota();
        this.ctx.ambiente.atajada();
        ch.gesticular(c, 'festeja', 0.8);
        this.pases++;
        this.estado = 'espera';
        this.espera = 1.2;
      }
    }

    switch (this.estado) {
      case 'espera':
        c.comportamiento = 'quieto';
        ch.mirarA(c, jugador);
        if (c.sostiene) {
          this.espera -= dt * (this.ctx.escala || 1); // respeta ?rapido=N (pruebas)
          if (this.espera <= 0) this.tirarAlJugador(jugador);
        } else if (p.estado === 'reposo' || p.estado === 'cayendo') {
          this.estado = 'esperaRetorno';
        }
        break;
      case 'esperaRetorno':
        c.comportamiento = 'quieto';
        ch.mirarA(c, jugador);
        if (p.estado === 'reposo' && p.raiz.position.distanceTo(_tmp.copy(jugador).setY(p.radio)) > 1.7) this.estado = 'busca';
        break;
      case 'busca':
        c.comportamiento = 'camina';
        if (p.estado === 'agarrado') { this.estado = 'vuelve'; break; }
        if (ch.caminarHacia(c, p.raiz.position, dt, 2.4) < 0.45 && p.estado !== 'lanzada') {
          this.tomarPelota();
          this.pases++;
          this.estado = 'vuelve';
        }
        break;
      case 'vuelve':
        c.comportamiento = 'camina';
        if (ch.caminarHacia(c, this.puesto, dt, 2.0) < 0.1) {
          this.estado = 'espera';
          this.espera = 0.8;
        }
        break;
    }
  }

  tirarAlJugador(jugador) {
    const c = this.chico;
    const desde = this.ctx.chicos.manos(c, new THREE.Vector3());
    const hacia = _tmp.subVectors(desde, jugador).setY(0).normalize();
    const destino = jugador.clone().addScaledVector(hacia, 0.4);
    destino.y = Math.max(0.85, jugador.y - 0.45);
    this.pelota.lanzar(desde, destino, 0.55 + desde.distanceTo(destino) / 4);
    this.pelota.lanzadaPor = 'chico';
    this.ctx.chicos.gesticular(c, 'tira', 0.5);
    c.sostiene = false;
    this.estado = 'esperaRetorno';
  }
}

// ---------------------------------------------------------------------------------------------
class Capitulo {
  constructor(ctx, def) {
    this.ctx = ctx;
    this.def = def;
    this.reloj = 0;
    this.terminado = false;
  }
  get lugar() { return LUGARES[this.def.juego]; }
  /** Convierte una posición local del lugar (relativa al jugador) a coordenadas de la plaza. */
  aMundo(x, y, z) {
    const { x: lx, z: lz, rotY } = this.lugar;
    const c = Math.cos(rotY), s = Math.sin(rotY);
    return new THREE.Vector3(lx + x * c + z * s, y, lz - x * s + z * c);
  }
  preparar() {}
  iniciar() { this.ctx.panel.mostrar({ titulo: String(this.def.anio), cuerpo: this.def.cuerpo, pie: this.def.pie || '' }); }
  actualizar(dt) { this.reloj += dt * this.ctx.escala; }
  terminar() {}
  /** Ubica a un chico en un lugar fijo (para un juego), si sigue en la plaza. */
  ubicar(indice, pos, comportamiento = 'quieto') {
    const c = this.ctx.chicos.lista[indice];
    if (!c || c.comportamiento === 'seVa' || c.comportamiento === 'ido') return null;
    c.matrizExterna = null;
    c.posicion.copy(pos).setY(0);
    c.comportamiento = comportamiento;
    return c;
  }
  /** Devuelve a un chico a lo que hacía al principio (si no se fue). */
  liberar(c) {
    if (!c || c.comportamiento === 'seVa' || c.comportamiento === 'ido') return;
    c.comportamiento = c.comportamientoInicial;
    c.posicion.set(...c.posicionInicial);
    c.sostiene = false;
    c.gesto = null;
  }
}

// ---------------------------------------------------------------------------------------------
/** 2014: pasarse la pelota con un chico. */
export class CapPelota extends Capitulo {
  preparar() {
    const c = this.ubicar(this.ctx.indices.pasador, this.aMundo(0, 0, -3.2));
    this.pasador = new Pasador(this.ctx, c, c.posicion);
    this.pasador.tomarPelota();
    this.pasador.espera = 7.5; // primero termina la presentación de la voz ("…¡Atajala!")
    this.ctx.pasadorActual = this.pasador;
  }
  actualizar(dt) {
    super.actualizar(dt);
    this.pasador.actualizar(dt);
    if (this.pasador.estado === 'esperaRetorno' && this.ctx.pelota.estado === 'reposo' && !this.aviso &&
        this.ctx.pelota.raiz.position.distanceTo(this.ctx.posicionJugador().setY(0.11)) <= 1.7) {
      this.aviso = true;
      this.ctx.panel.mostrar({ titulo: String(this.def.anio), cuerpo: this.def.agarrala || 'Agarrá la pelota y tirásela.' });
    }
    if (this.ctx.pelota.estado === 'agarrado') {
      this.aviso = false;
      // La primera vez que la ataja: "¡Muy bien! Ahora, devolvésela."
      if (!this.felicitado) { this.felicitado = true; this.ctx.ambiente.voz('devolvela'); }
    }
    if (this.reloj >= this.def.duracion) this.terminado = true;
  }
  terminar() {
    this.pasador.activo = false;
    this.liberar(this.pasador.chico);
  }
}

// ---------------------------------------------------------------------------------------------
/** 2016: básquet. Ayuda a apuntar para que encestar sea posible para cualquiera. */
export class CapBasquet extends Capitulo {
  preparar() {
    const ctx = this.ctx;
    this.aro = ctx.aro;
    this.aro.grupo.visible = true;
    const c = this.ubicar(ctx.indices.pasador, this.aMundo(1.0, 0, -2.4));
    this.pasador = new Pasador(ctx, c, c.posicion, { atajaTiros: false });
    this.pasador.tomarPelota();
    this.pasador.espera = 2;
    ctx.pasadorActual = this.pasador;
    this.publico = ctx.indices.publicoBasquet
      .map((i, k) => this.ubicar(i, this.aMundo(k ? 1.9 : -1.9, 0, k ? -1.2 : -1.8)))
      .filter(Boolean);
    this.dobles = 0;
    this.yAnterior = 0;
    // El tablero hace rebotar la pelota.
    const t = this.aro.tablero;
    this.colision = (p, v, r) => {
      const d = _tmp.subVectors(p, t.punto).dot(t.normal);
      if (d < r && d > -0.1 && v.dot(t.normal) < 0) {
        const local = _tmp2.subVectors(p, t.punto);
        if (Math.abs(local.y) < t.alto / 2 && Math.abs(local.x * t.normal.z - local.z * t.normal.x) < t.ancho / 2) {
          v.addScaledVector(t.normal, -1.6 * v.dot(t.normal));
          this.ctx.ambiente.rebote(0.6);
        }
      }
    };
    ctx.pelota.colisiones.push(this.colision);
  }

  /** Estos chicos juegan en este capítulo: no se esfuman antes. */
  necesita(c) {
    const i = this.ctx.indices;
    return c.indice === i.pasador || i.publicoBasquet.includes(c.indice);
  }

  /** Lo llama main.js cuando el jugador suelta la pelota: si apuntó más o menos al aro, lo ayuda. */
  alSoltar(p) {
    // Despedida: en el primer tiro después de armarse, el compañero se esfuma con la pelota en el aire.
    if (this.despedida === 'armada') this.despedirCompanero();
    const v = p.velocidad;
    const hacia = _tmp.subVectors(this.aro.centro, p.raiz.position);
    const horizontal = Math.hypot(hacia.x, hacia.z);
    const velH = Math.hypot(v.x, v.z);
    if (v.length() < 1.5 || velH < 0.5 || horizontal < 0.5) return; // tiro sin fuerza
    const angulo = Math.acos(THREE.MathUtils.clamp((v.x * hacia.x + v.z * hacia.z) / (velH * horizontal), -1, 1));
    if (angulo > 0.5) return; // no apuntó al aro
    // Tiro ideal: llega al centro del aro, cayendo, en un tiempo acorde a la fuerza del tiro.
    // Ayuda generosa a propósito: la mayoría del público nunca usó VR.
    const T = THREE.MathUtils.clamp(horizontal / Math.max(velH, 2.5), 0.75, 1.05);
    const ideal = new THREE.Vector3(hacia.x / T, (hacia.y + 0.06) / T + 0.5 * 9.8 * T, hacia.z / T);
    v.lerp(ideal, 0.92);
    this.tiroValido = true;
  }

  actualizar(dt) {
    super.actualizar(dt);
    const p = this.ctx.pelota;
    const ctx = this.ctx;
    // El momento más fuerte: pasado un rato, la próxima vez que el jugador tira, el compañero se
    // esfuma con la pelota en el aire. Nadie la va a buscar.
    if (!this.despedida && this.reloj >= this.def.despedida) this.despedida = 'armada';
    // Respaldo: si el jugador no volvió a tirar, el compañero se esfuma igual, a la vista, antes de
    // que termine el capítulo (si tenía la pelota, se le cae).
    if (this.despedida === 'armada' && this.reloj >= this.def.duracion - 2) this.despedirCompanero();
    if (this.pasador.activo) this.pasador.actualizar(dt);
    const y = p.raiz.position.y;
    // ¿Pasó por el aro de arriba hacia abajo?
    if (p.lanzadaPor === 'jugador' && (p.estado === 'cayendo') && this.yAnterior > this.aro.centro.y && y <= this.aro.centro.y) {
      const dx = p.raiz.position.x - this.aro.centro.x;
      const dz = p.raiz.position.z - this.aro.centro.z;
      if (Math.hypot(dx, dz) < this.aro.radio + 0.06) this.doble();
    }
    this.yAnterior = y;
    // Termina al cumplir el tiempo (si el jugador sigue con la pelota en la mano, espera un poco).
    if (this.reloj >= this.def.duracion && (p.estado !== 'agarrado' || this.reloj >= this.def.duracion + 6)) this.terminado = true;
  }

  despedirCompanero() {
    this.despedida = 'hecha';
    this.pasador.activo = false;
    const p = this.ctx.pelota;
    if (p.estado === 'enChico' && p.duenio === this.pasador.chico) { p.estado = 'cayendo'; p.duenio = null; }
    this.ctx.chicos.esfumar(this.pasador.chico);
    this.ctx.panel.mostrar({ titulo: String(this.def.anio), cuerpo: this.def.sinCompanero || 'Tu compañero de juego ya no está.', tono: 'neutro' });
    this.reloj = this.def.duracion - 4.5; // quedan unos segundos para que se note, y sigue
  }

  doble() {
    // La red frena la pelota: cae casi derecha y queda cerca del aro.
    this.ctx.pelota.velocidad.x *= 0.15;
    this.ctx.pelota.velocidad.z *= 0.15;
    if (this.despedida === 'hecha') return; // el compañero ya no está: nadie festeja
    this.dobles++;
    const ctx = this.ctx;
    ctx.ambiente.acierto();
    for (const c of [...this.publico, this.pasador.chico]) ctx.chicos.gesticular(c, 'festeja', 1.6);
    ctx.panel.mostrar({ titulo: '¡Doble!', cuerpo: this.dobles === 1 ? '¡Los chicos festejan con vos!' : `Ya van ${this.dobles} dobles.`, tono: 'acierto' });
  }

  terminar() {
    // Si el compañero no llegó a esfumarse (el jugador nunca tiró), se esfuma ahora, a oscuras.
    if (this.despedida !== 'hecha') this.ctx.chicos.esfumar(this.pasador.chico);
    this.pasador.activo = false;
    this.publico.forEach((c) => this.liberar(c));
    this.ctx.pelota.colisiones = this.ctx.pelota.colisiones.filter((f) => f !== this.colision);
    this.aro.grupo.visible = true; // el aro queda en la plaza
  }
}

// ---------------------------------------------------------------------------------------------
/** 2019: empujar la hamaca. La de al lado ya está vacía. */
export class CapHamaca extends Capitulo {
  necesita(c) { return c.indice === this.ctx.indices.hamaca; }

  preparar() {
    const ctx = this.ctx;
    this.asiento = ctx.hamacas.asientos[0];
    this.chico = ctx.chicos.lista[ctx.indices.hamaca];
    this.asiento.amplitud = 0.22;
    this.empujones = 0;
    this.espera = 0;
  }
  actualizar(dt) {
    super.actualizar(dt);
    const ctx = this.ctx;
    const a = this.asiento;
    // Sin empujones, la hamaca se va frenando (pero nunca del todo).
    a.amplitud = Math.max(0.12, a.amplitud - dt * 0.025);
    this.espera -= dt;
    const asiento = ctx.hamacas.posicionAsiento(0, _tmp2);
    for (const mano of ctx.manos.manos) {
      if (!mano.fuente) continue;
      const punto = ctx.manos.puntoDeAgarre(mano, _tmp);
      // Empujar: tocar al chico/asiento mientras la hamaca empieza a alejarse.
      if (this.espera <= 0 && punto.distanceTo(asiento) < 0.55 && a.velocidad > 0.05) {
        a.amplitud = Math.min(0.55, a.amplitud + 0.1);
        this.empujones++;
        this.espera = 0.9;
        ctx.manos.vibrar(mano, 0.6, 80);
        ctx.ambiente.risa();
        if (this.empujones === 1 || this.empujones % 3 === 0) {
          ctx.panel.mostrar({ titulo: '¡Más alto!', cuerpo: this.empujones === 1 ? '¡Le encanta! Seguí empujando.' : `${this.empujones} empujones. ¡Se ríe!`, tono: 'acierto' });
        }
      }
    }
    if (this.reloj >= this.def.duracion) this.terminado = true;
  }
  /** En la PC (sin visor): clic sobre el chico para empujar. */
  empujarConMouse() {
    this.asiento.amplitud = Math.min(0.55, this.asiento.amplitud + 0.1);
    this.empujones++;
    this.ctx.ambiente.risa();
  }
}

// ---------------------------------------------------------------------------------------------
/** 2022: burbujas. Una chica sopla burbujas y el jugador las revienta con las manos. */
export class CapBurbujas extends Capitulo {
  necesita(c) { return c.indice === this.ctx.indices.burbujas; }

  preparar() {
    const ctx = this.ctx;
    this.chica = this.ubicar(ctx.indices.burbujas, this.aMundo(0.2, 0, -1.9));
    if (this.chica) this.chica.sostiene = true;
    this.reventadas = 0;
    this.tiempoSoplo = 0;
  }
  actualizar(dt) {
    super.actualizar(dt);
    const ctx = this.ctx;
    const jugador = ctx.posicionJugador();
    if (this.chica) {
      ctx.chicos.mirarA(this.chica, jugador);
      this.tiempoSoplo -= dt;
      if (this.tiempoSoplo <= 0 && this.reloj < this.def.duracion - 3) {
        this.tiempoSoplo = 0.45;
        const desde = ctx.chicos.manos(this.chica, new THREE.Vector3());
        desde.y += 0.25;
        ctx.burbujas.soplar(desde, jugador);
      }
    }
    for (const mano of ctx.manos.manos) {
      if (!mano.fuente) continue;
      const n = ctx.burbujas.tocar(ctx.manos.puntoDeAgarre(mano, _tmp), 0.09);
      if (n) {
        this.reventadas += n;
        ctx.ambiente.pop();
        ctx.manos.vibrar(mano, 0.2, 20);
        if (this.reventadas === 1 || this.reventadas % 5 === 0) ctx.panel.mostrar({ titulo: String(this.def.anio), cuerpo: `¡${this.reventadas} ${this.reventadas === 1 ? 'burbuja' : 'burbujas'}!`, tono: 'acierto' });
      }
    }
    if (this.reloj >= this.def.duracion) this.terminado = true;
  }
  terminar() {
    this.ctx.burbujas.apagar();
    if (this.chica) this.liberar(this.chica);
  }
}

// ---------------------------------------------------------------------------------------------
/** 2024: la pelota vuelve rodando sola; el jugador la tira y nadie se la devuelve. */
export class CapFinal extends Capitulo {
  preparar() {
    const ctx = this.ctx;
    const p = ctx.pelota;
    const jugador = this.aMundo(0, 0, 0);
    p.raiz.visible = true;
    p.duenio = null;
    p.lanzadaPor = null;
    p.rodar(this.aMundo(0, 0, -5), new THREE.Vector3().subVectors(jugador, this.aMundo(0, 0, -5)).normalize().multiplyScalar((5 - 0.6) * 0.9));
    this.tiro = false;
    this.esperaTiro = 0;
  }
  iniciar() {
    this.ctx.panel.mostrar({ titulo: String(this.def.anio), cuerpo: this.def.cuerpo });
  }
  actualizar(dt) {
    const p = this.ctx.pelota;
    // El reloj corre recién cuando la pelota llegó al jugador.
    if (p.estado !== 'cayendo' || this.tiro) super.actualizar(dt);
    if (!this.tiro && p.lanzadaPor === 'jugador' && p.estado !== 'agarrado') {
      this.tiro = true;
      this.reloj = Math.max(this.reloj, this.def.duracion - 4); // 4 s para verla rodar sola
    }
    if (this.reloj >= this.def.duracion) this.terminado = true;
  }
}

export const CAPITULOS = { pelota: CapPelota, basquet: CapBasquet, hamaca: CapHamaca, burbujas: CapBurbujas, final: CapFinal };
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
