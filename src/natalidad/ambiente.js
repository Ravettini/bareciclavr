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
    this.volumenBaseActual = 0.06;
    /** Locución: id → AudioBuffer (se decodifican al activar el audio). */
    this.voces = {};
    this.rutasVoces = {};
    this.vozSonando = null;
    /** Frases que se reprodujeron (para depuración y pruebas). */
    this.historialVoces = [];
  }

  /** Registra los archivos de la locución (datos/natalidad.json → "voces"). */
  configurarVoces(rutas = {}) {
    this.rutasVoces = Object.fromEntries(Object.entries(rutas).filter(([k]) => !k.startsWith('_')));
    this.precargarVoces();
  }

  async precargarVoces() {
    if (!this.ctx) return;
    await Promise.all(Object.entries(this.rutasVoces).map(async ([id, ruta]) => {
      if (this.voces[id]) return;
      try {
        const resp = await fetch(ruta);
        if (!resp.ok) throw new Error(resp.status);
        this.voces[id] = await this.ctx.decodeAudioData(await resp.arrayBuffer());
      } catch (e) {
        console.warn(`Sin la frase "${id}" (${ruta}):`, e.message || e);
      }
    }));
  }

  activar() {
    super.activar();
    this.precargarVoces();
  }

  /**
   * Reproduce una frase de la locución. Mientras habla, baja el ambiente; si había otra frase
   * sonando, la corta. Si el archivo todavía no se decodificó, espera un poco (hasta 3 s).
   */
  voz(id, intentos = 15) {
    if (!this.ctx || !this.rutasVoces[id]) return;
    const buffer = this.voces[id];
    if (!buffer) {
      if (intentos > 0) setTimeout(() => this.voz(id, intentos - 1), 200);
      return;
    }
    try { this.vozSonando?.stop(); } catch { /* ya terminó */ }
    const fuente = this.ctx.createBufferSource();
    fuente.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = 1;
    fuente.connect(g).connect(this.ctx.destination);
    fuente.start();
    this.vozSonando = fuente;
    this.historialVoces.push(id);
    // El ambiente baja mientras habla la voz.
    this.agacharAmbiente(true);
    fuente.onended = () => { if (this.vozSonando === fuente) { this.vozSonando = null; this.agacharAmbiente(false); } };
  }

  agacharAmbiente(hablando) {
    this.factorVoz = hablando ? 0.25 : 1;
    if (this.base) this.volumenBase(this.volumenBaseActual * this.factorVoz, 0.4, true);
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

  volumenBase(valor, segundos = 1.5, interno = false) {
    if (!interno) { this.volumenBaseActual = valor; valor *= this.factorVoz ?? 1; }
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
    const porSegundo = presentes * 0.22 * this.intensidadJuego * (this.factorVoz ?? 1);
    if (Math.random() < porSegundo * dt) {
      const f = ESCALA[Math.floor(Math.random() * ESCALA.length)];
      this.nota(f, 0, 0.12, 'triangle', 0.035);
      if (Math.random() < 0.4) this.nota(f * 1.25, 0.08, 0.1, 'triangle', 0.025);
    }
  }

  tic() { this.nota(1800, 0, 0.04, 'square', 0.04); this.nota(1200, 0.5, 0.04, 'square', 0.03); }
  rebote(fuerza = 0.5) { this.nota(110, 0, 0.12, 'sine', 0.15 * fuerza + 0.05); }
  atajada() { this.nota(220, 0, 0.08, 'sine', 0.12); }
  /** "Risa" sintetizada: notas agudas que suben (provisional, ideal: grabación real). */
  risa() { [988, 1175, 1319, 1568].forEach((f, i) => this.nota(f, i * 0.07, 0.09, 'triangle', 0.06)); }
  pop() { this.nota(1400 + Math.random() * 600, 0, 0.05, 'sine', 0.08); }
}
