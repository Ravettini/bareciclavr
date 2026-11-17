/**
 * Avisos en pantalla para diagnosticar problemas en el visor.
 * La función real está en index.html (así captura también errores de carga
 * que ocurren antes de que corra este código).
 */
export const VERSION = 'v0.2.0';

export function mostrarAviso(texto) {
  if (window.mostrarAviso) window.mostrarAviso(texto);
  else console.warn(texto);
}
