import * as THREE from 'three';

/**
 * Guion de "La plaza que se vacía" (parte 1):
 *
 *  espera → juego (2014) → tiempo (2015…2024) → tiroFinal → dato → fin
 *
 *  - espera:    los chicos juegan; empieza al entrar en VR (o al primer clic en la PC).
 *  - juego:     un chico le pasa la pelota al jugador y se la devuelve.
 *  - tiempo:    avanzan los años; los chicos se van yendo según la serie de nacimientos.
 *  - tiroFinal: la pelota vuelve rodando sola; el jugador la tira y nadie se la devuelve.
 *  - dato:      silencio y el dato.
 *  - fin:       cierre de la parte 1 y botón Reiniciar.
 *
 * Los tiempos y textos vienen de datos/natalidad.json. Con ?rapido=N el guion corre N veces
 * más rápido (solo para pruebas).
 */
export class Guion {
  constructor({ datos, chicos, pelota, panel, ambiente, hamacas, camara, ordenSalida, alFin }) {
    Object.assign(this, { datos, chicos, pelota, panel, ambiente, hamacas, camara, ordenSalida, alFin });
    this.escala = Number(new URLSearchParams(location.search).get('rapido')) || 1;
    this.pelotero = chicos.lista.find((c) => c.comportamientoInicial === 'pelota');
    this.puestoPelotero = this.pelotero.posicion.clone();
    this.reiniciar();
  }

  reiniciar() {
    /** Fases por las que pasó (para depuración y pruebas). */
    this.historial = ['espera'];
    this.fase = 'espera';
    this.reloj = 0;
    this.anio = this.datos.anios.serie[0].anio;
    this.pases = 0;
    this.chicos.reiniciar();
    this.hamacas.asientos.forEach((a) => { a.ocupado = true; a.amplitud = 0.55; });
    this.pelotero.posicion.copy(this.puestoPelotero);
    this.pelotero.corriendo = false;
    this.estadoPelotero = 'espera';
    this.esperaPelotero = 2.5;
    this.pelota.estado = 'enChico';
    this.pelota.velocidad.set(0, 0, 0);
    this.pelota.raiz.visible = true;
    this.ambiente.intensidadJuego = 1;
    this.ambiente.volumenBase(0.06);
    this.panel.mostrar({ ...this.datos.textos.inicio });
  }

  /** Empieza la experiencia (al entrar en VR o con el primer clic). */
  comenzar() {
    this.ambiente.iniciarBase();
    if (this.fase !== 'espera') return;
    this.fase = 'juego';
    this.historial.push('juego');
    this.reloj = 0;
  }

  get presentes() {
    return this.chicos.presentes.length;
  }

  /** Posición del jugador (cabeza) en el mundo. */
  posicionJugador(destino = new THREE.Vector3()) {
    return this.camara.getWorldPosition(destino);
  }

  actualizar(dt) {
    const dtg = dt * this.escala;
    // En el tiro final, el reloj arranca recién cuando la pelota llegó al jugador.
    const pelotaEnCamino = this.fase === 'tiroFinal' && !this.tiroHecho && this.pelota.estado === 'cayendo';
    if (!pelotaEnCamino) this.reloj += dtg;
    const t = this.datos.tiempos;
    this.actualizarPelotero(dt);

    switch (this.fase) {
      case 'juego':
        if (this.reloj >= t.juego) this.pasarA('tiempo');
        break;
      case 'tiempo': {
        const serie = this.datos.anios.serie;
        const i = Math.min(serie.length - 1, Math.floor(this.reloj / t.porAnio) + 1);
        if (serie[i].anio !== this.anio) {
          this.anio = serie[i].anio;
          this.ambiente.tic();
          this.panel.mostrar({ titulo: String(this.anio), cuerpo: this.datos.textos.tiempo.cuerpo, tono: 'neutro' });
          // Se van chicos hasta que queden los que corresponden al índice del año.
          const objetivo = Math.round(this.chicos.lista.length * serie[i].indice);
          for (const indice of this.ordenSalida) {
            if (this.presentes <= objetivo) break;
            const chico = this.chicos.lista[indice];
            if (chico === this.pelotero) this.despedirPelotero();
            if (chico.comportamientoInicial === 'hamaca') this.hamacas.asientos[chico.asiento].ocupado = false;
            this.chicos.irse(chico);
          }
          this.ambiente.intensidadJuego = this.presentes / this.chicos.lista.length;
        }
        if (i === serie.length - 1 && this.reloj >= serie.length * t.porAnio) this.pasarA('tiroFinal');
        break;
      }
      case 'tiroFinal': {
        const p = this.pelota;
        if (!this.tiroHecho && (p.estado === 'cayendo' || p.estado === 'lanzada') && this.soltoElJugador) {
          this.tiroHecho = true;
          this.reloj = Math.max(this.reloj, t.esperaTiroFinal - 4 * this.escala); // 4 s para verla rodar
        }
        if (this.reloj >= t.esperaTiroFinal) this.pasarA('dato');
        break;
      }
      case 'dato':
        if (this.reloj >= t.dato) this.pasarA('fin');
        break;
    }
  }

  pasarA(fase) {
    this.fase = fase;
    this.historial.push(fase);
    this.reloj = 0;
    const tx = this.datos.textos;
    if (fase === 'tiempo') {
      // El chico le pasa la pelota una última vez antes de que empiece a pasar el tiempo.
      this.panel.mostrar({ titulo: String(this.anio), cuerpo: tx.tiempo.cuerpo });
    } else if (fase === 'tiroFinal') {
      this.tiroHecho = false;
      this.soltoElJugador = false;
      this.traerPelota();
      // Si ya tenía la pelota en la mano, el tiro cuenta cuando la suelte.
      this.panel.mostrar({ ...tx.tiroFinal, tono: 'neutro' });
    } else if (fase === 'dato') {
      this.ambiente.intensidadJuego = 0;
      this.ambiente.volumenBase(0.0001, 4);
      this.panel.mostrar({ ...tx.dato, tono: 'error' });
    } else if (fase === 'fin') {
      this.ambiente.volumenBase(0.04, 4);
      this.panel.mostrar({ ...tx.continuara, tono: 'acierto' });
      this.alFin();
    }
  }

  /** Lo llama main.js cuando el jugador suelta la pelota. */
  alSoltarPelota() {
    this.soltoElJugador = true;
  }

  /** Si la pelota quedó lejos, vuelve rodando sola hacia el jugador. */
  traerPelota() {
    const jugador = this.posicionJugador().setY(0);
    const p = this.pelota;
    if (p.estado === 'agarrado') return;
    if (p.estado !== 'enChico' && p.raiz.position.distanceTo(jugador.clone().setY(p.radio)) < 1.8) return;
    const desde = new THREE.Vector3(jugador.x, 0, jugador.z - 5);
    const distancia = 5 - 0.6;
    p.raiz.visible = true;
    p.rodar(desde, new THREE.Vector3(0, 0, distancia * 0.9));
  }

  despedirPelotero() {
    // Si tiene la pelota, la deja rodando hacia el jugador antes de irse.
    if (this.pelota.estado === 'enChico') {
      const desde = this.chicos.manos(this.pelotero, new THREE.Vector3());
      this.pelota.rodar(desde, new THREE.Vector3(0, 0, 1.6));
    }
    this.pelotero.corriendo = false;
    this.estadoPelotero = 'ido';
  }

  // ---------- El chico de la pelota ----------

  actualizarPelotero(dt) {
    const c = this.pelotero;
    const p = this.pelota;
    if (this.estadoPelotero === 'ido') return;
    const jugador = this.posicionJugador();

    if (p.estado === 'enChico') this.chicos.manos(c, p.raiz.position);

    // ¿Le llega la pelota que tiró el jugador?
    if (p.estado === 'cayendo') {
      const dx = p.raiz.position.x - c.posicion.x;
      const dz = p.raiz.position.z - c.posicion.z;
      // Generoso a propósito: el chico "salta" o se agacha para atajar (incluso si llega rodando).
      if (Math.hypot(dx, dz) < 1.0 && p.raiz.position.y < 2.3) {
        p.estado = 'enChico';
        p.velocidad.set(0, 0, 0);
        this.ambiente.atajada();
        this.pases++;
        this.estadoPelotero = 'espera';
        this.esperaPelotero = 1.3;
      }
    }

    switch (this.estadoPelotero) {
      case 'espera':
        c.corriendo = false;
        c.rumbo = Math.atan2(jugador.x - c.posicion.x, jugador.z - c.posicion.z);
        if (p.estado !== 'enChico' || this.fase === 'espera') break;
        // En "tiempo" juega mientras siga en la plaza; en tiroFinal ya no está.
        this.esperaPelotero -= dt;
        if (this.esperaPelotero <= 0) this.tirarAlJugador(jugador);
        break;
      case 'esperaRetorno':
        // Si la pelota quedó lejos del jugador, va a buscarla.
        if (p.estado === 'reposo' && p.raiz.position.distanceTo(_tmp.copy(jugador).setY(p.radio)) > 1.7) {
          this.estadoPelotero = 'busca';
        } else if (p.estado === 'reposo' && !this.avisoAgarrala && this.fase === 'juego') {
          this.avisoAgarrala = true;
          this.panel.mostrar({ ...this.datos.textos.inicio, cuerpo: this.datos.textos.agarrala });
        }
        break;
      case 'busca': {
        if (p.estado === 'agarrado') { this.estadoPelotero = 'esperaRetorno'; this.volverAlPuesto(dt); break; }
        if (this.caminarHacia(c, p.raiz.position, dt, 2.4) < 0.4 && p.estado !== 'lanzada') {
          p.estado = 'enChico';
          p.velocidad.set(0, 0, 0);
          this.pases++; // también cuenta como pase si la tuvo que ir a buscar
          this.estadoPelotero = 'vuelve';
        }
        break;
      }
      case 'vuelve':
        if (this.volverAlPuesto(dt) < 0.1) {
          this.estadoPelotero = 'espera';
          this.esperaPelotero = 0.8;
        }
        break;
    }
  }

  volverAlPuesto(dt) {
    return this.caminarHacia(this.pelotero, this.puestoPelotero, dt, 2.0);
  }

  caminarHacia(c, destino, dt, velocidad) {
    const paso = _tmp2.subVectors(destino, c.posicion).setY(0);
    const d = paso.length();
    if (d > 0.05) {
      c.posicion.addScaledVector(paso.normalize(), Math.min(d, velocidad * dt));
      c.rumbo = Math.atan2(paso.x, paso.z);
      c.corriendo = true;
    } else c.corriendo = false;
    return d;
  }

  tirarAlJugador(jugador) {
    const c = this.pelotero;
    const desde = this.chicos.manos(c, new THREE.Vector3());
    // Apunta un poco delante del pecho del jugador.
    const hacia = _tmp.subVectors(desde, jugador).setY(0).normalize();
    const destino = jugador.clone().addScaledVector(hacia, 0.45);
    destino.y = Math.max(0.8, jugador.y - 0.5);
    const duracion = 0.55 + desde.distanceTo(destino) / 4;
    this.pelota.lanzar(desde, destino, duracion);
    this.estadoPelotero = 'esperaRetorno';
    this.avisoAgarrala = false;
  }
}
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
