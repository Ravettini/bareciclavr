import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { partirEnLineas } from './textos.js';

/**
 * Panel de mensajes educativos flotando detrás de la mesa.
 * Se redibuja en un canvas solo cuando cambia el mensaje (no en cada frame).
 */
export class Panel {
  /** @param {{posicion:number[], ancho:number, alto:number}} [opciones] por defecto, el panel del juego de reciclaje */
  constructor(escena, opciones = CONFIG.panel) {
    const { posicion, ancho, alto } = opciones;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = Math.round(1024 * (alto / ancho));
    this.ctx = this.canvas.getContext('2d');
    this.textura = new THREE.CanvasTexture(this.canvas);
    this.textura.colorSpace = THREE.SRGBColorSpace;
    this.textura.anisotropy = 4;
    this.malla = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: this.textura }));
    this.malla.name = 'PanelMensajes';
    this.malla.position.set(...posicion);
    this.malla.lookAt(0, Math.min(posicion[1] - 0.1, 1.5), 0);
    escena.add(this.malla);
    /** Último contenido mostrado (lo leen las pruebas automáticas). */
    this.ultimo = null;
  }

  /** Mueve el panel a "posicion" (mundo), mirando hacia "mirarA". */
  colocar(posicion, mirarA) {
    this.malla.position.copy(posicion);
    this.malla.lookAt(mirarA.x, Math.min(posicion.y - 0.1, mirarA.y), mirarA.z);
  }

  /**
   * @param {{titulo:string, cuerpo:string, pie?:string, tono?:'neutro'|'acierto'|'error'}} contenido
   */
  mostrar({ titulo, cuerpo, pie = '', tono = 'neutro' }) {
    this.ultimo = { titulo, cuerpo, pie, tono };
    const { ctx, canvas } = this;
    const colores = { neutro: '#1f6f3a', acierto: '#2e9b46', error: '#d9822b' };
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#fffdf5';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = colores[tono];
    ctx.fillRect(0, 0, W, 110);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    // El título se achica si no entra en una línea.
    let tamano = 60;
    do ctx.font = `bold ${tamano--}px system-ui, Roboto, Arial, sans-serif`;
    while (ctx.measureText(titulo).width > W - 60 && tamano > 30);
    ctx.fillText(titulo, W / 2, 56);
    ctx.fillStyle = '#222222';
    // La letra del cuerpo es lo más grande posible que entre en el espacio disponible.
    const arriba = 120, abajo = pie ? H - 80 : H - 20;
    let tam = 88, lineas;
    do {
      ctx.font = `${tam}px system-ui, Roboto, Arial, sans-serif`;
      lineas = partirEnLineas(ctx, cuerpo, W - 100);
      tam -= 4;
    } while (lineas.length * (tam + 4) * 1.25 > abajo - arriba && tam > 28);
    const alto = (tam + 4) * 1.25;
    const inicio = arriba + (abajo - arriba - lineas.length * alto) / 2 + alto / 2;
    lineas.forEach((l, i) => ctx.fillText(l, W / 2, inicio + i * alto));
    if (pie) {
      ctx.fillStyle = '#555555';
      let tamPie = 40;
      do ctx.font = `bold ${tamPie--}px system-ui, Roboto, Arial, sans-serif`;
      while (ctx.measureText(pie).width > W - 60 && tamPie > 22);
      ctx.fillText(pie, W / 2, H - 38);
    }
    this.textura.needsUpdate = true;
  }
}
