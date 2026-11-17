/**
 * Sonidos sintetizados con Web Audio: no hay archivos que descargar.
 * Se pueden reemplazar por clips definitivos (carpeta sonidos/) más adelante.
 * El error suena suave a propósito: el objetivo es enseñar, no castigar.
 */
export class Sonido {
  constructor() {
    this.ctx = null;
  }

  /** Los navegadores exigen un gesto del usuario para habilitar el audio. */
  activar() {
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch { this.ctx = null; }
  }

  nota(frecuencia, inicio, duracion, tipo = 'sine', volumen = 0.25) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + inicio;
    const osc = ctx.createOscillator();
    const gan = ctx.createGain();
    osc.type = tipo;
    osc.frequency.value = frecuencia;
    gan.gain.setValueAtTime(0.0001, t);
    gan.gain.exponentialRampToValueAtTime(volumen, t + 0.02);
    gan.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    osc.connect(gan).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duracion + 0.05);
  }

  acierto() { this.nota(660, 0, 0.18); this.nota(880, 0.1, 0.18); this.nota(1320, 0.2, 0.3); }
  error() { this.nota(392, 0, 0.22, 'triangle', 0.2); this.nota(330, 0.16, 0.3, 'triangle', 0.2); }
  agarre() { this.nota(520, 0, 0.06, 'sine', 0.08); }
  final() { [523, 659, 784, 1047].forEach((f, i) => this.nota(f, i * 0.12, 0.35)); }
}
