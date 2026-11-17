import { CONFIG } from '../config.js';

/**
 * Física mínima hecha a mano (sin motor de física, para no sumar peso ni dependencias):
 * gravedad, apoyo sobre la mesa, choque con el piso y entrada a los contenedores.
 *
 * @param {import('../escena/residuos.js').Residuo} residuo
 * @param {number} dt segundos
 * @param {import('../escena/contenedores.js').Contenedor[]} contenedores
 * @param {{alDepositar:Function, alPiso:Function}} eventos
 */
export function actualizarFisica(residuo, dt, contenedores, eventos) {
  const pos = residuo.raiz.position;
  const v = residuo.velocidad;
  const r = residuo.radio;

  if (residuo.estado === 'piso') {
    residuo.tiempoEnPiso += dt;
    if (residuo.tiempoEnPiso >= CONFIG.fisica.esperaPiso) residuo.volverAMesa();
    return;
  }
  if (residuo.estado !== 'cayendo') return;

  // 1) ¿Entró en algún contenedor? (también si lo soltaron ya adentro)
  for (const c of contenedores) {
    if (c.contiene(pos)) {
      v.set(0, 0, 0);
      eventos.alDepositar(residuo, c);
      return;
    }
  }

  const yAntes = pos.y;
  v.y -= CONFIG.fisica.gravedad * dt;
  pos.addScaledVector(v, dt);

  // 2) Paredes exteriores de los contenedores: frena el desplazamiento horizontal.
  for (const c of contenedores) {
    if (c.tocaParedExterior(pos, r)) {
      pos.x -= v.x * dt;
      pos.z -= v.z * dt;
      v.x = 0;
      v.z = 0;
    }
  }

  // 3) Apoyo sobre la tapa de la mesa.
  const { centro, ancho, profundidad, alto } = CONFIG.mesa;
  const sobreMesa = Math.abs(pos.x - centro[0]) < ancho / 2 && Math.abs(pos.z - centro[2]) < profundidad / 2;
  if (sobreMesa && v.y <= 0 && yAntes - r >= alto - 0.02 && pos.y - r <= alto) {
    pos.y = alto + r;
    v.set(0, 0, 0);
    residuo.raiz.quaternion.identity();
    residuo.estado = 'mesa';
    return;
  }

  // 4) Piso (o si salió volando lejos): vuelve a la mesa tras una espera.
  if (pos.y - r <= 0 || pos.lengthSq() > 100) {
    pos.y = Math.max(pos.y, r);
    v.set(0, 0, 0);
    residuo.estado = 'piso';
    residuo.tiempoEnPiso = 0;
    eventos.alPiso(residuo);
  }
}
