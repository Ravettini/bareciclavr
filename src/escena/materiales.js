import * as THREE from 'three';

/**
 * Materiales compartidos. MeshLambertMaterial es barato en GPUs móviles
 * (iluminación por vértice, sin PBR). Se reutiliza una instancia por color
 * para reducir cambios de estado en el render.
 */
const cache = new Map();

export function material(color, opciones = {}) {
  const clave = color + JSON.stringify(opciones);
  if (!cache.has(clave)) cache.set(clave, new THREE.MeshLambertMaterial({ color, flatShading: true, ...opciones }));
  return cache.get(clave);
}

/** Crea una malla con un material compartido. */
export function malla(geometria, color, opciones) {
  return new THREE.Mesh(geometria, material(color, opciones));
}

/**
 * Quita color a todos los materiales compartidos (la plaza "se apaga"): 0 = colores originales,
 * 1 = gris. Los chicos tienen materiales propios y conservan su color.
 */
export function desaturar(factor) {
  for (const m of cache.values()) {
    m.userData.original ??= m.color.clone();
    const o = m.userData.original;
    const gris = o.r * 0.3 + o.g * 0.59 + o.b * 0.11;
    m.color.setRGB(o.r + (gris - o.r) * factor, o.g + (gris - o.g) * factor, o.b + (gris - o.b) * factor);
  }
}
