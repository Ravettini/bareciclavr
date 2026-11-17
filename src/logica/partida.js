/**
 * Estado de una partida: puntaje, intentos y resultado de cada clasificación.
 * No depende de three.js ni del navegador: se puede probar con `npm test`.
 */
export class Partida {
  /** @param {object} reglas contenido de datos/reglas.json */
  constructor(reglas) {
    this.reglas = reglas;
    this.reiniciar();
  }

  reiniciar() {
    this.puntaje = 0;
    this.aciertos = 0;
    this.errores = 0;
    /** @type {Map<string, {errores:number, clasificado:boolean}>} */
    this.estadoResiduos = new Map(this.reglas.residuos.map((r) => [r.id, { errores: 0, clasificado: false }]));
  }

  /**
   * Evalúa el depósito de un residuo en un contenedor y actualiza el puntaje.
   * Un error no resta puntos: el residuo vuelve a la mesa para reintentar.
   * @param {string} idResiduo
   * @param {string} idContenedor
   * @returns {{correcto:boolean, puntos:number, titulo:string, mensaje:string, terminada:boolean}}
   */
  depositar(idResiduo, idContenedor) {
    const residuo = this.reglas.residuos.find((r) => r.id === idResiduo);
    const contenedor = this.reglas.contenedores[idContenedor];
    const estado = this.estadoResiduos.get(idResiduo);
    if (!residuo || !contenedor || !estado) throw new Error(`Depósito desconocido: ${idResiduo} -> ${idContenedor}`);
    if (estado.clasificado) throw new Error(`El residuo ${idResiduo} ya estaba clasificado.`);

    const p = this.reglas.puntaje;
    const correcto = contenedor.acepta.includes(residuo.categoria);
    let puntos;
    if (correcto) {
      puntos = estado.errores === 0 ? p.aciertoPrimerIntento : p.aciertoDespuesDeError;
      estado.clasificado = true;
      this.aciertos++;
    } else {
      puntos = p.error;
      estado.errores++;
      this.errores++;
    }
    this.puntaje += puntos;
    return {
      correcto,
      puntos,
      titulo: correcto ? `¡Correcto! +${puntos}` : 'Probá de nuevo',
      mensaje: correcto ? residuo.acierto : residuo.error,
      terminada: this.terminada,
    };
  }

  get terminada() {
    return [...this.estadoResiduos.values()].every((e) => e.clasificado);
  }

  get puntajeMaximo() {
    return this.reglas.residuos.length * this.reglas.puntaje.aciertoPrimerIntento;
  }

  get restantes() {
    return [...this.estadoResiduos.values()].filter((e) => !e.clasificado).length;
  }
}
