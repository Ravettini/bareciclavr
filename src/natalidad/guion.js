import * as THREE from 'three';
import { CAPITULOS, LUGARES } from './capitulos.js';

/**
 * Guion de "La plaza que se vacía": encadena los capítulos (un juego por año) y las transiciones.
 *
 *   espera → capítulo 2014 → transición → capítulo 2016 → … → capítulo 2024 → dato → fin
 *
 * Transición entre capítulos (sin movimiento artificial, para no marear):
 *   fundido a negro → el jugador aparece en otro lugar de la plaza → vuelve la luz →
 *   avanzan los años (tic-tac) y en cada año se van chicos según la serie de nacimientos.
 *
 * Textos, años y duraciones vienen de datos/natalidad.json. Con ?rapido=N todo corre N veces
 * más rápido, salvo la física (solo para pruebas).
 */
export class Guion {
  constructor(ctx) {
    this.ctx = ctx;
    ctx.escala = Number(new URLSearchParams(location.search).get('rapido')) || 1;
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
    this.anio = this.datos.capitulos[0].anio;
    ctx.chicos.reiniciar();
    ctx.hamacas.asientos.forEach((a) => { a.ocupado = true; a.amplitud = 0.55; });
    ctx.burbujas.apagar();
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
    rig.position.set(l.x, 0, l.z);
    rig.rotation.y = l.rotY;
    rig.updateMatrixWorld(true);
    const pos = rig.localToWorld(new THREE.Vector3(...l.panel));
    panel.colocar(pos, rig.localToWorld(new THREE.Vector3(0, 1.5, 0)));
  }

  /** Empieza la experiencia (al entrar en VR o con el primer clic en la PC). */
  comenzar() {
    this.ctx.ambiente.iniciarBase();
    if (this.fase !== 'espera') return;
    this.pasarA('capitulo');
    this.capitulo.iniciar();
  }

  pasarA(fase) {
    this.fase = fase;
    this.historial.push(fase === 'capitulo' ? `capitulo:${this.capitulo?.def.juego}` : fase);
    this.reloj = 0;
  }

  actualizar(dt) {
    const ctx = this.ctx;
    const dtg = dt * ctx.escala;
    this.reloj += dtg;
    switch (this.fase) {
      case 'espera':
        this.capitulo.pasador?.actualizar(0); // el chico sostiene la pelota
        break;
      case 'capitulo':
        this.capitulo.actualizar(dt);
        if (this.capitulo.terminado) {
          if (this.indice === this.datos.capitulos.length - 1) this.pasarA('dato'), this.mostrarDato();
          else this.pasarA('oscurece');
        }
        break;
      case 'oscurece':
        ctx.fundido(Math.min(1, this.reloj / 0.8));
        if (this.reloj >= 0.8) {
          // A oscuras: cambia de capítulo y de lugar.
          this.capitulo.terminar();
          this.indice++;
          this.capitulo = this.crearCapitulo(this.indice);
          this.irA(this.capitulo.def.juego);
          this.capitulo.preparar();
          this.anioDesde = this.anio;
          ctx.panel.mostrar({ titulo: String(this.anio), cuerpo: this.datos.textos.tiempo.cuerpo });
          this.pasarA('aclara');
        }
        break;
      case 'aclara':
        ctx.fundido(1 - Math.min(1, this.reloj / 0.8));
        if (this.reloj >= 0.8) { this.pasarA('anios'); this.proximoAnio = this.reloj; }
        break;
      case 'anios': {
        // Avanzan los años hasta el del capítulo; en cada año se van chicos.
        const meta = this.capitulo.def.anio;
        const porAnio = this.datos.tiempos.porAnio;
        if (this.anio < meta && this.reloj >= (this.anio - this.anioDesde) * porAnio) {
          this.anio++;
          ctx.ambiente.tic();
          ctx.panel.mostrar({ titulo: String(this.anio), cuerpo: this.datos.textos.tiempo.cuerpo });
          this.seVanChicos();
        }
        if (this.anio >= meta && this.reloj >= (meta - this.anioDesde) * porAnio + 0.6) {
          this.pasarA('capitulo');
          this.capitulo.iniciar();
        }
        break;
      }
      case 'dato':
        if (this.reloj >= this.datos.tiempos.dato) this.pasarA('fin'), this.mostrarFin();
        break;
    }
    ctx.chicos.jugador.copy(ctx.posicionJugador()).setY(0);
  }

  /** Se van chicos hasta que queden los que corresponden al índice de nacimientos del año. */
  seVanChicos() {
    const ctx = this.ctx;
    const serie = this.datos.anios.serie;
    const fila = serie.find((f) => f.anio === this.anio) || serie[serie.length - 1];
    const objetivo = Math.round(ctx.chicos.lista.length * fila.indice);
    for (const i of ctx.ordenSalida) {
      if (this.presentes <= objetivo) break;
      const chico = ctx.chicos.lista[i];
      if (chico.comportamientoInicial === 'hamaca') ctx.hamacas.asientos[chico.asiento].ocupado = false;
      if (ctx.pelota.duenio === chico && ctx.pelota.estado === 'enChico') ctx.pelota.estado = 'reposo';
      ctx.chicos.irse(chico);
    }
    ctx.ambiente.intensidadJuego = this.presentes / ctx.chicos.lista.length;
  }

  mostrarDato() {
    const ctx = this.ctx;
    ctx.ambiente.intensidadJuego = 0;
    ctx.ambiente.volumenBase(0.0001, 4);
    ctx.panel.mostrar({ ...this.datos.textos.dato, tono: 'error' });
  }

  mostrarFin() {
    const ctx = this.ctx;
    ctx.ambiente.volumenBase(0.04, 4);
    ctx.panel.mostrar({ ...this.datos.textos.continuara, tono: 'acierto' });
    ctx.alFin();
  }

  /** Lo llama main.js cuando el jugador suelta la pelota. */
  alSoltarPelota(p) {
    p.lanzadaPor = 'jugador';
    p.duenio = null;
    this.capitulo?.alSoltar?.(p);
  }
}
