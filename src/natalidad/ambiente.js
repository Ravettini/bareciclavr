import { Sonido } from '../feedback/sonido.js';

/**
 * Sonido de "La plaza que se vacía", sintetizado (sin archivos):
 *  - una base armónica suave que se apaga al final,
 *  - "sonidos de juego" (notas cortas y agudas) cuya frecuencia depende de cuántos chicos quedan,
 *  - el tic-tac de cada año y el rebote de la pelota.
 * PROVISIONAL: lo ideal es reemplazarlo por una grabación real de una plaza (sonidos/plaza.mp3)
 * y una locución.
 */
const ESCALA = [784, 880, 988, 1175, 1319, 1568]; // pentatónica aguda

export class Ambiente extends Sonido {
  constructor() {
    super();
    this.base = null;
    this.intensidadJuego = 1;
  }

  /** Arranca la base armónica (llamar después de un gesto del usuario). */
  iniciarBase() {
    this.activar();
    if (!this.ctx || this.base) return;
    const ctx = this.ctx;
    const ganancia = ctx.createGain();
    ganancia.gain.value = 0.0001;
    ganancia.connect(ctx.destination);
    for (const f of [130.8, 164.8, 196.0, 261.6]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.25;
      osc.connect(g).connect(ganancia);
      osc.start();
    }
    this.base = ganancia;
    this.volumenBase(0.06, 2);
  }

  volumenBase(valor, segundos = 1.5) {
    if (!this.base) return;
    const g = this.base.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.0001, g.value), t);
    g.exponentialRampToValueAtTime(Math.max(0.0001, valor), t + segundos);
  }

  /** Llamar cada frame: más chicos presentes = más sonidos de juego. */
  actualizar(dt, presentes) {
    if (!this.ctx || this.intensidadJuego <= 0) return;
    const porSegundo = presentes * 0.22 * this.intensidadJuego;
    if (Math.random() < porSegundo * dt) {
      const f = ESCALA[Math.floor(Math.random() * ESCALA.length)];
      this.nota(f, 0, 0.12, 'triangle', 0.035);
      if (Math.random() < 0.4) this.nota(f * 1.25, 0.08, 0.1, 'triangle', 0.025);
    }
  }

  tic() { this.nota(1800, 0, 0.04, 'square', 0.04); this.nota(1200, 0.5, 0.04, 'square', 0.03); }
  rebote(fuerza = 0.5) { this.nota(110, 0, 0.12, 'sine', 0.15 * fuerza + 0.05); }
  atajada() { this.nota(220, 0, 0.08, 'sine', 0.12); }
}
