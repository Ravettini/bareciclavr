/**
 * Medidas de la escena, en metros. El jugador está en el origen mirando hacia -Z.
 * Espacio de referencia "local-floor": y = 0 es el piso real.
 * La mesa a 0,75 m sirve tanto de pie como sentado.
 */
export const CONFIG = {
  mesa: { centro: [0, 0, -0.55], ancho: 1.1, profundidad: 0.55, alto: 0.75 },
  contenedores: {
    verde: { posicion: [-0.75, 0, -0.5] },
    negro: { posicion: [0.75, 0, -0.5] },
    ancho: 0.42, alto: 0.72,
  },
  panel: { posicion: [0, 1.55, -1.45], ancho: 1.3, alto: 0.55 },
  boton: { posicion: [0, 0.78, -0.72] },
  agarre: {
    distanciaCercana: 0.14, // agarre directo: la mano toca el objeto
    distanciaRayo: 3.0, // agarre a distancia con el rayo (útil sentado)
  },
  fisica: { gravedad: 9.8, velocidadMaxima: 6, esperaPiso: 1.2 },
  camaraEscritorio: { altura: 1.55 }, // vista sin visor (pruebas en PC)
};
