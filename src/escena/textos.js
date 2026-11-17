import * as THREE from 'three';

/**
 * Utilidades para dibujar texto en un canvas y usarlo como textura.
 * Se usa en lugar de fuentes 3D: es barato y legible en el visor.
 */
export function texturaTexto(texto, { fondo = '#ffffff', color = '#000000', ancho = 512, alto = 128, tamano = 64 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, ancho, alto);
  ctx.fillStyle = color;
  ctx.font = `bold ${tamano}px system-ui, Roboto, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, ancho / 2, alto / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Corta un texto en líneas que entren en el ancho dado. */
export function partirEnLineas(ctx, texto, anchoMax) {
  const palabras = texto.split(/\s+/);
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? actual + ' ' + p : p;
    if (ctx.measureText(prueba).width > anchoMax && actual) {
      lineas.push(actual);
      actual = p;
    } else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas;
}
