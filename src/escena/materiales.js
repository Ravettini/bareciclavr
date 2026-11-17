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
