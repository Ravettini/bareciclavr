/**
 * Carga y validación de las reglas de clasificación (datos/reglas.json).
 * Las reglas viven en un JSON para que el equipo institucional pueda revisarlas
 * y cambiarlas sin tocar el código.
 */

/**
 * Valida la estructura de las reglas y devuelve la lista de problemas encontrados.
 * @param {object} reglas
 * @returns {string[]} lista vacía si todo está bien
 */
export function validarReglas(reglas) {
  const problemas = [];
  if (!reglas || typeof reglas !== 'object') return ['Las reglas no son un objeto JSON.'];
  const contenedores = reglas.contenedores || {};
  if (Object.keys(contenedores).length === 0) problemas.push('No hay contenedores definidos.');
  const categoriasAceptadas = new Set();
  for (const [id, c] of Object.entries(contenedores)) {
    if (!Array.isArray(c.acepta) || c.acepta.length === 0) problemas.push(`El contenedor "${id}" no acepta ninguna categoría.`);
    else c.acepta.forEach((cat) => categoriasAceptadas.add(cat));
  }
  const ids = new Set();
  for (const r of reglas.residuos || []) {
    if (!r.id) { problemas.push('Hay un residuo sin "id".'); continue; }
    if (ids.has(r.id)) problemas.push(`El residuo "${r.id}" está repetido.`);
    ids.add(r.id);
    if (!categoriasAceptadas.has(r.categoria)) problemas.push(`Ningún contenedor acepta la categoría "${r.categoria}" del residuo "${r.id}".`);
    for (const campo of ['nombre', 'acierto', 'error']) {
      if (!r[campo]) problemas.push(`Al residuo "${r.id}" le falta "${campo}".`);
    }
  }
  if (ids.size === 0) problemas.push('No hay residuos definidos.');
  return problemas;
}

/** Descarga las reglas desde el servidor local y las valida. */
export async function cargarReglas(url = 'datos/reglas.json') {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`No se pudieron cargar las reglas (${resp.status}).`);
  const reglas = await resp.json();
  const problemas = validarReglas(reglas);
  if (problemas.length) throw new Error('Reglas inválidas:\n' + problemas.join('\n'));
  return reglas;
}
