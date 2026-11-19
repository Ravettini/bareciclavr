import * as THREE from 'three';
import { CAPITULOS, LUGARES } from './capitulos.js';

/**
 * Guion de "La plaza que se vacía": encadena los capítulos (un minijuego por año) y las transiciones.
 *
 *   espera → 2014 → transición → 2016 → … → 2024 → dato → fin       (≈ 3 min 30 s; tope 4 min)
 *
 * Transición entre capítulos (sin movimiento artificial, para no marear):
 *   1. Fundido a negro. A oscuras, el jugador pasa a otro lugar de la plaza y los chicos que se van
 *      a ir en estos años se ubican jugando frente a él.
 *   2. Vuelve la luz y avanzan los años (tic-tac). En cada año, los chicos que corresponden según la
 *      serie de nacimientos saludan y se ESFUMAN a la vista, dejando su juguete en el piso.
 *      El panel cuenta cuántos quedan.
 *   3. La plaza también pierde espacios de infancia (metáfora): tobogán cerrado con cinta, hamaca
 *      sin asiento, arenero tapado, juegos vallados, y cada vez menos color.
 *
 * Textos, años y duraciones vienen de datos/natalidad.json. Con ?rapido=N todo corre N veces
 * más rápido, salvo la física (solo para pruebas).
 */

/** Qué espacio de la plaza se pierde en cada año (y cuánto color pierde la plaza). */
const ESPACIOS = {
  2016: { apagado: 0.15, cambio: 'cinta' },
  2019: { apagado: 0.35, cambio: 'asiento' },
  2022: { apagado: 0.6, cambio: 'lona' },
  2024: { apagado: 0.85, cambio: 'vallas' },
};

export class Guion {
  constructor(ctx) {
    this.ctx = ctx;
    ctx.escala = Number(new URLSearchParams(location.search).get('rapido')) || 1;
    this.apagado = 0;
    this.apagadoObjetivo = 0;
    this.reiniciar();
  }

  get datos() { return this.ctx.datos; }
  get presentes() { return this.ctx.chicos.presentes.length; }

  reiniciar() {
    const ctx = this.ctx;
    this.capitulo?.terminar();
    this.historial = ['espera'];
    this.fase = 'espera';
    this.indice = 0;
    this.reloj = 0;
    this.tiempoTotal = 0;
    this.pendientes = [];
    this.anio = this.datos.capitulos[0].anio;
    ctx.chicos.reiniciar();
    ctx.hamacas.asientos.forEach((a, i) => { ctx.hamacas.quitarAsiento(i, false); a.ocupado = true; a.amplitud = 0.55; });
    ctx.burbujas.apagar();
    ctx.juguetes.limpiar();
    ctx.espacios.reiniciar();
    this.apagado = this.apagadoObjetivo = 0;
    ctx.espacios.apagar(0);
    ctx.ambiente.intensidadJuego = 1;
    ctx.ambiente.volumenBase(0.06);
    ctx.fundido(0);
    this.irA('pelota');
    this.capitulo = this.crearCapitulo(0);
    this.capitulo.preparar();
    ctx.panel.mostrar({ ...this.datos.textos.inicio });
  }

  crearCapitulo(i) {
    const def = this.datos.capitulos[i];
    return new CAPITULOS[def.juego](this.ctx, def);
  }

  /** Ubica al jugador (y al panel) en un lugar de la plaza. */
  irA(nombre) {
    const l = LUGARES[nombre];
    const { rig, panel } = this.ctx;
    // Si juega sentado, el jugador "sube" para ver la plaza a la altura de un adulto (ver main.js).
    rig.position.set(l.x, this.ctx.calibrarAltura?.() ?? 0, l.z);
    rig.rotation.y = l.rotY;
    rig.updateMatrixWorld(true);
    panel.colocar(rig.localToWorld(new THREE.Vector3(...l.panel)), rig.localToWorld(new THREE.Vector3(0, 1.5, 0)));
  }

  /** Empieza la experiencia (al entrar en VR o con el primer clic en la PC). */
  comenzar() {
    this.ctx.ambiente.iniciarBase();
    if (this.fase !== 'espera') return;
    this.pasarA('capitulo');
    this.capitulo.iniciar();
    setTimeout(() => this.ctx.ambiente.voz('inicio'), 600);
  }

  pasarA(fase) {
    this.fase = fase;
    this.historial.push(fase === 'capitulo' ? `capitulo:${this.capitulo?.def.juego}` : fase);
    this.reloj = 0;
  }

  /** Ejecuta algo dentro de "segundos" (en tiempo del guion). */
  despues(segundos, fn) {
    this.pendientes.push({ cuando: this.tiempoTotal + segundos, fn });
  }

  actualizar(dt) {
    const ctx = this.ctx;
    const dtg = dt * ctx.escala;
    this.reloj += dtg;
    if (this.fase !== 'espera' && this.fase !== 'fin') this.tiempoTotal += dtg;
    // Tareas programadas (saludos, esfumarse…).
    for (const p of this.pendientes.filter((x) => x.cuando <= this.tiempoTotal)) p.fn();
    this.pendientes = this.pendientes.filter((x) => x.cuando > this.tiempoTotal);
    // La plaza pierde color de a poco.
    if (Math.abs(this.apagado - this.apagadoObjetivo) > 0.001) {
      this.apagado += Math.sign(this.apagadoObjetivo - this.apagado) * Math.min(Math.abs(this.apagadoObjetivo - this.apagado), dtg * 0.25);
      ctx.espacios.apagar(this.apagado);
    }

    switch (this.fase) {
      case 'espera':
        this.capitulo.pasador?.actualizar(0); // el chico sostiene la pelota
        break;
      case 'capitulo': {
        // Tope de seguridad: la experiencia no pasa de ~4 minutos aunque alguien se trabe.
        const ultimo = this.indice === this.datos.capitulos.length - 1;
        if (!ultimo && this.tiempoTotal > this.datos.tiempos.tope) this.capitulo.terminado = true;
        this.capitulo.actualizar(dt);
        if (this.capitulo.terminado) {
          if (ultimo) { this.pasarA('dato'); this.mostrarDato(); } else this.pasarA('oscurece');
        }
        break;
      }
      case 'oscurece':
        ctx.fundido(Math.min(1, this.reloj / 0.7));
        if (this.reloj >= 0.7) this.cambiarDeCapitulo();
        break;
      case 'aclara':
        ctx.fundido(1 - Math.min(1, this.reloj / 0.7));
        if (this.reloj >= 0.7) {
          this.pasarA('anios');
          this.anioDesde = this.anio;
          ctx.ambiente.voz('pasanLosAnios');
        }
        break;
      case 'anios': {
        const meta = this.capitulo.def.anio;
        const porAnio = this.datos.tiempos.porAnio;
        if (this.anio < meta && this.reloj >= (this.anio - this.anioDesde + 0.5) * porAnio) {
          this.anio++;
          this.avanzarAnio();
        }
        if (this.anio >= meta && this.reloj >= (meta - this.anioDesde + 0.5) * porAnio + 2.2) {
          this.pasarA('capitulo');
          this.capitulo.iniciar();
          ctx.ambiente.voz(this.capitulo.def.juego, { cola: true }); // "Dos mil dieciséis. ¡A jugar al básquet!…"
        }
        break;
      }
      case 'dato':
        if (this.reloj >= this.datos.tiempos.dato) { this.pasarA('fin'); this.mostrarFin(); }
        break;
    }
    ctx.chicos.jugador.copy(ctx.posicionJugador()).setY(0);
  }

  /** A oscuras: cambia de capítulo y de lugar, y prepara a los chicos que se van a despedir. */
  cambiarDeCapitulo() {
    const ctx = this.ctx;
    this.capitulo.terminar();
    // Si se pasó del tope de tiempo, va directo al final.
    this.indice = this.tiempoTotal > this.datos.tiempos.tope ? this.datos.capitulos.length - 1 : this.indice + 1;
    this.capitulo = this.crearCapitulo(this.indice);
    const juego = this.capitulo.def.juego;
    this.irA(juego);
    this.capitulo.preparar();

    // Quiénes se van en cada año hasta el del capítulo.
    this.despedidas = {};
    const planeados = new Set();
    const serie = this.datos.anios.serie;
    let quedan = this.presentes;
    for (let anio = this.anio + 1; anio <= this.capitulo.def.anio; anio++) {
      const fila = serie.find((f) => f.anio === anio) || serie[serie.length - 1];
      const objetivo = Math.round(ctx.chicos.lista.length * fila.indice);
      this.despedidas[anio] = [];
      for (const i of ctx.ordenSalida) {
        if (quedan <= objetivo) break;
        const c = ctx.chicos.lista[i];
        if (planeados.has(c) || !ctx.chicos.presentes.includes(c) || this.capitulo.necesita?.(c)) continue;
        planeados.add(c);
        this.despedidas[anio].push(c);
        quedan--;
      }
      this.despedidas[anio].objetivo = quedan;
    }
    // Los que se van se ubican jugando frente al jugador (salvo el de la hamaca si el próximo
    // juego es la hamaca: se esfuma sentado, y la hamaca sigue sola).
    const lugares = LUGARES[juego].despedida;
    let k = 0;
    for (const c of planeados) {
      const enHamaca = c.comportamientoInicial === 'hamaca';
      if (enHamaca && juego === 'hamaca') continue;
      if (enHamaca) ctx.hamacas.asientos[c.asiento].ocupado = false;
      const [lx, lz] = lugares[k++ % lugares.length];
      c.matrizExterna = null;
      c.posicion.copy(this.capitulo.aMundo(lx, 0, lz)).setY(0);
      c.comportamiento = 'salta';
      c.mira = ctx.rig.position.toArray();
    }
    ctx.panel.mostrar({ titulo: String(this.anio), cuerpo: this.datos.textos.tiempo.cuerpo });
    this.pasarA('aclara');
  }

  /** Avanza un año: se despiden y se esfuman los chicos que correspondan; la plaza cambia. */
  avanzarAnio() {
    const ctx = this.ctx;
    ctx.ambiente.tic();
    const lista = this.despedidas?.[this.anio] || [];
    const quedan = lista.objetivo ?? this.presentes;
    const menos = lista.length;
    // "Este año hay un chico menos en la plaza. Quedan 12." (con voz, si está grabada)
    ctx.panel.mostrar({
      titulo: String(this.anio),
      cuerpo: menos
        ? `Este año hay ${menos === 1 ? 'un chico menos' : `${menos} chicos menos`} en la plaza. Quedan ${quedan}.`
        : this.datos.textos.tiempo.cuerpo,
      pie: `En 2014 había ${ctx.chicos.lista.length} chicos`,
    });
    if (menos) ctx.ambiente.voz(`menos${Math.min(menos, 3)}`, { cola: true });
    lista.forEach((c, n) => {
      this.despues(n * 0.35, () => {
        c.comportamiento = 'quieto';
        ctx.chicos.mirarA(c, ctx.posicionJugador());
        ctx.chicos.gesticular(c, 'saluda', 1.4);
      });
      this.despues(n * 0.35 + 0.9, () => ctx.chicos.esfumar(c));
    });
    const espacio = ESPACIOS[this.anio];
    if (espacio) this.despues(lista.length * 0.35 + 1.0, () => {
      ctx.espacios.cambiar(espacio.cambio);
      this.apagadoObjetivo = espacio.apagado;
    });
    ctx.ambiente.intensidadJuego = Math.max(0, quedan / ctx.chicos.lista.length);
  }

  mostrarDato() {
    const ctx = this.ctx;
    ctx.ambiente.intensidadJuego = 0;
    ctx.ambiente.volumenBase(0.0001, 4);
    ctx.panel.mostrar({ ...this.datos.textos.dato, tono: 'error' });
    setTimeout(() => ctx.ambiente.voz('dato'), 1500); // después de un silencio
  }

  mostrarFin() {
    const ctx = this.ctx;
    ctx.ambiente.volumenBase(0.04, 4);
    ctx.panel.mostrar({ ...this.datos.textos.continuara, tono: 'acierto' });
    ctx.ambiente.voz('cierre');
    ctx.alFin();
  }

  /** Lo llama main.js cuando el jugador suelta la pelota. */
  alSoltarPelota(p) {
    p.lanzadaPor = 'jugador';
    p.duenio = null;
    this.capitulo?.alSoltar?.(p);
  }
}
